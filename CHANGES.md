# Tutorial Overhaul — February 2026

This document summarizes the major tutorial restructuring completed on Feb 27, 2026.

## What Changed

### 1. New Comprehensive Tutorial

Created [`docs/TUTORIAL.md`](docs/TUTORIAL.md) — a single, comprehensive guide that walks through the entire codebase in 7 parts:

- **Part 1**: CLI Entry Point and Command Routing
- **Part 2**: The Exec Provider — First Control Plane
- **Part 3**: Session Persistence and Chat Loop
- **Part 4**: Planning Layer with Todos
- **Part 5**: Provider Abstraction and Mode Switching
- **Part 6**: App-Server RPC Transport
- **Part 7**: Interactive Runtime Controls

**Key improvements:**
- Inline code snippets with explanations (not just file paths)
- Architecture diagrams showing data flow
- Design decision explanations for every major component
- Troubleshooting section covering common issues
- Exercises (easy/medium/hard) for each section
- No git checkouts required — stay on `main` throughout

### 2. Architectural Comments in Source Code

Added comprehensive comments to key files explaining the "why" behind design decisions:

**Files enhanced:**
- `src/index.ts` — CLI entry point overview
- `src/providers/codex-exec/provider.ts` — Exec provider architecture
- `src/providers/codex-exec/jsonl.ts` — JSONL parsing strategy
- `src/core/session-store.ts` — Storage layout and JSONL rationale
- `src/core/todo-manager.ts` — Planning constraints explanation
- `src/providers/factory.ts` — Provider abstraction reasoning
- `src/providers/codex-rpc/jsonrpc-client.ts` — JSON-RPC protocol details
- `src/providers/codex-rpc/provider.ts` — RPC provider architecture
- `src/cli/chat.ts` — Chat loop flow and approval handling
- `src/types/events.ts` — Event normalization strategy

**Comment style:**
- Focus on "why" not "what" (avoid narrating code)
- Explain trade-offs and design decisions
- Highlight production considerations
- Document intentional constraints

### 3. Updated README

Rewrote [`README.md`](README.md) with:
- Clear tutorial link as primary CTA
- Quick start commands
- Command reference table
- Architecture highlights
- Project structure overview
- Learning outcomes

### 4. Archived Old Docs

Moved old milestone-based docs to `docs/archive/`:
- `m0.md` through `m4.md`
- `tutorial-overview.md`
- `rolling-step-by-step.md`

Added `docs/archive/README.md` explaining the migration.

## Why These Changes

### Problems with Old Approach

1. **Git Checkout Friction**
   - Learners lost their work when switching milestones
   - Docs got overwritten on each checkout
   - Required understanding git tags/branches

2. **Maintenance Burden**
   - Updating docs required recreating all tags
   - Changes had to be applied to 5+ separate files
   - Docs drifted out of sync with code

3. **Learning Experience**
   - Fragmented narrative across multiple files
   - No code snippets (just file paths)
   - Missing "what changed" summaries between milestones
   - No architectural context

### Benefits of New Approach

1. **Beginner-Friendly**
   - No git knowledge required
   - Single file to read top-to-bottom
   - Code snippets show exactly what to look for
   - Clear progression through complexity

2. **Maintainable**
   - One file to update (`TUTORIAL.md`)
   - Comments live in source files (stay in sync)
   - No tag recreation needed

3. **Educational**
   - Explains design decisions, not just implementation
   - Shows trade-offs and alternatives
   - Includes architecture diagrams
   - Provides exercises for practice

## Migration Guide

### For Learners

**Old way:**
```bash
git checkout m0
# read docs/m0.md
git checkout m1
# read docs/m1.md
# etc.
```

**New way:**
```bash
# Stay on main
# Read docs/TUTORIAL.md from start to finish
```

### For Maintainers

**Updating docs:**
- Edit `docs/TUTORIAL.md` directly
- Add/update architectural comments in source files
- No need to touch git tags

**Adding new features:**
1. Implement the feature
2. Add architectural comments to new/modified files
3. Add a new section to `TUTORIAL.md` with code snippets
4. Update exercises if applicable

## Metrics

- **Old tutorial**: 5 separate docs, ~500 lines total, no code snippets
- **New tutorial**: 1 comprehensive doc, ~750 lines, 30+ code snippets
- **Source comments**: Added ~100 lines of architectural comments across 10 files
- **Time to complete**: ~6 hours (planning, writing, commenting, testing)

## Next Steps

Potential future improvements:

1. **Interactive Examples**: Add runnable code snippets with expected output
2. **Video Walkthrough**: Record screencast following the tutorial
3. **Diagrams**: Add more visual architecture diagrams (currently ASCII)
4. **Translations**: Translate tutorial to other languages
5. **Advanced Topics**: Add sections on testing, deployment, monitoring

## Feedback

If you have suggestions for improving the tutorial, please open an issue or PR.
