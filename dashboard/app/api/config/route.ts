// GET /api/config — expose pilot.yaml config to the frontend (skills list, etc.)

import { NextResponse } from 'next/server';
import { getConfig } from '@/lib/config';

export async function GET() {
  const { skills } = getConfig();
  return NextResponse.json({ skills: skills || [] });
}
