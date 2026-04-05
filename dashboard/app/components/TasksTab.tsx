'use client';

import { ClaudeTask, TaskPhase, REPO_URL } from '@/lib/types';
import { useState } from 'react';

interface Props {
  tasks: ClaudeTask[];
  connected: boolean;
}

const PHASE_DISPLAY: Record<TaskPhase, { icon: string; text: string; color: string }> = {
  planned: { icon: '\ud83d\udccb', text: 'Planned', color: '#6b7280' },
  analyzing: { icon: '\ud83d\udd0d', text: 'Analyzing', color: '#3b82f6' },
  exploring: { icon: '\ud83e\udded', text: 'Exploring', color: '#3b82f6' },
  planning: { icon: '\ud83d\udcdd', text: 'Planning', color: '#8b5cf6' },
  implementing: { icon: '\u2699\ufe0f', text: 'Implementing', color: '#3b82f6' },
  testing: { icon: '\ud83e\uddea', text: 'Testing', color: '#f59e0b' },
  test_failed: { icon: '\u274c', text: 'Test Failed', color: '#ef4444' },
  waiting_confirm: { icon: '\u26a0\ufe0f', text: 'Waiting Confirm', color: '#f59e0b' },
  waiting_manual_test: { icon: '\ud83d\udc40', text: 'Waiting Manual Test', color: '#f59e0b' },
  creating_pr: { icon: '\ud83d\ude80', text: 'Creating PR', color: '#8b5cf6' },
  done: { icon: '\u2705', text: 'Done', color: '#10b981' },
  failed: { icon: '\ud83d\udca5', text: 'Failed', color: '#ef4444' },
};

function timeAgo(timestamp: string): string {
  const diff = Date.now() - new Date(timestamp).getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

export default function TasksTab({ tasks, connected }: Props) {
  const [expandedTask, setExpandedTask] = useState<string | null>(null);

  return (
    <div className="tab-content">
      <div className="tab-header">
        <h2>Claude Tasks ({tasks.length})</h2>
        <span className={`connection-dot ${connected ? 'connected' : ''}`}>
          {connected ? 'Live' : 'Connecting...'}
        </span>
      </div>
      {tasks.length === 0 ? (
        <div className="empty">No tasks yet. Assign an issue to Claude to get started.</div>
      ) : (
        <div className="list">
          {tasks.map(task => {
            const display = PHASE_DISPLAY[task.phase] || PHASE_DISPLAY.planned;
            const expanded = expandedTask === task.taskId;
            return (
              <div
                key={task.taskId}
                className="list-item task-item"
                style={{ borderLeftColor: display.color }}
                onClick={() => setExpandedTask(expanded ? null : task.taskId)}
              >
                <div className="item-main">
                  {task.issueNumber ? (
                    <a
                      href={`${REPO_URL}/issues/${task.issueNumber}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="item-number"
                      onClick={e => e.stopPropagation()}
                    >
                      #{task.issueNumber}
                    </a>
                  ) : (
                    <span className="item-number">{task.taskId}</span>
                  )}
                  <span className="task-phase" style={{ color: display.color }}>
                    {display.icon} {display.text}
                  </span>
                  {task.prNumber && (
                    <a
                      href={`${REPO_URL}/pull/${task.prNumber}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="pr-link"
                      onClick={e => e.stopPropagation()}
                    >
                      PR #{task.prNumber}
                    </a>
                  )}
                </div>
                <div className="item-meta">
                  <span className="task-detail">{task.detail}</span>
                  <span className="task-time">{timeAgo(task.lastUpdate)}</span>
                </div>
                {expanded && (
                  <div className="task-events">
                    <div className="events-title">Event Log ({task.events.length})</div>
                    {task.events.slice().reverse().slice(0, 20).map((ev, i) => (
                      <div key={i} className="event-line">
                        <span className="event-time">
                          {new Date(ev.timestamp).toLocaleTimeString()}
                        </span>
                        <span className="event-type">{ev.type}</span>
                        <span className="event-detail">{ev.detail}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
