// Shared types

export const REPO = process.env.GITHUB_REPO || 'devdiv-azure-service-dmitryr/azure-java-migration-copilot-vscode-extension';
export const REPO_URL = `https://github.com/${REPO}`;

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
}

// GitHub PR from gh CLI
export interface GHPR {
  number: number;
  title: string;
  headRefName: string;
  isDraft: boolean;
  createdAt: string;
  reviewDecision: string; // APPROVED | CHANGES_REQUESTED | REVIEW_REQUIRED | ""
  statusCheckRollup: { state: string }[]; // SUCCESS | FAILURE | PENDING
  url: string;
  body: string;
}

// Task status from task-status.jsonl
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
  | 'draft'
  | 'waiting';
