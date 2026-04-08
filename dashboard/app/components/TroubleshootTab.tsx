'use client';

import React, { useState, useCallback, useMemo } from 'react';
import Icon from './ui/Icon';
import Button from './ui/Button';
import Select from './ui/Select';
import Skeleton from './ui/Skeleton';
import EmptyState from './ui/EmptyState';
import styles from './TroubleshootTab.module.css';
import { cn } from '@/lib/utils';
import { CliTool } from '@/lib/types';

interface TraceRow {
  timestamp: string;
  operation: string;
  properties: Record<string, string>;
  customDimensions: Record<string, unknown>;
}

type Scenario = 'query-ai' | 'benchmark';
type SortField = 'timestamp' | 'operation';
type SortDir = 'asc' | 'desc';
type FilterMode = 'contains' | 'not_contains' | 'equal' | 'not_equal';

const MSBENCH_BASE_URL = 'https://msbenchapp.azurewebsites.net/run-analysis';

const FILTER_OPTIONS: { value: FilterMode; label: string }[] = [
  { value: 'contains',     label: 'contains' },
  { value: 'not_contains', label: 'not contains' },
  { value: 'equal',        label: 'equals' },
  { value: 'not_equal',    label: 'not equals' },
];

function matchesFilter(value: string, mode: FilterMode, term: string): boolean {
  const v = value.toLowerCase();
  const t = term.toLowerCase();
  switch (mode) {
    case 'contains':     return v.includes(t);
    case 'not_contains': return !v.includes(t);
    case 'equal':        return v === t;
    case 'not_equal':    return v !== t;
  }
}

interface TroubleshootTabProps {
  cliTool?: CliTool;
}

export default function TroubleshootTab({ cliTool = 'claude' }: TroubleshootTabProps) {
  // Scenario selector
  const [scenario, setScenario] = useState<Scenario>('query-ai');

  // --- Query AI state ---
  const [sessionId, setSessionId] = useState('');
  const [minutes, setMinutes] = useState('60');
  const [traces, setTraces] = useState<TraceRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [queried, setQueried] = useState(false);
  const [expandedRow, setExpandedRow] = useState<number | null>(null);
  const [expandedDims, setExpandedDims] = useState<number | null>(null);

  // Sort state
  const [sortField, setSortField] = useState<SortField>('timestamp');
  const [sortDir, setSortDir] = useState<SortDir>('desc');

  // Operation filter state
  const [opFilterMode, setOpFilterMode] = useState<FilterMode>('contains');
  const [opFilterValue, setOpFilterValue] = useState('');
  const [showOpFilter, setShowOpFilter] = useState(false);

  // --- Benchmark state ---
  const [benchRunId, setBenchRunId] = useState('');
  const [benchContext, setBenchContext] = useState('');
  const [benchChecked, setBenchChecked] = useState(false);
  const [benchRunning, setBenchRunning] = useState(false);

  const handleQuery = useCallback(async () => {
    setLoading(true);
    setError(null);
    setExpandedRow(null);
    setExpandedDims(null);
    try {
      const params = new URLSearchParams({ minutes });
      if (sessionId.trim()) {
        params.set('sessionId', sessionId.trim());
      }
      const res = await fetch(`/api/traces?${params}`);
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Query failed');
        setTraces([]);
      } else {
        setTraces(data.traces || []);
      }
    } catch (err) {
      setError(String(err));
      setTraces([]);
    } finally {
      setLoading(false);
      setQueried(true);
    }
  }, [sessionId, minutes]);

  const handleSort = useCallback((field: SortField) => {
    if (field === sortField) {
      // Same field — toggle direction
      setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    } else {
      // New field — set field + default direction
      setSortField(field);
      setSortDir(field === 'timestamp' ? 'desc' : 'asc');
    }
    setExpandedRow(null);
    setExpandedDims(null);
  }, [sortField]);

  // Benchmark handlers
  const handleBenchCheck = useCallback(() => {
    if (benchRunId.trim()) {
      setBenchChecked(true);
    }
  }, [benchRunId]);

  const handleRunAnalysis = useCallback(async () => {
    setBenchRunning(true);
    try {
      const runId = benchRunId.trim();
      const ctx = benchContext.trim().replace(/[\r\n]+/g, ' ');
      let promptText = `/mod-java-benchmark-analysis ${runId}`;
      if (ctx) {
        promptText += ` | Context: ${ctx}`;
      }
      const res = await fetch('/api/tasks/run-command', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: promptText,
          cliTool,
        }),
      });
      const data = await res.json();
      if (!data.success) {
        setError(data.error || 'Failed to run analysis skill');
      }
    } catch (err) {
      setError(String(err));
    } finally {
      setBenchRunning(false);
    }
  }, [benchRunId, benchContext, cliTool]);

  // Filter + sort
  const displayTraces = useMemo(() => {
    let result = traces;

    // Apply operation filter
    if (opFilterValue.trim()) {
      result = result.filter(t => matchesFilter(t.operation, opFilterMode, opFilterValue.trim()));
    }

    // Sort
    const sorted = [...result].sort((a, b) => {
      const aVal = a[sortField];
      const bVal = b[sortField];
      const cmp = aVal < bVal ? -1 : aVal > bVal ? 1 : 0;
      return sortDir === 'asc' ? cmp : -cmp;
    });

    return sorted;
  }, [traces, sortField, sortDir, opFilterMode, opFilterValue]);

  const formatTimestamp = (ts: string) =>
    ts.substring(0, 19).replace('T', ' ');

  const sortIcon = (field: SortField) => {
    if (sortField !== field) return 'arrow-up-down';
    return sortDir === 'asc' ? 'arrow-up' : 'arrow-down';
  };

  return (
    <div>
      <div className={styles.tabHeader}>
        <h2 className={styles.tabTitle}>Troubleshoot</h2>
      </div>

      {/* Scenario selector */}
      <div className={styles.scenarioTabs}>
        <button
          className={cn(styles.scenarioBtn, scenario === 'query-ai' && styles.active)}
          onClick={() => { setScenario('query-ai'); setError(null); }}
        >
          <Icon name="search" size={12} />
          Query AI Traces
        </button>
        <button
          className={cn(styles.scenarioBtn, scenario === 'benchmark' && styles.active)}
          onClick={() => { setScenario('benchmark'); setError(null); }}
        >
          <Icon name="bar-chart" size={12} />
          Check MSBenchmark
        </button>
      </div>

      {/* ========== Scenario: Query AI ========== */}
      {scenario === 'query-ai' && (
        <>
      {/* Query form */}
      <div className={styles.queryForm}>
        <div className={styles.inputGroup}>
          <label className={styles.label}>Session ID</label>
          <input
            className={styles.input}
            type="text"
            placeholder="Optional — paste vscodesessionid to filter"
            value={sessionId}
            onChange={e => setSessionId(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') handleQuery(); }}
          />
        </div>
        <div className={styles.inputGroupSmall}>
          <label className={styles.label}>Time window</label>
          <Select
            value={minutes}
            onChange={e => setMinutes(e.target.value)}
          >
            <option value="5">5 min</option>
            <option value="10">10 min</option>
            <option value="20">20 min</option>
            <option value="30">30 min</option>
            <option value="60">1 hour</option>
            <option value="120">2 hours</option>
            <option value="360">6 hours</option>
            <option value="1440">24 hours</option>
          </Select>
        </div>
        <div className={styles.queryBtnWrap}>
          <Button variant="primary" onClick={handleQuery} disabled={loading}>
            <Icon name="search" size={14} />
            {loading ? 'Querying...' : 'Query Traces'}
          </Button>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className={styles.errorBar}>
          <Icon name="alert-triangle" size={14} />
          <span>{error}</span>
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div className={styles.loadingArea}>
          <Skeleton count={5} gap={8} />
        </div>
      )}

      {/* Results */}
      {!loading && queried && traces.length === 0 && !error && (
        <EmptyState
          icon="search"
          title="No traces found"
          description={`No traces in the last ${minutes} minutes${sessionId ? ` for session ${sessionId.substring(0, 12)}...` : ''}.`}
        />
      )}

      {!loading && traces.length > 0 && (
        <>
          <div className={styles.resultBar}>
            <span className={styles.resultCount}>
              {displayTraces.length} of {traces.length} trace{traces.length !== 1 ? 's' : ''}
            </span>
            {opFilterValue && (
              <button
                className={styles.clearFilter}
                onClick={() => { setOpFilterValue(''); setShowOpFilter(false); }}
              >
                <Icon name="x" size={12} />
                Clear filter
              </button>
            )}
          </div>
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th className={styles.colTs}>
                    <button className={styles.sortBtn} onClick={() => handleSort('timestamp')}>
                      Timestamp
                      <Icon name={sortIcon('timestamp')} size={12} className={styles.sortIcon} />
                    </button>
                  </th>
                  <th className={styles.colOp}>
                    <div className={styles.opHeader}>
                      <button className={styles.sortBtn} onClick={() => handleSort('operation')}>
                        Operation
                        <Icon name={sortIcon('operation')} size={12} className={styles.sortIcon} />
                      </button>
                      <button
                        className={`${styles.filterToggle} ${showOpFilter ? styles.filterActive : ''}`}
                        onClick={() => setShowOpFilter(s => !s)}
                        title="Filter operations"
                      >
                        <Icon name="filter" size={12} />
                      </button>
                    </div>
                    {showOpFilter && (
                      <div className={styles.filterRow} onClick={e => e.stopPropagation()}>
                        <select
                          className={styles.filterSelect}
                          value={opFilterMode}
                          onChange={e => setOpFilterMode(e.target.value as FilterMode)}
                        >
                          {FILTER_OPTIONS.map(o => (
                            <option key={o.value} value={o.value}>{o.label}</option>
                          ))}
                        </select>
                        <input
                          className={styles.filterInput}
                          type="text"
                          placeholder="filter value..."
                          value={opFilterValue}
                          onChange={e => setOpFilterValue(e.target.value)}
                          autoFocus
                        />
                      </div>
                    )}
                  </th>
                  <th>Key Properties</th>
                  <th className={styles.colDims}>Dimensions</th>
                </tr>
              </thead>
              <tbody>
                {displayTraces.length === 0 ? (
                  <tr>
                    <td colSpan={4} className={styles.noMatch}>
                      No traces match the filter.
                    </td>
                  </tr>
                ) : displayTraces.map((trace, i) => {
                  const isExpanded = expandedRow === i;
                  const isDimsExpanded = expandedDims === i;
                  const propEntries = Object.entries(trace.properties);
                  const preview = propEntries.slice(0, 3)
                    .map(([k, v]) => `${k}=${v.length > 40 ? v.substring(0, 40) + '…' : v}`)
                    .join(', ');

                  return (
                    <React.Fragment key={i}>
                      <tr
                        className={isExpanded ? styles.rowExpanded : undefined}
                        onClick={() => setExpandedRow(isExpanded ? null : i)}
                      >
                        <td className={styles.colTs}>
                          <span className={styles.tsText}>{formatTimestamp(trace.timestamp)}</span>
                        </td>
                        <td className={styles.colOp}>
                          <span className={styles.opBadge}>{trace.operation}</span>
                        </td>
                        <td>
                          {!isExpanded ? (
                            <span className={styles.propsPreview}>{preview || '—'}</span>
                          ) : (
                            <div className={styles.propsExpanded}>
                              {propEntries.length === 0 ? (
                                <span className={styles.noProps}>No custom properties</span>
                              ) : (
                                <table className={styles.propsTable}>
                                  <tbody>
                                    {propEntries.map(([k, v]) => (
                                      <tr key={k}>
                                        <td className={styles.propKey}>{k}</td>
                                        <td className={styles.propVal}>{v}</td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              )}
                            </div>
                          )}
                        </td>
                        <td className={styles.colDims}>
                          <button
                            className={styles.dimsToggle}
                            onClick={e => {
                              e.stopPropagation();
                              setExpandedDims(isDimsExpanded ? null : i);
                            }}
                            title="View full customDimensions JSON"
                          >
                            <Icon name={isDimsExpanded ? 'chevron-up' : 'code'} size={14} />
                          </button>
                        </td>
                      </tr>
                      {isDimsExpanded && (
                        <tr className={styles.dimsRow}>
                          <td colSpan={4}>
                            <pre className={styles.dimsJson} onClick={e => e.stopPropagation()}>
                              {JSON.stringify(trace.customDimensions, null, 2)}
                            </pre>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}
        </>
      )}

      {/* ========== Scenario: Benchmark ========== */}
      {scenario === 'benchmark' && (
        <>
          {/* Benchmark input form */}
          <div className={styles.queryForm}>
            <div className={styles.inputGroup}>
              <label className={styles.label}>MSBench Run ID</label>
              <input
                className={styles.input}
                type="text"
                placeholder="Enter MSBench run ID (e.g. 15671194198)"
                value={benchRunId}
                onChange={e => { setBenchRunId(e.target.value); setBenchChecked(false); }}
                onKeyDown={e => { if (e.key === 'Enter') handleBenchCheck(); }}
              />
            </div>
            <div className={styles.queryBtnWrap}>
              <Button variant="primary" onClick={handleBenchCheck} disabled={!benchRunId.trim()}>
                <Icon name="search" size={14} />
                Check Details
              </Button>
            </div>
          </div>

          {/* Context input — issue link or analysis purpose */}
          <div className={styles.contextGroup}>
            <label className={styles.label}>Context (optional)</label>
            <textarea
              className={styles.textarea}
              rows={2}
              placeholder="Issue link or analysis purpose, e.g. https://github.com/org/repo/issues/123 or 'Check why correctness failed'"
              value={benchContext}
              onChange={e => setBenchContext(e.target.value)}
            />
          </div>

          {/* Error */}
          {error && (
            <div className={styles.errorBar}>
              <Icon name="alert-triangle" size={14} />
              <span>{error}</span>
            </div>
          )}

          {/* Benchmark result */}
          {benchChecked && benchRunId.trim() && (
            <div className={styles.benchmarkResult}>
              <span className={styles.benchmarkRunId}>Run #{benchRunId.trim()}</span>
              <a
                className={styles.benchmarkLink}
                href={`${MSBENCH_BASE_URL}/${benchRunId.trim()}`}
                target="_blank"
                rel="noopener noreferrer"
              >
                <Icon name="external-link" size={14} />
                View Run Analysis
              </a>
              <div className={styles.benchmarkActions}>
                <Button
                  variant="primary"
                  size="sm"
                  onClick={handleRunAnalysis}
                  disabled={benchRunning}
                >
                  <Icon name="zap" size={14} />
                  {benchRunning ? 'Running...' : 'Run Analysis Skill'}
                </Button>
              </div>
            </div>
          )}

          {!benchChecked && (
            <EmptyState
              icon="bar-chart"
              title="Check MSBenchmark Data"
              description="Enter a MSBench run ID above to view its analysis page and run the benchmark analysis skill."
            />
          )}
        </>
      )}
    </div>
  );
}
