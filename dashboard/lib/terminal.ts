// Open a terminal window running claude for a given issue

import { spawn } from 'child_process';
import { join } from 'path';

import { TestScenario, CliTool, CLI_TOOL_CONFIG } from './types';
import { getRepo, getWorkspace } from './config';

/** Get local repo path. If a GitHub URL is provided, extract the repo name from it. */
function getRepoPath(githubUrl?: string): string {
  if (process.env.REPO_PATH) return process.env.REPO_PATH;
  const ws = getWorkspace();
  // Try to extract repo name from GitHub URL (e.g., .../org/repo-name/issues/123)
  if (githubUrl) {
    const m = githubUrl.match(/github\.com\/[^/]+\/([^/]+)/);
    if (m) return join(ws, m[1]);
  }
  // Fall back to primary repo
  return join(ws, getRepo().split('/').pop() || '');
}

export interface TerminalResult {
  success: boolean;
  message?: string;
  error?: string;
}

export interface TerminalOptions {
  issueUrl?: string;
  mode?: 'normal' | 'auto';
  testScenario?: TestScenario;  // Test scenario: vscode (3a) or intellij (3b) or mcp-server (3c)
  customPrompt?: string;        // Full prompt to pass to cli tool (overrides issueUrl/mode)
  tabTitle?: string;             // Terminal tab title
  cliTool?: CliTool;             // CLI tool to use (default: 'claude')
}

export function openClaudeTerminal(issueUrlOrOpts: string | TerminalOptions, mode: 'normal' | 'auto' = 'normal'): TerminalResult {
  const platform = process.platform;

  let prompt: string;
  let tabTitle: string;
  let cliTool: CliTool = 'claude';

  if (typeof issueUrlOrOpts === 'string') {
    // Legacy call: openClaudeTerminal(issueUrl, mode)
    const issueUrl = issueUrlOrOpts;
    const autoFlag = mode === 'auto' ? ' --auto' : '';
    prompt = `/pilot-dev-issue${autoFlag} ${issueUrl}`;
    tabTitle = `Claude: #${issueUrl.split('/').pop() || 'task'}`;
  } else {
    // New call: openClaudeTerminal({ customPrompt, tabTitle, ... })
    const opts = issueUrlOrOpts;
    cliTool = opts.cliTool || 'claude';
    if (opts.customPrompt) {
      prompt = opts.customPrompt;
    } else if (opts.issueUrl) {
      const autoFlag = (opts.mode || 'normal') === 'auto' ? ' --auto' : '';
      const scenarioFlag = opts.testScenario ? ` --test-scenario ${opts.testScenario}` : '';
      prompt = `/pilot-dev-issue${autoFlag}${scenarioFlag} ${opts.issueUrl}`;
    } else {
      return { success: false, error: 'No issueUrl or customPrompt provided' };
    }
    const config = CLI_TOOL_CONFIG[cliTool];
    tabTitle = opts.tabTitle || `${config.displayName}: task`;
  }

  const config = CLI_TOOL_CONFIG[cliTool];
  // Sanitize prompt for shell: collapse newlines to spaces, escape inner double quotes
  const safePrompt = prompt.replace(/[\r\n]+/g, ' ').replace(/"/g, '\\"');
  // Extract GitHub URL from prompt to determine correct repo cwd
  const ghUrlMatch = prompt.match(/https:\/\/github\.com\/[^\s"]+/);
  const repoPath = getRepoPath(ghUrlMatch?.[0]);
  const cliCmd = `cd /d "${repoPath}" && ${config.binary} ${config.args(safePrompt)}`;

  try {
    if (platform === 'win32') {
      try {
        spawn('wt.exe', [
          'new-tab',
          '--title', tabTitle,
          'cmd', '/k', cliCmd,
        ], {
          detached: true,
          stdio: 'ignore',
        }).unref();
      } catch {
        spawn('cmd', ['/c', 'start', tabTitle, 'cmd', '/k', cliCmd], {
          detached: true,
          stdio: 'ignore',
        }).unref();
      }
    } else if (platform === 'darwin') {
      const escaped = cliCmd.replace(/"/g, '\\"');
      const script = `tell application "Terminal" to do script "${escaped}"`;
      spawn('osascript', ['-e', script], { detached: true, stdio: 'ignore' }).unref();
    } else {
      for (const term of ['gnome-terminal', 'xterm', 'konsole']) {
        try {
          spawn(term, ['--', 'bash', '-c', cliCmd], { detached: true, stdio: 'ignore' }).unref();
          break;
        } catch { continue; }
      }
    }

    return {
      success: true,
      message: `Terminal opened — ${config.displayName} is running`,
    };
  } catch (err) {
    return { success: false, error: `Failed to open terminal: ${err}` };
  }
}
