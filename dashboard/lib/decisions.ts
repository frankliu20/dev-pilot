// Read and watch pending-decisions/ directory for decision request files
// Also reads JSONL logs for decision_requested events as a fallback source.
// Two data sources are merged and deduplicated by taskId:
//   1. JSON files in pending-decisions/ (written by PR monitor, some agent prompts)
//   2. JSONL decision_requested events (written by pilot-dev-issue phases)
// A decision is considered resolved when the task has a newer non-decision event.

import { readFileSync, readdirSync, existsSync, mkdirSync, unlinkSync, appendFileSync, watch } from 'fs';
import { join } from 'path';
import { DecisionRequest } from './types';
import { deriveTasks } from './statusLog';
import { getWorkspace } from './config';

function getDecisionsDir(): string {
  return join(getWorkspace(), 'logs', 'pending-decisions');
}

/** Set of dismissed taskIds tracked via JSONL decision_dismissed events */
function getDismissedSet(): Set<string> {
  const tasks = deriveTasks();
  const dismissed = new Set<string>();
  for (const task of tasks) {
    for (const ev of task.events) {
      if (ev.type === 'decision_dismissed') {
        dismissed.add(ev.task_id);
      }
    }
  }
  return dismissed;
}

export function readPendingDecisions(): DecisionRequest[] {
  const tasks = deriveTasks();
  const dismissed = getDismissedSet();

  // Build a map: taskId → { lastUpdate (non-decision), lastDecisionEvent }
  const taskInfo = new Map<string, { lastNonDecision: string; lastUpdate: string }>();
  for (const t of tasks) {
    // Find last non-decision event timestamp (to determine if decision is stale)
    let lastNonDecision = '';
    for (const ev of t.events) {
      if (ev.type !== 'decision_requested' && ev.type !== 'decision_dismissed') {
        lastNonDecision = ev.timestamp;
      }
    }
    taskInfo.set(t.taskId, { lastNonDecision, lastUpdate: t.lastUpdate });
  }

  const decisionsMap = new Map<string, DecisionRequest>();

  // Source 1: JSON files in pending-decisions/ (PR notifications, etc.)
  const dir = getDecisionsDir();
  if (existsSync(dir)) {
    const files = readdirSync(dir).filter(f => f.endsWith('.json'));
    for (const file of files) {
      const filePath = join(dir, file);
      try {
        const content = readFileSync(filePath, 'utf-8');
        const decision: DecisionRequest = JSON.parse(content);

        // Auto-dismiss: task has progressed past this decision
        const info = taskInfo.get(decision.taskId);
        if (info && decision.timestamp && info.lastNonDecision > decision.timestamp) {
          try { unlinkSync(filePath); } catch { /* ignore */ }
          continue;
        }

        decisionsMap.set(decision.taskId, decision);
      } catch { /* skip malformed files */ }
    }
  }

  // Source 2: JSONL decision_requested events (fallback when JSON file is missing)
  for (const task of tasks) {
    // Skip if already have a JSON-file decision for this task
    if (decisionsMap.has(task.taskId)) continue;
    // Skip if dismissed
    if (dismissed.has(task.taskId)) continue;

    // Find the last decision_requested event
    let lastDecision: typeof task.events[0] | null = null;
    for (const ev of task.events) {
      if (ev.type === 'decision_requested') {
        lastDecision = ev;
      }
    }
    if (!lastDecision) continue;

    // Check if the task has progressed past this decision (non-decision event after it)
    const info = taskInfo.get(task.taskId);
    if (info && info.lastNonDecision > lastDecision.timestamp) continue;

    // Build a DecisionRequest from the JSONL event
    const issueMatch = task.taskId.match(/^issue-(\d+)$/);
    decisionsMap.set(task.taskId, {
      taskId: task.taskId,
      issueNumber: issueMatch ? parseInt(issueMatch[1]) : null,
      prNumber: lastDecision.pr_number ?? null,
      phase: lastDecision.phase || '',
      question: lastDecision.detail || 'Agent is waiting for your response',
      options: [],
      context: '',
      timestamp: lastDecision.timestamp,
    });
  }

  // Sort by timestamp, newest first
  return Array.from(decisionsMap.values())
    .sort((a, b) => (b.timestamp || '').localeCompare(a.timestamp || ''));
}

export function dismissDecision(taskId: string): boolean {
  // Try to delete JSON file first (for PR notifications etc.)
  const dir = getDecisionsDir();
  let fileDeleted = false;
  if (existsSync(dir)) {
    const files = readdirSync(dir).filter(f => f.endsWith('.json'));
    for (const file of files) {
      const filePath = join(dir, file);
      try {
        const content = readFileSync(filePath, 'utf-8');
        const decision: DecisionRequest = JSON.parse(content);
        if (decision.taskId === taskId) {
          unlinkSync(filePath);
          fileDeleted = true;
          break;
        }
      } catch { /* skip */ }
    }
  }

  // Also write a decision_dismissed event to JSONL (handles JSONL-sourced decisions)
  const workspace = getWorkspace();
  const logFile = join(workspace, 'logs', `${taskId}.jsonl`);
  if (existsSync(logFile)) {
    try {
      const event = JSON.stringify({
        timestamp: new Date().toISOString(),
        task_id: taskId,
        type: 'decision_dismissed',
        phase: '',
        branch: '',
        pr_number: null,
        status: 'dismissed',
        detail: 'Decision dismissed from dashboard',
      });
      appendFileSync(logFile, event + '\n');
      return true;
    } catch { /* best effort */ }
  }

  return fileDeleted;
}

export function watchDecisions(callback: () => void): () => void {
  const dir = getDecisionsDir();

  // Ensure directory exists so fs.watch doesn't fail
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }

  let timer: ReturnType<typeof setTimeout> | null = null;
  const debounced = () => {
    if (timer) clearTimeout(timer);
    timer = setTimeout(callback, 300);
  };

  const watcher = watch(dir, (_eventType, filename) => {
    if (filename && filename.endsWith('.json')) {
      debounced();
    }
  });

  // If the directory is deleted (e.g. during cleanup), the watcher emits an error.
  // Recreate the directory so subsequent writes still land correctly.
  watcher.on('error', () => {
    try {
      if (!existsSync(dir)) {
        mkdirSync(dir, { recursive: true });
      }
    } catch { /* best effort */ }
  });

  return () => {
    if (timer) clearTimeout(timer);
    watcher.close();
  };
}
