import { useCallback, useEffect, useMemo, useRef } from "react";
import Editor, { type Monaco, type OnMount } from "@monaco-editor/react";
import type { editor as MonacoEditor } from "monaco-editor";

import type { CodeAnalysis, CodeLocation } from "../types/analysis";
import { buildSpans, locationOf, spanAtPosition } from "../lib/model";

const THEME_NAME = "csharplens-light";
const MARKER_OWNER = "csharplens";

export interface RevealTarget {
  location: CodeLocation;
  /** Bumped on every request, so repeating a target still scrolls to it. */
  nonce: number;
}

interface CodeEditorProps {
  code: string;
  onChange: (code: string) => void;
  analysis: CodeAnalysis | null;
  selectedNodeId: string | null;
  reveal: RevealTarget | null;
  /** Reports the element under the caret, so the graph can follow along. */
  onCursorNode: (nodeId: string | null) => void;
}

function toRange(location: CodeLocation) {
  return {
    startLineNumber: location.startLine,
    startColumn: location.startColumn,
    endLineNumber: location.endLine,
    endColumn: location.endColumn,
  };
}

function toSeverity(severity: string, monaco: Monaco) {
  switch (severity) {
    case "Error":
      return monaco.MarkerSeverity.Error;
    case "Warning":
      return monaco.MarkerSeverity.Warning;
    case "Info":
      return monaco.MarkerSeverity.Info;
    default:
      return monaco.MarkerSeverity.Hint;
  }
}

function CodeEditor({
  code,
  onChange,
  analysis,
  selectedNodeId,
  reveal,
  onCursorNode,
}: CodeEditorProps) {
  const editorRef = useRef<MonacoEditor.IStandaloneCodeEditor | null>(null);
  const monacoRef = useRef<Monaco | null>(null);
  const decorationsRef = useRef<MonacoEditor.IEditorDecorationsCollection | null>(
    null,
  );

  const suppressCursorEvents = useRef(false);

  const spans = useMemo(
    () => (analysis ? buildSpans(analysis) : []),
    [analysis],
  );

  const handleBeforeMount = useCallback((monaco: Monaco) => {
    monaco.editor.defineTheme(THEME_NAME, {
      base: "vs",
      inherit: true,
      rules: [
        { token: "comment", foreground: "8d8375", fontStyle: "italic" },
        { token: "keyword", foreground: "4f2bab" },
        { token: "string", foreground: "2f6a3f" },
        { token: "number", foreground: "a8621a" },
        { token: "type", foreground: "166b66" },
        { token: "type.identifier", foreground: "166b66" },
      ],
      colors: {
        "editor.background": "#fbf8f2",
        "editor.foreground": "#332c3d",
        "editorLineNumber.foreground": "#b3a898",
        "editorLineNumber.activeForeground": "#5c5446",
        "editor.lineHighlightBackground": "#f2ece1",
        "editor.selectionBackground": "#ded1f5",
        "editorCursor.foreground": "#4f2bab",
        "editorIndentGuide.background1": "#e6dfd1",
        "editorOverviewRuler.border": "#00000000",
        "scrollbarSlider.background": "#cabfab80",
        "scrollbarSlider.hoverBackground": "#cabfabcc",
      },
    });
  }, []);

  const handleMount = useCallback<OnMount>((editor, monaco) => {
    editorRef.current = editor;
    monacoRef.current = monaco;
    decorationsRef.current = editor.createDecorationsCollection([]);
  }, []);

  const handleChange = useCallback(
    (value: string | undefined) => onChange(value ?? ""),
    [onChange],
  );

  useEffect(() => {
    const editor = editorRef.current;
    const monaco = monacoRef.current;

    if (!editor || !monaco || !analysis) {
      decorationsRef.current?.clear();
      return;
    }

    const selected = locationOf(analysis, selectedNodeId);

    if (!selected) {
      decorationsRef.current?.set([]);
      return;
    }

    decorationsRef.current?.set([
      {
        range: toRange(selected),
        options: {
          className: "cls-selected-span",
          linesDecorationsClassName: "cls-selected-marker",
          overviewRuler: {
            color: "#4f2bab",
            position: monaco.editor.OverviewRulerLane.Left,
          },
        },
      },
    ]);
  }, [analysis, selectedNodeId]);

  // Diagnostics become real editor markers.
  useEffect(() => {
    const editor = editorRef.current;
    const monaco = monacoRef.current;
    const model = editor?.getModel();

    if (!editor || !monaco || !model) {
      return;
    }

    monaco.editor.setModelMarkers(
      model,
      MARKER_OWNER,
      (analysis?.diagnostics ?? []).map((diagnostic) => ({
        ...toRange(diagnostic.location),
        message: `${diagnostic.code}: ${diagnostic.message}`,
        severity: toSeverity(diagnostic.severity, monaco),
      })),
    );
  }, [analysis]);

  useEffect(() => {
    const editor = editorRef.current;
    const monaco = monacoRef.current;

    if (!editor || !monaco || !reveal) {
      return;
    }

    const range = toRange(reveal.location);

    suppressCursorEvents.current = true;

    editor.revealRangeInCenterIfOutsideViewport(
      range,
      monaco.editor.ScrollType.Smooth,
    );

    // Only the caret moves; selecting the range would fight the user's own.
    editor.setPosition({
      lineNumber: range.startLineNumber,
      column: range.startColumn,
    });

    const timer = window.setTimeout(() => {
      suppressCursorEvents.current = false;
    }, 0);

    return () => window.clearTimeout(timer);
  }, [reveal]);

  useEffect(() => {
    const editor = editorRef.current;

    if (!editor || spans.length === 0) {
      return;
    }

    const subscription = editor.onDidChangeCursorPosition((event) => {
      if (suppressCursorEvents.current) {
        return;
      }

      const span = spanAtPosition(
        spans,
        event.position.lineNumber,
        event.position.column,
      );

      onCursorNode(span?.id ?? null);
    });

    return () => subscription.dispose();
  }, [spans, onCursorNode]);

  return (
    <section
      style={{
        // Monaco sizes itself from its container, so this needs a height.
        height: "100%",
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
          height: "40px",
          flexShrink: 0,
          padding: "0 16px",
          borderBottom: "1px solid var(--border)",
        }}
      >
        Source
      </header>

      <div style={{ flex: 1, minHeight: 0 }}>
        <Editor
          language="csharp"
          theme={THEME_NAME}
          value={code}
          onChange={handleChange}
          beforeMount={handleBeforeMount}
          onMount={handleMount}
          options={{
            minimap: { enabled: false },
            fontFamily: "ui-monospace, 'Cascadia Code', Consolas, monospace",
            fontSize: 13,
            lineHeight: 1.7,
            padding: { top: 16, bottom: 16 },
            scrollBeyondLastLine: false,
            renderLineHighlight: "line",
            smoothScrolling: true,
            cursorBlinking: "smooth",
            automaticLayout: true,
            tabSize: 4,
            glyphMargin: false,
            overviewRulerBorder: false,
            scrollbar: { alwaysConsumeMouseWheel: false },
          }}
        />
      </div>
    </section>
  );
}

export default CodeEditor;
