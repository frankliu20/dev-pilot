# Contributing to Dev Pilot

Thanks for your interest in contributing! This guide will help you get started.

## Getting Started

See the [Developer Guide](docs/dev-guide.md) for setup, build, test, and common workflow instructions.

## How to Contribute

### Reporting Bugs

Open a [GitHub issue](https://github.com/frankliu20/dev-pilot/issues/new) with:
- Steps to reproduce
- Expected vs actual behavior
- Environment (OS, Node.js version, Claude Code version)

### Suggesting Features

Open an issue with the `enhancement` label describing the use case and proposed solution.

### Submitting Pull Requests

1. Fork the repo and create a branch: `fix/issue-<N>` or `feat/issue-<N>`
2. Make minimal, focused changes — one logical change per PR
3. Add tests for any behavior changes
4. Run `cd dashboard && npm test && npx tsc --noEmit` before submitting
5. Reference the issue in your PR description

### Editing Commands, Agents, or Skills

**Never edit files directly in `~/.claude/`.** All source of truth lives in this repo:

1. Edit the file in `framework/` (e.g., `framework/commands/claude/pilot-dev-issue.md`)
2. Run `node init.js --force` to sync to `~/.claude/`
3. Test your changes, then commit

## Code Style

- Follow existing conventions in the codebase
- TypeScript for all dashboard code
- Conventional commits: `fix(scope): description`, `feat(scope): description`

## License

By contributing, you agree that your contributions will be licensed under the MIT License.
