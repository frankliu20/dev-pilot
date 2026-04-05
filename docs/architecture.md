# Architecture & File Structure

## Project Layout

```
dev-pilot/
├── init.js                         # Installer — reads pilot.yaml, copies framework + skills
├── clean.js                        # Workspace cleanup (logs, worktrees, repo reset)
├── pilot.yaml.template             # Config template for new users
├── LICENSE
│
├── framework/                      # Generic — installed to ~/.claude/
│   ├── commands/                   # pilot-dev-issue, pilot-watch-pr
│   ├── agents/                     # pilot-code-explorer, pilot-pr-creator, pilot-pr-reviewer
│   └── templates/                  # CLAUDE.md template
│
├── skills/                         # Custom skills (optional, user-managed)
│   └── <your-skill>/              # Custom skills (optional, user-managed)
│
├── dashboard/                      # Next.js web dashboard
│   ├── app/                        # Pages, components, API routes, hooks
│   ├── lib/                        # Core logic — config, GitHub, status log, registry
│   └── __tests__/                  # Vitest unit tests
│
└── docs/                           # Documentation
    ├── configuration.md
    ├── architecture.md             # ← You are here
    ├── dev-guide.md
    └── task-status-and-notifications.md
```

## Component Overview

### Framework (`framework/`)

Installed to `~/.claude/` by `node init.js`. Contains the reusable automation layer.

#### Commands

| Command | File | Description |
|---------|------|-------------|
| `/pilot-dev-issue` | `commands/pilot-dev-issue.md` | Core 7-phase development orchestrator. Phases: analyze → plan → implement → test → fix → PR → monitor. Supports `--auto` for fully unattended execution |
| `/pilot-watch-pr` | `commands/pilot-watch-pr.md` | PR monitoring daemon with 5-min polling. Auto-fixes CI failures, notifies dashboard on review comments |

#### Agents

| Agent | File | Tools | Description |
|-------|------|-------|-------------|
| `pilot-code-explorer` | `agents/pilot-code-explorer.md` | Read-only | Codebase analysis specialist. Run 2-3 in parallel for thorough exploration |
| `pilot-pr-creator` | `agents/pilot-pr-creator.md` | Read + Write + Bash | Git & GitHub automation — staging, committing, pushing, PR creation |
| `pilot-pr-reviewer` | `agents/pilot-pr-reviewer.md` | Read + Bash | Structured code review with interactive discussion |

### Custom Skills (`~/.claude/skills/`)

Custom skills can be placed in `~/.claude/skills/` for project-specific workflows. See [Configuration Guide](configuration.md) for the `test_runner_skill` option.

### Dashboard (`dashboard/`)

A Next.js 16 + React 19 web application for monitoring and controlling the AI engineering team.

#### Tabs

| Tab | What it does |
|-----|-------------|
| **Issues** | Lists your assigned open GitHub issues. Click "Assign to Claude" to start `/pilot-dev-issue` in a new terminal |
| **Pull Requests** | Shows open PRs with status badges (CI passing/failing, review requested, approved) |
| **Tasks** | Real-time progress stream (SSE) — see what each AI agent is doing right now |
| **Actions** | Pending decisions that need your input (e.g., test strategy choice, manual verification) |
| **Report** | Generate daily scrum or end-of-day summaries |

#### API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/issues` | GET | Fetch assigned issues from configured repos |
| `/api/prs` | GET | Fetch open PRs with status classification |
| `/api/tasks` | GET | Fetch derived task states from JSONL logs |
| `/api/stream` | GET (SSE) | Stream real-time task + decision updates |
| `/api/tasks/assign` | POST | Launch a Claude terminal for an issue |
| `/api/tasks/[taskId]` | DELETE | Cancel a running task |
| `/api/tasks/registry` | GET | Fetch worker registry state |
| `/api/decisions` | DELETE | Dismiss a pending decision |
| `/api/cleanup` | POST | Reset repos in workspace |
| `/api/report` | GET | Generate daily activity report |
| `/api/scrum` | GET/POST/PATCH | Scrum report management |

#### Lib Modules

| Module | Responsibility |
|--------|----------------|
| `config.ts` | Reads `~/.claude/pilot.yaml`, provides singleton config with env-var fallbacks |
| `github.ts` | Wraps `gh` CLI — fetches issues, PRs, commits; classifies PR actions |
| `statusLog.ts` | Reads `.jsonl` log files, derives task phases via 3-layer resolution |
| `decisions.ts` | Merges decisions from JSONL events + JSON files, auto-dismisses stale decisions. See [Task Status & Notifications](task-status-and-notifications.md) |
| `registry.ts` | In-memory task registry — assign, cancel, track worker lifecycle |
| `terminal.ts` | Spawns Claude/Copilot terminals across platforms (Windows/macOS/Linux) |
| `types.ts` | Shared TypeScript types and constants |
| `utils.ts` | Pure utilities — `timeAgo`, `formatDuration`, `truncate`, `debounce`, `cn` |
| `constants.ts` | Phase/PR-action configuration maps, pipeline definitions |

#### Data Flow

```
GitHub (via gh CLI)                    Filesystem
  │                                      │
  ├── issues ──→ /api/issues             ├── .jsonl logs ──→ statusLog.deriveTasks()
  ├── PRs ────→ /api/prs                 ├── .json decisions ──→ decisions.readPending()
  └── commits → /api/report              └── fs.watch ──→ /api/stream (SSE)
                                                              │
                                                              ▼
                                                     Dashboard (React)
                                                     useTaskStream hook
```

#### Cleanup

The "Clean All" button in the dashboard runs cleanup across **all git repositories** in your workspace directory — not just repos listed in `pilot.yaml`. This resets branches to the default, removes stale worktrees, and pulls the latest code.
