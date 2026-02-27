# nano-agent

Incremental nano agent CLI built on Codex APIs (no direct OpenAI SDK usage).

## Tutorial Mode

This repo is a single evolving CLI with tutorial checkpoints.
Read milestone docs in order:

- [Overview](docs/tutorial-overview.md)
- [m0](docs/m0.md)
- [m1](docs/m1.md)
- [m2](docs/m2.md)
- [m3](docs/m3.md)
- [m4](docs/m4.md)

## Milestones

| Milestone | Goal | Checkpoint |
|---|---|---|
| m0 | Codex exec JSONL adapter + `run` command | `m0` ([docs](docs/m0.md)) |
| m1 | Interactive chat + persistence | `m1` ([docs](docs/m1.md)) |
| m2 | Todo planning layer | `m2` ([docs](docs/m2.md)) |
| m3 | App-server RPC provider | `m3` ([docs](docs/m3.md)) |
| m4 | Approvals + steer/interrupt | `m4` ([docs](docs/m4.md)) |

## Quick Start

```bash
npm install
npm run dev -- run "summarize this repository"
npm run dev -- chat
# Switch provider
NANO_PROVIDER=rpc npm run dev -- chat
# In rpc mode
NANO_PROVIDER=rpc npm run dev -- steer <sessionId> "take a different direction"
NANO_PROVIDER=rpc npm run dev -- interrupt <sessionId>
```
