import type { CodeDiagnostic } from "../types/analysis";

interface DiagnosticsListProps {
    diagnostics: CodeDiagnostic[];
}

function DiagnosticsList({ diagnostics }: DiagnosticsListProps) {
    if (diagnostics.length === 0) {
        return null;
    }

    return (
        <section>
            <h2
                style={{
                    fontSize: "15px",
                    margin: "0 0 12px",
                }}
            >
                Diagnostics
            </h2>

            {diagnostics.map((diagnostic) => (
                <div
                    key={diagnostic.id}
                    style={{
                        marginBottom: "10px",
                        padding: "12px 14px",
                        background: "#151821",
                        border: "1px solid #252936",
                        borderRadius: "8px",
                    }}
                >
                    <div
                        style={{
                            display: "flex",
                            justifyContent: "space-between",
                            marginBottom: "6px",
                        }}
                    >
                        <span
                            style={{
                                fontSize: "12px",
                                fontWeight: 600,
                                color: "#f59e0b",
                            }}
                        >
                            {diagnostic.severity}
                        </span>

                        <span
                            style={{
                                fontSize: "11px",
                                color: "#6b7280",
                            }}
                        >
                            Line {diagnostic.startLine}, Column {diagnostic.startColumn}
                        </span>
                    </div>

                    <div
                        style={{
                            fontSize: "13px",
                            color: "#d1d5db",
                            lineHeight: 1.5,
                        }}
                    >
                        {diagnostic.message}
                    </div>
                </div>
            ))}
        </section>
    );
}

export default DiagnosticsList;