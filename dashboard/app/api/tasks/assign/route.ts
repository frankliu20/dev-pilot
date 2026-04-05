// POST /api/tasks/assign — open a terminal with claude for an issue

import { NextRequest, NextResponse } from 'next/server';
import { openClaudeTerminal } from '@/lib/terminal';

export async function POST(request: NextRequest) {
  const body = await request.json();
  const { issueUrl } = body as { issueUrl: string };

  if (!issueUrl || typeof issueUrl !== 'string') {
    return NextResponse.json({ error: 'Missing issueUrl' }, { status: 400 });
  }

  const result = openClaudeTerminal(issueUrl);
  if (result.success) {
    return NextResponse.json(result);
  }
  return NextResponse.json(result, { status: 500 });
}
