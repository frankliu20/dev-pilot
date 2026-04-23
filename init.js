#!/usr/bin/env node

/**
 * Dev Pilot — Init Script
 *
 * Reads pilot.yaml config, then installs the framework (commands, agents, hooks)
 * into ~/.claude/. Claude-native commands go to ~/.claude/commands/.
 * Copilot-specific commands (where they differ) go to ~/.copilot/commands/.
 *
 * Usage:
 *   node init.js                          # Interactive setup
 *   node init.js --force                  # Overwrite framework files (preserves pilot.yaml/CLAUDE.md)
 *   node init.js --config <path>          # Use a specific pilot.yaml (e.g., modernize-java-pilot.yaml)
 *   node init.js --workspace <path>       # Non-interactive workspace path
 *   node init.js --repo <owner/repo>      # Non-interactive primary repo
 */

const fs = require('fs');
const path = require('path');
const os = require('os');
const readline = require('readline');
const { execSync } = require('child_process');

// --- Config ---
const CLAUDE_DIR = path.join(os.homedir(), '.claude');
const COPILOT_DIR = path.join(os.homedir(), '.copilot');
const PILOT_YAML = path.join(CLAUDE_DIR, 'pilot.yaml');
const SRC_DIR = __dirname;
const force = process.argv.includes('--force');

// Parse flags
function getFlag(name) {
  const idx = process.argv.indexOf(name);
  return (idx !== -1 && process.argv[idx + 1]) ? process.argv[idx + 1] : null;
}

const configArg = getFlag('--config');
const workspaceArg = getFlag('--workspace');
const repoArg = getFlag('--repo');

// Counters
let installed = 0;
let skipped = 0;
let created = 0;

// --- Helpers ---

function ensureDir(dirPath) {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
    created++;
    console.log(`  [CREATE] ${dirPath}`);
  }
}

function copyFile(src, dest, neverOverwrite = false) {
  if (fs.existsSync(dest) && (neverOverwrite || !force)) {
    const relDest = path.relative(CLAUDE_DIR, dest);
    console.log(`  [SKIP]   ${relDest} (already exists)`);
    skipped++;
    return;
  }
  ensureDir(path.dirname(dest));
  fs.copyFileSync(src, dest);
  const relDest = path.relative(CLAUDE_DIR, dest);
  console.log(`  [INSTALL] ${relDest}`);
  installed++;
}

function copyDir(srcDir, destDir) {
  if (!fs.existsSync(srcDir)) {
    console.log(`  [WARN]   Source not found: ${srcDir}`);
    return;
  }
  const entries = fs.readdirSync(srcDir, { withFileTypes: true });
  for (const entry of entries) {
    const srcPath = path.join(srcDir, entry.name);
    const destPath = path.join(destDir, entry.name);
    if (entry.isDirectory()) {
      copyDir(srcPath, destPath);
    } else {
      copyFile(srcPath, destPath);
    }
  }
}

function askQuestion(query) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise(resolve => {
    rl.question(query, answer => {
      rl.close();
      resolve(answer.trim());
    });
  });
}

/**
 * Simple YAML parser — extracts top-level and one-level nested keys.
 * No external dependencies required. Handles:
 *   key: value
 *   key:
 *     - item1
 *     - item2
 *   parent:
 *     child: value
 */
function parseSimpleYaml(content) {
  const result = {};
  let currentKey = null;
  let currentObj = null;

  for (const rawLine of content.split('\n')) {
    // Skip comments and blank lines
    if (rawLine.trim() === '' || rawLine.trim().startsWith('#')) continue;

    const indent = rawLine.length - rawLine.trimStart().length;
    const line = rawLine.trim();

    if (indent === 0 && line.includes(':')) {
      // Top-level key
      const colonIdx = line.indexOf(':');
      const key = line.substring(0, colonIdx).trim();
      const value = line.substring(colonIdx + 1).trim();

      if (value === '' || value === '[]') {
        // Could be a list or nested object
        currentKey = key;
        result[key] = value === '[]' ? [] : undefined;
        currentObj = null;
      } else {
        result[key] = value;
        currentKey = key;
        currentObj = null;
      }
    } else if (indent > 0 && line.startsWith('- ')) {
      // List item
      if (currentKey && !Array.isArray(result[currentKey])) {
        result[currentKey] = [];
      }
      if (currentKey) {
        result[currentKey].push(line.substring(2).trim());
      }
    } else if (indent > 0 && line.includes(':') && currentKey) {
      // Nested key-value
      if (result[currentKey] === undefined) {
        result[currentKey] = {};
      }
      if (typeof result[currentKey] === 'object' && !Array.isArray(result[currentKey])) {
        const colonIdx = line.indexOf(':');
        const childKey = line.substring(0, colonIdx).trim();
        const childValue = line.substring(colonIdx + 1).trim();
        result[currentKey][childKey] = childValue;
      }
    }
  }

  return result;
}

function writeYaml(config) {
  let yaml = '# Dev Pilot Configuration\n\n';
  yaml += `workspace: ${config.workspace}\n\n`;
  yaml += 'repos:\n';
  for (const repo of (config.repos || [])) {
    yaml += `  - ${repo}\n`;
  }
  yaml += `\nchat_language: ${config.chat_language || 'English'}\n`;
  if (config.build) {
    yaml += '\nbuild:\n';
    for (const [key, value] of Object.entries(config.build)) {
      yaml += `  ${key}: ${value}\n`;
    }
  }
  return yaml;
}

// --- Main ---

async function main() {
  console.log('');
  console.log('Dev Pilot — Setup');
  console.log('=================');
  console.log(`Target: ${CLAUDE_DIR}`);
  console.log(`Mode:   ${force ? 'FORCE (overwrite framework files)' : 'Safe (skip existing)'}`);
  console.log('');

  // 1. Ensure ~/.claude exists
  ensureDir(CLAUDE_DIR);

  // 2. Determine pilot.yaml
  let config;

  if (configArg) {
    // Use specified config file
    const configPath = path.resolve(configArg);
    if (!fs.existsSync(configPath)) {
      console.error(`  [ERROR] Config file not found: ${configPath}`);
      process.exit(1);
    }
    console.log(`Config: Using ${configPath}`);
    const content = fs.readFileSync(configPath, 'utf-8');
    config = parseSimpleYaml(content);
    // Copy to ~/.claude/pilot.yaml
    fs.copyFileSync(configPath, PILOT_YAML);
    console.log(`  [INSTALL] pilot.yaml (from ${path.basename(configPath)})`);
    installed++;
  } else if (fs.existsSync(PILOT_YAML) && !force) {
    // Existing config — reuse
    console.log('Config: Using existing ~/.claude/pilot.yaml');
    const content = fs.readFileSync(PILOT_YAML, 'utf-8');
    config = parseSimpleYaml(content);
  } else {
    // Interactive setup — create new pilot.yaml
    console.log('Config: Creating new pilot.yaml');
    config = {};

    // Workspace
    const defaultWs = path.join(os.homedir(), 'claude', 'workspace');
    if (workspaceArg) {
      config.workspace = path.resolve(workspaceArg);
    } else {
      const answer = await askQuestion(`  Workspace directory [${defaultWs}]: `);
      config.workspace = answer || defaultWs;
    }
    config.workspace = path.resolve(config.workspace);

    // Repos
    config.repos = [];
    if (repoArg) {
      config.repos.push(repoArg);
    } else {
      console.log('  Add GitHub repos (owner/repo format). Empty line to finish:');
      while (true) {
        const repo = await askQuestion('    repo: ');
        if (!repo) break;
        config.repos.push(repo);
      }
    }

    // Write pilot.yaml
    const yamlContent = writeYaml(config);
    fs.writeFileSync(PILOT_YAML, yamlContent, 'utf-8');
    console.log(`  [INSTALL] pilot.yaml`);
    installed++;
  }

  console.log(`  Workspace:  ${config.workspace}`);
  console.log(`  Repos:      ${(config.repos || []).join(', ') || '(none)'}`);
  console.log('');

  // 3. Ensure workspace directory exists
  const workspace = path.resolve(config.workspace.replace(/^~/, os.homedir()));
  ensureDir(workspace);
  ensureDir(path.join(workspace, 'logs'));

  // 4. Install framework — commands (dual-platform)
  console.log('Commands (Claude Code):');
  const claudeCommandsSrc = path.join(SRC_DIR, 'framework', 'commands', 'claude');
  const commandsDest = path.join(CLAUDE_DIR, 'commands');
  ensureDir(commandsDest);
  if (fs.existsSync(claudeCommandsSrc)) {
    const files = fs.readdirSync(claudeCommandsSrc).filter(f => f.endsWith('.md'));
    for (const file of files) {
      copyFile(path.join(claudeCommandsSrc, file), path.join(commandsDest, file));
    }
  }
  console.log('');

  // 4b. Install Copilot-specific commands (where they differ or are unique)
  console.log('Commands (Copilot CLI):');
  const copilotCommandsSrc = path.join(SRC_DIR, 'framework', 'commands', 'copilot');
  const copilotCommandsDest = path.join(COPILOT_DIR, 'commands');
  if (fs.existsSync(copilotCommandsSrc)) {
    const copilotFiles = fs.readdirSync(copilotCommandsSrc).filter(f => f.endsWith('.md'));
    let copiedCount = 0;
    for (const file of copilotFiles) {
      const claudeVersion = path.join(claudeCommandsSrc, file);
      const copilotVersion = path.join(copilotCommandsSrc, file);
      // Skip if identical claude version exists — Copilot reads ~/.claude/ for those
      if (fs.existsSync(claudeVersion)) {
        const claudeContent = fs.readFileSync(claudeVersion, 'utf-8');
        const copilotContent = fs.readFileSync(copilotVersion, 'utf-8');
        if (claudeContent === copilotContent) continue;
      }
      // Different or copilot-only → copy to ~/.copilot/
      ensureDir(copilotCommandsDest);
      copyFile(copilotVersion, path.join(copilotCommandsDest, file));
      copiedCount++;
    }
    if (copiedCount === 0) {
      console.log('  (no differences — Copilot uses ~/.claude/ commands)');
    }
  }
  console.log('');

  // 5. Install framework — agents (shared by both Claude and Copilot)
  console.log('Agents:');
  const agentsSrc = path.join(SRC_DIR, 'framework', 'agents');
  const agentsDest = path.join(CLAUDE_DIR, 'agents');
  ensureDir(agentsDest);
  if (fs.existsSync(agentsSrc)) {
    const files = fs.readdirSync(agentsSrc).filter(f => f.endsWith('.md'));
    for (const file of files) {
      copyFile(path.join(agentsSrc, file), path.join(agentsDest, file));
    }
  }
  console.log('');

  // 6. CLAUDE.md template (never overwrite)
  console.log('CLAUDE.md:');
  const claudeMdSrc = path.join(SRC_DIR, 'framework', 'templates', 'claude-md-template.md');
  const claudeMdDest = path.join(CLAUDE_DIR, 'CLAUDE.md');
  if (fs.existsSync(claudeMdSrc)) {
    if (fs.existsSync(claudeMdDest)) {
      console.log('  [SKIP]   CLAUDE.md (already exists — never overwritten)');
      skipped++;
    } else {
      // Replace {{REPO}} placeholder with first repo
      let template = fs.readFileSync(claudeMdSrc, 'utf-8');
      const primaryRepo = (config.repos && config.repos[0]) || 'your-org/your-repo';
      const chatLang = config.chat_language || 'English';
      template = template.replace(/\{\{REPO\}\}/g, primaryRepo);
      template = template.replace(/\{\{CHAT_LANGUAGE\}\}/g, chatLang);
      fs.writeFileSync(claudeMdDest, template, 'utf-8');
      console.log('  [INSTALL] CLAUDE.md');
      installed++;
    }
  }
  console.log('');

  // 7. Install git hooks into this repo
  console.log('Git hooks:');
  const hooksSrc = path.join(SRC_DIR, 'framework', 'hooks');
  const selfGitHooks = path.join(SRC_DIR, '.git', 'hooks');
  if (fs.existsSync(hooksSrc) && fs.existsSync(selfGitHooks)) {
    const hookFiles = fs.readdirSync(hooksSrc).filter(f => !f.startsWith('.'));
    for (const hookFile of hookFiles) {
      const dest = path.join(selfGitHooks, hookFile);
      const src = path.join(hooksSrc, hookFile);
      if (fs.existsSync(dest) && !force) {
        console.log(`  [SKIP]   .git/hooks/${hookFile} (already exists)`);
        skipped++;
      } else {
        fs.copyFileSync(src, dest);
        try { fs.chmodSync(dest, 0o755); } catch { /* Windows may not support chmod */ }
        console.log(`  [INSTALL] .git/hooks/${hookFile}`);
        installed++;
      }
    }
  } else {
    console.log('  (no hooks found)');
  }
  console.log('');

  // 8. Clone repos (optional)
  if (config.repos && config.repos.length > 0) {
    console.log('Repos:');
    for (const repo of config.repos) {
      const repoName = repo.split('/').pop();
      const repoDir = path.join(workspace, repoName);
      if (fs.existsSync(repoDir)) {
        console.log(`  [SKIP]   ${repoName} (already exists at ${repoDir})`);
      } else {
        const clone = workspaceArg || configArg
          ? 'y'  // Non-interactive: auto-clone
          : await askQuestion(`  Clone ${repo}? (Y/n): `);
        if (clone.toLowerCase() !== 'n') {
          const gitUrl = `https://github.com/${repo}.git`;
          console.log(`  [CLONE]  ${gitUrl}`);
          try {
            execSync(`git clone ${gitUrl}`, { cwd: workspace, stdio: 'inherit' });
            console.log(`  [OK]     ${repoName} cloned`);
          } catch (err) {
            console.error(`  [ERROR]  Clone failed: ${err.message}`);
          }
        }
      }
    }
    console.log('');
  }

  // --- Summary ---
  console.log('=================');
  console.log('Done!');
  console.log(`  Installed:  ${installed} files`);
  if (skipped > 0) {
    console.log(`  Skipped:    ${skipped} files (use --force to overwrite)`);
  }
  if (created > 0) {
    console.log(`  Created:    ${created} directories`);
  }
  console.log(`  Workspace:  ${workspace}`);
  console.log(`  Config:     ${PILOT_YAML}`);
  console.log('');
  console.log('Next steps:');
  console.log('  1. Review ~/.claude/pilot.yaml and customize as needed');
  console.log('  2. Review ~/.claude/CLAUDE.md for your preferences');
  console.log('  3. Configure ~/.claude/settings.json (see README.md)');
  console.log('  4. Run /pilot-dev-issue <issue-url> to start developing!');
  console.log('');
}

main().catch(err => {
  console.error('Init failed:', err);
  process.exit(1);
});
