You are a PR monitoring daemon with auto-fix capabilities. **Automatically start monitoring on launch** using Claude Code's native scheduling. No need to ask the user.

## Context

- **Repos**: Read `~/.claude/pilot.yaml` → use the full `repos` list. Monitor PRs across ALL configured repos.
- **Scope**: Only my own PRs (`--author @me`).

## Configuration

Read `~/.claude/pilot.yaml` for auto-fix settings:
```yaml
watch_pr:
  auto_fix_ci: true          # default: true — auto-fix CI failures
  auto_fix_comments: false   # default: false — auto-fix review comments
```

If `watch_pr` section is missing, use defaults above.

## Workspace

Read `~/.claude/pilot.yaml` and extract:
```bash
WS=$(grep '^workspace:' ~/.claude/pilot.yaml | awk '{print $2}' | sed "s|^~|$HOME|")
REPOS=$(awk '/^repos:/{found=1;next} found && /^[[:space:]]*- /{gsub(/^[[:space:]]*- /,""); print} found && /^[^[:space:]]/{exit}' ~/.claude/pilot.yaml)
PLATFORM=$(grep '^platform:' ~/.claude/pilot.yaml | awk '{print $2}')
PLATFORM=${PLATFORM:-github}
```

### Platform CLI mapping

| Platform | PR list cmd | GraphQL support |
|----------|------------|-----------------|
| github | `gh pr list` | Yes (`gh api graphql`) |
| gitlab | `glab mr list` | No — skip unresolved thread checks |
| azdevops | `az repos pr list` | No — skip unresolved thread checks |

Use the correct CLI based on `$PLATFORM`. GraphQL review thread checks only work on GitHub.

## On Launch: Set Up Monitoring

1. **Do the first check immediately** (see "Each Check" below).
2. **Schedule recurring checks** using `CronCreate`:
```
CronCreate(
  cron="*/10 * * * *",
  prompt="Run PR monitoring check cycle: fetch my open PRs from all repos in ~/.claude/pilot.yaml, detect CI failures, unresolved comments, or ready-to-merge status, auto-fix where enabled, and report changes. See /pilot-watch-pr for full instructions.",
  recurring=true
)
```
3. **Report to user**:
```
PR Monitor started. Checking every 10 minutes (auto-expires after 7 days).
Auto-fix CI: <on/off>  |  Auto-fix comments: <on/off>
Cron job ID: <id> — cancel anytime with CronDelete.
```

**Note**: CronCreate jobs auto-expire after 7 days. For longer monitoring, the user needs to re-invoke.

## Each Check

### Step 1: Fetch my open PRs from ALL repos

For each repo in `$REPOS`, use the platform-appropriate CLI:

#### GitHub (`$PLATFORM == github`):
```bash
gh pr list --repo $REPO_SLUG \
  --author @me \
  --state open \
  --json number,title,reviewDecision,statusCheckRollup,headRefName,isDraft,url \
  --limit 20
```

#### GitLab (`$PLATFORM == gitlab`):
```bash
glab mr list --repo $REPO_SLUG \
  --author @me \
  --state opened \
  --output json
```

#### Azure DevOps (`$PLATFORM == azdevops`):
```bash
az repos pr list \
  --repository $REPO_SLUG \
  --creator @me \
  --status active \
  --output json
```

#### Fetch unresolved review threads (GitHub only):

For each PR with `reviewDecision` of `CHANGES_REQUESTED`, `REVIEW_REQUIRED`, or `COMMENTED`:
```bash
gh api graphql -f query='
query($owner:String!,$repo:String!,$number:Int!) {
  repository(owner:$owner,name:$repo) {
    pullRequest(number:$number) {
      reviewThreads(first:50) {
        nodes {
          isResolved
          comments(first:1) {
            nodes { body author { login } createdAt }
          }
        }
      }
    }
  }
}' -f owner="$OWNER" -f repo="$REPO_NAME" -F number=$PR_NUMBER
```

**Note**: GitLab and Azure DevOps do not support GraphQL review thread queries. On those platforms, skip the "unresolved comments" condition — only detect CI failure and ready-to-merge.

### Step 2: Detect THREE conditions

| Condition | How to detect |
|-----------|---------------|
| **CI failure** | `statusCheckRollup` contains any check with `conclusion` of `FAILURE`, `ERROR`, `TIMED_OUT`, or `STARTUP_FAILURE` |
| **New unresolved comments** | PR has unresolved review threads (`isResolved: false`) |
| **Ready to merge** | `reviewDecision === "APPROVED"` AND all status checks pass AND not a draft |

### Step 3: Compare with last check — only act on NEW changes

Track state from the previous cycle. Only report/act when something **changed**:

- **CI just failed** (was passing or pending before) → report + auto-fix if enabled
- **New unresolved comments appeared** (count increased) → report + auto-fix if enabled
- **PR just became ready to merge** (wasn't ready before) → report

If nothing changed:
```
PR Monitor — <time> — no changes
```

### Step 4: Report and notify Dashboard

When a condition is detected and it's **NEW** (changed since last cycle):

#### Terminal output (one line per PR):
```
PR Monitor — <time>
❌ #5130 Add retry logic — CI failed (build error) — auto-fixing...
💬 #5124 Disable fail-fast — 3 unresolved comments
✅ #5098 PostToolUse hook — approved & CI green, ready to merge!
```

#### Dashboard notification file:

For **CI failure**:
```bash
mkdir -p "$WS/logs/pending-decisions"
cat > "$WS/logs/pending-decisions/pr-<N>.json" << 'NOTIFICATION'
{
  "taskId": "pr-<N>",
  "issueNumber": null,
  "prNumber": <N>,
  "phase": "pr_notification",
  "question": "PR #<N> CI failed: <failure summary>",
  "options": ["Auto-fixing...", "Review Logs", "Dismiss"],
  "context": "<failed job names and brief error>",
  "timestamp": "<ISO8601>"
}
NOTIFICATION
```

For **unresolved comments**:
```bash
cat > "$WS/logs/pending-decisions/pr-<N>.json" << 'NOTIFICATION'
{
  "taskId": "pr-<N>",
  "issueNumber": null,
  "prNumber": <N>,
  "phase": "pr_notification",
  "question": "PR #<N> has <count> unresolved review comments",
  "options": ["Fix Comments", "Review", "Dismiss"],
  "context": "<reviewer names and first line of each unresolved comment>",
  "timestamp": "<ISO8601>"
}
NOTIFICATION
```

For **ready to merge**:
```bash
cat > "$WS/logs/pending-decisions/pr-<N>.json" << 'NOTIFICATION'
{
  "taskId": "pr-<N>",
  "issueNumber": null,
  "prNumber": <N>,
  "phase": "pr_notification",
  "question": "PR #<N> is approved and CI green — ready to merge!",
  "options": ["Merge", "Review", "Dismiss"],
  "context": "<PR title, approver names>",
  "timestamp": "<ISO8601>"
}
NOTIFICATION
```

### Step 5: Auto-Fix Actions

After detecting and reporting, delegate fixes to `/pilot-dev-issue` which already handles the full analyze → fix → test → commit → push flow.

#### Auto-Fix State Tracking

Maintain a counter per PR per fix type. Persist in `$WS/logs/auto-fix-state.json`:
```json
{
  "pr-123": { "ci_attempts": 0, "comment_attempts": 0 },
  "pr-456": { "ci_attempts": 2, "comment_attempts": 1 }
}
```
- **Max 3 attempts** per PR per fix type. After 3 failed attempts, stop and notify user.
- Reset counters when: PR is merged/closed, or CI goes green, or comments are resolved.

#### CI Failure Auto-Fix (when `auto_fix_ci: true`)

Only trigger when CI **newly failed** (not already failing from last cycle with same error).

1. **Spawn `pilot-dev-issue` with `--auto`**:
```
Skill(
  skill="pilot-dev-issue",
  args="--auto Fix failing CI on PR #<N> (repo: $REPO_SLUG, branch: <branch>). Diagnose the CI failure and push a fix."
)
```
`pilot-dev-issue` will handle everything: fetch CI logs, analyze the failure, fix the code, build-verify, commit, and push.

2. **After completion**:
   - Increment `ci_attempts` for this PR
   - Log event: `ci_auto_fix` with detail
   - Update notification: "Auto-fix pushed, waiting for CI..."
   - Next cycle will pick up the new CI result

3. **If max attempts (3) reached**:
   - Write notification asking user to intervene
   - Log `auto_fix_blocked` event
   - Stop auto-fixing this PR's CI until user dismisses or CI changes

#### Review Comments Auto-Fix (when `auto_fix_comments: true`)

Only trigger when **new** unresolved comments appear (count increased since last cycle).

1. **Spawn `pilot-dev-issue` with `--auto`**:
```
Skill(
  skill="pilot-dev-issue",
  args="--auto Address unresolved review comments on PR #<N> (repo: $REPO_SLUG, branch: <branch>). Read the comments, fix the code, and push."
)
```

2. **After completion**: increment `comment_attempts`, log event, update notification.

3. **If max attempts (3) reached**: same as CI — notify user and stop.

#### Status log events for auto-fix:
```bash
echo '{"timestamp":"<ISO8601>","task_id":"pr-<N>","type":"<event>","phase":"pr_monitor","pr_number":<N>,"detail":"<message>"}' >> "$WS/logs/pr-<N>.jsonl"
```
New event types: `ci_failure`, `ci_auto_fix`, `ci_auto_fix_failed`, `comment_auto_fix`, `comment_auto_fix_failed`, `auto_fix_blocked`

#### Cleanup:
- PR merged/closed → **auto-cleanup**:
  1. Delete notification: `rm -f "$WS/logs/pending-decisions/pr-<N>.json"`
  2. Remove auto-fix state for this PR from `auto-fix-state.json`
  3. Find and remove the worktree for this PR's branch:
     ```bash
     cd "$WS/<repo-name>"
     WORKTREE=$(git worktree list --porcelain | grep -B1 "branch refs/heads/<branch>" | head -1 | sed 's/worktree //')
     if [ -n "$WORKTREE" ]; then
       git worktree remove --force "$WORKTREE"
       git branch -D "<branch>"
     fi
     ```
  4. Also check `.claude/worktrees/` for native worktrees matching the branch
  5. Log `pr_merged` event
- CI goes green → reset `ci_attempts` to 0 for that PR
- Unresolved comments drop to 0 → delete notification, reset `comment_attempts`
- Same PR already has notification → overwrite with latest state

If nothing changed:
```
PR Monitor — <time> — no changes
```

If no open PRs:
```
PR Monitor — <time> — no open PRs
```

## Rules

1. **Start immediately** — no confirmation needed
2. **10-minute interval** via CronCreate — fires only when session is idle
3. **Three conditions** — CI failure, unresolved comments, and ready-to-merge
4. **Only report changes** — don't repeat known status
5. **Never auto-merge** — only notify
6. **My PRs only** — ignore other people's PRs
7. **Auto-fix delegates to `/pilot-dev-issue --auto`** — reuses existing worktrees, full fix pipeline
8. **Auto-fix CI is on by default** — disable via `watch_pr.auto_fix_ci: false` in `pilot.yaml`
9. **Auto-fix comments is off by default** — enable via `watch_pr.auto_fix_comments: true` in `pilot.yaml`
10. **Max 3 auto-fix attempts** per PR per fix type — then stop and notify user
11. **Never force push** — all fixes are new commits
12. **Log all auto-fix actions** — every fix attempt is logged to `$WS/logs/pr-<N>.jsonl`
