import { CodexExecProvider } from "./providers/codex-exec/provider.js";
import { renderEvent } from "./cli/render.js";

async function runCommand(task: string): Promise<void> {
  const provider = new CodexExecProvider();
  for await (const event of provider.runTask(task, { cwd: process.cwd() })) {
    renderEvent(event);
  }
}

function usage(): void {
  process.stdout.write("Usage:\n  nano-agent run \"<task>\"\n");
}

async function main(): Promise<void> {
  const [, , cmd, ...rest] = process.argv;
  if (cmd !== "run" || rest.length === 0) {
    usage();
    process.exitCode = 1;
    return;
  }

  const task = rest.join(" ");
  await runCommand(task);
}

main().catch((error) => {
  process.stderr.write(`[fatal] ${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
});
