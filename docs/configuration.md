# Configuration Guide

Dev Pilot is configured through two files in `~/.claude/`:

| File | Purpose |
|------|---------|
| `pilot.yaml` | Project settings — workspace, repos, defaults |
| `settings.json` | Claude Code permissions (not managed by init.js) |

## pilot.yaml

Created by `node init.js` during installation. Location: `~/.claude/pilot.yaml`

```yaml
workspace: ~/claude/workdir

repos:
  - your-org/your-repo

ai_platform: claude-code     # claude-code or copilot-cli

defaults:
  dev_issue_mode: normal     # normal or auto
  review_pr_mode: auto       # auto or normal
  fix_comment_mode: auto     # auto or normal
  review_min_severity: medium # high, medium, or low

# build:                     # Optional — auto-detected from project if omitted
#   command: npm run build
#   test_command: npx jest --testPathPattern={{file}} --no-coverage
#   default_branch: main
```

### Field Reference

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `workspace` | string | `~/claude/workspace` | Root directory for cloned repos. Tilde (`~`) is expanded |
| `repos` | string[] | `[]` | GitHub repos in `owner/repo` format |
| `ai_platform` | string | `claude-code` | CLI tool: `claude-code` or `copilot-cli` |
| `defaults.dev_issue_mode` | string | `normal` | Default mode for `/pilot-dev-issue` (`normal` = interactive, `auto` = unattended) |
| `defaults.review_pr_mode` | string | `auto` | Default mode for PR review tasks |
| `defaults.fix_comment_mode` | string | `auto` | Default mode for fixing review comments |
| `defaults.review_min_severity` | string | `medium` | Minimum severity threshold for PR reviews |
| `build.command` | string | auto-detect | Override build command. If omitted, LLM analyzes the project to determine the correct command |
| `build.test_command` | string | auto-detect | Override test command. `{{file}}` is replaced with the test file path |
| `build.default_branch` | string | `main` | Default branch for git operations |
| `test_runner_skill` | string | — | Name of a custom test runner skill in `~/.claude/skills/` (advanced — for complex test workflows) |
| `watch_pr.auto_fix_ci` | bool | `true` | Auto-fix CI failures detected by `/pilot-watch-pr` |
| `watch_pr.auto_fix_comments` | bool | `false` | Auto-fix review comments detected by `/pilot-watch-pr` |

### Preset Configs

Use `--config` flag with a preset file:

```bash
node init.js --config my-project-pilot.yaml
```

Preset files live in the repo root and provide pre-filled values for specific projects.

## settings.json

Claude Code's permission file. The init script does **not** copy or modify this file — you must configure it manually.

Location: `~/.claude/settings.json`

```json
{
  "permissions": {
    "allow": [
      "Bash(npx jest*)",
      "Bash(npm run build*)",
      "Bash(npm run test*)",
      "Bash(npm run lint*)",
      "Bash(git *)",
      "Bash(gh *)"
    ]
  }
}
```

### Recommended Permissions

| Permission | Why |
|-----------|-----|
| `Bash(npx jest*)` | Test runner execution |
| `Bash(npm run build*)` | Build commands |
| `Bash(npm run test*)` | Test scripts |
| `Bash(npm run lint*)` | Linting |
| `Bash(git *)` | Git operations (commit, push, branch) |
| `Bash(gh *)` | GitHub CLI (issues, PRs, API calls) |

Add project-specific permissions as needed (e.g., `Bash(mvn *)` for Java projects).

## Updating / Syncing

Dev Pilot is actively maintained. When the upstream repo has new commands, agents, or features, sync them to your local `~/.claude/` with:

```bash
cd dev-pilot && git pull
node init.js --config ~/.claude/pilot.yaml --force
```

| Flag | What it does |
|------|-------------|
| `--config ~/.claude/pilot.yaml` | Reuses your existing configuration instead of prompting for setup |
| `--force` | Overwrites framework files (commands, agents) with the latest versions |

> **Note:** `--force` alone (without `--config`) will trigger the interactive setup wizard and create a new `pilot.yaml`, overwriting your existing one. Always pair `--force` with `--config` to preserve your configuration.

Your `CLAUDE.md` is never overwritten by `init.js`.

## Environment Variables

The dashboard and lib modules also read these environment variables:

| Variable | Used By | Description |
|----------|---------|-------------|
| `PILOT_WORKSPACE` | `lib/config.ts` | Override workspace path (takes precedence over pilot.yaml) |
| `NEXT_PUBLIC_GITHUB_REPO` | `lib/config.ts` | Override primary repo (takes precedence over pilot.yaml) |
| `REVIEW_REPOS` | `lib/types.ts` | JSON array of repos for review-requested PR fetching |
