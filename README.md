[English](README.md) | [中文](README.zh-CN.md)

# Dev Pilot

> An AI Multi-Agent engineering team that empowers **single developer = full engineering team**

Automate the entire software development lifecycle: coding, testing, building, CI fixing, code review repair & comment resolution.

## Core Features

- 🤖 **Multi-Agent Team Orchestration** — Automatically spawn specialized AI agent teams to split, assign, and execute engineering tasks collaboratively
- 💻 **Dual Interaction Mode** — Visual Dashboard one-click operation & lightweight CLI command-line control
- 🔁 **Full Dev Lifecycle Automation** — Code analysis, feature coding, unit testing, project build, CI error fix, code review comment resolution, code optimization
- ⚡️ **Engineer-Oriented Practical Skills** — Integrated massive real-world engineering capabilities accumulated from industrial development scenarios
- 🛡️ **Stable & Secure** — Fully independent open-source project, MIT License

## Why Dev Pilot?

Traditional AI coding tools only generate fragmented code snippets. Dev Pilot runs a **complete virtual engineering team**:

It understands your project context, handles full-process engineering trivialities, and only leaves core architecture & decision work to humans.

## Quick Start

```bash
git clone https://github.com/frankliu20/dev-pilot.git && cd dev-pilot
node init.js                    # Prompts for workspace path + GitHub repo (owner/repo)
```

`init.js` creates `~/.claude/pilot.yaml` with your settings and installs commands/agents. Review and tweak it anytime — see the [Configuration Guide](docs/configuration.md).

```bash
# Optional: start the dashboard
cd dashboard && npm install && npm run dev
```

Then, in Claude Code:

```
/pilot-dev-issue https://github.com/your-org/your-repo/issues/123
```

That's it. Sit back and watch, or go work on something else.

### Batch Mode

```bash
# Fire and forget — multiple issues in parallel, fully unattended
claude "/pilot-dev-issue --auto https://github.com/org/repo/issues/123" &
claude "/pilot-dev-issue --auto https://github.com/org/repo/issues/456" &
claude "/pilot-dev-issue --auto https://github.com/org/repo/issues/789" &
```

## What's Inside

| Component | What it does |
|-----------|-------------|
| `/pilot-dev-issue` | The core pipeline: analyze → explore → plan → code → test → PR |
| `/pilot-watch-pr` | Monitors open PRs, auto-fixes CI failures, notifies on reviews |
| `pilot-code-explorer` | Parallel codebase analysis agents (2-3 per issue) |
| `pilot-pr-creator` | Handles git operations: stage, commit, push, create PR |
| `pilot-pr-reviewer` | Structured code review with interactive discussion |
| **Dashboard** | Web UI at localhost:3000 — issues, PRs, tasks, decisions at a glance |

## How It Works

```
You
 │
 ├── /pilot-dev-issue #123
 │     ├── Analyze issue
 │     ├── Explore codebase (parallel agents)
 │     ├── Present plan → you approve
 │     ├── Implement + test + auto-fix
 │     └── Open PR
 │
 ├── /pilot-watch-pr
 │     ├── Poll PRs every 5 min
 │     ├── Auto-fix CI failures
 │     └── Notify when ready to merge
 │
 └── Dashboard (localhost:3000)
       └── Visual command center for everything above
```

## Use Scenarios

- Daily business feature development
- Automatic repair of CI/CD build failures
- One-click resolution of code review comments
- Code specification optimization & bug fixing
- Batch project refactoring & unit test generation

## Prerequisites

- [Git](https://git-scm.com/) and a GitHub account
- [Node.js](https://nodejs.org/) 18+
- [Claude Code CLI](https://docs.anthropic.com/en/docs/claude-code)
- [GitHub CLI (`gh`)](https://cli.github.com/) — run `gh auth login` after install

## Documentation

| Document | Description |
|----------|-------------|
| [Configuration Guide](docs/configuration.md) | Setup `pilot.yaml`, permissions, build/test commands |
| [Architecture](docs/architecture.md) | Project structure and data flow |
| [Developer Guide](docs/dev-guide.md) | Build, test, and contribute |
| [Contributing](CONTRIBUTING.md) | How to contribute to Dev Pilot |

## License

MIT — see [LICENSE](./LICENSE).
