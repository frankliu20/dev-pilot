---
name: test-vscode-wsl
description: Package, install, and launch the VS Code extension in WSL Remote mode for Linux testing. Trigger when user asks to test extension in WSL or Linux.
---

## Test VS Code Extension in WSL

Package the extension as VSIX, install it into WSL, and open a project in VS Code WSL Remote mode.

### Prerequisites

- WSL with Ubuntu installed (`wsl --list --verbose`)
- Java 11+ and Maven in WSL (`/etc/profile.d/java.sh`)
- A sample Java project available (default: `~/asset-manager` in WSL)

### Configuration

```bash
WS=$(grep '^workspace:' ~/.claude/pilot.yaml | awk '{print $2}' | sed "s|^~|$HOME|")
```

The extension source is in the current worktree (or `$WS/azure-java-migration-copilot-vscode-extension` if no worktree).

### Step 1: Verify WSL Environment

```bash
wsl --list --verbose
wsl bash -lc "source /etc/profile.d/java.sh 2>/dev/null; java -version && mvn -version"
```

If WSL is not installed or Java/Maven missing, STOP and tell the user what's needed:
- No WSL → `wsl --install -d Ubuntu`
- No Java → `sudo apt-get install -y openjdk-11-jdk openjdk-21-jdk`
- No Maven → `sudo apt-get install -y maven`
- No `/etc/profile.d/java.sh` → create it with JAVA_HOME_11, JAVA_HOME_21, JAVA_HOME

### Step 2: Package VSIX

```bash
cd <worktree-or-repo-path>
npm install
npm run build
npx vsce package --no-dependencies
```

Output: `migrate-java-to-azure-*.vsix` in the worktree root.

**On failure**: Usually missing dependencies — run `npm install` first.

### Step 3: Install VSIX

Three things to do:

#### 3a. Remove old marketplace versions from WSL side

```bash
wsl bash -c "ls ~/.vscode-server/extensions/ | grep migrate"
```

If there are versions with `-linux-x64` suffix (marketplace versions), remove them:
```bash
wsl bash -c "rm -rf ~/.vscode-server/extensions/vscjava.migrate-java-to-azure-*-linux-x64"
```

> **Why?** VS Code prefers higher-version marketplace builds over local VSIX. The marketplace version won't have your changes.

#### 3b. Install VSIX on Windows side

```bash
code --install-extension "<vsix-path>" --force
```

#### 3c. Install VSIX on WSL side

```bash
wsl bash -c "code --install-extension '/mnt/c/<windows-path-to-vsix>' --force"
```

Then verify the installed version on WSL side:
```bash
wsl bash -c "ls ~/.vscode-server/extensions/ | grep migrate"
```

Should show only `vscjava.migrate-java-to-azure-0.1.0` (or your version), no `-linux-x64` suffix versions.

### Step 4: Prepare Sample Project

If no sample project exists in WSL:
```bash
wsl bash -c "ls ~/asset-manager/pom.xml 2>/dev/null || echo 'NOT FOUND'"
```

If not found, copy from Windows:
```bash
wsl bash -c "cp -r '/mnt/c/<path-to-sample-project>' ~/asset-manager && chmod +x ~/asset-manager/mvnw"
```

Default sample: `C:\Users\haital\code\asa-migration\sample\java-migration-copilot-samples\asset-manager`

### Step 5: Launch VS Code in WSL Remote Mode

```bash
code --folder-uri "vscode-remote://wsl+Ubuntu/home/<wsl-user>/asset-manager"
```

Get WSL username:
```bash
WSL_USER=$(wsl bash -c "whoami")
```

### Step 6: Hand Off to User

Tell the user:

```
VS Code extension installed and project opened in WSL Remote mode.

Next steps:
1. Confirm left-bottom corner shows "WSL: Ubuntu"
2. Ctrl+Shift+P → "Developer: Reload Window" to activate the new extension version
3. Test your scenario in the WSL environment
```

Then STOP and wait for user feedback.

### Troubleshooting

| Problem | Cause | Fix |
|---------|-------|-----|
| Extension not activating in WSL | Old marketplace version still installed | Step 3a — remove `-linux-x64` versions |
| `code --folder-uri` opens but says workspace not found | Wrong WSL path | Verify path exists: `wsl bash -c "ls <path>"` |
| VSIX install says success but WSL has old version | `code --install-extension` from WSL installs to Windows | Use `wsl bash -c "code ..."` to install WSL-side |
| Hook scripts not deployed | Extension `copyHookScripts()` can't find `src/` in extension dir | Check `wsl bash -c "ls ~/.vscode-server/extensions/vscjava.migrate-java-to-azure-*/src/"` |
| Java not found in VS Code terminal | `/etc/profile.d/java.sh` not sourced by VS Code | Add Java exports to `~/.bashrc` after the non-interactive guard |
