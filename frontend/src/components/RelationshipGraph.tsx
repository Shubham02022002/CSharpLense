import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type MouseEvent,
} from "react";
import {
  Background,
  Controls,
  MarkerType,
  ReactFlow,
  ReactFlowProvider,
  useReactFlow,
  type Edge,
  type Node,
} from "@xyflow/react";

import "@xyflow/react/dist/style.css";

import type { CodeAnalysis } from "../types/analysis";
import { findOwnerType } from "../lib/model";
import { layoutGraph } from "../lib/layout";

export interface FocusRequest {
  nodeId: string;
  /** Bumped on every request, so focusing the same node twice still works. */
  nonce: number;
}

interface RelationshipGraphProps {
  analysis: CodeAnalysis;
  selectedNodeId: string | null;
  focusRequest: FocusRequest | null;
  onSelectNode: (nodeId: string | null) => void;
}

const RELATIONSHIP_COLORS: Record<string, string> = {
  Inheritance: "#4f2bab",
  Implementation: "#0f7a72",
  Dependency: "var(--gold)",
};

function GraphCanvas({
  analysis,
  selectedNodeId,
  focusRequest,
  onSelectNode,
}: RelationshipGraphProps) {
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const { fitView } = useReactFlow();
  const canvasRef = useRef<HTMLDivElement>(null);

  // What the graph is explaining: the hovered node, else the selection.
  const emphasisId = hoveredId ?? selectedNodeId;

  const expandedTypeId = useMemo(() => {
    const owner = findOwnerType(analysis, selectedNodeId);
    return owner?.id ?? null;
  }, [analysis, selectedNodeId]);

  const layout = useMemo(
    () => layoutGraph(analysis, expandedTypeId),
    [analysis, expandedTypeId],
  );

  const emphasisTypeId = useMemo(() => {
    const owner = findOwnerType(analysis, emphasisId);
    return owner?.id ?? null;
  }, [analysis, emphasisId]);

  // Types directly connected to the emphasised one stay lit; the rest recede.
  const litTypeIds = useMemo(() => {
    const lit = new Set<string>();

    if (!emphasisTypeId) {
      return lit;
    }

    lit.add(emphasisTypeId);

    for (const relationship of analysis.relationships) {
      if (relationship.sourceId === emphasisTypeId) {
        lit.add(relationship.targetId);
      }

      if (relationship.targetId === emphasisTypeId) {
        lit.add(relationship.sourceId);
      }
    }

    return lit;
  }, [analysis, emphasisTypeId]);

  const nodes: Node[] = useMemo(() => {
    const typeById = new Map(analysis.types.map((type) => [type.id, type]));
    const memberById = new Map(
      analysis.types.flatMap((type) =>
        type.members.map((member) => [member.id, member] as const),
      ),
    );

    return layout.items.map((item) => {
      const isSelected = item.id === selectedNodeId;
      const isEmphasised = item.id === emphasisId;
      const isLit = litTypeIds.has(item.typeId);
      const dimmed = Boolean(emphasisTypeId) && !isLit;

      if (item.isMember) {
        const member = memberById.get(item.id);

        return {
          id: item.id,
          position: { x: item.x, y: item.y },
          data: {
            label: (
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: "10px",
                }}
              >
                <span style={{ fontSize: "12px", color: "var(--text)" }}>
                  {member?.name}
                </span>

                <span style={{ fontSize: "10px", color: "var(--text-muted)" }}>
                  {member?.kind}
                </span>
              </div>
            ),
          },
          style: {
            background: "var(--surface)",
            border: isSelected
              ? "1px solid var(--accent)"
              : "1px solid var(--border-strong)",
            borderRadius: "7px",
            padding: "9px 12px",
            width: item.width,
            minHeight: item.height,
            opacity: dimmed ? 0.35 : 1,
            boxShadow: isEmphasised
              ? "0 0 0 3px var(--accent-wash)"
              : "none",
          },
        };
      }

      const type = typeById.get(item.id);

      return {
        id: item.id,
        position: { x: item.x, y: item.y },
        data: {
          label: (
            <div style={{ display: "flex", flexDirection: "column", gap: "7px" }}>
              <div
                style={{
                  fontSize: "14px",
                  fontWeight: 600,
                  color: "var(--text-strong)",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
              >
                {type?.name}
              </div>

              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  fontSize: "11px",
                }}
              >
                <span style={{ color: "var(--accent)", fontWeight: 600 }}>
                  {type?.kind}
                </span>

                <span style={{ color: "var(--text-muted)" }}>
                  {type?.members.length ?? 0} members
                </span>
              </div>
            </div>
          ),
        },
        style: {
          background: isSelected
            ? "var(--accent-surface)"
            : "var(--surface-raised)",
          border: isSelected
            ? "1px solid var(--accent)"
            : "1px solid var(--border-strong)",
          borderRadius: "var(--radius)",
          padding: "11px 13px",
          width: item.width,
          minHeight: item.height,
          opacity: dimmed ? 0.4 : 1,
          boxShadow: isEmphasised
            ? "0 0 0 3px var(--accent-wash)"
            : "0 4px 14px rgba(23, 18, 32, 0.07)",
        },
      };
    });
  }, [
    analysis,
    layout,
    selectedNodeId,
    emphasisId,
    emphasisTypeId,
    litTypeIds,
  ]);

  const edges: Edge[] = useMemo(() => {
    const result: Edge[] = [];

    analysis.relationships.forEach((relationship, index) => {
      const colour =
        RELATIONSHIP_COLORS[relationship.type] ?? "var(--text-faint)";

      const isLit =
        Boolean(emphasisTypeId) &&
        (relationship.sourceId === emphasisTypeId ||
          relationship.targetId === emphasisTypeId);

      result.push({
        id: `relationship-${index}`,
        source: relationship.sourceId,
        target: relationship.targetId,
        type: "smoothstep",
        animated: relationship.type === "Dependency",
        label: relationship.type,
        markerEnd: { type: MarkerType.ArrowClosed, width: 15, height: 15 },
        style: {
          stroke: isLit ? colour : "var(--border-strong)",
          strokeWidth: isLit ? 2 : 1.5,
          opacity: emphasisTypeId && !isLit ? 0.2 : 0.9,
        },
        labelStyle: {
          fill: isLit ? colour : "var(--text-muted)",
          fontSize: 10,
        },
        labelBgStyle: { fill: "var(--surface-sunken)" },
        labelBgPadding: [4, 2] as [number, number],
      });
    });

    // Membership edges, drawn only for the expanded type.
    if (expandedTypeId) {
      const expanded = analysis.types.find(
        (type) => type.id === expandedTypeId,
      );

      expanded?.members.forEach((member, index) => {
        result.push({
          id: `membership-${index}`,
          source: expandedTypeId,
          target: member.id,
          type: "straight",
          selectable: false,
          style: {
            stroke: "var(--border-strong)",
            strokeWidth: 1,
            strokeDasharray: "3 4",
          },
        });
      });
    }

    return result;
  }, [analysis, emphasisTypeId, expandedTypeId]);

  // Centre on a node chosen from outside the graph.
  useEffect(() => {
    if (!focusRequest) {
      return;
    }

    fitView({
      nodes: [{ id: focusRequest.nodeId }],
      duration: 420,
      padding: 0.6,
      maxZoom: 1.1,
    });
  }, [focusRequest, fitView]);

  // React Flow only fits on mount, so refit when the details column opens.
  useEffect(() => {
    const element = canvasRef.current;

    if (!element) {
      return;
    }

    let lastWidth = element.clientWidth;

    const observer = new ResizeObserver(() => {
      const width = element.clientWidth;

      if (width === 0 || width === lastWidth) {
        return;
      }

      lastWidth = width;
      fitView({ padding: 0.08, maxZoom: 1 });
    });

    observer.observe(element);

    return () => observer.disconnect();
  }, [fitView]);

  const handleNodeClick = useCallback(
    (_event: MouseEvent, node: Node) => onSelectNode(node.id),
    [onSelectNode],
  );

  const handlePaneClick = useCallback(
    () => onSelectNode(null),
    [onSelectNode],
  );

  return (
    <div ref={canvasRef} style={{ width: "100%", height: "100%" }}>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        fitView
        fitViewOptions={{ padding: 0.08, maxZoom: 1 }}
        // Below this the labels stop being readable.
        minZoom={0.4}
        maxZoom={1.6}
        nodesDraggable={false}
        nodesConnectable={false}
        attributionPosition="bottom-left"
        onNodeClick={handleNodeClick}
        onPaneClick={handlePaneClick}
        onNodeMouseEnter={(_, node) => setHoveredId(node.id)}
        onNodeMouseLeave={() => setHoveredId(null)}
      >
        <Background gap={22} size={1} color="var(--border-strong)" />

        <Controls
          showInteractive={false}
          style={{
            background: "var(--surface)",
            border: "1px solid var(--border)",
            borderRadius: "8px",
          }}
        />
      </ReactFlow>
    </div>
  );
}

function RelationshipGraph(props: RelationshipGraphProps) {
  return (
    <ReactFlowProvider>
      <GraphCanvas {...props} />
    </ReactFlowProvider>
  );
}

export default RelationshipGraph;
