// GET   /api/scrum — generate scrum report (Done / Ongoing / Blocker) since last scrum mark
// POST  /api/scrum — post status updates as comments to issues
// PATCH /api/scrum — update the "last scrum" timestamp mark

import { NextRequest, NextResponse } from 'next/server';
import { exec } from 'child_process';
import { promisify } from 'util';
import { readFile, writeFile, mkdir } from 'fs/promises';
import { join } from 'path';
import {
  fetchRecentPRs,
  fetchMyOpenIssues,
  fetchMyOpenPRs,
  classifyPRAction,
} from '@/lib/github';
import { getWorkspace } from '@/lib/config';
import { REPO } from '@/lib/types';
import { issueCommentArgs, getCliBinary } from '@/lib/git-provider';

const execAsync = promisify(exec);

const WS = getWorkspace();
const SCRUM_MARK_FILE = join(WS, 'logs', 'scrum-mark.json');

interface ScrumMark {
  timestamp: string; // ISO 8601
  label: string;     // human-readable
}

async function readScrumMark(): Promise<ScrumMark | null> {
  try {
    const raw = await readFile(SCRUM_MARK_FILE, 'utf-8');
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

async function writeScrumMark(mark: ScrumMark): Promise<void> {
  await mkdir(join(WS, 'logs'), { recursive: true });
  await writeFile(SCRUM_MARK_FILE, JSON.stringify(mark, null, 2), 'utf-8');
}

interface ScrumItem {
  number: number;
  title: string;
  url: string;
  status: 'done' | 'ongoing' | 'blocker';
  summary: string;
  kind: 'issue' | 'pr';
  linkedIssue?: number;   // for PR items: the issue number it fixes
  linkedPR?: { number: number; url: string };  // for issue items: the associated PR
}

export async function GET() {
  const today = new Date().toISOString().substring(0, 10);
  console.log(`[scrum] Generating scrum report for ${today}`);
  const lastMark = await readScrumMark();

  // Default to 3 days ago if no mark exists
  const sinceDate = lastMark?.timestamp
    || new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString();

  // Fetch all data in parallel
  const [recentPRs, openIssues, openPRsRaw] = await Promise.all([
    fetchRecentPRs(),
    fetchMyOpenIssues(),
    fetchMyOpenPRs(),
  ]);

  const items: ScrumItem[] = [];

  // 1. Done: PRs merged since last scrum
  const mergedPRs = recentPRs.filter(
    pr => pr.state === 'MERGED' && pr.mergedAt >= sinceDate
  );
  for (const pr of mergedPRs) {
    const issueMatch = pr.title.match(/#(\d+)/);
    const prRepo = pr.repo || REPO;
    const prUrl = `https://github.com/${prRepo}/pull/${pr.number}`;
    items.push({
      number: pr.number,
      title: pr.title,
      url: prUrl,
      status: 'done',
      summary: `PR #${pr.number} merged${issueMatch ? ` (fixes #${issueMatch[1]})` : ''}`,
      kind: 'pr',
      linkedIssue: issueMatch ? parseInt(issueMatch[1]) : undefined,
    });
  }

  // 2. Ongoing & Blocker: Open PRs
  for (const pr of openPRsRaw) {
    const action = classifyPRAction(pr);
    const isBlocker = action === 'ci_failing' || action === 'changes_requested';
    const ciLabel = pr.statusCheckRollup?.length
      ? pr.statusCheckRollup.every(c => c.conclusion === 'SUCCESS' || c.conclusion === 'NEUTRAL' || c.conclusion === 'SKIPPED')
        ? 'CI passing'
        : pr.statusCheckRollup.some(c => c.conclusion === 'FAILURE')
          ? 'CI failing'
          : pr.statusCheckRollup.some(c => c.status !== 'COMPLETED')
            ? 'CI pending'
            : 'CI passing'
      : 'CI unknown';
    const reviewLabel = pr.reviewDecision === 'APPROVED'
      ? 'approved'
      : pr.reviewDecision === 'CHANGES_REQUESTED'
        ? 'changes requested'
        : 'waiting review';

    const issueMatch = pr.title.match(/#(\d+)/);
    const prUrl = pr.url || `https://github.com/${REPO}/pull/${pr.number}`;
    items.push({
      number: pr.number,
      title: pr.title,
      url: prUrl,
      status: isBlocker ? 'blocker' : 'ongoing',
      summary: `PR #${pr.number} open — ${ciLabel}, ${reviewLabel}`,
      kind: 'pr',
      linkedIssue: issueMatch ? parseInt(issueMatch[1]) : undefined,
    });
  }

  // 3. Open issues without a PR → ongoing
  const prTitles = [...openPRsRaw.map(pr => pr.title), ...mergedPRs.map(pr => pr.title)].join(' ');
  // Build a map of issue number → PR info for linking
  const issueToPR = new Map<number, { number: number; url: string }>();
  for (const pr of openPRsRaw) {
    const m = pr.title.match(/#(\d+)/);
    if (m) {
      issueToPR.set(parseInt(m[1]), { number: pr.number, url: pr.url || `https://github.com/${REPO}/pull/${pr.number}` });
    }
  }
  for (const pr of mergedPRs) {
    const m = pr.title.match(/#(\d+)/);
    if (m) {
      const prRepo = pr.repo || REPO;
      issueToPR.set(parseInt(m[1]), { number: pr.number, url: `https://github.com/${prRepo}/pull/${pr.number}` });
    }
  }

  for (const issue of openIssues) {
    const hasPR = prTitles.includes(`#${issue.number}`) ||
      prTitles.toLowerCase().includes(`issue-${issue.number}`);
    if (hasPR) continue;

    const isBacklog = issue.labels.some(l => l.name.toLowerCase() === 'backlog');
    if (isBacklog) continue;

    const isBlocked = issue.labels.some(l =>
      l.name.toLowerCase() === 'blocked' || l.name.toLowerCase() === 'blocker'
    );

    items.push({
      number: issue.number,
      title: issue.title,
      url: issue.url || `https://github.com/${REPO}/issues/${issue.number}`,
      status: isBlocked ? 'blocker' : 'ongoing',
      summary: isBlocked ? 'Blocked — see issue labels' : 'In progress, no PR yet',
      kind: 'issue',
      linkedPR: issueToPR.get(issue.number),
    });
  }

  const done = items.filter(i => i.status === 'done');
  const ongoing = items.filter(i => i.status === 'ongoing');
  const blockers = items.filter(i => i.status === 'blocker');
  console.log(`[scrum] Done: ${done.length}, Ongoing: ${ongoing.length}, Blockers: ${blockers.length}`);
  return NextResponse.json({
    date: today,
    lastScrum: lastMark,
    sinceDate,
    items,
    done,
    ongoing,
    blockers,
  });
}

// POST: publish status comments to GitHub issues
export async function POST(request: NextRequest) {
  const body = await request.json();
  const { updates } = body as {
    updates: { issueNumber: number; comment: string; repo?: string }[];
  };

  if (!updates || !Array.isArray(updates) || updates.length === 0) {
    return NextResponse.json({ error: 'No updates provided' }, { status: 400 });
  }

  console.log(`[scrum] Posting status comments to ${updates.length} issues`);
  const results: { number: number; success: boolean; error?: string }[] = [];

  for (const update of updates) {
    try {
      const targetRepo = update.repo || REPO;
      const cli = getCliBinary();
      const args = issueCommentArgs(targetRepo, update.issueNumber, update.comment);
      await execAsync(
        `${cli} ${args}`,
        { timeout: 15000 },
      );
      results.push({ number: update.issueNumber, success: true });
    } catch (err) {
      results.push({
        number: update.issueNumber,
        success: false,
        error: err instanceof Error ? err.message.substring(0, 100) : String(err),
      });
    }
  }

  const posted = results.filter(r => r.success).length;
  const failed = results.filter(r => !r.success).length;
  console.log(`[scrum] Posted ${posted} comments, ${failed} failed`);
  return NextResponse.json({
    success: results.every(r => r.success),
    results,
    posted,
    failed,
  });
}

// PATCH: update the "last scrum" timestamp
export async function PATCH() {
  const now = new Date();
  const mark: ScrumMark = {
    timestamp: now.toISOString(),
    label: now.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    }),
  };

  try {
    await writeScrumMark(mark);
    console.log(`[scrum] Scrum mark updated to ${mark.label}`);
    return NextResponse.json({ success: true, mark });
  } catch (err) {
    return NextResponse.json(
      { error: `Failed to save scrum mark: ${err}` },
      { status: 500 },
    );
  }
}
