# Dashboard Comprehensive Test Plan

## Project Overview

| Item | Detail |
|---|---|
| **App** | Dev Pilot Dashboard — Next.js 16 + React 19 + TypeScript |
| **Current Test Coverage** | **0%** — no tests, no test runner configured |
| **Codebase Size** | ~50 source files, ~4,500 lines of TypeScript |
| **Data Sources** | GitHub (via `gh` CLI), Local filesystem (JSONL logs), Azure App Insights (optional) |
| **State Management** | React built-in state, SSE for real-time updates, HTTP polling for GitHub data |

---

## 1. Test Infrastructure Setup

### 1.1 Dependencies to Install

```bash
npm install -D vitest @testing-library/react @testing-library/jest-dom @testing-library/user-event \
  @vitejs/plugin-react jsdom msw
```

| Package | Purpose |
|---|---|
| `vitest` | Test runner (fast, Vite-native, ESM-first) |
| `@testing-library/react` | Component rendering & queries |
| `@testing-library/jest-dom` | DOM assertion matchers (`toBeInTheDocument`, etc.) |
| `@testing-library/user-event` | Realistic user interaction simulation |
| `@vitejs/plugin-react` | JSX transform for Vitest |
| `jsdom` | Browser DOM environment for unit tests |
| `msw` | Mock Service Worker for API route testing |

### 1.2 Configuration Files

- `dashboard/vitest.config.ts` — Vitest config with jsdom environment, path aliases, setup files
- `dashboard/vitest.setup.ts` — Global setup (`@testing-library/jest-dom`, MSW server, mock `localStorage`/`EventSource`)
- `dashboard/__tests__/` — Test directory structure mirroring `lib/`, `app/hooks/`, `app/components/`, `app/api/`

### 1.3 NPM Scripts

```json
{
  "test": "vitest",
  "test:run": "vitest run",
  "test:coverage": "vitest run --coverage",
  "test:ui": "vitest --ui"
}
```

---

## 2. Test Layers & Priority

| Priority | Layer | Scope | Count | Rationale |
|---|---|---|---|---|
| **P0** | Unit — `lib/` | Pure logic, utilities, data transforms | ~120 cases | Zero dependencies, highest ROI, catches regressions fast |
| **P1** | Unit — Hooks | Custom React hooks | ~50 cases | Core data flow; SSE and polling are critical |
| **P2** | Unit — API Routes | Next.js route handlers | ~80 cases | Server-side logic, error handling, input validation |
| **P3** | Component — UI primitives | `components/ui/` | ~40 cases | Reusable atoms, visual states, accessibility |
| **P4** | Component — Tab pages | Feature tabs | ~60 cases | User-facing interactions, integration with hooks |
| **P5** | Integration | Cross-module flows | ~20 cases | End-to-end data pipelines |

**Total estimated: ~370 test cases**

---

## 3. P0 — Unit Tests: Library Layer (`lib/`)

### 3.1 `lib/utils.ts` (~25 cases)

| Function | Test Cases |
|---|---|
| **`timeAgo`** | "just now" for <60s; "Xm ago" at 60s/61s/3599s; "Xh ago" at 3600s/86399s; "Xd ago" at 86400s+; future timestamp; `null`/`undefined`/`""`; invalid date string → "Invalid Date" behavior |
| **`formatDate`** | Valid date; epoch 0; invalid string |
| **`formatTime`** | Valid timestamp; edge: midnight, noon |
| **`formatDuration`** | 0ms → "0s"; 999ms → "0s"; 1000ms → "1s"; 59999ms → "59s"; 60000ms → "1m 0s"; 3600000ms → "1h 0m"; mixed values; negative input |
| **`truncate`** | String shorter than max → no truncation; exact length → no truncation; longer → truncated with `…`; `maxLength=0`; `maxLength=1`; empty string |
| **`debounce`** | Calls only after delay; resets timer on rapid calls; correct `this` and args forwarded (use `vi.useFakeTimers`) |
| **`cn`** | Multiple classes joined; falsy values (`false`, `null`, `undefined`, `""`, `0`) filtered; single class; empty call |
| **`githubToTeamsEmail`** | `"haozhan_microsoft"` → `"haozhan@microsoft.com"`; username without `_microsoft` suffix; empty string |
| **`buildTeamsPingUrl`** | Returns valid MS Teams URL; special characters in email/PR title are encoded |

### 3.2 `lib/config.ts` (~15 cases)

> **Mocks required**: `fs`, `os.homedir`, `process.env`, `js-yaml`

| Scenario | Test Cases |
|---|---|
| **YAML present & valid** | Parses all fields; `workspace` tilde expansion (`~/foo` → `/home/user/foo`); repos array populated |
| **YAML missing** | Falls back to `process.env.PILOT_WORKSPACE`; falls back to `~/claude/workspace` if env also missing |
| **YAML malformed** | Parse error caught; falls back to defaults; console.error logged |
| **Singleton caching** | Second call returns cached config (no re-read); verify `readFileSync` called only once |
| **`getRepo()`** | Returns first repo; returns `""` when repos is empty |
| **`getReviewRepos()`** | Returns all repos from config |
| **`getAiPlatform()`** | Returns correct platform string from config |
| **`getDefaults()`** | Returns defaults; returns empty/default when config has no `defaults` key |

### 3.3 `lib/constants.ts` (~10 cases)

| Scenario | Test Cases |
|---|---|
| **PHASE_CONFIG completeness** | Every `TaskPhase` value has a corresponding entry |
| **Set disjointness** | `ACTIVE_PHASES ∩ TERMINAL_PHASES === ∅` |
| **Set coverage** | `ACTIVE_PHASES ∪ TERMINAL_PHASES` covers all 12 `TaskPhase` values |
| **PHASE_PIPELINE** | All entries are valid `TaskPhase` values; ordered correctly (happy path only) |
| **PR_ACTION_CONFIG** | Every `PRAction` type has a corresponding entry; all entries have `icon`, `label`, `variant` |

### 3.4 `lib/statusLog.ts` (~25 cases)

> **Mocks required**: `fs`, `config.getWorkspace()`

#### `readAllEntries()`

| Scenario | Expected |
|---|---|
| Empty log directory | Returns `[]` |
| Missing log directory | Returns `[]` |
| Single `.jsonl` file, all valid lines | Returns all parsed entries |
| Multiple `.jsonl` files | Returns combined entries from all files |
| File with blank lines interspersed | Blank lines skipped |
| File with malformed JSON lines | Malformed lines silently skipped; valid lines returned |
| File with 100% malformed lines | Returns `[]` |
| Non-`.jsonl` files in directory | Ignored |

#### `eventToPhase()` (test indirectly via `deriveTasks`)

| Scenario | Expected |
|---|---|
| Each of 14 known event types | Maps to correct `TaskPhase` |
| Unknown event type | Defaults to `'planned'` |

#### `deriveTasks()`

| Scenario | Expected |
|---|---|
| Single task, single event | Task created with correct phase, timestamps |
| Single task, multiple events chronologically | Phase = last event's phase |
| Multiple tasks | Correctly grouped by `task_id` |
| Phase override from `entry.phase` field | `phase` field overrides `eventToPhase` result via `phaseMap` |
| Hard override: `pr_created` event | Always → `'pr_review'` phase |
| Hard override: `test_fail` event | Always → `'test_failed'` phase |
| Hard override: `blocked` event | Always → `'waiting_confirm'` phase |
| Hard override: `manual_verify_waiting` event | Always → `'waiting_manual_test'` phase |
| `pr_monitor` in phaseMap | Keeps existing computed phase (no-op) |
| `taskId` format `issue-123` | `issueNumber` extracted as `123` |
| `taskId` format `pr-456` or `custom-task` | `issueNumber` is `undefined` |
| Sort order | Newest `lastUpdate` first |

#### `watchStatusLog()`

| Scenario | Expected |
|---|---|
| File change in log dir (`.jsonl`) | Callback invoked |
| Non-`.jsonl` file change | Callback NOT invoked |
| Returns cleanup function | Calling it closes the watcher |
| Missing log directory | Throws or handles gracefully (document current behavior) |

### 3.5 `lib/decisions.ts` (~20 cases)

> **Mocks required**: `fs`, `statusLog.deriveTasks()`, `config.getWorkspace()`

#### `readPendingDecisions()`

| Scenario | Expected |
|---|---|
| Empty directory | Returns `[]` |
| Missing directory | Returns `[]` |
| Single valid decision file | Returns 1 decision |
| Multiple decision files | Returns all, sorted newest-first |
| Malformed JSON file | Silently skipped |
| **Stale decision** (task updated after decision) | Auto-deleted from disk; excluded from result |
| **Fresh decision** (decision newer than task) | Kept and returned |
| Decision with no `timestamp` | Auto-dismissed (string comparison `"2026..." > ""` = true) |
| Decision for task not found in logs | Kept (no auto-dismiss) |
| `unlinkSync` throws (permission error) | Caught silently; decision excluded |

#### `dismissDecision(taskId)`

| Scenario | Expected |
|---|---|
| Matching `taskId` found | File deleted; returns `true` |
| No match | Returns `false` |
| Malformed file among valid files | Skipped; continues searching |
| Missing directory | Throws (current behavior — document this) |

#### `watchDecisions()`

| Scenario | Expected |
|---|---|
| Directory exists | Watcher created |
| Directory does not exist | Created with `mkdirSync`; watcher created |
| File change in directory | Callback invoked |
| Returns cleanup function | Calling it closes the watcher |

### 3.6 `lib/registry.ts` (~20 cases)

> **Mocks required**: `terminal.openClaudeTerminal`, `statusLog.deriveTasks`, `child_process.execSync`

#### `registry.assign()`

| Scenario | Expected |
|---|---|
| New task, terminal spawns OK | `result: 'started'`; entry added to registry |
| Task already running, `force=false` | `result: 'already_running'` |
| Task already running, `force=true` | Overwrites; `result: 'started'` |
| Terminal spawn throws | `result: 'started'` with `error` field (document this confusing behavior) |
| Calls `refreshFromLogs()` before checking | Verify stale status updated first |

#### `registry.cancel()`

| Scenario | Expected |
|---|---|
| Task found & running (Windows path) | `wmic` + `taskkill` executed; status → `'cancelled'` |
| Task found & running (Unix path) | `pkill -f` executed; status → `'cancelled'` |
| Kill command fails | Still marks `'cancelled'` (optimistic); returns `true` |
| Task not found | Returns `false` or handles gracefully |
| Task exists but not running | No kill attempted; status updated |

#### `registry.refreshFromLogs()`

| Scenario | Expected |
|---|---|
| Worker phase becomes `done`/`failed` | Worker status → `'completed'` |
| Worker phase is active | Worker status unchanged |
| `deriveTasks()` throws | Caught silently; workers unchanged |

#### `registry.getAll()` / `isRunning()`

| Scenario | Expected |
|---|---|
| After assign | Task visible in `getAll()` |
| After cancel | Task shows `'cancelled'` in `getAll()` |
| `isRunning` with active task | Returns `true` |
| `isRunning` with completed task | Returns `false` |

### 3.7 `lib/github.ts` (~30 cases)

> **Mocks required**: `child_process.exec`, `config.getRepo()`, `config.getReviewRepos()`

#### `classifyPRAction()` — Pure Logic, Highest Priority

| isDraft | CI Status | Review State | Unresolved | Expected Action |
|---|---|---|---|---|
| `true` | any | any | any | `'draft'` |
| `false` | all SUCCESS | `APPROVED` | 0 | `'ready_to_merge'` |
| `false` | any FAILURE | any | any | `'ci_failing'` |
| `false` | all SUCCESS | `CHANGES_REQUESTED` | any | `'changes_requested'` |
| `false` | all SUCCESS | `""` | >0 | `'has_unresolved_comments'` |
| `false` | all SUCCESS | `REVIEW_REQUIRED` | 0 | `'review_pending'` |
| `false` | all SUCCESS | `""` | 0 | `'review_pending'` |
| `false` | pending/empty | `""` | 0 | `'waiting'` |
| `false` | empty array | any | `undefined` | Correct handling of undefined unresolved count |

#### `fetchMyOpenIssues()`

| Scenario | Expected |
|---|---|
| Single repo, issues returned | Parsed and returned |
| Multiple repos | Results combined from all repos |
| One repo fails, others succeed | Failed repo returns `[]`; others still included |
| `gh` CLI timeout (>15s) | Returns `[]` for that repo |
| Empty result | Returns `[]` |

#### `fetchMyOpenPRs()` / `fetchReviewRequestedPRs()`

| Scenario | Expected |
|---|---|
| Normal response | Parsed with all fields including `statusCheckRollup` |
| Empty response | Returns `[]` |
| CLI error | Returns `[]` |

#### `fetchUnresolvedThreadCounts()`

| Scenario | Expected |
|---|---|
| PRs from single repo | GraphQL query built correctly; counts returned |
| PRs from multiple repos | Separate GraphQL queries per repo; results merged |
| PRs with no URL | Silently skipped |
| Empty PR list | Returns empty map |
| GraphQL error | Returns empty/partial counts |

#### `fetchIssueDetail()`

| Scenario | Expected |
|---|---|
| With `issueUrl` parameter | Uses repo from URL |
| Without `issueUrl` | Falls back to `getRepo()` |
| Issue not found | Returns `null` |

#### `fetchTodayCommits()`

| Scenario | Expected |
|---|---|
| Commits exist | Parsed correctly (hash + message) |
| No commits today | Returns `[]` |
| Git command fails | Returns `[]` |
| Commit with empty message | `message` is empty string |

### 3.8 `lib/types.ts` (~5 cases)

| Scenario | Expected |
|---|---|
| `REVIEW_REPOS` with valid JSON env var | Parsed array |
| `REVIEW_REPOS` with malformed JSON | Falls back to `[]` |
| `REVIEW_REPOS` with missing env var | Falls back to `[]` |
| `CLI_TOOL_CONFIG.claude.args()` | Returns correct command with quoted prompt |
| `CLI_TOOL_CONFIG.copilot.args()` | Returns correct command with `-i` flag |

---

## 4. P1 — Unit Tests: Custom Hooks (~50 cases)

> **Environment**: jsdom, mock `EventSource`, mock `fetch`, `vi.useFakeTimers()`

### 4.1 `useTaskStream` (~15 cases)

| Category | Test Cases |
|---|---|
| **Connection** | Creates EventSource to `/api/stream`; sets `connected=true` on open |
| **Data reception** | `'tasks'` event → `tasks` state updated; `'decisions'` event → `decisions` state updated |
| **Missing fields** | `data.tasks` is undefined → falls back to `[]` |
| **Reconnection** | On error: closes EventSource, sets `connected=false`, reconnects after 3s |
| **No connection leak** | `esRef.current.close()` called before each reconnect |
| **Cleanup** | On unmount: EventSource closed, no reconnect timer fires |
| **Malformed SSE data** | `JSON.parse` throws → currently crashes (document this bug) |
| **Multiple rapid errors** | Verify single reconnect, not multiple |

### 4.2 `useGitHubData` (~15 cases)

| Category | Test Cases |
|---|---|
| **Initial fetch** | `loading=true` initially; becomes `false` after fetch; `data` populated |
| **Fetch failure** | `loading=false`; `data` remains `null`; error logged |
| **Polling** | `setInterval` with correct interval; new fetch on each tick |
| **Default interval** | 30 seconds when not specified |
| **URL change** | Old interval cleared; new fetch triggered |
| **Unmount cleanup** | `clearInterval` called |
| **`refresh()` function** | Triggers immediate re-fetch |
| **`loading` semantics** | Only `true` on initial load; stays `false` on subsequent polls |
| **Concurrent fetches** | No race condition — latest fetch wins |

### 4.3 `useTheme` (~12 cases)

| Category | Test Cases |
|---|---|
| **Default** | Initial state is `'dark'` before hydration |
| **localStorage present** | Reads `'dark'` or `'light'` and applies |
| **localStorage absent** | Falls back to `matchMedia` preference |
| **Invalid localStorage** | Value like `"blue"` — behavior documented |
| **`setTheme`** | Updates state; sets `data-theme` on `<html>`; persists to `localStorage` |
| **`toggleTheme`** | `dark` → `light`; `light` → `dark` |
| **Private browsing** | `localStorage` throws → graceful fallback to `'dark'` |
| **SSR safety** | No `window`/`document` access on server |

### 4.4 `useKeyboardShortcuts` (~10 cases)

| Category | Test Cases |
|---|---|
| **Single key** | `'k'` → handler called |
| **Ctrl+key** | `Ctrl+k` → handler called; `Cmd+k` also maps to `Ctrl+k` |
| **Shift+key** | `Shift+k` → handler called |
| **Ctrl+Shift+key** | `Ctrl+Shift+k` → handler called |
| **Input suppression** | Shortcut NOT fired when focus is on `<input>`, `<textarea>`, `<select>`, `contentEditable` |
| **`enabled=false`** | All shortcuts disabled |
| **Case insensitivity** | `"Ctrl+K"` matches handler registered as `"ctrl+k"` |
| **`preventDefault`** | Called when handler exists; NOT called when no match |
| **Unmatched key** | No handler called; no error |

---

## 5. P2 — Unit Tests: API Routes (~80 cases)

> **Strategy**: Test route handlers as functions. Mock `lib/` dependencies. Use `NextRequest`/`NextResponse` from `next/server`.

### 5.1 `GET /api/issues` (~8 cases)

| Scenario | Expected |
|---|---|
| Normal fetch | Returns issues JSON with 200 |
| With `?number=X` param | Returns single issue detail |
| GitHub CLI failure | Returns 500 with error message |
| Empty result | Returns `[]` with 200 |

### 5.2 `GET /api/prs` (~8 cases)

| Scenario | Expected |
|---|---|
| Normal fetch | Returns PRs with unresolved counts merged |
| Review-requested PRs | Separate array in response |
| GraphQL failure (unresolved counts) | PRs returned without counts (graceful degradation) |
| Empty result | Returns empty arrays with 200 |

### 5.3 `GET /api/stream` (SSE) (~10 cases)

| Scenario | Expected |
|---|---|
| Connection established | Returns `ReadableStream` with `text/event-stream` content type |
| Initial payload | Sends `tasks` + `decisions` events immediately |
| File change triggers event | New `tasks` data pushed to stream |
| Heartbeat | Sent every 30 seconds |
| Client disconnect | `fs.watch` listeners cleaned up |
| `deriveTasks` throws | Error event sent or graceful skip |

### 5.4 `GET /api/tasks` (~6 cases)

| Scenario | Expected |
|---|---|
| Tasks exist | Returns derived tasks with 200 |
| No log directory | Returns `[]` with 200 |
| `deriveTasks` throws | Returns 500 |

### 5.5 `POST /api/tasks/assign` (~10 cases)

| Scenario | Expected |
|---|---|
| Valid request body | Calls `registry.assign()`; returns task info |
| Missing `issueUrl` | Returns 400 |
| Task already running (`force=false`) | Returns 409 with `'already_running'` |
| Task already running (`force=true`) | Returns 200 with `'started'` |
| Terminal spawn failure | Returns 200 with `error` field |
| Invalid `cliTool` value | Handled gracefully |

### 5.6 `DELETE /api/tasks/[taskId]` (~6 cases)

| Scenario | Expected |
|---|---|
| Valid taskId, task running | Calls `registry.cancel()`; returns success |
| Task not found | Returns 404 |
| Kill command fails | Returns success (optimistic) |

### 5.7 `GET /api/tasks/registry` (~4 cases)

| Scenario | Expected |
|---|---|
| Workers exist | Returns all worker entries |
| No workers | Returns empty object/array |

### 5.8 `POST /api/tasks/fix-comments` (~5 cases)

| Scenario | Expected |
|---|---|
| Valid PR URL | Spawns terminal with fix-comments prompt |
| Missing PR URL | Returns 400 |
| Terminal spawn failure | Returns error |

### 5.9 `POST /api/tasks/review-pr` (~6 cases)

| Scenario | Expected |
|---|---|
| Valid request with review config | Builds correct prompt with strategy/level |
| Default review config | Uses `DEFAULT_REVIEW_CONFIGS` |
| Missing PR URL | Returns 400 |

### 5.10 `POST /api/tasks/run-command` (~4 cases)

| Scenario | Expected |
|---|---|
| Valid command | Spawns terminal with command |
| Empty command | Returns 400 |

### 5.11 `DELETE /api/decisions` (~5 cases)

| Scenario | Expected |
|---|---|
| Valid `taskId` param | Calls `dismissDecision()`; returns success |
| Missing `taskId` | Returns 400 |
| Decision not found | Returns 404 |

### 5.12 `POST /api/cleanup` (~6 cases)

| Scenario | Expected |
|---|---|
| Global cleanup | Deletes logs, removes worktrees, pulls main |
| Per-issue cleanup (`issueNumber`) | Cleans only that issue's logs/worktree |
| Cleanup command fails | Returns error with details |

### 5.13 `GET /api/skills` (~4 cases)

| Scenario | Expected |
|---|---|
| Skills/agents/commands exist | Returns categorized list |
| `~/.claude/` dirs missing | Returns empty arrays |

### 5.14 `GET /api/report` (~5 cases)

| Scenario | Expected |
|---|---|
| Commits, PRs, issues exist | Returns aggregated report data |
| No activity today | Returns empty arrays |
| Git/GitHub command failure | Returns partial data with errors |

### 5.15 `GET/POST/PATCH /api/scrum` (~8 cases)

| Scenario | Expected |
|---|---|
| `GET` — existing scrum data | Returns scrum items + mark timestamp |
| `POST` — post to GitHub | Posts comments to relevant issues |
| `PATCH` — mark scrum time | Writes timestamp to scrum-mark.json |
| Post to issue fails | Returns partial success with error details |

### 5.16 `GET /api/traces` (~4 cases)

| Scenario | Expected |
|---|---|
| Valid query params | Calls Azure ARM API; returns traces |
| Missing auth token (`az` CLI) | Returns 401/500 |
| Azure API error | Returns error message |

---

## 6. P3 — Component Tests: UI Primitives (~40 cases)

> **Environment**: jsdom + React Testing Library

### 6.1 `Badge` (~5 cases)

| Scenario | Expected |
|---|---|
| Each variant (`success`, `danger`, `warning`, `info`, `neutral`) | Correct CSS class applied |
| Custom className | Merged with variant class |
| Children rendered | Text content visible |

### 6.2 `Button` (~8 cases)

| Scenario | Expected |
|---|---|
| Each variant (`primary`, `secondary`, `ghost`, `danger`) | Correct styling |
| Click handler | `onClick` called |
| Disabled state | Click suppressed; `aria-disabled` or `disabled` attribute |
| Loading state | Spinner shown; click suppressed |
| With icon | Icon rendered alongside text |

### 6.3 `Icon` (~3 cases)

| Scenario | Expected |
|---|---|
| Known icon name | Correct SVG rendered |
| Custom size | Size attribute applied |
| Accessibility | `aria-hidden="true"` for decorative icons |

### 6.4 `Skeleton` (~3 cases)

| Scenario | Expected |
|---|---|
| Default render | Animated placeholder visible |
| Custom width/height | Dimensions applied |

### 6.5 `EmptyState` (~3 cases)

| Scenario | Expected |
|---|---|
| With icon + message | Both rendered |
| With action button | Button rendered and clickable |

### 6.6 `Toast` + `ToastProvider` (~6 cases)

| Scenario | Expected |
|---|---|
| Show toast | Toast appears with message |
| Auto-dismiss | Toast disappears after timeout |
| Multiple toasts | Stacked correctly |
| Toast variants (`success`, `error`, `info`) | Correct styling |
| Manual dismiss | Close button removes toast |

### 6.7 `ConfirmDialog` (~5 cases)

| Scenario | Expected |
|---|---|
| Open state | Dialog visible with title + message |
| Confirm click | `onConfirm` called; dialog closes |
| Cancel click | `onCancel` called; dialog closes |
| Escape key | Dialog closes |
| Backdrop click | Dialog closes (if implemented) |

### 6.8 `StatusDot` (~3 cases)

| Scenario | Expected |
|---|---|
| Pulsing state | Animation class applied |
| Color variants | Correct color for each status |

### 6.9 `Tooltip` (~2 cases)

| Scenario | Expected |
|---|---|
| Hover trigger | Tooltip content shown |
| Mouse leave | Tooltip hidden |

### 6.10 `Select` (~4 cases)

| Scenario | Expected |
|---|---|
| Options rendered | All options visible on open |
| Selection | `onChange` fired with selected value |
| Default value | Pre-selected option shown |
| Disabled state | Interaction suppressed |

---

## 7. P4 — Component Tests: Feature Tabs (~60 cases)

> **Strategy**: Mock hooks (`useTaskStream`, `useGitHubData`), test rendering + user interactions.

### 7.1 `IssuesTab` (~12 cases)

| Category | Test Cases |
|---|---|
| **Rendering** | Shows issue table; loading skeleton when data loading; empty state when no issues |
| **Search** | Filters issues by title/number; debounced input |
| **Sort** | Sort by created date, updated date, number |
| **Expand** | Click row → shows issue body (markdown rendered) |
| **Assign** | Click "Assign" → calls `/api/tasks/assign`; shows toast on success/failure |
| **Re-run** | Available for tasks in terminal state |
| **Clean** | Click "Clean" → calls `/api/cleanup` with issue number |
| **Task status badge** | Shows current phase badge for issues with active tasks |

### 7.2 `IssuePanel` (~8 cases)

| Category | Test Cases |
|---|---|
| **Open/Close** | Slides in when issue selected; closes on back/escape |
| **Breadcrumb** | Shows `Issues > #123` |
| **Detail content** | Issue body rendered as markdown |
| **Task timeline** | Shows activity events chronologically |
| **Actions** | Assign, re-run, clean available with correct states |

### 7.3 `PullRequestsTab` (~12 cases)

| Category | Test Cases |
|---|---|
| **My PRs** | Card view with status badges; action buttons per PR action type |
| **Review Requested** | Table view with PR details; unresolved thread count shown |
| **Expand** | Click → shows PR body |
| **Fix Comments** | Button visible for PRs with unresolved threads; calls API |
| **Review** | Opens review with strategy/level options; calls API |
| **Teams Ping** | Generates correct MS Teams deep link |
| **Filter** | Filter by action type (ready to merge, CI failing, etc.) |
| **Empty state** | "No open PRs" message |

### 7.4 `TasksTab` (~10 cases)

| Category | Test Cases |
|---|---|
| **Pipeline view** | Progress bar showing phases; current phase highlighted |
| **Task list** | Active + completed tasks listed |
| **Running timer** | Shows elapsed time for running tasks (1s interval) |
| **Cancel** | Confirm dialog → calls DELETE API; updates UI |
| **Event log** | Expandable timeline of all events for a task |
| **Registry status** | Shows worker process status from `/api/tasks/registry` |
| **Empty state** | "No tasks" message |

### 7.5 `ActionsTab` (~8 cases)

| Category | Test Cases |
|---|---|
| **Decision cards** | Shows pending decisions with context |
| **Dismiss** | Click dismiss → calls DELETE `/api/decisions`; card removed |
| **Fix Comments action** | Calls fix-comments API |
| **Review action** | Calls review-pr API |
| **Empty state** | "No pending actions" message |
| **Real-time updates** | New decisions appear via SSE |

### 7.6 `ReportTab` (~8 cases)

| Category | Test Cases |
|---|---|
| **Generate report** | Click → calls `/api/report`; shows commits, PRs, issues |
| **Empty report** | "No activity today" message |
| **Scrum view** | Done/Ongoing/Blocker sections |
| **Post to GitHub** | Calls `/api/scrum` POST; shows success/error |
| **Mark scrum** | Updates timestamp |

### 7.7 `SkillsTab` (~5 cases)

| Category | Test Cases |
|---|---|
| **Browse** | Lists skills, agents, commands in categories |
| **Filter** | Search by name |
| **Run command** | Click "Run" → calls `/api/tasks/run-command` |
| **Empty state** | "No skills installed" |

### 7.8 `OffWorkCelebration` (~3 cases)

| Category | Test Cases |
|---|---|
| **Trigger** | Button click → overlay appears |
| **Animation** | Emoji rain + message displayed |
| **Close** | Click/timer → overlay dismissed |

---

## 8. P5 — Integration Tests (~20 cases)

### 8.1 `statusLog` ↔ `decisions` Integration

| Scenario | Expected |
|---|---|
| Stale decision auto-cleanup | Decision with older timestamp than task's lastUpdate → auto-deleted |
| Task not in logs | Decision preserved (no auto-dismiss) |
| Log file updated after decision created | Re-read shows decision dismissed |

### 8.2 `registry` ↔ `statusLog` Integration

| Scenario | Expected |
|---|---|
| Task reaches `done` phase | Registry worker status → `'completed'` |
| Task reaches `failed` phase | Registry worker status → `'completed'` |
| Active phase | Registry worker status unchanged |

### 8.3 SSE ↔ Data Pipeline Integration

| Scenario | Expected |
|---|---|
| JSONL file written | SSE stream pushes updated tasks |
| Decision file created | SSE stream pushes updated decisions |
| Decision auto-dismissed | Decision removed from next SSE push |

### 8.4 Full Tab ↔ API ↔ Hook Integration

| Scenario | Expected |
|---|---|
| IssuesTab render → useGitHubData → /api/issues → github.ts | Full data flow verified |
| TasksTab render → useTaskStream → /api/stream → statusLog | Real-time update flow verified |
| Assign issue → /api/tasks/assign → registry → terminal | Assignment flow verified |
| Cancel task → DELETE /api/tasks/[id] → registry.cancel | Cancellation flow verified |

---

## 9. Edge Cases & Bug Documentation

These are known issues discovered during analysis that should be explicitly tested and documented:

| # | File | Issue | Test Approach |
|---|---|---|---|
| 1 | `useTaskStream` | `JSON.parse(e.data)` has no try/catch — malformed SSE data crashes the component | Write test that proves this; file bug |
| 2 | `registry.assign` | Returns `result: 'started'` even when terminal spawn fails (with `error` field) | Test both paths; document the confusing API |
| 3 | `registry.cancel` | Always marks `'cancelled'` even if kill fails | Test and document optimistic behavior |
| 4 | `statusLog.eventToPhase` | Unknown events default to `'planned'` | Test with garbage event type; consider if this masks bugs |
| 5 | `statusLog.watchStatusLog` | No guard for missing log directory (unlike `watchDecisions`) | Test and document inconsistency |
| 6 | `decisions.dismissDecision` | No guard for missing directory (`readdirSync` will throw) | Test and document |
| 7 | `useGitHubData` | No error state exposed to components | Test that errors are logged but not surfaced |
| 8 | `useGitHubData` | No abort controller — in-flight fetch on unmount triggers React warning | Test and document |
| 9 | `useTheme` | Invalid localStorage value (e.g., `"blue"`) accepted as valid theme | Test behavior |
| 10 | `github.runGH` | Returns `'[]'` on error — wrong for single-object endpoints | Test `fetchIssueDetail` when `gh` fails |
| 11 | `config.ts` | Singleton has no cache invalidation | Document; test that second call returns stale data |
| 12 | `types.ts CLI_TOOL_CONFIG` | Prompt with double quotes could break shell command | Test with `"prompt with \\"quotes\\""` |

---

## 10. Non-Functional Tests

### 10.1 Performance

| Test | Criteria |
|---|---|
| `deriveTasks` with 1000 JSONL entries | Completes in <100ms |
| `readAllEntries` with 100 log files | Completes in <500ms |
| Initial page render | No unnecessary re-renders (use React Profiler) |
| SSE reconnection | No memory leak from accumulated EventSource instances |

### 10.2 Accessibility (a11y)

| Test | Criteria |
|---|---|
| All interactive elements | Have accessible names (aria-label or visible text) |
| Keyboard navigation | Tab order is logical; all actions reachable via keyboard |
| Color contrast | Meets WCAG 2.1 AA for both dark and light themes |
| Screen reader | Tabs, dialogs, toasts announce correctly |

---

## 11. Implementation Roadmap

### Phase 1: Foundation (Week 1)
- [ ] Install test dependencies (vitest, RTL, msw)
- [ ] Configure vitest with jsdom, path aliases, setup files
- [ ] Create mock utilities (`mockFs`, `mockExec`, `mockConfig`)
- [ ] Write all `lib/utils.ts` tests (quick win, 100% coverage)
- [ ] Write all `lib/constants.ts` tests (quick win)

### Phase 2: Core Logic (Week 2)
- [ ] Write `lib/config.ts` tests
- [ ] Write `lib/statusLog.ts` tests (most complex)
- [ ] Write `lib/decisions.ts` tests
- [ ] Write `lib/github.ts` tests (`classifyPRAction` first)

### Phase 3: Server & Hooks (Week 3)
- [ ] Write `lib/registry.ts` tests
- [ ] Write all custom hook tests
- [ ] Write API route tests (start with `/api/tasks/assign`, `/api/stream`)

### Phase 4: Components (Week 4)
- [ ] Write UI primitive component tests
- [ ] Write feature tab component tests (IssuesTab, TasksTab first)
- [ ] Write integration tests

### Phase 5: Polish (Week 5)
- [ ] Edge case & bug documentation tests
- [ ] Performance benchmarks
- [ ] Accessibility audit
- [ ] Coverage report — target ≥80% line coverage

---

## 12. Test File Structure

```
dashboard/
├── __tests__/
│   ├── lib/
│   │   ├── utils.test.ts
│   │   ├── config.test.ts
│   │   ├── constants.test.ts
│   │   ├── statusLog.test.ts
│   │   ├── decisions.test.ts
│   │   ├── registry.test.ts
│   │   ├── github.test.ts
│   │   └── types.test.ts
│   ├── hooks/
│   │   ├── useTaskStream.test.ts
│   │   ├── useGitHubData.test.ts
│   │   ├── useTheme.test.ts
│   │   └── useKeyboardShortcuts.test.ts
│   ├── api/
│   │   ├── issues.test.ts
│   │   ├── prs.test.ts
│   │   ├── stream.test.ts
│   │   ├── tasks.test.ts
│   │   ├── tasks-assign.test.ts
│   │   ├── tasks-cancel.test.ts
│   │   ├── tasks-registry.test.ts
│   │   ├── tasks-fix-comments.test.ts
│   │   ├── tasks-review-pr.test.ts
│   │   ├── tasks-run-command.test.ts
│   │   ├── decisions.test.ts
│   │   ├── cleanup.test.ts
│   │   ├── skills.test.ts
│   │   ├── report.test.ts
│   │   ├── scrum.test.ts
│   │   └── traces.test.ts
│   ├── components/
│   │   ├── ui/
│   │   │   ├── Badge.test.tsx
│   │   │   ├── Button.test.tsx
│   │   │   ├── Icon.test.tsx
│   │   │   ├── Skeleton.test.tsx
│   │   │   ├── EmptyState.test.tsx
│   │   │   ├── Toast.test.tsx
│   │   │   ├── ConfirmDialog.test.tsx
│   │   │   ├── StatusDot.test.tsx
│   │   │   ├── Tooltip.test.tsx
│   │   │   └── Select.test.tsx
│   │   ├── IssuesTab.test.tsx
│   │   ├── IssuePanel.test.tsx
│   │   ├── PullRequestsTab.test.tsx
│   │   ├── TasksTab.test.tsx
│   │   ├── ActionsTab.test.tsx
│   │   ├── ReportTab.test.tsx
│   │   ├── SkillsTab.test.tsx
│   │   └── OffWorkCelebration.test.tsx
│   ├── integration/
│   │   ├── statusLog-decisions.test.ts
│   │   ├── registry-statusLog.test.ts
│   │   ├── sse-pipeline.test.ts
│   │   └── tab-api-hook.test.tsx
│   └── setup/
│       ├── vitest.setup.ts
│       ├── mocks/
│       │   ├── fs.ts
│       │   ├── child_process.ts
│       │   ├── config.ts
│       │   └── EventSource.ts
│       └── fixtures/
│           ├── issues.json
│           ├── prs.json
│           ├── tasks.jsonl
│           ├── decisions.json
│           └── pilot.yaml
├── vitest.config.ts
└── package.json (updated with test scripts)
```
