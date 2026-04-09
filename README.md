# Dev Pilot

A complete toolkit for building a **personal AI engineering team** powered by Claude Code. One engineer + a team of AI agents handling the full development lifecycle: issue analysis, coding, testing, PR creation, and CI monitoring.

## What's Inside

| Component | Description |
|-----------|-------------|
| **Commands** (2) | `/pilot-dev-issue` — 7-phase dev orchestrator; `/pilot-watch-pr` — PR monitor with auto-fix |
| **Agents** (3) | `pilot-code-explorer`, `pilot-pr-creator`, `pilot-pr-reviewer` |
| **Skill Packs** | Project-specific knowledge & scripts (e.g., `modernize-java`) |
| **Dashboard** | Next.js web UI — issues, PRs, tasks, decisions, reports |

## Quick Start

```bash
# 1. Clone and install
git clone <repo-url> dev-pilot && cd dev-pilot
node init.js                    # Interactive setup → ~/.claude/pilot.yaml

# 2. (Optional) Use a preset config
node init.js --config modernize-java-pilot.yaml

# 3. Start the dashboard
cd dashboard && npm install && npm run dev
# Open http://localhost:3000
```

### Prerequisites

- [Node.js](https://nodejs.org/) 18+
- [Claude Code CLI](https://docs.anthropic.com/en/docs/claude-code) or [GitHub Copilot CLI](https://githubnext.com/projects/copilot-cli/)
- [GitHub CLI (`gh`)](https://cli.github.com/) installed and authenticated

## How It Works

```
You (the engineer)
  │
  ├── /pilot-dev-issue #123        → 7-phase automated development
  │   ├── pilot-code-explorer (×2-3) → Parallel codebase analysis
  │   ├── test-runner skill          → Build, test, auto-fix
  │   └── pilot-pr-creator           → Commit & PR creation
  ├── /pilot-watch-pr              → Monitor PRs, auto-fix CI
  │
  └── Dashboard (localhost:3000)   → Visual overview + one-click actions
```

### Batch Auto Mode

```bash
# Run multiple issues in parallel, fully unattended
claude "/pilot-dev-issue --auto https://github.com/org/repo/issues/123" &
claude "/pilot-dev-issue --auto https://github.com/org/repo/issues/456" &
```

## Documentation

| Document | Description |
|----------|-------------|
| [Configuration Guide](docs/configuration.md) | `pilot.yaml`, `settings.json`, environment variables |
| [Architecture & File Structure](docs/architecture.md) | Project layout, module responsibilities, data flow |
| [Creating Skill Packs](docs/creating-skill-packs.md) | Build project-specific knowledge packs |
| [Developer Guide](docs/dev-guide.md) | Build, test, and contribute — practical workflows |
| [Integration Test Plan](dashboard/INTEGRATION_TEST_PLAN.md) | 34 integration test scenarios across 5 pipelines |

## Known Limitations

- **GitHub only** — All issue tracking, PR workflows, and `gh` CLI integrations assume GitHub. Azure DevOps, GitLab, Bitbucket, and other providers are not supported.

## License

Internal Use Only — see [LICENSE](./LICENSE).
