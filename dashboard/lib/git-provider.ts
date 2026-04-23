// Git platform provider abstraction
//
// Maps platform-agnostic operations to the correct CLI tool (gh, glab, az devops).
// The rest of the codebase calls these helpers instead of hardcoding `gh`.

import { exec } from 'child_process';
import { promisify } from 'util';
import { getConfig } from './config';

const execAsync = promisify(exec);

export type Platform = 'github' | 'gitlab' | 'azdevops';

// ── CLI binary per platform ──────────────────────────────────────────

const CLI_BINARY: Record<Platform, string> = {
  github: 'gh',
  gitlab: 'glab',
  azdevops: 'az',
};

// ── Low-level runner ─────────────────────────────────────────────────

/** Escape a string for safe use in a shell command (single-quote wrapping). */
export function shellEscape(str: string): string {
  // Wrap in single quotes; escape any embedded single quotes as '\''
  return "'" + str.replace(/'/g, "'\\''") + "'";
}

/** Run a CLI command for the configured platform and return stdout. Returns '[]' on error (for JSON-list callers). */
export async function runCLI(args: string): Promise<string> {
  const platform = getPlatform();
  const binary = CLI_BINARY[platform];
  try {
    const { stdout } = await execAsync(`${binary} ${args}`, {
      encoding: 'utf-8',
      timeout: 15000,
    });
    return stdout;
  } catch (err) {
    console.error(`${binary} command failed: ${binary} ${args}`, err);
    return '[]';
  }
}

/** Run a CLI command and return stdout. Throws on error (for non-JSON callers). */
export async function runCLIRaw(args: string): Promise<string> {
  const platform = getPlatform();
  const binary = CLI_BINARY[platform];
  const { stdout } = await execAsync(`${binary} ${args}`, {
    encoding: 'utf-8',
    timeout: 15000,
  });
  return stdout;
}

/** Convenience: run a `gh` / `glab` / `az` command and return stdout. */
export { runCLI as runGH }; // backward-compat alias

export function getPlatform(): Platform {
  return (getConfig().platform as Platform) || 'github';
}

export function getCliBinary(): string {
  return CLI_BINARY[getPlatform()];
}

// ── Repo URL helpers ─────────────────────────────────────────────────

/**
 * Build a web URL for a repo.
 * Repos are stored as full URLs in pilot.yaml, so just return as-is.
 * Falls back to GitHub for bare owner/repo slugs (backward compat).
 */
export function repoUrl(slug: string): string {
  if (slug.startsWith('https://') || slug.startsWith('http://')) {
    return slug;
  }
  // Bare slug fallback for backward compatibility
  return `https://github.com/${slug}`;
}

/** Clone URL for a repo. Repos are already full URLs; just ensure .git suffix. */
export function cloneUrl(repo: string): string {
  if (repo.startsWith('https://') || repo.startsWith('http://')) {
    return repo.endsWith('.git') ? repo : `${repo}.git`;
  }
  // Bare slug fallback
  return `https://github.com/${repo}.git`;
}

/**
 * Extract owner/repo slug from a full URL.
 * Works with any git host (GitHub, GitLab, Azure DevOps, self-hosted).
 * For Azure DevOps, returns org/project (matching getRepoSlug behavior).
 */
export function repoSlugFromUrl(url: string): string {
  return repoFromUrl(url) || url;
}

// ── Issue commands ───────────────────────────────────────────────────

export function issueListArgs(repo: string, extra: string = ''): string {
  const p = getPlatform();
  const suffix = extra ? ` ${extra}` : '';
  switch (p) {
    case 'github':
      return `issue list --repo ${repo}${suffix}`;
    case 'gitlab':
      return `issue list --repo ${repo}${suffix}`;
    case 'azdevops':
      return `boards work-item list${suffix}`;
  }
}

export function issueViewArgs(repo: string, number: number): string {
  const p = getPlatform();
  switch (p) {
    case 'github':
      return `issue view ${number} --repo ${repo}`;
    case 'gitlab':
      return `issue view ${number} --repo ${repo}`;
    case 'azdevops':
      return `boards work-item show --id ${number}`;
  }
}

export function issueCommentArgs(repo: string, number: number, body: string): string {
  const p = getPlatform();
  const escaped = shellEscape(body);
  switch (p) {
    case 'github':
      return `issue comment ${number} --repo ${repo} --body ${escaped}`;
    case 'gitlab':
      return `issue note ${number} --repo ${repo} -m ${escaped}`;
    case 'azdevops':
      // az boards work-item update --id N --discussion "body"
      return `boards work-item update --id ${number} --discussion ${escaped}`;
  }
}

// ── PR / MR commands ─────────────────────────────────────────────────

export function prListArgs(repo: string, extra: string = ''): string {
  const p = getPlatform();
  const suffix = extra ? ` ${extra}` : '';
  switch (p) {
    case 'github':
      return `pr list --repo ${repo}${suffix}`;
    case 'gitlab':
      return `mr list --repo ${repo}${suffix}`;
    case 'azdevops':
      return `repos pr list --repository ${repo}${suffix}`;
  }
}

export function prViewArgs(repo: string, number: number, extra: string = ''): string {
  const p = getPlatform();
  const suffix = extra ? ` ${extra}` : '';
  switch (p) {
    case 'github':
      return `pr view ${number} --repo ${repo}${suffix}`;
    case 'gitlab':
      return `mr view ${number} --repo ${repo}${suffix}`;
    case 'azdevops':
      return `repos pr show --id ${number}${suffix}`;
  }
}

export function prDiffArgs(repo: string, number: number): string {
  const p = getPlatform();
  switch (p) {
    case 'github':
      return `pr diff ${number} --repo ${repo}`;
    case 'gitlab':
      return `mr diff ${number} --repo ${repo}`;
    case 'azdevops':
      return `repos pr diff --id ${number}`;
  }
}

export function prCreateArgs(repo: string, title: string, body: string, extra: string = ''): string {
  const p = getPlatform();
  const escapedTitle = shellEscape(title);
  const escapedBody = shellEscape(body);
  const suffix = extra ? ` ${extra}` : '';
  switch (p) {
    case 'github':
      return `pr create --repo ${repo} --title ${escapedTitle} --body ${escapedBody}${suffix}`;
    case 'gitlab':
      return `mr create --repo ${repo} --title ${escapedTitle} --description ${escapedBody}${suffix}`;
    case 'azdevops':
      return `repos pr create --repository ${repo} --title ${escapedTitle} --description ${escapedBody}${suffix}`;
  }
}

export function prReviewApproveArgs(repo: string, number: number, message: string): string {
  const p = getPlatform();
  const escaped = shellEscape(message);
  switch (p) {
    case 'github':
      return `pr review ${number} --repo ${repo} --approve -b ${escaped}`;
    case 'gitlab':
      return `mr approve ${number} --repo ${repo}`;
    case 'azdevops':
      return `repos pr set-vote --id ${number} --vote approve`;
  }
}

// ── Auth commands ────────────────────────────────────────────────────

export function authStatusCommand(): string {
  const p = getPlatform();
  switch (p) {
    case 'github':
      return 'gh auth status';
    case 'gitlab':
      return 'glab auth status';
    case 'azdevops':
      return 'az account show';
  }
}

// ── GraphQL support ──────────────────────────────────────────────────

/** Whether the platform supports gh-style GraphQL queries. */
export function supportsGraphQL(): boolean {
  return getPlatform() === 'github';
}

/**
 * Extract owner/name from any git platform URL.
 * Handles GitHub, GitLab (including self-hosted), Azure DevOps, etc.
 * Returns the first two meaningful path segments as "owner/repo".
 */
export function repoFromUrl(url: string): string | null {
  try {
    const u = new URL(url);
    const parts = u.pathname.split('/').filter(Boolean);

    // Azure DevOps: /org/project/_git/repo → use org/project
    const gitIdx = parts.indexOf('_git');
    if (gitIdx >= 2) {
      return `${parts[gitIdx - 2]}/${parts[gitIdx - 1]}`;
    }

    // Generic: /owner/repo/... → owner/repo
    if (parts.length >= 2) {
      // Strip .git suffix from repo name
      const repo = parts[1].replace(/\.git$/, '');
      return `${parts[0]}/${repo}`;
    }
    return null;
  } catch {
    return null;
  }
}
