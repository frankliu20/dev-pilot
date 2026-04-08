---
name: mod-java-benchmark-analysis
description: Analyze MSBenchmark run results. Download benchmark data via msbench-cli, then analyze evaluation metrics, migration correctness, build/test status, and dependency changes. Trigger when user asks to analyze a benchmark run or check msbench results.
---

## Analyze MSBenchmark Run

Given a MSBench run ID (and optional context), analyze the benchmark data and produce a structured report.

### Input Format

The skill is invoked as:
```
/mod-java-benchmark-analysis <RUN_ID>
```
or with optional context (separated by `|`):
```
/mod-java-benchmark-analysis <RUN_ID> | Context: <issue link or analysis purpose>
```

- `RUN_ID` (required): The MSBench run ID, e.g. `24116095681`
- `Context` (optional): An issue link (e.g. `https://github.com/org/repo/issues/123`) or free-text description of what to focus on in the analysis (e.g. "Check why correctness failed", "Compare with previous run")

When context is provided, tailor the analysis to address it — highlight relevant findings, correlate with the issue, or focus on the specific area of concern.

### Prerequisites

- `msbench-cli` on PATH (installed via `pip install msbench-cli`)
- Authenticated to MSBench service

### Workflow

#### Step 1: Parse Input

Extract the run ID and optional context from the prompt.

#### Step 2: Download Benchmark Data (if needed)

Resolve the workspace directory, then check if data already exists:
```bash
WS=$(grep '^workspace:' ~/.claude/pilot.yaml | awk '{print $2}' | sed "s|^~|$HOME|")
BENCH_DIR="$WS/diagnostic/mcp"
RUN_DIR="$BENCH_DIR/<RUN_ID>"
```

**Check first** — if the directory already exists and contains data files, skip the download:
```bash
ls "$RUN_DIR/"
```

Only download if the directory does not exist or is empty:
```bash
mkdir -p "$BENCH_DIR"
cd "$BENCH_DIR"
msbench-cli extract --run_id <RUN_ID> --output ./<RUN_ID>
```

#### Step 3: Locate Key Files

After extraction, the data follows this structure. Each test case has a prefix like `<testname>.eval.x86_64.<instance>-output/output/appmod-output/`:

| File | Purpose |
|------|---------|
| `benchmark/evaluation-metrics.json` | Core metrics: completeness, correctness, durations, tokens, issues |
| `benchmark/evaluation-report.json` | Per-file migration evaluation details with issues |
| `instance_metadata.txt` | Instance info: repo, migration intent, model, java version |
| `eval/test_compile_exit_code` | Compile result (0 = success) |
| `eval/test_exit_code` | Test result (0 = success) |
| `eval/llm_build_result` | LLM build success/failure |
| `eval/sim_request_status` | Simulation request status |
| `eval/sim_request_error` | Simulation error message (if any) |
| `benchmark/before-dependency.csv` | Dependencies before migration |
| `benchmark/after-dependency.csv` | Dependencies after migration |
| `benchmark/cve.csv` | CVE vulnerabilities found |
| `benchmark/dependency.txt` | Dependency tree |
| `benchmark/diff/` | Code diff files |
| `*-fullrunlog.txt` | Full run log (top-level) |

#### Step 4: Produce Analysis Report

Read the key files and produce a report with these sections:

**1. Run Overview**
- Run ID, instance ID, model, migration intent
- Link: `https://msbenchapp.azurewebsites.net/run-analysis/<RUN_ID>`

**2. Evaluation Status** (from `evaluation-metrics.json`)
- Completeness: PASS/FAIL + duration (seconds) + tokens used
- Correctness: PASS/FAIL + duration (seconds) + tokens used
- Files changed vs not changed
- Issues: critical / major / minor counts
- Cache hit rate

**3. Build & Test Results** (from `eval/` files)
- Compile: PASS/FAIL (exit code)
- Test: PASS/FAIL (exit code)
- LLM Build: success/failure
- Sim Request: status + error if any

**4. Issues Found** (from `evaluation-report.json`)
- List all issues by severity (Critical > Major > Minor)
- Include file path and issue description

**5. Dependency Changes** (from CSV files)
- Dependencies removed (in before but not in after)
- Dependencies added (in after but not in before)
- Dependencies with version changes

**6. Context-Specific Analysis**
If context was provided (issue link or analysis purpose), address it directly:
- For issue links: correlate findings with the issue description
- For specific questions: answer them based on the data
- For comparison requests: highlight relevant differences

**7. Summary Verdict**
- Overall status: PASS / PARTIAL / FAIL
- Key concerns or areas for attention

### Output Format

Present the report in a clear, structured markdown format suitable for pasting into a GitHub issue or team discussion.
