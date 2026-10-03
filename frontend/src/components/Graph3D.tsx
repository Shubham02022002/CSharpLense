import { useCallback, useEffect, useMemo, useRef } from "react";
import {
  Canvas,
  useFrame,
  useThree,
  type ThreeEvent,
} from "@react-three/fiber";
import { Line, OrbitControls } from "@react-three/drei";
import * as THREE from "three";

import type { CodeAnalysis, CodeTypeKind } from "../types/analysis";
import { layout3d, type Edge3D, type Layout3D, type Node3D } from "../lib/layout3d";
import { RELATIONSHIP_HEX, TYPE_HEX } from "../lib/relationshipStyle";
import { findOwnerType } from "../lib/model";
import { useStableHover } from "../hooks/useStableHover";

const LABEL_FONT =
  '600 64px Inter, system-ui, "Segoe UI", Roboto, sans-serif';

/**
 * A label drawn into a texture rather than the DOM: drei's <Html> mounts a React
 * root per node, which React 19 will not unmount mid-render.
 */
function useLabelTexture(text: string, color: string) {
  const label = useMemo(() => {
    const canvas = document.createElement("canvas");
    const context = canvas.getContext("2d");

    if (!context) {
      return null;
    }

    context.font = LABEL_FONT;

    const width = Math.max(Math.ceil(context.measureText(text).width), 1);
    const height = 88;

    canvas.width = width;
    canvas.height = height;

    // Resizing the canvas resets its context, so the font is set twice.
    context.font = LABEL_FONT;
    context.fillStyle = color;
    context.textAlign = "center";
    context.textBaseline = "middle";
    context.fillText(text, width / 2, height / 2);

    const texture = new THREE.CanvasTexture(canvas);

    texture.colorSpace = THREE.SRGBColorSpace;
    texture.minFilter = THREE.LinearFilter;
    texture.generateMipmaps = false;

    return { texture, aspect: width / height };
  }, [text, color]);

  useEffect(() => () => label?.texture.dispose(), [label]);

  return label;
}

function Label({
  text,
  color,
  height,
  y,
}: {
  text: string;
  color: string;
  height: number;
  y: number;
}) {
  const label = useLabelTexture(text, color);

  if (!label) {
    return null;
  }

  return (
    <sprite position={[0, y, 0]} scale={[height * label.aspect, height, 1]}>
      <spriteMaterial
        map={label.texture}
        transparent
        depthWrite={false}
        toneMapped={false}
      />
    </sprite>
  );
}

interface Graph3DProps {
  analysis: CodeAnalysis;
  selectedNodeId: string | null;
  onSelectNode: (nodeId: string | null) => void;
}

const MEMBER_COLOR = "#746c62";

/** §21's shape per kind. Records are classes, but a distinct solid reads better. */
function KindGeometry({ kind, member }: { kind: string; member: boolean }) {
  if (member) {
    return <sphereGeometry args={[0.19, 18, 18]} />;
  }

  switch (kind as CodeTypeKind) {
    case "Interface":
      return <torusGeometry args={[0.48, 0.15, 18, 44]} />;
    case "Struct":
      return <boxGeometry args={[0.92, 0.92, 0.92]} />;
    case "Enum":
      return <cylinderGeometry args={[0.5, 0.5, 1, 26]} />;
    case "Record":
      return <octahedronGeometry args={[0.62]} />;
    default:
      return <sphereGeometry args={[0.56, 30, 30]} />;
  }
}

interface NodeMeshProps {
  node: Node3D;
  selected: boolean;
  emphasised: boolean;
  dimmed: boolean;
  onHoverEnter: (nodeId: string) => void;
  onHoverLeave: () => void;
  onSelect: (nodeId: string) => void;
}

function NodeMesh({
  node,
  selected,
  emphasised,
  dimmed,
  onHoverEnter,
  onHoverLeave,
  onSelect,
}: NodeMeshProps) {
  const color = node.isMember
    ? MEMBER_COLOR
    : (TYPE_HEX[node.kind as CodeTypeKind] ?? MEMBER_COLOR);

  const handleClick = useCallback(
    (event: ThreeEvent<MouseEvent>) => {
      event.stopPropagation();
      onSelect(node.id);
    },
    [node.id, onSelect],
  );

  const handleOver = useCallback(
    (event: ThreeEvent<PointerEvent>) => {
      event.stopPropagation();
      onHoverEnter(node.id);
    },
    [node.id, onHoverEnter],
  );

  const handleOut = useCallback(() => onHoverLeave(), [onHoverLeave]);

  const meshRef = useRef<THREE.Mesh>(null);
  const materialRef = useRef<THREE.MeshStandardMaterial>(null);

  // Emphasis eases in and out. Snapping it makes the scene flash as the pointer
  // crosses the board, which reads as the graph blinking.
  const targetOpacity = dimmed ? 0.22 : 1;
  const targetScale = emphasised ? 1.22 : 1;
  const targetGlow = selected ? 0.55 : emphasised ? 0.32 : 0.06;

  useFrame((_, delta) => {
    // Frame-rate independent easing, so the fade takes the same time at any fps.
    const ease = 1 - Math.pow(0.0001, delta);

    const material = materialRef.current;

    if (material) {
      material.opacity += (targetOpacity - material.opacity) * ease;
      material.emissiveIntensity +=
        (targetGlow - material.emissiveIntensity) * ease;
    }

    const mesh = meshRef.current;

    if (mesh) {
      const scale = mesh.scale.x + (targetScale - mesh.scale.x) * ease;
      mesh.scale.setScalar(scale);
    }
  });

  return (
    <group position={node.position}>
      <mesh
        ref={meshRef}
        onClick={handleClick}
        onPointerOver={handleOver}
        onPointerOut={handleOut}
      >
        <KindGeometry kind={node.kind} member={node.isMember} />

        <meshStandardMaterial
          ref={materialRef}
          color={color}
          emissive={color}
          emissiveIntensity={targetGlow}
          roughness={0.38}
          metalness={0.12}
          // Kept on so the opacity fade works in both directions.
          transparent
          opacity={targetOpacity}
        />
      </mesh>

      <Label
        text={node.name}
        color={selected ? "#4f2bab" : dimmed ? "#b0a89d" : "#171220"}
        height={node.isMember ? 0.24 : 0.36}
        y={node.isMember ? -0.4 : -1.05}
      />
    </group>
  );
}

function EdgeLine({ edge, dimmed }: { edge: Edge3D; dimmed: boolean }) {
  const color = edge.membership
    ? "#b0a89d"
    : (RELATIONSHIP_HEX[edge.relationship] ?? MEMBER_COLOR);

  return (
    <Line
      points={[edge.from, edge.to]}
      color={color}
      lineWidth={edge.membership ? 1 : edge.relationship === "Inheritance" ? 2.2 : 1.6}
      dashed={edge.membership || edge.relationship === "Implementation"}
      dashSize={0.32}
      gapSize={0.26}
      transparent
      opacity={dimmed ? 0.12 : 0.8}
    />
  );
}

function Scene({
  analysis,
  selectedNodeId,
  onSelectNode,
}: Graph3DProps) {
  const hover = useStableHover<string>();

  // What the scene is explaining: the hovered node, else the selection.
  const emphasisId = hover.id ?? selectedNodeId;

  const expandedTypeId = useMemo(() => {
    const owner = findOwnerType(analysis, selectedNodeId);
    return owner?.id ?? null;
  }, [analysis, selectedNodeId]);

  const layout = useMemo(
    () => layout3d(analysis, expandedTypeId),
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

  const isNodeDimmed = useCallback(
    (node: Node3D) =>
      Boolean(emphasisTypeId) && !litTypeIds.has(node.typeId),
    [emphasisTypeId, litTypeIds],
  );

  const isEdgeDimmed = useCallback(
    (edge: Edge3D) => {
      if (!emphasisTypeId) {
        return false;
      }

      // A membership line follows its parent; a relationship needs both ends lit.
      return edge.membership
        ? !litTypeIds.has(edge.sourceId)
        : !(
            litTypeIds.has(edge.sourceId) && litTypeIds.has(edge.targetId)
          );
    },
    [emphasisTypeId, litTypeIds],
  );

  const nodes = useMemo(
    () => [...layout.types, ...layout.members],
    [layout],
  );

  return (
    <>
      <ambientLight intensity={1.15} />
      <directionalLight position={[7, 10, 8]} intensity={1.7} />
      <directionalLight position={[-8, -5, -7]} intensity={0.6} />

      <OrbitControls
        makeDefault
        enableDamping
        dampingFactor={0.09}
        target={layout.center}
        minDistance={3}
        maxDistance={layout.span * 6}
        maxPolarAngle={Math.PI * 0.86}
      />

      {layout.edges.map((edge) => (
        <EdgeLine key={edge.id} edge={edge} dimmed={isEdgeDimmed(edge)} />
      ))}

      {nodes.map((node) => (
        <NodeMesh
          key={node.id}
          node={node}
          selected={node.id === selectedNodeId}
          emphasised={node.id === emphasisId}
          dimmed={isNodeDimmed(node)}
          onHoverEnter={hover.enter}
          onHoverLeave={hover.leave}
          onSelect={onSelectNode}
        />
      ))}
    </>
  );
}

const FOV = 42;
const VIEW_DIRECTION = new THREE.Vector3(1.5, 0.9, 2.2).normalize();
/** Above 1 the whole graph fits with a margin rather than touching the edges. */
const FIT_MARGIN = 1.05;

const HALF_FOV = (FOV / 2) * (Math.PI / 180);

/** Backs the camera off far enough for the layout's radius to fit the viewport. */
function frameCamera(layout: Layout3D, aspect: number) {
  // A narrow panel is bounded by the horizontal field of view, not the vertical.
  const halfAngle = Math.min(
    HALF_FOV,
    Math.atan(Math.tan(HALF_FOV) * Math.max(aspect, 0.1)),
  );

  const distance = (layout.span * FIT_MARGIN) / Math.sin(halfAngle);

  const position = VIEW_DIRECTION.clone()
    .multiplyScalar(distance)
    .add(new THREE.Vector3(...layout.center));

  return {
    distance,
    position: [position.x, position.y, position.z] as [number, number, number],
  };
}

/** Re-frames whenever the canvas changes shape, the way the 2D graph refits. */
function CameraRig({ layout }: { layout: Layout3D }) {
  const camera = useThree((state) => state.camera);
  const size = useThree((state) => state.size);
  const controls = useThree((state) => state.controls);

  useEffect(() => {
    if (!size.width || !size.height) {
      return;
    }

    const { position, distance } = frameCamera(layout, size.width / size.height);

    camera.position.set(position[0], position[1], position[2]);
    camera.near = Math.max(distance / 500, 0.1);
    camera.far = distance * 6;
    camera.updateProjectionMatrix();

    const orbit = controls as
      | { target: THREE.Vector3; update: () => void }
      | null;

    if (orbit?.target) {
      orbit.target.set(...layout.center);
      orbit.update();
    }
  }, [camera, controls, layout, size.width, size.height]);

  return null;
}

function Graph3D({ analysis, selectedNodeId, onSelectNode }: Graph3DProps) {
  const layout = useMemo(() => layout3d(analysis, null), [analysis]);

  return (
    <Canvas
      // Remounting per analysis gives a fresh camera for a new shape of graph.
      key={analysis.id}
      dpr={[1, 2]}
      camera={{ fov: FOV, near: 0.1, far: 200 }}
      onPointerMissed={() => onSelectNode(null)}
    >
      <CameraRig layout={layout} />

      <Scene
        analysis={analysis}
        selectedNodeId={selectedNodeId}
        onSelectNode={onSelectNode}
      />
    </Canvas>
  );
}

export default Graph3D;
