#!/usr/bin/env python3
"""Evaluate whether a skill description triggers correctly for given queries.

Runs each query against a temporary slash command containing the skill
description, checking whether Claude selects the skill. Supports parallel
execution via ProcessPoolExecutor.

Usage:
    python run_trigger_eval.py --eval-set queries.json --skill-path ./skills/foo
"""

import argparse
import json
import os
import signal
import subprocess
import sys
import uuid
from concurrent.futures import ProcessPoolExecutor, as_completed
from pathlib import Path


def find_project_root():
    """Walk up from cwd looking for a .claude/ directory.

    Returns the first parent containing .claude/, or cwd if none found.
    """
    current = Path.cwd()
    for parent in [current, *current.parents]:
        if (parent / ".claude").is_dir():
            return parent
    return current


def run_single_query(query, skill_name, description, timeout, project_root, model):
    """Run a single trigger evaluation query.

    Creates a temporary command file with the skill description, invokes
    claude -p with stream-json output, and checks whether Claude attempts
    to invoke the temporary skill.

    Returns True if triggered, False otherwise. Never raises -- catches
    all exceptions and returns False.
    """
    command_name = f"_eval_{uuid.uuid4().hex[:12]}"
    command_dir = Path(project_root) / ".claude" / "commands"
    command_file = command_dir / f"{command_name}.md"
    proc = None

    try:
        command_dir.mkdir(parents=True, exist_ok=True)

        # Write temp command file: YAML frontmatter + minimal body
        command_content = (
            f"---\n"
            f"name: {command_name}\n"
            f"description: {description}\n"
            f"---\n\n"
            f"This is {skill_name}. Respond with: skill invoked.\n"
        )
        command_file.write_text(command_content)

        cmd = [
            "claude", "-p", query,
            "--output-format", "stream-json",
            "--verbose",
            "--allowedTools", "",
        ]

        # Strip CLAUDE_CODE_ENTRYPOINT to allow nested invocation
        env = {
            k: v for k, v in os.environ.items()
            if k != "CLAUDE_CODE_ENTRYPOINT"
        }

        proc = subprocess.Popen(
            cmd,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True,
            cwd=str(project_root),
            env=env,
        )

        triggered = False
        try:
            stdout, _ = proc.communicate(timeout=timeout)
        except subprocess.TimeoutExpired:
            _kill_process(proc)
            return False

        for line in stdout.splitlines():
            line = line.strip()
            if not line:
                continue
            try:
                event = json.loads(line)
            except json.JSONDecodeError:
                continue

            if _event_triggers_skill(event, command_name, str(command_file)):
                triggered = True
                break

        return triggered

    except Exception:
        return False

    finally:
        if proc is not None and proc.poll() is None:
            _kill_process(proc)
        if command_file.exists():
            command_file.unlink()


def _kill_process(proc):
    """Terminate a subprocess, escalating to SIGKILL if needed."""
    try:
        proc.terminate()
        try:
            proc.wait(timeout=5)
        except subprocess.TimeoutExpired:
            proc.kill()
            proc.wait(timeout=5)
    except Exception:
        pass


def _event_triggers_skill(event, command_name, command_file_path):
    """Check if a stream-json event indicates our temp skill was triggered.

    Looks for tool_use events where:
    - tool is "Skill" and input references our command name, OR
    - tool is "Read" and input path contains our command file
    """
    event_type = event.get("type", "")
    if event_type != "tool_use":
        # Also check nested content blocks
        if "content" in event and isinstance(event["content"], list):
            for block in event["content"]:
                if block.get("type") == "tool_use":
                    if _check_tool_use(block, command_name, command_file_path):
                        return True
        return False

    return _check_tool_use(event, command_name, command_file_path)


def _check_tool_use(block, command_name, command_file_path):
    """Check a single tool_use block for skill trigger indicators."""
    tool_name = block.get("name", "")
    tool_input = block.get("input", {})

    if isinstance(tool_input, str):
        input_text = tool_input
    else:
        input_text = json.dumps(tool_input)

    if tool_name == "Skill" and command_name in input_text:
        return True
    if tool_name == "Read" and command_file_path in input_text:
        return True

    return False


def run_eval(
    eval_set,
    skill_name,
    description,
    num_workers,
    timeout,
    project_root,
    runs_per_query,
    trigger_threshold,
    model,
):
    """Run the full trigger evaluation across all queries.

    Args:
        eval_set: List of dicts with 'query' and 'should_trigger' keys.
        skill_name: Name of the skill being evaluated.
        description: The skill description text to test.
        num_workers: Max parallel workers for ProcessPoolExecutor.
        timeout: Per-query timeout in seconds.
        project_root: Path to project root (contains .claude/).
        runs_per_query: Number of times to run each query.
        trigger_threshold: Fraction of runs that must trigger to count as pass.
        model: Optional model name.

    Returns:
        Dict with skill_name, description, results list, and summary.
    """
    # Submit all tasks: each query x runs_per_query
    futures = {}  # future -> (query_idx, run_idx)
    with ProcessPoolExecutor(max_workers=num_workers) as executor:
        for query_idx, entry in enumerate(eval_set):
            for run_idx in range(runs_per_query):
                future = executor.submit(
                    run_single_query,
                    entry["query"],
                    skill_name,
                    description,
                    timeout,
                    str(project_root),
                    model,
                )
                futures[future] = (query_idx, run_idx)

        # Collect results grouped by query index
        # triggers_by_query[i] = list of bool results
        triggers_by_query = {i: [] for i in range(len(eval_set))}
        for future in as_completed(futures):
            query_idx, _ = futures[future]
            try:
                result = future.result()
            except Exception:
                result = False
            triggers_by_query[query_idx].append(result)

    # Build results
    results = []
    passed_count = 0
    for query_idx, entry in enumerate(eval_set):
        triggers = triggers_by_query[query_idx]
        trigger_count = sum(triggers)
        total_runs = len(triggers)
        trigger_rate = trigger_count / total_runs if total_runs > 0 else 0.0

        should_trigger = entry["should_trigger"]
        if should_trigger:
            query_passed = trigger_rate >= trigger_threshold
        else:
            query_passed = trigger_rate < trigger_threshold

        if query_passed:
            passed_count += 1

        results.append({
            "query": entry["query"],
            "should_trigger": should_trigger,
            "trigger_rate": trigger_rate,
            "triggers": trigger_count,
            "runs": total_runs,
            "pass": query_passed,
        })

    total_queries = len(eval_set)
    return {
        "skill_name": skill_name,
        "description": description,
        "results": results,
        "summary": {
            "total": total_queries,
            "passed": passed_count,
            "failed": total_queries - passed_count,
        },
    }


def main():
    parser = argparse.ArgumentParser(
        description="Evaluate skill description trigger accuracy"
    )
    parser.add_argument(
        "--eval-set", required=True,
        help="Path to JSON file containing evaluation queries",
    )
    parser.add_argument(
        "--skill-path", required=True,
        help="Path to skill directory containing SKILL.md",
    )
    parser.add_argument(
        "--description", default=None,
        help="Override description (default: read from SKILL.md)",
    )
    parser.add_argument(
        "--num-workers", type=int, default=10,
        help="Max parallel workers (default: 10)",
    )
    parser.add_argument(
        "--timeout", type=int, default=30,
        help="Per-query timeout in seconds (default: 30)",
    )
    parser.add_argument(
        "--runs-per-query", type=int, default=3,
        help="Number of runs per query (default: 3)",
    )
    parser.add_argument(
        "--trigger-threshold", type=float, default=0.5,
        help="Fraction of runs that must trigger to pass (default: 0.5)",
    )
    parser.add_argument(
        "--model", default=None,
        help="Model to use for claude invocations",
    )
    parser.add_argument(
        "--verbose", action="store_true",
        help="Print progress to stderr",
    )
    args = parser.parse_args()

    # Load query set
    query_set_path = Path(args.eval_set)
    query_set = json.loads(query_set_path.read_text())

    # Parse skill for name and default description
    from scripts.utils import parse_frontmatter

    skill_name, skill_description, _ = parse_frontmatter(args.skill_path)
    description = args.description if args.description else skill_description

    project_root = find_project_root()

    if args.verbose:
        print(
            f"Running evaluation: {len(query_set)} queries, "
            f"{args.runs_per_query} runs each, "
            f"{args.num_workers} workers",
            file=sys.stderr,
        )

    result = run_eval(
        eval_set=query_set,
        skill_name=skill_name,
        description=description,
        num_workers=args.num_workers,
        timeout=args.timeout,
        project_root=project_root,
        runs_per_query=args.runs_per_query,
        trigger_threshold=args.trigger_threshold,
        model=args.model,
    )

    print(json.dumps(result, indent=2))


if __name__ == "__main__":
    main()
