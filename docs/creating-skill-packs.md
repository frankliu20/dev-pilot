# Creating Skill Packs

Skill packs add project-specific knowledge, test strategies, and scripts to the Dev Pilot framework. Each skill pack is a directory under `skills/` containing one or more skill modules.

## Structure

```
skills/
└── your-project/
    ├── general-knowledge/
    │   └── SKILL.md          # Project conventions, gotchas, patterns
    ├── test-runner/
    │   └── SKILL.md          # Build, test, manual verify strategies
    ├── scripts/
    │   └── your-script.sh    # Utility scripts (copied to ~/.claude/scripts/)
    └── test-scenarios/
        └── webapp.md         # Manual test scenario (copied to ~/.claude/test-scenarios/)
```

## How to Create One

1. **Create a directory** under `skills/` with your pack name:
   ```bash
   mkdir -p skills/my-project/general-knowledge
   ```

2. **Add skill modules** — each subdirectory with a `SKILL.md` becomes a skill:
   ```bash
   # Project knowledge
   echo "# My Project Knowledge\n\n..." > skills/my-project/general-knowledge/SKILL.md
   
   # Test runner
   mkdir skills/my-project/test-runner
   echo "# Test Runner\n\n..." > skills/my-project/test-runner/SKILL.md
   ```

3. **Register in pilot.yaml**:
   ```yaml
   skills:
     - my-project
   ```

4. **Install**:
   ```bash
   node init.js --force
   ```

## Skill Module Types

### general-knowledge

Project-level conventions, common pitfalls, and patterns. Referenced by agents during code exploration and implementation.

### test-runner

Build and test strategies. The `/pilot-dev-issue` command uses this to:
- Run builds (`build.command` in SKILL.md or pilot.yaml)
- Execute tests (`build.test_command`)
- Handle manual verification scenarios

### scripts

Utility scripts copied to `~/.claude/scripts/`. Available to all agents via `Bash(~/.claude/scripts/your-script.sh)`.

### test-scenarios

Manual test scenario files. Automatically discovered by the test-runner skill during the manual verification phase.

## Test Scenario Format

Files in `test-scenarios/` follow this template:

```markdown
---
id: webapp
name: "Web App (Browser)"
---

## Setup
[Build and launch commands]

## Hand-off Instructions
[What to tell the user to test]

## Verification Checklist
- [ ] Feature works correctly
- [ ] No console errors

## Cleanup
[Cleanup commands]
```

### Fields

| Field | Required | Description |
|-------|----------|-------------|
| `id` | Yes | Unique identifier for the scenario |
| `name` | Yes | Human-readable name shown in the dashboard Actions tab |
| Setup | Yes | Commands to build and launch the application |
| Hand-off Instructions | Yes | What the user should manually verify |
| Verification Checklist | Yes | Checkboxes for the user to confirm |
| Cleanup | No | Commands to run after verification |

## Example: modernize-java

The included `modernize-java` skill pack demonstrates a complete setup:

```
skills/modernize-java/
├── test-runner/           # Maven build, JUnit test, IntelliJ plugin build
├── build-intellij/        # Cross-repo IntelliJ plugin compilation
├── telemetry-query/       # Azure App Insights KQL queries
├── benchmark-analysis/    # Performance benchmark analysis
├── general-knowledge/     # Project-specific gotchas
└── scripts/               # Utility scripts for the project
```
