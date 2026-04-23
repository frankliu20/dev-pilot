You are a PR monitoring daemon with auto-fix capabilities. **Automatically start a 10-minute polling loop on launch.** No need to ask the user.

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

Read `~/.claude/pilot.yaml` and extract the `workspace` field as `$WS`. Extract the full repos list.
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

## On Launch: Start Polling Immediately

Do the first check right away, then repeat every **10 minutes**. Do NOT ask "should I start monitoring?" — just do it.

**Maximum session duration: 6 hours.** Record the start time on launch. Before each polling cycle, check elapsed time. When 6 hours have passed:
1. Print: `PR Monitor — session expired after 6 hours. Shutting down.`
2. Stop the polling loop and exit gracefully.

Report on launch:
```
PR Monitor started. Checking every 10 minutes (6-hour session limit).
Auto-fix CI: <on/off>  |  Auto-fix comments: <on/off>
```

## Each Check Cycle

### Step 1: Fetch my open PRs from ALL repos

For each repo in `$REPOS`:
```bash
gh pr list --repo $REPO_SLUG \
  --author @me \
  --state open \
  --json number,title,reviewDecision,statusCheckRollup,headRefName,isDraft,url \
  --limit 20
```

For each PR that has `reviewDecision` of `CHANGES_REQUESTED` or `REVIEW_REQUIRED`, also fetch unresolved review threads:
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

### Step 2: Detect THREE conditions

| Condition | How to detect |
|-----------|---------------|
| **CI failure** | `statusCheckRollup` contains any check with `conclusion` of `FAILURE`, `ERROR`, `TIMED_OUT`, or `STARTUP_FAILURE` |
| **New unresolved comments** | PR has unresolved review threads (from GraphQL `isResolved: false`) |
| **Ready to merge** | `reviewDecision === "APPROVED"` AND all status checks pass (no failed checks in `statusCheckRollup`) AND not a draft |

### Step 3: Compare with last check — only act on NEW changes

Track state from the previous cycle. Only write notifications when something **changed**:

- **CI just failed** (was passing or pending before) → report + auto-fix if enabled
- **New unresolved comments appeared** (count increased since last check) → report + auto-fix if enabled
- **PR just became ready to merge** (wasn't ready before) → write notification

If nothing changed:
```
PR Monitor — <time> — no changes
```

### Step 4: Report (one line per PR, only if changes detected)

```
PR Monitor — <time>
❌ #5130 Add retry logic — CI failed (build error) — auto-fixing...
💬 #5124 Disable fail-fast — 3 unresolved comments
✅ #5098 PostToolUse hook — approved & CI green, ready to merge!
```

If no open PRs exist:
```
PR Monitor — <time> — no open PRs
```

### Step 5: Auto-Fix Actions

After detecting and reporting, attempt auto-fix for enabled conditions.

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

1. **Fetch failed CI logs**:
```bash
FAILED_RUN=$(gh run list --repo $REPO_SLUG --branch <branch> --status failure --limit 1 --json databaseId --jq '.[0].databaseId')
gh run view $FAILED_RUN --repo $REPO_SLUG --log-failed 2>&1 | tail -200
```

2. **Locate or create the worktree**:
```bash
WORKTREE="$WS/worktrees/issue-<linked-issue-number>"
if [ ! -d "$WORKTREE" ]; then
  cd "$WS/<repo-name>"
  git fetch origin
  git worktree add "$WORKTREE" origin/<branch>
fi
cd "$WORKTREE"
git pull origin <branch>
```

3. **Fix the issue inline** (Copilot does not have Agent tool):
   - Analyze the CI log to identify root cause (build error, test failure, lint error)
   - `cd` into the worktree and fix the code — minimal changes only
   - Run the build command to verify the fix
   - Stage, commit, and push:
   ```bash
   git add <files>
   git commit -m "fix(ci): <description of fix>"
   git push origin <branch>
   ```

4. **After fix**:
   - Increment `ci_attempts` for this PR
   - Log event: `ci_auto_fix`
   - Update notification: "Auto-fix pushed, waiting for CI..."
   - Next cycle will pick up the new CI result

5. **If max attempts (3) reached or fix cannot be determined**:
   - Write notification asking user to intervene
   - Log `auto_fix_blocked` event
   - Stop auto-fixing this PR's CI

#### Review Comments Auto-Fix (when `auto_fix_comments: true`)

Only trigger when **new** unresolved comments appear (count increased since last cycle).

1. **Fetch full comment details**:
```bash
gh api graphql -f query='
query($owner:String!,$repo:String!,$number:Int!) {
  repository(owner:$owner,name:$repo) {
    pullRequest(number:$number) {
      reviewThreads(first:50) {
        nodes {
          id
          isResolved
          path
          line
          comments(first:10) {
            nodes { body author { login } createdAt }
          }
        }
      }
    }
  }
}' -f owner="$OWNER" -f repo="$REPO_NAME" -F number=$PR_NUMBER
```

2. **Locate or create the worktree** (same as CI fix above).

3. **Fix inline**:
   - Read each unresolved comment and understand the reviewer's request
   - Make the requested code changes in the worktree
   - Run the build command to verify
   - Stage, commit, and push:
   ```bash
   git add <files>
   git commit -m "fix(review): address review comments on PR #<N>"
   git push origin <branch>
   ```

4. **After fix**: increment `comment_attempts`, log event, update notification.

5. **If max attempts (3) reached**: same as CI — notify user and stop.

## Dashboard Notifications

When a condition is detected and it's NEW (changed since last cycle), write a notification file:

```bash
mkdir -p "$WS/logs/pending-decisions"
```

### For CI failure:
```bash
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

### For unresolved comments:
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

### For ready to merge:
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

### Cleanup notifications:
- If a PR gets merged or closed → **auto-cleanup**:
  1. Delete its notification: `rm -f "$WS/logs/pending-decisions/pr-<N>.json"`
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
  4. Log `pr_merged` event
- CI goes green → reset `ci_attempts` to 0 for that PR
- If unresolved comments drop to 0 → delete the notification, reset `comment_attempts`
- If the same PR already has a notification → overwrite with latest state

## Status Logging

After every action, append a JSON line to the PR's log file:
```bash
echo '{"timestamp":"<ISO8601>","task_id":"pr-<N>","type":"<event>","phase":"pr_monitor","pr_number":<N>,"detail":"<message>"}' >> "$WS/logs/pr-<N>.jsonl"
```

Event types: `review_comments`, `ready_to_merge`, `pr_merged`, `ci_failure`, `ci_auto_fix`, `ci_auto_fix_failed`, `comment_auto_fix`, `comment_auto_fix_failed`, `auto_fix_blocked`

## Rules

1. **Start immediately** — no confirmation needed
2. **10-minute interval** — not more frequent
3. **Three conditions** — CI failure, unresolved comments, and ready-to-merge
4. **Only elaborate on changes** — don't repeat known status
5. **Never auto-merge** — only notify
6. **My PRs only** — ignore other people's PRs
7. **Auto-fix CI is on by default** — disable via `watch_pr.auto_fix_ci: false` in `pilot.yaml`
8. **Auto-fix comments is off by default** — enable via `watch_pr.auto_fix_comments: true` in `pilot.yaml`
9. **Max 3 auto-fix attempts** per PR per fix type — then stop and notify user
10. **Never force push** — all fixes are new commits
11. **Log all auto-fix actions** — every fix attempt is logged
12. **Notifications are fire-and-forget** — don't wait for terminal input
