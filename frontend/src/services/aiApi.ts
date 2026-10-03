import type { Capabilities, CodeAnalysis, CodeExplanation } from "../types/analysis";
import { API_URL } from "./apiBase";

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

/**
 * The analysis goes back with the question. The server keeps nothing between
 * requests, and a node id only means anything next to the analysis that
 * produced it.
 */
export async function askQuestion(
  analysis: CodeAnalysis,
  question: string,
): Promise<CodeExplanation> {
  const response = await fetch(`${API_URL}/api/questions`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ analysis, question }),
  });

  if (!response.ok) {
    throw await readError(response,"The question could not be answered.");
  }

  return response.json();
}

export async function explainNode(
  analysis: CodeAnalysis,
  nodeId: string,
): Promise<CodeExplanation> {
  const response = await fetch(`${API_URL}/api/explain`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ analysis, nodeId }),
  });

  if (!response.ok) {
    throw await readError(response,"That node could not be explained.");
  }

  return response.json();
}
