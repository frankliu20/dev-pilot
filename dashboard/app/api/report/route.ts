// GET /api/report — end-of-day report data (no AI, pure data collection)

import { NextResponse } from 'next/server';
import {
  fetchTodayCommits,
  fetchRecentPRs,
  fetchClosedIssues,
  fetchMyOpenIssues,
  fetchMyOpenPRs,
  classifyPRAction,
} from '@/lib/github';
import { REPO, REPO_URL } from '@/lib/types';
import { repoUrl as buildRepoUrl } from '@/lib/git-provider';

/** Build a URL for a PR/issue, using the repo field if available */
function prUrl(pr: { number: number; url?: string; repo?: string }): string {
  if (pr.url) return pr.url;
  const base = pr.repo ? buildRepoUrl(pr.repo) : REPO_URL;
  return `${base}/pull/${pr.number}`;
}
function issueUrl(issue: { number: number; url?: string; repo?: string }): string {
  if (issue.url) return issue.url;
  const base = issue.repo ? buildRepoUrl(issue.repo) : REPO_URL;
  return `${base}/issues/${issue.number}`;
}

export async function GET() {
  const today = new Date().toISOString().substring(0, 10); // "2026-04-07"
  console.log(`[report] Generating report for ${today}`);

  // Fetch all data in parallel (all functions now query ALL configured repos)
  const [commits, recentPRs, closedIssues, openIssues, openPRsRaw] = await Promise.all([
    fetchTodayCommits(),
    fetchRecentPRs(),
    fetchClosedIssues(),
    fetchMyOpenIssues(),
    fetchMyOpenPRs(),
  ]);

  // PRs merged today
  const mergedPRs = recentPRs
    .filter(pr => pr.state === 'MERGED' && pr.mergedAt.startsWith(today))
    .map(pr => ({
      number: pr.number,
      title: pr.title,
      mergedAt: pr.mergedAt,
      url: prUrl(pr),
    }));

  // Issues closed today
  const completedIssues = closedIssues
    .filter(i => i.closedAt.startsWith(today))
    .map(issue => {
      // Try to find a matching merged PR (title contains #N)
      const linkedPR = mergedPRs.find(pr =>
        pr.title.includes(`#${issue.number}`) ||
        pr.title.toLowerCase().includes(`issue-${issue.number}`)
      );
      return {
        number: issue.number,
        title: issue.title,
        closedAt: issue.closedAt,
        url: issueUrl(issue),
        linkedPR: linkedPR ? { number: linkedPR.number, url: linkedPR.url } : null,
      };
    });

  // Open PRs with status
  const openPRs = openPRsRaw.map(pr => ({
    number: pr.number,
    title: pr.title,
    url: pr.url || prUrl(pr),
    action: classifyPRAction(pr),
    reviewDecision: pr.reviewDecision || 'REVIEW_REQUIRED',
    isDraft: pr.isDraft,
  }));

  // Open issues (carry-over)
  const carryOver = openIssues.map(issue => ({
    number: issue.number,
    title: issue.title,
    url: issueUrl(issue),
    labels: issue.labels.map(l => l.name),
    isBacklog: issue.labels.some(l => l.name.toLowerCase() === 'backlog'),
  }));

  // Stats
  const stats = {
    issuesClosed: completedIssues.length,
    prsMerged: mergedPRs.length,
    prsOpen: openPRs.length,
    commits: commits.length,
  };

  console.log(`[report] Stats: ${stats.issuesClosed} closed, ${stats.prsMerged} merged, ${stats.prsOpen} open, ${stats.commits} commits`);
  return NextResponse.json({
    date: today,
    commits,
    completedIssues,
    mergedPRs,
    openPRs,
    carryOver,
    stats,
  });
}
