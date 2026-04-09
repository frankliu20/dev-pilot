// DELETE /api/decisions?taskId=issue-123 — dismiss a pending decision

import { NextRequest, NextResponse } from 'next/server';
import { dismissDecision } from '@/lib/decisions';

export async function DELETE(request: NextRequest) {
  const taskId = request.nextUrl.searchParams.get('taskId');
  if (!taskId) {
    return NextResponse.json({ error: 'taskId is required' }, { status: 400 });
  }

  console.log(`[decisions] Dismissing decision for ${taskId}`);
  const removed = dismissDecision(taskId);
  console.log(`[decisions] Decision ${taskId} ${removed ? 'dismissed' : 'not found'}`);
  return NextResponse.json({ success: removed });
}
