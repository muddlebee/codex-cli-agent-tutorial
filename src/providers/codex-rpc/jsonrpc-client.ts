import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";

export interface JsonRpcMessage {
  jsonrpc?: string;
  id?: number | string;
  method?: string;
  params?: Record<string, unknown>;
  result?: unknown;
  error?: unknown;
}

export class JsonRpcClient {
  private readonly child: ChildProcessWithoutNullStreams;
  private nextId = 1;
  private readonly pending = new Map<number, (value: JsonRpcMessage) => void>();
  private readonly notifications: JsonRpcMessage[] = [];
  private buffer = "";

  constructor() {
    const appServerBin = process.env.CODEX_APP_SERVER_BIN ?? "codex-app-server";
    this.child = spawn(appServerBin, [], {
      cwd: process.cwd(),
      env: process.env,
      stdio: ["pipe", "pipe", "pipe"]
    });

    this.child.stdout.setEncoding("utf8");
    this.child.stdout.on("data", (chunk: string) => this.onData(chunk));

    this.child.stderr.setEncoding("utf8");
    this.child.stderr.on("data", () => {
      // keep stderr available for debugging without hard-failing parser flow
    });
  }

  private onData(chunk: string): void {
    this.buffer += chunk;
    let idx = this.buffer.indexOf("\n");
    while (idx >= 0) {
      const line = this.buffer.slice(0, idx).trim();
      this.buffer = this.buffer.slice(idx + 1);
      if (line) {
        this.handleLine(line);
      }
      idx = this.buffer.indexOf("\n");
    }
  }

  private handleLine(line: string): void {
    try {
      const msg = JSON.parse(line) as JsonRpcMessage;
      if (typeof msg.id === "number" && this.pending.has(msg.id)) {
        const resolver = this.pending.get(msg.id);
        this.pending.delete(msg.id);
        resolver?.(msg);
      } else if (msg.method) {
        this.notifications.push(msg);
      }
    } catch {
      // ignore malformed lines
    }
  }

  async initialize(): Promise<void> {
    await this.request("initialize", {
      protocolVersion: 2,
      capabilities: {
        experimentalApi: true
      },
      clientInfo: {
        name: "nano-agent",
        version: "0.1.0"
      }
    });
    this.notify("initialized", {});
  }

  async request(method: string, params?: Record<string, unknown>): Promise<JsonRpcMessage> {
    const id = this.nextId++;
    const payload: JsonRpcMessage = {
      jsonrpc: "2.0",
      id,
      method,
      params
    };

    const message = JSON.stringify(payload) + "\n";
    this.child.stdin.write(message, "utf8");

    return await new Promise<JsonRpcMessage>((resolve) => {
      this.pending.set(id, resolve);
    });
  }

  notify(method: string, params?: Record<string, unknown>): void {
    const payload: JsonRpcMessage = {
      jsonrpc: "2.0",
      method,
      params
    };
    this.child.stdin.write(JSON.stringify(payload) + "\n", "utf8");
  }

  respond(id: number | string, result: Record<string, unknown>): void {
    const payload = {
      jsonrpc: "2.0",
      id,
      result
    };
    this.child.stdin.write(JSON.stringify(payload) + "\n", "utf8");
  }

  drainNotifications(): JsonRpcMessage[] {
    const out = [...this.notifications];
    this.notifications.length = 0;
    return out;
  }

  close(): void {
    this.child.kill("SIGTERM");
  }
}
