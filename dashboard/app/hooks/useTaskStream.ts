'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { ClaudeTask, DecisionRequest } from '@/lib/types';

export function useTaskStream() {
  const [tasks, setTasks] = useState<ClaudeTask[]>([]);
  const [decisions, setDecisions] = useState<DecisionRequest[]>([]);
  const [connected, setConnected] = useState(false);
  const esRef = useRef<EventSource | null>(null);

  const connect = useCallback(() => {
    if (esRef.current) esRef.current.close();

    const es = new EventSource('/api/stream');
    esRef.current = es;

    es.addEventListener('tasks', (e: MessageEvent) => {
      const data = JSON.parse(e.data);
      setTasks(data.tasks || []);
      setConnected(true);
    });

    es.addEventListener('decisions', (e: MessageEvent) => {
      const data = JSON.parse(e.data);
      setDecisions(data.decisions || []);
    });

    es.onerror = () => {
      setConnected(false);
      es.close();
      setTimeout(connect, 3000);
    };
  }, []);

  useEffect(() => {
    connect();
    return () => { esRef.current?.close(); };
  }, [connect]);

  return { tasks, decisions, connected };
}
