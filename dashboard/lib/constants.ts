import { TaskPhase } from './types';

/**
 * Phase display configuration — single source of truth.
 * Used by IssuesTab, IssueDetail, TasksTab, and SummaryBar.
 */
export const PHASE_CONFIG: Record<TaskPhase, {
  icon: string;      // SVG icon name from Icon component
  label: string;     // Human-readable label
  color: string;     // CSS color variable suffix (maps to --color-{X}-emphasis)
  variant: 'neutral' | 'info' | 'purple' | 'warning' | 'danger' | 'success';
}> = {
  planned:             { icon: 'clipboard',       label: 'Planned',          color: 'neutral', variant: 'neutral' },
  analyzing:           { icon: 'search',          label: 'Analyzing',        color: 'info',    variant: 'info' },
  exploring:           { icon: 'compass',         label: 'Exploring',        color: 'info',    variant: 'info' },
  planning:            { icon: 'pencil',          label: 'Planning',         color: 'purple',  variant: 'purple' },
  implementing:        { icon: 'gear',            label: 'Implementing',     color: 'info',    variant: 'info' },
  testing:             { icon: 'flask',           label: 'Testing',          color: 'warning', variant: 'warning' },
  test_failed:         { icon: 'x-circle',        label: 'Test Failed',      color: 'danger',  variant: 'danger' },
  waiting_confirm:     { icon: 'alert-triangle',  label: 'Waiting',          color: 'warning', variant: 'warning' },
  waiting_manual_test: { icon: 'eye',             label: 'Manual Test',      color: 'warning', variant: 'warning' },
  creating_pr:         { icon: 'rocket',          label: 'Creating PR',      color: 'purple',  variant: 'purple' },
  done:                { icon: 'check-circle',    label: 'Done',             color: 'success', variant: 'success' },
  failed:              { icon: 'zap',             label: 'Failed',           color: 'danger',  variant: 'danger' },
};

/**
 * Phases that represent an active (non-terminal) task.
 */
export const ACTIVE_PHASES: Set<TaskPhase> = new Set([
  'planned', 'analyzing', 'exploring', 'planning',
  'implementing', 'testing', 'test_failed',
  'waiting_confirm', 'waiting_manual_test', 'creating_pr',
]);

/**
 * Terminal phases — task is complete (success or failure).
 */
export const TERMINAL_PHASES: Set<TaskPhase> = new Set(['done', 'failed']);

/**
 * Ordered list of phases for progress bar visualization.
 */
export const PHASE_PIPELINE: TaskPhase[] = [
  'planned', 'analyzing', 'exploring', 'planning',
  'implementing', 'testing', 'creating_pr', 'done',
];

/**
 * PR action display configuration.
 */
export const PR_ACTION_CONFIG: Record<string, {
  icon: string;
  label: string;
  variant: 'success' | 'danger' | 'warning' | 'neutral' | 'info';
}> = {
  ready_to_merge:    { icon: 'check-circle',    label: 'Ready to merge',     variant: 'success' },
  ci_failing:        { icon: 'x-circle',        label: 'CI failing',         variant: 'danger' },
  changes_requested:        { icon: 'pencil',          label: 'Changes requested',  variant: 'warning' },
  has_unresolved_comments:  { icon: 'message-circle',  label: 'Unresolved comments', variant: 'warning' },
  review_pending:           { icon: 'clock',           label: 'Review pending',     variant: 'neutral' },
  draft:             { icon: 'pencil',          label: 'Draft',              variant: 'neutral' },
  waiting:           { icon: 'clock',           label: 'Waiting',            variant: 'neutral' },
};
