import { describe, it, expect, vi, beforeEach } from 'vitest';

describe('REVIEW_REPOS', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it('returns parsed array when NEXT_PUBLIC_GITHUB_REPOS is valid JSON', async () => {
    vi.stubEnv('NEXT_PUBLIC_GITHUB_REPOS', '["owner/repo1","owner/repo2"]');
    const { REVIEW_REPOS } = await import('@/lib/types');
    expect(REVIEW_REPOS).toEqual(['owner/repo1', 'owner/repo2']);
  });

  it('returns empty array when env var is not set', async () => {
    vi.stubEnv('NEXT_PUBLIC_GITHUB_REPOS', '');
    const { REVIEW_REPOS } = await import('@/lib/types');
    expect(REVIEW_REPOS).toEqual([]);
  });

  it('returns empty array when env var is malformed JSON', async () => {
    vi.stubEnv('NEXT_PUBLIC_GITHUB_REPOS', 'not-valid-json');
    const { REVIEW_REPOS } = await import('@/lib/types');
    expect(REVIEW_REPOS).toEqual([]);
  });

  it('returns empty array when env var is undefined', async () => {
    delete process.env.NEXT_PUBLIC_GITHUB_REPOS;
    const { REVIEW_REPOS } = await import('@/lib/types');
    expect(REVIEW_REPOS).toEqual([]);
  });
});

describe('CLI_TOOL_CONFIG', () => {
  it('claude args wraps prompt in double quotes', async () => {
    const { CLI_TOOL_CONFIG } = await import('@/lib/types');
    expect(CLI_TOOL_CONFIG.claude.args('hello')).toBe('"hello"');
  });

  it('copilot args includes -i flag and --allow-all', async () => {
    const { CLI_TOOL_CONFIG } = await import('@/lib/types');
    const result = CLI_TOOL_CONFIG.copilot.args('hello');
    expect(result).toBe('-i "hello" --allow-all');
  });
});
