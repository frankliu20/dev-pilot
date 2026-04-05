// GET /api/prs — fetch my open PRs with action classification

import { NextResponse } from 'next/server';
import { fetchMyOpenPRs, classifyPRAction } from '@/lib/github';

export async function GET() {
  const prs = fetchMyOpenPRs();
  const enriched = prs.map(pr => ({
    ...pr,
    action: classifyPRAction(pr),
  }));
  return NextResponse.json({ prs: enriched });
}
