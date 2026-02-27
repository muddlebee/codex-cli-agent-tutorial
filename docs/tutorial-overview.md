# Tutorial Overview - Building Nano Agent CLI on Codex APIs

## Learning path
1. `m0`: run one task through `codex exec --json`
2. `m1`: add interactive chat + local session persistence
3. `m2`: add planning constraints via TodoManager
4. `m3`: switch transport to `codex-app-server` RPC
5. `m4`: add approvals and in-flight control commands

## Recommended order for beginners
- Read one tutorial doc.
- Run the corresponding commands.
- Inspect generated files under `.nano-agent/`.
- Complete exercises before moving on.

## Milestone checkpoints
Use git tags to inspect each stable state:
```bash
git checkout m0
# ... later
git checkout m4
```

## Validation checklist per milestone
- `npm run lint`
- `npm test`
- Run at least one real command (`run` or `chat`) with Codex installed
