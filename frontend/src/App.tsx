import { useState } from "react";
import type { CodeAnalysis } from "./types/analysis";

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
      const response = await fetch("http://localhost:5142/api/analyze", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          sourceCode: code,
        }),
      });

      if (!response.ok) {
        throw new Error("Analysis request failed");
      }

      const result: CodeAnalysis = await response.json();
      setAnalysis(result);
    } catch (error) {
      setError(
        error instanceof Error ? error.message : "Something went wrong"
      );
    } finally {
      setLoading(false);
    }
  };

  const getTypeKind = (kind: number | string) => {
    if (typeof kind === "string") {
      return kind;
    }

    const kinds = ["Class", "Interface", "Struct", "Record", "Enum"];

    return kinds[kind] ?? "Unknown";
  };

  const getMemberKind = (kind: number | string) => {
    if (typeof kind === "string") {
      return kind;
    }

    const kinds = ["Constructor", "Method", "Property", "Field"];

    return kinds[kind] ?? "Unknown";
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
        {/* CODE */}
        <section
          style={{
            borderRight: "1px solid #252936",
            display: "flex",
            flexDirection: "column",
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
            C# Code
          </div>

          <textarea
            value={code}
            onChange={(event) => setCode(event.target.value)}
            spellCheck={false}
            style={{
              flex: 1,
              width: "100%",
              boxSizing: "border-box",
              padding: "20px",
              resize: "none",
              border: "none",
              outline: "none",
              background: "#151821",
              color: "#e5e7eb",
              fontFamily: "monospace",
              fontSize: "14px",
              lineHeight: 1.7,
            }}
          />
        </section>

        {/* ANALYSIS */}
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

            {analysis && (
              <>
                {/* Summary */}
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(3, 1fr)",
                    gap: "12px",
                    marginBottom: "24px",
                  }}
                >
                  <div
                    style={{
                      padding: "16px",
                      background: "#151821",
                      border: "1px solid #252936",
                      borderRadius: "8px",
                    }}
                  >
                    <div style={{ color: "#9ca3af", fontSize: "12px" }}>
                      Types
                    </div>
                    <div
                      style={{
                        marginTop: "6px",
                        fontSize: "22px",
                        fontWeight: 600,
                      }}
                    >
                      {analysis.types.length}
                    </div>
                  </div>

                  <div
                    style={{
                      padding: "16px",
                      background: "#151821",
                      border: "1px solid #252936",
                      borderRadius: "8px",
                    }}
                  >
                    <div style={{ color: "#9ca3af", fontSize: "12px" }}>
                      Relationships
                    </div>
                    <div
                      style={{
                        marginTop: "6px",
                        fontSize: "22px",
                        fontWeight: 600,
                      }}
                    >
                      {analysis.relationships.length}
                    </div>
                  </div>

                  <div
                    style={{
                      padding: "16px",
                      background: "#151821",
                      border: "1px solid #252936",
                      borderRadius: "8px",
                    }}
                  >
                    <div style={{ color: "#9ca3af", fontSize: "12px" }}>
                      Diagnostics
                    </div>
                    <div
                      style={{
                        marginTop: "6px",
                        fontSize: "22px",
                        fontWeight: 600,
                      }}
                    >
                      {analysis.diagnostics.length}
                    </div>
                  </div>
                </div>

                {/* TYPES */}
                <div>
                  <h2
                    style={{
                      fontSize: "15px",
                      margin: "0 0 12px",
                    }}
                  >
                    Types
                  </h2>

                  {analysis.types.map((type) => (
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
                </div>

                {/* DIAGNOSTICS */}
                {analysis.diagnostics.length > 0 && (
                  <div style={{ marginTop: "28px" }}>
                    <h2
                      style={{
                        fontSize: "15px",
                        margin: "0 0 12px",
                      }}
                    >
                      Diagnostics
                    </h2>

                    {analysis.diagnostics.map((diagnostic, index) => (
                      <div
                        key={`${diagnostic.id}-${index}`}
                        style={{
                          padding: "14px",
                          marginBottom: "10px",
                          border: "1px solid #7f1d1d",
                          borderRadius: "8px",
                          background: "#1f1215",
                        }}
                      >
                        <div
                          style={{
                            color: "#fca5a5",
                            fontSize: "13px",
                          }}
                        >
                          {diagnostic.message}
                        </div>

                        <div
                          style={{
                            marginTop: "6px",
                            color: "#9ca3af",
                            fontSize: "11px",
                          }}
                        >
                          Line {diagnostic.startLine}, Column{" "}
                          {diagnostic.startColumn}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}
          </div>
        </section>
      </main>
    </div>
  );
}

export default App;