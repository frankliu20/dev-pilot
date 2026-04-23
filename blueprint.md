# Dev Pilot — Blueprint

## Vision

1 person managing a team of AI digital engineers. I only do requirement clarification, knowledge input, exception handling, and final review. AI handles everything else: issue analysis → coding → testing → PR → review handling → knowledge capture.

## What We Have Built

### Component Organization

Components are organized into framework (generic) and custom skills (project-specific, optional):

---

#### Framework — Generic, installed to ~/.claude/

##### Commands

| Command | Purpose |
|---------|---------|
| `/pilot-dev-issue` | Core 7-phase orchestrator: issue → analyze → explore → plan → code → test → PR. Supports `--auto` |
| `/pilot-watch-pr` | PR monitoring daemon: 5-min polling, auto-fix CI failures, notify Dashboard on review comments / ready-to-merge, worktree cleanup |

##### Agents

| Agent | Purpose |
|-------|---------|
| `pilot-code-explorer` | Read-only codebase analysis, find relevant files, map dependencies. Used by Phase 2 |
| `pilot-pr-creator` | Git operations: stage, commit, push, create PR. Used by Phase 6 |
| `pilot-pr-reviewer` | Structured code review (🔴/🟡/🟢), interactive discussion, fix review comments |

#### Custom Skills — Optional, user-managed

Custom skills can be added to `~/.claude/skills/` for project-specific test workflows. See [Configuration Guide](docs/configuration.md) for `test_runner_skill`.

#### Infrastructure

| Component | Location | Purpose |
|-----------|----------|---------|
| `pilot.yaml` | `~/.claude/pilot.yaml` | Unified config: workspace, repos, skills, AI platform, defaults |
| `CLAUDE.md` | `~/.claude/CLAUDE.md` | Global instructions: language, safety, conventions |
| `settings.json` | `~/.claude/settings.json` | Permission pre-approvals |
| `<task_id>.jsonl` | `<workspace>/logs/<task_id>.jsonl` | Per-task status log (append-only) |
| `summary.jsonl` | `<workspace>/logs/summary.jsonl` | Cross-task summary events |
| `worktrees/` | `<workspace>/worktrees/` | Per-issue git worktrees for parallel development |

---

### Key Design Decisions

1. **All config in `~/.claude/`** (user-level), not in repo — agents are personal tools, not project-specific
2. **Source of truth in `dev-pilot/`** — commands, agents, skills live in this repo. Run `node init.js --force` to sync to `~/.claude/`
3. **pilot.yaml as single config** — workspace path, repos, active skills, AI platform, automation defaults all in one file
4. **Custom skills are optional** — users can add skills to `~/.claude/skills/` and reference them via `test_runner_skill` in `pilot.yaml`
5. **Test strategy is user-chosen** per task — 1 (build only) / 2 (build + impacted tests) / 3 (build + tests + manual verify)
6. **PR merge is manual** — agents never auto-merge, only notify
7. **Issue/PR numbers rendered as full clickable URLs** in all output
8. **Status log is per-task JSONL** — written by agents for dashboard consumption only. Commands/agents get status from GitHub remote (`gh` CLI), not local logs
9. **Workspace and config separation** — `~/.claude/` stores config (commands/agents/skills), runtime data (logs, task status) lives in workspace directory (configured in `pilot.yaml`)
10. **Git worktree concurrency** — each issue gets a worktree (`<workspace>/worktrees/issue-<N>/`), multiple issues can run in parallel without interference

## Architecture Diagram

```
You (Human)
  │
  ├── /pilot-dev-issue ──────→ Orchestrator (7 phases)
  │     ├── Phase 0: Branch setup
  │     ├── Phase 1: Issue analysis (gh issue view)
  │     ├── Phase 2: Code exploration (pilot-code-explorer agents × 2-3)
  │     ├── Phase 3: Plan + test strategy (user approval gate)
  │     ├── Phase 4: Implementation
  │     ├── Phase 5: Test & fix (test-runner skill)
  │     └── Phase 6: Commit & PR (pilot-pr-creator agent)
  │
  ├── /pilot-watch-pr ───────→ PR monitor (5-min polling)
  │     ├── Auto-fix CI failures
  │     ├── Notify Dashboard (review comments / ready to merge)
  │     └── Clean up merged worktrees
  │
  └── Dashboard ─────────────→ Web UI (localhost:3000)
        ├── Issues, PRs, Tasks, Actions tabs
        ├── Skills & Agents browser
        └── Report generation

Data:
  <workspace>/logs/<task_id>.jsonl  ← per-task status events
  <workspace>/logs/summary.jsonl   ← cross-task summary events
  ~/.claude/skills/*/SKILL.md      ← knowledge grows over time
```

## File Inventory

```
~/.claude/
├── pilot.yaml                         # Unified configuration
├── CLAUDE.md                          # Global instructions
├── settings.json                      # Settings + permissions
├── agents/
│   ├── pilot-code-explorer.md          # Codebase analysis
│   ├── pilot-pr-creator.md             # Git & PR operations
│   └── pilot-pr-reviewer.md            # Structured code review
├── commands/
│   ├── pilot-dev-issue.md              # Core orchestrator
│   └── pilot-watch-pr.md              # PR monitor daemon
└── skills/
    └── <your-skill>/SKILL.md       # Custom skills (optional)

<workspace>/                           # Configured in pilot.yaml
├── <repo-name>/                       # Base repo clone
├── worktrees/                         # Per-issue git worktrees
│   ├── issue-5113/
│   ├── issue-5121/
│   └── ...
└── logs/
    ├── issue-<N>.jsonl                # Per-task status log
    ├── adhoc-<date>.jsonl             # Adhoc task status log
    └── summary.jsonl                  # Cross-task summaries
```

## Known Limitations

- **GitHub only** — all issue/PR workflows assume GitHub. Azure DevOps, GitLab, Bitbucket are not supported.

## Roadmap

### Validate & Stabilize
- [ ] Run `/pilot-dev-issue` on a real issue end-to-end, fix any rough edges
- [ ] Validate status log writes correctly across all phases

### Automation Improvements
- [ ] Manual test (strategy 3) → automate via Playwright E2E tests
- [ ] Smarter impacted test detection — trace import graph, not just co-located `.test.ts`
- [ ] Auto-label issues based on AI analysis (area, priority)
- [ ] Automated testing for framework commands and dashboard
- [ ] Auto-manage Claude terminal sessions (lifecycle, restart on crash)

### Team Sharing
- [ ] Team sharing workflow for custom skills
- [ ] Onboarding guide for teammates
- [ ] Shared skill library with version control
