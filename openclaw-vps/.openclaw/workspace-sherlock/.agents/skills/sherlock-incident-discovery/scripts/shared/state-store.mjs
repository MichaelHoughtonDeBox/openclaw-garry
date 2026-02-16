import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const DEFAULT_STATE = {
  lastChecks: {
    sherlock_cycle: null,
    wolf_ingest_submit: null
  },
  connectors: {
    x_api: {
      sinceId: null,
      lastRunAt: null
    },
    perplexity_web: {
      lastRunAt: null
    }
  }
};

export function resolveWorkspaceRoot(fromFileUrl) {
  const currentFilePath = fileURLToPath(fromFileUrl);
  return path.resolve(path.dirname(currentFilePath), "../../../..");
}

export function resolveDefaultStateFile(fromFileUrl) {
  return path.join(resolveWorkspaceRoot(fromFileUrl), "memory", "heartbeat-state.json");
}

function withStateDefaults(rawState) {
  return {
    ...DEFAULT_STATE,
    ...rawState,
    lastChecks: {
      ...DEFAULT_STATE.lastChecks,
      ...(rawState?.lastChecks || {})
    },
    connectors: {
      ...DEFAULT_STATE.connectors,
      ...(rawState?.connectors || {}),
      x_api: {
        ...DEFAULT_STATE.connectors.x_api,
        ...(rawState?.connectors?.x_api || {})
      },
      perplexity_web: {
        ...DEFAULT_STATE.connectors.perplexity_web,
        ...(rawState?.connectors?.perplexity_web || {})
      }
    }
  };
}

export async function loadState(filePath) {
  try {
    const raw = await fs.readFile(filePath, "utf8");
    return withStateDefaults(JSON.parse(raw));
  } catch (error) {
    if (error && error.code === "ENOENT") {
      return withStateDefaults({});
    }
    throw error;
  }
}

export async function saveState(filePath, state) {
  const normalized = withStateDefaults(state);
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, `${JSON.stringify(normalized, null, 2)}\n`, "utf8");
}
