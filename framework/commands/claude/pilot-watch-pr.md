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

For each repo in `$REPOS`:
```bash
gh pr list --repo $REPO_SLUG \
  --author @me \
  --state open \
  --json number,title,reviewDecision,statusCheckRollup,headRefName,isDraft,url \
  --limit 20
```

For each PR with `reviewDecision` of `CHANGES_REQUESTED` or `REVIEW_REQUIRED`, also fetch unresolved review threads:
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

After detecting and reporting, attempt auto-fix for enabled conditions. Track attempts per PR in the cycle state.

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
# Get the failed run ID from the PR's head branch
FAILED_RUN=$(gh run list --repo $REPO_SLUG --branch <branch> --status failure --limit 1 --json databaseId --jq '.[0].databaseId')
# Fetch only the failed job logs (not the full run)
gh run view $FAILED_RUN --repo $REPO_SLUG --log-failed 2>&1 | tail -200
```

2. **Locate or create the worktree**:
```bash
WORKTREE="$WS/worktrees/issue-<linked-issue-number>"
# If no worktree exists for this branch, create one:
if [ ! -d "$WORKTREE" ]; then
  cd "$WS/<repo-name>"
  git fetch origin
  git worktree add "$WORKTREE" origin/<branch>
fi
cd "$WORKTREE"
git pull origin <branch>
```

3. **Spawn a fix agent**:
```
Agent(
  description="Fix CI failure for PR #<N>",
  subagent_type="general-purpose",
  prompt="You are fixing a CI failure on branch <branch> in the repo at <worktree-path>.

CI failed with the following log (last 200 lines):
<failed log output>

Instructions:
1. Analyze the failure — identify the root cause (build error, test failure, lint error, etc.)
2. Fix the code — make minimal changes to resolve the issue
3. Run the build command to verify: <build command from pilot.yaml>
4. Stage and commit the fix: git add <files> && git commit -m 'fix(ci): <description>'
5. Push: git push origin <branch>

Rules:
- Minimal changes only — fix the CI issue, nothing else
- Never force push
- If you cannot determine the fix after examining the code, report what you found and stop
"
)
```

4. **After agent completes**:
   - Increment `ci_attempts` for this PR
   - Log event: `ci_auto_fix` with detail of what was changed
   - Update notification: replace with "Auto-fix pushed, waiting for CI..."
   - Next cycle will pick up the new CI result

5. **If max attempts (3) reached**:
   - Write notification asking user to intervene:
   ```json
   {
     "question": "PR #<N> CI still failing after 3 auto-fix attempts",
     "options": ["Review Logs", "Dismiss"],
     "context": "<summary of all 3 attempts>"
   }
   ```
   - Log `blocked` event
   - Stop auto-fixing this PR's CI until user dismisses or CI changes

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

3. **Spawn a fix agent**:
```
Agent(
  description="Fix review comments for PR #<N>",
  subagent_type="general-purpose",
  prompt="You are addressing review comments on PR #<N>, branch <branch> in the repo at <worktree-path>.

Unresolved review comments:
<for each unresolved thread>
- File: <path>, Line: <line>
  Reviewer: <author>
  Comment: <body>
</for each>

Instructions:
1. Read each comment and understand what the reviewer is asking for
2. Make the requested code changes
3. Run the build command to verify: <build command from pilot.yaml>
4. Stage and commit: git add <files> && git commit -m 'fix(review): address review comments on PR #<N>'
5. Push: git push origin <branch>

Rules:
- Address ALL unresolved comments in a single commit
- Minimal changes — only what the reviewers asked for
- Never force push
- If a comment is ambiguous or requires a design decision, skip it and note which comments were skipped
"
)
```

4. **After agent completes**:
   - Increment `comment_attempts` for this PR
   - Log event: `comment_auto_fix` with detail of what was addressed
   - Update notification with fix status

5. **If max attempts (3) reached**: same as CI — notify user and stop.

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
     # Find repo and worktree by branch name
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
7. **Auto-fix CI is on by default** — disable via `watch_pr.auto_fix_ci: false` in `pilot.yaml`
8. **Auto-fix comments is off by default** — enable via `watch_pr.auto_fix_comments: true` in `pilot.yaml`
9. **Max 3 auto-fix attempts** per PR per fix type — then stop and notify user
10. **Never force push** — all fixes are new commits
11. **Log all auto-fix actions** — every fix attempt is logged to `$WS/logs/pr-<N>.jsonl`
