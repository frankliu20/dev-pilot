# Personal AI Engineering Team — Global Instructions

## Who I Am
I am a software engineer. I use Claude Code as my AI engineering team to handle full development workflows: issue analysis, coding, testing, and PR creation.

## My Workflow Preferences

### Communication
- Speak to me in {{CHAT_LANGUAGE}} for discussions and explanations
- Code, commits, PR descriptions, and technical documentation should be in English
- Be concise — I don't need lengthy explanations for things I already understand
- When unsure, ask me rather than guessing
- **All issue/PR references must be full clickable URLs** (not bare `#123`):
  - Issues: `[#N](https://github.com/{{REPO}}/issues/N)`
  - PRs: `[#N](https://github.com/{{REPO}}/pull/N)`

### Code Quality
- Follow existing project conventions — don't introduce new patterns unless asked
- Minimal changes — only modify what's necessary for the task
- Every behavior change must have test coverage
- Run lint and type checks before considering code "done"

### Git & PR
- Branch naming: `fix/issue-<N>`, `feat/issue-<N>`, or `dev/issue-<N>`
- Commit messages: conventional commits style (`fix(scope): description`)
- Never force push or push to main/master
- PR descriptions must reference the issue being fixed
- One logical change per PR

### Safety
- Never modify CI/CD configurations without explicit approval
- Never change dependency versions without explicit approval
- Never delete or modify production data
- Never skip or disable tests to make them pass
- Always create feature branches, never commit to main

### When to Stop and Ask Me
- Requirements are unclear or ambiguous
- Multiple valid approaches exist and you need a decision
- Tests fail after 3 auto-fix attempts
- Changes would affect more than 10 files
- The task involves database migrations or schema changes
- You encounter authentication or permission issues
