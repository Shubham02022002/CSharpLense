import { useCallback, useEffect, useMemo, useState } from "react";

import type { CodeAnalysis, CodeExplanation } from "../types/analysis";
import { ApiError, askQuestion, explainNode } from "../services/aiApi";
import { useCapabilities } from "../hooks/useCapabilities";

interface ExplanationPanelProps {
  analysis: CodeAnalysis;
  selectedNodeId: string | null;
  onSelectNode: (nodeId: string) => void;
}

function describeFailure(cause: unknown): string {
  if (cause instanceof ApiError && cause.status === 429) {
    return "Too many requests. The server allows 20 AI calls a minute — try again shortly.";
  }

  return cause instanceof Error ? cause.message : "Something went wrong.";
}

function ExplanationPanel({
  analysis,
  selectedNodeId,
  onSelectNode,
}: ExplanationPanelProps) {
  const capabilities = useCapabilities();

  /** Display names for every node an explanation can point at. */
  const labels = useMemo(() => {
    const map = new Map<string, string>();

    for (const type of analysis.types) {
      map.set(type.id, type.name);

      for (const member of type.members) {
        map.set(member.id, member.name);
      }
    }

    return map;
  }, [analysis]);

  const [question, setQuestion] = useState("");
  const [pending, setPending] = useState(false);
  const [explanation, setExplanation] = useState<CodeExplanation | null>(null);
  const [error, setError] = useState("");

  // A new analysis is different code, so an old answer would mislead.
  useEffect(() => {
    setExplanation(null);
    setError("");
  }, [analysis.id]);

  const run = useCallback(async (work: () => Promise<CodeExplanation>) => {
    setPending(true);
    setError("");

    try {
      setExplanation(await work());
    } catch (cause) {
      setExplanation(null);
      setError(describeFailure(cause));
    } finally {
      setPending(false);
    }
  }, []);

  const handleSubmit = useCallback(
    (event: React.FormEvent) => {
      event.preventDefault();

      const trimmed = question.trim();

      if (!trimmed || pending) {
        return;
      }

      void run(() => askQuestion(analysis.id, trimmed));
    },
    [analysis.id, pending, question, run],
  );

  const selectedName = selectedNodeId
    ? (labels.get(selectedNodeId) ?? "element")
    : null;

  const providerLabel = capabilities
    ? capabilities.aiConfigured
      ? capabilities.explanationSource
      : "local heuristics"
    : "checking…";

  return (
    <section
      style={{
        flexShrink: 0,
        display: "flex",
        flexDirection: "column",
        minHeight: 0,
        borderTop: "1px solid var(--border)",
      }}
    >
      <header
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: "8px",
          padding: "12px 2px 8px",
        }}
      >
        <h2 className="cls-label">Explain</h2>

        <span
          title={
            capabilities?.aiConfigured
              ? "Answers come from a language model, grounded in the Roslyn analysis."
              : "No AI provider is configured on the server; answers are generated locally by pattern."
          }
          style={{
            color: "var(--text-faint)",
            fontSize: "11px",
          }}
        >
          {providerLabel}
        </span>
      </header>

      {explanation && !pending && (
        <div
          className="scroll"
          style={{
            maxHeight: "30vh",
            padding: "2px 2px 10px",
            display: "flex",
            flexDirection: "column",
            gap: "12px",
          }}
        >
          <p
            style={{
              margin: 0,
              fontSize: "13px",
              lineHeight: 1.6,
              whiteSpace: "pre-wrap",
              color: "var(--text)",
            }}
          >
            {explanation.answer}
          </p>

          {explanation.concepts.length > 0 && (
            <div
              style={{
                display: "flex",
                flexWrap: "wrap",
                gap: "6px",
                alignItems: "center",
              }}
            >
              {explanation.concepts.map((concept) => (
                <span
                  key={concept}
                  style={{
                    padding: "2px 9px",
                    borderRadius: "999px",
                    background: "var(--accent-wash)",
                    color: "var(--accent)",
                    fontSize: "11px",
                    fontWeight: 600,
                  }}
                >
                  {concept}
                </span>
              ))}
            </div>
          )}

          {explanation.focusNodeIds.length > 0 && (
            <div
              style={{
                display: "flex",
                flexWrap: "wrap",
                gap: "6px",
                alignItems: "center",
              }}
            >
              <span style={{ fontSize: "11px", color: "var(--text-faint)" }}>
                Touches
              </span>

              {explanation.focusNodeIds.map((nodeId) => (
                <button
                  key={nodeId}
                  type="button"
                  className="cls-row"
                  onClick={() => onSelectNode(nodeId)}
                  style={{
                    padding: "3px 8px",
                    borderRadius: "var(--radius-sm)",
                    color: "var(--text-muted)",
                    fontFamily: "var(--font-mono)",
                    fontSize: "11px",
                    cursor: "pointer",
                  }}
                >
                  {labels.get(nodeId) ?? "element"}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {error && (
        <div
          style={{
            marginBottom: "10px",
            padding: "9px 12px",
            borderRadius: "var(--radius-sm)",
            background: "var(--error-wash)",
            color: "var(--error)",
            fontSize: "12px",
          }}
        >
          {error}
        </div>
      )}

      <form
        onSubmit={handleSubmit}
        style={{
          display: "flex",
          gap: "8px",
          paddingBottom: "2px",
        }}
      >
        {selectedName && (
          <button
            type="button"
            disabled={pending}
            onClick={() =>
              void run(() => explainNode(analysis.id, selectedNodeId!))
            }
            title={`Ask what ${selectedName} is doing here`}
            className="cls-row"
            style={{
              flexShrink: 0,
              padding: "0 12px",
              borderRadius: "var(--radius-sm)",
              color: "var(--accent)",
              fontSize: "12px",
              fontWeight: 600,
              cursor: pending ? "progress" : "pointer",
              whiteSpace: "nowrap",
            }}
          >
            Explain {selectedName}
          </button>
        )}

        <input
          value={question}
          onChange={(event) => setQuestion(event.target.value)}
          placeholder="Ask about this code…"
          aria-label="Ask about this code"
          style={{
            flex: 1,
            minWidth: 0,
            padding: "8px 10px",
            border: "1px solid var(--border-strong)",
            borderRadius: "var(--radius-sm)",
            background: "var(--surface-raised)",
            color: "var(--text)",
            fontSize: "13px",
            outline: "none",
          }}
        />

        <button
          type="submit"
          disabled={pending || !question.trim()}
          style={{
            flexShrink: 0,
            padding: "8px 16px",
            border: "none",
            borderRadius: "var(--radius-sm)",
            background:
              pending || !question.trim()
                ? "var(--border-strong)"
                : "var(--accent)",
            color:
              pending || !question.trim() ? "var(--text-muted)" : "#ffffff",
            fontSize: "13px",
            fontWeight: 600,
            cursor: pending ? "progress" : "pointer",
          }}
        >
          {pending ? "Thinking…" : "Ask"}
        </button>
      </form>
    </section>
  );
}

export default ExplanationPanel;
