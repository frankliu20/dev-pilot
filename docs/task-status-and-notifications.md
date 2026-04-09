# Task Status & Notification System

How the dashboard tracks what Claude Code sessions are doing, detects when they need human input, and recovers from crashes.

## Overview

The system uses **append-only JSONL log files** as the single source of truth for task state. Each issue gets its own log file (`logs/issue-<N>.jsonl`). The dashboard watches these files via `fs.watch()` and pushes updates to the browser over SSE.

There is **no database, no message queue, no websocket connection** between the Claude Code session and the dashboard. Communication is entirely through the filesystem.

```
Claude Code session                    Dashboard (Next.js)
       │                                      │
       │  append to JSONL                     │  fs.watch() on logs/
       ├──────────────────► issue-123.jsonl ──►├──► deriveTasks()
       │                                      │    readPendingDecisions()
       │  write JSON file                     │         │
       ├──────────────────► pending-decisions/ │         │  SSE push
       │                    (optional)         │         ▼
       │                                      │    Browser (React)
       │  ◄── no back-channel ──────────────  │
```

## Data Model

### JSONL Log Events (`logs/issue-<N>.jsonl`)

Each line is a JSON object representing a phase transition:

```json
{
  "timestamp": "2026-04-09T10:30:00Z",
  "task_id": "issue-123",
  "type": "task_start",
  "phase": "branch_setup",
  "branch": "fix/issue-123",
  "pr_number": null,
  "status": "started",
  "detail": "Branch created, worktree ready"
}
```

#### Event Types → Task Phases

| Event Type | Derived Phase | Meaning |
|------------|---------------|---------|
| `task_start` | `planned` | Worktree created, ready to analyze |
| `analysis_done` | `exploring` | Issue understood, exploring codebase |
| `exploration_done` | `planning` | Codebase explored, writing plan |
| `plan_approved` | `implementing` | User approved plan, coding |
| `implementation_done` | `testing` | Code written, running tests |
| `test_pass` | `creating_pr` | Tests passed, creating PR |
| `test_fail` | `test_failed` | Tests failed (auto-fix up to 3 rounds) |
| `manual_verify_waiting` | `waiting_manual_test` | Waiting for manual verification |
| `pr_created` | `done` | PR opened — terminal state |
| `blocked` | `failed` | Stuck, needs human help — terminal state |
| `decision_requested` | *(no change)* | Waiting for user input (does not alter phase) |
| `decision_dismissed` | *(no change)* | User dismissed from dashboard (does not alter phase) |

### Decision Notifications

When a Claude Code session pauses for user input, the dashboard needs to show an alert in the **Actions** tab. Decisions come from **two sources**, merged and deduplicated by `taskId`:

#### Source 1: JSONL `decision_requested` events (primary)

Written by the Claude Code session as part of the normal JSONL log. The dashboard reads these directly — no separate file needed.

```json
{"timestamp":"...","task_id":"issue-123","type":"decision_requested","phase":"phase-0","detail":"Existing PR #456 found. How to proceed?"}
```

A decision is considered **resolved** when the task has a newer non-decision event (meaning the user responded in the terminal and the agent moved on).

#### Source 2: JSON files in `pending-decisions/` (supplementary)

Written by `pilot-watch-pr` for PR notifications and optionally by `pilot-dev-issue` for richer decision metadata (question text, options, context).

```json
{
  "taskId": "issue-123",
  "issueNumber": 123,
  "phase": "planning",
  "question": "How should we verify the changes?",
  "options": ["Build only", "Build + Tests", "Build + Tests + Manual"],
  "context": "3 files to change, medium complexity",
  "timestamp": "2026-04-09T10:35:00Z"
}
```

Auto-cleaned when the task progresses past the decision timestamp.

#### Why Two Sources?

Originally the system relied only on JSON files, but Claude Code sessions often forgot to write them (the instruction is in the prompt, but LLM compliance is imperfect). The JSONL fallback was added so that any `decision_requested` event in the log automatically appears in the Actions tab — even without the JSON file.

JSON files are still useful for:
- PR notifications from `pilot-watch-pr` (no JSONL counterpart)
- Richer metadata (options, context) that doesn't fit the JSONL schema

### Worker Registry (`registry.ts`)

An **in-memory** singleton that tracks which Claude Code terminals are running. It exists solely to prevent duplicate launches (HTTP 409 on re-assign).

Key behaviors:
- **Not persisted** — cleared on dashboard restart
- **Phase-based liveness** — refreshes by reading JSONL logs; if the last phase-changing event is terminal (`done`/`failed`), marks the worker as `completed`
- **No PID tracking** — on Windows, `wt.exe` is a launcher that exits immediately, so PID is useless
- **Force override** — `force: true` bypasses the running check

## Real-Time Updates (SSE)

The dashboard's `/api/stream` endpoint uses two `fs.watch()` instances:

1. **Log watcher** — watches `logs/*.jsonl` for task state changes
2. **Decision watcher** — watches `logs/pending-decisions/*.json` for PR notifications

Both watchers are **debounced (300ms)** to avoid callback storms during bulk operations (e.g., Clean All deleting many files at once).

When either fires, the server re-reads all logs, re-derives task states + decisions, and pushes them over SSE. The browser receives the full state snapshot each time (not incremental diffs).

## Cleanup & Recovery

### Per-Issue Clean (log only)

```
POST /api/cleanup { issueNumber: 123, logOnly: true }
```

Deletes only `logs/issue-123.jsonl`. The task disappears from the Tasks tab. Worktree is preserved so a re-run can pick up existing code.

### Per-Issue Clean (full)

```
POST /api/cleanup { issueNumber: 123 }
```

Deletes the JSONL log **and** removes the git worktree (`worktrees/issue-123/`).

### Global Clean All

```
POST /api/cleanup { cleanLogs: true, cleanWorktrees: true }
```

1. Deletes all `.jsonl` files in `logs/`
2. Cleans files inside `pending-decisions/` but **preserves the directory itself** (to keep `fs.watch()` alive)
3. Removes all git worktrees (async, `git worktree remove --force`)
4. Pulls latest main on all repos (after 8s delay for worktree cleanup)

### Task Cancel

```
DELETE /api/tasks/issue-123
```

Finds Claude Code processes by matching the issue number in the command line (`wmic` on Windows, `pkill -f` on Unix), kills them, and marks the worker as `cancelled`.

### Orphaned Task Recovery

If a Claude Code session is killed without writing a terminal event:

| Action | Where | What it does |
|--------|-------|-------------|
| **Force Re-run** | Issues tab | Passes `force: true` to bypass "already running" check, spawns a new terminal |
| **Clean** | Tasks tab | Deletes the log file (log-only), task disappears, re-assign is unblocked |
| **Clean (broom icon)** | Issues tab | Deletes log + worktree, full reset |

## Pros and Cons

### Pros

| Aspect | Details |
|--------|---------|
| **Simple & debuggable** | Everything is in plain-text files — `cat logs/issue-123.jsonl` shows the full history. No database to query, no message broker to inspect. |
| **Crash-resilient logging** | JSONL is append-only. A crash mid-write loses at most one line. All previous events survive. |
| **Zero coupling** | Claude Code sessions have no dependency on the dashboard. They work the same whether the dashboard is running or not. |
| **Cross-platform** | `fs.watch()` works on Windows, macOS, and Linux. No platform-specific IPC. |
| **Parallel-safe** | Each task writes to its own file (`issue-123.jsonl`), so concurrent sessions never conflict. |
| **Easy to extend** | Adding a new phase = add one event type to the JSONL schema + one case in `eventToPhase()`. |

### Cons

| Aspect | Details |
|--------|---------|
| **No heartbeat** | If a Claude Code session is killed, the dashboard cannot detect it. The task stays "running" until someone clicks Force Re-run or Clean. A heartbeat event (e.g., every 5 min) would allow automatic stale detection. |
| **Full re-read on every change** | `deriveTasks()` reads **all** JSONL files on every `fs.watch()` event. Fine for <50 tasks, but will degrade with hundreds. An incremental approach (cache + only re-read changed files) would scale better. |
| **In-memory registry is ephemeral** | Dashboard restart clears the worker registry. If the dashboard restarts while tasks are running, it loses the "running" state until the next JSONL event comes in. (The JSONL-based phase refresh partially compensates.) |
| **Dual decision sources** | Having both JSON files and JSONL events for decisions adds complexity. The JSON files exist because PR notifications don't have a JSONL counterpart, and because they carry richer metadata (options, context) than the flat JSONL schema supports. |
| **One-way communication** | The dashboard cannot send commands back to a running Claude Code session. Cancel works by killing the process — there's no graceful "please wrap up" signal. |
| **`fs.watch()` quirks** | Node's `fs.watch()` is [notoriously inconsistent](https://nodejs.org/api/fs.html#caveats) across platforms. The debounce mitigates duplicate events, but edge cases may still exist (e.g., network drives, Docker volumes). |
| **No automatic retry** | A crashed session stays crashed. The user must manually Force Re-run. An auto-retry mechanism (detect stale → re-launch) is on the roadmap but not yet implemented. |

### Potential Improvements (Roadmap)

1. **Heartbeat events** — Claude Code writes a `heartbeat` event every 5 min; dashboard marks tasks as `stale` after 15 min of silence
2. **Incremental log reading** — Cache parsed tasks, only re-read files whose mtime changed
3. **Unified decision schema** — Extend JSONL to carry `options`/`context` fields, fully retire JSON files
4. **Graceful shutdown** — Write a "please stop" sentinel file that Claude Code checks between phases
5. **Auto-retry** — Dashboard detects stale tasks and automatically re-launches them
