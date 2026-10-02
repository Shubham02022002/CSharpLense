import type { CodeType } from "../types/analysis";

interface TypeDetailsProps {
    type: CodeType | null;
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

function getMemberKind(kind: number | string) {
    if (typeof kind === "string") {
        return kind;
    }

    const kinds = [
        "Constructor",
        "Method",
        "Property",
        "Field",
    ];

    return kinds[kind] ?? "Unknown";
}

function TypeDetails({ type }: TypeDetailsProps) {
    if (!type) {
        return (
            <section
                style={{
                    padding: "20px",
                    border: "1px solid #252936",
                    borderRadius: "10px",
                    background: "#11141b",
                    color: "#6b7280",
                    textAlign: "center",
                }}
            >
                Select a type from the graph to inspect it.
            </section>
        );
    }

    return (
        <section
            style={{
                border: "1px solid #252936",
                borderRadius: "10px",
                background: "#11141b",
                overflow: "hidden",
            }}
        >
            {/* Header */}
            <div
                style={{
                    padding: "16px 18px",
                    borderBottom: "1px solid #252936",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                }}
            >
                <div>
                    <div
                        style={{
                            fontSize: "16px",
                            fontWeight: 600,
                            color: "#f9fafb",
                        }}
                    >
                        {type.name}
                    </div>

                    <div
                        style={{
                            marginTop: "4px",
                            fontSize: "12px",
                            color: "#8b9cf6",
                        }}
                    >
                        {getTypeKind(type.kind)}
                    </div>
                </div>

                <span
                    style={{
                        padding: "5px 9px",
                        borderRadius: "6px",
                        background: "#1b2030",
                        color: "#9ca3af",
                        fontSize: "11px",
                    }}
                >
                    {type.members.length} members
                </span>
            </div>

            {/* Members */}
            <div style={{ padding: "8px 18px 14px" }}>
                {type.members.length === 0 ? (
                    <div
                        style={{
                            padding: "16px 0",
                            color: "#6b7280",
                            fontSize: "13px",
                        }}
                    >
                        No members found.
                    </div>
                ) : (
                    type.members.map((member) => (
                        <div
                            key={member.id}
                            style={{
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "space-between",
                                gap: "20px",
                                padding: "11px 0",
                                borderBottom: "1px solid #1d2029",
                            }}
                        >
                            <div
                                style={{
                                    minWidth: 0,
                                }}
                            >
                                <div
                                    style={{
                                        color: "#d1d5db",
                                        fontSize: "13px",
                                        fontWeight: 500,
                                    }}
                                >
                                    {member.name}
                                </div>

                                {member.parameters.length > 0 && (
                                    <div
                                        style={{
                                            marginTop: "4px",
                                            color: "#6b7280",
                                            fontSize: "11px",
                                            overflow: "hidden",
                                            textOverflow: "ellipsis",
                                        }}
                                    >
                                        ({member.parameters.join(", ")})
                                    </div>
                                )}
                            </div>

                            <div
                                style={{
                                    display: "flex",
                                    alignItems: "center",
                                    gap: "8px",
                                    flexShrink: 0,
                                }}
                            >
                                <span
                                    style={{
                                        color: "#8b9cf6",
                                        fontSize: "11px",
                                    }}
                                >
                                    {getMemberKind(member.kind)}
                                </span>

                                {member.returnType && (
                                    <span
                                        style={{
                                            color: "#6b7280",
                                            fontSize: "11px",
                                        }}
                                    >
                                        {member.returnType}
                                    </span>
                                )}
                            </div>
                        </div>
                    ))
                )}
            </div>
        </section>
    );
}

export default TypeDetails;