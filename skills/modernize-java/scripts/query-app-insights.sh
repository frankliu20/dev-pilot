#!/usr/bin/env bash
# Query Azure Application Insights traces for Java upgrade flow verification.
#
# Uses `az rest` (ARM endpoint) so bearer-token auth is handled automatically.
# Requires: az CLI logged in (`az login`), node on PATH.
#
# Usage:
#   ./query-app-insights.sh              # default: last 20 minutes
#   ./query-app-insights.sh --minutes 30 # custom time window
#   ./query-app-insights.sh --session-id <id> # filter by session ID

set -euo pipefail

# ── Defaults ──────────────────────────────────────────────────────────────────
MINUTES=20
SESSION_ID=""
RESOURCE_ID="/subscriptions/d51e3ffe-6b84-49cd-b426-0dc4ec660356/resourceGroups/KustoCluster/providers/microsoft.insights/components/migration-ai"
MACHINE_ID="e07f0303cfe7f77e835c140a24797c5ed65298eca330ff1eae1eb8bc31b1b2f0"
API_VERSION="2018-04-20"

# ── Parse args ────────────────────────────────────────────────────────────────
while [[ $# -gt 0 ]]; do
  case $1 in
    --minutes) MINUTES="$2"; shift 2 ;;
    --session-id) SESSION_ID="$2"; shift 2 ;;
    --help|-h)
      echo "Usage: $0 [--minutes N] [--session-id ID]"
      echo "  --minutes N      Query traces from the last N minutes (default: 20)"
      echo "  --session-id ID  Filter by customDimensions.sessionId"
      exit 0
      ;;
    *) echo "Unknown option: $1"; exit 1 ;;
  esac
done

# ── Pre-flight: check az login ────────────────────────────────────────────────
if ! az account show &>/dev/null; then
  echo "ERROR: Not logged in to Azure CLI. Run 'az login' first."
  exit 1
fi

# ── Build KQL query ──────────────────────────────────────────────────────────
SESSION_FILTER=""
if [[ -n "$SESSION_ID" ]]; then
  SESSION_FILTER="| where tostring(customDimensions['sessionId']) == '${SESSION_ID}'"
fi

read -r -d '' KQL_QUERY <<-EOKQL || true
traces
| where timestamp > ago(${MINUTES}min)
| where tostring(customDimensions['common.vscodemachineid']) == '${MACHINE_ID}'
${SESSION_FILTER}
| project operation_Name, timestamp, customDimensions
| order by timestamp desc
EOKQL

# Collapse to single line for JSON body
KQL_ONELINE=$(echo "$KQL_QUERY" | tr '\n' ' ' | sed 's/  */ /g')

# ── Execute query via ARM REST API ────────────────────────────────────────────
URL="https://management.azure.com${RESOURCE_ID}/query?api-version=${API_VERSION}"

RESULT=$(az rest --method post \
  --url "$URL" \
  --body "{\"query\":\"${KQL_ONELINE}\"}" \
  2>&1) || {
  echo "ERROR: Query failed:"
  echo "$RESULT"
  exit 1
}

# ── Format output with Node.js ────────────────────────────────────────────────
echo "$RESULT" | node -e "
const data = JSON.parse(require('fs').readFileSync(0, 'utf8'));
const table = data.tables && data.tables[0];

if (!table || !table.rows || table.rows.length === 0) {
  console.log('No traces found in the last ${MINUTES} minutes.');
  process.exit(0);
}

const colIdx = {};
table.columns.forEach((c, i) => { colIdx[c.name] = i; });

console.log('Found ' + table.rows.length + ' trace(s) in the last ${MINUTES} minutes:\n');

// Header
const hdr = ['Timestamp', 'Operation', 'Key Properties'];
const widths = [19, 40, 60];
console.log(hdr.map((h, i) => h.padEnd(widths[i])).join(' | '));
console.log(widths.map(w => '-'.repeat(w)).join('-+-'));

for (const row of table.rows) {
  const ts = (row[colIdx['timestamp']] || '').substring(0, 19).replace('T', ' ');
  const op = (row[colIdx['operation_Name']] || '-').substring(0, widths[1]);

  let dims = {};
  try { dims = typeof row[colIdx['customDimensions']] === 'string'
    ? JSON.parse(row[colIdx['customDimensions']])
    : row[colIdx['customDimensions']] || {};
  } catch (_) {}

  // Show interesting dimensions (skip common.* and _MS.*)
  const useful = Object.entries(dims)
    .filter(([k]) => !k.startsWith('common.') && !k.startsWith('_MS.'))
    .slice(0, 4)
    .map(([k, v]) => k + '=' + String(v).substring(0, 30))
    .join(', ');

  console.log(
    ts.padEnd(widths[0]) + ' | ' +
    op.padEnd(widths[1]) + ' | ' +
    useful.substring(0, widths[2])
  );
}
"
