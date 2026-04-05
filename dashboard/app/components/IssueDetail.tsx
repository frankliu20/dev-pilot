'use client';

import { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { GHIssue, ClaudeTask, TaskPhase, REPO_URL } from '@/lib/types';

type FixMode = 'normal' | 'auto';

const ACTIVE_PHASES: Set<TaskPhase> = new Set([
  'planned', 'analyzing', 'exploring', 'planning',
  'implementing', 'testing', 'test_failed',
  'waiting_confirm', 'waiting_manual_test', 'creating_pr',
]);

const PHASE_DISPLAY: Record<TaskPhase, { icon: string; text: string; color: string }> = {
  planned: { icon: '\ud83d\udccb', text: 'Planned', color: '#6b7280' },
  analyzing: { icon: '\ud83d\udd0d', text: 'Analyzing', color: '#3b82f6' },
  exploring: { icon: '\ud83e\udded', text: 'Exploring', color: '#3b82f6' },
  planning: { icon: '\ud83d\udcdd', text: 'Planning', color: '#8b5cf6' },
  implementing: { icon: '\u2699\ufe0f', text: 'Implementing', color: '#3b82f6' },
  testing: { icon: '\ud83e\uddea', text: 'Testing', color: '#f59e0b' },
  test_failed: { icon: '\u274c', text: 'Test Failed', color: '#ef4444' },
  waiting_confirm: { icon: '\u26a0\ufe0f', text: 'Waiting', color: '#f59e0b' },
  waiting_manual_test: { icon: '\ud83d\udc40', text: 'Manual Test', color: '#f59e0b' },
  creating_pr: { icon: '\ud83d\ude80', text: 'Creating PR', color: '#8b5cf6' },
  done: { icon: '\u2705', text: 'Done', color: '#10b981' },
  failed: { icon: '\ud83d\udca5', text: 'Failed', color: '#ef4444' },
};

interface Props {
  issue: GHIssue & { body?: string };
  loading?: boolean;
  tasks: ClaudeTask[];
  onBack: () => void;
  onAssign: (issue: GHIssue, mode: FixMode, force?: boolean) => void;
}

export default function IssueDetail({ issue, loading, tasks, onBack, onAssign }: Props) {
  const [mode, setMode] = useState<FixMode>('normal');

  const task = tasks.find(t => t.issueNumber === issue.number);
  const isActive = task ? ACTIVE_PHASES.has(task.phase) : false;
  const display = task ? PHASE_DISPLAY[task.phase] : null;

  return (
    <div className="detail-view">
      <button onClick={onBack} className="back-btn">{'\u2190'} Back to issues</button>

      <div className="detail-header">
        <a
          href={`${REPO_URL}/issues/${issue.number}`}
          target="_blank"
          rel="noopener noreferrer"
          className="detail-number"
        >
          #{issue.number}
        </a>
        <h2 className="detail-title">{issue.title}</h2>
        {display && (
          <span className="task-status-badge" style={{ color: display.color }}>
            {display.icon} {display.text}
          </span>
        )}
      </div>

      <div className="detail-meta">
        {issue.labels.map(l => (
          <span key={l.name} className="label">{l.name}</span>
        ))}
        {issue.milestone && (
          <span className="milestone">{issue.milestone.title}</span>
        )}
        <span className="detail-date">Updated {new Date(issue.updatedAt).toLocaleDateString()}</span>
      </div>

      <div className="detail-body">
        {loading ? (
          <div className="loading-body">Loading issue body...</div>
        ) : issue.body ? (
          <ReactMarkdown remarkPlugins={[remarkGfm]}>{issue.body}</ReactMarkdown>
        ) : (
          <p className="no-body">No description provided.</p>
        )}
      </div>

      <div className="detail-actions">
        <select
          className="mode-select"
          value={mode}
          onChange={e => setMode(e.target.value as FixMode)}
        >
          <option value="normal">Normal</option>
          <option value="auto">Auto</option>
        </select>
        {isActive ? (
          <button className="assign-btn large force-rerun" onClick={() => onAssign(issue, mode, true)}>
            Force Re-run
          </button>
        ) : (
          <button className="assign-btn large" onClick={() => onAssign(issue, mode)}>
            Assign to Claude
          </button>
        )}
        <a
          href={`${REPO_URL}/issues/${issue.number}`}
          target="_blank"
          rel="noopener noreferrer"
          className="github-link"
        >
          View on GitHub
        </a>
      </div>
    </div>
  );
}
