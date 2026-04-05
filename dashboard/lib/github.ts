// GitHub data fetching via gh CLI

import { execSync } from 'child_process';
import { REPO, GHIssue, GHPR, PRAction } from './types';

function runGH(args: string): string {
  try {
    return execSync(`gh ${args}`, {
      encoding: 'utf-8',
      timeout: 15000,
      stdio: ['pipe', 'pipe', 'pipe'],
    });
  } catch (err) {
    console.error(`gh command failed: gh ${args}`, err);
    return '[]';
  }
}

export function fetchMyOpenIssues(): GHIssue[] {
  const raw = runGH(
    `issue list --repo ${REPO} --assignee @me --state open --limit 30 ` +
    `--json number,title,labels,assignees,updatedAt,createdAt,url,milestone,state`
  );
  try {
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

export function fetchMyOpenPRs(): GHPR[] {
  const raw = runGH(
    `pr list --repo ${REPO} --author @me --state open --limit 20 ` +
    `--json number,title,headRefName,isDraft,createdAt,reviewDecision,statusCheckRollup,url,body`
  );
  try {
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

export function fetchIssueDetail(number: number): GHIssue | null {
  const raw = runGH(
    `issue view ${number} --repo ${REPO} ` +
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
    ? pr.statusCheckRollup.every(c => c.state === 'SUCCESS')
      ? 'pass'
      : pr.statusCheckRollup.some(c => c.state === 'FAILURE')
        ? 'fail'
        : 'pending'
    : 'pending';

  if (ciState === 'fail') return 'ci_failing';
  if (pr.reviewDecision === 'CHANGES_REQUESTED') return 'changes_requested';
  if (ciState === 'pass' && pr.reviewDecision === 'APPROVED') return 'ready_to_merge';
  if (pr.reviewDecision === 'REVIEW_REQUIRED' || pr.reviewDecision === '') return 'review_pending';
  return 'waiting';
}
