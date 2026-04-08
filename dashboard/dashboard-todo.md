# Dashboard TODO — Gap Analysis & Implementation Roadmap

> Generated: 2026-04-05
> Last updated: 2026-04-07
> Status: **Feature-complete MVP** with industry-level UI
> Strategy: **Features first, quality later**

---

## Current State Summary

The dashboard is a **feature-complete MVP** — a standalone Next.js app (`localhost:3000`) with:
- 4-tab layout: Issues / Pull Requests / Claude Tasks / Actions Needed
- Summary stats bar (4 KPI cards: Open Issues, Open PRs, Active Tasks, Actions Needed)
- GitHub data via `gh` CLI (30s polling)
- Real-time task status via SSE + `fs.watch` on JSONL logs
- "Assign to Claude" spawns a new OS terminal (Normal / Auto mode)
- Dark/Light theme with localStorage persistence + anti-flash script
- Industry-level UI: design tokens, CSS Modules, SVG icon system, UI component library
- Keyboard shortcuts (1-4 tabs, R refresh, T theme, ? help, Escape close)
- Per-issue cleanup (broom icon per row) + global cleanup (header trash button)
- PR open comments display + "Fix Comments" button to auto-fix via Claude
- Issue side panel with markdown rendering, task activity timeline
- Responsive design (3 breakpoints)

**Architecture**: Next.js 16 + React 19, no database, no auth (local-only), zero extra npm dependencies for UI

---

## Sprint 1: Fix Core Experience ✅ (completed 2026-04-05)
> Goal: Make existing features actually work correctly

- [x] **1.1 Issue detail body** — `gh issue view` for single issue, markdown rendering
- [x] **1.2 Markdown rendering** — `react-markdown` + `remark-gfm`
- [x] **1.3 Single issue API** — `/api/issues?number=X` support
- [x] **1.4 Async exec** — converted `execSync` to async `exec` with promisify

---

## Sprint 2: Task Registry + Issues Table ✅ (completed 2026-04-05)
> Goal: PID tracking, duplicate prevention, cancel, table layout, mode selector

- [x] **2.1 Task Registry** — JSONL log-based status tracking, duplicate prevention, cancel, force re-run
- [x] **2.2 Terminal mode** — Normal / Auto mode support
- [x] **2.3 Assign route** — 409 Conflict for duplicates, mode + force params
- [x] **2.4 Cancel endpoint** — DELETE to cancel task
- [x] **2.5 Registry status** — GET all workers with status
- [x] **2.6 Issues table** — Sortable columns, status from JSONL, mode dropdown
- [x] **2.7 Issue detail re-run** — Force re-run button for active/done tasks
- [x] **2.8 Page wiring** — Handle 409, pass mode + force params

---

## Sprint 3: Decision Queue / Human-in-the-Loop ✅ (completed 2026-04-05)
> Goal: Agent-human interaction for decisions via SSE

- [x] **3.1 Decision notifications in agent prompts** — write pending-decisions JSON
- [x] **3.2 Decision watcher** — `fs.watch` on pending-decisions dir, auto-dismiss stale
- [x] **3.3 "Action Needed" tab** — amber cards, dismiss, terminal hint
- [x] **3.4 SSE + API** — decisions via SSE, DELETE /api/decisions to dismiss
- [x] **3.5 Re-run button** — Done/failed tasks show Re-run

---

## Sprint 4: UI Upgrade to Industry Level ✅ (completed 2026-04-07)
> Goal: Linear/Vercel-quality UI with zero new npm dependencies

- [x] **4.1 Design token system** — `tokens.css` with semantic CSS variables, dark/light themes
- [x] **4.2 CSS Modules migration** — globals.css slimmed to ~60 lines, per-component CSS Modules
- [x] **4.3 SVG icon system** — 30+ inline SVG icons (`Icon.tsx` + `icons.ts`), replacing all emoji
- [x] **4.4 UI component library** — Badge, Button, Skeleton, EmptyState, Toast, ConfirmDialog, StatusDot, Tooltip, Select
- [x] **4.5 Dark/Light theme** — `[data-theme]` attribute, localStorage + prefers-color-scheme, anti-flash inline script
- [x] **4.6 Responsive dashboard shell** — clamp layout, 3 breakpoints, header with connection status
- [x] **4.7 Summary stats bar** — 4 KPI cards (clickable to switch tabs)
- [x] **4.8 Linear-style tab bar** — SVG icons, badge counts, segmented control
- [x] **4.9 Issue side panel** — slide-in 400px panel, breadcrumb, task activity timeline, markdown body
- [x] **4.10 IssuesTab overhaul** — search/filter, sortable columns, skeleton loading, empty state, backlog toggle, label pills
- [x] **4.11 PullRequestsTab** — filter buttons, branch visualization, StatusDot + Badge
- [x] **4.12 TasksTab overhaul** — progress pipeline, timeline events, cancel confirmation, running timer
- [x] **4.13 ActionsTab** — amber tint, inline dismiss confirmation, terminal hint banner
- [x] **4.14 Keyboard shortcuts** — 1-4 tabs, R/T/?/Escape, shortcuts help overlay
- [x] **4.15 Hooks refactor** — split `hooks.ts` into `hooks/` directory (useTaskStream, useGitHubData, useTheme, useKeyboardShortcuts)
- [x] **4.16 Shared constants** — `lib/constants.ts` (PHASE_CONFIG, ACTIVE_PHASES, PR_ACTION_CONFIG) eliminating 3x duplication
- [x] **4.17 Shared utils** — `lib/utils.ts` (timeAgo, formatDate, formatTime, cn, etc.)

---

## Sprint 5: Operations & PR Features ✅ (completed 2026-04-07)
> Goal: Cleanup tools, per-issue cleanup, PR comments fix

- [x] **5.1 Global cleanup** — Header trash button, ConfirmDialog, fire-and-forget `/api/cleanup` (logs + worktrees)
- [x] **5.2 Per-issue cleanup** — Broom icon per issue row, cleans specific issue's log + worktree
- [x] **5.3 Default mode "auto"** — Changed default from Normal to Auto
- [x] **5.4 Backlog filtering** — Default hide backlog-tagged issues, toggle to show, label pills in UI
- [x] **5.5 Summary/badge consistency** — Summary card, tab badge, and table count all use filtered (non-backlog) count
- [x] **5.6 PR open comments display** — Show comments + reviews count per PR card
- [x] **5.7 PR "Fix Comments" button** — Triggers Claude with custom prompt to check and fix open PR comments
- [x] **5.8 Terminal customPrompt support** — `openClaudeTerminal()` accepts custom prompts for non-issue tasks

---

## Sprint 6: Polish & Advanced Features (future)
> Goal: Richer experience

- [ ] **6.1 Browser notifications** — Notification API when agent needs attention
- [ ] **6.2 Command palette** — `Ctrl+K` fuzzy search across issues/PRs/tasks
- [ ] **6.3 Activity feed** — Unified timeline across all tasks
- [ ] **6.4 Dynamic favicon/title** — Color/count badge based on pending actions
- [ ] **6.5 PR task status on cards** — Show agent phase badge on PR cards (like Issues tab)
- [ ] **6.6 J/K list navigation** — Vim-style navigation in issue/PR lists
- [ ] **6.7 Configurable settings** — Max parallel workers, polling intervals, repo selection

---

## Sprint 7: Quality & Reliability (later)
> Goal: Make the system robust and maintainable

- [ ] **7.1 `gh` CLI detection** — Startup check, friendly error/guide
- [ ] **7.2 Unified error handling** — Consistent error format, error boundaries
- [ ] **7.3 Test framework** — Vitest + React Testing Library, priority: statusLog, github, classifyPRAction
- [ ] **7.4 ESLint/Prettier** — Add linting config
- [ ] **7.5 Clean up unused assets** — Remove default Next.js SVGs from `public/`

---

## Architecture

### Current
```
Browser ──HTTP──→ Next.js API Routes ──async exec──→ gh CLI
                       │
                  fs.watch ──→ logs/*.jsonl
                  fs.watch ──→ logs/pending-decisions/*.json
                       │
                  SSE (tasks + decisions) ──→ Browser
                       │
                  DELETE /api/decisions ←── Browser (dismiss)
                  POST /api/cleanup ←── Browser (per-issue or global)
                  POST /api/tasks/fix-comments ←── Browser (PR comment fix)
```

### Key Files Reference
```
dashboard/
├── app/
│   ├── page.tsx                        # Main page, 4-tab nav, state, summary bar
│   ├── page.module.css                 # Dashboard shell, header, tabs, responsive
│   ├── layout.tsx                      # Theme script, font imports
│   ├── globals.css                     # Slim reset + token imports + keyframes
│   ├── styles/
│   │   └── tokens.css                  # Design token system (colors, spacing, etc.)
│   ├── hooks/
│   │   ├── useTaskStream.ts            # SSE client (tasks + decisions)
│   │   ├── useGitHubData.ts            # HTTP polling
│   │   ├── useTheme.ts                 # Dark/light toggle
│   │   ├── useKeyboardShortcuts.ts     # Generic shortcut handler
│   │   └── index.ts                    # Re-exports
│   ├── components/
│   │   ├── IssuesTab.tsx + .module.css # Issue table (search, sort, assign, clean)
│   │   ├── IssuePanel.tsx + .module.css # Slide-in issue detail panel
│   │   ├── PullRequestsTab.tsx + .css  # PR cards (filters, comments, fix)
│   │   ├── TasksTab.tsx + .module.css  # Task pipeline + timeline
│   │   ├── ActionsTab.tsx + .module.css # Decision notifications
│   │   └── ui/                         # Component library
│   │       ├── Icon.tsx                #   SVG icon component
│   │       ├── icons.ts                #   30+ icon path data
│   │       ├── Badge.tsx + .module.css #   Status badges
│   │       ├── Button.tsx + .module.css#   Action buttons
│   │       ├── Skeleton.tsx + .css     #   Loading skeletons
│   │       ├── EmptyState.tsx + .css   #   Empty state display
│   │       ├── Toast.tsx + .module.css #   Toast notifications
│   │       ├── ConfirmDialog.tsx + .css#   Confirm dialogs
│   │       ├── StatusDot.tsx + .css    #   Pulsing status dots
│   │       ├── Tooltip.tsx + .module.css#  Hover tooltips
│   │       └── Select.tsx + .module.css#   Styled select dropdown
│   └── api/
│       ├── issues/route.ts             # GET issues (list + single)
│       ├── prs/route.ts                # GET PRs with classification
│       ├── stream/route.ts             # SSE endpoint (tasks + decisions)
│       ├── decisions/route.ts          # DELETE dismiss decision
│       ├── cleanup/route.ts            # POST cleanup (global or per-issue)
│       ├── tasks/route.ts              # GET tasks from logs
│       ├── tasks/assign/route.ts       # POST spawn terminal (issue)
│       ├── tasks/fix-comments/route.ts # POST spawn terminal (PR comments)
│       ├── tasks/registry/route.ts     # GET worker status
│       └── tasks/[taskId]/route.ts     # DELETE cancel task
├── lib/
│   ├── types.ts                        # Interfaces (GHIssue, GHPR, ClaudeTask, etc.)
│   ├── constants.ts                    # PHASE_CONFIG, ACTIVE_PHASES, PR_ACTION_CONFIG
│   ├── utils.ts                        # timeAgo, formatDate, cn, etc.
│   ├── github.ts                       # gh CLI wrappers (async exec)
│   ├── statusLog.ts                    # JSONL log reader + task state derivation
│   ├── decisions.ts                    # pending-decisions reader/watcher/dismiss
│   ├── registry.ts                     # Task registry singleton
│   └── terminal.ts                     # OS terminal spawner (issue + custom prompt)
└── package.json                        # Next.js 16, React 19
```
