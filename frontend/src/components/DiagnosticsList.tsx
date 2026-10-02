import { useMemo, useState } from "react";
import type { CodeDiagnostic, DiagnosticSeverity } from "../types/analysis";

interface DiagnosticsListProps {
  diagnostics: CodeDiagnostic[];
  selectedDiagnosticId: string | null;
  onSelectDiagnostic: (diagnosticId: string) => void;
}

const SEVERITY_ORDER: DiagnosticSeverity[] = [
  "Error",
  "Warning",
  "Info",
  "Hidden",
];

const SEVERITY_COLORS: Record<string, string> = {
  Error: "var(--error)",
  Warning: "var(--warning)",
  Info: "var(--info)",
  Hidden: "var(--text-faint)",
};

function DiagnosticsList({
  diagnostics,
  selectedDiagnosticId,
  onSelectDiagnostic,
}: DiagnosticsListProps) {
  const [filter, setFilter] = useState<DiagnosticSeverity | null>(null);

  const counts = useMemo(() => {
    const result = new Map<DiagnosticSeverity, number>();

    for (const diagnostic of diagnostics) {
      result.set(
        diagnostic.severity,
        (result.get(diagnostic.severity) ?? 0) + 1,
      );
    }

    return result;
  }, [diagnostics]);

  const visible = useMemo(
    () =>
      filter
        ? diagnostics.filter((diagnostic) => diagnostic.severity === filter)
        : diagnostics,
    [diagnostics, filter],
  );

  if (diagnostics.length === 0) {
    return null;
  }

  return (
    <section>
      <header
        style={{
          display: "flex",
          alignItems: "center",
          gap: "8px",
          marginBottom: "6px",
        }}
      >
        <h2 className="cls-label">Diagnostics</h2>

        <div style={{ display: "flex", gap: "6px", marginLeft: "auto" }}>
          {SEVERITY_ORDER.filter((severity) => counts.has(severity)).map(
            (severity) => {
              const isActive = filter === severity;

              return (
                <button
                  key={severity}
                  type="button"
                  onClick={() => setFilter(isActive ? null : severity)}
                  title={
                    isActive
                      ? "Clear filter"
                      : `Show only ${severity.toLowerCase()} diagnostics`
                  }
                  className="cls-filter"
                  style={{
                    padding: "2px 8px",
                    borderRadius: "999px",
                    border: "1px solid",
                    borderColor: isActive
                      ? SEVERITY_COLORS[severity]
                      : "transparent",
                    background: isActive
                      ? "var(--surface-sunken)"
                      : "transparent",
                    color: isActive
                      ? SEVERITY_COLORS[severity]
                      : "var(--text-muted)",
                    fontSize: "11px",
                    fontWeight: 600,
                    cursor: "pointer",
                  }}
                >
                  {severity} {counts.get(severity)}
                </button>
              );
            },
          )}
        </div>
      </header>

      <div
        className="scroll"
        style={{ maxHeight: "220px", paddingRight: "4px" }}
      >
        {visible.map((diagnostic) => {
          const isSelected = diagnostic.id === selectedDiagnosticId;

          return (
            <button
              key={diagnostic.id}
              type="button"
              className="cls-row"
              data-selected={isSelected}
              onClick={() => onSelectDiagnostic(diagnostic.id)}
              style={{
                display: "block",
                width: "100%",
                textAlign: "left",
                padding: "9px 10px",
                borderLeft: `2px solid ${SEVERITY_COLORS[diagnostic.severity]}`,
                borderRadius: "var(--radius-sm)",
                cursor: "pointer",
                color: "inherit",
                font: "inherit",
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "8px",
                  marginBottom: "5px",
                }}
              >
                <span
                  style={{
                    fontSize: "11px",
                    fontWeight: 600,
                    color: SEVERITY_COLORS[diagnostic.severity],
                  }}
                >
                  {diagnostic.code}
                </span>

                <span
                  style={{
                    marginLeft: "auto",
                    fontSize: "11px",
                    color: "var(--text-faint)",
                    fontFamily: "var(--font-mono)",
                  }}
                >
                  {diagnostic.location.startLine}:
                  {diagnostic.location.startColumn}
                </span>
              </div>

              <div
                style={{
                  fontSize: "12px",
                  color: "var(--text)",
                  lineHeight: 1.5,
                }}
              >
                {diagnostic.message}
              </div>
            </button>
          );
        })}
      </div>
    </section>
  );
}

export default DiagnosticsList;
