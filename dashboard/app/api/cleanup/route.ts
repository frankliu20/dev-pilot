import { NextResponse } from 'next/server';
import { existsSync, readdirSync, rmSync } from 'fs';
import { join } from 'path';
import { exec } from 'child_process';
import { getWorkspace, getConfig } from '../../../lib/config';

const HOME = process.env.HOME || process.env.USERPROFILE || '';

/** Find all repo directories (with .git) inside the workspace */
function findAllRepoPaths(): string[] {
  const workspace = getWorkspace();
  const repos: string[] = [];
  try {
    if (existsSync(workspace)) {
      for (const entry of readdirSync(workspace)) {
        const p = join(workspace, entry);
        if (existsSync(join(p, '.git'))) {
          repos.push(p);
        }
      }
    }
  } catch { /* ignore */ }
  return repos;
}

// Fire-and-forget: clean logs synchronously (fast, just file deletes)
// then clean worktrees asynchronously (slow, git commands)
function runCleanup(cleanLogs: boolean, cleanWorktrees: boolean, pullLatest: boolean) {
  const workspace = getWorkspace();
  const repoPaths = findAllRepoPaths();

  // 1. Clean logs — fast, synchronous file deletes
  //    Skip 'pending-decisions' subdirectory (handled separately) to avoid
  //    killing the fs.watch() on that directory, which would break the SSE stream.
  if (cleanLogs) {
    const logDir = join(workspace, 'logs');
    try {
      if (existsSync(logDir)) {
        const entries = readdirSync(logDir);
        for (const entry of entries) {
          if (entry === 'pending-decisions') {
            // Clean decision files inside the directory, but keep the directory itself
            const decDir = join(logDir, 'pending-decisions');
            try {
              for (const f of readdirSync(decDir)) {
                try { rmSync(join(decDir, f), { force: true }); } catch { /* ok */ }
              }
            } catch { /* ok */ }
            continue;
          }
          try {
            rmSync(join(logDir, entry), { recursive: true, force: true });
          } catch { /* best effort */ }
        }
      }
    } catch { /* ignore */ }
  }

  // 2. Clean worktrees — async, git commands can be slow
  if (cleanWorktrees) {
    const worktreeDir = join(workspace, 'worktrees');

    // Remove project worktrees
    if (existsSync(worktreeDir)) {
      const entries = readdirSync(worktreeDir);
      for (const entry of entries) {
        const wtPath = join(worktreeDir, entry);
        // Try each repo as potential parent for the worktree
        let removed = false;
        for (const repoPath of repoPaths) {
          if (!removed) {
            exec(`git worktree remove --force "${wtPath}"`, { cwd: repoPath, timeout: 15000 }, () => {
              try { rmSync(wtPath, { recursive: true, force: true }); } catch { /* ok */ }
            });
            removed = true;
          }
        }
        if (!removed) {
          try { rmSync(wtPath, { recursive: true, force: true }); } catch { /* ok */ }
        }
      }
      // Prune after a delay to let removes finish
      for (const repoPath of repoPaths) {
        setTimeout(() => {
          exec('git worktree prune', { cwd: repoPath, timeout: 10000 }, () => {});
        }, 5000);
      }
    }

    // Clean ~/.claude/worktrees/
    const claudeWorktrees = join(HOME, '.claude', 'worktrees');
    try {
      if (existsSync(claudeWorktrees)) {
        for (const entry of readdirSync(claudeWorktrees)) {
          try { rmSync(join(claudeWorktrees, entry), { recursive: true, force: true }); } catch { /* ok */ }
        }
      }
    } catch { /* ignore */ }
  }

  // 3. Pull latest main on ALL repos — async, after worktree cleanup
  if (pullLatest && repoPaths.length > 0) {
    const delay = cleanWorktrees ? 8000 : 0;
    for (const repoPath of repoPaths) {
      setTimeout(() => {
        exec('git checkout main 2>/dev/null || git checkout master', { cwd: repoPath, timeout: 15000 }, () => {
          exec('git pull origin main 2>/dev/null || git pull origin master', { cwd: repoPath, timeout: 30000 }, () => {});
        });
      }, delay);
    }
  }
}

// Clean a single issue's log and worktree
function runIssueCleanup(issueNumber: number) {
  const workspace = getWorkspace();
  const repoPaths = findAllRepoPaths();

  // 1. Delete log file
  const logFile = join(workspace, 'logs', `issue-${issueNumber}.jsonl`);
  try {
    if (existsSync(logFile)) {
      rmSync(logFile, { force: true });
    }
  } catch { /* best effort */ }

  // 2. Delete worktree
  const wtPath = join(workspace, 'worktrees', `issue-${issueNumber}`);
  if (existsSync(wtPath)) {
    let removed = false;
    for (const repoPath of repoPaths) {
      if (!removed) {
        exec(`git worktree remove --force "${wtPath}"`, { cwd: repoPath, timeout: 15000 }, () => {
          try { rmSync(wtPath, { recursive: true, force: true }); } catch { /* ok */ }
          exec('git worktree prune', { cwd: repoPath, timeout: 10000 }, () => {});
        });
        removed = true;
      }
    }
    if (!removed) {
      try { rmSync(wtPath, { recursive: true, force: true }); } catch { /* ok */ }
    }
  }
}

export async function POST(request: Request) {
  const body = await request.json();
  const { cleanLogs, cleanWorktrees, issueNumber, logOnly } = body;

  // Per-issue cleanup
  if (issueNumber) {
    if (logOnly) {
      console.log(`[cleanup] Cleaning log only for issue #${issueNumber}`);
      // Only delete the log file, preserve worktree
      const workspace = getWorkspace();
      const logFile = join(workspace, 'logs', `issue-${issueNumber}.jsonl`);
      try {
        if (existsSync(logFile)) {
          rmSync(logFile, { force: true });
        }
      } catch { /* best effort */ }
      return NextResponse.json({
        success: true,
        results: [`Log cleaned for issue #${issueNumber}`],
      });
    }
    console.log(`[cleanup] Cleaning log + worktree for issue #${issueNumber}`);
    runIssueCleanup(issueNumber);
    return NextResponse.json({
      success: true,
      results: [`Cleanup started for issue #${issueNumber}`],
    });
  }

  // Global cleanup — clean ALL repos and pull latest
  const config = getConfig();
  const repoCount = findAllRepoPaths().length;
  console.log(`[cleanup] Global cleanup: logs=${cleanLogs}, worktrees=${cleanWorktrees}, repos=${repoCount}`);
  runCleanup(cleanLogs, cleanWorktrees, true);

  return NextResponse.json({
    success: true,
    results: [
      cleanLogs ? 'Logs cleanup started' : null,
      cleanWorktrees ? 'Worktrees cleanup started' : null,
      `Pulling latest main on ${repoCount} repo(s)`,
    ].filter(Boolean),
  });
}
