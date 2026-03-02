import process from "node:process";

function toFiniteTimeout(rawValue, fallbackMs) {
  const parsed = Number(rawValue);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return fallbackMs;
  }
  return Math.max(1000, Math.min(Math.round(parsed), 60000));
}

export function getTelemetryConfig() {
  const endpointUrl = String(process.env.SHERLOCK_MISSION_CONTROL_TELEMETRY_URL || "").trim();
  const ingestToken = String(process.env.SHERLOCK_MISSION_CONTROL_INGEST_TOKEN || "").trim();
  const timeoutMs = toFiniteTimeout(process.env.SHERLOCK_MISSION_CONTROL_TELEMETRY_TIMEOUT_MS, 8000);
  return {
    endpointUrl,
    ingestToken,
    timeoutMs,
    enabled: Boolean(endpointUrl && ingestToken)
  };
}

/**
 * Emit mission telemetry events without affecting Sherlock execution flow.
 * This intentionally swallows transport failures so collection/submission keeps running.
 */
export async function emitTelemetryEvents(input) {
  const events = Array.isArray(input?.events) ? input.events.filter(Boolean) : [];
  if (!events.length) {
    return { sent: false, reason: "empty_events" };
  }

  const config = input?.config || getTelemetryConfig();
  if (!config.enabled) {
    return { sent: false, reason: "telemetry_not_configured" };
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), config.timeoutMs);
  try {
    const response = await fetch(config.endpointUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-ingest-token": config.ingestToken
      },
      body: JSON.stringify({ events }),
      signal: controller.signal
    });
    if (!response.ok) {
      const message = await response.text();
      throw new Error(`Telemetry ingest failed (${response.status}): ${message.slice(0, 300)}`);
    }
    return { sent: true };
  } finally {
    clearTimeout(timeout);
  }
}
