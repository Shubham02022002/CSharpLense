import { readError } from "./aiApi";

const API_URL = "http://localhost:5142";

/**
 * Server-side narration. The key lives on the server, so the browser only ever
 * sees audio. Throws with status 503 when no provider is configured.
 */
export async function synthesize(
  analysisId: string,
  text: string,
): Promise<Blob> {
  const response = await fetch(`${API_URL}/api/analyze/${analysisId}/speak`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text }),
  });

  if (!response.ok) {
    throw await readError(response, "The server could not narrate this answer.");
  }

  return response.blob();
}
