import { CodexExecProvider } from "./providers/codex-exec/provider.js";
import { renderEvent } from "./cli/render.js";
import { runChat } from "./cli/chat.js";
import { runListSessions } from "./cli/list-sessions.js";

async function runCommand(task: string): Promise<void> {
  const provider = new CodexExecProvider();
  for await (const event of provider.runTask(task, { cwd: process.cwd() })) {
    renderEvent(event);
  }
}

function usage(): void {
  process.stdout.write("Usage:\n");
  process.stdout.write("  nano-agent run \"<task>\"\n");
  process.stdout.write("  nano-agent chat [--resume <sessionId>]\n");
  process.stdout.write("  nano-agent sessions\n");
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
    await runChat(resumeId);
    return;
  }

  if (cmd === "sessions") {
    await runListSessions();
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
