// GET /api/issues — fetch my open GitHub issues
// GET /api/issues?number=123 — fetch single issue detail

import { NextRequest, NextResponse } from 'next/server';
import { fetchMyOpenIssues, fetchIssueDetail } from '@/lib/github';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const number = searchParams.get('number');

  if (number) {
    const issue = await fetchIssueDetail(parseInt(number, 10));
    if (!issue) {
      return NextResponse.json({ error: 'Issue not found' }, { status: 404 });
    }
    return NextResponse.json({ issue });
  }

  const issues = await fetchMyOpenIssues();
  return NextResponse.json({ issues });
}
