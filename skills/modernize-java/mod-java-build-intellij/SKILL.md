---
name: build-intellij
description: Cross-repo verification workflow. Trigger when user asks to verify, test, or validate MCP server changes against the IntelliJ plugin (appmod-intellij).
---

## Verify MCP Server Changes Against IntelliJ Plugin

Build the MCP server from a VS Code extension worktree, install it into the IntelliJ plugin, build the plugin, and hand off to the user for manual testing.

### Input

The user specifies **which worktree** contains the MCP server changes. Examples:
- `/build-intellij pr-5098`
- "verify against IntelliJ using issue-4976"

If no worktree is specified, use AskUserQuestion to ask:
> Which worktree has the MCP server changes you want to verify?

### Setup

```bash
WS=$(grep '^workspace:' ~/.claude/pilot.yaml | awk '{print $2}' | sed "s|^~|$HOME|")
WORKTREE="$WS/worktrees/<worktree-name>"
INTELLIJ_BASE="$WS/appmod-intellij"
INTELLIJ_WT="$WS/worktrees/intellij-<task-id>"
```

- `<worktree-name>` is the VS Code extension worktree with MCP server changes (e.g., `issue-4976`, `pr-5098`)
- `<task-id>` matches the extension worktree's issue/PR id (e.g., `intellij-issue-4976`)

#### Verify extension worktree exists:
```bash
ls "$WORKTREE/package.json" || { echo "❌ Extension worktree not found"; exit 1; }
```

#### Create or reuse IntelliJ worktree:
```bash
cd "$INTELLIJ_BASE"
if git worktree list | grep -q "intellij-<task-id>"; then
  echo "✅ Reusing existing IntelliJ worktree"
  cd "$INTELLIJ_WT"
  git pull origin main
else
  git fetch origin
  git worktree add "$INTELLIJ_WT" origin/main
  cd "$INTELLIJ_WT"
fi
```

**If `$INTELLIJ_BASE` does not exist, STOP and tell the user to clone appmod-intellij first.**

---

### Step 1: Build MCP Server tgz

```bash
cd "$WORKTREE"
npm run package
```

**Success**: `$WORKTREE/mcp-server/microsoft-github-copilot-app-modernization-mcp-server-*.tgz` exists.

**On failure**: Report build errors. Common fix: run `npm install` first, then retry.

---

### Step 2: Copy tgz to IntelliJ worktree

```bash
cp "$WORKTREE/mcp-server/microsoft-github-copilot-app-modernization-mcp-server-"*.tgz "$INTELLIJ_WT/"
```

---

### Step 3: npm install the tgz

```bash
cd "$INTELLIJ_WT"
npm install ./microsoft-github-copilot-app-modernization-mcp-server-*.tgz --registry https://registry.npmjs.org
```

> **Why `--registry`?** The `.npmrc` in appmod-intellij points to a private Azure DevOps feed requiring auth. Override to public registry since the tgz is local — nothing is fetched remotely.

**On failure**: If auth errors persist, confirm `--registry` flag is included. If dependency resolution errors, try adding `--legacy-peer-deps`.

---

### Step 4: Build IntelliJ Plugin

**Prerequisite**: Java 21+ (`java -version`). If not available, STOP and tell the user.

```bash
cd "$INTELLIJ_WT"
./gradlew buildPlugin
```

This takes several minutes (downloads Node.js runtimes, compiles Java/Kotlin, packages plugin).

**Success**: `$INTELLIJ_WT/build/distributions/appmod-intellij-*.zip` exists. Store the path:
```bash
PLUGIN_ZIP=$(ls "$INTELLIJ_WT/build/distributions/appmod-intellij-"*.zip | head -1)
```

**On failure**:
- Compilation errors → report Gradle output, likely API incompatibility with new MCP server
- `npmInstall` errors → Step 3 may not have completed correctly

---

### Step 5: Hand Off to User

Tell the user the exact plugin zip path and installation steps:

```
IntelliJ plugin built successfully!

Plugin zip: <full path>

To install and test:
1. Open IntelliJ IDEA
2. Settings → Plugins → (gear icon) → Install Plugin from Disk...
3. Select the zip file above
4. Restart IntelliJ when prompted
5. Test the MCP server changes
```

Use AskUserQuestion to collect test results:
- **Pass** — verification complete, offer to clean up (`rm "$INTELLIJ_WT/microsoft-github-copilot-app-modernization-mcp-server-"*.tgz`)
- **Fail** — ask for details and help debug

---

### Quick Reference

| Step | Command | CWD | Output |
|------|---------|-----|--------|
| 0 | `git worktree add` (if needed) | appmod-intellij | `$WS/worktrees/intellij-<task-id>` |
| 1 | `npm run package` | extension worktree | `mcp-server/*.tgz` |
| 2 | `cp` tgz | — | tgz in IntelliJ worktree |
| 3 | `npm install ./...tgz --registry https://registry.npmjs.org` | IntelliJ worktree | node_modules updated |
| 4 | `./gradlew buildPlugin` | IntelliJ worktree | `build/distributions/*.zip` |
| 5 | User installs in IntelliJ | — | Manual test feedback |
