#!/usr/bin/env node

import fs from "node:fs/promises";
import { spawn } from "node:child_process";
import process from "node:process";
import path from "node:path";
import os from "node:os";
import { fileURLToPath } from "node:url";
import { existsSync } from "node:fs";

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

function extractLastJsonObject(rawOutput) {
  const cleaned = stripAnsi(String(rawOutput || "")).trim();
  const jsonStart = cleaned.lastIndexOf("\n{") >= 0 ? cleaned.lastIndexOf("\n{") + 1 : cleaned.indexOf("{");
  if (jsonStart < 0) {
    return null;
  }
  return JSON.parse(cleaned.slice(jsonStart));
}

function runSherlockCommand(scriptPath, args) {
  return new Promise((resolve, reject) => {
    // Execute Sherlock script in a fully isolated child process for deterministic smoke checks.
    const child = spawn("node", [scriptPath, ...args], {
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
        reject(new Error(`Sherlock command exited with code ${code}: ${stderr || stdout}`));
        return;
      }
      resolve({ stdout, stderr });
    });
  });
}

async function main() {
  const thisScriptPath = fileURLToPath(import.meta.url);
  const workspaceRoot = path.resolve(path.dirname(thisScriptPath), "..");
  const rootDefaultScriptPath =
    "/root/.openclaw/workspace-sherlock/.agents/skills/sherlock-autonomy-orchestrator/scripts/finalize-agentic-cycle.mjs";
  const localDefaultScriptPath = path.resolve(
    workspaceRoot,
    "../workspace-sherlock/.agents/skills/sherlock-autonomy-orchestrator/scripts/finalize-agentic-cycle.mjs"
  );
  const defaultScriptPath = existsSync(rootDefaultScriptPath) ? rootDefaultScriptPath : localDefaultScriptPath;
  const scriptPath = process.env.SHERLOCK_AGENTIC_FINALIZER_SCRIPT || defaultScriptPath;
  const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "sherlock-smoke-"));
  const candidatesPath = path.join(tmpDir, "candidates.json");
  const statePath = path.join(tmpDir, "heartbeat-state.json");

  const candidatesPayload = {
    meta: {
      queryFamily: "smoke_test"
    },
    candidates: [
      {
        sourcePlatform: "web",
        sourceId: "smoke-incident-1",
        sourceUrl: "https://example.com/incident-1",
        author: "Smoke Reporter",
        postedAt: "2026-02-16T10:30:00.000Z",
        summary: "Armed robbery reported near central business district with vehicle escape.",
        rawText: "Armed robbery reported near central business district with vehicle escape and police response.",
        latitude: -26.2041,
        longitude: 28.0473,
        locationLabel: "Johannesburg, South Africa",
        connector: "agentic-tools",
        keywords: ["robbery", "armed"],
        severity: 4
      },
      {
        sourcePlatform: "web",
        sourceId: "smoke-incident-2",
        sourceUrl: "https://example.com/incident-2",
        author: "Smoke Publisher",
        postedAt: "2026-02-16T11:00:00.000Z",
        summary: "Suspicious activity and attempted break-in reported by residents in suburb.",
        rawText: "Suspicious activity and attempted break-in reported by residents in suburb with CCTV footage.",
        latitude: -33.9249,
        longitude: 18.4241,
        locationLabel: "Cape Town, South Africa",
        connector: "agentic-tools",
        keywords: ["break-in", "suspicious activity"],
        severity: 3
      }
    ]
  };
  await fs.writeFile(candidatesPath, `${JSON.stringify(candidatesPayload, null, 2)}\n`, "utf8");

  info("Running Sherlock smoke check (agentic finalizer dry-run)...");
  const command = await runSherlockCommand(scriptPath, [
    "--dry-run",
    "--json",
    "--mode",
    "autonomous",
    "--query-family",
    "smoke_test",
    "--state-file",
    statePath,
    "--input-file",
    candidatesPath
  ]);
  const summary = extractLastJsonObject(command.stdout);
  assert(summary, "Smoke output did not include JSON");
  assert(summary.dryRun === true, "Smoke run must keep dryRun=true");
  assert(summary.mode === "autonomous", "Smoke run must keep mode=autonomous");
  assert(summary.queryFamily === "smoke_test", "Smoke run must preserve queryFamily");
  assert(summary.candidateCounts?.raw === 2, "Smoke run must process 2 raw candidates");
  assert(summary.normalization?.accepted >= 1, "Smoke run must normalize at least one candidate");
  assert(summary.submission?.dryRun === true, "Smoke run submission must stay dry-run");
  assert(summary.submission?.submitted === summary.normalization?.accepted, "Submitted count must equal normalized accepted count");
  assert(summary.submissionError === null, "Smoke run must complete without submissionError");

  success("Sherlock smoke checks passed.");
  process.stdout.write(
    `${JSON.stringify(
      {
        result: summary
      },
      null,
      2
    )}\n`
  );
}

main().catch((error) => {
  fail(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
