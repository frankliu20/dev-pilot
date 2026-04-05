import { describe, it, expect } from 'vitest';
import { PHASE_CONFIG, ACTIVE_PHASES, TERMINAL_PHASES, PHASE_PIPELINE, PR_ACTION_CONFIG } from '@/lib/constants';
import type { TaskPhase, PRAction } from '@/lib/types';

const ALL_TASK_PHASES: TaskPhase[] = [
  'planned', 'analyzing', 'exploring', 'planning',
  'implementing', 'testing', 'test_failed',
  'waiting_confirm', 'waiting_manual_test', 'creating_pr',
  'done', 'failed',
];

const ALL_PR_ACTIONS: PRAction[] = [
  'ready_to_merge', 'ci_failing', 'review_pending',
  'changes_requested', 'has_unresolved_comments', 'draft', 'waiting',
];

describe('PHASE_CONFIG', () => {
  it('has an entry for every TaskPhase', () => {
    for (const phase of ALL_TASK_PHASES) {
      expect(PHASE_CONFIG).toHaveProperty(phase);
    }
  });

  it('has exactly 12 entries', () => {
    expect(Object.keys(PHASE_CONFIG)).toHaveLength(12);
  });

  it.each(ALL_TASK_PHASES)('entry for "%s" has icon, label, color, and variant', (phase) => {
    const entry = PHASE_CONFIG[phase];
    expect(entry.icon).toBeTypeOf('string');
    expect(entry.icon.length).toBeGreaterThan(0);
    expect(entry.label).toBeTypeOf('string');
    expect(entry.label.length).toBeGreaterThan(0);
    expect(entry.color).toBeTypeOf('string');
    expect(entry.variant).toBeTypeOf('string');
  });
});

describe('ACTIVE_PHASES & TERMINAL_PHASES', () => {
  it('union of ACTIVE_PHASES and TERMINAL_PHASES covers all 12 phases', () => {
    const union = new Set([...ACTIVE_PHASES, ...TERMINAL_PHASES]);
    expect(union.size).toBe(12);
    for (const phase of ALL_TASK_PHASES) {
      expect(union.has(phase)).toBe(true);
    }
  });

  it('ACTIVE_PHASES and TERMINAL_PHASES are disjoint', () => {
    for (const phase of ACTIVE_PHASES) {
      expect(TERMINAL_PHASES.has(phase)).toBe(false);
    }
  });

  it('TERMINAL_PHASES contains exactly done and failed', () => {
    expect(TERMINAL_PHASES.size).toBe(2);
    expect(TERMINAL_PHASES.has('done')).toBe(true);
    expect(TERMINAL_PHASES.has('failed')).toBe(true);
  });
});

describe('PHASE_PIPELINE', () => {
  it('contains only valid TaskPhase values', () => {
    for (const phase of PHASE_PIPELINE) {
      expect(ALL_TASK_PHASES).toContain(phase);
    }
  });

  it('has no duplicate entries', () => {
    const unique = new Set(PHASE_PIPELINE);
    expect(unique.size).toBe(PHASE_PIPELINE.length);
  });

  it('starts with planned and ends with done', () => {
    expect(PHASE_PIPELINE[0]).toBe('planned');
    expect(PHASE_PIPELINE[PHASE_PIPELINE.length - 1]).toBe('done');
  });
});

describe('PR_ACTION_CONFIG', () => {
  it('has an entry for every PRAction', () => {
    for (const action of ALL_PR_ACTIONS) {
      expect(PR_ACTION_CONFIG).toHaveProperty(action);
    }
  });

  it('has exactly 7 entries', () => {
    expect(Object.keys(PR_ACTION_CONFIG)).toHaveLength(7);
  });

  it.each(ALL_PR_ACTIONS)('entry for "%s" has icon, label, and variant', (action) => {
    const entry = PR_ACTION_CONFIG[action];
    expect(entry.icon).toBeTypeOf('string');
    expect(entry.label).toBeTypeOf('string');
    expect(entry.variant).toBeTypeOf('string');
  });
});
