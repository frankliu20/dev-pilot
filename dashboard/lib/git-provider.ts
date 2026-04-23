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

/** Run a CLI command for the configured platform and return stdout. */
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

/** Convenience: run a `gh` / `glab` / `az` command and return stdout. */
export { runCLI as runGH }; // backward-compat alias

export function getPlatform(): Platform {
  return (getConfig().platform as Platform) || 'github';
}

export function getCliBinary(): string {
  return CLI_BINARY[getPlatform()];
}

// ── Repo URL helpers ─────────────────────────────────────────────────

const HOST_PREFIX: Record<Platform, string> = {
  github: 'https://github.com/',
  gitlab: 'https://gitlab.com/',
  azdevops: 'https://dev.azure.com/',
};

/** Build a web URL for a repo slug (owner/repo). */
export function repoUrl(slug: string): string {
  return `${HOST_PREFIX[getPlatform()]}${slug}`;
}

/** Clone URL for a repo slug. */
export function cloneUrl(slug: string): string {
  const platform = getPlatform();
  if (slug.startsWith('https://')) {
    return slug.endsWith('.git') ? slug : `${slug}.git`;
  }
  return `${HOST_PREFIX[platform]}${slug}.git`;
}

// ── Issue commands ───────────────────────────────────────────────────

export function issueListArgs(repo: string, extra: string = ''): string {
  const p = getPlatform();
  switch (p) {
    case 'github':
      return `issue list --repo ${repo} ${extra}`;
    case 'gitlab':
      return `issue list --repo ${repo} ${extra}`;
    case 'azdevops':
      // az boards work-item list requires --org and --project, handled by caller
      return `boards work-item list ${extra}`;
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
  const escaped = body.replace(/"/g, '\\"');
  switch (p) {
    case 'github':
      return `issue comment ${number} --repo ${repo} --body "${escaped}"`;
    case 'gitlab':
      return `issue note ${number} --repo ${repo} -m "${escaped}"`;
    case 'azdevops':
      // az boards work-item update --id N --discussion "body"
      return `boards work-item update --id ${number} --discussion "${escaped}"`;
  }
}

// ── PR / MR commands ─────────────────────────────────────────────────

export function prListArgs(repo: string, extra: string = ''): string {
  const p = getPlatform();
  switch (p) {
    case 'github':
      return `pr list --repo ${repo} ${extra}`;
    case 'gitlab':
      return `mr list --repo ${repo} ${extra}`;
    case 'azdevops':
      return `repos pr list --repository ${repo} ${extra}`;
  }
}

export function prViewArgs(repo: string, number: number, extra: string = ''): string {
  const p = getPlatform();
  switch (p) {
    case 'github':
      return `pr view ${number} --repo ${repo} ${extra}`;
    case 'gitlab':
      return `mr view ${number} --repo ${repo} ${extra}`;
    case 'azdevops':
      return `repos pr show --id ${number} ${extra}`;
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
  const escapedTitle = title.replace(/"/g, '\\"');
  const escapedBody = body.replace(/"/g, '\\"');
  switch (p) {
    case 'github':
      return `pr create --repo ${repo} --title "${escapedTitle}" --body "${escapedBody}" ${extra}`;
    case 'gitlab':
      return `mr create --repo ${repo} --title "${escapedTitle}" --description "${escapedBody}" ${extra}`;
    case 'azdevops':
      return `repos pr create --repository ${repo} --title "${escapedTitle}" --description "${escapedBody}" ${extra}`;
  }
}

export function prReviewApproveArgs(repo: string, number: number, message: string): string {
  const p = getPlatform();
  const escaped = message.replace(/"/g, '\\"');
  switch (p) {
    case 'github':
      return `pr review ${number} --repo ${repo} --approve -b "${escaped}"`;
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

/** Extract owner/name from a platform-specific URL. */
export function repoFromUrl(url: string): string | null {
  // GitHub: https://github.com/owner/repo/...
  const ghMatch = url.match(/github\.com\/([^/]+\/[^/]+)\//);
  if (ghMatch) return ghMatch[1];

  // GitLab: https://gitlab.com/owner/repo/...
  const glMatch = url.match(/gitlab\.com\/([^/]+\/[^/]+)\//);
  if (glMatch) return glMatch[1];

  // Azure DevOps: https://dev.azure.com/org/project/...
  const azMatch = url.match(/dev\.azure\.com\/([^/]+\/[^/]+)\//);
  if (azMatch) return azMatch[1];

  return null;
}
