import { useState } from "react";

import type { CodeAnalysis } from "../types/analysis";
import type { Workspace } from "../hooks/useWorkspace";
import { findOwnerType } from "../lib/model";
import RelationshipGraph from "./RelationshipGraph";
import Graph3D from "./Graph3D";
import DiagnosticsList from "./DiagnosticsList";
import TypeDetails from "./TypeDetails";
import ExplanationPanel from "./ExplanationPanel";

interface AnalysisPanelProps {
  analysis: CodeAnalysis;
  workspace: Workspace;
}

type ViewMode = "2d" | "3d";

function ViewToggle({
  mode,
  onChange,
}: {
  mode: ViewMode;
  onChange: (mode: ViewMode) => void;
}) {
  return (
    <div
      style={{
        position: "absolute",
        top: "10px",
        right: "10px",
        zIndex: 6,
        display: "flex",
        padding: "2px",
        gap: "2px",
        borderRadius: "999px",
        border: "1px solid var(--border)",
        background: "var(--surface-raised)",
        boxShadow: "0 2px 8px rgba(23, 18, 32, 0.08)",
      }}
    >
      {(["2d", "3d"] as const).map((value) => (
        <button
          key={value}
          type="button"
          onClick={() => onChange(value)}
          style={{
            padding: "3px 11px",
            border: "none",
            borderRadius: "999px",
            background: mode === value ? "var(--accent)" : "transparent",
            color: mode === value ? "#ffffff" : "var(--text-muted)",
            fontSize: "10px",
            fontWeight: 700,
            letterSpacing: "0.12em",
            textTransform: "uppercase",
            cursor: "pointer",
          }}
        >
          {value}
        </button>
      ))}
    </div>
  );
}

function AnalysisPanel({ analysis, workspace }: AnalysisPanelProps) {
  const owner = findOwnerType(analysis, workspace.selectedNodeId);
  const [mode, setMode] = useState<ViewMode>("2d");

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
          {mode === "2d" ? (
            <RelationshipGraph
              analysis={analysis}
              selectedNodeId={workspace.selectedNodeId}
              focusRequest={workspace.focusRequest}
              onSelectNode={(nodeId) => workspace.selectNode(nodeId, "graph")}
            />
          ) : (
            <Graph3D
              analysis={analysis}
              selectedNodeId={workspace.selectedNodeId}
              onSelectNode={(nodeId) => workspace.selectNode(nodeId, "graph")}
            />
          )}

          <ViewToggle mode={mode} onChange={setMode} />
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
