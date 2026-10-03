/**
 * Where the API lives. Vite inlines this at build time, so the deployed build
 * needs `VITE_API_URL` set when it is built; the fallback keeps local
 * development working with no configuration.
 */
export const API_URL: string =
  import.meta.env.VITE_API_URL ?? "http://localhost:5142";
