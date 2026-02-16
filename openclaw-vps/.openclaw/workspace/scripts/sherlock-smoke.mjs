#!/usr/bin/env node

import { spawn } from "node:child_process";
import process from "node:process";

const color = {
  reset: "\u001b[0m",
  green: "\u001b[32m",
  red: "\u001b[31m",
  cyan: "\u001b[36m"
};

function info(message) {
  process.stdout.write(`${color.cyan}${message}${color.reset}\n`);
}

function success(message) {
  process.stdout.write(`${color.green}${message}${color.reset}\n`);
}

function fail(message) {
  process.stderr.write(`${color.red}${message}${color.reset}\n`);
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function stripAnsi(value) {
  return value.replace(/\u001b\[[0-9;]*m/g, "");
}

function runSherlockDryRun(scriptPath) {
  return new Promise((resolve, reject) => {
    // Execute the same cycle command heartbeat/cron will use, but force safe dry-run mode.
    const child = spawn("node", [scriptPath, "--dry-run", "--json"], {
      stdio: ["ignore", "pipe", "pipe"]
    });

    let stdout = "";
    let stderr = "";

    child.stdout.on("data", (chunk) => {
      stdout += chunk.toString();
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
    });

    child.on("close", (code) => {
      if (code !== 0) {
        reject(new Error(`Sherlock cycle exited with code ${code}: ${stderr || stdout}`));
        return;
      }
      resolve({ stdout, stderr });
    });
  });
}

async function main() {
  const defaultScriptPath =
    "/root/.openclaw/workspace-sherlock/.agents/skills/sherlock-incident-discovery/scripts/run-sherlock-cycle.mjs";
  const scriptPath = process.env.SHERLOCK_CYCLE_SCRIPT || defaultScriptPath;

  info("Running Sherlock smoke check in dry-run mode...");

  const { stdout } = await runSherlockDryRun(scriptPath);
  const cleaned = stripAnsi(stdout).trim();
  // Use the final JSON block because connector logs can include inline JSON payloads earlier in stdout.
  const jsonStart = cleaned.lastIndexOf("\n{") >= 0 ? cleaned.lastIndexOf("\n{") + 1 : cleaned.indexOf("{");
  assert(jsonStart >= 0, "Sherlock cycle output did not include a JSON summary");

  const summary = JSON.parse(cleaned.slice(jsonStart));

  // Validate core contract shape so regressions break fast before deployment.
  assert(summary.dryRun === true, "Sherlock smoke must run in dry-run mode");
  assert(Array.isArray(summary.connectors), "Summary connectors must be an array");
  assert(typeof summary.candidateCounts?.raw === "number", "Summary candidateCounts.raw must be numeric");
  assert(typeof summary.normalization?.accepted === "number", "Summary normalization.accepted must be numeric");

  success("Sherlock smoke check passed.");
  process.stdout.write(`${JSON.stringify(summary, null, 2)}\n`);
}

main().catch((error) => {
  fail(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
