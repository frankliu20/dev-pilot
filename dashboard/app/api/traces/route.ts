// GET /api/traces — query Application Insights traces via ARM REST API
//
// Uses `az account get-access-token` for auth, then calls the ARM endpoint
// directly with fetch. No more shell-quoting issues.
//
// Mirrors scripts/query-app-insights.sh — same KQL, same field names.
//
// Query params:
//   minutes   — time window (default: 60)
//   sessionId — optional customDimensions.sessionId filter

import { NextRequest, NextResponse } from 'next/server';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

const RESOURCE_ID =
  '/subscriptions/d51e3ffe-6b84-49cd-b426-0dc4ec660356/resourceGroups/KustoCluster/providers/microsoft.insights/components/migration-ai';
const MACHINE_ID =
  'e07f0303cfe7f77e835c140a24797c5ed65298eca330ff1eae1eb8bc31b1b2f0';
const API_VERSION = '2018-04-20';

interface TraceRow {
  timestamp: string;
  operation: string;
  properties: Record<string, string>;
  customDimensions: Record<string, unknown>;
}

/** Get a bearer token for ARM via az CLI */
async function getAccessToken(): Promise<string> {
  const { stdout } = await execAsync(
    'az account get-access-token --resource https://management.azure.com --query accessToken -o tsv',
    { timeout: 15000 },
  );
  return stdout.trim();
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const minutes = parseInt(searchParams.get('minutes') || '60', 10) || 60;
  const sessionId = searchParams.get('sessionId')?.trim() || '';
  console.log(`[traces] Querying traces: last ${minutes}min${sessionId ? `, session=${sessionId}` : ''}`);

  // Build KQL — match scripts/query-app-insights.sh exactly
  let kql = `traces | where timestamp > ago(${minutes}min)`;
  kql += ` | where tostring(customDimensions['common.vscodemachineid']) == '${MACHINE_ID}'`;
  if (sessionId) {
    // field name is 'sessionId', not 'common.vscodesessionid'
    kql += ` | where tostring(customDimensions['sessionId']) == '${sessionId}'`;
  }
  kql += ` | project operation_Name, timestamp, customDimensions`;
  kql += ` | order by timestamp desc`;

  const url = `https://management.azure.com${RESOURCE_ID}/query?api-version=${API_VERSION}`;

  try {
    // Get bearer token from az CLI
    const token = await getAccessToken();

    // Call ARM REST API directly with fetch — no shell quoting needed
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ query: kql }),
    });

    if (!res.ok) {
      const errText = await res.text().catch(() => '');
      return NextResponse.json(
        { error: `ARM API returned ${res.status}: ${errText.substring(0, 200)}` },
        { status: 502 },
      );
    }

    const data = await res.json();
    const table = data.tables?.[0];

    if (!table?.rows?.length) {
      return NextResponse.json({ traces: [], count: 0 });
    }

    // Build column index
    const colIdx: Record<string, number> = {};
    table.columns.forEach((c: { name: string }, i: number) => {
      colIdx[c.name] = i;
    });

    const traces: TraceRow[] = table.rows.map((row: unknown[]) => {
      const ts = (row[colIdx['timestamp']] as string) || '';
      const op = (row[colIdx['operation_Name']] as string) || '-';

      let dims: Record<string, unknown> = {};
      try {
        const raw = row[colIdx['customDimensions']];
        dims = typeof raw === 'string' ? JSON.parse(raw) : (raw as Record<string, unknown>) || {};
      } catch { /* ignore */ }

      // Filter out common.* and _MS.* boilerplate
      const properties: Record<string, string> = {};
      for (const [k, v] of Object.entries(dims)) {
        if (!k.startsWith('common.') && !k.startsWith('_MS.')) {
          properties[k] = String(v);
        }
      }

      return {
        timestamp: ts,
        operation: op,
        properties,
        customDimensions: dims,
      };
    });

    console.log(`[traces] Returning ${traces.length} traces`);
    return NextResponse.json({ traces, count: traces.length });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes('az') && (msg.includes('not found') || msg.includes('not recognized'))) {
      return NextResponse.json(
        { error: 'Azure CLI not found. Install az CLI and run `az login`.' },
        { status: 500 },
      );
    }
    if (msg.includes('Please run') || msg.includes('az login') || msg.includes('AADSTS')) {
      return NextResponse.json(
        { error: 'Not logged in to Azure CLI. Run `az login` first.' },
        { status: 401 },
      );
    }
    return NextResponse.json(
      { error: `Query failed: ${msg.substring(0, 200)}` },
      { status: 500 },
    );
  }
}
