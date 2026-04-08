// GET /api/skills — list all installed skills, agents, and commands from ~/.claude/

import { NextResponse } from 'next/server';
import { readdir, readFile } from 'fs/promises';
import { join } from 'path';
import { homedir } from 'os';

const CLAUDE_DIR = join(homedir(), '.claude');

interface SkillEntry {
  name: string;
  category: 'skill' | 'agent' | 'command';
  content: string;
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

export async function GET() {
  const [skills, agents, commands] = await Promise.all([
    readEntries(join(CLAUDE_DIR, 'skills'), 'skill'),
    readEntries(join(CLAUDE_DIR, 'agents'), 'agent'),
    readEntries(join(CLAUDE_DIR, 'commands'), 'command'),
  ]);

  const all = [...commands, ...agents, ...skills];
  return NextResponse.json({ entries: all });
}
