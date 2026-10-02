import { useState } from "react";
import type { CodeAnalysis } from "./types/analysis";
import CodeEditor from "./components/CodeEditor";
import { analyzeCode } from "./services/analysisApi";
import AnalysisPanel from "./components/AnalysisPanel";

function App() {
  const [code, setCode] = useState(`using System;

public class Order
{
    public string Id { get; set; }

    public void Checkout()
    {
        Console.WriteLine("Checking out...");
    }
}`);

  const [analysis, setAnalysis] = useState<CodeAnalysis | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleAnalyze = async () => {
    setLoading(true);
    setError("");

    try {
      const result = await analyzeCode(code);
      setAnalysis(result);
    } catch (error) {
      setError(
        error instanceof Error
          ? error.message
          : "Something went wrong"
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#0f1117",
        color: "#ffffff",
        fontFamily: "Inter, system-ui, sans-serif",
      }}
    >
      <header
        style={{
          height: "64px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "0 28px",
          borderBottom: "1px solid #252936",
        }}
      >
        <h1
          style={{
            margin: 0,
            fontSize: "20px",
          }}
        >
          CSharpLens
        </h1>

        <button
          onClick={handleAnalyze}
          disabled={loading}
          style={{
            padding: "9px 18px",
            border: "none",
            borderRadius: "7px",
            background: loading ? "#6b7280" : "#ffffff",
            color: "#111111",
            fontWeight: 600,
            cursor: loading ? "not-allowed" : "pointer",
          }}
        >
          {loading ? "Analyzing..." : "Analyze"}
        </button>
      </header>

      <main
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          height: "calc(100vh - 64px)",
        }}
      >
        <CodeEditor
          code={code}
          onChange={setCode}
        />

        <section
          style={{
            display: "flex",
            flexDirection: "column",
            minWidth: 0,
          }}
        >
          <div
            style={{
              padding: "14px 20px",
              borderBottom: "1px solid #252936",
              color: "#9ca3af",
              fontSize: "13px",
            }}
          >
            Analysis
          </div>

          <div
            style={{
              flex: 1,
              padding: "24px",
              overflow: "auto",
            }}
          >
            {error && (
              <div
                style={{
                  padding: "14px",
                  marginBottom: "20px",
                  border: "1px solid #7f1d1d",
                  borderRadius: "8px",
                  background: "#1f1215",
                  color: "#fca5a5",
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
                  color: "#6b7280",
                  fontSize: "14px",
                }}
              >
                Analyze your C# code to see its structure.
              </div>
            )}

            {/* ANALYSIS RESULT */}
            {analysis && <AnalysisPanel analysis={analysis} />}
          </div>
        </section>
      </main>
    </div>
  );
}

export default App;