// Open a terminal window running claude for a given issue

import { spawn } from 'child_process';
import { join } from 'path';

const HOME = process.env.HOME || process.env.USERPROFILE || '';
const REPO_PATH = process.env.REPO_PATH || join(HOME, 'claude', 'ws1', 'azure-java-migration-copilot-vscode-extension');

export function openClaudeTerminal(issueUrl: string): { success: boolean; message?: string; error?: string } {
  const platform = process.platform;

  // claude accepts a prompt as argument: claude [options] [prompt]
  // This starts an interactive session with the prompt auto-submitted
  const prompt = `/mod-dev-issue ${issueUrl}`;
  const claudeCmd = `cd /d "${REPO_PATH}" && claude --dangerously-skip-permissions "${prompt}"`;

  try {
    if (platform === 'win32') {
      // Windows Terminal (wt.exe) — open new tab with title
      try {
        spawn('wt.exe', [
          'new-tab',
          '--title', `Claude: #${issueUrl.split('/').pop() || 'task'}`,
          'cmd', '/k', claudeCmd,
        ], {
          detached: true,
          stdio: 'ignore',
        }).unref();
      } catch {
        // Fallback: regular cmd window
        spawn('cmd', ['/c', 'start', `Claude #${issueUrl.split('/').pop()}`, 'cmd', '/k', claudeCmd], {
          detached: true,
          stdio: 'ignore',
        }).unref();
      }
    } else if (platform === 'darwin') {
      const escaped = claudeCmd.replace(/"/g, '\\"');
      const script = `tell application "Terminal" to do script "${escaped}"`;
      spawn('osascript', ['-e', script], { detached: true, stdio: 'ignore' }).unref();
    } else {
      for (const term of ['gnome-terminal', 'xterm', 'konsole']) {
        try {
          spawn(term, ['--', 'bash', '-c', claudeCmd], { detached: true, stdio: 'ignore' }).unref();
          break;
        } catch { continue; }
      }
    }

    return {
      success: true,
      message: `Terminal opened — Claude is running /mod-dev-issue for #${issueUrl.split('/').pop()}`,
    };
  } catch (err) {
    return { success: false, error: `Failed to open terminal: ${err}` };
  }
}
