'use client';

import { useState, useCallback } from 'react';
import Icon from './ui/Icon';
import Badge from './ui/Badge';
import Button from './ui/Button';
import Skeleton from './ui/Skeleton';
import EmptyState from './ui/EmptyState';
import { useToast } from './ui/Toast';
import styles from './ReportTab.module.css';

// ── Shared types ──

interface CommitInfo {
  hash: string;
  message: string;
}

interface CompletedIssue {
  number: number;
  title: string;
  closedAt: string;
  url: string;
  linkedPR: { number: number; url: string } | null;
}

interface MergedPR {
  number: number;
  title: string;
  mergedAt: string;
  url: string;
}

interface OpenPR {
  number: number;
  title: string;
  url: string;
  action: string;
  reviewDecision: string;
  isDraft: boolean;
}

interface CarryOverIssue {
  number: number;
  title: string;
  url: string;
  labels: string[];
  isBacklog: boolean;
}

interface DayReport {
  date: string;
  commits: CommitInfo[];
  completedIssues: CompletedIssue[];
  mergedPRs: MergedPR[];
  openPRs: OpenPR[];
  carryOver: CarryOverIssue[];
  stats: {
    issuesClosed: number;
    prsMerged: number;
    prsOpen: number;
    commits: number;
  };
}

interface ScrumItem {
  number: number;
  title: string;
  url: string;
  status: 'done' | 'ongoing' | 'blocker';
  summary: string;
  kind: 'issue' | 'pr';
  linkedIssue?: number;
  linkedPR?: { number: number; url: string };
}

interface ScrumMark {
  timestamp: string;
  label: string;
}

interface ScrumReport {
  date: string;
  lastScrum: ScrumMark | null;
  sinceDate: string;
  done: ScrumItem[];
  ongoing: ScrumItem[];
  blockers: ScrumItem[];
}

type SubView = 'report' | 'scrum';

const ACTION_BADGE: Record<string, { label: string; variant: 'success' | 'warning' | 'danger' | 'info' | 'purple' }> = {
  ready_to_merge:    { label: 'Ready to merge', variant: 'success' },
  review_pending:    { label: 'Review pending', variant: 'warning' },
  ci_failing:        { label: 'CI failing',     variant: 'danger' },
  changes_requested: { label: 'Changes req.',   variant: 'danger' },
  draft:             { label: 'Draft',          variant: 'info' },
  waiting:           { label: 'Waiting',        variant: 'info' },
};

const SCRUM_STATUS_ICON: Record<string, { icon: string; cls: string; label: string }> = {
  done:    { icon: 'check-circle',  cls: 'itemIconSuccess', label: 'Done' },
  ongoing: { icon: 'clock',         cls: 'itemIconInfo',    label: 'Ongoing' },
  blocker: { icon: 'alert-triangle', cls: 'itemIconDanger', label: 'Blocker' },
};

export default function ReportTab() {
  const [view, setView] = useState<SubView>('report');

  // Report state
  const [report, setReport] = useState<DayReport | null>(null);
  const [reportLoading, setReportLoading] = useState(false);

  // Scrum state
  const [scrum, setScrum] = useState<ScrumReport | null>(null);
  const [scrumLoading, setScrumLoading] = useState(false);
  const [posting, setPosting] = useState(false);
  const [posted, setPosted] = useState(false);
  const [marking, setMarking] = useState(false);

  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();

  const handleFetchReport = useCallback(async () => {
    setReportLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/report');
      const data = await res.json();
      if (!res.ok) setError(data.error || 'Failed');
      else setReport(data);
    } catch (err) { setError(String(err)); }
    finally { setReportLoading(false); }
  }, []);

  const handleFetchScrum = useCallback(async () => {
    setScrumLoading(true);
    setError(null);
    setPosted(false);
    try {
      const res = await fetch('/api/scrum');
      const data = await res.json();
      if (!res.ok) setError(data.error || 'Failed');
      else setScrum(data);
    } catch (err) { setError(String(err)); }
    finally { setScrumLoading(false); }
  }, []);

  const handlePostScrum = useCallback(async () => {
    if (!scrum) return;
    setPosting(true);
    try {
      const now = new Date();
      const dateLabel = `${now.getMonth() + 1}/${now.getDate()}`;

      // Aggregate by issue number: collect all status lines per issue
      const issueMap = new Map<number, string[]>();

      for (const item of [...scrum.done, ...scrum.ongoing, ...scrum.blockers]) {
        const tag = `[${item.status.charAt(0).toUpperCase() + item.status.slice(1)}]`;

        if (item.kind === 'issue') {
          // Direct issue item
          const lines = issueMap.get(item.number) || [];
          const prNote = item.linkedPR ? ` ${item.linkedPR.url}` : '';
          lines.push(`${tag} #${item.number}${prNote}`);
          issueMap.set(item.number, lines);
        } else if (item.kind === 'pr' && item.linkedIssue) {
          // PR linked to an issue — attribute to that issue
          const lines = issueMap.get(item.linkedIssue) || [];
          lines.push(`${tag} #${item.linkedIssue} ${item.url}`);
          issueMap.set(item.linkedIssue, lines);
        }
        // PR without linked issue → skip (no comment on PR)
      }

      if (issueMap.size === 0) {
        toast({ title: 'Nothing to post', message: 'No issues with updates.', variant: 'warning' });
        setPosting(false);
        return;
      }

      // Build one comment per issue
      const updates: { issueNumber: number; comment: string }[] = [];
      for (const [issueNumber, lines] of issueMap) {
        updates.push({
          issueNumber,
          comment: `${dateLabel} status update:\n${lines.join('\n')}`,
        });
      }

      const res = await fetch('/api/scrum', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ updates }),
      });
      const data = await res.json();
      if (data.success) {
        toast({
          title: `Posted to ${data.posted} issue${data.posted !== 1 ? 's' : ''}`,
          message: 'Status comments added to GitHub issues.',
          variant: 'success',
        });
        setPosted(true);
      } else {
        toast({
          title: 'Partial failure',
          message: `${data.posted} posted, ${data.failed} failed`,
          variant: 'warning',
        });
      }
    } catch (err) {
      toast({ title: 'Failed to post', message: String(err), variant: 'danger' });
    } finally {
      setPosting(false);
    }
  }, [scrum, toast]);

  const handleMarkScrum = useCallback(async () => {
    setMarking(true);
    try {
      const res = await fetch('/api/scrum', { method: 'PATCH' });
      const data = await res.json();
      if (data.success) {
        toast({
          title: 'Scrum mark updated',
          message: `Marked at ${data.mark.label}. Next scrum will show activity after this point.`,
          variant: 'success',
        });
        // Refresh scrum data to reflect new mark
        handleFetchScrum();
      } else {
        toast({ title: 'Failed to mark', message: String(data.error), variant: 'danger' });
      }
    } catch (err) {
      toast({ title: 'Failed to mark', message: String(err), variant: 'danger' });
    } finally {
      setMarking(false);
    }
  }, [toast, handleFetchScrum]);

  const isLoading = view === 'report' ? reportLoading : scrumLoading;
  const hasData = view === 'report' ? !!report : !!scrum;

  return (
    <div>
      <div className={styles.tabHeader}>
        <div className={styles.headerLeft}>
          <h2 className={styles.tabTitle}>Report</h2>
          <div className={styles.viewToggle}>
            <button
              className={`${styles.viewBtn} ${view === 'report' ? styles.viewBtnActive : ''}`}
              onClick={() => setView('report')}
            >
              <Icon name="bar-chart" size={14} />
              End of Day
            </button>
            <button
              className={`${styles.viewBtn} ${view === 'scrum' ? styles.viewBtnActive : ''}`}
              onClick={() => setView('scrum')}
            >
              <Icon name="users" size={14} />
              Scrum
            </button>
          </div>
        </div>
        <div className={styles.headerRight}>
          {hasData && (
            <span className={styles.dateLabel}>
              {(view === 'report' ? report?.date : scrum?.date) || ''}
            </span>
          )}
          {view === 'scrum' && scrum && !posted && (
            <Button variant="ghost" size="sm" onClick={handlePostScrum} disabled={posting}>
              <Icon name="send" size={14} />
              {posting ? 'Posting...' : 'Post to GitHub'}
            </Button>
          )}
          {view === 'scrum' && posted && (
            <Badge variant="success" size="sm">Posted</Badge>
          )}
          {view === 'scrum' && scrum && (
            <Button variant="ghost" size="sm" onClick={handleMarkScrum} disabled={marking}>
              <Icon name="check-circle" size={14} />
              {marking ? 'Marking...' : 'Mark Scrum'}
            </Button>
          )}
          <Button
            variant="primary"
            size="sm"
            onClick={view === 'report' ? handleFetchReport : handleFetchScrum}
            disabled={isLoading}
          >
            <Icon name="refresh-cw" size={14} />
            {isLoading ? 'Loading...' : hasData ? 'Refresh' : 'Generate'}
          </Button>
        </div>
      </div>

      {error && (
        <div className={styles.errorBar}>
          <Icon name="alert-triangle" size={14} />
          <span>{error}</span>
        </div>
      )}

      {isLoading && !hasData && (
        <div className={styles.loadingArea}>
          <Skeleton count={4} gap={12} />
        </div>
      )}

      {!isLoading && !hasData && !error && (
        <EmptyState
          icon={view === 'report' ? 'bar-chart' : 'users'}
          title={view === 'report' ? 'No report yet' : 'No scrum report yet'}
          description={`Click 'Generate' to fetch ${view === 'report' ? "today's activity" : 'scrum status'} from GitHub.`}
        />
      )}

      {/* ── Report View ── */}
      {view === 'report' && report && (
        <div className={styles.reportGrid}>
          {/* Stats row */}
          <div className={styles.statsRow}>
            <div className={styles.statCard}>
              <div className={styles.statNumber}>{report.stats.issuesClosed}</div>
              <div className={styles.statLabel}>Issues Closed</div>
            </div>
            <div className={styles.statCard}>
              <div className={styles.statNumber}>{report.stats.prsMerged}</div>
              <div className={styles.statLabel}>PRs Merged</div>
            </div>
            <div className={styles.statCard}>
              <div className={styles.statNumber}>{report.stats.prsOpen}</div>
              <div className={styles.statLabel}>PRs Open</div>
            </div>
            <div className={styles.statCard}>
              <div className={styles.statNumber}>{report.stats.commits}</div>
              <div className={styles.statLabel}>Commits</div>
            </div>
          </div>

          {/* Completed today */}
          <div className={styles.section}>
            <h3 className={styles.sectionTitle}>
              <Icon name="check-circle" size={16} />
              Completed Today
            </h3>
            {report.completedIssues.length === 0 && report.mergedPRs.length === 0 ? (
              <div className={styles.empty}>No issues closed or PRs merged today.</div>
            ) : (
              <div className={styles.itemList}>
                {report.completedIssues.map(issue => (
                  <div key={`i-${issue.number}`} className={styles.item}>
                    <Icon name="check-circle" size={14} className={styles.itemIconSuccess} />
                    <a href={issue.url} target="_blank" rel="noopener noreferrer" className={styles.issueLink}>
                      #{issue.number}
                    </a>
                    <span className={styles.itemTitle}>{issue.title}</span>
                    {issue.linkedPR && (
                      <a href={issue.linkedPR.url} target="_blank" rel="noopener noreferrer" className={styles.prLink}>
                        <Badge variant="success" size="sm">PR #{issue.linkedPR.number} merged</Badge>
                      </a>
                    )}
                  </div>
                ))}
                {report.mergedPRs
                  .filter(pr => !report.completedIssues.some(i => i.linkedPR?.number === pr.number))
                  .map(pr => (
                    <div key={`pr-${pr.number}`} className={styles.item}>
                      <Icon name="git-merge" size={14} className={styles.itemIconSuccess} />
                      <a href={pr.url} target="_blank" rel="noopener noreferrer" className={styles.prLink}>
                        PR #{pr.number}
                      </a>
                      <span className={styles.itemTitle}>{pr.title}</span>
                      <Badge variant="success" size="sm">merged</Badge>
                    </div>
                  ))}
              </div>
            )}
          </div>

          {/* Open PRs */}
          {report.openPRs.length > 0 && (
            <div className={styles.section}>
              <h3 className={styles.sectionTitle}>
                <Icon name="git-pull-request" size={16} />
                Open PRs
              </h3>
              <div className={styles.itemList}>
                {report.openPRs.map(pr => {
                  const badge = ACTION_BADGE[pr.action] || ACTION_BADGE.waiting;
                  return (
                    <div key={pr.number} className={styles.item}>
                      <Icon name="git-pull-request" size={14} className={styles.itemIconPurple} />
                      <a href={pr.url} target="_blank" rel="noopener noreferrer" className={styles.prLink}>
                        #{pr.number}
                      </a>
                      <span className={styles.itemTitle}>{pr.title}</span>
                      <Badge variant={badge.variant} size="sm">{badge.label}</Badge>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Today's commits */}
          {report.commits.length > 0 && (
            <div className={styles.section}>
              <h3 className={styles.sectionTitle}>
                <Icon name="git-commit" size={16} />
                Commits Today ({report.commits.length})
              </h3>
              <div className={styles.commitList}>
                {report.commits.map(c => (
                  <div key={c.hash} className={styles.commitItem}>
                    <span className={styles.commitHash}>{c.hash}</span>
                    <span className={styles.commitMsg}>{c.message}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Carry-over */}
          {report.carryOver.length > 0 && (
            <div className={styles.section}>
              <h3 className={styles.sectionTitle}>
                <Icon name="list" size={16} />
                Carry-over ({report.carryOver.filter(i => !i.isBacklog).length} active, {report.carryOver.filter(i => i.isBacklog).length} backlog)
              </h3>
              <div className={styles.itemList}>
                {report.carryOver
                  .sort((a, b) => (a.isBacklog ? 1 : 0) - (b.isBacklog ? 1 : 0))
                  .map(issue => (
                    <div key={issue.number} className={`${styles.item} ${issue.isBacklog ? styles.itemMuted : ''}`}>
                      <Icon name="circle" size={14} className={issue.isBacklog ? styles.itemIconMuted : styles.itemIconInfo} />
                      <a href={issue.url} target="_blank" rel="noopener noreferrer" className={styles.issueLink}>
                        #{issue.number}
                      </a>
                      <span className={styles.itemTitle}>{issue.title}</span>
                      {issue.isBacklog && <Badge variant="default" size="sm">backlog</Badge>}
                      {issue.labels.filter(l => l.toLowerCase() !== 'backlog').map(l => (
                        <Badge key={l} variant="info" size="sm">{l}</Badge>
                      ))}
                    </div>
                  ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Scrum View ── */}
      {view === 'scrum' && scrum && (
        <div className={styles.reportGrid}>
          {/* Since label */}
          <div className={styles.sinceBar}>
            <Icon name="clock" size={14} />
            <span>
              Since: {scrum.lastScrum
                ? scrum.lastScrum.label
                : `${new Date(scrum.sinceDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })} (default)`
              }
            </span>
          </div>
          {/* Done */}
          <div className={styles.section}>
            <h3 className={styles.sectionTitle}>
              <Icon name="check-circle" size={16} className={styles.itemIconSuccess} />
              Done ({scrum.done.length})
            </h3>
            {scrum.done.length === 0 ? (
              <div className={styles.empty}>No completed items since last scrum.</div>
            ) : (
              <div className={styles.itemList}>
                {scrum.done.map(item => (
                  <div key={item.number} className={styles.item}>
                    <Icon name="check-circle" size={14} className={styles.itemIconSuccess} />
                    <a href={item.url} target="_blank" rel="noopener noreferrer" className={styles.issueLink}>
                      #{item.number}
                    </a>
                    <span className={styles.itemTitle}>{item.title}</span>
                    <span className={styles.scrumSummary}>{item.summary}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Ongoing */}
          <div className={styles.section}>
            <h3 className={styles.sectionTitle}>
              <Icon name="clock" size={16} className={styles.itemIconInfo} />
              Ongoing ({scrum.ongoing.length})
            </h3>
            {scrum.ongoing.length === 0 ? (
              <div className={styles.empty}>No ongoing items.</div>
            ) : (
              <div className={styles.itemList}>
                {scrum.ongoing.map(item => (
                  <div key={item.number} className={styles.item}>
                    <Icon name="clock" size={14} className={styles.itemIconInfo} />
                    <a href={item.url} target="_blank" rel="noopener noreferrer" className={styles.issueLink}>
                      #{item.number}
                    </a>
                    <span className={styles.itemTitle}>{item.title}</span>
                    <span className={styles.scrumSummary}>{item.summary}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Blockers */}
          <div className={styles.section}>
            <h3 className={styles.sectionTitle}>
              <Icon name="alert-triangle" size={16} className={styles.itemIconDanger} />
              Blockers ({scrum.blockers.length})
            </h3>
            {scrum.blockers.length === 0 ? (
              <div className={styles.empty}>No blockers — smooth sailing!</div>
            ) : (
              <div className={styles.itemList}>
                {scrum.blockers.map(item => (
                  <div key={item.number} className={styles.item}>
                    <Icon name="alert-triangle" size={14} className={styles.itemIconDanger} />
                    <a href={item.url} target="_blank" rel="noopener noreferrer" className={styles.issueLink}>
                      #{item.number}
                    </a>
                    <span className={styles.itemTitle}>{item.title}</span>
                    <span className={styles.scrumSummary}>{item.summary}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
