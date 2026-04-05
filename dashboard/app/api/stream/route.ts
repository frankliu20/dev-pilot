// GET /api/stream — SSE endpoint that watches task-status.jsonl for changes

import { deriveTasks } from '@/lib/statusLog';
import { getLogFilePath } from '@/lib/statusLog';
import { watchFile, unwatchFile, existsSync } from 'fs';

export const runtime = 'nodejs';

export async function GET() {
  const logFile = getLogFilePath();

  const stream = new ReadableStream({
    start(controller) {
      const encoder = new TextEncoder();

      function send(eventType: string, data: unknown) {
        try {
          const payload = `event: ${eventType}\ndata: ${JSON.stringify(data)}\n\n`;
          controller.enqueue(encoder.encode(payload));
        } catch { /* stream closed */ }
      }

      // Send initial task state
      send('tasks', { tasks: deriveTasks() });

      // Watch for file changes
      const onChange = () => {
        send('tasks', { tasks: deriveTasks() });
      };

      if (existsSync(logFile)) {
        watchFile(logFile, { interval: 2000 }, onChange);
      }

      // Heartbeat
      const heartbeat = setInterval(() => {
        send('heartbeat', { time: Date.now() });
      }, 30000);

      // Cleanup
      const cleanup = () => {
        unwatchFile(logFile, onChange);
        clearInterval(heartbeat);
      };

      // Handle cancel
      controller.close = new Proxy(controller.close, {
        apply(target, thisArg) {
          cleanup();
          return Reflect.apply(target, thisArg, []);
        },
      });
    },
    cancel() {
      // cleanup handled above
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
