// Task Registry — tracks assigned Claude tasks
// Uses JSONL log phase (not PID) to determine if a task is running,
// because on Windows wt.exe is a launcher that exits immediately.

import { openClaudeTerminal } from './terminal';
import { deriveTasks } from './statusLog';
import { TaskPhase, TestScenario, CliTool, CLI_TOOL_CONFIG } from './types';

export interface WorkerEntry {
  taskId: string;       // e.g. "issue-5113"
  issueUrl: string;
  startedAt: string;    // ISO timestamp
  status: 'running' | 'completed' | 'cancelled';
  phase?: TaskPhase;    // current phase from JSONL log
}

// Terminal phases = task is still active
const TERMINAL_PHASES: Set<TaskPhase> = new Set(['done', 'failed']);

class TaskRegistry {
  private workers = new Map<string, WorkerEntry>();

  /**
   * Assign an issue to Claude. Opens a terminal and tracks the task.
   * Returns 'already_running' if this taskId is still active (based on log phase).
   */
  assign(taskId: string, issueUrl: string, mode: 'normal' | 'auto' = 'normal', force: boolean = false, testScenario?: TestScenario, cliTool: CliTool = 'claude'): { result: 'started' | 'already_running'; entry?: WorkerEntry; error?: string } {
    // Refresh status from JSONL logs
    this.refreshFromLogs();

    const existing = this.workers.get(taskId);
    if (existing && existing.status === 'running' && !force) {
      return { result: 'already_running', entry: existing };
    }

    const termResult = openClaudeTerminal({
      issueUrl,
      mode,
      testScenario,
      cliTool,
    });
    if (!termResult.success) {
      return { result: 'started', error: termResult.error || 'Failed to spawn terminal' };
    }

    const entry: WorkerEntry = {
      taskId,
      issueUrl,
      startedAt: new Date().toISOString(),
      status: 'running',
    };

    this.workers.set(taskId, entry);
    return { result: 'started', entry };
  }

  /**
   * Cancel a running task. On Windows, find and kill claude processes
   * with the matching issue URL in their command line.
   */
  cancel(taskId: string, cliTool: CliTool = 'claude'): boolean {
    const entry = this.workers.get(taskId);
    if (!entry || entry.status !== 'running') {
      return false;
    }

    const procName = CLI_TOOL_CONFIG[cliTool].processName;

    try {
      if (process.platform === 'win32') {
        // Find cli processes with matching issue in command line
        const { execSync } = require('child_process');
        const issueNumber = taskId.replace('issue-', '');
        try {
          // Use wmic to find processes whose command line contains the issue number
          const result = execSync(
            `wmic process where "name='${procName}' and commandline like '%${issueNumber}%'" get processid /format:list`,
            { encoding: 'utf-8', stdio: ['pipe', 'pipe', 'pipe'] }
          );
          const pids = result.match(/ProcessId=(\d+)/g)?.map((m: string) => m.split('=')[1]) || [];
          for (const pid of pids) {
            execSync(`taskkill /pid ${pid} /T /F`, { stdio: 'ignore' });
          }
        } catch {
          // wmic might fail, try tasklist approach
        }
      } else {
        const { execSync } = require('child_process');
        const issueNumber = taskId.replace('issue-', '');
        const binaryName = CLI_TOOL_CONFIG[cliTool].binary;
        try {
          execSync(`pkill -f "${binaryName}.*${issueNumber}"`, { stdio: 'ignore' });
        } catch { /* process may not exist */ }
      }
      entry.status = 'cancelled';
      return true;
    } catch {
      entry.status = 'cancelled';
      return true;
    }
  }

  /**
   * Get all tracked workers, refreshing status from JSONL logs.
   */
  getAll(): WorkerEntry[] {
    this.refreshFromLogs();
    return Array.from(this.workers.values());
  }

  /**
   * Check if a specific task is currently running.
   */
  isRunning(taskId: string): boolean {
    this.refreshFromLogs();
    const entry = this.workers.get(taskId);
    return entry?.status === 'running' || false;
  }

  /**
   * Refresh worker status by checking JSONL log phases.
   * If log shows a terminal phase (done/failed), mark worker as completed.
   */
  private refreshFromLogs(): void {
    try {
      const tasks = deriveTasks();
      const taskPhases = new Map(tasks.map(t => [t.taskId, t.phase]));

      for (const [taskId, entry] of this.workers) {
        if (entry.status !== 'running') continue;

        const phase = taskPhases.get(taskId);
        if (phase) {
          entry.phase = phase;
          if (TERMINAL_PHASES.has(phase)) {
            entry.status = 'completed';
          }
        }
      }
    } catch {
      // Log reading failed, keep current status
    }
  }
}

// Singleton instance
export const registry = new TaskRegistry();
