// GET /api/stream — SSE endpoint that watches per-task log files and pending decisions

import { deriveTasks, watchStatusLog } from '@/lib/statusLog';
import { readPendingDecisions, watchDecisions } from '@/lib/decisions';

export const runtime = 'nodejs';

export async function GET() {
  let cleanedUp = false;
  let heartbeat: ReturnType<typeof setInterval>;
  let stopWatchingLogs: (() => void) | null = null;
  let stopWatchingDecisions: (() => void) | null = null;

  const cleanup = () => {
    if (cleanedUp) return;
    cleanedUp = true;
    if (stopWatchingLogs) stopWatchingLogs();
    if (stopWatchingDecisions) stopWatchingDecisions();
    clearInterval(heartbeat);
  };

  const stream = new ReadableStream({
    start(controller) {
      const encoder = new TextEncoder();

      function send(eventType: string, data: unknown) {
        try {
          const payload = `event: ${eventType}\ndata: ${JSON.stringify(data)}\n\n`;
          controller.enqueue(encoder.encode(payload));
        } catch { /* stream closed */ }
      }

      console.log('[stream] SSE client connected');

      // Send initial state
      const initialTasks = deriveTasks();
      const initialDecisions = readPendingDecisions();
      console.log(`[stream] Sending initial state: ${initialTasks.length} tasks, ${initialDecisions.length} decisions`);
      send('tasks', { tasks: initialTasks });
      send('decisions', { decisions: initialDecisions });

      // Watch logs directory for task changes
      // Also re-check decisions since task progress may auto-dismiss stale ones
      stopWatchingLogs = watchStatusLog(() => {
        const tasks = deriveTasks();
        console.log(`[stream] Log change detected, sending ${tasks.length} tasks`);
        send('tasks', { tasks });
        send('decisions', { decisions: readPendingDecisions() });
      });

      // Watch pending-decisions directory for decision changes
      stopWatchingDecisions = watchDecisions(() => {
        const decisions = readPendingDecisions();
        console.log(`[stream] Decision change detected, sending ${decisions.length} decisions`);
        send('decisions', { decisions });
      });

      // Heartbeat
      heartbeat = setInterval(() => {
        send('heartbeat', { time: Date.now() });
      }, 30000);
    },
    cancel() {
      console.log('[stream] SSE client disconnected');
      cleanup();
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
    },
  });
}
