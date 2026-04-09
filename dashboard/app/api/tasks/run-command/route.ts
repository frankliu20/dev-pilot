// POST /api/tasks/run-command — open a Claude CLI terminal running a slash command

import { NextRequest, NextResponse } from 'next/server';
import { openClaudeTerminal } from '@/lib/terminal';
import { CliTool } from '@/lib/types';

export async function POST(request: NextRequest) {
  const body = await request.json();
  const { command, prompt, cliTool = 'claude' } = body as {
    command?: string;
    prompt?: string;   // Full prompt (overrides command when provided)
    cliTool?: CliTool;
  };

  let customPrompt: string;
  let label: string;

  if (prompt && typeof prompt === 'string') {
    // Free-form prompt — pass through directly
    customPrompt = prompt.trim();
    label = customPrompt.length > 40 ? customPrompt.substring(0, 40) + '…' : customPrompt;
  } else if (command && typeof command === 'string') {
    // Slash command — validate name
    const cleaned = command.replace(/^\//, '').trim();
    if (!cleaned || !/^[a-zA-Z0-9-]+$/.test(cleaned)) {
      return NextResponse.json({ error: 'Invalid command name' }, { status: 400 });
    }
    customPrompt = `/${cleaned}`;
    label = `/${cleaned}`;
  } else {
    return NextResponse.json({ error: 'Missing command or prompt' }, { status: 400 });
  }

  console.log(`[tasks/run-command] Running: ${label} (tool=${cliTool})`);
  const termResult = openClaudeTerminal({
    customPrompt,
    tabTitle: `Claude: ${label}`,
    cliTool,
  });

  if (!termResult.success) {
    console.error(`[tasks/run-command] Failed to open terminal: ${termResult.error}`);
    return NextResponse.json(
      { success: false, error: termResult.error || 'Failed to spawn terminal' },
      { status: 500 },
    );
  }

  console.log(`[tasks/run-command] Terminal opened for: ${label}`);
  return NextResponse.json({
    success: true,
    message: `Claude opened — running ${label}`,
  });
}
