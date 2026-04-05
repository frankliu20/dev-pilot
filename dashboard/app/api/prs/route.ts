// GET /api/prs — fetch my open PRs + review-requested PRs with action classification

import { NextResponse } from 'next/server';
import { fetchMyOpenPRs, fetchReviewRequestedPRs, fetchUnresolvedThreadCounts, classifyPRAction } from '@/lib/github';

export async function GET() {
  console.log('[prs] Fetching open PRs and review-requested PRs');
  const [myPRs, reviewRequestedPRs] = await Promise.all([
    fetchMyOpenPRs(),
    fetchReviewRequestedPRs(),
  ]);
  console.log(`[prs] Found ${myPRs.length} my PRs, ${reviewRequestedPRs.length} review-requested`);

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

  console.log(`[prs] Returning ${prs.length} PRs, ${reviewRequested.length} review-requested`);
  return NextResponse.json({ prs, reviewRequested });
}
