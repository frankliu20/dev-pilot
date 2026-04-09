// GET /api/issues — fetch my open GitHub issues
// GET /api/issues?number=123 — fetch single issue detail

import { NextRequest, NextResponse } from 'next/server';
import { fetchMyOpenIssues, fetchIssueDetail } from '@/lib/github';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const number = searchParams.get('number');

  if (number) {
    console.log(`[issues] Fetching issue #${number} detail`);
    const issue = await fetchIssueDetail(parseInt(number, 10));
    if (!issue) {
      console.log(`[issues] Issue #${number} not found`);
      return NextResponse.json({ error: 'Issue not found' }, { status: 404 });
    }
    console.log(`[issues] Returned issue #${number}: ${issue.title}`);
    return NextResponse.json({ issue });
  }

  console.log('[issues] Fetching all open issues');
  const issues = await fetchMyOpenIssues();
  console.log(`[issues] Found ${issues.length} open issues`);
  return NextResponse.json({ issues });
}
