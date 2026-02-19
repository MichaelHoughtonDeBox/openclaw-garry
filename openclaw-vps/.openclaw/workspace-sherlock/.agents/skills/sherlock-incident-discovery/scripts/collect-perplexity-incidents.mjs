#!/usr/bin/env node

import process from "node:process";
import { createLogger } from "./shared/logger.mjs";
import { parseCommonFlags } from "./shared/cli.mjs";
import { loadState, resolveDefaultStateFile, saveState } from "./shared/state-store.mjs";
import { PerplexityWebConnector } from "./connectors/perplexity-web/index.mjs";
import { parseFocusLocations } from "./shared/focus.mjs";

async function main() {
  const logger = createLogger("collect-perplexity-incidents");
  const flags = parseCommonFlags(process.argv.slice(2));
  const stateFile = flags.stateFile || resolveDefaultStateFile(import.meta.url);
  const state = await loadState(stateFile);
  const focusLocations = parseFocusLocations(flags.focusLocationsRaw || process.env.SHERLOCK_FOCUS_LOCATIONS || "");

  const connector = new PerplexityWebConnector({ focusLocations });
  const result = await connector.collect({ state, limit: flags.limit });

  if (!flags.dryRun) {
    state.connectors.perplexity_web = result.checkpoint;
    await saveState(stateFile, state);
  }

  if (flags.json) {
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
    return;
  }

  logger.success("Perplexity collection complete", {
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
  const logger = createLogger("collect-perplexity-incidents");
  logger.error("Perplexity collection failed", { error: error instanceof Error ? error.message : String(error) });
  process.exitCode = 1;
});
