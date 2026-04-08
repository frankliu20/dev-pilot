// DELETE /api/tasks/[taskId] — cancel a running Claude task

import { NextRequest, NextResponse } from 'next/server';
import { registry } from '@/lib/registry';

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ taskId: string }> }
) {
  const { taskId } = await params;

  if (!taskId) {
    return NextResponse.json({ error: 'Missing taskId' }, { status: 400 });
  }

  const cancelled = registry.cancel(taskId);

  if (!cancelled) {
    return NextResponse.json({
      success: false,
      error: `Task ${taskId} is not running`,
    }, { status: 404 });
  }

  return NextResponse.json({
    success: true,
    message: `Task ${taskId} cancelled`,
  });
}
