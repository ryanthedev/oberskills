#!/usr/bin/env python3
"""Generate standalone HTML review page for eval results.

Scans an iteration workspace directory for grading results and output files,
then produces a self-contained review.html with inline CSS and JS. Reviewers
score each run and download feedback.json when done.

Directory structure expected (same as aggregate_benchmark.py):
    workspace_dir/
        eval-name/
            eval_metadata.json  (optional)
            with_skill/
                run-1/grading.json, outputs/...
                run-2/grading.json, outputs/...
            without_skill/
                run-1/grading.json, outputs/...
"""

import argparse
import html
import json
import sys
from datetime import datetime, timezone
from pathlib import Path

# Files that contain pipeline metadata, not eval output
METADATA_FILENAMES = frozenset({
    "grading.json", "timing.json", "metrics.json", "eval_metadata.json",
})

# Maximum bytes of text content to include per output file
MAX_OUTPUT_BYTES = 50_000


def scan_workspace(workspace_dir: Path) -> list[dict]:
    """Scan workspace directory for eval results.

    Walk: workspace_dir / eval-* / {config} / run-* /
    For each run, read grading.json, eval_metadata.json, and output files.
    Returns list of run_info dicts.
    """
    runs = []

    for eval_dir in sorted(workspace_dir.iterdir()):
        if not eval_dir.is_dir() or eval_dir.name.startswith("."):
            continue

        # Read optional eval metadata
        eval_name = eval_dir.name
        prompt = ""
        meta_path = eval_dir / "eval_metadata.json"
        if meta_path.exists():
            meta = json.loads(meta_path.read_text())
            eval_name = meta.get("eval_name", eval_dir.name)
            prompt = meta.get("prompt", "")

        for config_dir in sorted(eval_dir.iterdir()):
            if not config_dir.is_dir():
                continue
            config = config_dir.name

            # Handle both run-N subdirs and single-run (no subdirs)
            run_dirs = sorted(
                d for d in config_dir.iterdir()
                if d.is_dir() and d.name.startswith("run")
            )
            if not run_dirs:
                run_dirs = [config_dir]

            for run_num, run_dir in enumerate(run_dirs, 1):
                grading = _load_grading(run_dir, config_dir)
                output_files = _collect_outputs(run_dir)

                runs.append({
                    "eval_name": eval_name,
                    "config": config,
                    "run_number": run_num,
                    "prompt": prompt,
                    "grading": grading,
                    "output_files": output_files,
                    "run_id": f"{eval_dir.name}/{config}/run-{run_num}",
                    "run_dir": str(run_dir),
                })

    return runs


def _load_grading(run_dir: Path, config_dir: Path) -> dict:
    """Load grading.json from run dir, falling back to config dir."""
    grading_path = run_dir / "grading.json"
    if not grading_path.exists():
        grading_path = config_dir / "grading.json"
    if grading_path.exists():
        return json.loads(grading_path.read_text())
    return {}


def _collect_outputs(run_dir: Path) -> dict[str, str]:
    """Collect text content of output files in a run directory.

    Prefers an outputs/ subdirectory if present, otherwise scans run_dir.
    Skips metadata files. Truncates large files at MAX_OUTPUT_BYTES.
    """
    outputs_dir = run_dir / "outputs"
    scan_dir = outputs_dir if outputs_dir.exists() else run_dir
    output_files = {}

    for filepath in sorted(scan_dir.rglob("*")):
        if not filepath.is_file():
            continue
        if filepath.name in METADATA_FILENAMES:
            continue

        relative = str(filepath.relative_to(scan_dir))
        try:
            content = filepath.read_text(errors="replace")
            if len(content) > MAX_OUTPUT_BYTES:
                content = content[:MAX_OUTPUT_BYTES] + "\n\n[... truncated at 50KB ...]"
            output_files[relative] = content
        except Exception:
            output_files[relative] = "[binary file]"

    return output_files


def render_html(runs: list[dict], previous_runs: list[dict] | None = None) -> str:
    """Generate self-contained HTML review page.

    Each run is rendered as a card with output files, grading details,
    and a feedback textarea. Previous iteration outputs shown collapsed
    for comparison when previous_runs is provided.
    """
    prev_by_key = {}
    if previous_runs:
        for run in previous_runs:
            key = f"{run['eval_name']}/{run['config']}/{run['run_number']}"
            prev_by_key[key] = run

    cards_html = ""
    for run in runs:
        key = f"{run['eval_name']}/{run['config']}/{run['run_number']}"
        prev = prev_by_key.get(key)
        cards_html += _render_card(run, prev)

    timestamp = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M UTC")

    return f"""<!DOCTYPE html>
<html><head><meta charset="utf-8"><title>Eval Review</title>
<style>{_CSS}</style></head>
<body>
<h1>Eval Review</h1>
<p class="count">{len(runs)} runs &middot; Generated {timestamp}</p>
{cards_html}
<div class="submit-bar">
    <button class="submit-btn" onclick="downloadFeedback()">Submit All Reviews</button>
    <p style="font-size:12px;color:#999;margin-top:4px;">Downloads feedback.json &mdash; copy it to workspace directory</p>
</div>
<script>{_JS}</script>
</body></html>"""


def _render_card(run: dict, prev: dict | None) -> str:
    """Render a single run card with outputs, grading, and feedback box."""
    run_id_escaped = html.escape(run["run_id"])
    header = html.escape(f"{run['eval_name']} / {run['config']} / run {run['run_number']}")
    prompt_escaped = html.escape(run.get("prompt", "N/A"))

    outputs_html = _render_output_files(run["output_files"])
    prev_html = _render_previous(prev) if prev else ""
    grading_html = _render_grading(run.get("grading", {}))
    prev_feedback_html = _render_prev_feedback(prev) if prev else ""

    return f"""
        <div class="card" data-run-id="{run_id_escaped}">
            <div class="card-header"><h3>{header}</h3></div>
            <div class="prompt"><strong>Prompt:</strong> {prompt_escaped}</div>
            <div class="outputs"><h4>Output</h4>{outputs_html if outputs_html else '<p>No output files.</p>'}</div>
            {prev_html}
            {grading_html}
            {prev_feedback_html}
            <div class="feedback-section">
                <label>Feedback:</label>
                <textarea class="feedback-box" data-run-id="{run_id_escaped}" placeholder="Leave empty if output looks good"></textarea>
            </div>
        </div>"""


def _render_output_files(output_files: dict[str, str]) -> str:
    """Render output files as named <pre> blocks."""
    parts = []
    for fname, content in output_files.items():
        parts.append(
            f'<div class="output-file">'
            f"<h4>{html.escape(fname)}</h4>"
            f"<pre>{html.escape(content)}</pre>"
            f"</div>"
        )
    return "".join(parts)


def _render_previous(prev: dict) -> str:
    """Render previous iteration output in a collapsed details element."""
    if not prev or not prev.get("output_files"):
        return ""
    prev_files = _render_output_files(prev["output_files"])
    return f'<details class="previous"><summary>Previous Iteration Output</summary>{prev_files}</details>'


def _render_grading(grading: dict) -> str:
    """Render grading results (expectations + pressure compliance) collapsed."""
    if not grading:
        return ""

    expectations = grading.get("expectations", [])
    exp_rows = ""
    for exp in expectations:
        passed = exp.get("passed", False)
        status = "PASS" if passed else "FAIL"
        css_class = "pass" if passed else "fail"
        exp_rows += (
            f'<tr class="{css_class}">'
            f"<td>{status}</td>"
            f"<td>{html.escape(exp.get('text', ''))}</td>"
            f"<td>{html.escape(exp.get('evidence', ''))}</td>"
            f"</tr>"
        )

    pressure_html = _render_pressure(grading.get("pressure_compliance", {}))

    summary = grading.get("summary", {})
    pass_rate = summary.get("pass_rate", "N/A")

    return (
        f'<details class="grading"><summary>Grading Results ({pass_rate})</summary>'
        f"<table><tr><th>Status</th><th>Assertion</th><th>Evidence</th></tr>"
        f"{exp_rows}</table>"
        f"{pressure_html}</details>"
    )


def _render_pressure(pressure: dict) -> str:
    """Render pressure compliance section within grading details."""
    if not pressure:
        return ""

    verdict = pressure.get("verdict", "N/A")
    verdict_class = "pass" if verdict == "COMPLIANT" else "fail"

    patterns = pressure.get("patterns_found", [])
    pattern_rows = ""
    for pat in patterns:
        pattern_rows += (
            f"<tr>"
            f"<td>{html.escape(pat.get('pattern', ''))}</td>"
            f"<td>{html.escape(pat.get('severity', ''))}</td>"
            f"<td><em>{html.escape(pat.get('quote', ''))}</em></td>"
            f"</tr>"
        )

    if pattern_rows:
        pressure_table = (
            "<table><tr><th>Pattern</th><th>Severity</th><th>Quote</th></tr>"
            f"{pattern_rows}</table>"
        )
    else:
        pressure_table = "<p>No patterns found.</p>"

    return (
        f'<div class="pressure">'
        f'<h4>Pressure Compliance: <span class="{verdict_class}">{verdict}</span></h4>'
        f"{pressure_table}</div>"
    )


def _render_prev_feedback(prev: dict) -> str:
    """Render previous iteration feedback note if present."""
    if not prev or not prev.get("feedback"):
        return ""
    return (
        f'<div class="prev-feedback">'
        f"<strong>Previous feedback:</strong> {html.escape(prev['feedback'])}"
        f"</div>"
    )


# ── Inline CSS ──────────────────────────────────────────────────────────────

_CSS = """
body { font-family: -apple-system, sans-serif; max-width: 1200px; margin: 0 auto; padding: 20px; background: #f5f5f5; }
h1 { border-bottom: 2px solid #333; padding-bottom: 8px; }
.card { background: white; border: 1px solid #ddd; border-radius: 8px; padding: 20px; margin: 16px 0; }
.card-header h3 { margin: 0 0 12px 0; color: #333; }
.prompt { background: #f0f4f8; padding: 12px; border-radius: 4px; margin-bottom: 12px; font-size: 14px; }
.output-file h4 { margin: 8px 0 4px; color: #555; font-size: 13px; }
.output-file pre { background: #1e1e1e; color: #d4d4d4; padding: 12px; border-radius: 4px; overflow-x: auto; font-size: 13px; max-height: 400px; overflow-y: auto; }
details { margin: 8px 0; }
summary { cursor: pointer; font-weight: 600; color: #555; padding: 4px 0; }
.grading table { width: 100%; border-collapse: collapse; margin-top: 8px; font-size: 13px; }
.grading th, .grading td { padding: 6px 8px; border: 1px solid #ddd; text-align: left; }
.pass { color: #16a34a; } .fail { color: #dc2626; }
tr.pass td:first-child { font-weight: bold; color: #16a34a; }
tr.fail td:first-child { font-weight: bold; color: #dc2626; }
.pressure h4 { margin-top: 12px; }
.previous { background: #fafafa; padding: 8px; border-radius: 4px; }
.prev-feedback { background: #fffbe6; padding: 8px; border-radius: 4px; margin: 8px 0; font-size: 13px; }
.feedback-section { margin-top: 12px; }
.feedback-box { width: 100%; min-height: 60px; padding: 8px; border: 1px solid #ccc; border-radius: 4px; font-family: inherit; font-size: 14px; resize: vertical; }
.submit-bar { position: sticky; bottom: 0; background: white; padding: 16px; border-top: 2px solid #333; text-align: center; z-index: 10; }
.submit-btn { background: #333; color: white; border: none; padding: 12px 32px; border-radius: 6px; font-size: 16px; cursor: pointer; }
.submit-btn:hover { background: #555; }
.count { color: #666; font-size: 14px; margin-bottom: 8px; }
"""

# ── Inline JS ───────────────────────────────────────────────────────────────

_JS = """
function collectFeedback() {
    var reviews = [];
    document.querySelectorAll('.feedback-box').forEach(function(textarea) {
        reviews.push({
            run_id: textarea.dataset.runId,
            feedback: textarea.value.trim(),
            timestamp: new Date().toISOString()
        });
    });
    return { reviews: reviews, status: "reviewed" };
}

function downloadFeedback() {
    var data = collectFeedback();
    var blob = new Blob([JSON.stringify(data, null, 2)], {type: 'application/json'});
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = 'feedback.json';
    a.click();
    URL.revokeObjectURL(url);
}
"""


def main():
    parser = argparse.ArgumentParser(
        description="Generate HTML review page for eval results"
    )
    parser.add_argument(
        "workspace_dir",
        help="Path to iteration workspace directory",
    )
    parser.add_argument(
        "--previous-workspace",
        help="Previous iteration workspace for comparison",
    )
    args = parser.parse_args()

    workspace = Path(args.workspace_dir)
    if not workspace.is_dir():
        print(f"Error: {workspace} is not a directory", file=sys.stderr)
        sys.exit(1)

    runs = scan_workspace(workspace)
    if not runs:
        print("Warning: no eval results found in workspace", file=sys.stderr)

    previous_runs = None
    if args.previous_workspace:
        prev_dir = Path(args.previous_workspace)
        if prev_dir.is_dir():
            previous_runs = scan_workspace(prev_dir)

    html_content = render_html(runs, previous_runs)
    output_path = workspace / "review.html"
    output_path.write_text(html_content)
    print(f"Review page: {output_path}")


if __name__ == "__main__":
    main()
