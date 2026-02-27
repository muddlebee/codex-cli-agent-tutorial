import readline from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";
import { CodexExecProvider } from "../providers/codex-exec/provider.js";
import { appendEvent, appendTranscript, buildHistoryPrompt, createSession, loadSession, readTranscript } from "../core/session-store.js";
import { renderEvent } from "./render.js";
import { TodoManager } from "../core/todo-manager.js";
import { handleTodoCommand } from "./todo.js";

export async function runChat(resumeId?: string): Promise<void> {
  const provider = new CodexExecProvider();
  let sessionId = resumeId;

  if (sessionId) {
    const found = await loadSession(sessionId);
    if (!found) {
      throw new Error(`session not found: ${sessionId}`);
    }
  } else {
    const session = await createSession();
    sessionId = session.id;
  }

  output.write(`session: ${sessionId}\n`);
  output.write("Type /exit to quit. Use /todo help for planning commands.\n");
  const todoManager = new TodoManager(sessionId);

  const rl = readline.createInterface({ input, output });

  while (true) {
    const line = (await rl.question("you> ")).trim();
    if (!line) {
      continue;
    }
    if (line === "/exit") {
      break;
    }
    const todoResponse = await handleTodoCommand(todoManager, line);
    if (todoResponse !== null) {
      output.write(`${todoResponse}\n`);
      continue;
    }

    await appendTranscript(sessionId, { role: "user", content: line, createdAt: new Date().toISOString() });
    const transcript = await readTranscript(sessionId);
    const todoContext = await todoManager.renderForPrompt();
    const prompt = `${buildHistoryPrompt(transcript, line)}\n\nCurrent todos:\n${todoContext}`;

    let assistantBuffer = "";
    for await (const event of provider.runTask(prompt, { cwd: process.cwd() })) {
      renderEvent(event);
      await appendEvent(sessionId, event);
      if (event.type === "assistant_delta") {
        assistantBuffer += event.text;
      }
    }

    if (assistantBuffer.trim()) {
      await appendTranscript(sessionId, {
        role: "assistant",
        content: assistantBuffer.trim(),
        createdAt: new Date().toISOString()
      });
    }
    output.write("\n");
  }

  rl.close();
}
