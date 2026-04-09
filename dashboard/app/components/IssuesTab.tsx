'use client';

import React, { useState, useMemo, useCallback } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeRaw from 'rehype-raw';
import { GHIssue, ClaudeTask, TaskPhase, TestScenario, REPO_URL } from '@/lib/types';
import { PHASE_CONFIG, ACTIVE_PHASES } from '@/lib/constants';
import Icon from './ui/Icon';
import Badge from './ui/Badge';
import StatusDot from './ui/StatusDot';
import Button from './ui/Button';
import Select from './ui/Select';
import Tooltip from './ui/Tooltip';
import Skeleton from './ui/Skeleton';
import EmptyState from './ui/EmptyState';
import styles from './IssuesTab.module.css';

type FixMode = 'normal' | 'auto';
type SortKey = 'number' | 'title' | 'status' | 'updated';
type SortDir = 'asc' | 'desc';

interface Props {
  issues: GHIssue[];
  tasks: ClaudeTask[];
  loading: boolean;
  onRefresh: () => void;
  onAssign: (issue: GHIssue, mode: FixMode, force?: boolean, testScenario?: TestScenario) => void;
  onClean: (issue: GHIssue) => void;
  skills?: string[];
}

const PHASE_ORDER: Record<TaskPhase, number> = {
  implementing: 0, testing: 1, analyzing: 2, exploring: 3,
  planning: 4, creating_pr: 5, test_failed: 6,
  waiting_confirm: 7, waiting_manual_test: 8,
  planned: 9, done: 10, failed: 11,
};

export default function IssuesTab({ issues, tasks, loading, onRefresh, onAssign, onClean, skills = [] }: Props) {
  const hasModJava = skills.includes('modernize-java');
  const [modes, setModes] = useState<Map<number, FixMode>>(new Map());
  const [scenarios, setScenarios] = useState<Map<number, TestScenario>>(new Map());
  const [search, setSearch] = useState('');
  const [sortKey, setSortKey] = useState<SortKey>('number');
  const [sortDir, setSortDir] = useState<SortDir>('desc');
  const [showBacklog, setShowBacklog] = useState(false);
  const [expandedIssue, setExpandedIssue] = useState<number | null>(null);
  const [issueBodyCache, setIssueBodyCache] = useState<Map<number, string | null>>(new Map());
  const [loadingBody, setLoadingBody] = useState<number | null>(null);

  const getMode = (n: number): FixMode => modes.get(n) || 'normal';
  const setMode = (n: number, m: FixMode) => setModes(prev => new Map(prev).set(n, m));
  const getScenario = (n: number): TestScenario => scenarios.get(n) || 'vscode';
  const setScenario = (n: number, s: TestScenario) => setScenarios(prev => new Map(prev).set(n, s));

  const taskByIssue = useMemo(() => {
    const map = new Map<number, ClaudeTask>();
    for (const task of tasks) {
      if (task.issueNumber) map.set(task.issueNumber, task);
    }
    return map;
  }, [tasks]);

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    } else {
      setSortKey(key);
      setSortDir(key === 'number' ? 'desc' : 'asc');
    }
  };

  const isBacklog = (issue: GHIssue) =>
    issue.labels.some(l => l.name.toLowerCase() === 'backlog');

  const backlogCount = useMemo(() => issues.filter(isBacklog).length, [issues]);

  const handleToggleExpand = useCallback(async (issueNumber: number) => {
    if (expandedIssue === issueNumber) {
      setExpandedIssue(null);
      return;
    }
    setExpandedIssue(issueNumber);
    // Fetch body if not cached
    if (!issueBodyCache.has(issueNumber)) {
      setLoadingBody(issueNumber);
      try {
        const res = await fetch(`/api/issues?number=${issueNumber}`);
        const data = await res.json();
        setIssueBodyCache(prev => new Map(prev).set(issueNumber, data.issue?.body ?? null));
      } catch {
        setIssueBodyCache(prev => new Map(prev).set(issueNumber, null));
      } finally {
        setLoadingBody(null);
      }
    }
  }, [expandedIssue, issueBodyCache]);

  const filteredAndSorted = useMemo(() => {
    let result = issues;

    // Filter out backlog unless toggled on
    if (!showBacklog) {
      result = result.filter(i => !isBacklog(i));
    }

    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(i =>
        i.title.toLowerCase().includes(q) ||
        String(i.number).includes(q) ||
        i.labels.some(l => l.name.toLowerCase().includes(q))
      );
    }

    result = [...result].sort((a, b) => {
      let cmp = 0;
      switch (sortKey) {
        case 'number':
          cmp = a.number - b.number;
          break;
        case 'title':
          cmp = a.title.localeCompare(b.title);
          break;
        case 'status': {
          const ta = taskByIssue.get(a.number);
          const tb = taskByIssue.get(b.number);
          const oa = ta ? PHASE_ORDER[ta.phase] ?? 99 : 99;
          const ob = tb ? PHASE_ORDER[tb.phase] ?? 99 : 99;
          cmp = oa - ob;
          break;
        }
        case 'updated':
          cmp = new Date(a.updatedAt).getTime() - new Date(b.updatedAt).getTime();
          break;
      }
      return sortDir === 'asc' ? cmp : -cmp;
    });

    return result;
  }, [issues, search, sortKey, sortDir, taskByIssue, showBacklog]);

  const SortHeader = ({ sKey, children }: { sKey: SortKey; children: React.ReactNode }) => (
    <th onClick={() => handleSort(sKey)} className={sKey === 'number' ? styles.colNumber : sKey === 'status' ? styles.colStatus : undefined}>
      {children}
      <span className={`${styles.sortIcon} ${sortKey === sKey ? styles.active : ''}`}>
        <Icon name={sortDir === 'asc' && sortKey === sKey ? 'chevron-up' : 'chevron-down'} size={12} />
      </span>
    </th>
  );

  if (loading) {
    return (
      <div>
        <div className={styles.tabHeader}>
          <h2 className={styles.tabTitle}>Open Issues</h2>
        </div>
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className={styles.skeletonRow}>
            <Skeleton width={50} height={14} />
            <Skeleton width="60%" height={14} />
            <Skeleton width={100} height={14} />
          </div>
        ))}
      </div>
    );
  }

  return (
    <div>
      <div className={styles.tabHeader}>
        <h2 className={styles.tabTitle}>Open Issues ({issues.length})</h2>
        <div className={styles.headerRight}>
          {backlogCount > 0 && (
            <button
              className={`${styles.filterToggle} ${showBacklog ? styles.active : ''}`}
              onClick={() => setShowBacklog(v => !v)}
            >
              <Icon name="filter" size={12} />
              {showBacklog ? 'Hide' : 'Show'} backlog ({backlogCount})
            </button>
          )}
          <Button variant="ghost" size="sm" onClick={onRefresh}>
            <Icon name="refresh" size={14} />
            Refresh
          </Button>
        </div>
      </div>

      {issues.length > 0 && (
        <div className={styles.searchBar}>
          <Icon name="search" size={14} className={styles.searchIcon} />
          <input
            className={styles.searchInput}
            type="text"
            placeholder="Search issues..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
      )}

      {(search || (!showBacklog && backlogCount > 0)) && filteredAndSorted.length !== issues.length && (
        <div className={styles.searchCount}>
          Showing {filteredAndSorted.length} of {issues.length}
          {!showBacklog && backlogCount > 0 && !search && ` (${backlogCount} backlog hidden)`}
        </div>
      )}

      {issues.length === 0 ? (
        <EmptyState
          icon="inbox"
          title="No open issues"
          description="No open issues assigned to you. When issues are assigned, they'll appear here."
        />
      ) : filteredAndSorted.length === 0 ? (
        <EmptyState
          icon="search"
          title="No matches"
          description={`No issues match "${search}"`}
        />
      ) : (
        <table className={styles.table}>
          <thead>
            <tr>
              <SortHeader sKey="number">#</SortHeader>
              <SortHeader sKey="title">Title</SortHeader>
              <SortHeader sKey="status">Status</SortHeader>
              <th className={styles.colMode}>Mode</th>
              {hasModJava && <th className={styles.colTest}>Test</th>}
              <th className={styles.colAction}>Action</th>
            </tr>
          </thead>
          <tbody>
            {filteredAndSorted.map(issue => {
              const task = taskByIssue.get(issue.number);
              const isActive = task ? ACTIVE_PHASES.has(task.phase) : false;
              const isDone = task?.phase === 'done' || task?.phase === 'failed';
              const config = task ? PHASE_CONFIG[task.phase] : null;
              const isExpanded = expandedIssue === issue.number;
              const body = issueBodyCache.get(issue.number);
              const isBodyLoading = loadingBody === issue.number;

              return (
                <React.Fragment key={issue.number}>
                  <tr
                    className={isExpanded ? styles.rowExpanded : undefined}
                    onClick={() => handleToggleExpand(issue.number)}
                  >
                    <td className={styles.colNumber}>
                      <a
                        href={`${REPO_URL}/issues/${issue.number}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className={styles.issueNumber}
                        onClick={e => e.stopPropagation()}
                      >
                        #{issue.number}
                      </a>
                    </td>
                    <td>
                      <div className={styles.titleCell}>
                        <span className={styles.issueTitle}>{issue.title}</span>
                        {issue.labels.length > 0 && (
                          <div className={styles.labels}>
                            {issue.labels.map(l => (
                              <span
                                key={l.name}
                                className={`${styles.label} ${l.name.toLowerCase() === 'backlog' ? styles.labelBacklog : styles.labelDefault}`}
                              >
                                {l.name}
                              </span>
                            ))}
                          </div>
                        )}
                        <Icon
                          name={isExpanded ? 'chevron-up' : 'chevron-down'}
                          size={12}
                          className={styles.expandIcon}
                        />
                      </div>
                    </td>
                    <td className={styles.colStatus}>
                      {config ? (
                        <Tooltip content={config.label}>
                          <span className={styles.statusCell}>
                            <StatusDot variant={config.variant} pulse={isActive} size="sm" />
                            <Icon name={config.icon} size={14} />
                            <span>{config.label}</span>
                          </span>
                        </Tooltip>
                      ) : (
                        <span className={styles.statusNone}>—</span>
                      )}
                    </td>
                    <td className={styles.colMode} onClick={e => e.stopPropagation()}>
                      <Select
                        size_="sm"
                        value={getMode(issue.number)}
                        onChange={e => setMode(issue.number, e.target.value as FixMode)}
                        disabled={isActive}
                      >
                        <option value="normal">Normal</option>
                        <option value="auto">Auto</option>
                      </Select>
                    </td>
                    {hasModJava && (
                      <td className={styles.colTest} onClick={e => e.stopPropagation()}>
                        <Select
                          size_="sm"
                          value={getScenario(issue.number)}
                          onChange={e => setScenario(issue.number, e.target.value as TestScenario)}
                          disabled={isActive}
                        >
                          <option value="vscode">VS Code</option>
                          <option value="intellij">IntelliJ</option>
                          <option value="mcp-server">MCP Server</option>
                        </Select>
                      </td>
                    )}
                    <td className={styles.colAction} onClick={e => e.stopPropagation()}>
                      <div className={styles.actionGroup}>
                        {isActive ? (
                          <Button variant="secondary" size="sm" disabled>Running</Button>
                        ) : isDone ? (
                          <Button variant="warning" size="sm" onClick={() => onAssign(issue, getMode(issue.number), true, hasModJava ? getScenario(issue.number) : undefined)}>Re-run</Button>
                        ) : (
                          <Button variant="primary" size="sm" onClick={() => onAssign(issue, getMode(issue.number), false, hasModJava ? getScenario(issue.number) : undefined)}>Assign</Button>
                        )}
                        <Tooltip content="Clean log & worktree">
                          <button
                            className={styles.cleanBtn}
                            onClick={() => onClean(issue)}
                            disabled={isActive}
                          >
                            <Icon name="broom" size={13} />
                          </button>
                        </Tooltip>
                      </div>
                    </td>
                  </tr>
                  {isExpanded && (
                    <tr className={styles.expandedRow}>
                      <td colSpan={hasModJava ? 6 : 5}>
                        <div className={styles.issueBody}>
                          {isBodyLoading ? (
                            <Skeleton count={4} gap={10} />
                          ) : body ? (
                            <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeRaw]}>{body}</ReactMarkdown>
                          ) : (
                            <p className={styles.noBody}>No description provided.</p>
                          )}
                        </div>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              );
            })}
          </tbody>
        </table>
      )}
    </div>
  );
}
