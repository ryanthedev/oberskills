#!/usr/bin/env python3
"""Aggregate benchmark results from graded eval runs.

Reads grading.json and timing.json files from a benchmark directory structure,
computes summary statistics per configuration, and outputs benchmark.json and
benchmark.md.

Directory structure expected:
    benchmark_dir/
        eval-name/
            eval_metadata.json  (optional)
            with_skill/
                run-1/grading.json, timing.json
                run-2/grading.json, timing.json
            without_skill/
                run-1/grading.json, timing.json
"""

import argparse
import json
import math
import sys
from datetime import datetime, timezone
from pathlib import Path


def calculate_stats(values):
    """Compute mean, sample stddev, min, max for a list of numbers.

    Uses sample standard deviation (n-1 denominator) when len > 1.
    Returns zeros for empty input.
    """
    if not values:
        return {"mean": 0, "stddev": 0, "min": 0, "max": 0}

    mean = sum(values) / len(values)

    if len(values) > 1:
        variance = sum((x - mean) ** 2 for x in values) / (len(values) - 1)
        stddev = math.sqrt(variance)
    else:
        stddev = 0

    return {
        "mean": round(mean, 4),
        "stddev": round(stddev, 4),
        "min": round(min(values), 4),
        "max": round(max(values), 4),
    }


def load_run_results(benchmark_dir):
    """Walk benchmark directory and collect grading results from each run.

    Returns a list of run dicts with eval metadata, configuration, results,
    expectations, and user notes.
    """
    runs = []

    for eval_dir in sorted(benchmark_dir.iterdir()):
        if not eval_dir.is_dir():
            continue
        if eval_dir.name.startswith("."):
            continue

        # Read optional eval metadata
        metadata_path = eval_dir / "eval_metadata.json"
        eval_id = None
        eval_name = eval_dir.name

        if metadata_path.exists():
            meta = json.loads(metadata_path.read_text())
            eval_id = meta.get("eval_id", eval_name)
            eval_name = meta.get("eval_name", eval_name)

        # Each subdirectory is a configuration (with_skill, without_skill, etc.)
        for config_dir in sorted(eval_dir.iterdir()):
            if not config_dir.is_dir():
                continue

            configuration = config_dir.name

            # Look for run-N subdirectories; fall back to config_dir as single run
            run_dirs = sorted(
                d for d in config_dir.iterdir()
                if d.is_dir() and d.name.startswith("run")
            )
            if not run_dirs:
                run_dirs = [config_dir]

            for run_num, run_dir in enumerate(run_dirs, 1):
                grading_path = run_dir / "grading.json"
                if not grading_path.exists():
                    grading_path = config_dir / "grading.json"
                if not grading_path.exists():
                    print(
                        f"Warning: no grading.json in {run_dir}",
                        file=sys.stderr,
                    )
                    continue

                grading = json.loads(grading_path.read_text())
                summary = grading.get("summary", {})

                # Timing: check run dir first, then config dir
                timing_path = run_dir / "timing.json"
                if not timing_path.exists():
                    timing_path = config_dir / "timing.json"
                timing = (
                    json.loads(timing_path.read_text())
                    if timing_path.exists()
                    else {}
                )

                metrics = grading.get("execution_metrics", {})

                run = {
                    "eval_id": eval_id or eval_name,
                    "eval_name": eval_name,
                    "configuration": configuration,
                    "run_number": run_num,
                    "result": {
                        "pass_rate": summary.get("pass_rate", 0),
                        "passed": summary.get("passed", 0),
                        "total": summary.get("total", 0),
                        "time_seconds": timing.get(
                            "total_duration_seconds", 0
                        ),
                        "tokens": timing.get("total_tokens", 0),
                        "tool_calls": metrics.get("total_tool_calls", 0),
                        "errors": metrics.get("errors_encountered", 0),
                    },
                    "expectations": grading.get("expectations", []),
                    "notes": [],
                }

                notes_summary = grading.get("user_notes_summary", {})
                if notes_summary:
                    run["notes"] = notes_summary.get(
                        "uncertainties", []
                    ) + notes_summary.get("workarounds", [])

                runs.append(run)

    return runs


def aggregate_results(runs):
    """Compute per-configuration summary statistics and delta between first two configs."""
    by_config = {}
    for run in runs:
        config = run["configuration"]
        if config not in by_config:
            by_config[config] = {"pass_rates": [], "times": [], "tokens": []}
        by_config[config]["pass_rates"].append(run["result"]["pass_rate"])
        by_config[config]["times"].append(run["result"]["time_seconds"])
        by_config[config]["tokens"].append(run["result"]["tokens"])

    summary = {}
    for config, data in by_config.items():
        summary[config] = {
            "pass_rate": calculate_stats(data["pass_rates"]),
            "time_seconds": calculate_stats(data["times"]),
            "tokens": calculate_stats(data["tokens"]),
        }

    # Delta between first two configurations
    configs = list(by_config.keys())
    if len(configs) >= 2:
        a, b = configs[0], configs[1]
        summary["delta"] = {
            "pass_rate": (
                f"{summary[a]['pass_rate']['mean'] - summary[b]['pass_rate']['mean']:+.4f}"
            ),
            "time_seconds": (
                f"{summary[a]['time_seconds']['mean'] - summary[b]['time_seconds']['mean']:+.1f}"
            ),
            "tokens": (
                f"{summary[a]['tokens']['mean'] - summary[b]['tokens']['mean']:+.0f}"
            ),
        }

    return summary


def generate_markdown(benchmark):
    """Render benchmark data as a Markdown report."""
    lines = [
        f"# Benchmark: {benchmark['metadata']['skill_name']}",
        "",
        f"**Generated:** {benchmark['metadata']['timestamp']}",
        "",
    ]

    summary = benchmark.get("run_summary", {})

    for config, stats in summary.items():
        if config == "delta":
            continue
        lines.append(f"## {config}")
        lines.append("| Metric | Mean | Stddev | Min | Max |")
        lines.append("|--------|------|--------|-----|-----|")
        for metric in ["pass_rate", "time_seconds", "tokens"]:
            s = stats.get(metric, {})
            lines.append(
                f"| {metric} | {s.get('mean', 0)} | {s.get('stddev', 0)} "
                f"| {s.get('min', 0)} | {s.get('max', 0)} |"
            )
        lines.append("")

    if "delta" in summary:
        lines.append("## Delta")
        for k, v in summary["delta"].items():
            lines.append(f"- {k}: {v}")
        lines.append("")

    if benchmark.get("notes"):
        lines.append("## Notes")
        for note in benchmark["notes"]:
            lines.append(f"- {note}")
        lines.append("")

    return "\n".join(lines)


def main():
    parser = argparse.ArgumentParser(
        description="Aggregate benchmark results from graded eval runs"
    )
    parser.add_argument(
        "benchmark_dir",
        help="Directory containing eval result subdirectories",
    )
    parser.add_argument(
        "--skill-name",
        required=True,
        help="Name of the skill being benchmarked",
    )
    parser.add_argument(
        "--skill-path",
        default="",
        help="Path to the skill's SKILL.md (optional)",
    )
    parser.add_argument(
        "--output",
        help="Output directory (default: benchmark_dir)",
    )
    args = parser.parse_args()

    benchmark_dir = Path(args.benchmark_dir)
    output_dir = Path(args.output) if args.output else benchmark_dir

    runs = load_run_results(benchmark_dir)
    if not runs:
        print("Error: no grading results found", file=sys.stderr)
        sys.exit(1)

    run_summary = aggregate_results(runs)

    configurations = set(r["configuration"] for r in runs)
    runs_per_config = max(
        (len([r for r in runs if r["configuration"] == c]) for c in configurations),
        default=0,
    )

    benchmark = {
        "metadata": {
            "skill_name": args.skill_name,
            "skill_path": args.skill_path,
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "evals_run": sorted(set(r["eval_name"] for r in runs)),
            "runs_per_configuration": runs_per_config,
        },
        "runs": runs,
        "run_summary": run_summary,
        "notes": [],
    }

    output_dir.mkdir(parents=True, exist_ok=True)
    (output_dir / "benchmark.json").write_text(
        json.dumps(benchmark, indent=2)
    )
    (output_dir / "benchmark.md").write_text(generate_markdown(benchmark))

    print(f"Wrote benchmark.json and benchmark.md to {output_dir}")


if __name__ == "__main__":
    main()
