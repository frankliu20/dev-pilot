---
name: mod-java-general-knowledge
description: Accumulated gotchas, pitfalls, and non-obvious patterns learned from working on the project. Things you won't find by reading the repo.
---

## Gotchas & Pitfalls

### Build & Dependencies

- **Private npm registry**: `.npmrc` points to Azure Artifacts — `npm install` fails without auth. Run `az artifacts universal login` or check PAT.
- **Husky pre-commit**: Only runs `cd mcp-server && npm run lint` (mcp-server lint only), NOT the extension lint. Easy to miss extension lint errors.
- **esbuild bundling**: Produces 7 bundles (1 extension + 6 webviews). Module-level side effects get overwritten during bundling.

### Code Patterns (Non-Obvious)

- **Telemetry context properties**: Must be registered via `registerToolTelemetryContextProperties()` **after** telemetry init — NOT at module level. esbuild bundling overwrites module-level `contextProperties`. See `Tool.ts`.
- **Agent routing via reportWebview**: `reportWebview.ts` routes assessment "Fix" actions to agents. Migrate command logic is extracted to `migrateCommandUtils.ts` for testability.
- **Assessment config**: Java & .NET share a unified `assessment-config.yaml` with `java:` / `dotnet:` namespaces. Backward-compatible with legacy `dotnet-assessment-config.yaml`.
- **Security agent scope**: `modernize-java-security` handles both CVE remediation AND deprecated API fixes (two mutually exclusive scopes: `cve` | `deprecated-api`).
- **Rearchitecture agents v2**: Agent markdown files now contain YAML front-matter only; logic lives in `skills/` directories (e.g., `skills/implementing-code/`, `skills/quality-gates/`, `skills/creating-implementation-plan/`).

### Known Bugs & Workarounds

- **`path.join('.', cmd)` on Linux**: `path.join('.', 'mvnw')` → `'mvnw'` which fails on Linux (shell doesn't search CWD). Use `path.resolve(workDir, exe.path, cmd)` for absolute paths. See issue #5113.
- **SessionContextManager.getSession()**: When matching by `chatSessionId`/`chatRequestId`, `sessionId` param can be `undefined` — always use `session.id` for `activeSessionId` assignment.
- **Skill rename bug**: When renaming a custom skill, file/folder references must be validated against the **old** folder path, not the new one (see `formulaEditor.ts`).

### Config & Feature Flags

- **Scenario config**: New scenarios need `displayLanguage`, `displayLanguageTooltip`, `type`, `displayType`, `displayTypeTooltip` fields in `scenarios.json`. TypeScript upgrade is now non-experimental (feature toggle removed).

### CI

- **CI order matters**: Build mcp-server first → then compile extension → then lint mcp-server → then unit tests. If you change this order, things break silently.
- **Some files excluded**: `src/java-upgrade/lib/` files are excluded from tsconfig — don't expect type-checking on those.

## Last Updated
2026-04-05
