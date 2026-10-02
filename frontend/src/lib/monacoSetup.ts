import { loader } from "@monaco-editor/react";
import * as monaco from "monaco-editor";
import editorWorker from "monaco-editor/editor/editor.worker?worker";

// Monaco is bundled, not fetched from a CDN. Only the core editor worker is
// registered: C# is tokenized on the main thread.
self.MonacoEnvironment = {
  getWorker: () => new editorWorker(),
};

loader.config({ monaco });
