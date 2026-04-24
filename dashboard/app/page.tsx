'use client';

import { Suspense, useState, useCallback, useMemo, useEffect } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { GHIssue, GHPR, PRAction, REPO_URL, ReviewConfig, CliTool, CLI_TOOL_CONFIG } from '@/lib/types';
import { useTaskStream, useGitHubData, useTheme, useKeyboardShortcuts, useGHAccount } from './hooks';
import { ACTIVE_PHASES } from '@/lib/constants';
import { cn } from '@/lib/utils';
import { ToastProvider, useToast } from './components/ui/Toast';
import ConfirmDialog from './components/ui/ConfirmDialog';
import Icon from './components/ui/Icon';
import Badge from './components/ui/Badge';
import StatusDot from './components/ui/StatusDot';
import Select from './components/ui/Select';
import IssuesTab from './components/IssuesTab';
import PullRequestsTab from './components/PullRequestsTab';
import TasksTab from './components/TasksTab';
import ActionsTab from './components/ActionsTab';
import SkillsTab from './components/SkillsTab';
import ReportTab from './components/ReportTab';
import OffWorkCelebration from './components/OffWorkCelebration';
import styles from './page.module.css';

type Tab = 'issues' | 'prs' | 'tasks' | 'actions' | 'skills' | 'report';

interface PRData {
  prs: (GHPR & { action: PRAction })[];
  reviewRequested: (GHPR & { action: PRAction })[];
}

interface IssueData {
  issues: GHIssue[];
}

const TAB_CONFIG: { key: Tab; label: string | null; icon: string }[] = [
  { key: 'issues',       label: 'Issues',         icon: 'list' },
  { key: 'prs',          label: 'Pull Requests',  icon: 'git-pull-request' },
  { key: 'tasks',        label: null,              icon: 'cpu' },  // dynamic label
  { key: 'actions',      label: 'Actions',        icon: 'alert-circle' },
  { key: 'skills',       label: 'Skills',          icon: 'zap' },
  { key: 'report',       label: 'Report',          icon: 'bar-chart' },
];

const VALID_TABS = new Set<Tab>(['issues', 'prs', 'tasks', 'actions', 'skills', 'report']);

function DashboardInner() {
  const searchParams = useSearchParams();
  const router = useRouter();

  const tabParam = searchParams.get('tab') as Tab | null;
  const tab: Tab = tabParam && VALID_TABS.has(tabParam) ? tabParam : 'issues';

  const setTab = useCallback((t: Tab) => {
    const params = new URLSearchParams(searchParams.toString());
    if (t === 'issues') {
      params.delete('tab');  // clean URL for default tab
    } else {
      params.set('tab', t);
    }
    const query = params.toString();
    router.replace(query ? `/?${query}` : '/', { scroll: false });
  }, [searchParams, router]);

  const [showCleanup, setShowCleanup] = useState(false);
  const [cleaning, setCleaning] = useState(false);
  const [showOffWork, setShowOffWork] = useState(false);
  const [cliTool, setCliTool] = useState<CliTool>('claude');

  // Hydrate from localStorage after mount (avoids SSR mismatch)
  useEffect(() => {
    const stored = localStorage.getItem('cliTool') as CliTool | null;
    if (stored && stored !== cliTool) setCliTool(stored);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    localStorage.setItem('cliTool', cliTool);
  }, [cliTool]);

  const { theme, toggleTheme } = useTheme();
  const { toast } = useToast();
  const { accounts, activeAccount, switching, switchAccount } = useGHAccount();

  const { data: issueData, loading: issuesLoading, refresh: refreshIssues } =
    useGitHubData<IssueData>('/api/issues');
  const { data: prData, loading: prsLoading, refresh: refreshPRs } =
    useGitHubData<PRData>('/api/prs');
  const { tasks, decisions, connected } = useTaskStream();

  const cliDisplayName = CLI_TOOL_CONFIG[cliTool].displayName;

  const handleAssign = useCallback(async (issue: GHIssue, mode: 'normal' | 'auto' = 'normal', force: boolean = false) => {
    const issueUrl = issue.url;
    try {
      const res = await fetch('/api/tasks/assign', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ issueUrl, mode, force, cliTool }),
      });
      const data = await res.json();
      if (res.status === 409) {
        toast({ title: `Already running`, message: `#${issue.number} has an active session`, variant: 'warning' });
      } else if (data.success) {
        const modeLabel = mode === 'auto' ? ' (Auto)' : '';
        toast({ title: `${cliDisplayName} started for #${issue.number}${modeLabel}`, variant: 'success', duration: 8000 });
      } else {
        toast({ title: 'Assignment failed', message: data.error, variant: 'danger' });
      }
    } catch (err) {
      toast({ title: 'Assignment failed', message: String(err), variant: 'danger' });
    }
  }, [toast, cliTool, cliDisplayName]);

  const handleDismissDecision = useCallback(async (taskId: string) => {
    try {
      await fetch(`/api/decisions?taskId=${encodeURIComponent(taskId)}`, { method: 'DELETE' });
    } catch { /* SSE will update the list */ }
  }, []);

  const handleReviewPR = useCallback(async (pr: GHPR & { action: PRAction }, config?: ReviewConfig) => {
    try {
      const res = await fetch('/api/tasks/review-pr', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prUrl: pr.url || `${REPO_URL}/pull/${pr.number}`,
          ...(config && { strategy: config.strategy, level: config.level, context: config.context }),
          cliTool,
        }),
      });
      const data = await res.json();
      if (data.success) {
        const strategyLabel = config?.strategy === 'quick-approve' ? ' [Quick Approve]'
          : config?.strategy === 'auto' ? ' [Auto]' : '';
        toast({
          title: `Review PR #${pr.number}${strategyLabel}`,
          message: `${cliDisplayName} CLI opened — switch to the terminal to discuss.`,
          variant: 'info',
          duration: 6000,
        });
      } else {
        toast({ title: 'Failed to start', message: data.error, variant: 'danger' });
      }
    } catch (err) {
      toast({ title: 'Failed to start', message: String(err), variant: 'danger' });
    }
  }, [toast, cliTool, cliDisplayName]);

  const handleReviewPRUrl = useCallback(async (prUrl: string) => {
    try {
      const res = await fetch('/api/tasks/review-pr', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prUrl, cliTool }),
      });
      const data = await res.json();
      if (data.success) {
        toast({
          title: 'Review PR',
          message: `${cliDisplayName} CLI opened — switch to the terminal to discuss.`,
          variant: 'info',
          duration: 6000,
        });
      } else {
        toast({ title: 'Invalid PR link', message: data.error, variant: 'danger' });
      }
    } catch (err) {
      toast({ title: 'Failed to start', message: String(err), variant: 'danger' });
    }
  }, [toast, cliTool, cliDisplayName]);

  const handleFixComments = useCallback(async (pr: GHPR & { action: PRAction }) => {
    try {
      const res = await fetch('/api/tasks/fix-comments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prNumber: pr.number, cliTool }),
      });
      const data = await res.json();
      if (data.success) {
        toast({
          title: `Fix comments: PR #${pr.number}`,
          message: `${cliDisplayName} is checking open comments and fixing them.`,
          variant: 'success',
          duration: 8000,
        });
      } else {
        toast({ title: 'Failed to start', message: data.error, variant: 'danger' });
      }
    } catch (err) {
      toast({ title: 'Failed to start', message: String(err), variant: 'danger' });
    }
  }, [toast, cliTool, cliDisplayName]);

  const handleFixCommentsPR = useCallback(async (prNumber: number) => {
    try {
      const res = await fetch('/api/tasks/fix-comments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prNumber, cliTool }),
      });
      const data = await res.json();
      if (data.success) {
        toast({
          title: `Fix comments: PR #${prNumber}`,
          message: `${cliDisplayName} is checking open comments and fixing them.`,
          variant: 'success',
          duration: 8000,
        });
      } else {
        toast({ title: 'Failed to start', message: data.error, variant: 'danger' });
      }
    } catch (err) {
      toast({ title: 'Failed to start', message: String(err), variant: 'danger' });
    }
  }, [toast, cliTool, cliDisplayName]);

  const handleReviewPRNumber = useCallback(async (prNumber: number) => {
    try {
      const res = await fetch('/api/tasks/review-pr', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prNumber, cliTool }),
      });
      const data = await res.json();
      if (data.success) {
        toast({
          title: `Review PR #${prNumber}`,
          message: `${cliDisplayName} CLI opened — switch to the terminal to discuss.`,
          variant: 'info',
          duration: 6000,
        });
      } else {
        toast({ title: 'Failed to start', message: data.error, variant: 'danger' });
      }
    } catch (err) {
      toast({ title: 'Failed to start', message: String(err), variant: 'danger' });
    }
  }, [toast, cliTool, cliDisplayName]);

  const handleRefresh = useCallback(() => {
    if (tab === 'issues') refreshIssues();
    else if (tab === 'prs') refreshPRs();
  }, [tab, refreshIssues, refreshPRs]);

  const handleCleanIssue = useCallback(async (issue: GHIssue) => {
    try {
      await fetch('/api/cleanup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ issueNumber: issue.number }),
      });
      toast({
        title: `Cleaned #${issue.number}`,
        message: 'Log and worktree cleanup started.',
        variant: 'success',
        duration: 4000,
      });
    } catch (err) {
      toast({ title: 'Cleanup failed', message: String(err), variant: 'danger' });
    }
  }, [toast]);

  const handleCleanTask = useCallback(async (taskId: string) => {
    const issueNumber = parseInt(taskId.replace('issue-', ''), 10);
    if (isNaN(issueNumber)) return;
    try {
      await fetch('/api/cleanup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ issueNumber, logOnly: true }),
      });
      toast({
        title: `Cleaned ${taskId}`,
        message: 'Task log removed. Worktree preserved.',
        variant: 'success',
        duration: 4000,
      });
    } catch (err) {
      toast({ title: 'Cleanup failed', message: String(err), variant: 'danger' });
    }
  }, [toast]);

  const handleCleanup = useCallback(async () => {
    setCleaning(true);
    setShowCleanup(false);
    try {
      await fetch('/api/cleanup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cleanLogs: true, cleanWorktrees: true }),
      });
      toast({
        title: 'Cleanup started',
        message: 'Logs cleared. Worktrees cleaning + pulling latest main in background.',
        variant: 'success',
      });
    } catch (err) {
      toast({ title: 'Cleanup failed', message: String(err), variant: 'danger' });
    } finally {
      setCleaning(false);
    }
  }, [toast]);

  // Computed stats
  const allIssues = issueData?.issues || [];
  const visibleIssues = useMemo(() =>
    allIssues.filter(i => !i.labels.some(l => l.name.toLowerCase() === 'backlog')),
    [allIssues]
  );

  const activeTasks = useMemo(() =>
    tasks.filter(t => ACTIVE_PHASES.has(t.phase)).length,
    [tasks]
  );

  const readyToMergePRs = useMemo(() =>
    (prData?.prs || []).filter(pr => pr.action === 'ready_to_merge').length,
    [prData]
  );

  const unresolvedCommentPRs = useMemo(() =>
    (prData?.prs || []).filter(pr => pr.action === 'has_unresolved_comments').length,
    [prData]
  );

  const reviewRequestedCount = useMemo(() =>
    (prData?.reviewRequested || []).length,
    [prData]
  );


  // Keyboard shortcuts
  useKeyboardShortcuts({
    '1': () => setTab('issues'),
    '2': () => setTab('prs'),
    '3': () => setTab('tasks'),
    '4': () => setTab('actions'),
    '5': () => setTab('skills'),
    '6': () => setTab('report'),
    'r': handleRefresh,
    't': toggleTheme,
    'Escape': () => {
      if (showOffWork) setShowOffWork(false);
    },
  });

  return (
    <div className={styles.dashboard}>
      {/* Header */}
      <header className={styles.header}>
        <div className={styles.headerLeft}>
          <h1 className={styles.logo}>Copilot Dev Dashboard</h1>
        </div>
        <div className={styles.headerRight}>
          {accounts.length > 1 ? (
            <div className={styles.accountSelector}>
              <Icon name="user" size={14} />
              <Select
                size_="sm"
                value={activeAccount}
                onChange={async (e) => {
                  const ok = await switchAccount(e.target.value);
                  if (ok) {
                    toast({ title: 'Switched to ' + e.target.value, variant: 'success' });
                    refreshIssues();
                    refreshPRs();
                  } else {
                    toast({ title: 'Failed to switch account', variant: 'danger' });
                  }
                }}
                disabled={switching}
                title="Switch GitHub account"
              >
                {accounts.map((a) => (
                  <option key={a.user} value={a.user}>
                    {a.user}
                  </option>
                ))}
              </Select>
            </div>
          ) : activeAccount && (
            <div className={styles.accountSelector}>
              <Icon name="user" size={14} />
              <span className={styles.accountName}>{activeAccount}</span>
            </div>
          )}
          <Select
            size_="sm"
            value={cliTool}
            onChange={(e) => setCliTool(e.target.value as CliTool)}
            title="CLI tool for task execution"
          >
            <option value="claude">Claude Code</option>
            <option value="copilot">Copilot CLI</option>
          </Select>
          <div className={styles.connectionStatus}>
            <StatusDot
              variant={connected ? 'success' : 'danger'}
              size="sm"
              pulse={connected}
            />
            <span>{connected ? 'Live' : 'Connecting...'}</span>
          </div>
          <button
            className={styles.offWorkBtn}
            onClick={() => setShowOffWork(true)}
            title="Off work!"
          >
            <Icon name="log-out" size={16} />
            <span>Off Work</span>
          </button>
          <button
            className={styles.themeToggle}
            onClick={() => setShowCleanup(true)}
            title="Clean all logs and worktrees"
          >
            <Icon name="trash" size={16} />
          </button>
          <button
            className={styles.themeToggle}
            onClick={toggleTheme}
            title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
          >
            <Icon name={theme === 'dark' ? 'sun' : 'moon'} size={16} />
          </button>
        </div>
      </header>

      {/* Summary Stats */}
      <div className={styles.summaryBar}>
        <div className={cn(styles.summaryCard, styles.info)} onClick={() => setTab('issues')}>
          <div className={styles.summaryNumber}>{visibleIssues.length}</div>
          <div className={styles.summaryLabel}>Open Issues</div>
          <div className={styles.summarySub}>
            {allIssues.length > visibleIssues.length
              ? `${allIssues.length - visibleIssues.length} backlog hidden`
              : 'assigned to you'}
          </div>
        </div>
        <div className={cn(styles.summaryCard, styles.purple)} onClick={() => setTab('prs')}>
          <div className={styles.summaryNumber}>{prData?.prs?.length || 0}</div>
          <div className={styles.summaryLabel}>Open PRs</div>
          <div className={styles.summarySub}>
            {reviewRequestedCount > 0
              ? `${reviewRequestedCount} need your review`
              : unresolvedCommentPRs > 0
                ? `${unresolvedCommentPRs} with unresolved comments`
                : readyToMergePRs > 0 ? `${readyToMergePRs} ready to merge` : 'authored by you'}
          </div>
        </div>
        <div className={cn(styles.summaryCard, styles.success)} onClick={() => setTab('tasks')}>
          <div className={styles.summaryNumber}>{activeTasks}</div>
          <div className={styles.summaryLabel}>Active Tasks</div>
          <div className={styles.summarySub}>{tasks.length} total</div>
        </div>
        <div className={cn(styles.summaryCard, styles.warning)} onClick={() => setTab('actions')}>
          <div className={styles.summaryNumber}>{decisions.length}</div>
          <div className={styles.summaryLabel}>Actions Needed</div>
          <div className={styles.summarySub}>decisions pending</div>
        </div>
      </div>

      {/* Tabs */}
      <nav className={styles.tabs}>
        {TAB_CONFIG.map(t => (
          <button
            key={t.key}
            className={cn(styles.tab, tab === t.key && styles.active)}
            onClick={() => setTab(t.key)}
          >
            <span className={styles.tabIcon}>
              <Icon name={t.icon} size={15} />
            </span>
            {t.key === 'tasks' ? `${cliDisplayName} Tasks` : t.label}
            {t.key === 'issues' && visibleIssues.length > 0 && (
              <Badge variant="default" size="sm">{visibleIssues.length}</Badge>
            )}
            {t.key === 'prs' && (prData?.prs?.length ?? 0) > 0 && (
              <Badge variant="default" size="sm">{prData!.prs.length}</Badge>
            )}
            {t.key === 'prs' && reviewRequestedCount > 0 && (
              <Badge variant="warning" size="sm" count>{reviewRequestedCount}</Badge>
            )}
            {t.key === 'tasks' && activeTasks > 0 && (
              <Badge variant="info" size="sm" count>{activeTasks}</Badge>
            )}
            {t.key === 'actions' && decisions.length > 0 && (
              <Badge variant="warning" size="sm" count pulse>{decisions.length}</Badge>
            )}
          </button>
        ))}
      </nav>

      {/* Tab Content */}
      <div className={styles.tabContent}>
        {tab === 'issues' && (
          <IssuesTab
            issues={issueData?.issues || []}
            tasks={tasks}
            loading={issuesLoading}
            onRefresh={refreshIssues}
            onAssign={handleAssign}
            onClean={handleCleanIssue}
          />
        )}
        {tab === 'prs' && (
          <PullRequestsTab
            prs={prData?.prs || []}
            reviewRequested={prData?.reviewRequested || []}
            loading={prsLoading}
            onRefresh={refreshPRs}
            onFixComments={handleFixComments}
            onReview={handleReviewPR}
            onReviewPRUrl={handleReviewPRUrl}
          />
        )}
        {tab === 'tasks' && (
          <TasksTab tasks={tasks} connected={connected} onClean={handleCleanTask} />
        )}
        {tab === 'actions' && (
          <ActionsTab
            decisions={decisions}
            onDismiss={handleDismissDecision}
            onFixComments={handleFixCommentsPR}
            onReview={handleReviewPRNumber}
          />
        )}
        {tab === 'skills' && (
          <SkillsTab cliTool={cliTool} />
        )}
        {tab === 'report' && (
          <ReportTab />
        )}
      </div>

      {/* Off Work Celebration */}
      {showOffWork && <OffWorkCelebration onClose={() => setShowOffWork(false)} />}

      {/* Cleanup Confirmation */}
      <ConfirmDialog
        open={showCleanup}
        title="Clean All & Pull Latest"
        message="This will delete all task logs (JSONL), pending decisions, git worktrees, and then pull the latest main branch. Running tasks are not affected."
        confirmLabel={cleaning ? 'Cleaning...' : 'Clean & Pull'}
        cancelLabel="Cancel"
        variant="danger"
        onConfirm={handleCleanup}
        onCancel={() => setShowCleanup(false)}
      />

      {/* Footer */}
      <footer style={{
        textAlign: 'center',
        padding: '16px 0',
        marginTop: '24px',
        fontSize: '12px',
        color: 'var(--text-tertiary, #888)',
        borderTop: '1px solid var(--border-primary, #333)',
      }}>
        Experimental project — for issues or suggestions, <a href="https://github.com/frankliu20/dev-pilot/issues" className="underline hover:text-white">open an issue</a> or <a href="https://github.com/frankliu20/dev-pilot/pulls" className="underline hover:text-white">submit a PR</a>.
      </footer>
    </div>
  );
}

export default function Home() {
  return (
    <Suspense>
      <ToastProvider>
        <DashboardInner />
      </ToastProvider>
    </Suspense>
  );
}
