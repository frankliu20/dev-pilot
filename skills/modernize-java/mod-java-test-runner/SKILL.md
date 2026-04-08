# Test Runner — modernize-java

Accumulated knowledge for running tests on the azure-java-migration-copilot project.

## Trigger

When the user or orchestrator asks to run tests, build, or verify changes for repos in the modernize-java skill pack.

## Configuration

Read `~/.claude/pilot.yaml` to get:
- `workspace` → `$WS`
- `build.command` → build command (default: `npm run build`)
- `build.test_command` → test command (default: `npx jest --testPathPattern={{file}} --no-coverage`)

```bash
WS=$(grep '^workspace:' ~/.claude/pilot.yaml | awk '{print $2}' | sed "s|^~|$HOME|")
```

## Test Strategies

| Strategy | What to run | When to use |
|----------|-------------|-------------|
| **1 (default)** | `npm run build` only | Quick verification, most changes |
| **2** | `npm run build` + impacted unit tests only | Changes that affect logic or have existing tests |
| **3a** | `npm run build` + impacted unit tests + VS Code Extension manual verify | Extension UI changes, side effects, complex features |
| **3b** | `npm run build` + impacted unit tests + IntelliJ Plugin manual verify | MCP server changes that need IntelliJ plugin testing |
| **3c** | `npm run build` + impacted unit tests + MCP Server local verify | MCP server changes tested via GitHub Copilot |

## Core Loop

```
Run step → Check results → If fail → Analyze error → Fix code → Re-run → Repeat (max 3 rounds per step)
```

## Rules

1. **Read the error output carefully** — understand the root cause before fixing
2. **Fix the source code, not the tests** — unless the tests are wrong for the new behavior
3. **Maximum 3 fix attempts per step** — if still failing after 3 rounds, STOP and report clearly
4. **Never skip or disable tests** to make them pass
5. **Minimal fixes** — don't refactor, just fix what's broken

## Step 1: Build (all strategies)
```bash
npm run build
```
If build fails:
1. Read the error output — usually TypeScript compilation or esbuild errors
2. Common fixes: missing imports, type errors, syntax errors
3. Fix → re-run `npm run build` → repeat up to 3 times

If build passes and strategy is 1 → **done, report success**.

## Step 2: Impacted Unit Tests (strategy 2 and 3 only)

**Do NOT run the full test suite (`npm run ut`).** Only run tests related to the changed files.

### How to find impacted tests:
1. Check `git diff --name-only` to get the list of changed source files
2. For each changed file `src/foo/bar.ts`, look for:
   - `src/foo/bar.test.ts` (co-located test)
   - `src/foo/__tests__/bar.test.ts` (test subdirectory)
   - Any test file that imports the changed module (use Grep)
3. For changed files in `mcp-server/src/`, look in `mcp-server/src/**/*.test.ts` and `mcp-server/tests/`

### Run only impacted tests:
```bash
# Single test file
npx jest --testPathPattern="src/foo/bar.test.ts" --no-coverage

# Multiple test files
npx jest --testPathPattern="src/foo/bar.test.ts|src/baz/qux.test.ts" --no-coverage
```

### If no impacted test files are found:
Report "No existing tests found for changed files" and skip to next step. Do NOT run full suite.

If all tests pass and strategy is 2 → **done, report success**.

## Step 3: Manual Verify (strategy 3 only)

If build and tests pass, prepare the manual verify environment based on the chosen scenario.

### Scenario 3a — VS Code Extension

Tell the user the worktree path and how to launch:
```
Extension is ready for manual testing!

Worktree path: <current worktree absolute path>

To test:
1. Open this directory in VS Code
2. Press F5 to start Extension Host
3. Open your test project (e.g., Asset Manager)
4. Test the scenario below
```

Then generate a concrete test checklist based on the issue and changes made:

```
## Manual Verification Guide

### Test Main Scenario
Determine from issue which flow to test:
- **Assessment**: Run assessment → verify report output
- **Upgrade**: Run Java upgrade → verify upgraded code
- **Migration**: Run migration → verify generated plan

Issue-specific test steps:
- <concrete step 1 based on what was changed>
- <concrete step 2>
- <expected result — be specific>

### Check Side Effects
- [ ] Flow execution completes without errors
- [ ] Logs look correct (Output panel → extension channel)
- [ ] Generated plan/summary is valid (if applicable)
- [ ] Progress reporting works (if applicable)
- [ ] Telemetry events fire correctly (optional)

### Negative/Edge Cases
- <edge case derived from the issue>
```

Key rules for generating this guide:
- **Be specific** — say exactly what to click, what input to use, what output to expect
- **Derive steps from the issue** — tailor to the actual changes
- **Always include side effect checks** — logs, generated artifacts, progress reporting

Then **STOP and wait** for user to reply "ok" or report issues.

**After user confirms "ok"** → run telemetry log verification:
```bash
bash ~/.claude/scripts/query-app-insights.sh --minutes 20
```
Analyze traces against the fix. This step is **informational only** — never blocks.

### Scenario 3b — IntelliJ Plugin

Execute the IntelliJ cross-repo verification flow (from the `build-intellij` skill).

```bash
INTELLIJ_BASE="$WS/appmod-intellij"
INTELLIJ_WT="$WS/worktrees/intellij-<task-id>"
```

1. Create or reuse IntelliJ worktree
2. **Build MCP server tgz**: `npm run package` in the VS Code extension worktree
3. **Copy tgz** to IntelliJ worktree
4. **npm install** the tgz: `npm install ./microsoft-github-copilot-app-modernization-mcp-server-*.tgz --registry https://registry.npmjs.org` (the `--registry` override bypasses Azure DevOps feed)
5. **Build IntelliJ plugin**: `./gradlew buildPlugin` (requires Java 21+)
6. **Hand off**: Tell user plugin zip path and installation instructions

Then **STOP and wait** for user to reply with test results.

After user confirms, clean up: `rm "$INTELLIJ_WT/microsoft-github-copilot-app-modernization-mcp-server-"*.tgz`

### Scenario 3c — MCP Server

Build MCP server and configure local Copilot to use it.

1. **Build**: `npm run package-mcp-server`
2. **Backup config**: `cp ~/.copilot/mcp-config.json ~/.copilot/mcp-config.json.bak`
3. **Write config** pointing to worktree build (`mcp-server/dist/entrypoints/index.js`)
4. **Hand off**: Tell user to test via `copilot --allow-all-tools --allow-all-paths` with custom agents

Then **STOP and wait** for user to reply with test results.

After user confirms, restore original config and clean up generated agent files:
```bash
if [ -f ~/.copilot/mcp-config.json.bak ]; then
  mv ~/.copilot/mcp-config.json.bak ~/.copilot/mcp-config.json
else
  rm -f ~/.copilot/mcp-config.json
fi
rm -f ~/.copilot/agents/modernize-azure-java-cli.agent.md
rm -f ~/.copilot/agents/modernize-java-upgrade.agent.md
```

## Output Format

```
## Test Results — Strategy <N>

### Build
- Status: PASS/FAIL
- Fix attempts: N/3

### Unit Tests (if strategy 2/3)
- Impacted tests: <list of test files run>
- Total: X tests | Passed: Y | Failed: Z
- Fix attempts: N/3
- (or "No impacted tests found — skipped")

### Issues Found & Fixed
1. [File] — [What was wrong] — [How it was fixed]

### Remaining Issues (if any)
- [Issue that couldn't be auto-fixed and why]

### Verdict: PASS / FAIL / WAITING FOR MANUAL VERIFY
```
