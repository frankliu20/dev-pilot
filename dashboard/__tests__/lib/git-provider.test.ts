import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock config to control platform
const mockGetConfig = vi.fn();
vi.mock('@/lib/config', () => ({
  getConfig: (...args: any[]) => mockGetConfig(...args),
}));

import {
  getPlatform,
  getCliBinary,
  repoUrl,
  cloneUrl,
  repoSlugFromUrl,
  repoFromUrl,
  supportsGraphQL,
  issueListArgs,
  issueViewArgs,
  issueCommentArgs,
  prListArgs,
  prViewArgs,
  prDiffArgs,
  prCreateArgs,
  prReviewApproveArgs,
  authStatusCommand,
} from '@/lib/git-provider';

function setMockPlatform(platform: string) {
  mockGetConfig.mockReturnValue({
    workspace: '/mock',
    repos: [],
    platform,
    skills: [],
  });
}

beforeEach(() => {
  setMockPlatform('github');
});

// ── Platform detection ─────────────────────────────────────────────────

describe('getPlatform', () => {
  it('returns github by default', () => {
    mockGetConfig.mockReturnValue({ workspace: '/mock', repos: [], skills: [] });
    expect(getPlatform()).toBe('github');
  });

  it('returns configured platform', () => {
    setMockPlatform('gitlab');
    expect(getPlatform()).toBe('gitlab');
  });
});

describe('getCliBinary', () => {
  it('returns gh for github', () => {
    setMockPlatform('github');
    expect(getCliBinary()).toBe('gh');
  });

  it('returns glab for gitlab', () => {
    setMockPlatform('gitlab');
    expect(getCliBinary()).toBe('glab');
  });

  it('returns az for azdevops', () => {
    setMockPlatform('azdevops');
    expect(getCliBinary()).toBe('az');
  });
});

// ── Repo URL helpers ───────────────────────────────────────────────────

describe('repoUrl', () => {
  it('returns full URL as-is', () => {
    expect(repoUrl('https://gitlab.mycompany.com/team/project')).toBe('https://gitlab.mycompany.com/team/project');
  });

  it('falls back to GitHub for bare slugs', () => {
    expect(repoUrl('owner/repo')).toBe('https://github.com/owner/repo');
  });
});

describe('cloneUrl', () => {
  it('appends .git to full URL', () => {
    expect(cloneUrl('https://gitlab.mycompany.com/team/project')).toBe('https://gitlab.mycompany.com/team/project.git');
  });

  it('does not double .git', () => {
    expect(cloneUrl('https://github.com/owner/repo.git')).toBe('https://github.com/owner/repo.git');
  });

  it('uses github.com for bare slugs', () => {
    expect(cloneUrl('owner/repo')).toBe('https://github.com/owner/repo.git');
  });
});

describe('repoSlugFromUrl', () => {
  it('extracts slug from GitHub URL', () => {
    expect(repoSlugFromUrl('https://github.com/owner/repo/issues/123')).toBe('owner/repo');
  });

  it('extracts slug from GitLab self-hosted URL', () => {
    expect(repoSlugFromUrl('https://gitlab.mycompany.com/team/project')).toBe('team/project');
  });

  it('extracts slug from Azure DevOps URL', () => {
    expect(repoSlugFromUrl('https://dev.azure.com/org/project/_git/repo')).toBe('org/project/repo');
  });

  it('strips .git suffix', () => {
    expect(repoSlugFromUrl('https://github.com/owner/repo.git')).toBe('owner/repo');
  });
});

describe('repoFromUrl', () => {
  it('extracts owner/repo from GitHub URL', () => {
    expect(repoFromUrl('https://github.com/owner/repo/pull/123')).toBe('owner/repo');
  });

  it('extracts from GitLab self-hosted URL', () => {
    expect(repoFromUrl('https://gitlab.mycompany.com/team/project/-/merge_requests/5')).toBe('team/project');
  });

  it('extracts from Azure DevOps URL', () => {
    expect(repoFromUrl('https://dev.azure.com/myorg/myproject/_git/myrepo/pullrequest/42')).toBe('myorg/myproject');
  });

  it('returns null for invalid URLs', () => {
    expect(repoFromUrl('not-a-url')).toBeNull();
  });

  it('returns null for URL with only host', () => {
    expect(repoFromUrl('https://github.com/')).toBeNull();
  });

  it('strips .git from repo name', () => {
    expect(repoFromUrl('https://github.com/owner/repo.git/something')).toBe('owner/repo');
  });
});

// ── GraphQL support ────────────────────────────────────────────────────

describe('supportsGraphQL', () => {
  it('returns true for github', () => {
    setMockPlatform('github');
    expect(supportsGraphQL()).toBe(true);
  });

  it('returns false for gitlab', () => {
    setMockPlatform('gitlab');
    expect(supportsGraphQL()).toBe(false);
  });

  it('returns false for azdevops', () => {
    setMockPlatform('azdevops');
    expect(supportsGraphQL()).toBe(false);
  });
});

// ── Issue commands ─────────────────────────────────────────────────────

describe('issueListArgs', () => {
  it('builds github args', () => {
    setMockPlatform('github');
    expect(issueListArgs('owner/repo', '--state open')).toBe('issue list --repo owner/repo --state open');
  });

  it('builds gitlab args', () => {
    setMockPlatform('gitlab');
    expect(issueListArgs('team/project')).toBe('issue list --repo team/project ');
  });

  it('builds azdevops args', () => {
    setMockPlatform('azdevops');
    expect(issueListArgs('org/project')).toBe('boards work-item list ');
  });
});

describe('issueViewArgs', () => {
  it('builds github args', () => {
    setMockPlatform('github');
    expect(issueViewArgs('owner/repo', 42)).toBe('issue view 42 --repo owner/repo');
  });

  it('builds gitlab args', () => {
    setMockPlatform('gitlab');
    expect(issueViewArgs('team/project', 10)).toBe('issue view 10 --repo team/project');
  });

  it('builds azdevops args', () => {
    setMockPlatform('azdevops');
    expect(issueViewArgs('org/project', 5)).toBe('boards work-item show --id 5');
  });
});

describe('issueCommentArgs', () => {
  it('escapes quotes in body', () => {
    setMockPlatform('github');
    const result = issueCommentArgs('owner/repo', 1, 'say "hello"');
    expect(result).toContain('\\"hello\\"');
  });

  it('builds gitlab note args', () => {
    setMockPlatform('gitlab');
    const result = issueCommentArgs('team/project', 1, 'test');
    expect(result).toContain('issue note 1');
    expect(result).toContain('-m');
  });
});

// ── PR / MR commands ───────────────────────────────────────────────────

describe('prListArgs', () => {
  it('builds github args', () => {
    setMockPlatform('github');
    expect(prListArgs('owner/repo', '--author @me')).toBe('pr list --repo owner/repo --author @me');
  });

  it('builds gitlab mr list args', () => {
    setMockPlatform('gitlab');
    expect(prListArgs('team/project')).toBe('mr list --repo team/project ');
  });

  it('builds azdevops args', () => {
    setMockPlatform('azdevops');
    expect(prListArgs('org/project')).toBe('repos pr list --repository org/project ');
  });
});

describe('prViewArgs', () => {
  it('builds github args', () => {
    setMockPlatform('github');
    expect(prViewArgs('owner/repo', 5)).toBe('pr view 5 --repo owner/repo ');
  });

  it('builds gitlab args', () => {
    setMockPlatform('gitlab');
    expect(prViewArgs('team/project', 5)).toBe('mr view 5 --repo team/project ');
  });
});

describe('prDiffArgs', () => {
  it('builds github args', () => {
    setMockPlatform('github');
    expect(prDiffArgs('owner/repo', 10)).toBe('pr diff 10 --repo owner/repo');
  });

  it('builds gitlab args', () => {
    setMockPlatform('gitlab');
    expect(prDiffArgs('team/project', 10)).toBe('mr diff 10 --repo team/project');
  });
});

describe('prCreateArgs', () => {
  it('builds github args', () => {
    setMockPlatform('github');
    const result = prCreateArgs('owner/repo', 'title', 'body');
    expect(result).toContain('pr create --repo owner/repo');
  });

  it('builds gitlab mr create args', () => {
    setMockPlatform('gitlab');
    const result = prCreateArgs('team/project', 'title', 'body');
    expect(result).toContain('mr create --repo team/project');
    expect(result).toContain('--description');
  });

  it('builds azdevops args', () => {
    setMockPlatform('azdevops');
    const result = prCreateArgs('org/project', 'title', 'body');
    expect(result).toContain('repos pr create');
  });
});

describe('prReviewApproveArgs', () => {
  it('builds github approve args', () => {
    setMockPlatform('github');
    const result = prReviewApproveArgs('owner/repo', 5, 'LGTM');
    expect(result).toContain('pr review 5');
    expect(result).toContain('--approve');
  });

  it('builds gitlab approve args', () => {
    setMockPlatform('gitlab');
    const result = prReviewApproveArgs('team/project', 5, 'LGTM');
    expect(result).toContain('mr approve 5');
  });

  it('builds azdevops vote args', () => {
    setMockPlatform('azdevops');
    const result = prReviewApproveArgs('org/project', 5, 'LGTM');
    expect(result).toContain('set-vote');
    expect(result).toContain('--vote approve');
  });
});

// ── Auth commands ──────────────────────────────────────────────────────

describe('authStatusCommand', () => {
  it('returns gh auth status for github', () => {
    setMockPlatform('github');
    expect(authStatusCommand()).toBe('gh auth status');
  });

  it('returns glab auth status for gitlab', () => {
    setMockPlatform('gitlab');
    expect(authStatusCommand()).toBe('glab auth status');
  });

  it('returns az account show for azdevops', () => {
    setMockPlatform('azdevops');
    expect(authStatusCommand()).toBe('az account show');
  });
});
