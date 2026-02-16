export async function fetchJsonWithTimeout(url, options = {}, timeoutMs = 15000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal
    });
    const text = await response.text();
    const json = text ? JSON.parse(text) : null;
    return { response, json, text };
  } finally {
    clearTimeout(timer);
  }
}

export function parseJsonArrayFromText(rawText) {
  if (!rawText) {
    return null;
  }

  // Handle plain JSON or markdown fenced JSON responses.
  const fencedMatch = rawText.match(/```json\s*([\s\S]*?)```/i);
  const candidate = fencedMatch ? fencedMatch[1] : rawText;

  try {
    const parsed = JSON.parse(candidate.trim());
    return Array.isArray(parsed) ? parsed : null;
  } catch {
    return null;
  }
}
