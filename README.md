# nano-agent

Incremental nano agent CLI built on Codex APIs (no direct OpenAI SDK usage).

## Tutorial Mode

This repo is a single evolving CLI.
Primary learning path is a rolling, step-by-step build guide from current `main`.

Read in order:

- [Overview](docs/tutorial-overview.md)
- [Rolling Step-by-Step Build](docs/rolling-step-by-step.md)
- [m0 Deep Dive](docs/m0.md)
- [m1 Deep Dive](docs/m1.md)
- [m2 Deep Dive](docs/m2.md)
- [m3 Deep Dive](docs/m3.md)
- [m4 Deep Dive](docs/m4.md)

Checkpoint tags still exist (`m0..m4`) if you want to inspect historical states, but they are optional.

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
