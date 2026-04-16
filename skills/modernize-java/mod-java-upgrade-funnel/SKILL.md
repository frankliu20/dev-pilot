---
name: mod-java-upgrade-funnel
description: Analyze the Java upgrade funnel (precheck -> plan -> execution -> commit -> validation). Runs automated Kusto queries and produces a structured drop-off report with root cause analysis. Trigger when user asks to analyze upgrade funnel, check upgrade conversion, upgrade drop-off analysis, or upgrade funnel metrics.
---

## Upgrade Funnel Analysis

Run the `funnel-analysis.py` script to automatically query Kusto telemetry and produce a structured upgrade funnel report with root cause analysis.

### Prerequisites

- Azure CLI logged in (`az login`) with access to the `ama4j.westus2.kusto.windows.net` Kusto cluster
- Python 3 with `azure-kusto-data` and `azure-identity` packages installed

### Usage

```bash
python ~/.claude/scripts/funnel-analysis.py                         # default: 28 days, all versions
python ~/.claude/scripts/funnel-analysis.py --days 14               # last 14 days
python ~/.claude/scripts/funnel-analysis.py --version 1.15.3        # specific extension version
python ~/.claude/scripts/funnel-analysis.py --output report.md      # save to file
python ~/.claude/scripts/funnel-analysis.py --database mydb         # custom database name
```

### Parameters

| Flag | Default | Description |
|------|---------|-------------|
| `--days N` | 28 | Time window in days |
| `--version VER` | (none) | Filter by extension version (e.g., `1.15.3`) |
| `--output FILE` | (none) | Write report to file (default: stdout) |
| `--database DB` | `bi` | Kusto database name |
| `--cluster URL` | `https://ama4j.westus2.kusto.windows.net` | Kusto cluster URL |

### Output

A structured markdown report with:

1. **Executive Summary** — overall conversion rate, top 3 findings
2. **Funnel Overview** — step-by-step user counts and conversion rates
3. **Root Cause #1: Plan Quality by Model** — three-layer funnel (Generated → Reviewed → Confirmed) per model
4. **Root Cause #2: Execution Success** — breakdown of zero-step sessions, cross-model analysis
5. **Root Cause #3: Plan Generation Latency** — P50/P75/P90 by model, speed vs quality tradeoff
6. **Validation Metrics** — build/test/CVE trigger rates and success rates
7. **User Retention** — do abandoned users return?

### When to Use

- Periodic funnel health check (e.g., after a release)
- Comparing funnel metrics before/after a change
- Investigating user drop-off in specific stages
- Preparing data for sprint planning or team reviews

### Troubleshooting

- **"Not logged in"** — run `az login` first
- **"Database not found"** — try `--database Copilot` or `--database telemetry`
- **"Function not found"** — the `java_upgrade_raw_events_non_us` function may have been renamed; check with the telemetry team
- **Timeout** — some queries scan large datasets; try reducing `--days`
