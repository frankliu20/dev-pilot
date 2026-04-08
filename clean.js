#!/usr/bin/env node

/**
 * Dev Pilot — Workspace Cleanup Script
 *
 * Reads workspace path from ~/.claude/pilot.yaml, then cleans up:
 *   1. Deleting all log files
 *   2. Removing all git worktrees
 *   3. Resetting repos to origin/main (or origin/master)
 *   4. Discarding all uncommitted changes
 *
 * Usage:
 *   node clean.js            # Dry-run (show what would happen)
 *   node clean.js --force    # Execute cleanup
 */

const fs = require('fs');
const path = require('path');
const os = require('os');
const { execSync } = require('child_process');

// --- Config ---
const CLAUDE_DIR = path.join(os.homedir(), '.claude');
const PILOT_YAML = path.join(CLAUDE_DIR, 'pilot.yaml');
const WORKTREES_DIR = path.join(CLAUDE_DIR, 'worktrees');
const force = process.argv.includes('--force');

// Counters
let deleted = 0;
let removed = 0;
let reset = 0;

// --- Helpers ---

function run(cmd, opts = {}) {
  try {
    return execSync(cmd, { encoding: 'utf-8', stdio: 'pipe', ...opts }).trim();
  } catch (err) {
    return null;
  }
}

function rmrf(target) {
  if (fs.existsSync(target)) {
    fs.rmSync(target, { recursive: true, force: true });
  }
}

function findGitRepos(dir) {
  const repos = [];
  if (!fs.existsSync(dir)) return repos;
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const full = path.join(dir, entry.name);
    if (fs.existsSync(path.join(full, '.git'))) {
      repos.push(full);
    }
  }
  return repos;
}

function getDefaultBranch(repoDir) {
  // Try main first, then master
  const branches = run('git branch -a', { cwd: repoDir }) || '';
  if (branches.includes('remotes/origin/main')) return 'main';
  if (branches.includes('remotes/origin/master')) return 'master';
  return 'main'; // fallback
}

// --- Main ---

function main() {
  console.log('');
  console.log('Workspace Cleanup');
  console.log('==================================');
  console.log(`Mode:   ${force ? 'FORCE (executing cleanup)' : 'DRY-RUN (use --force to execute)'}`);
  console.log('');

  // 1. Read workspace path from pilot.yaml
  if (!fs.existsSync(PILOT_YAML)) {
    console.error('[ERROR] pilot.yaml not found. Run init.js first.');
    process.exit(1);
  }
  const yamlContent = fs.readFileSync(PILOT_YAML, 'utf-8');
  const wsMatch = yamlContent.match(/^workspace:\s*(.+)$/m);
  if (!wsMatch) {
    console.error('[ERROR] No workspace field found in pilot.yaml.');
    process.exit(1);
  }
  const workspace = wsMatch[1].trim().replace(/^~/, os.homedir());
  console.log(`Workspace: ${workspace}`);
  console.log('');

  // 2. Clean logs
  console.log('Logs:');
  const logsDir = path.join(workspace, 'logs');
  if (fs.existsSync(logsDir)) {
    const logEntries = fs.readdirSync(logsDir);
    let logCount = 0;
    for (const entry of logEntries) {
      const entryPath = path.join(logsDir, entry);
      const isDir = fs.statSync(entryPath).isDirectory();
      if (isDir) {
        console.log(`  [DELETE] logs/${entry}/ (directory)`);
      } else {
        console.log(`  [DELETE] logs/${entry}`);
      }
      if (force) {
        rmrf(entryPath);
      }
      logCount++;
      deleted++;
    }
    if (logCount === 0) {
      console.log('  [OK]     No log files to clean');
    }
  } else {
    console.log('  [OK]     Logs directory does not exist');
  }
  console.log('');

  // 3. Clean worktrees
  console.log('Worktrees:');
  let hasWorktrees = false;

  // 3a. Git worktrees inside workspace repos
  const repos = findGitRepos(workspace);
  for (const repo of repos) {
    const repoName = path.basename(repo);
    const output = run('git worktree list --porcelain', { cwd: repo });
    if (!output) continue;

    // Parse worktree list — each block starts with "worktree <path>"
    const blocks = output.split('\n\n').filter(Boolean);
    for (const block of blocks) {
      const lines = block.split('\n');
      const wtPath = lines[0]?.replace('worktree ', '');
      if (!wtPath) continue;
      // Skip the main worktree (the repo itself)
      if (path.resolve(wtPath) === path.resolve(repo)) continue;

      hasWorktrees = true;
      console.log(`  [REMOVE] ${repoName} worktree: ${wtPath}`);
      if (force) {
        run(`git worktree remove --force "${wtPath}"`, { cwd: repo });
      }
      removed++;
    }
  }

  // 3b. Claude's own worktrees directory
  if (fs.existsSync(WORKTREES_DIR)) {
    const wtEntries = fs.readdirSync(WORKTREES_DIR);
    for (const entry of wtEntries) {
      const wtPath = path.join(WORKTREES_DIR, entry);
      if (fs.statSync(wtPath).isDirectory()) {
        hasWorktrees = true;
        console.log(`  [REMOVE] .claude/worktrees/${entry}`);
        if (force) {
          rmrf(wtPath);
        }
        removed++;
      }
    }
  }

  if (!hasWorktrees) {
    console.log('  [OK]     No worktrees to clean');
  }
  console.log('');

  // 4. Reset repos to origin/main
  console.log('Repositories:');
  if (repos.length === 0) {
    console.log('  [OK]     No repositories found');
  }
  for (const repo of repos) {
    const repoName = path.basename(repo);
    const branch = getDefaultBranch(repo);

    console.log(`  [FETCH]    ${repoName}`);
    if (force) {
      run('git fetch origin', { cwd: repo });
    }

    console.log(`  [CHECKOUT] ${repoName} -> ${branch}`);
    if (force) {
      run(`git checkout ${branch}`, { cwd: repo });
    }

    console.log(`  [RESET]    ${repoName} -> origin/${branch}`);
    if (force) {
      run(`git reset --hard origin/${branch}`, { cwd: repo });
    }

    console.log(`  [CLEAN]    ${repoName} (untracked files)`);
    if (force) {
      run('git clean -fd', { cwd: repo });
    }

    reset++;
  }
  console.log('');

  // --- Summary ---
  console.log('==================================');
  if (!force) {
    console.log('DRY-RUN complete. No changes were made.');
    console.log('Run with --force to execute cleanup.');
  } else {
    console.log('Done!');
  }
  console.log(`  Deleted:  ${deleted} log file(s)`);
  console.log(`  Removed:  ${removed} worktree(s)`);
  console.log(`  Reset:    ${reset} repository(ies)`);
  console.log('');
}

main();
