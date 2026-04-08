// GET /api/prs — fetch my open PRs + review-requested PRs with action classification

import { NextResponse } from 'next/server';
import { fetchMyOpenPRs, fetchReviewRequestedPRs, fetchUnresolvedThreadCounts, classifyPRAction } from '@/lib/github';

export async function GET() {
  const [myPRs, reviewRequestedPRs] = await Promise.all([
    fetchMyOpenPRs(),
    fetchReviewRequestedPRs(),
  ]);

  // Batch GraphQL call for unresolved review thread counts (grouped by repo)
  const allPRs = [...myPRs, ...reviewRequestedPRs];
  const unresolvedCounts = await fetchUnresolvedThreadCounts(allPRs);

  const prs = myPRs.map(pr => {
    const enriched = { ...pr, unresolvedThreadCount: unresolvedCounts.get(pr.number) };
    return { ...enriched, action: classifyPRAction(enriched) };
  });

  const reviewRequested = reviewRequestedPRs.map(pr => {
    const enriched = { ...pr, unresolvedThreadCount: unresolvedCounts.get(pr.number) };
    return { ...enriched, action: classifyPRAction(enriched) };
  });

  return NextResponse.json({ prs, reviewRequested });
}
