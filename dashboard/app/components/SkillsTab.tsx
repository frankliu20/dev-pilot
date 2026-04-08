'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeRaw from 'rehype-raw';
import Icon from './ui/Icon';
import Badge from './ui/Badge';
import Button from './ui/Button';
import Skeleton from './ui/Skeleton';
import EmptyState from './ui/EmptyState';
import { useToast } from './ui/Toast';
import { CliTool, CLI_TOOL_CONFIG } from '@/lib/types';
import styles from './SkillsTab.module.css';

interface SkillEntry {
  name: string;
  category: 'skill' | 'agent' | 'command';
  content: string;
}

type CategoryFilter = 'all' | 'skill' | 'agent' | 'command';

const CATEGORY_CONFIG: Record<string, { label: string; icon: string; variant: string }> = {
  command: { label: 'Command', icon: 'terminal', variant: 'info' },
  agent:   { label: 'Agent',   icon: 'cpu',      variant: 'purple' },
  skill:   { label: 'Skill',   icon: 'zap',      variant: 'success' },
};

interface SkillsTabProps {
  cliTool?: CliTool;
}

export default function SkillsTab({ cliTool = 'claude' }: SkillsTabProps) {
  const [entries, setEntries] = useState<SkillEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedName, setExpandedName] = useState<string | null>(null);
  const [filter, setFilter] = useState<CategoryFilter>('all');
  const [runningCmd, setRunningCmd] = useState<string | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    fetch('/api/skills')
      .then(res => res.json())
      .then(data => setEntries(data.entries || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const filtered = useMemo(() => {
    if (filter === 'all') return entries;
    return entries.filter(e => e.category === filter);
  }, [entries, filter]);

  const counts = useMemo(() => ({
    all: entries.length,
    command: entries.filter(e => e.category === 'command').length,
    agent: entries.filter(e => e.category === 'agent').length,
    skill: entries.filter(e => e.category === 'skill').length,
  }), [entries]);

  const handleRunCommand = useCallback(async (name: string) => {
    setRunningCmd(name);
    try {
      const res = await fetch('/api/tasks/run-command', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ command: name, cliTool }),
      });
      const data = await res.json();
      if (data.success) {
        toast({
          title: `Running /${name}`,
          message: `${CLI_TOOL_CONFIG[cliTool].displayName} CLI opened — switch to the terminal.`,
          variant: 'info',
          duration: 6000,
        });
      } else {
        toast({ title: 'Failed to run', message: data.error, variant: 'danger' });
      }
    } catch (err) {
      toast({ title: 'Failed to run', message: String(err), variant: 'danger' });
    } finally {
      setRunningCmd(null);
    }
  }, [toast, cliTool]);

  if (loading) {
    return (
      <div>
        <div className={styles.tabHeader}>
          <h2 className={styles.tabTitle}>Skills & Agents</h2>
        </div>
        <div className={styles.list}>
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} preset="card" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className={styles.tabHeader}>
        <h2 className={styles.tabTitle}>Skills & Agents ({entries.length})</h2>
      </div>

      {entries.length > 0 && (
        <div className={styles.filters}>
          {([
            { key: 'all' as const, label: `All (${counts.all})` },
            { key: 'command' as const, label: `Commands (${counts.command})` },
            { key: 'agent' as const, label: `Agents (${counts.agent})` },
            { key: 'skill' as const, label: `Skills (${counts.skill})` },
          ]).map(f => (
            <button
              key={f.key}
              className={`${styles.filterBtn} ${filter === f.key ? styles.active : ''}`}
              onClick={() => setFilter(f.key)}
            >
              {f.label}
            </button>
          ))}
        </div>
      )}

      {entries.length === 0 ? (
        <EmptyState
          icon="zap"
          title="No skills found"
          description="Place skill, agent, and command markdown files in the repo."
        />
      ) : filtered.length === 0 ? (
        <EmptyState
          icon="search"
          title="No matches"
          description={`No entries match the "${filter}" filter.`}
        />
      ) : (
        <div className={styles.list}>
          {filtered.map(entry => {
            const config = CATEGORY_CONFIG[entry.category];
            const isExpanded = expandedName === entry.name;
            return (
              <div
                key={entry.name}
                className={`${styles.card} ${isExpanded ? styles.cardExpanded : ''}`}
                onClick={() => setExpandedName(isExpanded ? null : entry.name)}
              >
                <div className={styles.cardHeader}>
                  <Icon name={config.icon} size={16} className={styles.cardIcon} />
                  <span className={styles.cardName}>{entry.name}</span>
                  <Badge variant={config.variant as 'info' | 'purple' | 'success'} size="sm">
                    {config.label}
                  </Badge>
                  {entry.category === 'command' && (
                    <Button
                      variant="primary"
                      size="sm"
                      disabled={runningCmd === entry.name}
                      onClick={e => {
                        e.stopPropagation();
                        handleRunCommand(entry.name);
                      }}
                    >
                      <Icon name="play" size={12} />
                      {runningCmd === entry.name ? 'Starting...' : 'Run'}
                    </Button>
                  )}
                  <Icon
                    name={isExpanded ? 'chevron-up' : 'chevron-down'}
                    size={14}
                    className={styles.expandIcon}
                  />
                </div>
                {isExpanded && (
                  <div className={styles.cardBody} onClick={e => e.stopPropagation()}>
                    <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeRaw]}>
                      {entry.content}
                    </ReactMarkdown>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
