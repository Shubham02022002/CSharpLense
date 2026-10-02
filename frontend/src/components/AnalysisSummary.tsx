interface AnalysisSummaryProps {
    typeCount: number;
    relationshipCount: number;
    diagnosticCount: number;
}

function AnalysisSummary({
    typeCount,
    relationshipCount,
    diagnosticCount,
}: AnalysisSummaryProps) {
    const cardStyle = {
        padding: "16px",
        background: "#151821",
        border: "1px solid #252936",
        borderRadius: "8px",
    };

    const labelStyle = {
        color: "#9ca3af",
        fontSize: "12px",
    };

    const valueStyle = {
        marginTop: "6px",
        fontSize: "22px",
        fontWeight: 600,
    };

    return (
        <div
            style={{
                display: "grid",
                gridTemplateColumns: "repeat(3, 1fr)",
                gap: "12px",
                marginBottom: "24px",
            }}
        >
            <div style={cardStyle}>
                <div style={labelStyle}>Types</div>

                <div style={valueStyle}>
                    {typeCount}
                </div>
            </div>

            <div style={cardStyle}>
                <div style={labelStyle}>Relationships</div>

                <div style={valueStyle}>
                    {relationshipCount}
                </div>
            </div>

            <div style={cardStyle}>
                <div style={labelStyle}>Diagnostics</div>

                <div style={valueStyle}>
                    {diagnosticCount}
                </div>
            </div>
        </div>
    );
}

export default AnalysisSummary;