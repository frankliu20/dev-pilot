# Dev Pilot

> ⚠️ **Status: Experimental** — This project is in early alpha. APIs, commands, and config formats may change without notice.

**Your personal AI engineering team.** Point it at a GitHub issue — it analyzes, codes, tests, and opens a PR. You review and merge.

Dev Pilot turns Claude Code into a fully autonomous development pipeline. Instead of writing code yourself, you manage a team of AI agents that handle the entire lifecycle: from understanding the issue to shipping a pull request.

## Why Dev Pilot?

Most AI coding tools help you write code faster. Dev Pilot goes further — it **replaces the entire inner dev loop**:

- 🎯 **Issue in, PR out** — Give it a GitHub issue URL. Get back a tested, reviewed pull request.
- 🔄 **Parallel by default** — Each issue runs in its own git worktree. Assign 5 issues at once, they all run in parallel.
- 🤖 **Auto-fix CI** — PR monitor watches for CI failures, reads the logs, and pushes fixes automatically.
- 🎛️ **Stay in control** — Approve the plan before implementation. Choose your test strategy. Review before merge. AI never merges without you.
- 📊 **Live Dashboard** — See all issues, PRs, tasks, and pending decisions in one place. Get notified when AI needs your input.

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
