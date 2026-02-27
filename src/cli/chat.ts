import readline from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";
import {
  appendEvent,
  appendTranscript,
  buildHistoryPrompt,
  createSession,
  loadSession,
  readTranscript,
  setRemoteThreadId
} from "../core/session-store.js";
import { renderEvent } from "./render.js";
import { TodoManager } from "../core/todo-manager.js";
import { handleTodoCommand } from "./todo.js";
import { createProvider, createSessionProvider } from "../providers/factory.js";
import type { InteractiveSessionProvider } from "../types/events.js";

function asInteractive(provider: unknown): InteractiveSessionProvider | null {
  if (!provider || typeof provider !== "object") {
    return null;
  }
  const p = provider as Partial<InteractiveSessionProvider>;
  return typeof p.respondApproval === "function" ? (p as InteractiveSessionProvider) : null;
}

export async function runChat(resumeId?: string): Promise<void> {
  const provider = createProvider();
  const sessionProvider = createSessionProvider();
  const interactiveProvider = asInteractive(sessionProvider);
  let sessionId = resumeId;
  let rpcThreadId: string | null = null;
  let existingSession = null;

  if (sessionId) {
    existingSession = await loadSession(sessionId);
    if (!existingSession) {
      throw new Error(`session not found: ${sessionId}`);
    }
  } else {
    const session = await createSession();
    sessionId = session.id;
    existingSession = session;
  }

  if (sessionProvider) {
    // In RPC mode we maintain a remote thread and map it to local session metadata.
    if (resumeId && existingSession?.remoteThreadId) {
      const resumed = await sessionProvider.resumeSession(existingSession.remoteThreadId);
      if (!resumed) {
        throw new Error(`could not resume rpc thread: ${existingSession.remoteThreadId}`);
      }
      rpcThreadId = existingSession.remoteThreadId;
    } else if (resumeId && !existingSession?.remoteThreadId) {
      throw new Error("session exists but has no rpc thread mapping");
    } else {
      rpcThreadId = await sessionProvider.startSession();
      await setRemoteThreadId(sessionId, rpcThreadId);
    }
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
    // Prompt assembly keeps the model stateless from the transport perspective.
    const prompt = `${buildHistoryPrompt(transcript, line)}\n\nCurrent todos:\n${todoContext}`;

    let assistantBuffer = "";
    const eventStream = sessionProvider && rpcThreadId
      ? sessionProvider.sendTurn(rpcThreadId, prompt)
      : provider.runTask(prompt, { cwd: process.cwd() });
    for await (const event of eventStream) {
      renderEvent(event);
      await appendEvent(sessionId, event);
      if (event.type === "approval_required" && interactiveProvider) {
        // Approval requests are paused here and resolved by the user in-band.
        const requestId = (event.payload as Record<string, unknown>).requestId;
        if (typeof requestId === "string" || typeof requestId === "number") {
          const answer = (await rl.question("approve action? [y/N] ")).trim().toLowerCase();
          const allow = answer === "y" || answer === "yes";
          await interactiveProvider.respondApproval(requestId, allow);
        }
      }
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
