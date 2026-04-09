'use client';

import { ClaudeTask, REPO_URL } from '@/lib/types';
import { useState, useEffect, useCallback, useMemo } from 'react';
import { PHASE_CONFIG, ACTIVE_PHASES, PHASE_PIPELINE } from '@/lib/constants';
import { timeAgo, formatDuration, cn } from '@/lib/utils';
import Icon from './ui/Icon';
import Badge from './ui/Badge';
import StatusDot from './ui/StatusDot';
import Button from './ui/Button';
import ConfirmDialog from './ui/ConfirmDialog';
import EmptyState from './ui/EmptyState';
import styles from './TasksTab.module.css';

interface WorkerEntry {
  taskId: string;
  status: 'running' | 'completed' | 'cancelled';
  phase?: string;
}

interface Props {
  tasks: ClaudeTask[];
  connected: boolean;
  onClean?: (taskId: string) => void;
}

export default function TasksTab({ tasks, connected, onClean }: Props) {
  const [expandedTask, setExpandedTask] = useState<string | null>(null);
  const [showAllEvents, setShowAllEvents] = useState<string | null>(null);
  const [workers, setWorkers] = useState<Map<string, WorkerEntry>>(new Map());
  const [cancelling, setCancelling] = useState<string | null>(null);
  const [confirmCancel, setConfirmCancel] = useState<string | null>(null);
  const [confirmClean, setConfirmClean] = useState<string | null>(null);
  const [now, setNow] = useState(Date.now());

  // Poll registry for worker status
  const fetchRegistry = useCallback(async () => {
    try {
      const res = await fetch('/api/tasks/registry');
      const data = await res.json();
      const map = new Map<string, WorkerEntry>();
      for (const w of data.workers || []) {
        map.set(w.taskId, w);
      }
      setWorkers(map);
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    fetchRegistry();
    const timer = setInterval(fetchRegistry, 10000);
    return () => clearInterval(timer);
  }, [fetchRegistry]);

  // Timer tick for running duration
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  const handleCancel = async (taskId: string) => {
    setConfirmCancel(null);
    setCancelling(taskId);
    try {
      await fetch(`/api/tasks/${taskId}`, { method: 'DELETE' });
      await fetchRegistry();
    } catch {
      // ignore
    } finally {
      setCancelling(null);
    }
  };

  const handleClean = (taskId: string) => {
    setConfirmClean(null);
    if (onClean) onClean(taskId);
  };

  const runningCount = useMemo(() =>
    Array.from(workers.values()).filter(w => w.status === 'running').length,
    [workers]
  );

  const getPipelinePosition = (phase: string): number => {
    const idx = PHASE_PIPELINE.indexOf(phase as any);
    return idx >= 0 ? idx : -1;
  };

  return (
    <div>
      <div className={styles.tabHeader}>
        <h2 className={styles.tabTitle}>Claude Tasks ({tasks.length})</h2>
        <div className={styles.headerRight}>
          {runningCount > 0 && (
            <span className={styles.processCount}>
              <StatusDot variant="success" pulse size="sm" />
              {runningCount} running
            </span>
          )}
        </div>
      </div>

      {tasks.length === 0 ? (
        <EmptyState
          icon="cpu"
          title="No tasks yet"
          description="Assign an issue to Claude to get started. Tasks will appear here with real-time progress tracking."
        />
      ) : (
        <div className={styles.list}>
          {tasks.map(task => {
            const config = PHASE_CONFIG[task.phase] || PHASE_CONFIG.planned;
            const expanded = expandedTask === task.taskId;
            const worker = workers.get(task.taskId);
            const isRunning = worker?.status === 'running';
            const isActive = ACTIVE_PHASES.has(task.phase);
            const pipelinePos = getPipelinePosition(task.phase);
            const isFailed = task.phase === 'failed' || task.phase === 'test_failed';

            // Running duration
            const firstEvent = task.events[0];
            const runningMs = isRunning && firstEvent
              ? now - new Date(firstEvent.timestamp).getTime()
              : 0;

            const eventsToShow = showAllEvents === task.taskId
              ? task.events.slice().reverse()
              : task.events.slice().reverse().slice(0, 10);

            return (
              <div
                key={task.taskId}
                className={styles.taskCard}
                style={{ borderLeftColor: `var(--color-${config.color}-emphasis)` }}
                onClick={() => setExpandedTask(expanded ? null : task.taskId)}
              >
                <div className={styles.taskMain}>
                  {task.issueNumber ? (
                    <a
                      href={`${REPO_URL}/issues/${task.issueNumber}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={styles.issueNumber}
                      onClick={e => e.stopPropagation()}
                    >
                      #{task.issueNumber}
                    </a>
                  ) : (
                    <span className={styles.issueNumber}>{task.taskId}</span>
                  )}
                  <span className={styles.phaseInfo} style={{ color: `var(--color-${config.color}-fg)` }}>
                    <Icon name={config.icon} size={14} />
                    {config.label}
                  </span>
                  {isRunning && (
                    <Badge variant="success" size="sm">
                      <StatusDot variant="success" pulse size="sm" /> active
                    </Badge>
                  )}
                  {task.prNumber && (
                    <a
                      href={`${REPO_URL}/pull/${task.prNumber}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={styles.prLink}
                      onClick={e => e.stopPropagation()}
                    >
                      PR #{task.prNumber}
                    </a>
                  )}
                  {isRunning && (
                    <Button
                      variant="danger"
                      size="sm"
                      onClick={(e) => { e.stopPropagation(); setConfirmCancel(task.taskId); }}
                      disabled={cancelling === task.taskId}
                      style={{ marginLeft: 'auto' }}
                    >
                      {cancelling === task.taskId ? 'Cancelling...' : 'Cancel'}
                    </Button>
                  )}
                  {!isRunning && onClean && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={(e) => { e.stopPropagation(); setConfirmClean(task.taskId); }}
                      style={{ marginLeft: 'auto' }}
                      title="Clean task log"
                    >
                      <Icon name="broom" size={13} /> Clean
                    </Button>
                  )}
                </div>

                {/* Progress pipeline */}
                {isActive && pipelinePos >= 0 && (
                  <div className={styles.pipeline}>
                    {PHASE_PIPELINE.map((p, i) => (
                      <div
                        key={p}
                        className={cn(
                          styles.pipelineStep,
                          i < pipelinePos && styles.completed,
                          i === pipelinePos && (isFailed ? styles.failed : styles.current),
                        )}
                      />
                    ))}
                  </div>
                )}

                <div className={styles.taskMeta}>
                  <span className={styles.taskDetail}>{task.detail}</span>
                  <div style={{ display: 'flex', gap: 'var(--space-2)', alignItems: 'center' }}>
                    {isRunning && runningMs > 0 && (
                      <span className={styles.runningTimer}>
                        <Icon name="clock" size={10} />
                        {formatDuration(runningMs)}
                      </span>
                    )}
                    <span className={styles.taskTime}>{timeAgo(task.lastUpdate)}</span>
                  </div>
                </div>

                {expanded && (
                  <div className={styles.events}>
                    <div className={styles.eventsTitle}>Event Log ({task.events.length})</div>
                    <div className={styles.timeline}>
                      {eventsToShow.map((ev, i) => (
                        <div key={i} className={styles.timelineEvent}>
                          <span className={styles.eventTime}>
                            {new Date(ev.timestamp).toLocaleTimeString()}
                          </span>
                          <span className={styles.eventType}>{ev.type}</span>
                          <span className={styles.eventDetail}>{ev.detail}</span>
                        </div>
                      ))}
                    </div>
                    {task.events.length > 10 && showAllEvents !== task.taskId && (
                      <button
                        className={styles.showAll}
                        onClick={e => { e.stopPropagation(); setShowAllEvents(task.taskId); }}
                      >
                        Show all {task.events.length} events
                      </button>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      <ConfirmDialog
        open={!!confirmCancel}
        title="Cancel Task"
        message="Are you sure you want to cancel this running task? The Claude process will be terminated."
        confirmLabel="Cancel Task"
        cancelLabel="Keep Running"
        variant="danger"
        onConfirm={() => confirmCancel && handleCancel(confirmCancel)}
        onCancel={() => setConfirmCancel(null)}
      />
      <ConfirmDialog
        open={!!confirmClean}
        title="Clean Task Log"
        message="This will delete the task's log file, removing it from the task list. The git worktree (if any) will be preserved."
        confirmLabel="Clean"
        cancelLabel="Cancel"
        variant="warning"
        onConfirm={() => confirmClean && handleClean(confirmClean)}
        onCancel={() => setConfirmClean(null)}
      />
    </div>
  );
}
