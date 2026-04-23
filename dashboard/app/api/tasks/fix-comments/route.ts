// POST /api/tasks/fix-comments — trigger Claude to check and fix open PR comments

import { NextRequest, NextResponse } from 'next/server';
import { openClaudeTerminal } from '@/lib/terminal';
import { REPO, REPO_URL, CliTool } from '@/lib/types';

type FixMode = 'normal' | 'auto';

export async function POST(request: NextRequest) {
  const body = await request.json();
  const { prNumber, mode = 'normal', cliTool = 'claude' } = body as {
    prNumber: number;
    mode?: FixMode;
    cliTool?: CliTool;
  };

  if (!prNumber || typeof prNumber !== 'number') {
    return NextResponse.json({ error: 'Missing prNumber' }, { status: 400 });
  }

  const prUrl = `${REPO_URL}/pull/${prNumber}`;
  const autoFlag = mode === 'auto' ? ' --auto' : '';
  const customPrompt = `/pilot-dev-issue${autoFlag} check open comments on ${prUrl} and fix them`;

  console.log(`[tasks/fix-comments] Fixing comments on PR #${prNumber} (mode=${mode})`);
  const termResult = openClaudeTerminal({
    customPrompt,
    tabTitle: `Claude: Fix PR #${prNumber} comments`,
    cliTool,
  });

  if (!termResult.success) {
    console.error(`[tasks/fix-comments] Failed to open terminal for PR #${prNumber}: ${termResult.error}`);
    return NextResponse.json(
      { success: false, error: termResult.error || 'Failed to spawn terminal' },
      { status: 500 },
    );
  }

  console.log(`[tasks/fix-comments] Terminal opened for PR #${prNumber}`);
  return NextResponse.json({
    success: true,
    message: `Claude started to fix comments on PR #${prNumber}`,
  });
}
