# Dev Pilot

A complete toolkit for building a **personal AI engineering team** powered by Claude Code. One engineer + a team of AI agents handling the full development lifecycle: issue analysis, coding, testing, PR creation, and CI monitoring.

## What's Inside

### Framework (installed to ~/.claude/)

#### Commands (2)

| Command | Description |
|---------|-------------|
| `/pilot-dev-issue` | Core 7-phase development orchestrator. Supports `--auto` for fully unattended execution |
| `/pilot-watch-pr` | PR monitoring daemon with 5-min polling — auto-fixes CI failures, notifies Dashboard on review comments |

#### Agents (3)

| Agent | Role |
|-------|------|
| `pilot-code-explorer` | Read-only codebase analysis specialist (run 2-3 in parallel for exploration) |
| `pilot-pr-creator` | Git & GitHub automation — staging, committing, pushing, PR creation |
| `pilot-pr-reviewer` | Structured code review, interactive discussion, fix review comments |

### Skill Packs (project-specific, configurable)

| Skill Pack | Description |
|------------|-------------|
| `modernize-java` | Azure Java Migration Copilot — test-runner, build-intellij, telemetry-query, benchmark-analysis, general-knowledge |

### Dashboard

A Next.js web dashboard (`dashboard/`) providing:
- **Issues Tab** — Your assigned open GitHub issues with "Assign to Claude" button
- **Pull Requests Tab** — Open PRs with smart status classification
- **Tasks Tab** — Real-time task progress via SSE
- **Actions Tab** — Pending decisions from AI agents
- **Report Tab** — Daily scrum / end-of-day report generation

## Quick Start

### Prerequisites

- [Node.js](https://nodejs.org/) 18+
- [Claude Code CLI](https://docs.anthropic.com/en/docs/claude-code) or [GitHub Copilot CLI](https://githubnext.com/projects/copilot-cli/)
- [GitHub CLI (`gh`)](https://cli.github.com/) installed and authenticated

### Installation

```bash
# 1. Clone the toolkit
git clone <repo-url> dev-pilot
cd dev-pilot

# 2. Interactive setup — creates ~/.claude/pilot.yaml, installs framework + skills
node init.js

# 3. Or use a preset config (e.g., modernize-java project)
node init.js --config modernize-java-pilot.yaml

# 4. Configure your settings
#    Edit ~/.claude/settings.json to add permissions (see below)
#    Edit ~/.claude/CLAUDE.md to customize your preferences

# 5. (Optional) Start the dashboard
cd dashboard
npm install
npm run dev
# Open http://localhost:3000
```

### Configuration: pilot.yaml

All project settings live in `~/.claude/pilot.yaml`:

```yaml
workspace: ~/claude/workspace

repos:
  - your-org/your-repo

skills:
  - modernize-java          # Activate skill packs

ai_platform: copilot-cli    # copilot-cli or claude-code

defaults:
  dev_issue_mode: normal     # normal or auto
  review_pr_mode: auto       # auto or normal
  fix_comment_mode: auto     # auto or normal
  review_min_severity: medium # high, medium, or low

# build:
#   command: npm run build
#   test_command: npx jest --testPathPattern={{file}} --no-coverage
#   default_branch: main
```

### Settings Configuration

The init script does NOT copy `settings.json` (it contains user-specific permissions). Configure `~/.claude/settings.json` manually:

```json
{
  "permissions": {
    "allow": [
      "Bash(npx jest*)",
      "Bash(npm run build*)",
      "Bash(npm run test*)",
      "Bash(npm run lint*)",
      "Bash(git *)",
      "Bash(gh *)"
    ]
  }
}
```

## How It Works

```
You (the engineer)
  |
  |-- /pilot-dev-issue #123        --> 7-phase automated development
  |   |-- pilot-code-explorer (x2-3)  --> Parallel codebase analysis
  |   |-- test-runner skill            --> Build, test, auto-fix
  |   |-- pilot-pr-creator             --> Commit & PR creation
  |-- /pilot-watch-pr              --> Monitor PRs, auto-fix CI
  |
  v
Dashboard (localhost:3000)         --> Visual overview + one-click actions
```

### Batch Auto Mode

Run multiple issues in parallel without any human interaction:

```bash
# Each runs in its own worktree, fully unattended
claude "/pilot-dev-issue --auto https://github.com/org/repo/issues/123" &
claude "/pilot-dev-issue --auto https://github.com/org/repo/issues/456" &

# Check progress via Dashboard (localhost:3000)
```

## File Structure

```
dev-pilot/
├── init.js                         # Installer — reads pilot.yaml, copies framework + skills
├── clean.js                        # Workspace cleanup (logs, worktrees, repo reset)
├── pilot.yaml.template             # Config template for new users
├── modernize-java-pilot.yaml       # Preset config for the modernize-java project
├── LICENSE                         # Internal Use Only
│
├── framework/                      # Generic — installed to ~/.claude/
│   ├── commands/                   # pilot-dev-issue, pilot-watch-pr
│   ├── agents/                     # pilot-code-explorer, pilot-pr-creator, pilot-pr-reviewer
│   └── templates/                  # CLAUDE.md template
│
├── skills/                         # Project-specific skill packs
│   └── modernize-java/             # Azure Java Migration Copilot skills
│       ├── test-runner/            # Build, test, manual verify strategies
│       ├── build-intellij/         # Cross-repo IntelliJ plugin build
│       ├── telemetry-query/        # Azure App Insights queries
│       ├── benchmark-analysis/     # MSBenchmark run analysis
│       ├── general-knowledge/      # Project gotchas and patterns
│       └── scripts/                # Utility scripts
│
├── dashboard/                      # Next.js web dashboard
│   ├── app/                        # Pages, components, API routes
│   └── lib/                        # Config, GitHub integration, status log
│
└── blueprint.md                    # Architecture & vision document
```

## Using the Dashboard

The dashboard is an optional Next.js web app for monitoring and controlling your AI engineering team.

### Setup

```bash
cd dashboard
npm install
npm run dev
# Open http://localhost:3000
```

The dashboard reads `~/.claude/pilot.yaml` at runtime — no separate configuration needed.

### Tabs

| Tab | What it does |
|-----|-------------|
| **Issues** | Lists your assigned open GitHub issues. Click "Assign to Claude" to start `/pilot-dev-issue` in a new terminal |
| **Pull Requests** | Shows open PRs with status badges (CI passing/failing, review requested, approved, merged) |
| **Tasks** | Real-time progress stream (SSE) — see what each AI agent is doing right now |
| **Actions** | Pending decisions that need your input (e.g., test strategy choice, manual verification) |
| **Report** | Generate daily scrum or end-of-day summaries |

### API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/issues` | GET | Fetch assigned issues from configured repos |
| `/api/pulls` | GET | Fetch open PRs from configured repos |
| `/api/tasks` | GET (SSE) | Stream real-time task updates |
| `/api/cleanup` | POST | Reset all repos in workspace (pull latest, clean worktrees) |
| `/api/trigger` | POST | Launch a Claude terminal for an issue or PR |

### Cleanup

The "Clean All" button in the dashboard runs cleanup across **all git repositories** in your workspace directory — not just repos listed in `pilot.yaml`. This resets branches to the default, removes stale worktrees, and pulls the latest code.

## Creating Your Own Skill Pack

Skill packs let you add project-specific knowledge, test strategies, and scripts to the framework.

### Structure

```
skills/
└── your-project/
    ├── general-knowledge/
    │   └── SKILL.md          # Project conventions, gotchas, patterns
    ├── test-runner/
    │   └── SKILL.md          # Build, test, manual verify strategies
    ├── scripts/
    │   └── your-script.sh    # Utility scripts (copied to ~/.claude/scripts/)
    └── test-scenarios/
        └── webapp.md         # Manual test scenario (copied to ~/.claude/test-scenarios/)
```

### Steps

1. Create a directory under `skills/` with your pack name
2. Add subdirectories with `SKILL.md` files — each becomes a skill
3. Add your pack name to `pilot.yaml` under `skills:`
4. Run `node init.js --force` to install

### Test Scenario Format

Files in `test-scenarios/` are automatically discovered by the test-runner:

```markdown
---
id: webapp
name: "Web App (Browser)"
---
## Setup
[Build and launch commands]

## Hand-off Instructions
[What to tell the user to test]

## Verification Checklist
- [ ] Feature works correctly
- [ ] No console errors

## Cleanup
[Cleanup commands]
```

## Known Limitations

- **GitHub only** — All issue tracking, PR workflows, and `gh` CLI integrations assume GitHub. Azure DevOps, GitLab, Bitbucket, and other providers are not supported.

## License

Internal Use Only — see [LICENSE](./LICENSE).
