# nano-agent

A production-ready CLI agent built on Codex APIs. Learn by reading and running existing code.

## Tutorial

**[📚 Start the Complete Tutorial →](docs/TUTORIAL.md)**

This tutorial walks you through the entire architecture in one comprehensive guide:

- Part 1: CLI Entry Point and Command Routing
- Part 2: The Exec Provider — First Control Plane
- Part 3: Session Persistence and Chat Loop
- Part 4: Planning Layer with Todos
- Part 5: Provider Abstraction and Mode Switching
- Part 6: App-Server RPC Transport
- Part 7: Interactive Runtime Controls

**No git checkouts needed.** Stay on `main` and follow along.

## Quick Start

```bash
# Clone and setup
git clone <repo-url>
cd codex-tuts
npm install
npm run lint
npm test

# Try the CLI
npm run dev -- run "summarize this repository"
npm run dev -- chat
npm run dev -- sessions

# RPC mode (requires codex-app-server)
NANO_PROVIDER=rpc npm run dev -- chat
```

## Commands

| Command | Description |
|---------|-------------|
| `run "<task>"` | One-shot task execution |
| `chat` | Interactive multi-turn chat with memory |
| `chat --resume <id>` | Resume a previous session |
| `sessions` | List all stored sessions |
| `steer <id> "<text>"` | Steer an active turn (RPC only) |
| `interrupt <id>` | Interrupt a running turn (RPC only) |

## Architecture Highlights

- **Transport Abstraction**: Exec and RPC providers implement the same interface
- **Event Normalization**: All transport events map to `RuntimeEvent` union
- **Local-First Persistence**: Sessions stored as files (JSONL), not in a database
- **Explicit Planning**: Todo manager gives the agent working memory
- **Progressive Enhancement**: Exec mode works out-of-the-box, RPC adds features

## Prerequisites

- Node.js 20+
- npm 10+
- Codex CLI installed and authenticated
- (For RPC features) `codex-app-server` available in PATH

## What You'll Learn

By working through this tutorial, you'll understand:

- How to spawn and manage child processes for agent execution
- JSONL parsing and incremental stream processing
- Event normalization across different transport layers
- Session persistence with append-only JSONL files
- Multi-turn conversation memory management
- Explicit planning state with todo constraints
- JSON-RPC 2.0 protocol over stdio
- Async generator patterns for event streaming
- Provider abstraction for transport-agnostic code
- Interactive runtime controls (approvals, steering, interruption)

## Project Structure

```
src/
├── index.ts                    # CLI entry point
├── cli/
│   ├── chat.ts                # Interactive chat loop
│   ├── render.ts              # Event rendering
│   ├── todo.ts                # Todo slash commands
│   └── list-sessions.ts       # Session listing
├── core/
│   ├── session-store.ts       # Session persistence
│   └── todo-manager.ts        # Todo state management
├── providers/
│   ├── factory.ts             # Provider selection
│   ├── codex-exec/
│   │   ├── provider.ts        # Exec provider
│   │   └── jsonl.ts           # JSONL parsing
│   └── codex-rpc/
│       ├── provider.ts        # RPC provider
│       └── jsonrpc-client.ts  # JSON-RPC client
└── types/
    └── events.ts              # Event types and interfaces
```

## License

MIT
