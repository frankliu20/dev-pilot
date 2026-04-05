// GET /api/tasks/registry — return all tracked worker processes

import { NextResponse } from 'next/server';
import { registry } from '@/lib/registry';

export async function GET() {
  const workers = registry.getAll();
  const running = workers.filter(w => w.status === 'running').length;
  const total = workers.length;

  console.log(`[tasks/registry] ${running} running, ${total} total workers`);
  return NextResponse.json({
    workers,
    summary: { running, total },
  });
}
