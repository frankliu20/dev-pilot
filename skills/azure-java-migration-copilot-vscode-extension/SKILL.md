---
name: azure-java-migration-copilot-vscode-extension
description: Knowledge about the azure-java-migration-copilot-vscode-extension project. Apply when working in this repository.
---

## Project: azure-java-migration-copilot-vscode-extension

- **Repo**: https://github.com/devdiv-azure-service-dmitryr/azure-java-migration-copilot-vscode-extension
- **GitHub short**: `devdiv-azure-service-dmitryr/azure-java-migration-copilot-vscode-extension`

An AI-powered VS Code extension that helps modernize applications (Java, .NET, Python) — assessment, planning, code transformation, validation, deployment to Azure.

## Build & Test Commands

```bash
npm install                    # Install dependencies (uses Azure Artifacts private registry)
npm run build                  # Full build: mcp-server + tsc + esbuild
npm run compile                # TypeScript compile only
npm run ut                     # Unit tests (Jest, with coverage)
npm run lint                   # ESLint
npm run lint-fix               # ESLint auto-fix
npx tsc --noEmit               # Type check without emitting
```

## Project Structure

```
src/                           # Main extension source
  extension.ts                 # Activation entry point
  copilotEdits/                # Copilot Edit tools & assessment flow
  core/                        # AI request batching, formula store
  java-upgrade/                # Java upgrade engine (build tools, LLM, tools)
  tools/                       # AppCAT, file, search, git tools
  webview/                     # React-based webviews (TSX)
  telemetry/                   # Telemetry service
  model/                       # Data models, schemas
mcp-server/                    # MCP server sub-workspace (own package.json)
agents/                        # Agent markdown definitions
kb/                            # Knowledge base (bundled virtually)
rag/                           # RAG assets (.formula, .prompt, .metadata)
e2etest/                       # Playwright E2E tests
```

## Key Patterns

- **Test files co-located**: `src/foo.test.ts` next to `src/foo.ts`
- **Virtual modules**: RAG assets bundled via esbuild plugin (formulas, prompts, kb markdowns)
- **VS Code mock**: `__mocks__/vscode.ts` + `jest-mock-vscode` for testing
- **Workspaces**: `mcp-server/` is an npm workspace
- **Webviews**: React (TSX) with Bootstrap/SCSS
- **Telemetry context properties**: Must be registered via `registerToolTelemetryContextProperties()` **after** telemetry init — NOT at module level (esbuild bundling overwrites module-level `contextProperties`). See `Tool.ts`.
- **Agent routing via reportWebview**: `reportWebview.ts` routes assessment "Fix" actions to agents. Migrate command logic is extracted to `migrateCommandUtils.ts` for testability.
- **Assessment config**: Java & .NET share a unified `assessment-config.yaml` with `java:` / `dotnet:` namespaces. Backward-compatible with legacy `dotnet-assessment-config.yaml`.
- **Security agent scope**: `modernize-java-security` handles both CVE remediation AND deprecated API fixes (two mutually exclusive scopes: `cve` | `deprecated-api`).
- **Rearchitecture agents v2**: Agent markdown files now contain YAML front-matter only; logic lives in `skills/` directories (e.g., `skills/implementing-code/`, `skills/quality-gates/`, `skills/creating-implementation-plan/`).

## Testing Notes

- Jest with ts-jest and babel-jest transforms
- `maxWorkers: 4`, `clearMocks: true`
- Test patterns: `src/**/*.test.ts` and `mcp-server/src/**/*.test.ts`
- Module name mapper for virtual modules (formulas, prompts, markdowns, metadatas)
- Run specific test: `npx jest --testPathPattern="<pattern>" --no-coverage`

## CI Pipeline

1. Node 22 + Azure Artifacts auth
2. `npm install` + `cd mcp-server && npm install`
3. Build mcp-server → compile → lint (mcp-server) → unit tests → coverage

## Gotchas

- Private npm registry via `.npmrc` (Azure Artifacts) — `npm install` may fail without auth
- Husky pre-commit runs `cd mcp-server && npm run lint` (only mcp-server lint)
- esbuild produces 7 bundles (1 extension + 6 webviews)
- TypeScript strict mode enabled
- Some files in `src/java-upgrade/lib/` are excluded from tsconfig
- **`path.join('.', cmd)` on Linux**: `path.join('.', 'mvnw')` → `'mvnw'` which fails on Linux (shell doesn't search CWD). Use `path.resolve(workDir, exe.path, cmd)` for absolute paths. See issue #5113.
- **SessionContextManager.getSession()**: When matching by `chatSessionId`/`chatRequestId`, `sessionId` param can be `undefined` — always use `session.id` for `activeSessionId` assignment.
- **Scenario config**: New scenarios need `displayLanguage`, `displayLanguageTooltip`, `type`, `displayType`, `displayTypeTooltip` fields in `scenarios.json`. TypeScript upgrade is now non-experimental (feature toggle removed).
- **Skill rename bug**: When renaming a custom skill, file/folder references must be validated against the **old** folder path, not the new one (see `formulaEditor.ts`).

## Last Updated
2026-04-05 — added telemetry patterns, agent routing, assessment config, security agent scope, rearchitecture v2 agents, Linux path gotcha, session manager pitfall, scenario config fields
