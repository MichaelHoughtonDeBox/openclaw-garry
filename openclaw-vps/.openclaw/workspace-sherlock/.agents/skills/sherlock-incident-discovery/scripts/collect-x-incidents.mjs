#!/usr/bin/env node

import process from "node:process";
import { createLogger } from "./shared/logger.mjs";
import { parseCommonFlags } from "./shared/cli.mjs";
import { loadState, resolveDefaultStateFile, saveState } from "./shared/state-store.mjs";
import { XApiConnector } from "./connectors/x-api/index.mjs";
import { parseFocusLocations } from "./shared/focus.mjs";

async function main() {
  const logger = createLogger("collect-x-incidents");
  const flags = parseCommonFlags(process.argv.slice(2));
  const stateFile = flags.stateFile || resolveDefaultStateFile(import.meta.url);
  const state = await loadState(stateFile);
  const focusLocations = parseFocusLocations(flags.focusLocationsRaw || process.env.SHERLOCK_FOCUS_LOCATIONS || "");

  const connector = new XApiConnector({ maxResults: flags.limit, focusLocations });
  const result = await connector.collect({ state });

  if (!flags.dryRun) {
    state.connectors.x_api = result.checkpoint;
    await saveState(stateFile, state);
  }

  if (flags.json) {
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
    return;
  }

  logger.success("X collection complete", {
    candidates: result.candidates.length,
    focusLocations,
    checkpoint: result.checkpoint,
    dryRun: flags.dryRun
  });
  if (result.warnings.length) {
    logger.warn("Connector warnings", { warnings: result.warnings });
  }
}

main().catch((error) => {
  const logger = createLogger("collect-x-incidents");
  logger.error("X collection failed", { error: error instanceof Error ? error.message : String(error) });
  process.exitCode = 1;
});
