import type { CodeAnalysis } from "../types/analysis";

const API_URL = "http://localhost:5142";

export async function analyzeCode(sourceCode: string): Promise<CodeAnalysis> {
  const response = await fetch(`${API_URL}/api/analyze`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      sourceCode,
    }),
  });

  if (!response.ok) {
    throw new Error(`Analysis failed: ${response.status}`);
  }

  return response.json();
}
