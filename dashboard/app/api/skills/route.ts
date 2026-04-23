// GET /api/skills — list all installed skills, agents, and commands
// Reads commands from ~/.claude/ or ~/.copilot/ based on platform query param or pilot.yaml config

import { NextRequest, NextResponse } from 'next/server';
import { readdir, readFile } from 'fs/promises';
import { join } from 'path';
import { homedir } from 'os';

import { getAiPlatform } from '@/lib/config';

const CLAUDE_DIR = join(homedir(), '.claude');
const COPILOT_DIR = join(homedir(), '.copilot');

// Disable Next.js route caching — data depends on filesystem and query params
export const dynamic = 'force-dynamic';

interface SkillEntry {
  name: string;
  category: 'skill' | 'agent' | 'command';
  content: string;
  personal?: boolean;
}

async function readEntries(dir: string, category: SkillEntry['category']): Promise<SkillEntry[]> {
  const entries: SkillEntry[] = [];
  try {
    const items = await readdir(dir, { withFileTypes: true });
    for (const item of items) {
      let content = '';
      let name = '';
      if (item.isDirectory()) {
        // skills/<name>/SKILL.md pattern
        const mdPath = join(dir, item.name, 'SKILL.md');
        try {
          content = await readFile(mdPath, 'utf-8');
          name = item.name;
        } catch { continue; }
      } else if (item.isFile() && item.name.endsWith('.md')) {
        // agents/<name>.md or commands/<name>.md pattern
        content = await readFile(join(dir, item.name), 'utf-8');
        name = item.name.replace(/\.md$/, '');
      }
      if (name && content) {
        entries.push({ name, category, content });
      }
    }
  } catch { /* dir doesn't exist */ }
  return entries;
}

export async function GET(request: NextRequest) {
  // Determine platform: query param > pilot.yaml config
  const platformParam = request.nextUrl.searchParams.get('platform');
  const isCopilot = platformParam === 'copilot' || (!platformParam && getAiPlatform() === 'copilot-cli');

  // Read everything from the selected platform's directory
  const baseDir = isCopilot ? COPILOT_DIR : CLAUDE_DIR;

  console.log(`[skills] Loading skills, agents, and commands (platform: ${isCopilot ? 'copilot' : 'claude'}, base: ${baseDir})`);
  const [skills, agents, commands] = await Promise.all([
    readEntries(join(baseDir, 'skills'), 'skill'),
    readEntries(join(baseDir, 'agents'), 'agent'),
    readEntries(join(baseDir, 'commands'), 'command'),
  ]);

  // Detect personal skills by scanning the personal-skills/ directory in the project root
  const personalSkillsDir = join(process.cwd(), '..', 'personal-skills');
  const personalNames = new Set<string>();
  try {
    const items = await readdir(personalSkillsDir, { withFileTypes: true });
    for (const item of items) {
      if (item.isDirectory()) personalNames.add(item.name);
    }
  } catch { /* personal-skills/ dir not found — ok */ }

  for (const skill of skills) {
    if (personalNames.has(skill.name)) skill.personal = true;
  }

  const all = [...commands, ...agents, ...skills];
  console.log(`[skills] Found ${commands.length} commands, ${agents.length} agents, ${skills.length} skills (${personalNames.size} personal)`);
  return NextResponse.json({ entries: all });
}
