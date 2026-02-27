# nano-agent

Incremental nano agent CLI built on Codex APIs (no direct OpenAI SDK usage).

## Milestones

| Milestone | Goal | Checkpoint |
|---|---|---|
| m0 | Codex exec JSONL adapter + `run` command | `m0` ([docs](docs/m0.md)) |
| m1 | Interactive chat + persistence | `m1` ([docs](docs/m1.md)) |
| m2 | Todo planning layer | `m2` |
| m3 | App-server RPC provider | `m3` |
| m4 | Approvals + steer/interrupt | `m4` |

## Quick Start

```bash
npm install
npm run dev -- run "summarize this repository"
npm run dev -- chat
```
