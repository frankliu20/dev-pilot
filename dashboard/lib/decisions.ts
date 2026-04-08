// Read and watch pending-decisions/ directory for decision request files
// Each file is a JSON object written by Claude agents when they need user input
// Auto-cleans stale decisions when the task has moved past the waiting state

import { readFileSync, readdirSync, existsSync, mkdirSync, unlinkSync, watch } from 'fs';
import { join } from 'path';
import { DecisionRequest } from './types';
import { deriveTasks } from './statusLog';
import { getWorkspace } from './config';

function getDecisionsDir(): string {
  return join(getWorkspace(), 'logs', 'pending-decisions');
}

export function readPendingDecisions(): DecisionRequest[] {
  const dir = getDecisionsDir();
  if (!existsSync(dir)) return [];

  const files = readdirSync(dir).filter(f => f.endsWith('.json'));
  if (files.length === 0) return [];

  // Get current task states to auto-dismiss stale decisions
  const tasks = deriveTasks();
  const taskLastEvent = new Map<string, string>();
  for (const t of tasks) {
    taskLastEvent.set(t.taskId, t.lastUpdate);
  }

  const decisions: DecisionRequest[] = [];

  for (const file of files) {
    const filePath = join(dir, file);
    try {
      const content = readFileSync(filePath, 'utf-8');
      const decision: DecisionRequest = JSON.parse(content);

      // Auto-dismiss: if the task has a newer event than the decision,
      // the agent has moved on (user already responded in terminal)
      const lastUpdate = taskLastEvent.get(decision.taskId);
      if (lastUpdate && decision.timestamp && lastUpdate > decision.timestamp) {
        try { unlinkSync(filePath); } catch { /* ignore */ }
        continue;
      }

      decisions.push(decision);
    } catch { /* skip malformed files */ }
  }

  // Sort by timestamp, newest first
  return decisions.sort((a, b) => (b.timestamp || '').localeCompare(a.timestamp || ''));
}

export function dismissDecision(taskId: string): boolean {
  const dir = getDecisionsDir();
  const files = readdirSync(dir).filter(f => f.endsWith('.json'));

  for (const file of files) {
    const filePath = join(dir, file);
    try {
      const content = readFileSync(filePath, 'utf-8');
      const decision: DecisionRequest = JSON.parse(content);
      if (decision.taskId === taskId) {
        unlinkSync(filePath);
        return true;
      }
    } catch { /* skip */ }
  }
  return false;
}

export function watchDecisions(callback: () => void): () => void {
  const dir = getDecisionsDir();

  // Ensure directory exists so fs.watch doesn't fail
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }

  const watcher = watch(dir, (_eventType, filename) => {
    if (filename && filename.endsWith('.json')) {
      callback();
    }
  });

  return () => watcher.close();
}
