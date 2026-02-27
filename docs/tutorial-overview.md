# Nano Agent Tutorial Overview (Rolling Build)

This repository teaches you how the full `nano-agent` CLI is assembled in layered steps inside one codebase.

You can follow everything from `main` without switching git tags.

## Audience

This tutorial is for developers who know basic TypeScript and terminal usage, and want to build a Codex-powered CLI without using the OpenAI SDK directly.

## Prerequisites

1. Node.js 20+
2. npm 10+
3. Codex CLI installed and authenticated
4. For RPC flow: `codex-app-server` in PATH, or set `CODEX_APP_SERVER_BIN`

## Recommended Path

Use this guide first:
- [Rolling Step-by-Step CLI Build](rolling-step-by-step.md)

Then use milestone chapters for focused deep dives:
- [m0](m0.md): exec JSONL adapter
- [m1](m1.md): chat + persistence
- [m2](m2.md): todo planning layer
- [m3](m3.md): app-server RPC provider
- [m4](m4.md): approvals + steer/interrupt

## Validation Checklist

At each stage, run:

```bash
npm run lint
npm test
```

And execute at least one real command (`run` or `chat`) end-to-end.
