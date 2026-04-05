# AI Engineering Team Toolkit

A complete toolkit for building a **personal AI engineering team** powered by Claude Code. One engineer + a team of AI agents handling the full development lifecycle: issue analysis, coding, testing, PR creation, and knowledge capture.

## What's Inside

### Commands (6)

| Command | Description |
|---------|-------------|
| `/mod-dev-issue` | Core 7-phase development orchestrator: branch setup, analysis, exploration, planning, implementation, testing, PR creation |
| `/mod-start-of-day` | Morning sync — fetches recent activity, classifies open PRs, generates a prioritized day plan |
| `/mod-watch-pr` | PR monitoring daemon with 5-min polling — auto-fixes CI failures and simple review comments |
| `/mod-status` | Task & PR dashboard — reads status log + live GitHub data, produces a color-coded status table |
| `/mod-scrum-report` | Scrum/standup report generator — classifies work into Done/Ongoing/Blocker, posts to GitHub issues |
| `/mod-准备下班` | End-of-day wrap-up — compiles daily stats, generates carry-over list for tomorrow |

### Agents (5)

| Agent | Role |
|-------|------|
| `code-explorer` | Read-only codebase analysis specialist (run 2-3 in parallel for exploration) |
| `test-runner` | Test & debug specialist with 3 test strategies and auto-fix loops |
| `pr-creator` | Git & GitHub automation — staging, committing, pushing, PR creation |
| `pr-monitor` | PR monitoring & remediation — CI fixes, review comment handling |
| `skill-collector` | Knowledge management — extracts reusable learnings into skill files |

### Skills (1)

| Skill | Description |
|-------|-------------|
| `azure-java-migration-copilot-vscode-extension` | Comprehensive project reference — build/test commands, directory structure, key patterns, CI details, and gotchas |

### Dashboard

A Next.js web dashboard (`dashboard/`) providing:
- **Issues Tab** — Your assigned open GitHub issues with "Assign to Claude" button
- **Pull Requests Tab** — Open PRs with smart status classification (ready to merge / CI failing / changes requested / review pending)
- **Claude Tasks Tab** — Real-time task progress via SSE (planned / analyzing / implementing / testing / done)

## Quick Start

### Prerequisites

- [Node.js](https://nodejs.org/) 18+
- [Claude Code CLI](https://docs.anthropic.com/en/docs/claude-code) installed and authenticated
- [GitHub CLI (`gh`)](https://cli.github.com/) installed and authenticated

### Installation

```bash
# 1. Clone the repo
git clone <repo-url> mod-assitant
cd mod-assitant

# 2. Install tools to ~/.claude/
node init.js

# 3. Configure your settings
#    Edit ~/.claude/settings.json to add permissions (see below)
#    Edit ~/.claude/CLAUDE.md to customize your preferences

# 4. Start the dashboard
cd dashboard
npm install
cp .env.example .env.local
#    Edit .env.local with your repo info
npm run dev

# 5. Open http://localhost:3000
```

### Settings Configuration

The init script does NOT copy `settings.json` (it contains user-specific configurations). You need to manually configure `~/.claude/settings.json`. Here's a recommended starting point:

```json
{
  "permissions": {
    "allow": [
      "Bash(npx jest*)",
      "Bash(npm run build*)",
      "Bash(npm run test*)",
      "Bash(npm run lint*)",
      "Bash(git status*)",
      "Bash(git diff*)",
      "Bash(git log*)",
      "Bash(git checkout*)",
      "Bash(git add*)",
      "Bash(git commit*)",
      "Bash(git push*)",
      "Bash(git branch*)",
      "Bash(gh issue*)",
      "Bash(gh pr*)",
      "Bash(gh run*)",
      "Bash(gh api*)"
    ]
  }
}
```

### Dashboard Environment Variables

Create `dashboard/.env.local`:

```bash
# Your GitHub repository (owner/repo)
GITHUB_REPO=your-org/your-repo

# Local path to your repository clone
REPO_PATH=/path/to/your/local/repo
```

## How It Works

```
You (the engineer)
  |
  |-- /mod-start-of-day        --> Morning sync, plan the day
  |-- /mod-dev-issue #123       --> 7-phase automated development
  |   |-- code-explorer (x2-3) --> Parallel codebase analysis
  |   |-- test-runner           --> Build, test, auto-fix
  |   |-- pr-creator            --> Commit & PR creation
  |   |-- skill-collector       --> Capture learnings
  |-- /mod-watch-pr             --> Monitor PRs, auto-fix CI
  |-- /mod-status               --> Check progress
  |-- /mod-scrum-report         --> Generate standup report
  |-- /mod-准备下班              --> End-of-day wrap-up
  |
  v
Dashboard (localhost:3000)      --> Visual overview + one-click task assignment
```

## File Structure

```
mod-assitant/
├── init.js                     # Install script
├── blueprint.md                # Architecture & vision document
├── claude-md-template.md       # CLAUDE.md template
├── commands/                   # 6 Claude Code commands
├── agents/                     # 5 Claude Code agents
├── skills/                     # Project skills
└── dashboard/                  # Next.js web dashboard
    ├── app/                    # Pages, components, API routes
    ├── lib/                    # Server-side logic
    └── package.json
```

## License

MIT
