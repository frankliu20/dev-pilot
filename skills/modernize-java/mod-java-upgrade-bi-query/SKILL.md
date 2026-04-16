---
name: mod-java-upgrade-bi-query
description: Query and analyze Java upgrade telemetry data via Kusto. Supports ad-hoc KQL queries, data exploration, and BI analysis. Trigger when user asks to query upgrade telemetry, analyze upgrade data, check upgrade metrics, explore upgrade events, or run KQL on upgrade data.
---

## Java Upgrade BI Query

Run arbitrary KQL queries against Java upgrade telemetry and analyze results. Use this for any data analysis task on the upgrade pipeline — funnel analysis, error investigation, feature adoption, user behavior, A/B comparisons, etc.

For **automated funnel analysis specifically**, use `/mod-java-funnel-analysis` instead.

### How to run queries

```bash
# Inline query
python ~/.claude/scripts/kusto-query.py "YOUR_KQL_HERE"

# Query from file
python ~/.claude/scripts/kusto-query.py --file query.kql

# Output as JSON (for further processing)
python ~/.claude/scripts/kusto-query.py --json "YOUR_KQL_HERE"

# Output as CSV
python ~/.claude/scripts/kusto-query.py --csv "YOUR_KQL_HERE"

# Save to file
python ~/.claude/scripts/kusto-query.py --output results.md "YOUR_KQL_HERE"
```

**Default connection**: cluster `https://ama4j.westus2.kusto.windows.net`, database `bi`.

### Prerequisites

- Azure CLI logged in (`az login`)
- Python packages: `azure-kusto-data`, `azure-identity`

---

### Data Schema Reference

#### Primary function: `java_upgrade_raw_events_non_us`

This is the main data access function. It filters to non-US Java upgrade telemetry.

**Signature**:
```kusto
java_upgrade_raw_events_non_us(start: datetime, end: datetime, eventNames: dynamic)
```

**Usage pattern**:
```kusto
let start = ago(28d);
let end = now();
java_upgrade_raw_events_non_us(start, end, dynamic(["event.name1", "event.name2"]))
| where ...
| summarize ...
```

#### Key columns returned

| Column | Type | Description |
|--------|------|-------------|
| `ServerTimestamp` | datetime | When the event was recorded |
| `DevDeviceId` | string | Unique device/user identifier (use for user-level dcount) |
| `ModernizationSessionId` | string | Unique upgrade session (one user can have many sessions) |
| `IdeSessionId` | string | IDE session identifier |
| `EventShortName` | string | The event name (e.g., "upgrade.precheckcompleted") |
| `Properties` | dynamic | Event-specific properties (JSON bag) |
| `Platform` | string | Client platform (e.g., "vscode-extension", "intellij-plugin") |
| `DistributionVersion` | string | Extension version |
| `GeoCountryRegion` | string | User's country/region |

#### Upgrade flow events (in pipeline order)

| Event | Description | Key Properties |
|-------|-------------|----------------|
| `upgrade.precheckcompleted` | Precheck finished | `status` ("succeeded"/"failed") |
| `upgrade.plangenerationstarted` | Plan generation kicked off | `modelid` |
| `upgrade.planinitialized` | Plan successfully generated | `modelid`, `status` |
| `upgrade.planreviewed` | User viewed the plan | |
| `upgrade.planconfirmed` | User confirmed the plan | |
| `upgrade.planexecutionstarted` | Code changes started | `modelid` |
| `upgrade.upgradestepstarted` | Individual step started | |
| `upgrade.upgradestepcompleted` | Individual step finished | `status` ("succeeded"/"failed") |
| `upgrade.planexecutioncompleted` | Execution flow finished | |
| `upgrade.testcompleted` | Test run completed | `status` ("succeeded"/"failed") |

#### Validation tool events

| Event | Description | Key Properties |
|-------|-------------|----------------|
| `project.state.buildresult` | Build result | `modulesbuildresult` (JSON array), `numoferrors`, `recordat` |
| `validatecvesforjava.start` / `.end` | CVE check (old name) | `cve.high`, `cve.critical`, `cve.medium` |
| `appmod-validate-cves-for-java.start` / `.end` | CVE check (new name) | same as above |
| `runtestsforjava.start` / `.end` | Unit test (old name) | `result` ("succeeded"/"failed") |
| `appmod-run-tests-for-java.start` / `.end` | Unit test (new name) | same as above |

#### Version control events (separate table)

```kusto
cluster('https://ddtelfiltered.centralus.kusto.windows.net/').database('Copilot').table('RawEventsTraces')
| where operation_Name == "java/migrateassistant/versioncontrol/commit"
```

Key customDimensions: `buildtool`, `javaversion`, `callertype` (Platform), `devdeviceid`, `callerversion`, `callersessionid`, `sessionid`/`correlationid`

#### Common Properties fields

| Field path | Found in | Values |
|------------|----------|--------|
| `Properties["status"]` | precheck, planinitialized, stepcompleted, testcompleted | "succeeded", "failed" |
| `Properties["modelid"]` | plangenerationstarted, planinitialized, planexecutionstarted | "auto", "claude-sonnet-4.6", "gpt-5.3-codex", etc. |
| `Properties["common.extversion"]` | all events | Extension version string (e.g., "1.15.3") |
| `Properties["result"]` | test end events | "succeeded", "failed" |
| `Properties["recordat"]` | buildresult | "tool.precheck" (filter out for post-upgrade builds) |
| `Properties["numoferrors"]` | buildresult | integer |
| `Properties["modulesbuildresult"]` | buildresult | JSON array of [moduleId, {numOfJavaFiles, numOfClassFiles}] |
| `Properties["cve.high"]`, `["cve.critical"]`, `["cve.medium"]` | CVE end events | CVE counts |

---

### Common query patterns

#### User-level metric (deduplicated by device)
```kusto
java_upgrade_raw_events_non_us(ago(28d), now(), dynamic(["upgrade.precheckcompleted"]))
| where tostring(Properties["status"]) == "succeeded"
| summarize Users = dcount(DevDeviceId)
```

#### Session-level metric
```kusto
java_upgrade_raw_events_non_us(ago(28d), now(), dynamic(["upgrade.planinitialized"]))
| summarize Sessions = dcount(ModernizationSessionId)
```

#### Filter by version
```kusto
| where tostring(Properties["common.extversion"]) == "1.15.3"
```

#### Filter by model
```kusto
| extend modelId = tostring(Properties["modelid"])
| where modelId == "claude-sonnet-4.6"
```

#### Join sessions across events
```kusto
let eventA = java_upgrade_raw_events_non_us(ago(28d), now(), dynamic(["event.a"])) | distinct ModernizationSessionId;
let eventB = java_upgrade_raw_events_non_us(ago(28d), now(), dynamic(["event.b"])) | distinct ModernizationSessionId;
eventA
| extend HasB = iff(ModernizationSessionId in (eventB), true, false)
| summarize Total = count(), WithB = countif(HasB)
```

#### Time duration between events
```kusto
let starts = java_upgrade_raw_events_non_us(ago(28d), now(), dynamic(["event.start"]))
    | summarize StartTime = min(ServerTimestamp) by ModernizationSessionId;
let ends = java_upgrade_raw_events_non_us(ago(28d), now(), dynamic(["event.end"]))
    | summarize EndTime = max(ServerTimestamp) by ModernizationSessionId;
starts | join kind=inner ends on ModernizationSessionId
| extend DurationSec = datetime_diff('second', EndTime, StartTime)
| summarize P50 = percentile(DurationSec, 50), P90 = percentile(DurationSec, 90)
```

### Precheck dead-end analysis

**What it answers**: For sessions where precheck failed and then had ZERO subsequent events (dead-end sessions), what were the failure reasons?

**Key filters**:
- `sessionid` (from `Properties["sessionid"]`) must be non-empty
- Same sessionid has no subsequent upgrade events after the failed precheck
- Uses `details.category` and `details.scenario` fields when available, falls back to `message` field

**Query**:
```kusto
let start = ago(28d);
let end = now();
let precheckFailed = 
    java_upgrade_raw_events_non_us(start, end, dynamic(["upgrade.precheckcompleted"]))
    | where tostring(Properties["status"]) == "failed"
    | extend sid = tostring(Properties["sessionid"])
    | where isnotempty(sid)
    | summarize FailTime = max(ServerTimestamp) by ModernizationSessionId, sid;
let allEvents = 
    java_upgrade_raw_events_non_us(start, end, dynamic([
        "upgrade.precheckcompleted",
        "upgrade.plangenerationstarted",
        "upgrade.planinitialized",
        "upgrade.planreviewed",
        "upgrade.planconfirmed",
        "upgrade.planexecutionstarted",
        "upgrade.upgradestepstarted",
        "upgrade.upgradestepcompleted",
        "upgrade.planexecutioncompleted"
    ]))
    | extend sid = tostring(Properties["sessionid"])
    | where isnotempty(sid);
let deadEndSessions = 
    precheckFailed
    | join kind=leftanti (
        allEvents
        | join kind=inner precheckFailed on sid, ModernizationSessionId
        | where ServerTimestamp > FailTime
        | distinct ModernizationSessionId, sid
    ) on ModernizationSessionId, sid
    | project ModernizationSessionId;
java_upgrade_raw_events_non_us(start, end, dynamic(["upgrade.precheckcompleted"]))
| where tostring(Properties["status"]) == "failed"
| where ModernizationSessionId in (deadEndSessions)
| extend 
    cat = tostring(Properties["details.category"]),
    scen = tostring(Properties["details.scenario"]),
    msg = tostring(Properties["message"])
| extend reason = case(
    isnotempty(cat) and isnotempty(scen), strcat(cat, " | ", scen),
    isnotempty(cat), cat,
    isnotempty(msg) and msg has_any("Missing target", "missing target", "target version", "not specified", "not provided", "need user", "must choose", "未指定", "缺少", "No target", "Missing upgrade", "Invalid", "latest LTS", "cannot begin", "upgrade target", "user selection", "upgrade focus"), "Invalid Goal | Missing target version",
    isnotempty(msg) and msg has_any("not a Maven", "Not a Maven", "not a Gradle", "Not a Gradle", "Unsupported", "Not a Java"), "Unsupported Project | Not a supported project",
    isnotempty(msg) and msg has_any("Maven", "maven", "pom.xml"), "Environment | Maven issue",
    isnotempty(msg) and msg has_any("Gradle", "gradle"), "Environment | Gradle issue",
    isnotempty(msg) and msg has_any("Java", "JDK", "jdk"), "Environment | Java/JDK issue",
    isnotempty(msg) and msg has_any("Git", "git"), "Environment | Git issue",
    isnotempty(msg), "Other (has message)",
    "Unknown (no message, no category)")
| summarize Sessions = dcount(ModernizationSessionId) by reason
| order by Sessions desc
```

**Key Properties fields used**:
- `Properties["details.category"]` — structured failure category (e.g., "Invalid Goal", "Unsupported Project"). Not always present (older versions or agent crashes).
- `Properties["details.scenario"]` — structured failure scenario (e.g., "Missing target version", "Not a Maven project"). Not always present.
- `Properties["message"]` — free-text failure message (LLM-generated, highly variable). Used as fallback when category/scenario are empty.
- `Properties["sessionid"]` — the upgrade session ID within the extension (different from ModernizationSessionId).

**Notes**:
- "Dead-end" = precheck failed AND no subsequent events in the same sessionid. This excludes sessions where the user retried and eventually succeeded.
- `message` field is LLM-generated free text — the same failure reason can appear in dozens of different phrasings (including non-English). The `case()` in the query normalizes these.
- `details.category` and `details.scenario` are structured fields added in newer versions. Older versions (1.14.x, 1.15.0) only have `message` or nothing.

---

### Analysis workflow

When the user asks a data question:

1. **Understand the question** — what metric, what dimension, what time range?
2. **Write the KQL** — use the schema reference above
3. **Run it** via `python ~/.claude/scripts/kusto-query.py "..."`
4. **Analyze the results** — compute derived metrics, identify patterns
5. **If needed, drill deeper** — write follow-up queries based on findings
6. **Summarize** — present findings in a clear, structured way

For multi-step analysis, run queries sequentially and build on previous results. Each query should be focused on answering one specific question.

### Troubleshooting

- **"Database not found"** — default is `bi` on `ama4j.westus2.kusto.windows.net`
- **"Function not found"** — check if `java_upgrade_raw_events_non_us` has been renamed
- **"Not logged in"** — run `az login`
- **Timeout** — reduce time range with `ago(7d)` instead of `ago(28d)`
- **Empty results** — check event name spelling (case-sensitive), verify the time range has data
