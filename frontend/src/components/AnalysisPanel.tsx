import { useState } from "react";
import type { CodeAnalysis } from "../types/analysis";
import AnalysisSummary from "./AnalysisSummary";
import RelationshipGraph from "./RelationshipGraph";
import DiagnosticsList from "./DiagnosticsList";
import TypeDetails from "./TypeDetails";

interface AnalysisPanelProps {
    analysis: CodeAnalysis;
}

function AnalysisPanel({ analysis }: AnalysisPanelProps) {
    const [selectedTypeId, setSelectedTypeId] =
        useState<string | null>(null);

    const selectedType =
        analysis.types.find(
            (type) => type.id === selectedTypeId
        ) ?? null;

    return (
        <div
            style={{
                height: "100%",
                display: "flex",
                flexDirection: "column",
                gap: "12px",
            }}
        >
            <AnalysisSummary
                typeCount={analysis.types.length}
                relationshipCount={analysis.relationships.length}
                diagnosticCount={analysis.diagnostics.length}
            />

            <div
                style={{
                    flex: 1,
                    minHeight: "0",
                    display: "grid",
                    gridTemplateColumns: selectedType
                        ? "minmax(0, 1fr) 300px"
                        : "1fr",
                    gap: "12px",
                }}
            >
                <div
                    style={{
                        minWidth: 0,
                        minHeight: "500px",
                        border: "1px solid #252936",
                        borderRadius: "10px",
                        overflow: "hidden",
                        background: "#0b0d12",
                    }}
                >
                    <RelationshipGraph
                        analysis={analysis}
                        selectedTypeId={selectedTypeId}
                        onSelectType={setSelectedTypeId}
                    />
                </div>

                {selectedType && (
                    <div
                        style={{
                            minWidth: 0,
                            overflow: "auto",
                        }}
                    >
                        <TypeDetails type={selectedType} />
                    </div>
                )}
            </div>

            {analysis.diagnostics.length > 0 && (
                <DiagnosticsList
                    diagnostics={analysis.diagnostics}
                />
            )}
        </div>
    );
}

export default AnalysisPanel;