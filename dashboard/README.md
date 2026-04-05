# Dev Pilot Dashboard

A local-only Next.js web UI for monitoring your AI engineering team. Displays issues, PRs, Claude tasks, and decision notifications in real time.

## Quick Start

```bash
cd dashboard
npm install
npm run dev
# Open http://localhost:3000
```

## Prerequisites

- Node.js 18+
- [GitHub CLI (`gh`)](https://cli.github.com/) installed and authenticated
- A configured `~/.claude/pilot.yaml` (run `node init.js` from the project root)

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 16 (App Router) |
| UI | React 19, CSS Modules, design tokens |
| Language | TypeScript 5 |
| Testing | Vitest + Testing Library |
| Data | GitHub via `gh` CLI, local JSONL logs via `fs.watch` |

## Scripts

```bash
npm run dev           # Development server with hot reload (port 3000)
npm run build         # Production build
npm run lint          # ESLint
npm test              # Run all tests once
npm run test:watch    # Watch mode
npm run test:coverage # Coverage report
```

## Architecture

```
Browser ──HTTP──→ Next.js API Routes ──async exec──→ gh CLI
                       │
                  fs.watch ──→ logs/*.jsonl (task status)
                  fs.watch ──→ logs/pending-decisions/*.json
                       │
                  SSE ──→ Browser (real-time updates)
```

- **No database, no auth** — runs entirely on localhost
- **No extra UI dependencies** — custom component library (Badge, Button, Toast, etc.)
- GitHub data polled every 30s via `gh` CLI
- Task status streamed via Server-Sent Events (SSE)

## Testing

See the [Developer Guide](../docs/dev-guide.md#testing) for detailed testing patterns, mocking strategies, and examples.
