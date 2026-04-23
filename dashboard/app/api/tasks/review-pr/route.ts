// POST /api/tasks/review-pr — open interactive Claude CLI to review a PR

import { NextRequest, NextResponse } from 'next/server';
import { openClaudeTerminal } from '@/lib/terminal';
import { REPO, REPO_URL, ReviewStrategy, ReviewLevel, ReviewContext, DEFAULT_REVIEW_CONFIGS, CliTool } from '@/lib/types';

interface ReviewPRBody {
  prNumber?: number;
  prUrl?: string;
  strategy?: ReviewStrategy;
  level?: ReviewLevel;
  context?: ReviewContext;
  cliTool?: CliTool;
}

function buildReviewPrompt(
  prUrl: string,
  strategy: ReviewStrategy,
  level: ReviewLevel,
  context: ReviewContext,
): string {
  const lines: string[] = [
    `Use the pilot-pr-reviewer agent to review this PR: ${prUrl} --strategy ${strategy} --level ${level}`,
  ];

  if (context === 'reviewing-own') {
    lines.push('');
    lines.push('IMPORTANT: This is the user\'s own PR. NEVER publish any comments, approvals, or reviews to GitHub. Present all findings locally only.');
  }

  return lines.join('\n');
}

export async function POST(request: NextRequest) {
  const body = (await request.json()) as ReviewPRBody;
  const { prNumber, prUrl: rawPrUrl, cliTool = 'claude' } = body;

  // Resolve review config with defaults
  const context: ReviewContext = body.context ?? 'reviewing-others';
  const defaults = DEFAULT_REVIEW_CONFIGS[context];
  const level: ReviewLevel = body.level ?? defaults.level;

  // Hard override: own PRs always use normal strategy
  let strategy: ReviewStrategy = body.strategy ?? defaults.strategy;
  if (context === 'reviewing-own' && strategy !== 'normal') {
    strategy = 'normal';
  }

  // Resolve PR URL
  let prUrl: string;
  let label: string;

  if (rawPrUrl && typeof rawPrUrl === 'string') {
    const prPattern = /^https:\/\/[^/]+\/(?:[^/]+\/)+(?:pull|merge_requests|pullrequest)\/\d+/;
    if (!prPattern.test(rawPrUrl)) {
      return NextResponse.json(
        { error: 'Invalid PR/MR URL. Expected format: https://<host>/owner/repo/pull/123' },
        { status: 400 },
      );
    }
    prUrl = rawPrUrl.split('?')[0].split('#')[0];
    const num = prUrl.match(/\/(?:pull|merge_requests|pullrequest)\/(\d+)/)?.[1] || 'PR';
    label = `#${num}`;
  } else if (prNumber && typeof prNumber === 'number') {
    prUrl = `${REPO_URL}/pull/${prNumber}`;
    label = `#${prNumber}`;
  } else {
    return NextResponse.json({ error: 'Missing prNumber or prUrl' }, { status: 400 });
  }

  const customPrompt = buildReviewPrompt(prUrl, strategy, level, context);
  const strategyLabel = strategy === 'quick-approve' ? 'Quick Approve' : strategy === 'auto' ? 'Auto' : '';
  const tabSuffix = strategyLabel ? ` [${strategyLabel}]` : '';

  console.log(`[tasks/review-pr] Reviewing PR ${label} (strategy=${strategy}, level=${level}, context=${context})`);
  const termResult = openClaudeTerminal({
    customPrompt,
    tabTitle: `Claude: Review PR ${label}${tabSuffix}`,
    cliTool,
  });

  if (!termResult.success) {
    console.error(`[tasks/review-pr] Failed to open terminal for PR ${label}: ${termResult.error}`);
    return NextResponse.json(
      { success: false, error: termResult.error || 'Failed to spawn terminal' },
      { status: 500 },
    );
  }

  console.log(`[tasks/review-pr] Terminal opened for PR ${label}`);
  return NextResponse.json({
    success: true,
    message: `Claude opened for PR ${label} review (${strategy}/${level})`,
  });
}
