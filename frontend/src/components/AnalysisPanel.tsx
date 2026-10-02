import type { CodeAnalysis } from "../types/analysis";
import type { Workspace } from "../hooks/useWorkspace";
import { findOwnerType } from "../lib/model";
import RelationshipGraph from "./RelationshipGraph";
import DiagnosticsList from "./DiagnosticsList";
import TypeDetails from "./TypeDetails";
import ExplanationPanel from "./ExplanationPanel";

interface AnalysisPanelProps {
  analysis: CodeAnalysis;
  workspace: Workspace;
}

function AnalysisPanel({ analysis, workspace }: AnalysisPanelProps) {
  const owner = findOwnerType(analysis, workspace.selectedNodeId);

  return (
    <div
      style={{
        height: "100%",
        display: "flex",
        flexDirection: "column",
        gap: "14px",
        minHeight: 0,
      }}
    >
      <div
        style={{
          flex: 1,
          // The graph keeps a floor so a short window cannot squeeze it away.
          minHeight: "260px",
          display: "grid",
          gridTemplateColumns: owner ? "minmax(0, 1fr) 264px" : "1fr",
          gap: "12px",
        }}
      >
        <div
          style={{
            minWidth: 0,
            minHeight: 0,
            position: "relative",
            border: "1px solid var(--border)",
            borderRadius: "var(--radius)",
            overflow: "hidden",
            background: "var(--surface-sunken)",
          }}
        >
          <RelationshipGraph
            analysis={analysis}
            selectedNodeId={workspace.selectedNodeId}
            focusRequest={workspace.focusRequest}
            onSelectNode={(nodeId) => workspace.selectNode(nodeId, "graph")}
          />
        </div>

        {owner && (
          <div className="scroll" style={{ minWidth: 0 }}>
            <TypeDetails
              analysis={analysis}
              selectedNodeId={workspace.selectedNodeId}
              onSelectNode={(nodeId) => workspace.selectNode(nodeId, "details")}
            />
          </div>
        )}
      </div>

      {analysis.diagnostics.length > 0 && (
        <div style={{ flexShrink: 0 }}>
          <DiagnosticsList
            diagnostics={analysis.diagnostics}
            selectedDiagnosticId={workspace.selectedDiagnosticId}
            onSelectDiagnostic={(diagnosticId) =>
              workspace.selectDiagnostic(diagnosticId)
            }
          />
        </div>
      )}

      <ExplanationPanel
        analysis={analysis}
        selectedNodeId={workspace.selectedNodeId}
        onSelectNode={(nodeId) => workspace.selectNode(nodeId, "ai")}
      />
    </div>
  );
}

export default AnalysisPanel;
