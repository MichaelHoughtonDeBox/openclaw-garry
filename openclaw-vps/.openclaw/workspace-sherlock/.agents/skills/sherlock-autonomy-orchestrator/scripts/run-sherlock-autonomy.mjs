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
import { loadWorkspaceEnv } from "../../sherlock-incident-discovery/scripts/shared/env.mjs";
import { emitTelemetryEvents, getTelemetryConfig } from "../../sherlock-incident-discovery/scripts/shared/telemetry.mjs";
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

  const parsedObjects = [];

  // Parse every balanced JSON object in the output so trailing log lines after
  // the summary don't break extraction.
  for (let start = 0; start < cleaned.length; start += 1) {
    if (cleaned[start] !== "{") {
      continue;
    }
    let depth = 0;
    let inString = false;
    let escaped = false;
    for (let cursor = start; cursor < cleaned.length; cursor += 1) {
      const ch = cleaned[cursor];
      if (inString) {
        if (escaped) {
          escaped = false;
          continue;
        }
        if (ch === "\\") {
          escaped = true;
          continue;
        }
        if (ch === "\"") {
          inString = false;
        }
        continue;
      }
      if (ch === "\"") {
        inString = true;
        continue;
      }
      if (ch === "{") {
        depth += 1;
        continue;
      }
      if (ch === "}") {
        depth -= 1;
        if (depth === 0) {
          const candidate = cleaned.slice(start, cursor + 1);
          try {
            parsedObjects.push(JSON.parse(candidate));
          } catch {
            // Skip non-JSON object-like fragments in log lines.
          }
          break;
        }
      }
    }
  }

  if (!parsedObjects.length) {
    return null;
  }

  for (let index = parsedObjects.length - 1; index >= 0; index -= 1) {
    const candidate = parsedObjects[index];
    if (candidate && typeof candidate === "object" && ("submission" in candidate || "passSummaries" in candidate)) {
      return candidate;
    }
  }

  return parsedObjects[parsedObjects.length - 1] || null;
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

function createRunId() {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function asTaskIdOrUndefined(rawTaskId) {
  const taskId = String(rawTaskId || "").trim();
  return /^[a-fA-F0-9]{24}$/.test(taskId) ? taskId : undefined;
}

async function emitAutonomyTelemetry(input) {
  const event = {
    source: "heartbeat",
    status: input.status,
    eventType: input.eventType,
    message: input.message,
    dedupeKey: `${input.runId}:${input.dedupeSuffix}`,
    assignee: "sherlock",
    agentId: "sherlock",
    sessionKey: input.sessionKey || undefined,
    jobId: input.jobId || undefined,
    taskId: asTaskIdOrUndefined(input.taskId),
    metadata: {
      runId: input.runId,
      ...(input.metadata || {})
    },
    created_at: new Date().toISOString()
  };

  try {
    await emitTelemetryEvents({
      config: input.telemetryConfig,
      events: [event]
    });
  } catch (error) {
    // Keep autonomy execution resilient if Mission Control telemetry is unavailable.
    input.logger.warn("Autonomy telemetry emit failed (non-fatal)", {
      eventType: input.eventType,
      error: error instanceof Error ? error.message : String(error)
    });
  }
}

async function main() {
  await loadWorkspaceEnv(import.meta.url);
  const logger = createLogger("run-sherlock-autonomy");
  const argv = process.argv.slice(2);
  const dryRun = hasFlag(argv, "--dry-run");
  const skipTaskPoll = hasFlag(argv, "--skip-task-poll");
  const manualTaskDescription = getFlagValue(argv, "--task-description", "");
  const manualTaskName = getFlagValue(argv, "--task-name", "Manual directed task");
  const runId = createRunId();
  const telemetryConfig = getTelemetryConfig();
  const telemetrySessionKey = String(process.env.OPENCLAW_SESSION_KEY || process.env.SHERLOCK_SESSION_KEY || "").trim();
  const telemetryJobId = String(process.env.OPENCLAW_CRON_JOB_ID || process.env.SHERLOCK_CRON_JOB_ID || "").trim();

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
    await emitAutonomyTelemetry({
      telemetryConfig,
      logger,
      runId,
      taskId: null,
      sessionKey: telemetrySessionKey,
      jobId: telemetryJobId,
      eventType: "sherlock_autonomy_started",
      status: "info",
      dedupeSuffix: "autonomy_started",
      message: "Sherlock autonomy run started.",
      metadata: {
        dryRun,
        skipTaskPoll,
        hasManualTask: Boolean(manualTaskDescription),
        configuredFocusCount: configuredFocusLocations.length,
        requestedMinIncidents,
        requestedMaxPasses
      }
    });

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

      await emitAutonomyTelemetry({
        telemetryConfig,
        logger,
        runId,
        taskId: firstTask?._id || null,
        sessionKey: telemetrySessionKey,
        jobId: telemetryJobId,
        eventType: "sherlock_autonomy_task_poll",
        status: firstTask ? "ok" : "skipped",
        dedupeSuffix: "task_poll",
        message: firstTask
          ? `Sherlock found directed task ${String(firstTask._id)}.`
          : "Sherlock found no directed tasks; running autonomous fallback.",
        metadata: {
          foundTask: Boolean(firstTask),
          polledCount: Array.isArray(polled?.tasks) ? polled.tasks.length : 0
        }
      });

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
          await emitAutonomyTelemetry({
            telemetryConfig,
            logger,
            runId,
            taskId: task?._id || null,
            sessionKey: telemetrySessionKey,
            jobId: telemetryJobId,
            eventType: "sherlock_autonomy_task_claimed",
            status: "ok",
            dedupeSuffix: "task_claimed",
            message: `Sherlock claimed directed task ${String(task._id)}.`,
            metadata: {
              taskName: task.task_name || task.taskName || null
            }
          });
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

    await emitAutonomyTelemetry({
      telemetryConfig,
      logger,
      runId,
      taskId: summary.task?.id || null,
      sessionKey: telemetrySessionKey,
      jobId: telemetryJobId,
      eventType: "sherlock_autonomy_cycle_complete",
      status: "ok",
      dedupeSuffix: "cycle_complete",
      message: "Sherlock autonomy cycle execution completed.",
      metadata: {
        mode: summary.mode,
        accepted: Number(summary.cycle?.submission?.accepted || 0),
        duplicates: Number(summary.cycle?.submission?.duplicates || 0),
        failed: Number(summary.cycle?.submission?.failed || 0),
        connectorErrorCount: Array.isArray(summary.cycle?.connectorErrors) ? summary.cycle.connectorErrors.length : 0,
        lifecycle
      }
    });

    await emitAutonomyTelemetry({
      telemetryConfig,
      logger,
      runId,
      taskId: summary.task?.id || null,
      sessionKey: telemetrySessionKey,
      jobId: telemetryJobId,
      eventType: "sherlock_autonomy_completed",
      status: "ok",
      dedupeSuffix: "autonomy_completed",
      message: `Sherlock autonomy run finished (${summary.mode}).`,
      metadata: {
        mode: summary.mode,
        lifecycle,
        startedAt,
        finishedAt
      }
    });

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

    await emitAutonomyTelemetry({
      telemetryConfig,
      logger,
      runId,
      taskId: task?._id || null,
      sessionKey: telemetrySessionKey,
      jobId: telemetryJobId,
      eventType: "sherlock_autonomy_failed",
      status: "error",
      dedupeSuffix: "autonomy_failed",
      message: error instanceof Error ? `Sherlock autonomy failed: ${error.message}` : "Sherlock autonomy failed.",
      metadata: {
        lifecycle
      }
    });

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
