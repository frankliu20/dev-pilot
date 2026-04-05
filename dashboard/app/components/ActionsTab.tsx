'use client';

import { useState } from 'react';
import { DecisionRequest, REPO_URL } from '@/lib/types';
import { PHASE_CONFIG } from '@/lib/constants';
import { timeAgo } from '@/lib/utils';
import Icon from './ui/Icon';
import Badge from './ui/Badge';
import Button from './ui/Button';
import EmptyState from './ui/EmptyState';
import styles from './ActionsTab.module.css';

interface Props {
  decisions: DecisionRequest[];
  onDismiss: (taskId: string) => void;
  onFixComments?: (prNumber: number) => void;
  onReview?: (prNumber: number) => void;
}

function taskLabel(d: DecisionRequest): { text: string; url: string | null } {
  if (d.prNumber) {
    return { text: `PR #${d.prNumber}`, url: `${REPO_URL}/pull/${d.prNumber}` };
  }
  if (d.issueNumber) {
    return { text: `#${d.issueNumber}`, url: `${REPO_URL}/issues/${d.issueNumber}` };
  }
  return { text: d.taskId, url: null };
}

function isPRNotification(d: DecisionRequest): boolean {
  return d.phase === 'pr_notification';
}

export default function ActionsTab({ decisions, onDismiss, onFixComments, onReview }: Props) {
  const [confirmDismiss, setConfirmDismiss] = useState<string | null>(null);

  const handleDismiss = (taskId: string) => {
    if (confirmDismiss === taskId) {
      onDismiss(taskId);
      setConfirmDismiss(null);
    } else {
      setConfirmDismiss(taskId);
      // Auto-reset after 3 seconds
      setTimeout(() => setConfirmDismiss(prev => prev === taskId ? null : prev), 3000);
    }
  };

  // Sort most recent first
  const sorted = [...decisions].sort((a, b) =>
    new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
  );

  return (
    <div>
      <div className={styles.tabHeader}>
        <h2 className={styles.tabTitle}>Action Needed ({decisions.length})</h2>
      </div>

      {sorted.length === 0 ? (
        <EmptyState
          icon="check-circle"
          title="All clear"
          description="No pending decisions. All agents are running autonomously."
        />
      ) : (
        <div className={styles.list}>
          {sorted.map(d => {
            const label = taskLabel(d);
            const isPR = isPRNotification(d);
            const phaseConfig = !isPR && d.phase ? PHASE_CONFIG[d.phase as keyof typeof PHASE_CONFIG] : null;

            return (
              <div key={d.taskId} className={isPR ? styles.actionCardPR : styles.actionCard}>
                <div className={styles.actionHeader}>
                  <div className={styles.actionTask}>
                    {label.url ? (
                      <a href={label.url} target="_blank" rel="noopener noreferrer" className={styles.taskNumber}>
                        {label.text}
                      </a>
                    ) : (
                      <span className={styles.taskNumber}>{label.text}</span>
                    )}
                    {isPR && (
                      <Badge variant="info" size="sm">
                        <Icon name="git-pull-request" size={10} />
                        PR Update
                      </Badge>
                    )}
                    {phaseConfig && (
                      <Badge variant={phaseConfig.variant} size="sm">
                        <Icon name={phaseConfig.icon} size={10} />
                        {phaseConfig.label}
                      </Badge>
                    )}
                    <span style={{ fontSize: 'var(--text-2xs)', color: 'var(--color-fg-subtle)' }}>
                      {timeAgo(d.timestamp)}
                    </span>
                  </div>
                  {confirmDismiss === d.taskId ? (
                    <div className={styles.dismissConfirm}>
                      <span>Dismiss?</span>
                      <Button variant="danger" size="sm" onClick={() => handleDismiss(d.taskId)}>
                        Confirm
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => setConfirmDismiss(null)}>
                        No
                      </Button>
                    </div>
                  ) : (
                    <Button variant="ghost" size="sm" onClick={() => handleDismiss(d.taskId)}>
                      Dismiss
                    </Button>
                  )}
                </div>

                <div className={styles.question}>{d.question}</div>

                {d.context && <div className={styles.context}>{d.context}</div>}

                {isPR && d.prNumber ? (
                  <div className={styles.prActions}>
                    {onFixComments && (
                      <Button variant="warning" size="sm" onClick={() => onFixComments(d.prNumber!)}>
                        <Icon name="message-circle" size={14} />
                        Fix Comments
                      </Button>
                    )}
                    {onReview && (
                      <Button variant="info" size="sm" onClick={() => onReview(d.prNumber!)}>
                        <Icon name="eye" size={14} />
                        Review
                      </Button>
                    )}
                    <a
                      href={`${REPO_URL}/pull/${d.prNumber}`}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      <Button variant="ghost" size="sm">
                        <Icon name="external-link" size={14} />
                        View on GitHub
                      </Button>
                    </a>
                  </div>
                ) : (
                  <>
                    {d.options.length > 0 && (
                      <div className={styles.options}>
                        {d.options.map((opt, i) => (
                          <span key={i} className={styles.option}>{opt}</span>
                        ))}
                      </div>
                    )}
                    <div className={styles.hint}>
                      <Icon name="terminal" size={14} className={styles.hintIcon} />
                      Switch to the terminal to respond to this decision
                    </div>
                  </>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
