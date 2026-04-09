// Read per-task JSONL log files and derive task states
// Each task has its own log file: logs/<task_id>.jsonl (e.g., issue-123.jsonl)
// Cross-task summary events go to logs/summary.jsonl

import { readFileSync, readdirSync, existsSync, watch } from 'fs';
import { join } from 'path';
import { StatusLogEntry, ClaudeTask, TaskPhase } from './types';
import { getWorkspace } from './config';

function getLogDir(): string {
  return join(getWorkspace(), 'logs');
}

export function getLogDirPath(): string {
  return getLogDir();
}

export function readAllEntries(): StatusLogEntry[] {
  const dir = getLogDir();
  if (!existsSync(dir)) return [];
  const files = readdirSync(dir).filter(f => f.endsWith('.jsonl'));
  const entries: StatusLogEntry[] = [];
  for (const file of files) {
    const content = readFileSync(join(dir, file), 'utf-8');
    for (const line of content.trim().split('\n')) {
      if (!line.trim()) continue;
      try {
        entries.push(JSON.parse(line));
      } catch { /* skip malformed lines */ }
    }
  }
  return entries;
}

// Map event type to task phase
function eventToPhase(type: string): TaskPhase | null {
  switch (type) {
    case 'task_start': return 'planned';
    case 'analysis_done': return 'exploring';
    case 'exploration_done': return 'planning';
    case 'plan_approved': return 'implementing';
    case 'implementation_done': return 'testing';
    case 'test_pass': return 'creating_pr';
    case 'test_fail': return 'test_failed';
    case 'manual_verify_waiting': return 'waiting_manual_test';
    case 'manual_verify_done': return 'creating_pr';
    case 'pr_created': return 'done';
    case 'pr_merged': return 'done';
    case 'worktree_cleaned': return 'done';
    case 'skill_captured': return 'done';
    case 'blocked': return 'failed';
    // Dashboard-written events
    case 'phase_change': return 'planned'; // will be overridden by phase field
    // Non-phase-changing events — return null to keep previous phase
    case 'decision_requested': return null;
    case 'decision_dismissed': return null;
    default: return 'planned';
  }
}

export function deriveTasks(): ClaudeTask[] {
  const entries = readAllEntries();
  const taskMap = new Map<string, StatusLogEntry[]>();

  for (const entry of entries) {
    const existing = taskMap.get(entry.task_id) || [];
    existing.push(entry);
    taskMap.set(entry.task_id, existing);
  }

  const tasks: ClaudeTask[] = [];
  for (const [taskId, events] of taskMap) {
    const sorted = events.sort((a, b) => a.timestamp.localeCompare(b.timestamp));

    // Find last event that affects phase (skip decision_requested/decision_dismissed)
    let last = sorted[sorted.length - 1];
    let phaseEvent = last;
    for (let i = sorted.length - 1; i >= 0; i--) {
      if (eventToPhase(sorted[i].type) !== null) {
        phaseEvent = sorted[i];
        break;
      }
    }

    // Extract issue number from task_id like "issue-5126"
    const issueMatch = taskId.match(/^issue-(\d+)$/);
    const issueNumber = issueMatch ? parseInt(issueMatch[1]) : null;

    // Determine phase from last phase-changing event
    let phase = eventToPhase(phaseEvent.type) || 'planned';
    // If the event has a phase field that maps better, use it
    if (phaseEvent.phase) {
      const phaseMap: Record<string, TaskPhase> = {
        'branch_setup': 'planned',
        'analysis': 'analyzing',
        'exploration': 'exploring',
        'planning': 'planning',
        'implementation': 'implementing',
        'testing': 'testing',
        'pr_creation': 'creating_pr',
        'pr_monitor': phase, // keep current
        'knowledge_capture': 'done',
        'completed': 'done',
        'failed': 'failed',
      };
      if (phaseMap[phaseEvent.phase] !== undefined) {
        phase = phaseMap[phaseEvent.phase];
      }
    }

    // Override with specific event types
    if (phaseEvent.type === 'pr_created') phase = 'done';
    if (phaseEvent.type === 'test_fail') phase = 'test_failed';
    if (phaseEvent.type === 'blocked') phase = 'failed';
    if (phaseEvent.type === 'manual_verify_waiting') phase = 'waiting_manual_test';

    tasks.push({
      taskId,
      issueNumber,
      phase,
      branch: last.branch || '',
      prNumber: last.pr_number ?? null,
      lastUpdate: last.timestamp,
      detail: last.detail || '',
      events: sorted,
    });
  }

  // Sort by last update, newest first
  return tasks.sort((a, b) => b.lastUpdate.localeCompare(a.lastUpdate));
}

// Watch for changes in the logs directory (debounced to avoid storm during bulk deletes)
export function watchStatusLog(callback: () => void): () => void {
  const dir = getLogDir();
  let timer: ReturnType<typeof setTimeout> | null = null;
  const debounced = () => {
    if (timer) clearTimeout(timer);
    timer = setTimeout(callback, 300);
  };
  const watcher = watch(dir, (_eventType, filename) => {
    if (filename && filename.endsWith('.jsonl')) {
      debounced();
    }
  });
  return () => {
    if (timer) clearTimeout(timer);
    watcher.close();
  };
}
