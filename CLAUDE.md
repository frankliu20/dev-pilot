# Dev Pilot — Project Rules

## Critical: File Editing Workflow

**NEVER directly modify files under `~/.claude/` (commands, agents, skills, scripts).**

All source-of-truth files live in THIS repository (`dev-pilot/`). To update any command, agent, skill, or script:

1. Edit the file in `dev-pilot/` (e.g., `framework/commands/pilot-dev-issue.md`, `framework/agents/pilot-pr-creator.md`, `skills/modernize-java/test-runner/SKILL.md`)
2. Run `node init.js --force` to sync to `~/.claude/`
3. Commit the change in this repo

This ensures all changes are version-controlled and reproducible.
