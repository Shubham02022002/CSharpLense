import type { CodeType } from "../types/analysis";

interface TypeListProps {
    types: CodeType[];
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

function TypeList({ types }: TypeListProps) {
    return (
        <section>
            <h2
                style={{
                    fontSize: "15px",
                    margin: "0 0 12px",
                }}
            >
                Types
            </h2>

            {types.map((type) => (
                <div
                    key={type.id}
                    style={{
                        marginBottom: "14px",
                        padding: "16px",
                        background: "#151821",
                        border: "1px solid #252936",
                        borderRadius: "8px",
                    }}
                >
                    <div
                        style={{
                            display: "flex",
                            justifyContent: "space-between",
                            alignItems: "center",
                        }}
                    >
                        <div
                            style={{
                                fontSize: "15px",
                                fontWeight: 600,
                            }}
                        >
                            {type.name}
                        </div>

                        <span
                            style={{
                                padding: "4px 8px",
                                borderRadius: "5px",
                                background: "#252936",
                                color: "#9ca3af",
                                fontSize: "11px",
                            }}
                        >
                            {getTypeKind(type.kind)}
                        </span>
                    </div>

                    {type.members.length > 0 && (
                        <div
                            style={{
                                marginTop: "14px",
                                borderTop: "1px solid #252936",
                                paddingTop: "10px",
                            }}
                        >
                            {type.members.map((member) => (
                                <div
                                    key={member.id}
                                    style={{
                                        display: "flex",
                                        justifyContent: "space-between",
                                        padding: "8px 0",
                                        fontSize: "13px",
                                    }}
                                >
                                    <span style={{ color: "#d1d5db" }}>
                                        {member.name}
                                    </span>

                                    <span style={{ color: "#6b7280" }}>
                                        {getMemberKind(member.kind)}
                                        {member.returnType
                                            ? ` · ${member.returnType}`
                                            : ""}
                                    </span>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            ))}
        </section>
    );
}

export default TypeList;