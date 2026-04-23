import { readFileSync, existsSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';
import yaml from 'js-yaml';

export interface PilotDefaults {
  dev_issue_mode?: 'normal' | 'auto';
  review_pr_mode?: 'auto' | 'normal';
  fix_comment_mode?: 'auto' | 'normal';
  review_min_severity?: 'high' | 'medium' | 'low';
}

export interface PilotConfig {
  workspace: string;
  repos: string[];
  skills: string[];
  platform?: 'github' | 'gitlab' | 'azdevops';
  ai_platform?: 'copilot-cli' | 'claude-code';
  defaults?: PilotDefaults;
  build?: {
    command?: string;
    test_command?: string;
    test_all_command?: string;
    lint_command?: string;
    default_branch?: string;
  };
}

const PILOT_YAML = join(homedir(), '.claude', 'pilot.yaml');

let _config: PilotConfig | null = null;

export function getConfig(): PilotConfig {
  if (_config) return _config;

  if (existsSync(PILOT_YAML)) {
    try {
      const content = readFileSync(PILOT_YAML, 'utf-8');
      _config = yaml.load(content) as PilotConfig;
    } catch (e) {
      console.error('Failed to parse pilot.yaml:', e);
    }
  }

  // Fallback to env vars and defaults
  if (!_config) {
    _config = {
      workspace: process.env.PILOT_WORKSPACE || join(homedir(), 'claude', 'workdir'),
      repos: (process.env.NEXT_PUBLIC_REPO || process.env.NEXT_PUBLIC_GITHUB_REPO) ? [process.env.NEXT_PUBLIC_REPO || process.env.NEXT_PUBLIC_GITHUB_REPO!] : [],
      skills: [],
      ai_platform: 'copilot-cli',
      defaults: {
        dev_issue_mode: 'normal',
        review_pr_mode: 'normal',
        fix_comment_mode: 'normal',
        review_min_severity: 'medium',
      },
      build: {
        command: 'npm run build',
        test_command: 'npx jest',
        default_branch: 'main',
      },
    };
  }

  // Resolve ~ in workspace path
  if (_config.workspace?.startsWith('~')) {
    _config.workspace = _config.workspace.replace('~', homedir());
  }

  // Ensure defaults exist
  if (!_config.defaults) {
    _config.defaults = {};
  }

  return _config;
}

export function getRepo(): string {
  return getConfig().repos[0] || '';
}

/**
 * Extract owner/repo slug from a full repo URL.
 * For bare slugs (backward compat), returns as-is.
 */
export function getRepoSlug(repo?: string): string {
  const r = repo || getRepo();
  if (!r.startsWith('http')) return r;
  try {
    const parts = new URL(r).pathname.split('/').filter(Boolean);
    // Azure DevOps: /org/project/_git/repo
    const gitIdx = parts.indexOf('_git');
    if (gitIdx >= 2) return `${parts[gitIdx - 2]}/${parts[gitIdx - 1]}`;
    return parts.slice(0, 2).join('/');
  } catch {
    return r;
  }
}

export function getReviewRepos(): string[] {
  return getConfig().repos || [];
}

export function getWorkspace(): string {
  return getConfig().workspace;
}

export function getAiPlatform(): 'copilot-cli' | 'claude-code' {
  return getConfig().ai_platform || 'copilot-cli';
}

export function getDefaults(): PilotDefaults {
  return getConfig().defaults || {};
}

export function getPlatform(): 'github' | 'gitlab' | 'azdevops' {
  return getConfig().platform || 'github';
}
