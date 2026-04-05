# Developer Guide

Practical workflows for building, testing, and contributing to Dev Pilot.

## Prerequisites

- Node.js 18+
- npm 9+
- Git
- [GitHub CLI (`gh`)](https://cli.github.com/) authenticated

## Project Setup

```bash
git clone https://github.com/frankliu20/dev-pilot.git
cd dev-pilot

# Install framework (creates ~/.claude/pilot.yaml)
node init.js

# Install dashboard dependencies
cd dashboard
npm install
```

## Dashboard Development

### Build & Run

```bash
cd dashboard

# Development server (hot reload)
npm run dev            # → http://localhost:3000

# Production build
npm run build

# Type checking
npx tsc --noEmit

# Linting
npm run lint
```

### Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 16.2.2 (App Router) |
| UI | React 19.2.4 + Tailwind CSS |
| Language | TypeScript 5 |
| Testing | Vitest + Testing Library |
| Runtime | Node.js (API routes) + Browser (React) |

---

## Testing

### Quick Commands

```bash
cd dashboard

# Run all tests once
npm test

# Watch mode (re-runs on file changes)
npm run test:watch

# Coverage report
npm run test:coverage

# Run a specific test file
npx vitest run __tests__/lib/utils.test.ts

# Run tests matching a pattern
npx vitest run -t "classifyPRAction"

# Shuffle test order (detects ordering dependencies)
npx vitest run --shuffle
```

### Test Structure

```
dashboard/__tests__/
├── setup.ts               # Global setup — jest-dom matchers, mock resets
├── helpers/
│   ├── factories.ts       # Factory functions for test data
│   └── mockFs.ts          # Virtual filesystem helper
├── lib/                   # Unit tests for lib/ modules
│   ├── utils.test.ts
│   ├── config.test.ts
│   ├── constants.test.ts
│   ├── statusLog.test.ts
│   ├── decisions.test.ts
│   ├── registry.test.ts
│   ├── github.test.ts
│   ├── types.test.ts
│   └── terminal.test.ts
├── hooks/                 # Hook tests (jsdom environment)
│   ├── useTaskStream.test.tsx
│   ├── useGitHubData.test.tsx
│   ├── useTheme.test.tsx
│   └── useKeyboardShortcuts.test.tsx
└── api/                   # API route tests
    ├── issues.test.ts
    ├── prs.test.ts
    ├── stream.test.ts
    └── ... (16 files total)
```

### Vitest Configuration

Config lives at `dashboard/vitest.config.ts`:

- **Environment**: `node` by default; hook tests use `// @vitest-environment jsdom` pragma
- **Path alias**: `@` → `dashboard/` root (matches `tsconfig.json`)
- **Setup file**: `__tests__/setup.ts` runs before every test
- **Auto-restore**: Mocks, env stubs, and globals are auto-restored after each test

### Writing Unit Tests

#### 1. Use Factory Functions

Never construct test data manually. Use the factories from `__tests__/helpers/factories.ts`:

```typescript
import { makePR, makeIssue, makeTask } from '../helpers/factories';

// Override only the fields you care about
const pr = makePR({ isDraft: true, reviewDecision: 'APPROVED' });
const issue = makeIssue({ number: 99, title: 'My test issue' });
const task = makeTask({ taskId: 'issue-99', phase: 'implementing' });
```

Available factories: `makePR()`, `makeIssue()`, `makeTask()`, `makeStatusLogEntry()`, `makeDecision()`, `makeWorkerEntry()`

#### 2. Mock External Dependencies Only

Mock the outermost boundary (filesystem, child_process, network), not internal modules:

```typescript
// ✅ Good — mock the I/O boundary
vi.mock('fs');
vi.mock('child_process');

// ❌ Bad — mock internal modules (makes tests brittle)
vi.mock('@/lib/statusLog');  // Only do this if you're testing a module that CALLS statusLog
```

#### 3. Singleton Modules Need `vi.resetModules()`

Modules like `config.ts` and `registry.ts` cache state at module level. Reset between tests:

```typescript
describe('config', () => {
  beforeEach(async () => {
    vi.resetModules();           // Clear the cached singleton
    // Re-import mocked modules
    const fs = await import('fs');
    vi.mocked(fs.existsSync).mockReturnValue(false);
  });

  it('reads config', async () => {
    const { getConfig } = await import('@/lib/config');  // Fresh import
    const config = getConfig();
    // ...
  });
});
```

#### 4. Mock `promisify(exec)` Correctly

Node's `exec` has a special `[util.promisify.custom]` symbol. Standard `vi.mock('child_process')` breaks `promisify(exec)`. Use this pattern:

```typescript
// vi.hoisted ensures the variable exists when vi.mock factory runs (hoisted above imports)
const execAsyncMock = vi.hoisted(() => vi.fn());

vi.mock('util', async (importOriginal) => {
  const original = await importOriginal<typeof import('util')>();
  return {
    ...original,
    promisify: (fn: any) => {
      if (fn?.name === 'exec' || fn?.__isMockExec) {
        return execAsyncMock;
      }
      return original.promisify(fn);
    },
  };
});

vi.mock('child_process', () => {
  const execFn: any = vi.fn();
  execFn.__isMockExec = true;
  return { exec: execFn, execSync: vi.fn(), spawn: vi.fn() };
});

// In tests:
execAsyncMock.mockResolvedValue({ stdout: '[]', stderr: '' });
```

#### 5. Hook Tests Use jsdom

Add the environment pragma at the top of hook test files:

```typescript
// @vitest-environment jsdom
import { renderHook, act } from '@testing-library/react';
import { useTheme } from '@/app/hooks/useTheme';

it('defaults to dark theme', () => {
  const { result } = renderHook(() => useTheme());
  expect(result.current.theme).toBe('dark');
});
```

#### 6. API Route Tests

Test API routes as function calls — create a `NextRequest`, call the exported handler, assert on the `NextResponse`:

```typescript
import { GET } from '@/app/api/issues/route';

it('returns issues', async () => {
  vi.mocked(fetchMyOpenIssues).mockResolvedValue([makeIssue()]);

  const req = new NextRequest('http://localhost/api/issues');
  const res = await GET(req);
  const body = await res.json();

  expect(res.status).toBe(200);
  expect(body.issues).toHaveLength(1);
});
```

### Test Patterns Cheat Sheet

| Pattern | When to Use | Example |
|---------|-------------|---------|
| `vi.mock('module')` | Mock any import | `vi.mock('fs')` |
| `vi.mocked(fn)` | Type-safe access to mock | `vi.mocked(fs.existsSync).mockReturnValue(true)` |
| `vi.hoisted(() => ...)` | Variable needed in `vi.mock` factory | `const mock = vi.hoisted(() => vi.fn())` |
| `vi.resetModules()` | Reset singleton modules | Used in `beforeEach` for config/registry |
| `vi.useFakeTimers()` | Control time | `vi.advanceTimersByTime(1000)` |
| `vi.spyOn(console, 'error')` | Suppress + assert error logs | `.mockImplementation(() => {})` |
| `mockResolvedValue` | Mock async success | `mock.mockResolvedValue({ data: [] })` |
| `mockRejectedValue` | Mock async failure | `mock.mockRejectedValue(new Error('fail'))` |

### Coverage Targets

| Layer | Target | Current |
|-------|--------|---------|
| `lib/` | ≥ 80% | ✅ |
| `hooks/` | ≥ 80% | ✅ |
| `api/` | ≥ 80% | ✅ |

Run `npm run test:coverage` to generate a coverage report.

---

## Framework Development

### Editing Commands, Agents, or Skills

**Important**: Never edit files directly in `~/.claude/`. All source of truth lives in this repo.

```bash
# 1. Edit the source file
vim framework/commands/pilot-dev-issue.md

# 2. Sync to ~/.claude/
node init.js --force

# 3. Commit
git add framework/commands/pilot-dev-issue.md
git commit -m "feat(commands): update pilot-dev-issue prompt"
```

### Adding a New Command

1. Create `framework/commands/your-command.md`
2. Run `node init.js --force`
3. Use it: `claude "/your-command"`

### Adding a New Agent

1. Create `framework/agents/your-agent.md` with frontmatter (model, tools, etc.)
2. Run `node init.js --force`
3. Reference it in commands or use directly

---

## Common Workflows

### Fix a Bug (Full Cycle)

```bash
# 1. Create a feature branch
git checkout -b fix/issue-123

# 2. Make changes to dashboard/lib/...

# 3. Run tests
cd dashboard && npm test

# 4. Type check
npx tsc --noEmit

# 5. Commit and push
git add -A && git commit -m "fix(github): handle empty PR array"
git push -u origin fix/issue-123

# 6. Create PR
gh pr create --title "fix(github): handle empty PR array" --body "Fixes #123"
```

### Add a New Lib Module

1. Create `dashboard/lib/your-module.ts`
2. Create `dashboard/__tests__/lib/your-module.test.ts`
3. Write tests first (TDD encouraged)
4. Implement the module
5. Run `npm test` to verify

### Add a New API Route

1. Create `dashboard/app/api/your-route/route.ts`
2. Create `dashboard/__tests__/api/your-route.test.ts`
3. Mock the lib modules the route depends on
4. Test all HTTP methods and error cases
5. Run `npm test`

### Add a New Hook

1. Create `dashboard/app/hooks/useYourHook.ts`
2. Create `dashboard/__tests__/hooks/useYourHook.test.tsx`
3. Add `// @vitest-environment jsdom` pragma at the top
4. Use `renderHook` from `@testing-library/react`
5. Run `npm test`
