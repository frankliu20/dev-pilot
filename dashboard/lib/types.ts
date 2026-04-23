// Shared types

// Repo info injected by next.config.ts from pilot.yaml (client-safe)
// REPO is the full URL (e.g., "https://github.com/owner/repo" or "https://gitlab.mycompany.com/team/project")
export const REPO = process.env.NEXT_PUBLIC_GITHUB_REPO || '';
export const PLATFORM = (process.env.NEXT_PUBLIC_PLATFORM || 'github') as 'github' | 'gitlab' | 'azdevops';

// REPO_URL — for repos stored as full URLs, use as-is; for bare slugs, assume GitHub
export const REPO_URL = REPO.startsWith('http') ? REPO : `https://github.com/${REPO}`;

// REPO_SLUG — extract owner/repo from full URL (for CLI --repo flags)
export const REPO_SLUG = (() => {
  if (!REPO.startsWith('http')) return REPO; // already a slug
  try {
    const parts = new URL(REPO).pathname.split('/').filter(Boolean);
    // Azure DevOps: /org/project/_git/repo
    const gitIdx = parts.indexOf('_git');
    if (gitIdx >= 2) return `${parts[gitIdx - 2]}/${parts[gitIdx - 1]}`;
    return parts.slice(0, 2).join('/');
  } catch {
    return REPO;
  }
})();

// Repos to check for review-requested PRs (from pilot.yaml via next.config.ts)
export const REVIEW_REPOS: string[] = (() => {
  try {
    return JSON.parse(process.env.NEXT_PUBLIC_GITHUB_REPOS || '[]');
  } catch {
    return [];
  }
})();

// GitHub Issue from gh CLI
export interface GHIssue {
  number: number;
  title: string;
  labels: { name: string }[];
  assignees: { login: string }[];
  updatedAt: string;
  createdAt: string;
  url: string;
  milestone: { title: string } | null;
  state: string;
  body?: string;
}

// GitHub PR from gh CLI
export interface GHPR {
  number: number;
  title: string;
  headRefName: string;
  isDraft: boolean;
  createdAt: string;
  reviewDecision: string; // APPROVED | CHANGES_REQUESTED | REVIEW_REQUIRED | ""
  statusCheckRollup: { status: string; conclusion: string }[]; // status: COMPLETED|IN_PROGRESS|QUEUED; conclusion: SUCCESS|FAILURE|NEUTRAL|...
  url: string;
  body: string;
  comments: { totalCount: number };
  reviews: { totalCount: number };
  reviewRequests: { login: string }[];
  author?: { login: string };  // present on review-requested PRs
  unresolvedThreadCount?: number;  // from GraphQL reviewThreads.isResolved; undefined = not fetched
}

// Task status from per-task JSONL log files (e.g., issue-123.jsonl)
export interface StatusLogEntry {
  timestamp: string;
  task_id: string;
  type: string;
  phase: string;
  branch: string;
  pr_number: number | null;
  status: string;
  detail: string;
}

// Derived task state for the Tasks tab
export type TaskPhase =
  | 'planned'
  | 'analyzing'
  | 'exploring'
  | 'planning'
  | 'implementing'
  | 'testing'
  | 'test_failed'
  | 'waiting_confirm'
  | 'waiting_manual_test'
  | 'creating_pr'
  | 'done'
  | 'failed';

export interface ClaudeTask {
  taskId: string;            // e.g. "issue-5126"
  issueNumber: number | null;
  phase: TaskPhase;
  branch: string;
  prNumber: number | null;
  lastUpdate: string;        // ISO timestamp
  detail: string;            // last event detail
  events: StatusLogEntry[];  // all events for this task
}

// PR action needed
export type PRAction =
  | 'ready_to_merge'
  | 'ci_failing'
  | 'review_pending'
  | 'changes_requested'
  | 'has_unresolved_comments'
  | 'draft'
  | 'waiting';

// ── CLI Tool configuration ────────────────────────────────────────────

export type CliTool = 'claude' | 'copilot';

export const CLI_TOOL_CONFIG: Record<CliTool, {
  binary: string;
  args: (prompt: string) => string;
  processName: string;
  displayName: string;
}> = {
  claude: {
    binary: 'claude',
    args: (prompt) => `"${prompt}"`,
    processName: 'claude.exe',
    displayName: 'Claude Code',
  },
  copilot: {
    binary: 'copilot',
    args: (prompt) => `-i "${prompt}" --allow-all`,
    processName: 'copilot.exe',
    displayName: 'Copilot CLI',
  },
};

// ── PR Review configuration ────────────────────────────────────────────

export type ReviewStrategy = 'normal' | 'auto' | 'quick-approve';
export type ReviewLevel = 'high' | 'medium' | 'low';
export type ReviewContext = 'reviewing-others' | 'reviewing-own';

export interface ReviewConfig {
  strategy: ReviewStrategy;
  level: ReviewLevel;
  context: ReviewContext;
}

export const DEFAULT_REVIEW_CONFIGS: Record<ReviewContext, Pick<ReviewConfig, 'strategy' | 'level'>> = {
  'reviewing-others': { strategy: 'normal', level: 'medium' },
  'reviewing-own':    { strategy: 'normal', level: 'low' },
};

export const STRATEGY_OPTIONS: { value: ReviewStrategy; label: string; description: string }[] = [
  { value: 'normal',        label: 'Normal',         description: 'Review → confirm → publish' },
  { value: 'auto',          label: 'Auto-publish',   description: 'Review → publish automatically' },
  { value: 'quick-approve', label: 'Quick Approve',  description: 'Approve if no critical issues' },
];

export const LEVEL_OPTIONS: { value: ReviewLevel; label: string; emoji: string }[] = [
  { value: 'high',   label: 'Critical only', emoji: '🔴' },
  { value: 'medium', label: 'Important',     emoji: '🟡' },
  { value: 'low',    label: 'Everything',    emoji: '🟢' },
];

// Decision request from agents (written to pending-decisions/<task_id>.json)
export interface DecisionRequest {
  taskId: string;            // e.g. "issue-123" or "pr-456"
  issueNumber: number | null;
  prNumber?: number | null;
  phase: string;
  question: string;
  options: string[];
  context: string;
  timestamp: string;
}
