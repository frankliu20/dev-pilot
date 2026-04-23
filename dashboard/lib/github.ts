// GitHub data fetching via gh CLI (async)
// Platform-aware: uses git-provider to support GitHub, GitLab, and Azure DevOps.

import { exec } from 'child_process';
import { promisify } from 'util';
import { join } from 'path';
import { GHIssue, GHPR, PRAction } from './types';
import { getConfig, getRepo, getRepoSlug, getReviewRepos, getWorkspace } from './config';
import { runCLI, getPlatform, supportsGraphQL, repoFromUrl } from './git-provider';

const execAsync = promisify(exec);

async function runGH(args: string): Promise<string> {
  return runCLI(args);
}

/** Fetch issues from ALL configured repos, merge and sort by updatedAt */
export async function fetchMyOpenIssues(): Promise<GHIssue[]> {
  const repos = getConfig().repos;
  const results = await Promise.all(
    repos.map(async (repo) => {
      const slug = getRepoSlug(repo);
      const raw = await runGH(
        `issue list --repo ${slug} --assignee @me --state open --limit 30 ` +
        `--json number,title,labels,assignees,updatedAt,createdAt,url,milestone,state`
      );
      try {
        return JSON.parse(raw) as GHIssue[];
      } catch {
        return [];
      }
    })
  );
  return results.flat().sort((a, b) =>
    new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
  );
}

/** Fetch PRs from ALL configured repos, merge and sort by createdAt */
export async function fetchMyOpenPRs(): Promise<GHPR[]> {
  const repos = getConfig().repos;
  const results = await Promise.all(
    repos.map(async (repo) => {
      const slug = getRepoSlug(repo);
      const raw = await runGH(
        `pr list --repo ${slug} --author @me --state open --limit 20 ` +
        `--json number,title,headRefName,isDraft,createdAt,reviewDecision,statusCheckRollup,url,body,comments,reviews,reviewRequests`
      );
      try {
        return JSON.parse(raw) as GHPR[];
      } catch {
        return [];
      }
    })
  );
  return results.flat().sort((a, b) =>
    new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );
}

export async function fetchReviewRequestedPRs(): Promise<GHPR[]> {
  const jsonFields = 'number,title,headRefName,isDraft,createdAt,reviewDecision,statusCheckRollup,url,body,comments,reviews,reviewRequests,author';
  const results = await Promise.all(
    getReviewRepos().map(async (repo) => {
      const slug = getRepoSlug(repo);
      const raw = await runGH(
        `pr list --repo ${slug} --search "review-requested:@me" --state open --limit 20 --json ${jsonFields}`
      );
      try {
        return JSON.parse(raw) as GHPR[];
      } catch {
        return [];
      }
    })
  );
  // Flatten and sort by createdAt descending
  return results.flat().sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}

/** Extract owner/name from a PR url — delegates to git-provider */
// repoFromUrl is imported from git-provider

/**
 * Fetch unresolved review thread counts.
 * Groups PRs by repo (extracted from pr.url) so it works across multiple repos.
 */
export async function fetchUnresolvedThreadCounts(
  prs: GHPR[]
): Promise<Map<number, number>> {
  if (prs.length === 0) return new Map();

  // GraphQL is only supported on GitHub
  if (!supportsGraphQL()) return new Map();

  // Group PR numbers by repo
  const byRepo = new Map<string, number[]>();
  for (const pr of prs) {
    const repo = pr.url ? repoFromUrl(pr.url) : null;
    if (!repo) continue;
    const list = byRepo.get(repo) || [];
    list.push(pr.number);
    byRepo.set(repo, list);
  }

  const result = new Map<number, number>();

  // Query each repo's PRs via GraphQL
  await Promise.all(
    Array.from(byRepo.entries()).map(async ([repo, prNumbers]) => {
      const [owner, name] = repo.split('/');
      const fragments = prNumbers.map(n =>
        `pr_${n}: pullRequest(number: ${n}) { reviewThreads(first: 100) { nodes { isResolved } } }`
      ).join(' ');

      const query = `{ repository(owner: \\"${owner}\\", name: \\"${name}\\") { ${fragments} } }`;

      try {
        const raw = await runGH(`api graphql -f query="${query}"`);
        const parsed = JSON.parse(raw);
        const repoData = parsed?.data?.repository;
        if (!repoData) return;

        for (const n of prNumbers) {
          const pr = repoData[`pr_${n}`];
          if (!pr?.reviewThreads?.nodes) continue;
          const unresolved = pr.reviewThreads.nodes.filter(
            (t: { isResolved: boolean }) => !t.isResolved
          ).length;
          result.set(n, unresolved);
        }
      } catch (err) {
        console.error(`fetchUnresolvedThreadCounts failed for ${repo}:`, err);
      }
    })
  );

  return result;
}

/** Fetch issue detail — extracts repo from issue URL or falls back to primary repo */
export async function fetchIssueDetail(number: number, issueUrl?: string): Promise<GHIssue | null> {
  const repo = (issueUrl && repoFromUrl(issueUrl)) || getRepoSlug();
  const raw = await runGH(
    `issue view ${number} --repo ${repo} ` +
    `--json number,title,labels,assignees,updatedAt,createdAt,url,milestone,state,body`
  );
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export function classifyPRAction(pr: GHPR): PRAction {
  if (pr.isDraft) return 'draft';

  const ciState = pr.statusCheckRollup?.length
    ? pr.statusCheckRollup.every(c => c.conclusion === 'SUCCESS' || c.conclusion === 'NEUTRAL' || c.conclusion === 'SKIPPED')
      ? 'pass'
      : pr.statusCheckRollup.some(c => c.conclusion === 'FAILURE')
        ? 'fail'
        : pr.statusCheckRollup.some(c => c.status !== 'COMPLETED')
          ? 'pending'
          : 'pass'
    : 'pending';

  if (ciState === 'fail') return 'ci_failing';
  if (pr.reviewDecision === 'CHANGES_REQUESTED') return 'changes_requested';
  if (pr.unresolvedThreadCount != null && pr.unresolvedThreadCount > 0) return 'has_unresolved_comments';
  if (ciState === 'pass' && pr.reviewDecision === 'APPROVED') return 'ready_to_merge';
  if (pr.reviewDecision === 'REVIEW_REQUIRED' || pr.reviewDecision === '') return 'review_pending';
  return 'waiting';
}

// ── Report data (end-of-day / daily summary) ────────────────────────────

export interface CommitInfo {
  hash: string;
  message: string;
}

export interface ReportPR {
  number: number;
  title: string;
  state: string;
  createdAt: string;
  mergedAt: string;
  reviewDecision: string;
  ciStatus: string;
  repo?: string;
}

export interface ClosedIssue {
  number: number;
  title: string;
  closedAt: string;
  repo?: string;
}

/** Get local repo paths for ALL configured repos */
function getAllRepoPaths(): { repo: string; path: string }[] {
  const ws = getWorkspace();
  return getConfig().repos.map(repo => ({
    repo,
    path: join(ws, repo.split('/').pop() || ''),
  }));
}

export async function fetchTodayCommits(): Promise<CommitInfo[]> {
  const allPaths = getAllRepoPaths();
  const results = await Promise.all(
    allPaths.map(async ({ path: repoPath }) => {
      try {
        const { stdout } = await execAsync(
          `git -C "${repoPath}" log --all --oneline --since="today" --author="$(git -C "${repoPath}" config user.name)"`,
          { encoding: 'utf-8', timeout: 15000 },
        );
        if (!stdout.trim()) return [];
        return stdout.trim().split('\n').map(line => {
          const spaceIdx = line.indexOf(' ');
          return {
            hash: line.substring(0, spaceIdx),
            message: line.substring(spaceIdx + 1),
          };
        });
      } catch {
        return [];
      }
    })
  );
  return results.flat();
}

/** Fetch recent PRs from ALL configured repos */
export async function fetchRecentPRs(): Promise<ReportPR[]> {
  const repos = getConfig().repos;
  const results = await Promise.all(
    repos.map(async (repo) => {
      const slug = getRepoSlug(repo);
      const raw = await runGH(
        `pr list --repo ${slug} --author @me --state all --limit 30 ` +
        `--json number,title,state,createdAt,mergedAt,reviewDecision,statusCheckRollup`
      );
      try {
        const prs = JSON.parse(raw) as Array<{
          number: number;
          title: string;
          state: string;
          createdAt: string;
          mergedAt: string;
          reviewDecision: string;
          statusCheckRollup: { status: string; conclusion: string }[];
        }>;
        return prs.map(pr => ({
          number: pr.number,
          title: pr.title,
          state: pr.state,
          createdAt: pr.createdAt,
          mergedAt: pr.mergedAt || '',
          reviewDecision: pr.reviewDecision || '',
          ciStatus: pr.statusCheckRollup?.length
            ? pr.statusCheckRollup.every(c => c.conclusion === 'SUCCESS' || c.conclusion === 'NEUTRAL' || c.conclusion === 'SKIPPED')
              ? 'pass'
              : pr.statusCheckRollup.some(c => c.conclusion === 'FAILURE')
                ? 'fail'
                : pr.statusCheckRollup.some(c => c.status !== 'COMPLETED')
                  ? 'pending'
                  : 'pass'
            : 'unknown',
          repo,
        }));
      } catch {
        return [];
      }
    })
  );
  return results.flat().sort((a, b) =>
    new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );
}

/** Fetch closed issues from ALL configured repos */
export async function fetchClosedIssues(): Promise<ClosedIssue[]> {
  const repos = getConfig().repos;
  const results = await Promise.all(
    repos.map(async (repo) => {
      const slug = getRepoSlug(repo);
      const raw = await runGH(
        `issue list --repo ${slug} --assignee @me --state closed --limit 20 ` +
        `--json number,title,closedAt`
      );
      try {
        const issues = JSON.parse(raw) as ClosedIssue[];
        return issues.map(i => ({ ...i, repo }));
      } catch {
        return [];
      }
    })
  );
  return results.flat().sort((a, b) =>
    new Date(b.closedAt).getTime() - new Date(a.closedAt).getTime()
  );
}
