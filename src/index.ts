import { renderEvent } from "./cli/render.js";
import { runChat } from "./cli/chat.js";
import { runListSessions } from "./cli/list-sessions.js";
import { createProvider, createSessionProvider, providerMode } from "./providers/factory.js";
import type { InteractiveSessionProvider } from "./types/events.js";

async function runCommand(task: string): Promise<void> {
  // `run` is intentionally transport-agnostic. Provider selection happens in the factory.
  const provider = createProvider();
  for await (const event of provider.runTask(task, { cwd: process.cwd() })) {
    renderEvent(event);
  }
}

function interactiveProviderOrFail(): InteractiveSessionProvider {
  // steer/interrupt only exist on the interactive RPC provider.
  const provider = createSessionProvider() as InteractiveSessionProvider | null;
  if (!provider || typeof provider.steerTurn !== "function" || typeof provider.interruptTurn !== "function") {
    throw new Error("steer/interrupt require NANO_PROVIDER=rpc");
  }
  return provider;
}

async function runSteer(sessionId: string, text: string): Promise<void> {
  const provider = interactiveProviderOrFail();
  await provider.steerTurn(sessionId, text);
  process.stdout.write("steer sent\n");
}

async function runInterrupt(sessionId: string): Promise<void> {
  const provider = interactiveProviderOrFail();
  await provider.interruptTurn(sessionId);
  process.stdout.write("interrupt sent\n");
}

function usage(): void {
  process.stdout.write("Usage:\n");
  process.stdout.write("  nano-agent run \"<task>\"\n");
  process.stdout.write("  nano-agent chat [--resume <sessionId>]\n");
  process.stdout.write("  nano-agent sessions\n");
  process.stdout.write("  nano-agent steer <sessionId> \"<text>\"   # rpc mode\n");
  process.stdout.write("  nano-agent interrupt <sessionId>         # rpc mode\n");
  process.stdout.write("\nProvider selection: set NANO_PROVIDER=exec|rpc (default: exec)\n");
}

async function main(): Promise<void> {
  const [, , cmd, ...rest] = process.argv;
  if (cmd === "run") {
    if (rest.length === 0) {
      usage();
      process.exitCode = 1;
      return;
    }
    const task = rest.join(" ");
    await runCommand(task);
    return;
  }

  if (cmd === "chat") {
    const resumeIndex = rest.indexOf("--resume");
    const resumeId = resumeIndex >= 0 ? rest[resumeIndex + 1] : undefined;
    process.stdout.write(`provider: ${providerMode()}\n`);
    await runChat(resumeId);
    return;
  }

  if (cmd === "sessions") {
    await runListSessions();
    return;
  }
  if (cmd === "steer") {
    const [sessionId, ...textParts] = rest;
    if (!sessionId || textParts.length === 0) {
      usage();
      process.exitCode = 1;
      return;
    }
    await runSteer(sessionId, textParts.join(" "));
    return;
  }
  if (cmd === "interrupt") {
    const [sessionId] = rest;
    if (!sessionId) {
      usage();
      process.exitCode = 1;
      return;
    }
    await runInterrupt(sessionId);
    return;
  }

  if (!cmd) {
    usage();
    process.exitCode = 1;
    return;
  }
  usage();
  process.exitCode = 1;
}

main().catch((error) => {
  process.stderr.write(`[fatal] ${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
});
