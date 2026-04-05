'use client';

import { GHIssue, REPO_URL } from '@/lib/types';

interface Props {
  issue: GHIssue & { body?: string };
  onBack: () => void;
  onAssign: (issue: GHIssue) => void;
}

export default function IssueDetail({ issue, onBack, onAssign }: Props) {
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

      {issue.body && (
        <div className="detail-body">
          <pre>{issue.body}</pre>
        </div>
      )}

      <div className="detail-actions">
        <button className="assign-btn large" onClick={() => onAssign(issue)}>
          Assign to Claude
        </button>
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
