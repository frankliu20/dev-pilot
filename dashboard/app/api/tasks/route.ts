// GET /api/tasks — read per-task log files and return derived tasks

import { NextResponse } from 'next/server';
import { deriveTasks } from '@/lib/statusLog';

export async function GET() {
  const tasks = deriveTasks();
  return NextResponse.json({ tasks });
}
