/**
 * Load workspace .env so scripts run via OpenClaw exec (which does not inject
 * workspace env) still have access to SHERLOCK_* and other vars.
 */
import fs from "node:fs/promises";
import path from "node:path";
import { resolveWorkspaceRoot } from "./state-store.mjs";

/**
 * Load .env and .env.local from the Sherlock workspace into process.env.
 * Only sets vars that are not already defined (does not override).
 * @param {string} callerFileUrl - import.meta.url from the calling script.
 * @returns {Promise<void>}
 */
export async function loadWorkspaceEnv(callerFileUrl) {
  const root = resolveWorkspaceRoot(callerFileUrl);
  await loadEnvFile(path.join(root, ".env"));
  await loadEnvFile(path.join(root, ".env.local"));
}

/**
 * @param {string} filePath - Path to .env file.
 * @returns {Promise<void>}
 */
async function loadEnvFile(filePath) {
  try {
    const content = await fs.readFile(filePath, "utf8");
    for (const line of content.split("\n")) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#") || !trimmed.includes("=")) {
        continue;
      }
      const separator = trimmed.indexOf("=");
      const key = trimmed.slice(0, separator).trim();
      const value = trimmed.slice(separator + 1).trim().replace(/^['"]|['"]$/g, "");
      if (process.env[key] === undefined) {
        process.env[key] = value;
      }
    }
  } catch {
    // Missing .env files are expected on fresh installs.
  }
}
