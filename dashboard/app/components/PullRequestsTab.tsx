'use client';

import { useState, useMemo } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeRaw from 'rehype-raw';
import { GHPR, PRAction, REPO_URL, ReviewConfig, ReviewStrategy, ReviewLevel, DEFAULT_REVIEW_CONFIGS, STRATEGY_OPTIONS, LEVEL_OPTIONS } from '@/lib/types';
import { PR_ACTION_CONFIG } from '@/lib/constants';
import { cn, githubToTeamsEmail, buildTeamsPingUrl } from '@/lib/utils';
import Icon from './ui/Icon';
import Badge from './ui/Badge';
import Button from './ui/Button';
import Tooltip from './ui/Tooltip';
import Skeleton from './ui/Skeleton';
import EmptyState from './ui/EmptyState';
import Select from './ui/Select';
import styles from './PullRequestsTab.module.css';

interface EnrichedPR extends GHPR {
  action: PRAction;
}

interface Props {
  prs: EnrichedPR[];
  reviewRequested: EnrichedPR[];
  loading: boolean;
  onRefresh: () => void;
  onFixComments: (pr: EnrichedPR) => void;
  onReview: (pr: EnrichedPR, config?: ReviewConfig) => void;
  onReviewPRUrl: (prUrl: string) => void;
}

type Filter = 'all' | 'ready';
type SubTab = 'my-prs' | 'review-requested';

export default function PullRequestsTab({ prs, reviewRequested, loading, onRefresh, onFixComments, onReview, onReviewPRUrl }: Props) {
  const [subTab, setSubTab] = useState<SubTab>('my-prs');
  const [filter, setFilter] = useState<Filter>('all');
  const [showReviewInput, setShowReviewInput] = useState(false);
  const [prUrl, setPrUrl] = useState('');
  const [expandedPR, setExpandedPR] = useState<number | null>(null);

  // Per-PR strategy & level selections for review-requested table
  const [strategies, setStrategies] = useState<Map<number, ReviewStrategy>>(new Map());
  const [levels, setLevels] = useState<Map<number, ReviewLevel>>(new Map());

  const defaults = DEFAULT_REVIEW_CONFIGS['reviewing-others'];
  const getStrategy = (n: number): ReviewStrategy => strategies.get(n) || defaults.strategy;
  const setStrategy = (n: number, s: ReviewStrategy) => setStrategies(prev => new Map(prev).set(n, s));
  const getLevel = (n: number): ReviewLevel => levels.get(n) || defaults.level;
  const setLevel = (n: number, l: ReviewLevel) => setLevels(prev => new Map(prev).set(n, l));

  const handleReviewSubmit = () => {
    const trimmed = prUrl.trim();
    if (!trimmed) return;
    onReviewPRUrl(trimmed);
    setPrUrl('');
    setShowReviewInput(false);
  };

  const filteredPRs = useMemo(() => {
    if (filter === 'all') return prs;
    if (filter === 'ready') return prs.filter(pr => pr.action === 'ready_to_merge');
    return prs;
  }, [prs, filter]);

  if (loading) {
    return (
      <div>
        <div className={styles.tabHeader}>
          <h2 className={styles.tabTitle}>Open PRs</h2>
        </div>
        <div className={styles.list}>
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} preset="card" />
          ))}
        </div>
      </div>
    );
  }

  // Card renderer for "My PRs" view (unchanged from original)
  const renderPRCard = (pr: EnrichedPR) => {
    const config = PR_ACTION_CONFIG[pr.action] || PR_ACTION_CONFIG.waiting;
    const totalCommentCount = (pr.comments?.totalCount || 0) + (pr.reviews?.totalCount || 0);
    const unresolvedCount = pr.unresolvedThreadCount ?? 0;
    const commentCount = unresolvedCount > 0 ? unresolvedCount : totalCommentCount;
    const hasUnresolved = unresolvedCount > 0;
    const isExpanded = expandedPR === pr.number;
    const ownDefaults = DEFAULT_REVIEW_CONFIGS['reviewing-own'];
    return (
      <div
        key={pr.number}
        className={cn(styles.prCard, isExpanded && styles.prCardExpanded)}
        onClick={() => setExpandedPR(isExpanded ? null : pr.number)}
      >
        <div className={styles.prMain}>
          <a
            href={pr.url || `${REPO_URL}/pull/${pr.number}`}
            target="_blank"
            rel="noopener noreferrer"
            className={styles.prNumber}
            onClick={e => e.stopPropagation()}
          >
            #{pr.number}
          </a>
          <span className={styles.prTitle}>{pr.title}</span>
          {commentCount > 0 && (
            <Tooltip content={
              hasUnresolved
                ? `${unresolvedCount} unresolved comment${unresolvedCount > 1 ? 's' : ''}`
                : `${commentCount} comment${commentCount > 1 ? 's' : ''}`
            }>
              <span className={styles.commentBadge}>
                <Icon name="message-circle" size={12} />
                {commentCount}
              </span>
            </Tooltip>
          )}
          <Badge variant={config.variant} size="sm">
            <Icon name={config.icon} size={12} />
            {config.label}
          </Badge>
          <Icon
            name={isExpanded ? 'chevron-up' : 'chevron-down'}
            size={14}
            className={styles.expandIcon}
          />
        </div>
        <div className={styles.prMeta}>
          <div className={styles.branch}>
            <span>{pr.headRefName}</span>
            <Icon name="chevron-right" size={10} className={styles.branchArrow} />
            <span>main</span>
          </div>
          <div className={styles.prActions} onClick={e => e.stopPropagation()}>
            <Button variant="info" size="sm" onClick={() => onReview(pr, {
              strategy: ownDefaults.strategy,
              level: ownDefaults.level,
              context: 'reviewing-own',
            })}>
              <Icon name="eye" size={12} />
              Review
            </Button>
            {hasUnresolved && (
              <Button variant="warning" size="sm" onClick={() => onFixComments(pr)}>
                <Icon name="message-circle" size={12} />
                Fix Comments ({unresolvedCount})
              </Button>
            )}
            <a
              href={pr.url || `${REPO_URL}/pull/${pr.number}`}
              target="_blank"
              rel="noopener noreferrer"
              className={styles.githubLink}
            >
              <Icon name="external-link" size={12} />
              View
            </a>
            {pr.action === 'review_pending' && pr.reviewRequests?.length > 0 && (
              pr.reviewRequests.map(r => (
                <Tooltip key={r.login} content={`Ping ${r.login.replace(/_microsoft$/, '')} on Teams`}>
                  <a
                    href={buildTeamsPingUrl(githubToTeamsEmail(r.login), pr)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={styles.teamsLink}
                  >
                    <Icon name="send" size={12} />
                    Ping
                  </a>
                </Tooltip>
              ))
            )}
          </div>
        </div>
        {isExpanded && pr.body && (
          <div className={styles.prBody} onClick={e => e.stopPropagation()}>
            <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeRaw]}>
              {pr.body}
            </ReactMarkdown>
          </div>
        )}
        {isExpanded && !pr.body && (
          <div className={styles.prBody}>
            <p className={styles.noBody}>No description provided.</p>
          </div>
        )}
      </div>
    );
  };

  return (
    <div>
      <div className={styles.tabHeader}>
        <h2 className={styles.tabTitle}>Open PRs ({prs.length})</h2>
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
          <Button variant="info" size="sm" onClick={() => setShowReviewInput(v => !v)}>
            <Icon name="eye" size={14} />
            Review PR
          </Button>
          <Button variant="ghost" size="sm" onClick={onRefresh}>
            <Icon name="refresh" size={14} />
            Refresh
          </Button>
        </div>
      </div>

      {showReviewInput && (
        <div className={styles.reviewBar}>
          <Icon name="git-pull-request" size={14} className={styles.reviewBarIcon} />
          <input
            className={styles.reviewInput}
            type="text"
            placeholder="Paste PR link, e.g. https://github.com/owner/repo/pull/123"
            value={prUrl}
            onChange={e => setPrUrl(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') handleReviewSubmit(); if (e.key === 'Escape') { setShowReviewInput(false); setPrUrl(''); } }}
            autoFocus
          />
          <Button variant="primary" size="sm" onClick={handleReviewSubmit} disabled={!prUrl.trim()}>
            Start Review
          </Button>
          <button className={styles.reviewCloseBtn} onClick={() => { setShowReviewInput(false); setPrUrl(''); }}>
            <Icon name="x" size={14} />
          </button>
        </div>
      )}

      {/* Sub-tab toggle */}
      <div className={styles.subTabs}>
        <button
          className={cn(styles.subTabBtn, subTab === 'my-prs' && styles.active)}
          onClick={() => setSubTab('my-prs')}
        >
          My PRs ({prs.length})
        </button>
        <button
          className={cn(styles.subTabBtn, subTab === 'review-requested' && styles.active)}
          onClick={() => setSubTab('review-requested')}
        >
          <Icon name="eye" size={12} />
          Needs My Review ({reviewRequested.length})
        </button>
      </div>

      {/* My PRs view — card layout */}
      {subTab === 'my-prs' && (
        <>
          {prs.length > 0 && (
            <div className={styles.filters}>
              {([
                { key: 'all', label: 'All' },
                { key: 'ready', label: 'Ready to Merge' },
              ] as const).map(f => (
                <button
                  key={f.key}
                  className={cn(styles.filterBtn, filter === f.key && styles.active)}
                  onClick={() => setFilter(f.key)}
                >
                  {f.label}
                </button>
              ))}
            </div>
          )}

          {prs.length === 0 ? (
            <EmptyState
              icon="git-pull-request"
              title="No open PRs"
              description="Pull requests authored by you will appear here."
            />
          ) : filteredPRs.length === 0 ? (
            <EmptyState
              icon="filter"
              title="No matching PRs"
              description={`No PRs match the "${filter}" filter.`}
            />
          ) : (
            <div className={styles.list}>
              {filteredPRs.map(pr => renderPRCard(pr))}
            </div>
          )}
        </>
      )}

      {/* Review-requested view — table layout */}
      {subTab === 'review-requested' && (
        reviewRequested.length === 0 ? (
          <EmptyState
            icon="eye"
            title="No PRs need your review"
            description="PRs where you are requested as a reviewer will appear here."
          />
        ) : (
          <table className={styles.reviewTable}>
            <thead>
              <tr>
                <th className={styles.rtColNumber}>#</th>
                <th>Title</th>
                <th className={styles.rtColAuthor}>Author</th>
                <th className={styles.rtColStatus}>Status</th>
                <th className={styles.rtColStrategy}>Strategy</th>
                <th className={styles.rtColLevel}>Level</th>
                <th className={styles.rtColAction}>Action</th>
              </tr>
            </thead>
            <tbody>
              {reviewRequested.map(pr => {
                const config = PR_ACTION_CONFIG[pr.action] || PR_ACTION_CONFIG.waiting;
                return (
                  <tr key={pr.number}>
                    <td className={styles.rtColNumber}>
                      <a
                        href={pr.url || `${REPO_URL}/pull/${pr.number}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className={styles.prNumberLink}
                      >
                        #{pr.number}
                      </a>
                    </td>
                    <td>
                      <span className={styles.rtTitle}>{pr.title}</span>
                    </td>
                    <td className={styles.rtColAuthor}>
                      <span className={styles.authorBadge}>
                        <Icon name="user" size={11} />
                        {pr.author?.login || '—'}
                      </span>
                    </td>
                    <td className={styles.rtColStatus}>
                      <Badge variant={config.variant} size="sm">
                        <Icon name={config.icon} size={12} />
                        {config.label}
                      </Badge>
                    </td>
                    <td className={styles.rtColStrategy} onClick={e => e.stopPropagation()}>
                      <Select
                        size_="sm"
                        value={getStrategy(pr.number)}
                        onChange={e => setStrategy(pr.number, e.target.value as ReviewStrategy)}
                      >
                        {STRATEGY_OPTIONS.map(opt => (
                          <option key={opt.value} value={opt.value}>{opt.label}</option>
                        ))}
                      </Select>
                    </td>
                    <td className={styles.rtColLevel} onClick={e => e.stopPropagation()}>
                      <Select
                        size_="sm"
                        value={getStrategy(pr.number) === 'quick-approve' ? 'high' : getLevel(pr.number)}
                        onChange={e => setLevel(pr.number, e.target.value as ReviewLevel)}
                        disabled={getStrategy(pr.number) === 'quick-approve'}
                      >
                        {LEVEL_OPTIONS.map(opt => (
                          <option key={opt.value} value={opt.value}>{opt.emoji} {opt.label}</option>
                        ))}
                      </Select>
                    </td>
                    <td className={styles.rtColAction} onClick={e => e.stopPropagation()}>
                      <Button variant="primary" size="sm" onClick={() => {
                        const strategy = getStrategy(pr.number);
                        onReview(pr, {
                          strategy,
                          level: strategy === 'quick-approve' ? 'high' : getLevel(pr.number),
                          context: 'reviewing-others',
                        });
                      }}>
                        <Icon name="eye" size={12} />
                        Review
                      </Button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )
      )}
    </div>
  );
}
