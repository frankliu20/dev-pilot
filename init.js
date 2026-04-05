#!/usr/bin/env node

/**
 * AI Engineering Team Toolkit — Init Script
 *
 * Copies commands, agents, skills, blueprint, and CLAUDE.md template
 * into the user's ~/.claude/ directory. Sets up a workspace directory
 * for logs and runtime data (keeping ~/.claude/ clean).
 *
 * Usage:
 *   node init.js                        # Interactive install
 *   node init.js --force                # Overwrite existing files
 *   node init.js --workspace /path/dir  # Non-interactive workspace path
 */

const fs = require('fs');
const path = require('path');
const os = require('os');
const readline = require('readline');

// --- Config ---
const CLAUDE_DIR = path.join(os.homedir(), '.claude');
const WORKSPACE_FILE = path.join(CLAUDE_DIR, '.mod-workspace');
const SRC_DIR = __dirname;
const force = process.argv.includes('--force');

// Parse --workspace flag
let workspaceArg = null;
const wsIdx = process.argv.indexOf('--workspace');
if (wsIdx !== -1 && process.argv[wsIdx + 1]) {
  workspaceArg = process.argv[wsIdx + 1];
}

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

function copyFile(src, dest) {
  if (fs.existsSync(dest) && !force) {
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

// --- Main ---

async function main() {
  console.log('');
  console.log('AI Engineering Team Toolkit - Init');
  console.log('==================================');
  console.log(`Target: ${CLAUDE_DIR}`);
  console.log(`Mode:   ${force ? 'FORCE (overwrite existing)' : 'Safe (skip existing)'}`);
  console.log('');

  // 1. Ensure ~/.claude exists
  ensureDir(CLAUDE_DIR);

  // 2. Workspace directory setup
  console.log('Workspace:');
  let workspace;

  if (workspaceArg) {
    // Non-interactive: use --workspace flag
    workspace = path.resolve(workspaceArg);
  } else if (fs.existsSync(WORKSPACE_FILE)) {
    // Already configured
    const existing = fs.readFileSync(WORKSPACE_FILE, 'utf-8').trim();
    console.log(`  Current workspace: ${existing}`);
    const answer = await askQuestion(`  Change workspace? (Enter new path or press Enter to keep): `);
    workspace = answer || existing;
  } else {
    // First time — ask user
    const defaultWs = path.join(os.homedir(), 'claude', 'workspace');
    const answer = await askQuestion(`  Enter workspace directory [${defaultWs}]: `);
    workspace = answer || defaultWs;
  }

  workspace = path.resolve(workspace);
  ensureDir(workspace);
  ensureDir(path.join(workspace, 'logs'));
  fs.writeFileSync(WORKSPACE_FILE, workspace + '\n', 'utf-8');
  console.log(`  [SET]    Workspace: ${workspace}`);
  console.log(`  [SET]    Saved to: ${WORKSPACE_FILE}`);
  console.log('');

  // 3. Commands
  console.log('Commands:');
  const commandsSrc = path.join(SRC_DIR, 'commands');
  const commandsDest = path.join(CLAUDE_DIR, 'commands');
  ensureDir(commandsDest);
  if (fs.existsSync(commandsSrc)) {
    const files = fs.readdirSync(commandsSrc).filter(f => f.endsWith('.md'));
    for (const file of files) {
      copyFile(path.join(commandsSrc, file), path.join(commandsDest, file));
    }
  }
  console.log('');

  // 4. Agents
  console.log('Agents:');
  const agentsSrc = path.join(SRC_DIR, 'agents');
  const agentsDest = path.join(CLAUDE_DIR, 'agents');
  ensureDir(agentsDest);
  if (fs.existsSync(agentsSrc)) {
    const files = fs.readdirSync(agentsSrc).filter(f => f.endsWith('.md'));
    for (const file of files) {
      copyFile(path.join(agentsSrc, file), path.join(agentsDest, file));
    }
  }
  console.log('');

  // 5. Skills
  console.log('Skills:');
  const skillsSrc = path.join(SRC_DIR, 'skills');
  const skillsDest = path.join(CLAUDE_DIR, 'skills');
  ensureDir(skillsDest);
  if (fs.existsSync(skillsSrc)) {
    const skillDirs = fs.readdirSync(skillsSrc, { withFileTypes: true })
      .filter(d => d.isDirectory());
    for (const dir of skillDirs) {
      copyDir(path.join(skillsSrc, dir.name), path.join(skillsDest, dir.name));
    }
  }
  console.log('');

  // 6. Blueprint
  console.log('Blueprint:');
  const blueprintSrc = path.join(SRC_DIR, 'blueprint.md');
  if (fs.existsSync(blueprintSrc)) {
    copyFile(blueprintSrc, path.join(CLAUDE_DIR, 'blueprint.md'));
  }
  console.log('');

  // 7. CLAUDE.md template (only if not exists — never overwrite user's custom CLAUDE.md)
  console.log('CLAUDE.md:');
  const claudeMdSrc = path.join(SRC_DIR, 'claude-md-template.md');
  const claudeMdDest = path.join(CLAUDE_DIR, 'CLAUDE.md');
  if (fs.existsSync(claudeMdSrc)) {
    if (fs.existsSync(claudeMdDest)) {
      console.log('  [SKIP]   CLAUDE.md (already exists — will not overwrite even with --force)');
      skipped++;
    } else {
      copyFile(claudeMdSrc, claudeMdDest);
    }
  }
  console.log('');

  // --- Summary ---
  console.log('==================================');
  console.log('Done!');
  console.log(`  Installed:  ${installed} files`);
  if (skipped > 0) {
    console.log(`  Skipped:    ${skipped} files (use --force to overwrite)`);
  }
  if (created > 0) {
    console.log(`  Created:    ${created} directories`);
  }
  console.log(`  Workspace:  ${workspace}`);
  console.log('');
  console.log('Next steps:');
  console.log('  1. Review and customize ~/.claude/CLAUDE.md for your preferences');
  console.log('  2. Configure ~/.claude/settings.json with your permissions (see README.md)');
  console.log('  3. cd dashboard && npm install && npm run dev');
  console.log('  4. Open http://localhost:3000');
  console.log('');
}

main().catch(err => {
  console.error('Init failed:', err);
  process.exit(1);
});
