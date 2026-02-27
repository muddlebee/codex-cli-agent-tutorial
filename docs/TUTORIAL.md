# Building nano-agent: A Complete Guide

This tutorial walks you through building a production-ready CLI agent powered by Codex APIs. You'll learn by reading and running existing code, understanding each architectural layer from simple execution to advanced RPC control.

## What You Will Build

By the end of this tutorial, you'll understand and run:

- `nano-agent run "<task>"` — One-shot task execution
- `nano-agent chat` — Interactive multi-turn conversations with memory
- `nano-agent sessions` — List and resume previous chat sessions
- `NANO_PROVIDER=rpc nano-agent chat` — RPC-based persistent threads
- `NANO_PROVIDER=rpc nano-agent steer <sessionId> "<text>"` — Steer active turns
- `NANO_PROVIDER=rpc nano-agent interrupt <sessionId>` — Interrupt running turns

## Prerequisites

Before starting, ensure you have:

1. **Node.js 20+** and **npm 10+** installed
2. **Codex CLI** installed and authenticated (`codex --version` should work)
3. **(For RPC features)** `codex-app-server` available in PATH, or set `CODEX_APP_SERVER_BIN`
4. **Basic TypeScript/Node.js knowledge** — familiarity with async/await, generators, and modules

## How This Tutorial Works

**This tutorial guides you through existing code.** The repository contains a complete, working implementation. Your job is to:

1. Read the code files mentioned in each section
2. Understand the architecture and design decisions
3. Run the commands to see it in action
4. Experiment with modifications

**Stay on the `main` branch** throughout this tutorial. No git checkouts needed.

## Setup

Clone and verify your environment:

```bash
git clone <repo-url>
cd codex-tuts
npm install
npm run lint
npm test
```

If any of these fail, fix your environment before proceeding.

---

## Part 1: CLI Entry Point and Command Routing

**Goal:** Understand how the CLI parses commands and routes to the appropriate handler.

### Files to Read

- `src/index.ts` — Main entry point with command routing

### What's Happening

The CLI supports five commands: `run`, `chat`, `sessions`, `steer`, and `interrupt`. The entry point parses `process.argv`, validates arguments, and delegates to the appropriate handler.

Key code from `src/index.ts`:

```typescript
async function main(): Promise<void> {
  const [, , cmd, ...rest] = process.argv;
  
  if (cmd === "run") {
    const task = rest.join(" ");
    await runCommand(task);  // One-shot execution
    return;
  }

  if (cmd === "chat") {
    const resumeIndex = rest.indexOf("--resume");
    const resumeId = resumeIndex >= 0 ? rest[resumeIndex + 1] : undefined;
    await runChat(resumeId);  // Interactive chat loop
    return;
  }

  // ... steer, interrupt, sessions handlers
}
```

**Design Decision:** The CLI is intentionally simple. No heavy argument parsing library — just plain `process.argv` splitting. This keeps dependencies minimal and the code transparent.

### Try It

```bash
npm run dev -- run "say hello"
```

You should see the Codex agent respond with a greeting.

### What You Learned

- Command routing happens in a single `main()` function
- Provider selection is controlled by `NANO_PROVIDER` environment variable
- Error handling uses `process.exitCode` instead of throwing to avoid unhandled promise rejections

---

## Part 2: The Exec Provider — First Control Plane

**Goal:** Understand how `codex exec --json` is spawned, how JSONL events are parsed, and how they're normalized into internal `RuntimeEvent` types.

### Files to Read

- `src/providers/codex-exec/provider.ts` — Spawns `codex exec` and manages event stream
- `src/providers/codex-exec/jsonl.ts` — Parses JSONL and maps to `RuntimeEvent`
- `src/types/events.ts` — Defines the `RuntimeEvent` union type
- `src/cli/render.ts` — Renders events to the terminal

### What's Happening

The `CodexExecProvider` spawns `codex exec --json <task>` as a child process. Stdout is parsed line-by-line as JSONL. Each JSON object is mapped to a normalized `RuntimeEvent`, which the renderer displays incrementally.

**Architecture:**

```
User Input → CodexExecProvider → spawn("codex exec --json") → JSONL stdout
                                                                    ↓
                                                            parseJsonlChunk()
                                                                    ↓
                                                             mapCodexEvent()
                                                                    ↓
                                                              RuntimeEvent
                                                                    ↓
                                                              renderEvent()
```

Key code from `src/providers/codex-exec/provider.ts`:

```typescript
async *runTask(input: string, options?: ProviderRunOptions): AsyncGenerator<RuntimeEvent> {
  const child = spawn("codex", ["exec", "--json", input], {
    cwd: options?.cwd,
    stdio: ["ignore", "pipe", "pipe"]
  });

  // Queue decouples child-process event arrival from async generator consumption
  const queue: RuntimeEvent[] = [];
  let pending = "";

  child.stdout.on("data", (chunk: string) => {
    const parsed = parseJsonlChunk(pending + chunk);
    pending = parsed.rest;
    for (const line of parsed.lines) {
      queue.push(mapCodexEvent(line));  // Normalize to RuntimeEvent
    }
  });

  // Drain queue and yield events
  while (!done || queue.length > 0) {
    while (queue.length > 0) {
      yield queue.shift()!;
    }
    await new Promise((resolve) => setTimeout(resolve, 20));
  }
}
```

**Design Decision:** The queue pattern decouples Node.js event callbacks from the async generator. This prevents backpressure issues and makes the code easier to reason about.

Key code from `src/providers/codex-exec/jsonl.ts`:

```typescript
export function mapCodexEvent(line: string): RuntimeEvent {
  const parsed = JSON.parse(line);
  const name = String(parsed.method ?? parsed.event ?? parsed.type ?? "unknown");
  const params = (parsed.params ?? parsed) as Record<string, unknown>;

  // Map Codex-specific event names to our internal RuntimeEvent types
  if (name.includes("agentMessage") && typeof params.delta === "string") {
    return { type: "assistant_delta", text: params.delta };
  }
  if (name.includes("turn/completed")) {
    return { type: "turn_completed", usage: params.usage };
  }
  // ... more mappings
}
```

**Design Decision:** Event mapping is intentionally loose (using `.includes()` instead of exact matches). This makes the code resilient to minor Codex API changes.

### Try It

```bash
npm run dev -- run "explain what you do"
```

**Expected output pattern:**

- Incremental text streaming (assistant deltas)
- Final marker: `[turn completed]`
- On failure: `[turn failed] <error message>`

### What You Learned

- `codex exec --json` outputs newline-delimited JSON (JSONL)
- Stdout chunks don't align with line boundaries — you need incremental parsing
- The `RuntimeEvent` union type abstracts away Codex-specific event shapes
- Async generators (`async function*`) are perfect for streaming event transforms

---

## Part 3: Session Persistence and Chat Loop

**Goal:** Add multi-turn conversation memory with local persistence and session resumption.

### Files Added

- ✅ `src/core/session-store.ts` — Manages session metadata, transcripts, and events
- ✅ `src/cli/chat.ts` — Interactive chat loop with readline
- ✅ `src/cli/list-sessions.ts` — Lists all stored sessions

### Files Modified

- 📝 `src/index.ts` — Added `chat` and `sessions` command routing

### What's Happening

Each chat session gets a unique ID and a directory under `.nano-agent/sessions/<id>/`:

```
.nano-agent/sessions/<uuid>/
  ├── meta.json          # Session metadata (id, timestamps, remoteThreadId)
  ├── transcript.jsonl   # User/assistant message pairs
  ├── events.jsonl       # Raw runtime events for debugging
  └── todo.json          # Planning state (added in Part 4)
```

**Storage Format:** JSONL (JSON Lines) is used for transcripts and events because:
- Appends are cheap (no need to parse/rewrite the entire file)
- Human-readable for debugging
- Easy to stream or tail

Key code from `src/core/session-store.ts`:

```typescript
/**
 * SessionStore manages local persistence for chat sessions.
 * Each session gets a directory: .nano-agent/sessions/<id>/
 * - meta.json: session metadata (id, created, updated, remoteThreadId)
 * - transcript.jsonl: user/assistant message pairs
 * - events.jsonl: raw runtime events for debugging
 */
export async function createSession(): Promise<SessionMeta> {
  const id = randomUUID();
  const meta: SessionMeta = { 
    id, 
    createdAt: new Date().toISOString(), 
    updatedAt: new Date().toISOString() 
  };
  await mkdir(sessionDir(id), { recursive: true });
  await writeFile(metaPath(id), JSON.stringify(meta, null, 2), "utf8");
  return meta;
}

export function buildHistoryPrompt(messages: ChatMessage[], userInput: string): string {
  // Keep history bounded to limit prompt growth and runaway token usage
  const history = messages
    .slice(-20)  // Only last 20 messages
    .map((msg) => `${msg.role.toUpperCase()}: ${msg.content}`)
    .join("\n\n");

  return `Continue this conversation.\n\n${history}\n\nUSER: ${userInput}\n\nASSISTANT:`;
}
```

**Design Decision:** History is limited to the last 20 messages to prevent unbounded prompt growth. For production use, you'd implement more sophisticated context management (summarization, sliding windows, etc.).

Key code from `src/cli/chat.ts`:

```typescript
export async function runChat(resumeId?: string): Promise<void> {
  const provider = createProvider();
  let sessionId = resumeId;

  if (sessionId) {
    const existing = await loadSession(sessionId);
    if (!existing) throw new Error(`session not found: ${sessionId}`);
  } else {
    const session = await createSession();
    sessionId = session.id;
  }

  output.write(`session: ${sessionId}\n`);
  const rl = readline.createInterface({ input, output });

  while (true) {
    const line = (await rl.question("you> ")).trim();
    if (line === "/exit") break;

    // Append user message to transcript
    await appendTranscript(sessionId, { 
      role: "user", 
      content: line, 
      createdAt: new Date().toISOString() 
    });

    // Build prompt with history
    const transcript = await readTranscript(sessionId);
    const prompt = buildHistoryPrompt(transcript, line);

    // Execute turn and render events
    let assistantBuffer = "";
    for await (const event of provider.runTask(prompt, { cwd: process.cwd() })) {
      renderEvent(event);
      await appendEvent(sessionId, event);
      if (event.type === "assistant_delta") {
        assistantBuffer += event.text;
      }
    }

    // Persist assistant response
    await appendTranscript(sessionId, {
      role: "assistant",
      content: assistantBuffer.trim(),
      createdAt: new Date().toISOString()
    });
  }
}
```

**Design Decision:** The chat loop is synchronous (one turn at a time). This simplifies state management and makes the code easier to debug. For production, you might want concurrent turn execution with a queue.

### Try It

```bash
# Start a new chat
npm run dev -- chat

# In the chat:
you> what is 2+2?
# ... assistant responds ...
you> what about 3+3?
# ... assistant has context from previous message ...
you> /exit

# List sessions
npm run dev -- sessions

# Resume a session
npm run dev -- chat --resume <session-id-from-above>
```

### What You Learned

- Sessions are identified by UUIDs
- Transcripts use JSONL for append-only storage
- History is injected into each turn's prompt to maintain context
- The readline interface provides a simple REPL experience
- Resume works by loading the transcript and continuing from where you left off

---

## Part 4: Planning Layer with Todos

**Goal:** Add explicit planning state with todo items to help the agent (or user) track multi-step tasks.

### Files Added

- ✅ `src/core/todo-manager.ts` — Todo CRUD operations with constraints
- ✅ `src/cli/todo.ts` — Slash command parser for `/todo` actions

### Files Modified

- 📝 `src/cli/chat.ts` — Integrated todo commands and context injection

### What's Happening

The `TodoManager` persists a `todo.json` file per session with a list of todo items. Each item has an `id`, `text`, and `status` (`pending`, `in_progress`, or `completed`).

**Constraints (Intentional):**
- Max 20 todos per session (keeps state manageable)
- Only one `in_progress` todo at a time (encourages serial focus)

These constraints are pedagogical — they force the agent (and user) to think about priorities rather than creating endless task lists.

Key code from `src/core/todo-manager.ts`:

```typescript
/**
 * TodoManager provides explicit planning state for chat sessions.
 * 
 * Design constraints:
 * - Max 20 todos (keeps prompts and state manageable)
 * - Only one in_progress at a time (enforces serial focus)
 * 
 * These constraints are intentional for tutorial scenarios.
 * Production systems might use more sophisticated task graphs.
 */
export class TodoManager {
  async add(text: string): Promise<TodoItem> {
    const state = await this.read();
    if (state.items.length >= 20) {
      throw new Error("todo limit reached (max 20)");
    }
    const id = (state.items.at(-1)?.id ?? 0) + 1;
    const item: TodoItem = { id, text, status: "pending" };
    state.items.push(item);
    await this.write(state);
    return item;
  }

  async setStatus(id: number, status: TodoStatus): Promise<TodoItem> {
    const state = await this.read();
    const found = state.items.find((item) => item.id === id);
    if (!found) throw new Error(`todo ${id} not found`);

    if (status === "in_progress") {
      // Enforce single active task
      const active = state.items.filter((item) => 
        item.status === "in_progress" && item.id !== id
      );
      if (active.length > 0) {
        throw new Error("only one in_progress todo allowed");
      }
    }

    found.status = status;
    await this.write(state);
    return found;
  }

  async renderForPrompt(): Promise<string> {
    const items = await this.list();
    if (items.length === 0) return "No active todos.";
    return items.map((item) => `- [${item.status}] #${item.id} ${item.text}`).join("\n");
  }
}
```

**Design Decision:** The todo state is injected into every prompt so the agent is always aware of the current plan. This is a simple form of "working memory" for the agent.

Integration in `src/cli/chat.ts`:

```typescript
const todoManager = new TodoManager(sessionId);

while (true) {
  const line = (await rl.question("you> ")).trim();
  
  // Handle /todo commands before sending to agent
  const todoResponse = await handleTodoCommand(todoManager, line);
  if (todoResponse !== null) {
    output.write(`${todoResponse}\n`);
    continue;
  }

  // Inject todo context into prompt
  const todoContext = await todoManager.renderForPrompt();
  const prompt = `${buildHistoryPrompt(transcript, line)}\n\nCurrent todos:\n${todoContext}`;
  
  // ... execute turn with enriched prompt
}
```

### Try It

```bash
npm run dev -- chat

# In the chat:
you> /todo add implement rpc provider
# added todo #1

you> /todo add test approval flow
# added todo #2

you> /todo start 1
# todo #1 is in_progress

you> /todo start 2
# Error: only one in_progress todo allowed

you> /todo list
# #1 [in_progress] implement rpc provider
# #2 [pending] test approval flow

you> /todo done 1
# todo #1 completed
```

### What You Learned

- Todos are session-scoped (each session has its own `todo.json`)
- Slash commands (`/todo`) are intercepted before sending to the agent
- Todo context is injected into every prompt automatically
- Constraints (max 20, one active) are enforced at the manager level

---

## Part 5: Provider Abstraction and Mode Switching

**Goal:** Understand how the CLI supports multiple transport layers (exec vs RPC) through a common interface.

### Files to Read

- `src/providers/factory.ts` — Provider factory with environment-based selection
- `src/types/events.ts` — Provider interface hierarchy

### What's Happening

The CLI supports two provider modes:

1. **Exec mode** (`NANO_PROVIDER=exec`, default) — Spawns `codex exec --json` for each turn
2. **RPC mode** (`NANO_PROVIDER=rpc`) — Uses `codex-app-server` with persistent threads

Both providers implement the same `Provider` interface, so the CLI code doesn't need to know which one is active.

**Interface Hierarchy:**

```typescript
// Base interface: one-shot task execution
interface Provider {
  runTask(input: string, options?: ProviderRunOptions): AsyncGenerator<RuntimeEvent>;
}

// Adds session lifecycle management
interface SessionProvider extends Provider {
  startSession(): Promise<string>;
  sendTurn(sessionId: string, input: string): AsyncGenerator<RuntimeEvent>;
  resumeSession(sessionId: string): Promise<boolean>;
}

// Adds in-flight turn control (steer/interrupt) and approval responses
interface InteractiveSessionProvider extends SessionProvider {
  steerTurn(sessionId: string, input: string): Promise<void>;
  interruptTurn(sessionId: string): Promise<void>;
  respondApproval(requestId: string | number, allow: boolean): Promise<void>;
}
```

Key code from `src/providers/factory.ts`:

```typescript
export function providerMode(): "exec" | "rpc" {
  const mode = process.env.NANO_PROVIDER?.toLowerCase();
  return mode === "rpc" ? "rpc" : "exec";
}

export function createProvider(): Provider {
  // Default to exec so local setup works even without app-server installed
  return providerMode() === "rpc" ? new CodexRpcProvider() : new CodexExecProvider();
}

export function createSessionProvider(): SessionProvider | null {
  if (providerMode() === "rpc") {
    return new CodexRpcProvider();
  }
  return null;  // Exec mode doesn't support sessions natively
}
```

**Design Decision:** The factory returns `null` for `createSessionProvider()` in exec mode because `codex exec` is stateless. The chat loop handles this gracefully by falling back to `runTask()`.

### Try It

```bash
# Exec mode (default)
npm run dev -- chat

# RPC mode (requires codex-app-server)
NANO_PROVIDER=rpc npm run dev -- chat
```

### What You Learned

- The provider interface abstracts transport details
- Environment variables control provider selection at runtime
- The CLI code is transport-agnostic (works with both exec and RPC)
- Interface hierarchy reflects capability levels (base → session → interactive)

---

## Part 6: App-Server RPC Transport

**Goal:** Understand how the RPC provider uses `codex-app-server` for persistent threads with JSON-RPC over stdio.

### Files to Read

- `src/providers/codex-rpc/jsonrpc-client.ts` — JSON-RPC 2.0 client over stdio
- `src/providers/codex-rpc/provider.ts` — RPC provider implementation

### What's Happening

The `CodexRpcProvider` spawns `codex-app-server` as a child process and communicates via JSON-RPC 2.0 over stdin/stdout. This gives us:

- **Persistent threads** — Conversations survive across CLI invocations
- **Turn-level control** — Steer, interrupt, and approval responses
- **Richer event streams** — More detailed notifications than exec mode

**RPC Lifecycle:**

```
1. Spawn codex-app-server
2. Send initialize request
3. Send initialized notification
4. thread/start → get threadId
5. turn/start → drain notifications until turn/completed
6. (later) thread/resume → continue from previous state
```

Key code from `src/providers/codex-rpc/jsonrpc-client.ts`:

```typescript
/**
 * JsonRpcClient manages JSON-RPC 2.0 communication over stdio.
 * 
 * Protocol assumptions:
 * - Newline-delimited JSON messages
 * - Requests have numeric IDs and expect responses
 * - Notifications have no ID and expect no response
 * - Server notifications are queued for polling
 */
export class JsonRpcClient {
  async initialize(): Promise<void> {
    // Minimal v2 handshake before issuing thread/turn calls
    await this.request("initialize", {
      protocolVersion: 2,
      capabilities: { experimentalApi: true },
      clientInfo: { name: "nano-agent", version: "0.1.0" }
    });
    this.notify("initialized", {});
  }

  async request(method: string, params?: Record<string, unknown>): Promise<JsonRpcMessage> {
    const id = this.nextId++;
    const payload = { jsonrpc: "2.0", id, method, params };
    this.child.stdin.write(JSON.stringify(payload) + "\n", "utf8");

    return await new Promise<JsonRpcMessage>((resolve) => {
      this.pending.set(id, resolve);
    });
  }

  drainNotifications(): JsonRpcMessage[] {
    const out = [...this.notifications];
    this.notifications.length = 0;
    return out;
  }
}
```

**Design Decision:** Notifications are queued and polled rather than using callbacks. This keeps the async flow simple and avoids callback hell.

Key code from `src/providers/codex-rpc/provider.ts`:

```typescript
/**
 * CodexRpcProvider implements the full InteractiveSessionProvider interface
 * using codex-app-server's JSON-RPC API.
 * 
 * Key differences from CodexExecProvider:
 * - Persistent threads (survive across CLI invocations)
 * - Turn-level control (steer, interrupt)
 * - Approval responses (interactive decision-making)
 */
export class CodexRpcProvider implements InteractiveSessionProvider {
  async startSession(): Promise<string> {
    const client = await this.ensureClient();
    const response = await client.request("thread/start", {});
    const threadId = String(response.result?.threadId ?? "");
    if (!threadId) throw new Error("thread/start did not return a thread id");
    return threadId;
  }

  async *sendTurn(sessionId: string, input: string): AsyncGenerator<RuntimeEvent> {
    const client = await this.ensureClient();
    await client.request("turn/start", { threadId: sessionId, input });

    let done = false;
    while (!done) {
      // Poll notifications in short intervals
      const notifications = client.drainNotifications();
      for (const note of notifications) {
        const mapped = mapNotification(note);
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

  async steerTurn(sessionId: string, input: string): Promise<void> {
    const client = await this.ensureClient();
    await client.request("turn/steer", { threadId: sessionId, input });
  }

  async interruptTurn(sessionId: string): Promise<void> {
    const client = await this.ensureClient();
    await client.request("turn/interrupt", { threadId: sessionId });
  }
}
```

**Design Decision:** The RPC provider implements `runTask()` as a thin wrapper around `startSession()` + `sendTurn()`. This ensures the CLI's `run` command works in both exec and RPC modes.

### Try It

```bash
# Start RPC chat
NANO_PROVIDER=rpc npm run dev -- chat

# In another terminal, list sessions
npm run dev -- sessions

# Resume the RPC session (note: remoteThreadId is stored in meta.json)
NANO_PROVIDER=rpc npm run dev -- chat --resume <session-id>
```

### What You Learned

- JSON-RPC 2.0 is a simple request/response protocol
- Notifications are server-initiated messages with no response expected
- Threads persist on the server side, mapped to local session IDs
- The RPC provider polls notifications instead of using callbacks

---

## Part 7: Interactive Runtime Controls

**Goal:** Use approval responses, turn steering, and turn interruption for fine-grained control.

### Files to Read

- `src/providers/codex-rpc/provider.ts` — `respondApproval()`, `steerTurn()`, `interruptTurn()`
- `src/cli/chat.ts` — Approval handling in the chat loop
- `src/index.ts` — `steer` and `interrupt` command handlers

### What's Happening

The RPC provider supports three interactive controls:

1. **Approval Responses** — When the agent requests permission (e.g., to run a command), the CLI pauses and asks the user
2. **Turn Steering** — Inject new input mid-turn to redirect the agent's focus
3. **Turn Interruption** — Cancel a running turn immediately

**Approval Flow:**

```
Agent → approval_required event → CLI pauses → User answers y/N → respondApproval()
```

Key code from `src/cli/chat.ts`:

```typescript
for await (const event of eventStream) {
  renderEvent(event);
  await appendEvent(sessionId, event);

  if (event.type === "approval_required" && interactiveProvider) {
    // Pause and ask user for approval
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
```

**Design Decision:** Approvals are synchronous (block the event stream). This ensures the agent doesn't proceed until the user makes a decision.

**Steer and Interrupt:**

These are CLI commands that operate on active sessions:

```bash
# In one terminal, start a long-running task
NANO_PROVIDER=rpc npm run dev -- chat
you> write a comprehensive analysis of this codebase

# In another terminal, steer the turn
NANO_PROVIDER=rpc npm run dev -- steer <session-id> "focus on the provider architecture"

# Or interrupt it entirely
NANO_PROVIDER=rpc npm run dev -- interrupt <session-id>
```

Key code from `src/index.ts`:

```typescript
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
```

**Design Decision:** Steer and interrupt are separate CLI commands (not chat slash commands) because they operate on sessions from outside the chat loop. This allows multi-terminal workflows.

### Try It

```bash
# Start RPC chat
NANO_PROVIDER=rpc npm run dev -- chat
you> run ls -la
# ... agent asks for approval ...
approve action? [y/N] y
# ... command executes ...

# In another terminal, steer an active turn
NANO_PROVIDER=rpc npm run dev -- steer <session-id> "stop what you're doing and summarize instead"

# Or interrupt
NANO_PROVIDER=rpc npm run dev -- interrupt <session-id>
```

### What You Learned

- Approvals pause the event stream until the user responds
- Steer injects new input mid-turn (useful for long-running tasks)
- Interrupt cancels a turn immediately
- These features only work in RPC mode (exec mode is stateless)

---

## Architecture Summary

Here's how all the pieces fit together:

```
┌─────────────────────────────────────────────────────────────┐
│                         CLI Entry                            │
│                      (src/index.ts)                          │
│  Commands: run | chat | sessions | steer | interrupt        │
└────────────────────────┬────────────────────────────────────┘
                         │
         ┌───────────────┴───────────────┐
         │                               │
         ▼                               ▼
┌─────────────────┐            ┌─────────────────┐
│  Exec Provider  │            │  RPC Provider   │
│  (codex exec)   │            │ (app-server)    │
└────────┬────────┘            └────────┬────────┘
         │                               │
         └───────────────┬───────────────┘
                         │
                         ▼
                ┌─────────────────┐
                │  RuntimeEvent   │
                │   (normalized)  │
                └────────┬────────┘
                         │
         ┌───────────────┼───────────────┐
         │               │               │
         ▼               ▼               ▼
┌──────────────┐  ┌─────────────┐  ┌──────────────┐
│ Session      │  │ Todo        │  │ Renderer     │
│ Store        │  │ Manager     │  │              │
│ (JSONL)      │  │ (JSON)      │  │ (stdout)     │
└──────────────┘  └─────────────┘  └──────────────┘
```

**Key Design Principles:**

1. **Transport Abstraction** — Providers implement a common interface
2. **Event Normalization** — All transport events map to `RuntimeEvent`
3. **Local-First Persistence** — Sessions stored as files, not in a database
4. **JSONL for Streams** — Append-only, human-readable, easy to debug
5. **Explicit Planning** — Todos give the agent (and user) working memory
6. **Progressive Enhancement** — Exec mode works out-of-the-box, RPC adds features

---

## Troubleshooting

### `codex: command not found`

**Solution:** Install the Codex CLI and ensure it's in your PATH.

```bash
which codex  # Should print a path
codex --version  # Should print version info
```

### `codex-app-server` not found (RPC mode)

**Solution:** Set `CODEX_APP_SERVER_BIN` to the full path:

```bash
export CODEX_APP_SERVER_BIN=/path/to/codex-app-server
NANO_PROVIDER=rpc npm run dev -- chat
```

### `steer/interrupt require NANO_PROVIDER=rpc`

**Solution:** These commands only work in RPC mode:

```bash
NANO_PROVIDER=rpc npm run dev -- steer <session-id> "new direction"
```

### Session resume errors

**Solution:** Verify the session ID from `nano-agent sessions`. For RPC resumes, ensure the session has a `remoteThreadId` in `meta.json`.

### Empty output for a long time

**Solution:** Wait for Codex startup/network. Check stderr output from the provider for diagnostics.

---

## Exercises

### Easy

1. Add a `/history` command that prints the last 5 transcript messages
2. Show the active todo count in the chat prompt (e.g., `you [2 todos]>`)
3. Add token usage aggregation per session (sum up `usage` from `turn_completed` events)

### Medium

4. Add `/todo reopen <id>` to move a completed todo back to pending
5. Implement a `--model` flag for the `run` command to override the default model
6. Add color to the terminal output (green for assistant, yellow for system messages)

### Hard

7. Implement transcript compaction: when history exceeds 100 messages, summarize old messages
8. Add approval policy presets: `--approval always|never|interactive`
9. Implement todo dependencies: `/todo add <text> --depends-on <id>` and detect cycles

---

## Next Steps

You now have a complete understanding of how to build a production-ready CLI agent. Here are some directions to explore:

- **Add more providers** — Implement a provider for Anthropic's API directly
- **Web UI** — Build a web interface that uses the same session store
- **Streaming UI** — Use Server-Sent Events to stream events to a browser
- **Multi-agent** — Run multiple agents in parallel with different roles
- **Tool integration** — Add custom tools (web search, database queries, etc.)

The architecture you've learned is extensible. The provider abstraction, event normalization, and local-first persistence patterns scale to much more complex systems.

Happy building! 🚀
