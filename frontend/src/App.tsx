import { useCallback, useState } from "react";

import type { CodeAnalysis } from "./types/analysis";
import CodeEditor from "./components/CodeEditor";
import AnalysisPanel from "./components/AnalysisPanel";
import { analyzeCode } from "./services/analysisApi";
import { useWorkspace } from "./hooks/useWorkspace";

const SAMPLE = `using System;

public interface IPaymentService
{
    void Pay(decimal amount);
}

public class PaymentService : IPaymentService
{
    public void Pay(decimal amount)
    {
        Console.WriteLine($"Paid {amount}");
    }
}

public class Order
{
    private readonly IPaymentService _paymentService;

    public Order(IPaymentService paymentService)
    {
        _paymentService = paymentService;
    }

    public void Checkout(decimal amount)
    {
        _paymentService.Pay(amount);
    }
}`;

function App() {
  const [code, setCode] = useState(SAMPLE);
  const [analysis, setAnalysis] = useState<CodeAnalysis | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const workspace = useWorkspace(analysis);

  const handleAnalyze = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      setAnalysis(await analyzeCode(code));
    } catch (cause) {
      setAnalysis(null);
      setError(
        cause instanceof Error ? cause.message : "Something went wrong.",
      );
    } finally {
      setLoading(false);
    }
  }, [code]);

  // Moving the caret selects the enclosing node, but must not scroll the editor.
  const handleCursorNode = useCallback(
    (nodeId: string | null) => workspace.selectNode(nodeId, "source"),
    [workspace],
  );

  return (
    <div
      style={{
        height: "100%",
        display: "flex",
        flexDirection: "column",
        background: "var(--bg)",
      }}
    >
      <header
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: "16px",
          height: "62px",
          flexShrink: 0,
          padding: "0 24px",
          background: "var(--surface-raised)",
          borderBottom: "1px solid var(--border)",
          boxShadow: "0 1px 0 var(--gold-bright), 0 8px 24px rgba(23, 18, 32, 0.05)",
        }}
      >
        <div style={{ display: "flex", alignItems: "baseline", gap: "14px" }}>
          <h1
            style={{
              fontSize: "15px",
              fontWeight: 800,
              letterSpacing: "0.16em",
              textTransform: "uppercase",
            }}
          >
            CSharpLens
          </h1>

          <span
            style={{
              fontSize: "12px",
              letterSpacing: "0.01em",
              color: "var(--text-muted)",
            }}
          >
            Roslyn-backed code intelligence
          </span>
        </div>

        <button
          type="button"
          onClick={handleAnalyze}
          disabled={loading}
          style={{
            padding: "9px 22px",
            border: "none",
            borderRadius: "var(--radius-sm)",
            background: loading ? "var(--border-strong)" : "var(--accent)",
            color: loading ? "var(--text-muted)" : "#ffffff",
            fontSize: "12px",
            fontWeight: 700,
            letterSpacing: "0.1em",
            textTransform: "uppercase",
            cursor: loading ? "progress" : "pointer",
            transition: "background 120ms ease",
          }}
        >
          {loading ? "Analyzing…" : "Analyze"}
        </button>
      </header>

      <main
        style={{
          flex: 1,
          minHeight: 0,
          display: "grid",
          // The graph needs the width more than the editor does.
          gridTemplateColumns: "minmax(0, 1fr) minmax(0, 1.25fr)",
        }}
      >
        <div style={{ borderRight: "1px solid var(--border)", minWidth: 0 }}>
          <CodeEditor
            code={code}
            onChange={setCode}
            analysis={analysis}
            selectedNodeId={workspace.selectedNodeId}
            reveal={workspace.reveal}
            onCursorNode={handleCursorNode}
          />
        </div>

        <section
          style={{
            display: "flex",
            flexDirection: "column",
            minWidth: 0,
            minHeight: 0,
          }}
        >
          <header
            className="cls-label"
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: "12px",
              height: "40px",
              flexShrink: 0,
              padding: "0 16px",
              borderBottom: "1px solid var(--border)",
            }}
          >
            Analysis

            {analysis && (
              <span
                style={{
                  fontWeight: 400,
                  letterSpacing: 0,
                  textTransform: "none",
                  color: "var(--text-faint)",
                }}
              >
                {analysis.types.length} types ·{" "}
                {analysis.relationships.length} relationships
                {analysis.diagnostics.length > 0 &&
                  ` · ${analysis.diagnostics.length} diagnostics`}
              </span>
            )}
          </header>

          <div
            className="scroll"
            style={{ flex: 1, minHeight: 0, padding: "16px" }}
          >
            {error && (
              <div
                style={{
                  padding: "12px 14px",
                  marginBottom: "16px",
                  border: "1px solid var(--error)",
                  borderRadius: "var(--radius-sm)",
                  background: "var(--error-wash)",
                  color: "var(--error)",
                  fontSize: "13px",
                }}
              >
                {error}
              </div>
            )}

            {!analysis && !error && (
              <div
                style={{
                  height: "100%",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: "var(--text-faint)",
                  fontSize: "13px",
                }}
              >
                Analyze your C# code to see its structure.
              </div>
            )}

            {analysis && (
              <AnalysisPanel analysis={analysis} workspace={workspace} />
            )}
          </div>
        </section>
      </main>
    </div>
  );
}

export default App;
