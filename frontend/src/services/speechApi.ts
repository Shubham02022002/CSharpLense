import { API_URL } from "./apiBase";
import { readError } from "./aiApi";

/**
 * Server-side narration. The key lives on the server, so the browser only ever
 * sees audio. Throws with status 503 when no provider is configured.
 */
export async function synthesize(text: string): Promise<Blob> {
  const response = await fetch(`${API_URL}/api/speak`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text }),
  });

  if (!response.ok) {
    throw await readError(response, "The server could not narrate this answer.");
  }

  return response.blob();
}
