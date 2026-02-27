# Rolling Step-by-Step: Build the Entire Nano Agent CLI

This guide walks through the entire CLI architecture in one pass, from simple run mode to interactive RPC control.

## What You Will Build

By the end, you will understand and run:
- `nano-agent run "<task>"`
- `nano-agent chat`
- `nano-agent sessions`
- `NANO_PROVIDER=rpc nano-agent chat`
- `NANO_PROVIDER=rpc nano-agent steer <sessionId> "<text>"`
- `NANO_PROVIDER=rpc nano-agent interrupt <sessionId>`

## Step 0: Install and Verify

```bash
npm install
npm run lint
npm test
```

If this fails, fix environment/tooling first.

## Step 1: CLI Entry and Command Routing

Read:
- `src/index.ts`

What to learn:
- command parsing (`run`, `chat`, `sessions`, `steer`, `interrupt`)
- provider mode display (`exec` vs `rpc`)
- error and usage handling

Try:
```bash
npm run dev -- run "say hello"
```

## Step 2: Exec Provider (First Control Plane)

Read:
- `src/providers/codex-exec/provider.ts`
- `src/providers/codex-exec/jsonl.ts`
- `src/cli/render.ts`

What to learn:
- spawning `codex exec --json`
- stream splitting into JSONL lines
- event normalization into `RuntimeEvent`
- incremental rendering in terminal

Expected pattern:
- token deltas stream
- `[turn completed]` or `[turn failed]`

## Step 3: Session Persistence and Chat Loop

Read:
- `src/core/session-store.ts`
- `src/cli/chat.ts`
- `src/cli/list-sessions.ts`

What to learn:
- creating local session ids
- storing transcript/events in `.nano-agent/sessions/<id>/`
- rebuilding history prompt from recent messages
- resuming previous local sessions

Try:
```bash
npm run dev -- chat
npm run dev -- sessions
npm run dev -- chat --resume <sessionId>
```

## Step 4: Planning Layer with Todos

Read:
- `src/core/todo-manager.ts`
- `src/cli/todo.ts`
- `src/cli/chat.ts` (todo integration)

What to learn:
- explicit planning state
- constraints: max 20 todos, one `in_progress`
- injecting todo context into each model turn

Try inside chat:
```text
/todo add implement rpc provider
/todo start 1
/todo list
```

## Step 5: Provider Abstraction and Mode Switching

Read:
- `src/providers/factory.ts`
- `src/types/events.ts`

What to learn:
- shared provider interface across exec/rpc transports
- session-capable and interactive provider extensions
- environment-controlled provider selection

Try:
```bash
NANO_PROVIDER=exec npm run dev -- chat
```

## Step 6: App-Server RPC Transport

Read:
- `src/providers/codex-rpc/jsonrpc-client.ts`
- `src/providers/codex-rpc/provider.ts`

What to learn:
- JSON-RPC initialize handshake
- `thread/start`, `thread/resume`, `turn/start`
- draining async notifications and mapping to `RuntimeEvent`

Try:
```bash
NANO_PROVIDER=rpc npm run dev -- chat
```

## Step 7: Interactive Runtime Controls

Read:
- `src/providers/codex-rpc/provider.ts`
- `src/cli/chat.ts`
- `src/index.ts`

What to learn:
- approval request handling and response messages
- `turn/steer` and `turn/interrupt` control commands

Try:
```bash
NANO_PROVIDER=rpc npm run dev -- steer <sessionId> "focus on tests"
NANO_PROVIDER=rpc npm run dev -- interrupt <sessionId>
```

## Troubleshooting

1. `codex: command not found`
- Install Codex CLI and ensure it is in PATH.

2. `codex-app-server` not found
- Set `CODEX_APP_SERVER_BIN=/full/path/to/codex-app-server`.

3. `steer/interrupt require NANO_PROVIDER=rpc`
- Set `NANO_PROVIDER=rpc` for these commands.

4. Session resume errors
- Verify session id from `nano-agent sessions`.
- For RPC resumes, ensure session has `remoteThreadId` in `meta.json`.

## Suggested Exercises

1. Add a `/history` command that prints last 5 transcript messages.
2. Add token usage aggregation per session.
3. Add approval policy presets (`always`, `never`, `interactive`).
