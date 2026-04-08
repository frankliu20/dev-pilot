'use client';

import { useState, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeRaw from 'rehype-raw';
import { GHIssue, ClaudeTask, TestScenario, REPO_URL } from '@/lib/types';
import { PHASE_CONFIG, ACTIVE_PHASES } from '@/lib/constants';
import { timeAgo, formatTime } from '@/lib/utils';
import Icon from './ui/Icon';
import Badge from './ui/Badge';
import StatusDot from './ui/StatusDot';
import Button from './ui/Button';
import Select from './ui/Select';
import Skeleton from './ui/Skeleton';
import styles from './IssuePanel.module.css';

type FixMode = 'normal' | 'auto';

interface Props {
  issue: GHIssue & { body?: string };
  loading?: boolean;
  tasks: ClaudeTask[];
  onClose: () => void;
  onAssign: (issue: GHIssue, mode: FixMode, force?: boolean, testScenario?: TestScenario) => void;
}

export default function IssuePanel({ issue, loading, tasks, onClose, onAssign }: Props) {
  const [mode, setMode] = useState<FixMode>('auto');
  const [scenario, setScenario] = useState<TestScenario>('vscode');

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  const task = tasks.find(t => t.issueNumber === issue.number);
  const isActive = task ? ACTIVE_PHASES.has(task.phase) : false;
  const isDone = task?.phase === 'done' || task?.phase === 'failed';
  const phaseConfig = task ? PHASE_CONFIG[task.phase] : null;

  return (
    <div className={styles.overlay}>
      <div className={styles.backdrop} onClick={onClose} />
      <div className={styles.panel}>
        <button className={styles.closeBtn} onClick={onClose}>
          <Icon name="x" size={14} />
        </button>

        {/* Breadcrumb */}
        <div className={styles.breadcrumb}>
          <a href="#" onClick={e => { e.preventDefault(); onClose(); }}>Issues</a>
          <Icon name="chevron-right" size={12} />
          <span className={styles.breadcrumbCurrent}>#{issue.number}</span>
        </div>

        {/* Header */}
        <div className={styles.header}>
          <a
            href={`${REPO_URL}/issues/${issue.number}`}
            target="_blank"
            rel="noopener noreferrer"
            className={styles.issueNumber}
          >
            #{issue.number}
          </a>
          <h2 className={styles.title}>{issue.title}</h2>
        </div>

        {/* Status badge */}
        {phaseConfig && (
          <div style={{ marginBottom: 'var(--space-3)' }}>
            <Badge variant={phaseConfig.variant}>
              <Icon name={phaseConfig.icon} size={12} />
              {phaseConfig.label}
            </Badge>
          </div>
        )}

        {/* Meta */}
        <div className={styles.meta}>
          {issue.labels.map(l => (
            <span key={l.name} className={styles.label}>{l.name}</span>
          ))}
          {issue.milestone && (
            <span className={styles.milestone}>{issue.milestone.title}</span>
          )}
          <span className={styles.date}>Updated {new Date(issue.updatedAt).toLocaleDateString()}</span>
        </div>

        {/* Task activity */}
        {task && task.events.length > 0 && (
          <div className={styles.taskCard}>
            <div className={styles.taskCardHeader}>
              <StatusDot variant={phaseConfig?.variant || 'neutral'} pulse={isActive} />
              <span>Task Activity</span>
              {task.prNumber && (
                <a
                  href={`${REPO_URL}/pull/${task.prNumber}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ marginLeft: 'auto', fontSize: 'var(--text-xs)' }}
                >
                  PR #{task.prNumber}
                </a>
              )}
            </div>
            <div className={styles.taskEvents}>
              {task.events.slice().reverse().slice(0, 5).map((ev, i) => (
                <div key={i} className={styles.taskEvent}>
                  <span className={styles.eventTime}>{formatTime(ev.timestamp)}</span>
                  <span className={styles.eventType}>{ev.type}</span>
                  <span className={styles.eventDetail}>{ev.detail}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Body */}
        <div className={styles.body}>
          {loading ? (
            <Skeleton count={6} gap={12} />
          ) : issue.body ? (
            <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeRaw]}>{issue.body}</ReactMarkdown>
          ) : (
            <p className={styles.noBody}>No description provided.</p>
          )}
        </div>

        {/* Actions */}
        <div className={styles.actions}>
          <Select
            value={mode}
            onChange={e => setMode(e.target.value as FixMode)}
            disabled={isActive}
          >
            <option value="normal">Normal</option>
            <option value="auto">Auto</option>
          </Select>
          <Select
            value={scenario}
            onChange={e => setScenario(e.target.value as TestScenario)}
            disabled={isActive}
          >
            <option value="vscode">VS Code</option>
            <option value="intellij">IntelliJ</option>
            <option value="mcp-server">MCP Server</option>
          </Select>
          {isActive ? (
            <Button variant="warning" onClick={() => onAssign(issue, mode, true, scenario)}>
              Force Re-run
            </Button>
          ) : isDone ? (
            <Button variant="warning" onClick={() => onAssign(issue, mode, true, scenario)}>
              Re-run
            </Button>
          ) : (
            <Button variant="primary" onClick={() => onAssign(issue, mode, false, scenario)}>
              Assign to Claude
            </Button>
          )}
          <a
            href={`${REPO_URL}/issues/${issue.number}`}
            target="_blank"
            rel="noopener noreferrer"
            className={styles.githubLink}
          >
            <Icon name="external-link" size={14} />
            GitHub
          </a>
        </div>
      </div>
    </div>
  );
}
