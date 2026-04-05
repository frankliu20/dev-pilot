'use client';

import { useState, useCallback } from 'react';
import { GHIssue, GHPR, PRAction, REPO_URL } from '@/lib/types';
import { useTaskStream, useGitHubData } from './components/hooks';
import IssuesTab from './components/IssuesTab';
import PullRequestsTab from './components/PullRequestsTab';
import TasksTab from './components/TasksTab';
import IssueDetail from './components/IssueDetail';

type Tab = 'issues' | 'prs' | 'tasks';

interface PRData {
  prs: (GHPR & { action: PRAction })[];
}

interface IssueData {
  issues: GHIssue[];
}

export default function Home() {
  const [tab, setTab] = useState<Tab>('issues');
  const [selectedIssue, setSelectedIssue] = useState<(GHIssue & { body?: string }) | null>(null);
  const [assignMsg, setAssignMsg] = useState<string | null>(null);

  const { data: issueData, loading: issuesLoading, refresh: refreshIssues } =
    useGitHubData<IssueData>('/api/issues', 30000);
  const { data: prData, loading: prsLoading, refresh: refreshPRs } =
    useGitHubData<PRData>('/api/prs', 30000);
  const { tasks, connected } = useTaskStream();

  const handleAssign = useCallback(async (issue: GHIssue) => {
    const issueUrl = `${REPO_URL}/issues/${issue.number}`;
    try {
      const res = await fetch('/api/tasks/assign', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ issueUrl }),
      });
      const data = await res.json();
      if (data.success) {
        setAssignMsg(data.message || `Claude started for #${issue.number}`);
        setTimeout(() => setAssignMsg(null), 8000);
      } else {
        setAssignMsg(`Error: ${data.error}`);
        setTimeout(() => setAssignMsg(null), 5000);
      }
    } catch (err) {
      setAssignMsg(`Failed: ${err}`);
      setTimeout(() => setAssignMsg(null), 5000);
    }
  }, []);

  const handleSelectIssue = useCallback(async (issue: GHIssue) => {
    // Fetch full issue detail including body
    try {
      const res = await fetch(`/api/issues?number=${issue.number}`);
      const data = await res.json();
      // For now, use what we have and show detail view
      setSelectedIssue(issue);
    } catch {
      setSelectedIssue(issue);
    }
  }, []);

  // Count active tasks for badge
  const activeTasks = tasks.filter(t =>
    t.phase !== 'done' && t.phase !== 'failed'
  ).length;

  if (selectedIssue) {
    return (
      <div className="dashboard">
        <IssueDetail
          issue={selectedIssue}
          onBack={() => setSelectedIssue(null)}
          onAssign={handleAssign}
        />
        {assignMsg && <div className="toast">{assignMsg}</div>}
      </div>
    );
  }

  return (
    <div className="dashboard">
      <header className="dashboard-header">
        <h1>AI Engineering Dashboard</h1>
      </header>

      <nav className="tabs">
        <button
          className={`tab ${tab === 'issues' ? 'active' : ''}`}
          onClick={() => setTab('issues')}
        >
          Issues
          {issueData?.issues?.length ? (
            <span className="badge">{issueData.issues.length}</span>
          ) : null}
        </button>
        <button
          className={`tab ${tab === 'prs' ? 'active' : ''}`}
          onClick={() => setTab('prs')}
        >
          Pull Requests
          {prData?.prs?.length ? (
            <span className="badge">{prData.prs.length}</span>
          ) : null}
        </button>
        <button
          className={`tab ${tab === 'tasks' ? 'active' : ''}`}
          onClick={() => setTab('tasks')}
        >
          Claude Tasks
          {activeTasks > 0 && (
            <span className="badge badge-active">{activeTasks}</span>
          )}
        </button>
      </nav>

      {tab === 'issues' && (
        <IssuesTab
          issues={issueData?.issues || []}
          loading={issuesLoading}
          onRefresh={refreshIssues}
          onAssign={handleAssign}
          onSelect={handleSelectIssue}
        />
      )}
      {tab === 'prs' && (
        <PullRequestsTab
          prs={prData?.prs || []}
          loading={prsLoading}
          onRefresh={refreshPRs}
        />
      )}
      {tab === 'tasks' && (
        <TasksTab tasks={tasks} connected={connected} />
      )}

      {assignMsg && <div className="toast">{assignMsg}</div>}
    </div>
  );
}
