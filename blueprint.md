# Personal AI Engineering Team — Blueprint

## Vision

1 person managing a team of AI digital engineers. I only do requirement clarification, knowledge input, exception handling, and final review. AI handles everything else: issue analysis → coding → testing → PR → review handling → knowledge capture.

## What We Have Built

### Commands (6)

| Command | Purpose | Status |
|---------|---------|--------|
| `/mod-start-of-day` | Morning sync: fetch recent PRs/commits, update project knowledge, report open issues/PRs, plan the day | ✅ Done |
| `/mod-dev-issue` | Core workflow: issue → analyze → explore → plan → code → test → commit → PR (7 phases) | ✅ Done |
| `/mod-watch-pr` | Monitor open PRs: auto-fix CI failures, surface review comments, notify when ready to merge | ✅ Done |
| `/mod-status` | Dashboard: read task-status.jsonl + live GitHub data, show all task/PR states | ✅ Done |
| `/mod-scrum-report` | Generate scrum update, post `[done]/[ongoing]/[blocker]` comments to GitHub issues | ✅ Done |
| `/mod-准备下班` | End-of-day: summarize accomplishments, carry-over list for tomorrow, trigger knowledge capture | ✅ Done |

### Agents (6)

| Agent | Role | Tools | Color |
|-------|------|-------|-------|
| `code-explorer` | Read-only codebase analysis, find relevant files, map dependencies | Read, Grep, Glob, Bash | Yellow |
| `test-runner` | Run tests (3 strategies), auto-fix failures (max 3 rounds), generate manual test guide | Read, Grep, Glob, Bash, Edit, Write | Red |
| `pr-creator` | Git operations: stage, commit, push, create PR against main | Read, Grep, Glob, Bash | Blue |
| `pr-monitor` | Check CI/review status, auto-fix CI failures, propose review comment fixes | Read, Grep, Glob, Bash, Edit, Write | Purple |
| `skill-collector` | Extract and document reusable knowledge after each task | Read, Grep, Glob, Bash, Write, Edit | Green |

### Skills (3)

| Skill | Content |
|-------|---------|
| `azure-java-migration-copilot-vscode-extension` | Project-specific: build commands, directory structure, patterns, gotchas |
| `debug-jest-failures` | Common Jest failure patterns and fixes |
| `pattern-conventional-commits` | Commit message and PR description conventions |

### Infrastructure

| Component | Location | Purpose |
|-----------|----------|---------|
| `CLAUDE.md` | `~/.claude/CLAUDE.md` | Global instructions: language, safety, conventions |
| `settings.json` | `~/.claude/settings.json` | Agent Teams enabled, permission pre-approvals |
| `task-status.jsonl` | `<workspace>/logs/task-status.jsonl` | Persistent status log for all tasks/PRs (append-only) |
| `scrum-history.jsonl` | `<workspace>/logs/scrum-history.jsonl` | Scrum run timestamps for delta tracking |
| `.mod-workspace` | `~/.claude/.mod-workspace` | Workspace directory path (set by `init.js`) |

### Key Design Decisions

1. **All config in `~/.claude/`** (user-level), not in repo — agents are personal tools, not project-specific
2. **Skills per repo** — skill directory name matches repo name for clarity
3. **Test strategy is user-chosen** per task — 1 (build only) / 2 (build + impacted tests) / 3 (build + tests + manual verify)
4. **PR merge is manual** — agents never auto-merge, only notify
5. **Issue/PR numbers rendered as full clickable URLs** in all output
6. **Status log is JSONL** — simple, appendable, parseable, future UI-ready
7. **Review comment fixes require user confirmation** — no silent changes

## What We Want To Do Next

### Phase A: Validate & Stabilize (next)
- [ ] Run `/mod-dev-issue` on a real issue end-to-end, fix any rough edges
- [ ] Run `/mod-start-of-day` → tune performance and output format
- [ ] Validate status log writes correctly across all phases
- [ ] Test `/mod-scrum-report` with real issue comments

### Phase B: Automation Improvements
- [ ] Manual test (strategy 3) → automate via Playwright E2E tests
- [ ] `/mod-watch-pr` → integrate as a real polling loop (cron or background agent)
- [ ] Smarter impacted test detection — trace import graph, not just co-located `.test.ts`
- [ ] Auto-label issues based on AI analysis (area, priority)

### Phase C+D (MVP): Dashboard + Multi-Issue Parallel

**Goal**: Web UI + 多 agent 并行处理 issue，需要确认时 pop-up 通知用户。

**Tech stack**: Next.js (TypeScript, API routes, 本地运行)

**Architecture**:
```
┌─────────────────────────────────────────────────────────┐
│  Next.js Dashboard (localhost:3000)                       │
│                                                           │
│  ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐       │
│  │ #5113   │ │ #5121   │ │ #4976   │ │ #4326   │       │
│  │ 🟡 编码 │ │ 🟢 测试 │ │ ⚠️ 等你 │ │ ⏳ 排队 │       │
│  └─────────┘ └─────────┘ └─────────┘ └─────────┘       │
│                                                           │
│  ┌─ Pop-up ──────────────────────────────────────┐      │
│  │ ⚠️ #4976 needs your decision:                  │      │
│  │ Test strategy? [1: Build] [2: +Tests] [3: +E2E]│      │
│  └────────────────────────────────────────────────┘      │
└───────────────────────┬─────────────────────────────────┘
                        │ WebSocket (real-time updates)
                        ▼
┌─────────────────────────────────────────────────────────┐
│  Orchestrator Server (Next.js API routes)                 │
│                                                           │
│  Task Queue: [#5113, #5121, #4976, #4326]                │
│  Max parallel: 3                                          │
│                                                           │
│  Worker processes:                                        │
│  ├─ claude -w issue-5113 --output-format stream-json     │
│  ├─ claude -w issue-5121 --output-format stream-json     │
│  └─ claude -w issue-4976 --output-format stream-json     │
│     └─ (paused, waiting for user input via stdin)         │
│                                                           │
│  Each worker:                                             │
│  - Runs in isolated git worktree                          │
│  - Streams progress → parsed → written to status log     │
│  - Needs user input → writes pending-decision.json       │
│  - User responds in UI → piped to claude stdin            │
└─────────────────────────────────────────────────────────┘

Data flow:
  ~/.claude/logs/task-status.jsonl  ← workers append status events
  ~/.claude/logs/pending-decisions/ ← one file per blocked task
  Worker stdout (stream-json)      → orchestrator parses → WebSocket → UI
  UI user click                    → API route → worker stdin
```

**Key components**:
1. **Dashboard page** — card per issue, color-coded status, click to expand logs
2. **Orchestrator API** — spawn/manage claude processes, enforce max parallel
3. **Decision queue** — when agent needs input, pop-up in UI, pipe response back
4. **Status feed** — real-time WebSocket from task-status.jsonl to browser

**Implementation plan**:
- [ ] Scaffold Next.js project at `~/.claude/dashboard/`
- [ ] API route: POST `/api/tasks` — add issues to queue
- [ ] API route: GET `/api/tasks` — read task-status.jsonl, return current state
- [ ] API route: POST `/api/decisions/:taskId` — user answers a pending decision
- [ ] Orchestrator service: spawn `claude -w <issue> -p <prompt> --output-format stream-json`
- [ ] Parse stream-json output to detect "asking user" patterns
- [ ] WebSocket endpoint for real-time status push
- [ ] Frontend: task cards + decision pop-up modal
- [ ] Start with 2-3 parallel workers, test stability

### Phase E: Team Sharing
- [ ] Package agents + commands + skills as a Claude Code plugin
- [ ] Project skills stay in repo (`.claude/skills/`), personal skills stay in `~/.claude/skills/`
- [ ] Onboarding guide for teammates
- [ ] Shared skill library with version control

### Phase F: Advanced Intelligence
- [ ] Agent learns from PR review feedback — auto-improve code quality over time
- [ ] Predictive effort estimation based on historical task data
- [ ] Auto-detect "this issue is similar to #XYZ" and reuse approach
- [ ] Weekly metrics report: throughput, quality, auto-fix success rate

## Architecture Diagram

```
You (Human)
  │
  ├── /mod-start-of-day ──→ Morning sync + plan
  │
  ├── /mod-dev-issue ──────→ Orchestrator (7 phases)
  │     ├── Phase 0: Branch setup
  │     ├── Phase 1: Issue analysis (gh issue view)
  │     ├── Phase 2: Code exploration (code-explorer agents × 2-3)
  │     ├── Phase 3: Plan + test strategy (user approval gate)
  │     ├── Phase 4: Implementation
  │     ├── Phase 5: Test & fix (test-runner agent)
  │     ├── Phase 6: Commit & PR (pr-creator agent)
  │     └── Phase 7: Knowledge capture (skill-collector agent)
  │
  ├── /mod-watch-pr ───────→ PR monitor (pr-monitor agent)
  │     ├── Auto-fix CI failures
  │     ├── Surface review comments
  │     └── Notify ready-to-merge
  │
  ├── /mod-status ─────────→ Dashboard (reads task-status.jsonl + GitHub)
  │
  ├── /mod-scrum-report ───→ Scrum update (post to GitHub issues)
  │
  └── /mod-准备下班 ────────→ EOD summary + knowledge capture
  
Data:
  ~/.claude/logs/task-status.jsonl  ← all agents write here
  ~/.claude/logs/scrum-history.jsonl
  ~/.claude/skills/*/SKILL.md      ← knowledge grows over time
```

## File Inventory

```
~/.claude/
├── CLAUDE.md                          # Global instructions
├── settings.json                      # Settings + permissions + Agent Teams flag
├── blueprint.md                       # This file
├── agents/
│   ├── code-explorer.md
│   ├── test-runner.md
│   ├── pr-creator.md
│   ├── pr-monitor.md
│   └── skill-collector.md
├── commands/
│   ├── mod-start-of-day.md
│   ├── mod-dev-issue.md
│   ├── mod-watch-pr.md
│   ├── mod-status.md
│   ├── mod-scrum-report.md
│   └── mod-准备下班.md
├── skills/
│   ├── azure-java-migration-copilot-vscode-extension/SKILL.md
│   ├── debug-jest-failures/SKILL.md
│   └── pattern-conventional-commits/SKILL.md
└── logs/
    ├── task-status.jsonl              # Created on first /mod-dev-issue run
    └── scrum-history.jsonl            # Created on first /mod-scrum-report run
```
