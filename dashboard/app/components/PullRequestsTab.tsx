'use client';

import { GHPR, PRAction, REPO_URL } from '@/lib/types';

interface EnrichedPR extends GHPR {
  action: PRAction;
}

interface Props {
  prs: EnrichedPR[];
  loading: boolean;
  onRefresh: () => void;
}

const ACTION_DISPLAY: Record<PRAction, { icon: string; text: string; color: string }> = {
  ready_to_merge: { icon: '\u2705', text: 'Ready to merge', color: '#10b981' },
  ci_failing: { icon: '\u274c', text: 'CI failing', color: '#ef4444' },
  changes_requested: { icon: '\ud83d\udcdd', text: 'Changes requested', color: '#f59e0b' },
  review_pending: { icon: '\u23f3', text: 'Review pending', color: '#6b7280' },
  draft: { icon: '\u270f\ufe0f', text: 'Draft', color: '#6b7280' },
  waiting: { icon: '\u23f3', text: 'Waiting', color: '#6b7280' },
};

export default function PullRequestsTab({ prs, loading, onRefresh }: Props) {
  if (loading) return <div className="tab-loading">Loading PRs...</div>;

  return (
    <div className="tab-content">
      <div className="tab-header">
        <h2>Open PRs ({prs.length})</h2>
        <button onClick={onRefresh} className="refresh-btn">Refresh</button>
      </div>
      {prs.length === 0 ? (
        <div className="empty">No open PRs</div>
      ) : (
        <div className="list">
          {prs.map(pr => {
            const display = ACTION_DISPLAY[pr.action];
            return (
              <div key={pr.number} className="list-item">
                <div className="item-main">
                  <a
                    href={`${REPO_URL}/pull/${pr.number}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="item-number"
                  >
                    #{pr.number}
                  </a>
                  <span className="item-title">{pr.title}</span>
                </div>
                <div className="item-meta">
                  <span className="branch-name">{pr.headRefName}</span>
                  <span className="pr-action" style={{ color: display.color }}>
                    {display.icon} {display.text}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
