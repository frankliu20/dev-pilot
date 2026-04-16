---
name: mod-java-telemetry-query
description: Query Azure Application Insights / Log Analytics traces for debugging and verification. Trigger when user asks to check logs, query traces, look at telemetry, or verify server-side behavior.
---

## Query Application Insights Traces

Run the `query-app-insights.sh` script to fetch recent traces from Azure Application Insights for the migration-ai resource. Useful for verifying MCP server behavior, debugging flow issues, and checking telemetry after manual testing.

### Prerequisites

- Azure CLI logged in (`az login`)
- `node` on PATH

### Usage

```bash
~/.claude/scripts/query-app-insights.sh              # default: last 20 minutes
~/.claude/scripts/query-app-insights.sh --minutes 30  # custom time window
~/.claude/scripts/query-app-insights.sh --session-id abc-123  # filter by session ID
```

### When to Use

- After Scenario 3c MCP server testing — verify traces were emitted
- User asks to "check logs", "query AI", "look at traces", "check telemetry"
- Debugging a migration or upgrade flow — check what operations were recorded
- Verifying a fix — confirm the error trace is gone

### Parameters

| Flag | Default | Description |
|------|---------|-------------|
| `--minutes N` | 20 | Query traces from the last N minutes |
| `--session-id ID` | (none) | Filter by `customDimensions.sessionId` |

### Output

A formatted table with columns:
- **Timestamp** — when the trace was recorded
- **Operation** — operation name (e.g., java-upgrade, java-assessment)
- **Key Properties** — filtered custom dimensions (excludes `common.*` and `_MS.*` prefixes)

### Configuration

The script queries against:
- **Resource**: `migration-ai` in `KustoCluster` resource group
- **Subscription**: `d51e3ffe-6b84-49cd-b426-0dc4ec660356`
- **Machine ID filter**: `e07f0303cfe7f77e835c140a24797c5ed65298eca330ff1eae1eb8bc31b1b2f0`

### Troubleshooting

- **"Not logged in"** — run `az login` first
- **"Query failed"** — check subscription access, resource may have been moved
- **"No traces found"** — increase `--minutes` window, or verify the MCP server was actually invoked
