import { describe, it, expect, vi, beforeEach } from 'vitest';
import { join } from 'path';
import type { PilotConfig } from '@/lib/config';

vi.mock('fs');
vi.mock('os');
vi.mock('js-yaml');

describe('config', () => {
  beforeEach(async () => {
    vi.resetModules();
    const fs = await import('fs');
    const os = await import('os');
    // Default: pilot.yaml does not exist
    vi.mocked(fs.existsSync).mockReturnValue(false);
    vi.mocked(fs.readFileSync).mockReturnValue('' as any);
    vi.mocked(os.homedir).mockReturnValue('/home/testuser');
  });

  async function importConfig() {
    return await import('@/lib/config');
  }

  async function mockFs() {
    return await import('fs');
  }

  async function mockYaml() {
    return (await import('js-yaml')).default;
  }

  describe('getConfig()', () => {
    it('returns env-var-based fallback when pilot.yaml does not exist', async () => {
      vi.stubEnv('PILOT_WORKSPACE', '/my/workspace');
      vi.stubEnv('NEXT_PUBLIC_GITHUB_REPO', 'owner/repo');
      const { getConfig } = await importConfig();
      const config = getConfig();

      expect(config.workspace).toBe('/my/workspace');
      expect(config.repos).toEqual(['owner/repo']);
    });

    it('returns defaults when neither yaml nor env vars are set', async () => {
      const { getConfig } = await importConfig();
      const config = getConfig();

      expect(config.workspace).toBe(join('/home/testuser', 'claude', 'workdir'));
      expect(config.repos).toEqual([]);
      expect(config.skills).toEqual([]);
    });

    it('parses pilot.yaml when it exists', async () => {
      const fs = await mockFs();
      const yaml = await mockYaml();
      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.readFileSync).mockReturnValue('yaml-content' as any);

      const mockConfig: PilotConfig = {
        workspace: '/yaml/workspace',
        repos: ['org/repo1'],
        skills: ['skill1'],
        ai_platform: 'claude-code',
      };
      vi.mocked(yaml.load).mockReturnValue(mockConfig);

      const { getConfig } = await importConfig();
      const config = getConfig();

      expect(config.workspace).toBe('/yaml/workspace');
      expect(config.repos).toEqual(['org/repo1']);
      expect(config.ai_platform).toBe('claude-code');
    });

    it('falls back to defaults on malformed YAML (parse error)', async () => {
      const fs = await mockFs();
      const yaml = await mockYaml();
      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.readFileSync).mockReturnValue('bad' as any);
      vi.mocked(yaml.load).mockImplementation(() => {
        throw new Error('YAML parse error');
      });

      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      const { getConfig } = await importConfig();
      const config = getConfig();

      expect(consoleSpy).toHaveBeenCalled();
      expect(config.workspace).toBe(join('/home/testuser', 'claude', 'workdir'));
    });

    it('expands tilde in workspace path', async () => {
      const fs = await mockFs();
      const yaml = await mockYaml();
      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.readFileSync).mockReturnValue('ok' as any);
      vi.mocked(yaml.load).mockReturnValue({
        workspace: '~/projects',
        repos: [],
        skills: [],
      });

      const { getConfig } = await importConfig();
      const config = getConfig();

      expect(config.workspace).toBe('/home/testuser/projects');
    });

    it('caches config on subsequent calls (singleton)', async () => {
      const fs = await mockFs();
      const { getConfig } = await importConfig();

      getConfig();
      getConfig();

      // existsSync should be called only once because of caching
      expect(vi.mocked(fs.existsSync)).toHaveBeenCalledTimes(1);
    });

    it('ensures defaults object exists even when yaml has none', async () => {
      const fs = await mockFs();
      const yaml = await mockYaml();
      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.readFileSync).mockReturnValue('ok' as any);
      vi.mocked(yaml.load).mockReturnValue({
        workspace: '/ws',
        repos: [],
        skills: [],
        // no defaults field
      });

      const { getConfig } = await importConfig();
      const config = getConfig();

      expect(config.defaults).toBeDefined();
      expect(config.defaults).toEqual({});
    });
  });

  describe('getRepo()', () => {
    it('returns the first repo', async () => {
      const fs = await mockFs();
      const yaml = await mockYaml();
      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.readFileSync).mockReturnValue('ok' as any);
      vi.mocked(yaml.load).mockReturnValue({
        workspace: '/ws',
        repos: ['org/first', 'org/second'],
        skills: [],
      });

      const { getRepo } = await importConfig();
      expect(getRepo()).toBe('org/first');
    });

    it('returns empty string when repos array is empty', async () => {
      const { getRepo } = await importConfig();
      expect(getRepo()).toBe('');
    });
  });

  describe('getReviewRepos()', () => {
    it('returns all repos from config', async () => {
      const fs = await mockFs();
      const yaml = await mockYaml();
      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.readFileSync).mockReturnValue('ok' as any);
      vi.mocked(yaml.load).mockReturnValue({
        workspace: '/ws',
        repos: ['org/a', 'org/b'],
        skills: [],
      });

      const { getReviewRepos } = await importConfig();
      expect(getReviewRepos()).toEqual(['org/a', 'org/b']);
    });
  });

  describe('getWorkspace()', () => {
    it('returns workspace path from config', async () => {
      vi.stubEnv('PILOT_WORKSPACE', '/test/ws');
      const { getWorkspace } = await importConfig();
      expect(getWorkspace()).toBe('/test/ws');
    });
  });

  describe('getAiPlatform()', () => {
    it('returns ai_platform from config', async () => {
      const fs = await mockFs();
      const yaml = await mockYaml();
      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.readFileSync).mockReturnValue('ok' as any);
      vi.mocked(yaml.load).mockReturnValue({
        workspace: '/ws',
        repos: [],
        skills: [],
        ai_platform: 'claude-code',
      });

      const { getAiPlatform } = await importConfig();
      expect(getAiPlatform()).toBe('claude-code');
    });

    it('defaults to copilot-cli when not set', async () => {
      const { getAiPlatform } = await importConfig();
      expect(getAiPlatform()).toBe('copilot-cli');
    });
  });

  describe('getRepoSlug()', () => {
    it('returns bare slug as-is', async () => {
      const fs = await mockFs();
      const yaml = await mockYaml();
      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.readFileSync).mockReturnValue('ok' as any);
      vi.mocked(yaml.load).mockReturnValue({
        workspace: '/ws',
        repos: ['owner/repo'],
        skills: [],
      });

      const { getRepoSlug } = await importConfig();
      expect(getRepoSlug()).toBe('owner/repo');
    });

    it('extracts slug from full GitHub URL', async () => {
      const fs = await mockFs();
      const yaml = await mockYaml();
      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.readFileSync).mockReturnValue('ok' as any);
      vi.mocked(yaml.load).mockReturnValue({
        workspace: '/ws',
        repos: ['https://github.com/myorg/myrepo'],
        skills: [],
      });

      const { getRepoSlug } = await importConfig();
      expect(getRepoSlug()).toBe('myorg/myrepo');
    });

    it('extracts slug from GitLab self-hosted URL', async () => {
      const { getRepoSlug } = await importConfig();
      expect(getRepoSlug('https://gitlab.mycompany.com/team/project')).toBe('team/project');
    });

    it('extracts slug from Azure DevOps URL', async () => {
      const { getRepoSlug } = await importConfig();
      expect(getRepoSlug('https://dev.azure.com/org/project/_git/repo')).toBe('org/project');
    });

    it('accepts explicit repo param over config default', async () => {
      const fs = await mockFs();
      const yaml = await mockYaml();
      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.readFileSync).mockReturnValue('ok' as any);
      vi.mocked(yaml.load).mockReturnValue({
        workspace: '/ws',
        repos: ['https://github.com/default/repo'],
        skills: [],
      });

      const { getRepoSlug } = await importConfig();
      expect(getRepoSlug('https://gitlab.com/other/repo')).toBe('other/repo');
    });
  });

  describe('getPlatform()', () => {
    it('returns github by default', async () => {
      const { getPlatform } = await importConfig();
      expect(getPlatform()).toBe('github');
    });

    it('returns configured platform', async () => {
      const fs = await mockFs();
      const yaml = await mockYaml();
      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.readFileSync).mockReturnValue('ok' as any);
      vi.mocked(yaml.load).mockReturnValue({
        workspace: '/ws',
        repos: [],
        skills: [],
        platform: 'gitlab',
      });

      const { getPlatform } = await importConfig();
      expect(getPlatform()).toBe('gitlab');
    });
  });

  describe('getDefaults()', () => {
    it('returns defaults from config', async () => {
      const fs = await mockFs();
      const yaml = await mockYaml();
      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.readFileSync).mockReturnValue('ok' as any);
      vi.mocked(yaml.load).mockReturnValue({
        workspace: '/ws',
        repos: [],
        skills: [],
        defaults: { dev_issue_mode: 'auto' },
      });

      const { getDefaults } = await importConfig();
      expect(getDefaults()).toEqual({ dev_issue_mode: 'auto' });
    });

    it('returns empty object when no defaults in config', async () => {
      const { getDefaults } = await importConfig();
      // Fallback config has defaults set
      expect(getDefaults()).toBeDefined();
    });
  });
});
