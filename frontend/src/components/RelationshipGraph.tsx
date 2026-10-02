import {
    Background,
    Controls,
    MarkerType,
    Position,
    ReactFlow,
    type Edge,
    type Node,
} from "@xyflow/react";

import "@xyflow/react/dist/style.css";

import type { CodeAnalysis } from "../types/analysis";

interface RelationshipGraphProps {
    analysis: CodeAnalysis;
    selectedTypeId: string | null;
    onSelectType: (typeId: string | null) => void;
}

function getTypeKind(kind: number | string) {
    if (typeof kind === "string") {
        return kind;
    }

    const kinds = [
        "Class",
        "Interface",
        "Struct",
        "Record",
        "Enum",
    ];

    return kinds[kind] ?? "Unknown";
}

function getRelationshipType(type: number | string) {
    if (typeof type === "string") {
        return type;
    }

    const types = [
        "Inheritance",
        "Implementation",
        "Dependency",
    ];

    return types[type] ?? "Unknown";
}

function RelationshipGraph({
    analysis,
    selectedTypeId,
    onSelectType,
}: RelationshipGraphProps) {
    const nodes: Node[] = analysis.types.map((type, index) => {
        const isSelected = type.id === selectedTypeId;

        return {
            id: type.id,

            position: {
                x: (index % 3) * 260,
                y: Math.floor(index / 3) * 180,
            },

            sourcePosition: Position.Right,
            targetPosition: Position.Left,

            data: {
                label: (
                    <div
                        style={{
                            minWidth: "170px",
                            padding: "4px",
                        }}
                    >
                        <div
                            style={{
                                fontSize: "14px",
                                fontWeight: 600,
                                color: "#f9fafb",
                                marginBottom: "6px",
                            }}
                        >
                            {type.name}
                        </div>

                        <div
                            style={{
                                display: "flex",
                                justifyContent: "space-between",
                                alignItems: "center",
                                fontSize: "11px",
                            }}
                        >
                            <span
                                style={{
                                    color: "#8b9cf6",
                                }}
                            >
                                {getTypeKind(type.kind)}
                            </span>

                            <span
                                style={{
                                    color: "#6b7280",
                                }}
                            >
                                {type.members.length} members
                            </span>
                        </div>
                    </div>
                ),
            },

            style: {
                background: isSelected
                    ? "#1d2438"
                    : "#151821",

                border: isSelected
                    ? "1px solid #7183ff"
                    : "1px solid #303544",

                borderRadius: "10px",

                padding: "10px 12px",

                color: "#fff",

                boxShadow: isSelected
                    ? "0 0 0 2px rgba(113, 131, 255, 0.15)"
                    : "0 8px 24px rgba(0, 0, 0, 0.2)",
            },
        };
    });

    const edges: Edge[] = analysis.relationships.map(
        (relationship, index) => {
            const relationshipType = getRelationshipType(
                relationship.type
            );

            const isConnectedToSelected =
                selectedTypeId === relationship.sourceId ||
                selectedTypeId === relationship.targetId;

            return {
                id: `relationship-${index}`,

                source: relationship.sourceId,

                target: relationship.targetId,

                type: "smoothstep",

                animated:
                    relationshipType === "Dependency",

                label: relationshipType,

                markerEnd: {
                    type: MarkerType.ArrowClosed,
                    width: 16,
                    height: 16,
                },

                style: {
                    stroke: isConnectedToSelected
                        ? "#7183ff"
                        : "#596273",

                    strokeWidth: isConnectedToSelected
                        ? 2
                        : 1.5,

                    opacity:
                        selectedTypeId &&
                            !isConnectedToSelected
                            ? 0.25
                            : 1,
                },

                labelStyle: {
                    fill: isConnectedToSelected
                        ? "#aeb8ff"
                        : "#9ca3af",

                    fontSize: 10,

                    opacity:
                        selectedTypeId &&
                            !isConnectedToSelected
                            ? 0.25
                            : 1,
                },

                labelBgStyle: {
                    fill: "#0b0d12",
                },
            };
        }
    );

    return (
        <div
            style={{
                width: "100%",
                height: "100%",
                minHeight: "500px",
            }}
        >
            <ReactFlow
                nodes={nodes}
                edges={edges}
                fitView
                fitViewOptions={{
                    padding: 0.2,
                }}
                minZoom={0.3}
                maxZoom={1.5}
                attributionPosition="bottom-left"
                onNodeClick={(_, node) => {
                    onSelectType(node.id);
                }}
                onPaneClick={() => {
                    onSelectType(null);
                }}
            >
                <Background
                    gap={20}
                    size={1}
                    color="#20242e"
                />

                <Controls
                    style={{
                        background: "#151821",
                        border: "1px solid #303544",
                        borderRadius: "8px",
                    }}
                />
            </ReactFlow>
        </div>
    );
}

export default RelationshipGraph;