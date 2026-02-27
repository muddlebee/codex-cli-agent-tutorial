import type { ProviderRunOptions, RuntimeEvent, SessionProvider } from "../../types/events.js";
import { JsonRpcClient } from "./jsonrpc-client.js";

function mapNotification(method: string, params: Record<string, unknown>): RuntimeEvent | null {
  if (method.includes("agentMessage") && typeof params.delta === "string") {
    return { type: "assistant_delta", text: params.delta };
  }
  if (method === "item/commandExecution/requestApproval" || method === "item/fileChange/requestApproval") {
    return {
      type: "approval_required",
      kind: method.includes("command") ? "command" : "file_change",
      payload: params
    };
  }
  if (method === "turn/completed") {
    return { type: "turn_completed", usage: (params.usage ?? undefined) as Record<string, number> | undefined };
  }
  if (method === "turn/failed") {
    return { type: "turn_failed", error: String(params.error ?? "turn failed") };
  }
  if (method === "error") {
    return { type: "error", error: String(params.message ?? "unknown rpc error") };
  }
  return { type: "raw", name: method, payload: params };
}

export class CodexRpcProvider implements SessionProvider {
  private client: JsonRpcClient | null = null;

  private async ensureClient(): Promise<JsonRpcClient> {
    if (!this.client) {
      this.client = new JsonRpcClient();
      await this.client.initialize();
    }
    return this.client;
  }

  async *runTask(input: string, _options?: ProviderRunOptions): AsyncGenerator<RuntimeEvent> {
    const sessionId = await this.startSession();
    for await (const event of this.sendTurn(sessionId, input)) {
      yield event;
    }
  }

  async startSession(): Promise<string> {
    const client = await this.ensureClient();
    const response = await client.request("thread/start", {});
    const result = (response.result ?? {}) as Record<string, unknown>;
    const threadId = String(result.threadId ?? result.id ?? "");
    if (!threadId) {
      throw new Error("thread/start did not return a thread id");
    }
    return threadId;
  }

  async resumeSession(sessionId: string): Promise<boolean> {
    const client = await this.ensureClient();
    const response = await client.request("thread/resume", { threadId: sessionId });
    return !response.error;
  }

  async *sendTurn(sessionId: string, input: string): AsyncGenerator<RuntimeEvent> {
    const client = await this.ensureClient();
    await client.request("turn/start", { threadId: sessionId, input });

    let done = false;
    while (!done) {
      const notifications = client.drainNotifications();
      for (const note of notifications) {
        if (!note.method) {
          continue;
        }
        const params = (note.params ?? {}) as Record<string, unknown>;
        const mapped = mapNotification(note.method, params);
        if (mapped) {
          yield mapped;
          if (mapped.type === "turn_completed" || mapped.type === "turn_failed") {
            done = true;
          }
        }
      }
      if (!done) {
        await new Promise((resolve) => setTimeout(resolve, 20));
      }
    }
  }
}
