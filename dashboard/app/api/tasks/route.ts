// GET /api/tasks — read task-status.jsonl and return derived tasks

import { NextResponse } from 'next/server';
import { deriveTasks } from '@/lib/statusLog';

export async function GET() {
  const tasks = deriveTasks();
  return NextResponse.json({ tasks });
}
