import { useCallback, useEffect, useRef, useState } from "react";

import type { CodeAnalysis } from "../types/analysis";
import { locationOf } from "../lib/model";
import type { RevealTarget } from "../components/CodeEditor";
import type { FocusRequest } from "../components/RelationshipGraph";

/** Where a selection came from, which decides how far the app follows it. */
export type SelectionOrigin =
  | "graph"
  | "source"
  | "details"
  | "diagnostics"
  | "ai";

export interface Workspace {
  selectedNodeId: string | null;
  selectedDiagnosticId: string | null;
  reveal: RevealTarget | null;
  focusRequest: FocusRequest | null;
  selectNode: (nodeId: string | null, origin?: SelectionOrigin) => void;
  selectDiagnostic: (diagnosticId: string | null) => void;
}

export function useWorkspace(analysis: CodeAnalysis | null): Workspace {
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [selectedDiagnosticId, setSelectedDiagnosticId] = useState<
    string | null
  >(null);
  const [reveal, setReveal] = useState<RevealTarget | null>(null);
  const [focusRequest, setFocusRequest] = useState<FocusRequest | null>(null);

  const nonce = useRef(0);

  // A new analysis is different code, so nothing selected before it holds.
  const analysisId = analysis?.id ?? null;

  useEffect(() => {
    setSelectedNodeId(null);
    setSelectedDiagnosticId(null);
    setReveal(null);
    setFocusRequest(null);
  }, [analysisId]);

  const selectNode = useCallback(
    (nodeId: string | null, origin: SelectionOrigin = "details") => {
      setSelectedNodeId(nodeId);
      setSelectedDiagnosticId(null);

      if (!nodeId || !analysis) {
        return;
      }

      // Re-centring the graph on every keystroke would make it twitch.
      if (origin === "source") {
        return;
      }

      const location = locationOf(analysis, nodeId);

      if (location) {
        nonce.current += 1;
        setReveal({ location, nonce: nonce.current });
      }

      // Clicking a node in the graph should not also move the graph.
      if (origin !== "graph") {
        nonce.current += 1;
        setFocusRequest({ nodeId, nonce: nonce.current });
      }
    },
    [analysis],
  );

  const selectDiagnostic = useCallback(
    (diagnosticId: string | null) => {
      setSelectedDiagnosticId(diagnosticId);
      setSelectedNodeId(null);

      if (!diagnosticId || !analysis) {
        return;
      }

      const diagnostic = analysis.diagnostics.find(
        (candidate) => candidate.id === diagnosticId,
      );

      if (diagnostic) {
        nonce.current += 1;
        setReveal({ location: diagnostic.location, nonce: nonce.current });
      }
    },
    [analysis],
  );

  return {
    selectedNodeId,
    selectedDiagnosticId,
    reveal,
    focusRequest,
    selectNode,
    selectDiagnostic,
  };
}
