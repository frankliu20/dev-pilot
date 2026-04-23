import { describe, it, expect, vi } from 'vitest';
import { NextRequest } from 'next/server';

vi.mock('fs/promises', () => ({
  readdir: vi.fn(),
  readFile: vi.fn(),
}));

vi.mock('os', () => ({
  homedir: vi.fn().mockReturnValue('/home/testuser'),
}));

import { GET } from '@/app/api/skills/route';
import { readdir, readFile } from 'fs/promises';

function createRequest(): NextRequest {
  return new NextRequest(new URL('/api/skills', 'http://localhost:3000'));
}

describe('GET /api/skills', () => {
  it('returns categorized entries', async () => {
    // Mock readdir to return different items per directory
    vi.mocked(readdir).mockImplementation(async (dir: unknown) => {
      const path = String(dir);
      if (path.includes('skills')) {
        return [
          { name: 'my-skill', isDirectory: () => true, isFile: () => false },
        ] as unknown as import('fs').Dirent[];
      }
      if (path.includes('agents')) {
        return [
          { name: 'my-agent.md', isDirectory: () => false, isFile: () => true },
        ] as unknown as import('fs').Dirent[];
      }
      if (path.includes('commands')) {
        return [
          { name: 'my-command.md', isDirectory: () => false, isFile: () => true },
        ] as unknown as import('fs').Dirent[];
      }
      return [];
    });

    vi.mocked(readFile).mockResolvedValue('# Some content');

    const res = await GET(createRequest());
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.entries).toHaveLength(3);

    const categories = body.entries.map((e: { category: string }) => e.category);
    expect(categories).toContain('skill');
    expect(categories).toContain('agent');
    expect(categories).toContain('command');
  });

  it('handles missing directories gracefully', async () => {
    vi.mocked(readdir).mockRejectedValue(new Error('ENOENT'));

    const res = await GET(createRequest());
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.entries).toHaveLength(0);
  });

  it('reads SKILL.md from subdirectories for skills', async () => {
    vi.mocked(readdir).mockImplementation(async (dir: unknown) => {
      const path = String(dir);
      if (path.includes('skills')) {
        return [
          { name: 'test-skill', isDirectory: () => true, isFile: () => false },
        ] as unknown as import('fs').Dirent[];
      }
      return [];
    });

    vi.mocked(readFile).mockResolvedValue('# Test Skill Content');

    const res = await GET(createRequest());
    const body = await res.json();

    const skillEntry = body.entries.find((e: { category: string }) => e.category === 'skill');
    expect(skillEntry).toBeDefined();
    expect(skillEntry.name).toBe('test-skill');
    expect(skillEntry.content).toBe('# Test Skill Content');

    // Verify readFile was called with the SKILL.md path
    expect(readFile).toHaveBeenCalledWith(
      expect.stringContaining('SKILL.md'),
      'utf-8',
    );
  });

  it('skips skill subdirectories without SKILL.md', async () => {
    vi.mocked(readdir).mockImplementation(async (dir: unknown) => {
      const path = String(dir);
      if (path.includes('skills')) {
        return [
          { name: 'broken-skill', isDirectory: () => true, isFile: () => false },
        ] as unknown as import('fs').Dirent[];
      }
      return [];
    });

    vi.mocked(readFile).mockRejectedValue(new Error('ENOENT'));

    const res = await GET(createRequest());
    const body = await res.json();

    expect(body.entries).toHaveLength(0);
  });

  it('entries are ordered: commands, agents, skills', async () => {
    vi.mocked(readdir).mockImplementation(async (dir: unknown) => {
      const path = String(dir);
      if (path.includes('skills')) {
        return [
          { name: 'skill-a', isDirectory: () => true, isFile: () => false },
        ] as unknown as import('fs').Dirent[];
      }
      if (path.includes('agents')) {
        return [
          { name: 'agent-b.md', isDirectory: () => false, isFile: () => true },
        ] as unknown as import('fs').Dirent[];
      }
      if (path.includes('commands')) {
        return [
          { name: 'cmd-c.md', isDirectory: () => false, isFile: () => true },
        ] as unknown as import('fs').Dirent[];
      }
      return [];
    });

    vi.mocked(readFile).mockResolvedValue('content');

    const res = await GET(createRequest());
    const body = await res.json();

    // Order should be commands, agents, skills (as per source: [...commands, ...agents, ...skills])
    expect(body.entries[0].category).toBe('command');
    expect(body.entries[1].category).toBe('agent');
    expect(body.entries[2].category).toBe('skill');
  });
});
