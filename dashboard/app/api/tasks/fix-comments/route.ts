// POST /api/tasks/fix-comments — trigger Claude to check and fix open PR comments

import { NextRequest, NextResponse } from 'next/server';
import { openClaudeTerminal } from '@/lib/terminal';
import { REPO, CliTool } from '@/lib/types';

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

  const prUrl = `https://github.com/${REPO}/pull/${prNumber}`;
  const autoFlag = mode === 'auto' ? ' --auto' : '';
  const customPrompt = `/pilot-dev-issue${autoFlag} check open comments on ${prUrl} and fix them`;

  const termResult = openClaudeTerminal({
    customPrompt,
    tabTitle: `Claude: Fix PR #${prNumber} comments`,
    cliTool,
  });

  if (!termResult.success) {
    return NextResponse.json(
      { success: false, error: termResult.error || 'Failed to spawn terminal' },
      { status: 500 },
    );
  }

  return NextResponse.json({
    success: true,
    message: `Claude started to fix comments on PR #${prNumber}`,
  });
}
