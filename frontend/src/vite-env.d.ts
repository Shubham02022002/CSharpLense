/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Base URL of the CSharpLens API. Vite inlines it at build time. */
  readonly VITE_API_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
