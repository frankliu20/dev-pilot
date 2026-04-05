// GET /api/issues — fetch my open GitHub issues

import { NextResponse } from 'next/server';
import { fetchMyOpenIssues } from '@/lib/github';

export async function GET() {
  const issues = fetchMyOpenIssues();
  return NextResponse.json({ issues });
}
