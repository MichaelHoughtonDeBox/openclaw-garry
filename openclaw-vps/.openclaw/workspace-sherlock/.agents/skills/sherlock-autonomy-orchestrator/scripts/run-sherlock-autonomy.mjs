#!/usr/bin/env node

import process from "node:process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawn } from "node:child_process";
import {
  getFlagValue,
  hasFlag,
  parseNumberFlag
} from "../../sherlock-incident-discovery/scripts/shared/cli.mjs";
import { parseFocusLocations } from "../../sherlock-incident-discovery/scripts/shared/focus.mjs";
import { createLogger } from "../../sherlock-incident-discovery/scripts/shared/logger.mjs";
import { parseTaskIntake } from "../../sherlock-task-intake/scripts/task-intake.mjs";

/**
 * Strip ANSI codes before JSON parsing.
 * @param {string} value - Raw terminal output.
 * @returns {string} Sanitized output string.
 */
function stripAnsi(value) {
  return String(value || "").replace(/\u001b\[[0-9;]*m/g, "");
}

/**
 * Extract the last JSON object from mixed log output.
 * @param {string} output - Raw command output.
 * @returns {any|null} Parsed JSON object or null when unavailable.
 */
function extractLastJsonObject(output) {
  const cleaned = stripAnsi(output).trim();
  if (!cleaned) {
    return null;
  }
  const objectStart = cleaned.lastIndexOf("\n{");
  const jsonStart = objectStart >= 0 ? objectStart + 1 : cleaned.indexOf("{");
  if (jsonStart < 0) {
    return null;
  }
  const jsonText = cleaned.slice(jsonStart).trim();
  try {
    return JSON.parse(jsonText);
  } catch {
    return null;
  }
}

/**
 * Execute a node script and collect stdout/stderr.
 * @param {string} scriptPath - Script path to execute.
 * @param {string[]} args - CLI arguments.
 * @returns {Promise<{exitCode: number, stdout: string, stderr: string}>} Process result.
 */
async function runNodeCommand(scriptPath, args = []) {
  return new Promise((resolve, reject) => {
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
    child.on("error", reject);
    child.on("close", (exitCode) => {
      resolve({
        exitCode: Number(exitCode || 0),
        stdout,
        stderr
      });
    });
  });
}

/**
 * Execute a Mission Control command and parse trailing JSON response.
 * @param {string} cliPath - Path to mission-control-cli.mjs.
 * @param {string} action - Mission Control action.
 * @param {string[]} args - Action arguments.
 * @param {{ allowFailure?: boolean }} options - Error handling options.
 * @returns {Promise<any>} Parsed JSON result payload.
 */
async function runMissionControl(cliPath, action, args = [], options = {}) {
  const command = await runNodeCommand(cliPath, [action, ...args, "--json"]);
  const parsed = extractLastJsonObject(command.stdout || command.stderr);
  if (command.exitCode !== 0 && options.allowFailure !== true) {
    throw new Error(`Mission Control command failed (${action}): ${stripAnsi(command.stderr || command.stdout).trim()}`);
  }
  return parsed || { ok: false, action, raw: stripAnsi(command.stdout || command.stderr) };
}

/**
 * Build the markdown summary artifact linked to a completed task.
 * @param {{
 *  task: any,
 *  intake: any,
 *  cycle: any
 * }} input - Directed task execution data.
 * @returns {string} Markdown content for Mission Control document.
 */
function buildTaskDocumentMarkdown(input) {
  const task = input.task || {};
  const intake = input.intake || {};
  const cycle = input.cycle || {};
  const leadEvidence = Array.isArray(intake.leadEvidence) ? intake.leadEvidence : [];

  // Keep this template deterministic so review workflows get consistent handoff shape.
  return [
    `# Sherlock Directed Task Output`,
    ``,
    `## Task`,
    `- Task ID: ${task._id || "unknown"}`,
    `- Task Name: ${task.task_name || task.taskName || "Unnamed task"}`,
    `- Query Family: ${intake?.queryPlan?.queryFamily || "unknown"}`,
    ``,
    `## Lead Summary`,
    `- Lead URLs: ${Array.isArray(intake.leadUrls) ? intake.leadUrls.length : 0}`,
    `- Focus Locations: ${(intake.focusLocations || []).join(", ") || "none"}`,
    `- Notes: ${(intake.notes || []).join(" | ") || "none"}`,
    ``,
    `## Lead Evidence`,
    ...leadEvidence.map((item, index) => `- [${index + 1}] ${item.url} | title=${item.title || "n/a"} | error=${item.error || "none"}`),
    ``,
    `## Cycle Outcome`,
    `- Accepted: ${cycle?.submission?.accepted || 0}`,
    `- Duplicates: ${cycle?.submission?.duplicates || 0}`,
    `- Failed: ${cycle?.submission?.failed || 0}`,
    `- Normalized incidents: ${cycle?.normalization?.accepted || 0}`,
    `- Connector errors: ${Array.isArray(cycle?.connectorErrors) ? cycle.connectorErrors.length : 0}`,
    ``,
    `## Raw Summary`,
    "```json",
    JSON.stringify(cycle, null, 2),
    "```"
  ].join("\n");
}

/**
 * Execute the Sherlock cycle command and return parsed JSON summary.
 * @param {{
 *  cycleScriptPath: string,
 *  dryRun: boolean,
 *  mode: "autonomous"|"directed",
 *  focusLocations: string[],
 *  minIncidents: number,
 *  maxPasses: number,
 *  taskId?: string|null,
 *  xQuery?: string,
 *  perplexityQueries?: string[]
 * }} input - Cycle runtime options.
 * @returns {Promise<any>} Parsed cycle summary output.
 */
async function runSherlockCycle(input) {
  const args = ["--json", "--mode", input.mode, "--min-incidents", String(input.minIncidents), "--max-passes", String(input.maxPasses)];

  if (input.dryRun) {
    args.push("--dry-run");
  }
  if (String(input.taskId || "").trim()) {
    args.push("--task-id", String(input.taskId).trim());
  }
  if (Array.isArray(input.focusLocations) && input.focusLocations.length) {
    args.push("--focus-locations", input.focusLocations.join("||"));
  }
  if (String(input.xQuery || "").trim()) {
    args.push("--x-query", String(input.xQuery).trim());
  }
  if (Array.isArray(input.perplexityQueries) && input.perplexityQueries.length) {
    args.push("--perplexity-queries", input.perplexityQueries.join("||"));
  }

  const command = await runNodeCommand(input.cycleScriptPath, args);
  const parsed = extractLastJsonObject(command.stdout || command.stderr);
  if (command.exitCode !== 0) {
    throw new Error(`Sherlock cycle failed: ${stripAnsi(command.stderr || command.stdout).trim()}`);
  }
  if (!parsed) {
    throw new Error("Sherlock cycle output did not include a parseable JSON summary.");
  }
  return parsed;
}

async function main() {
  const logger = createLogger("run-sherlock-autonomy");
  const argv = process.argv.slice(2);
  const dryRun = hasFlag(argv, "--dry-run");
  const skipTaskPoll = hasFlag(argv, "--skip-task-poll");
  const manualTaskDescription = getFlagValue(argv, "--task-description", "");
  const manualTaskName = getFlagValue(argv, "--task-name", "Manual directed task");

  const thisScriptPath = fileURLToPath(import.meta.url);
  const sherlockWorkspaceRoot = path.resolve(path.dirname(thisScriptPath), "../../../..");
  const missionControlCliPath =
    process.env.MISSION_CONTROL_CLI ||
    path.resolve(sherlockWorkspaceRoot, "../workspace/scripts/mission-control-cli.mjs");
  const cycleScriptPath =
    process.env.SHERLOCK_CYCLE_SCRIPT ||
    path.resolve(
      sherlockWorkspaceRoot,
      ".agents/skills/sherlock-incident-discovery/scripts/run-sherlock-cycle.mjs"
    );

  const configuredFocusLocations = parseFocusLocations(
    getFlagValue(argv, "--focus-locations", process.env.SHERLOCK_FOCUS_LOCATIONS || "")
  );
  const requestedMinIncidents = Math.max(1, parseNumberFlag(argv, "--min-incidents", 3));
  const requestedMaxPasses = Math.max(1, Math.min(parseNumberFlag(argv, "--max-passes", 2), 4));

  const startedAt = new Date().toISOString();
  const lifecycle = {
    polled: false,
    claimed: false,
    completed: false,
    blocked: false
  };
  let task = null;
  let taskIntake = null;
  let cycle = null;

  try {
    if (manualTaskDescription) {
      // Manual mode is used by smoke tests and controlled directed runs.
      task = {
        _id: "manual-task",
        task_name: manualTaskName,
        description: manualTaskDescription
      };
    } else if (!skipTaskPoll) {
      lifecycle.polled = true;
      const polled = await runMissionControl(
        missionControlCliPath,
        "task_poll_ready_for_assignee",
        ["--assignee", "sherlock", "--limit", "1"],
        { allowFailure: dryRun }
      );
      const firstTask = Array.isArray(polled?.tasks) ? polled.tasks[0] : null;
      if (firstTask && !dryRun) {
        const claimed = await runMissionControl(missionControlCliPath, "task_claim", [
          "--task-id",
          String(firstTask._id),
          "--assignee",
          "sherlock",
          "--agent",
          "sherlock"
        ]);
        if (claimed?.ok === true && claimed?.claimed === true) {
          lifecycle.claimed = true;
          task = claimed.task || firstTask;
        }
      }
    }

    if (task) {
      taskIntake = await parseTaskIntake({
        taskId: task._id ? String(task._id) : null,
        taskName: task.task_name || task.taskName || "Directed Sherlock task",
        description: task.description || "",
        focusLocations: configuredFocusLocations,
        defaultMinIncidents: requestedMinIncidents,
        defaultMaxPasses: requestedMaxPasses
      });

      if (lifecycle.claimed) {
        // Keep a durable execution breadcrumb before heavy external collection.
        await runMissionControl(missionControlCliPath, "task_append_log", [
          "--task-id",
          String(task._id),
          "--agent",
          "sherlock",
          "--message",
          "Parsed directed task intake and starting focused Sherlock cycle."
        ]);
      }

      cycle = await runSherlockCycle({
        cycleScriptPath,
        dryRun,
        mode: "directed",
        taskId: task._id ? String(task._id) : null,
        focusLocations: taskIntake.focusLocations,
        minIncidents: taskIntake.runConfig.minIncidents,
        maxPasses: taskIntake.runConfig.maxPasses,
        xQuery: taskIntake.queryPlan.xQuery,
        perplexityQueries: taskIntake.queryPlan.perplexityQueries
      });

      if (lifecycle.claimed) {
        const contentMd = buildTaskDocumentMarkdown({
          task,
          intake: taskIntake,
          cycle
        });

        const documentCreate = await runMissionControl(missionControlCliPath, "document_create", [
          "--task-id",
          String(task._id),
          "--assignee",
          "sherlock",
          "--agent",
          "sherlock",
          "--title",
          `Sherlock directed output: ${task.task_name || "Task"}`,
          "--source",
          "agent",
          "--context-mode",
          "full",
          "--delegation-safe",
          "true",
          "--content-md",
          contentMd
        ]);
        const documentId = documentCreate?.document?._id;

        const acceptedCount = Number(cycle?.submission?.accepted || 0);
        await runMissionControl(missionControlCliPath, "task_complete_with_output", [
          "--task-id",
          String(task._id),
          "--assignee",
          "sherlock",
          "--agent",
          "sherlock",
          "--summary",
          `Processed directed lead and completed Sherlock cycle (accepted=${acceptedCount}).`,
          "--link",
          documentId ? `mongo://documents/${documentId}` : ""
        ]);
        lifecycle.completed = true;
      }
    } else {
      cycle = await runSherlockCycle({
        cycleScriptPath,
        dryRun,
        mode: "autonomous",
        focusLocations: configuredFocusLocations,
        minIncidents: requestedMinIncidents,
        maxPasses: requestedMaxPasses
      });
    }

    const finishedAt = new Date().toISOString();
    const summary = {
      mode: task ? "directed_task" : "autonomous_fallback",
      task: task
        ? {
            id: task._id || null,
            name: task.task_name || task.taskName || null
          }
        : null,
      taskIntake,
      cycle,
      taskLifecycle: lifecycle,
      startedAt,
      finishedAt
    };

    if (hasFlag(argv, "--json")) {
      process.stdout.write(`${JSON.stringify(summary, null, 2)}\n`);
      return;
    }

    logger.success("Sherlock autonomy execution complete", {
      mode: summary.mode,
      taskId: summary.task?.id || null,
      accepted: summary.cycle?.submission?.accepted || 0
    });
  } catch (error) {
    if (lifecycle.claimed && task?._id) {
      try {
        await runMissionControl(missionControlCliPath, "task_mark_blocked", [
          "--task-id",
          String(task._id),
          "--assignee",
          "sherlock",
          "--agent",
          "sherlock",
          "--reason",
          error instanceof Error ? error.message.slice(0, 600) : String(error).slice(0, 600)
        ]);
        lifecycle.blocked = true;
      } catch {
        // Keep failure handling best-effort to avoid masking the original error.
      }
    }

    logger.error("Sherlock autonomy execution failed", {
      error: error instanceof Error ? error.message : String(error),
      taskId: task?._id || null,
      lifecycle
    });
    process.exitCode = 1;
  }
}

main().catch((error) => {
  const logger = createLogger("run-sherlock-autonomy");
  logger.error("Unhandled autonomy runtime failure", { error: error instanceof Error ? error.message : String(error) });
  process.exitCode = 1;
});
