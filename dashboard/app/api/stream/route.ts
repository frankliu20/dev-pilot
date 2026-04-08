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

      // Send initial state
      send('tasks', { tasks: deriveTasks() });
      send('decisions', { decisions: readPendingDecisions() });

      // Watch logs directory for task changes
      // Also re-check decisions since task progress may auto-dismiss stale ones
      stopWatchingLogs = watchStatusLog(() => {
        send('tasks', { tasks: deriveTasks() });
        send('decisions', { decisions: readPendingDecisions() });
      });

      // Watch pending-decisions directory for decision changes
      stopWatchingDecisions = watchDecisions(() => {
        send('decisions', { decisions: readPendingDecisions() });
      });

      // Heartbeat
      heartbeat = setInterval(() => {
        send('heartbeat', { time: Date.now() });
      }, 30000);
    },
    cancel() {
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
