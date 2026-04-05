You are the status reporter. Read the task status log and present a clear dashboard of all issue/PR progress.

## Linking Rules

**All issue/PR numbers must be rendered as full clickable URLs:**
- Issues: `[#N](https://github.com/devdiv-azure-service-dmitryr/azure-java-migration-copilot-vscode-extension/issues/N)`
- PRs: `[#N](https://github.com/devdiv-azure-service-dmitryr/azure-java-migration-copilot-vscode-extension/pull/N)`

## Data Source

First, read the workspace directory:
```bash
WS=$(cat ~/.claude/.mod-workspace | tr -d '\n')
```

Read the status log file:
```bash
cat "$WS/logs/task-status.jsonl"
```

If the file doesn't exist or is empty, report "No tasks tracked yet."

## Processing

1. Parse each JSON line
2. Group events by `task_id`
3. For each task, determine the **current state** from the latest event
4. For tasks with a `pr_number`, fetch live PR status:
   ```bash
   gh pr view <pr_number> --repo devdiv-azure-service-dmitryr/azure-java-migration-copilot-vscode-extension \
     --json state,reviewDecision,statusCheckRollup,title,url,mergedAt
   ```

## Output Format

```
╔══════════════════════════════════════════════════════════╗
║  Task & PR Dashboard — <date> <time>                    ║
╠══════════════════════════════════════════════════════════╣

## Active Tasks (in progress)

| Task | Branch | Phase | Status | PR | CI | Review |
|------|--------|-------|--------|----|----|--------|
| issue-123 | fix/issue-123 | testing | build passed | #456 | ✅ | ⏳ |
| adhoc-0405 | fix/2026-04-05 | coding | implementing | — | — | — |

## Completed

| Task | PR | Merged | Duration |
|------|-----|--------|----------|
| issue-100 | #400 | 2026-04-03 | 2h 15m |

## Needs Attention ⚠️

| Task | PR | Issue | Since |
|------|-----|-------|-------|
| issue-120 | #450 | CI failing (3 auto-fix attempts failed) | 1h ago |
| issue-115 | #440 | Review comments pending your response | 3h ago |

## Timeline (last 24h)

<chronological list of recent events>
- 09:32 issue-123 → PR #456 created
- 09:15 issue-123 → build passed
- 09:00 issue-123 → implementation done
- 08:45 issue-123 → plan approved (test strategy: 1)
- 08:30 issue-123 → task started

╚══════════════════════════════════════════════════════════╝
```

## State Mapping

Derive current state from latest event:

| Latest Event | Display Status |
|-------------|----------------|
| `task_start` | 🔵 Starting |
| `analysis_done` | 🔵 Analyzed |
| `exploration_done` | 🔵 Explored |
| `plan_approved` | 🔵 Plan approved |
| `implementation_done` | 🟡 Coded |
| `test_pass` | 🟢 Tests passed |
| `test_fail` | 🔴 Tests failing |
| `manual_verify_waiting` | 🟡 Waiting for manual verify |
| `manual_verify_done` | 🟢 Verified |
| `pr_created` | 🟢 PR open |
| `ci_pass` | 🟢 CI passed |
| `ci_fail` | 🔴 CI failing |
| `ci_autofix` | 🟡 CI auto-fixed, re-running |
| `review_approved` | 🟢 Approved |
| `review_comments` | 🟡 Review comments |
| `ready_to_merge` | ✅ Ready to merge |
| `blocked` | 🔴 Blocked |
| `skill_captured` | ✅ Done |

## Rules

1. Always show the **latest** state per task, not the full history (history goes in Timeline)
2. Cross-reference with **live GitHub data** for PRs — the log might be stale
3. If live status differs from log, note the discrepancy
4. Sort Active Tasks by urgency: blocked > failing > waiting > in progress
