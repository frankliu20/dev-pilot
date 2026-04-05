// GET /api/tasks — read per-task log files and return derived tasks

import { NextResponse } from 'next/server';
import { deriveTasks } from '@/lib/statusLog';

export async function GET() {
  console.log('[tasks] Fetching derived tasks');
  const tasks = deriveTasks();
  console.log(`[tasks] Returning ${tasks.length} tasks`);
  return NextResponse.json({ tasks });
}
