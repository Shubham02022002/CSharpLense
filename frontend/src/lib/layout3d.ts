import type { CodeAnalysis, RelationshipType } from "../types/analysis";

export interface Node3D {
  id: string;
  name: string;
  /** Type or member kind, which picks the shape in the scene. */
  kind: string;
  /** The owning type, so a member dims with its parent. */
  typeId: string;
  isMember: boolean;
  position: [number, number, number];
}

export interface Edge3D {
  id: string;
  relationship: RelationshipType;
  sourceId: string;
  targetId: string;
  from: [number, number, number];
  to: [number, number, number];
  /** Membership is structural, not a relationship in the source. */
  membership: boolean;
}

export interface Layout3D {
  types: Node3D[];
  members: Node3D[];
  edges: Edge3D[];
  /** Where the camera should look, so the graph is framed however many layers. */
  center: [number, number, number];
  /** Distance from the centre that has to stay in frame. */
  span: number;
}

const LAYER_HEIGHT = 4.4;
const RING_MIN_RADIUS = 2.6;
const NODE_SPACING = 2.6;
const MEMBER_RADIUS = 1.7;
const MEMBER_HEIGHT = -0.9;

/** Half a label's width per character, in world units per character of name. */
const TYPE_CHAR = 0.066;
const MEMBER_CHAR = 0.044;

/**
 * Inheritance depth per type, which becomes the vertical axis: §21 gives
 * inheritance the vertical edge, so base types sit above what derives from them.
 */
function inheritanceDepth(analysis: CodeAnalysis): Map<string, number> {
  const parents = new Map<string, string[]>(
    analysis.types.map((type) => [type.id, []]),
  );

  for (const relationship of analysis.relationships) {
    if (relationship.type === "Inheritance") {
      parents.get(relationship.sourceId)?.push(relationship.targetId);
    }
  }

  const depths = new Map<string, number>();

  const resolve = (id: string, visiting: Set<string>): number => {
    const known = depths.get(id);

    if (known !== undefined) {
      return known;
    }

    // A cycle in the source would otherwise recurse forever.
    if (visiting.has(id)) {
      return 0;
    }

    visiting.add(id);

    const baseIds = parents.get(id) ?? [];
    const depth =
      baseIds.length === 0
        ? 0
        : 1 + Math.max(...baseIds.map((base) => resolve(base, visiting)));

    visiting.delete(id);
    depths.set(id, depth);

    return depth;
  };

  for (const type of analysis.types) {
    resolve(type.id, new Set());
  }

  return depths;
}

/** Lays types out in inheritance layers, each layer ringed around the vertical axis. */
export function layout3d(
  analysis: CodeAnalysis,
  expandedTypeId: string | null,
): Layout3D {
  const depths = inheritanceDepth(analysis);

  const layers = new Map<number, typeof analysis.types>();

  for (const type of analysis.types) {
    const depth = depths.get(type.id) ?? 0;
    const layer = layers.get(depth);

    if (layer) {
      layer.push(type);
    } else {
      layers.set(depth, [type]);
    }
  }

  const types: Node3D[] = [];

  for (const [depth, layer] of layers) {
    const y = -depth * LAYER_HEIGHT;
    const radius =
      layer.length === 1
        ? 0
        : Math.max(RING_MIN_RADIUS, (layer.length * NODE_SPACING) / (2 * Math.PI));

    layer.forEach((type, index) => {
      const angle = (index / layer.length) * Math.PI * 2;

      types.push({
        id: type.id,
        name: type.name,
        kind: type.kind,
        typeId: type.id,
        isMember: false,
        position: [Math.cos(angle) * radius, y, Math.sin(angle) * radius],
      });
    });
  }

  const byId = new Map(types.map((type) => [type.id, type]));

  const edges: Edge3D[] = [];

  for (const relationship of analysis.relationships) {
    const from = byId.get(relationship.sourceId);
    const to = byId.get(relationship.targetId);

    if (from && to) {
      edges.push({
        id: `relationship-${relationship.sourceId}-${relationship.targetId}`,
        relationship: relationship.type,
        sourceId: relationship.sourceId,
        targetId: relationship.targetId,
        from: from.position,
        to: to.position,
        membership: false,
      });
    }
  }

  // Members orbit their type, matching the 2D graph's expansion.
  const members: Node3D[] = [];
  const expanded = analysis.types.find((type) => type.id === expandedTypeId);
  const anchor = expandedTypeId ? byId.get(expandedTypeId) : undefined;

  if (expanded && anchor) {
    expanded.members.forEach((member, index) => {
      const angle = (index / expanded.members.length) * Math.PI * 2;

      const position: [number, number, number] = [
        anchor.position[0] + Math.cos(angle) * MEMBER_RADIUS,
        anchor.position[1] + MEMBER_HEIGHT,
        anchor.position[2] + Math.sin(angle) * MEMBER_RADIUS,
      ];

      members.push({
        id: member.id,
        name: member.name,
        kind: member.kind,
        typeId: expanded.id,
        isMember: true,
        position,
      });

      edges.push({
        id: `membership-${member.id}`,
        relationship: "Dependency",
        sourceId: expanded.id,
        targetId: member.id,
        from: anchor.position,
        to: position,
        membership: true,
      });
    });
  }

  const all = [...types, ...members];

  const center: [number, number, number] = all.length
    ? [0, all.reduce((sum, node) => sum + node.position[1], 0) / all.length, 0]
    : [0, 0, 0];

  // Labels are billboards drawn at a fixed world height, so the room they need
  // is part of what the camera has to fit — otherwise long names clip.
  const reach = all.map((node) => {
    const distance = Math.hypot(
      node.position[0] - center[0],
      node.position[1] - center[1],
      node.position[2] - center[2],
    );

    return distance + node.name.length * (node.isMember ? MEMBER_CHAR : TYPE_CHAR);
  });

  const span = reach.length
    ? Math.max(...reach)
    : // A single type has no extent; the floor keeps the camera off its surface.
      2.5;

  return { types, members, edges, center, span };
}
