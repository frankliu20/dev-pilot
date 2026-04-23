// GET /api/gh-account — list authenticated GitHub accounts
// POST /api/gh-account — switch active account

import { NextRequest, NextResponse } from 'next/server';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

interface GHAccount {
  user: string;
  host: string;
  active: boolean;
}

/** Parse `gh auth status` output into structured accounts */
function parseAuthStatus(output: string): GHAccount[] {
  const accounts: GHAccount[] = [];
  let currentHost = 'github.com';

  const lines = output.split('\n');
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Host line: "github.com" (no leading spaces)
    const hostMatch = line.match(/^(\S+\.\S+)\s*$/);
    if (hostMatch) {
      currentHost = hostMatch[1];
      continue;
    }

    // Account line: "✓ Logged in to github.com account frankliu20 (keyring)"
    const accountMatch = line.match(/account (\S+?)[\s(]/);
    if (accountMatch && line.includes('Logged in')) {
      accounts.push({ user: accountMatch[1], host: currentHost, active: false });
      continue;
    }

    // Active line: "- Active account: true"
    const activeMatch = line.match(/Active account:\s*(true|false)/);
    if (activeMatch && accounts.length > 0) {
      accounts[accounts.length - 1].active = activeMatch[1] === 'true';
    }
  }

  return accounts;
}

export async function GET() {
  try {
    // gh auth status may write to stderr or stdout depending on version/platform
    const result = await execAsync('gh auth status', {
      encoding: 'utf-8',
      timeout: 10000,
    });
    const output = result.stderr || result.stdout;
    const accounts = parseAuthStatus(output);
    return NextResponse.json({ accounts });
  } catch (err: any) {
    // gh auth status may exit with non-zero but still output account info
    const output = err.stderr || err.stdout || '';
    const accounts = parseAuthStatus(output);
    if (accounts.length > 0) {
      return NextResponse.json({ accounts });
    }
    console.error('[gh-account] Failed to get auth status:', err);
    return NextResponse.json({ accounts: [], error: 'Failed to get GitHub auth status' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const { user } = await request.json();
    if (!user || typeof user !== 'string') {
      return NextResponse.json({ error: 'Missing or invalid "user" field' }, { status: 400 });
    }

    await execAsync(`gh auth switch --user ${user}`, {
      encoding: 'utf-8',
      timeout: 10000,
    });

    // Return updated account list
    try {
      const { stderr } = await execAsync('gh auth status', { encoding: 'utf-8', timeout: 10000 });
      const accounts = parseAuthStatus(stderr);
      return NextResponse.json({ accounts });
    } catch (statusErr: any) {
      const accounts = parseAuthStatus(statusErr.stderr || '');
      return NextResponse.json({ accounts });
    }
  } catch (err: any) {
    console.error('[gh-account] Failed to switch account:', err);
    return NextResponse.json({ error: 'Failed to switch GitHub account' }, { status: 500 });
  }
}
