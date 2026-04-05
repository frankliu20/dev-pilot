'use client';

import { GHIssue, REPO_URL } from '@/lib/types';

interface Props {
  issues: GHIssue[];
  loading: boolean;
  onRefresh: () => void;
  onAssign: (issue: GHIssue) => void;
  onSelect: (issue: GHIssue) => void;
}

export default function IssuesTab({ issues, loading, onRefresh, onAssign, onSelect }: Props) {
  if (loading) return <div className="tab-loading">Loading issues...</div>;

  return (
    <div className="tab-content">
      <div className="tab-header">
        <h2>Open Issues ({issues.length})</h2>
        <button onClick={onRefresh} className="refresh-btn">Refresh</button>
      </div>
      {issues.length === 0 ? (
        <div className="empty">No open issues assigned to you</div>
      ) : (
        <div className="list">
          {issues.map(issue => (
            <div key={issue.number} className="list-item" onClick={() => onSelect(issue)}>
              <div className="item-main">
                <a
                  href={`${REPO_URL}/issues/${issue.number}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="item-number"
                  onClick={e => e.stopPropagation()}
                >
                  #{issue.number}
                </a>
                <span className="item-title">{issue.title}</span>
              </div>
              <div className="item-meta">
                <div className="labels">
                  {issue.labels.map(l => (
                    <span key={l.name} className="label">{l.name}</span>
                  ))}
                </div>
                <button
                  className="assign-btn"
                  onClick={e => { e.stopPropagation(); onAssign(issue); }}
                >
                  Assign to Claude
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
