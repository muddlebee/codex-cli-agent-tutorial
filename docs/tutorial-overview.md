# Nano Agent Tutorial Track

This repository teaches you how to build one real CLI (`nano-agent`) in incremental milestones.

You do not maintain separate projects. You learn by checking out known-good checkpoints.

## Audience

This tutorial is for engineers who:
- know basic TypeScript/Node.js
- can run terminal commands
- want to build a Codex-powered agent without using the OpenAI SDK directly

## Prerequisites

1. Node.js 20+
2. npm 10+
3. Codex CLI installed and authenticated
4. (for RPC milestones) `codex-app-server` available in PATH, or set `CODEX_APP_SERVER_BIN`

## Learning Format

Each milestone chapter includes:
- goal
- concepts
- step-by-step flow
- commands to run
- expected output
- troubleshooting
- exercises

## Checkpoint Workflow (Recommended)

Start clean from each milestone tag:

```bash
git checkout m0
npm install
npm run lint
npm test
```

When ready for the next lesson:

```bash
git checkout m1
# or compare changes
# git diff m0..m1
```

Return to latest:

```bash
git checkout main
```

## Milestones

1. [m0](m0.md): first runnable Codex control plane (`codex exec --json`)
2. [m1](m1.md): interactive chat + local session persistence
3. [m2](m2.md): explicit planning with todo constraints
4. [m3](m3.md): migrate transport to Codex app-server JSON-RPC
5. [m4](m4.md): approvals and in-flight turn control (steer/interrupt)

## Progress Checklist

For every milestone, verify:
- `npm run lint` passes
- `npm test` passes
- at least one real command runs end-to-end
- you can explain why this milestone exists before moving on
