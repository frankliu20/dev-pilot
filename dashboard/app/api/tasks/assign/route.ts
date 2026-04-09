// POST /api/tasks/assign — assign an issue to Claude via task registry

import { NextRequest, NextResponse } from 'next/server';
import { registry } from '@/lib/registry';
import { CliTool } from '@/lib/types';

export async function POST(request: NextRequest) {
  const body = await request.json();
  const { issueUrl, mode, force, testScenario, cliTool = 'claude' } = body as {
    issueUrl: string;
    mode?: 'normal' | 'auto';
    force?: boolean;
    testScenario?: 'vscode' | 'intellij' | 'mcp-server';
    cliTool?: CliTool;
  };

  if (!issueUrl || typeof issueUrl !== 'string') {
    return NextResponse.json({ error: 'Missing issueUrl' }, { status: 400 });
  }

  // Extract issue number from URL to build taskId
  const issueNumber = issueUrl.split('/').pop();
  if (!issueNumber || isNaN(Number(issueNumber))) {
    return NextResponse.json({ error: 'Invalid issue URL' }, { status: 400 });
  }

  const taskId = `issue-${issueNumber}`;
  const fixMode = mode || 'normal';
  const { result, entry, error } = registry.assign(taskId, issueUrl, fixMode, force, testScenario, cliTool);

  if (result === 'already_running') {
    return NextResponse.json({
      success: false,
      error: `Issue #${issueNumber} already has an active Claude session`,
    }, { status: 409 });
  }

  if (error) {
    return NextResponse.json({ success: false, error }, { status: 500 });
  }

  return NextResponse.json({
    success: true,
    message: `Claude started for #${issueNumber}`,
    taskId,
  });
}
