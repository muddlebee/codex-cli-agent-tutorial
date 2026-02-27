import { spawn } from "node:child_process";
import type { Provider, ProviderRunOptions, RuntimeEvent } from "../../types/events.js";
import { mapCodexEvent, parseJsonlChunk } from "./jsonl.js";

/**
 * Provider implementation that wraps `codex exec --json`.
 *
 * This mode is stateless from Codex's perspective (each run is independent),
 * so session continuity is handled in this project by prompt reconstruction.
 */
export class CodexExecProvider implements Provider {
  /**
   * Runs a single task and yields normalized runtime events as they arrive.
   */
  async *runTask(input: string, options?: ProviderRunOptions): AsyncGenerator<RuntimeEvent> {
    const args = ["exec", "--json", input];
    if (options?.model) {
      args.unshift("-m", options.model);
    }

    const child = spawn("codex", args, {
      cwd: options?.cwd,
      env: process.env,
      stdio: ["ignore", "pipe", "pipe"]
    });

    let pending = "";
    // Queue decouples child-process event arrival from async generator consumption.
    const queue: RuntimeEvent[] = [];
    let done = false;

    child.stdout.setEncoding("utf8");
    child.stdout.on("data", (chunk: string) => {
      // stdout is chunked arbitrarily, so parse incrementally as JSONL.
      const parsed = parseJsonlChunk(pending + chunk);
      pending = parsed.rest;
      for (const line of parsed.lines) {
        queue.push(mapCodexEvent(line));
      }
    });

    child.stderr.setEncoding("utf8");
    child.stderr.on("data", (chunk: string) => {
      queue.push({ type: "error", error: chunk.trim() });
    });

    child.on("close", (code) => {
      done = true;
      if (pending.trim().length > 0) {
        queue.push(mapCodexEvent(pending.trim()));
      }
      if (code !== 0) {
        queue.push({ type: "turn_failed", error: `codex exec exited with code ${code}` });
      }
    });

    while (!done || queue.length > 0) {
      while (queue.length > 0) {
        const next = queue.shift();
        if (next) {
          yield next;
        }
      }
      if (!done) {
        await new Promise((resolve) => setTimeout(resolve, 20));
      }
    }
  }
}
