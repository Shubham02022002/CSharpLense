import type { Capabilities, CodeExplanation } from "../types/analysis";

const API_URL = "http://localhost:5142";

/** A failed request, carrying the status so callers can spot a rate limit. */
export class ApiError extends Error {
  readonly status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

export async function readError(
  response: Response,
  fallback: string,
): Promise<ApiError> {
  let message = fallback;

  try {
    const body = await response.json();

    if (typeof body?.error === "string" && body.error) {
      message = body.error;
    }
  } catch {
    // A non-JSON body leaves the fallback message in place.
  }

  return new ApiError(message, response.status);
}

export async function getCapabilities(): Promise<Capabilities> {
  const response = await fetch(`${API_URL}/api/capabilities`);

  if (!response.ok) {
    throw await readError(response,"Could not read server capabilities.");
  }

  return response.json();
}

export async function askQuestion(
  analysisId: string,
  question: string,
): Promise<CodeExplanation> {
  const response = await fetch(`${API_URL}/api/analyze/${analysisId}/questions`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ question }),
  });

  if (!response.ok) {
    throw await readError(response,"The question could not be answered.");
  }

  return response.json();
}

export async function explainNode(
  analysisId: string,
  nodeId: string,
): Promise<CodeExplanation> {
  const response = await fetch(
    `${API_URL}/api/analyze/${analysisId}/nodes/${nodeId}/explain`,
    { method: "POST" },
  );

  if (!response.ok) {
    throw await readError(response,"That node could not be explained.");
  }

  return response.json();
}
