# Integration Test Plan — Dev Pilot Dashboard

## 1. Overview

This document defines integration tests that verify correct behavior **across module boundaries**. Unlike unit tests (which mock all dependencies), integration tests use real module interactions with only external I/O mocked (filesystem, child_process, network).

| Item | Detail |
|------|--------|
| **Framework** | Vitest |
| **Location** | `dashboard/__tests__/integration/` |
| **Naming** | `<pipeline-name>.integration.test.ts` |
| **Total Scenarios** | 34 |
| **Mocking Principle** | Mock only the outermost boundary (fs, child_process, network); let all internal lib modules interact via real code |

---

## 2. Pipeline 1: statusLog → decisions (Auto-Dismiss Flow)

**File**: `statusLog-decisions.integration.test.ts`

**What it tests**: When `deriveTasks()` returns tasks with recent `lastUpdate` timestamps, `readPendingDecisions()` should auto-dismiss stale decisions whose timestamp predates the task's last activity.

**Setup**: Mock only `fs` and `config.getWorkspace`. Let `readPendingDecisions` call the **real** `deriveTasks`.

### Scenarios

| # | Scenario | Setup | Expected Outcome |
|---|----------|-------|-----------------|
| 1 | Stale decision auto-dismissed | JSONL: task-1 lastUpdate=T+60. Decision: task-1 timestamp=T | Decision file deleted via `unlinkSync`, not in results |
| 2 | Fresh decision kept | JSONL: task-1 lastUpdate=T-60. Decision: task-1 timestamp=T | Decision returned in array |
| 3 | Orphan decision kept | Decision for task-99, no JSONL entry for task-99 | Decision returned (no task to compare against) |
| 4 | Mixed: 1 stale + 1 fresh + 1 orphan | Three decision files | Returns 2 (fresh + orphan), deletes 1 stale |
| 5 | Empty logs + decisions exist | No JSONL files, 3 decision files | All 3 returned (deriveTasks returns []) |
| 6 | dismiss then read | Call `dismissDecision('task-1')` then `readPendingDecisions()` | task-1 absent from results |

### Assertions
- Correct decisions returned in newest-first order
- `fs.unlinkSync` called only for auto-dismissed files
- No side effects on non-dismissed decision files
- `deriveTasks()` called exactly once per `readPendingDecisions()` invocation

### Mock Wiring
```
Real chain: readPendingDecisions() → deriveTasks() → readAllEntries() → [mock fs]
                                                                        ↑
Only mock: fs.readFileSync, fs.readdirSync, fs.existsSync, fs.unlinkSync
```

---

## 3. Pipeline 2: registry → statusLog (Phase Sync Flow)

**File**: `registry-statusLog.integration.test.ts`

**What it tests**: When `registry.assign()` spawns a worker, subsequent calls to `registry.getAll()` should update worker phases from the real `deriveTasks()` output (reflecting JSONL log file changes).

**Setup**: Mock `fs`, `child_process.spawn`, `config`. Let `registry.refreshFromLogs` call the **real** `deriveTasks`.

### Scenarios

| # | Scenario | Setup | Expected Outcome |
|---|----------|-------|-----------------|
| 1 | New task, no logs yet | Assign task-1, empty log dir | Worker exists, phase=undefined (no log entry) |
| 2 | Worker phase follows log | Assign task-1, then add JSONL with `type: 'plan_approved'` | `getAll()` → worker.phase = 'implementing' |
| 3 | Log progresses to testing | After scenario 2, append `type: 'implementation_done'` | worker.phase = 'testing' |
| 4 | Terminal phase → completed | Append `type: 'pr_created'` (→ phase 'done') | worker.status = 'completed', `isRunning()` = false |
| 5 | Failed phase → completed | Append `type: 'blocked'` (→ phase 'failed') | worker.status = 'completed' |
| 6 | Cancel running task | Assign task-1 with active phase, then `cancel()` | Kill command executed, worker.status = 'cancelled' |
| 7 | Two tasks, one completes | Assign task-A + task-B, task-A reaches 'done' | task-A completed, task-B still running |

### Assertions
- Worker phase matches latest deriveTasks phase after each `getAll()`/`isRunning()` call
- `openClaudeTerminal` called with correct args on assign
- Process kill commands executed with correct patterns on cancel
- Completed workers are not re-activated by subsequent refreshFromLogs calls

### Mock Wiring
```
Real chain: registry.refreshFromLogs() → deriveTasks() → readAllEntries() → [mock fs]
            registry.assign()          → openClaudeTerminal()              → [mock spawn]
            registry.cancel()          → execSync                          → [mock child_process]
```

---

## 4. Pipeline 3: SSE Stream → fs.watch → deriveTasks (Live Update Flow)

**File**: `stream-watch.integration.test.ts`

**What it tests**: The SSE API route sets up `watchStatusLog`, and when `.jsonl` file changes are detected, the stream should send updated task data to the client.

**Setup**: Mock `fs` (including `fs.watch` with a triggerable callback), mock `config`. Use real `deriveTasks`, real `readPendingDecisions` → real `deriveTasks` chain.

### Scenarios

| # | Scenario | Trigger | Expected Outcome |
|---|----------|---------|-----------------|
| 1 | Initial connection | Call `GET()` | Response has SSE headers; first chunk contains `event: tasks\n` + `event: decisions\n` |
| 2 | Log file change | Trigger `watchCallback('change', 'issue-42.jsonl')` | New SSE chunk with updated tasks from re-derived data |
| 3 | Decision file change | Trigger `decisionWatchCallback('change', 'issue-42.json')` | New SSE chunk with `event: decisions\n` |
| 4 | Non-JSONL change ignored | Trigger `watchCallback('change', 'readme.txt')` | No new SSE chunk emitted |
| 5 | Non-JSON decision change | Trigger `decisionWatchCallback('change', '.DS_Store')` | No new SSE chunk emitted |
| 6 | Client disconnect | Cancel the ReadableStream | Both watchers cleaned up, heartbeat cleared |
| 7 | deriveTasks throws | Mock fs to throw on re-read | Error swallowed via try/catch in `send()`, stream continues |

### Test Technique
```typescript
// Capture fs.watch callbacks
let logWatchCallback: Function;
let decisionWatchCallback: Function;

vi.mocked(fs.watch).mockImplementation((path, cb) => {
  if (path.endsWith('logs')) logWatchCallback = cb;
  else decisionWatchCallback = cb;
  return { close: vi.fn() } as any;
});

// Get the stream and reader
const response = await GET();
const reader = response.body!.getReader();
const decoder = new TextDecoder();

// Read initial data
const { value } = await reader.read();
const text = decoder.decode(value);
expect(text).toContain('event: tasks');

// Trigger a file change and read the next chunk
logWatchCallback('change', 'issue-42.jsonl');
const { value: v2 } = await reader.read();
```

### Assertions
- Response Content-Type is `text/event-stream`
- Initial payload includes both `tasks` and `decisions` events
- Each SSE event is properly formatted: `event: <type>\ndata: <json>\n\n`
- Heartbeat fires at ~30s intervals (use fake timers)
- Cleanup is idempotent (calling cancel twice doesn't throw)

---

## 5. Pipeline 4: API Route → Lib → External (End-to-End Data Flow)

**File**: `api-lib-flow.integration.test.ts`

**What it tests**: API routes call lib modules which call external systems. These tests verify the full request→response chain with only the external boundary mocked.

### Scenarios

| # | Route | Full Chain | Key Verification |
|---|-------|-----------|-----------------|
| 1 | `GET /api/issues` | route → `fetchMyOpenIssues()` → `execAsync('gh issue list ...')` | CLI command includes `--assignee @me --state open`, response is `{issues: [...]}` |
| 2 | `GET /api/prs` | route → `fetchMyOpenPRs()` + `classifyPRAction()` + `fetchUnresolvedThreadCounts()` | PR classification integrated with thread counts, each PR has `action` field |
| 3 | `GET /api/issues?number=42` | route → `fetchIssueDetail(42)` → `execAsync('gh issue view 42 ...')` | Returns `{issue: {...}}` with `body` field, or 404 |
| 4 | `POST /api/tasks/assign` valid | route → `registry.assign()` → `openClaudeTerminal()` → `spawn()` | Process spawned, response is `{success:true, taskId:'issue-42'}` |
| 5 | `POST /api/tasks/assign` duplicate | route → `registry.assign()` returns already_running | Response is 409 `{success:false}` |
| 6 | `DELETE /api/tasks/issue-42` | route → `registry.cancel()` → `execSync('pkill ...')` | Process killed, response is `{success:true}` |
| 7 | `GET /api/report` | route → 5 github functions in parallel → `execAsync('gh ...')` × 5 | Aggregated response with `commits`, `completedIssues`, `mergedPRs`, `openPRs`, `stats` |
| 8 | `DELETE /api/decisions?taskId=issue-42` | route → `dismissDecision()` → `deriveTasks()` → `readAllEntries()` → fs | Full chain from HTTP to filesystem to response |

### Mock Boundary
```
MOCKED (external I/O only):
├── child_process.exec / execSync / spawn
├── fs.readFileSync / readdirSync / existsSync / unlinkSync / watch
└── process.env (for config)

REAL (all internal modules):
├── github.ts (runGH, classifyPRAction, fetch*)
├── statusLog.ts (readAllEntries, deriveTasks)
├── decisions.ts (readPendingDecisions, dismissDecision)
├── registry.ts (TaskRegistry)
├── terminal.ts (openClaudeTerminal)
├── config.ts (getConfig, etc.)
└── API route handlers
```

### Assertions
- HTTP status codes correct (200, 400, 404, 409, 500)
- Response body JSON shape matches expected contract
- External commands called with correct arguments
- No real filesystem or network operations occur

---

## 6. Pipeline 5: Full User Workflow Simulations

**File**: `workflows.integration.test.ts`

These tests simulate complete user journeys through multiple API calls and shared state changes.

### Workflow 1: Assign → Monitor → Complete

```
Step 1: POST /api/tasks/assign { issueUrl: 'https://github.com/o/r/issues/42' }
        → 200, {success:true, taskId:'issue-42'}
        Assert: spawn called, registry has 1 running worker

Step 2: GET /api/tasks/registry
        → 200, {workers: [{taskId:'issue-42', status:'running'}], summary:{running:1}}

Step 3: [Simulate: update JSONL mock — add 'implementation_done' entry]

Step 4: GET /api/tasks
        → 200, task issue-42 has phase 'testing'

Step 5: [Simulate: update JSONL mock — add 'pr_created' entry]

Step 6: GET /api/tasks
        → 200, task issue-42 has phase 'done'

Step 7: GET /api/tasks/registry
        → 200, worker issue-42 status='completed'
```

### Workflow 2: Assign → Monitor → Cancel

```
Step 1: POST /api/tasks/assign { issueUrl: '...issues/43' }
        → 200, started

Step 2: DELETE /api/tasks/issue-43
        → 200, cancelled

Step 3: GET /api/tasks/registry
        → 200, worker status='cancelled'

Step 4: POST /api/tasks/assign { issueUrl: '...issues/43' }
        → 200, started (can re-assign after cancel)
```

### Workflow 3: Assign → Blocked → Decision → Dismiss → Resume

```
Step 1: POST /api/tasks/assign { issueUrl: '...issues/44' }
        → 200

Step 2: [Simulate: JSONL — add 'blocked' event for issue-44]
        [Simulate: create decision file for issue-44]

Step 3: GET /api/tasks
        → issue-44 phase = 'failed'

Step 4: [Use stream to verify decision appears]

Step 5: DELETE /api/decisions?taskId=issue-44
        → 200, {success: true}

Step 6: [Verify decision file deleted]
```

### Workflow 4: Force Re-assign Running Task

```
Step 1: POST /api/tasks/assign { issueUrl: '...issues/45' }
        → 200

Step 2: POST /api/tasks/assign { issueUrl: '...issues/45' }
        → 409 (already running)

Step 3: POST /api/tasks/assign { issueUrl: '...issues/45', force: true }
        → 200 (force override, new worker created)
```

### Workflow 5: Multi-task Concurrent Operations

```
Step 1: Assign issue-50, issue-51, issue-52 in sequence
        → All 200

Step 2: GET /api/tasks/registry
        → 3 running workers

Step 3: [Simulate: issue-50 → 'done', issue-51 → 'failed', issue-52 still active]

Step 4: GET /api/tasks/registry
        → 1 running (issue-52), 2 completed (issue-50, issue-51)

Step 5: GET /api/tasks
        → Phases reflect individual states correctly
```

### Workflow 6: SSE Live Monitoring Session

```
Step 1: GET /api/stream → open SSE connection
        → Receive initial tasks + decisions

Step 2: POST /api/tasks/assign { issueUrl: '...issues/46' }
        → 200

Step 3: [Simulate: JSONL write for issue-46 'implementing']
        [Trigger watchStatusLog callback]

Step 4: Read next SSE chunk
        → Contains updated tasks with issue-46 in 'implementing' phase

Step 5: [Simulate: JSONL write for issue-46 'testing']
        [Trigger watchStatusLog callback]

Step 6: Read next SSE chunk
        → issue-46 now in 'testing' phase

Step 7: Cancel SSE stream

Step 8: Assert: watcher cleanup functions called, no memory leaks
```

---

## 7. Test Infrastructure Requirements

| Requirement | Approach |
|-------------|----------|
| **Shared state between workflow steps** | Use module-scoped variables; DO NOT use `vi.resetModules()` within a workflow |
| **Filesystem simulation** | Shared `createMockFs` from helpers — statusLog + decisions read the same virtual fs |
| **Mutable filesystem** | Mock implementations allow adding/removing files between steps |
| **Time control** | `vi.useFakeTimers()` for auto-dismiss timestamps, heartbeat intervals, polling |
| **SSE stream consumption** | Use `ReadableStream.getReader()` + `TextDecoder` to read SSE chunks |
| **Process lifecycle** | Track all `spawn`/`execSync` calls, verify `kill` patterns match expected args |
| **Singleton reset** | `vi.resetModules()` in `beforeEach` for registry and config singletons |
| **Test isolation** | Each workflow test gets fresh module instances via dynamic import |

---

## 8. Coverage Targets

| Pipeline | Scenarios | Priority |
|----------|-----------|----------|
| statusLog → decisions (Auto-Dismiss) | 6 | **P0** |
| registry → statusLog (Phase Sync) | 7 | **P0** |
| SSE → fs.watch (Live Update) | 7 | **P0** |
| API → lib → external (Data Flow) | 8 | **P1** |
| Full user workflows | 6 | **P1** |
| **Total** | **34** | |

---

## 9. Success Criteria

1. All 34 scenarios pass with zero flakiness across 5 consecutive runs
2. No singleton state leaks between test files (validated by running with `vitest --shuffle`)
3. No real filesystem, network, or process operations occur during tests
4. Full workflow tests complete in < 5 seconds total
5. Coverage of cross-module boundaries reaches >= 90% of identified pipelines
6. Each test fails when its corresponding implementation line is modified (mutation-resistant)

---

## 10. Implementation Priority

| Phase | Scope | Depends On |
|-------|-------|-----------|
| Phase 1 | Pipeline 1 (statusLog→decisions) | Unit tests for statusLog + decisions passing |
| Phase 2 | Pipeline 2 (registry→statusLog) | Unit tests for registry + statusLog passing |
| Phase 3 | Pipeline 3 (SSE→fs.watch) | Unit tests for stream route + statusLog passing |
| Phase 4 | Pipeline 4 (API→lib→external) | All lib unit tests passing |
| Phase 5 | Pipeline 5 (Full workflows) | Pipelines 1-4 passing |

**Estimated implementation effort**: 2-3 days after unit tests are complete.
