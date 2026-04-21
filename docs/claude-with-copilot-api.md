# Using Claude Code with Copilot API Proxy

This guide explains how to run Claude Code through [copilot-api](https://www.npmjs.com/package/copilot-api), which proxies Anthropic API requests through your GitHub Copilot subscription.

## Prerequisites

- Node.js 18+
- An active GitHub Copilot subscription
- Claude Code CLI installed

## Step 1: Start the Copilot API proxy

```bash
npx copilot-api@latest start
```

This starts a local proxy server on `http://localhost:4141` that translates Anthropic API calls into GitHub Copilot API calls.

## Step 2: Configure Claude Code settings

Edit `~/.claude/settings.json` to route Claude Code traffic through the proxy:

```jsonc
{
  "env": {
    // Point Claude Code to the local proxy
    "ANTHROPIC_BASE_URL": "http://localhost:4141",
    // The proxy handles auth — any non-empty value works
    "ANTHROPIC_AUTH_TOKEN": "dummy",
    // Choose your preferred model
    "ANTHROPIC_MODEL": "claude-sonnet-4-20250514",
    // Optional: route all model tiers through the same model
    "ANTHROPIC_DEFAULT_SONNET_MODEL": "claude-sonnet-4-20250514",
    "ANTHROPIC_SMALL_FAST_MODEL": "claude-sonnet-4-20250514",
    "ANTHROPIC_DEFAULT_HAIKU_MODEL": "claude-sonnet-4-20250514",
    // Optional: reduce unnecessary API calls
    "DISABLE_NON_ESSENTIAL_MODEL_CALLS": "1",
    "CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC": "1"
  }
}
```

### Key settings explained

| Variable | Purpose |
|---|---|
| `ANTHROPIC_BASE_URL` | Redirects all API calls to the local copilot-api proxy |
| `ANTHROPIC_AUTH_TOKEN` | Required by Claude Code but not used by the proxy — set to any non-empty string |
| `ANTHROPIC_MODEL` | The Claude model to use (e.g. `claude-sonnet-4-20250514`, `claude-opus-4-20250514`) |
| `DISABLE_NON_ESSENTIAL_MODEL_CALLS` | Prevents background calls that consume extra quota |
| `CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC` | Further reduces non-essential network requests |

## Step 3: Enable bypass permissions mode (recommended)

By default, Claude Code prompts for permission on every file edit, shell command, etc. For a smoother experience, enable **bypass mode** so Claude can act autonomously without constant confirmations.

Add the `permissions` block to `~/.claude/settings.json`:

```jsonc
{
  "env": {
    // ... (copilot-api settings from Step 2)
  },
  "permissions": {
    "defaultMode": "bypassPermissions",
    "skipDangerousModePermissionPrompt": true
  }
}
```

| Setting | Purpose |
|---|---|
| `defaultMode: "bypassPermissions"` | Skips all tool-level permission prompts — Claude can read/write files, run shell commands, etc. without asking |
| `skipDangerousModePermissionPrompt` | Suppresses the one-time warning dialog when entering bypass mode |

> **Note**: Bypass mode gives Claude full access to your local environment. Only enable this if you trust the commands and workflows being executed. You can also use a more granular approach by adding specific patterns to `permissions.allow` instead — see the [Configuration Guide](configuration.md) for details.

## Step 4: Run Claude Code

With the proxy running, start Claude Code as usual:

```bash
claude
```

All requests will be routed through copilot-api automatically.

## Troubleshooting

- **Proxy not responding**: Ensure `npx copilot-api@latest start` is running in a separate terminal.
- **Authentication errors**: Make sure you are logged into GitHub CLI (`gh auth status`) and have an active Copilot subscription.
- **Model not available**: Not all Claude models may be available through Copilot. Try a different model name if you get errors.
