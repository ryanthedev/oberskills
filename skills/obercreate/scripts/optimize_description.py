#!/usr/bin/env python3
"""Optimize a skill description for trigger accuracy.

Generates evaluation queries, splits into train/test sets, then iteratively
improves the description using Claude to analyze failures and propose
better phrasings.

Usage:
    python optimize_description.py --skill-path ./skills/foo --model sonnet
"""

import argparse
import json
import random
import re
import sys
from pathlib import Path

from scripts.run_trigger_eval import run_eval, find_project_root
from scripts.utils import call_claude, parse_frontmatter


MAX_DESCRIPTION_CHARS = 1024


def generate_eval_queries(skill_path, model):
    """Generate trigger evaluation queries by asking Claude to analyze the skill.

    Produces 20 queries: 10 that should trigger the skill (natural phrasings)
    and 10 that should not (near-misses from adjacent domains).

    Args:
        skill_path: Path to skill directory containing SKILL.md.
        model: Model name for Claude invocation.

    Returns:
        List of dicts with 'query' (str) and 'should_trigger' (bool) keys.

    Raises:
        ValueError: If Claude's response cannot be parsed as valid JSON.
    """
    skill_name, description, content = parse_frontmatter(skill_path)

    prompt = f"""Analyze this skill and generate exactly 20 trigger evaluation queries.

SKILL NAME: {skill_name}
SKILL DESCRIPTION: {description}

FULL SKILL CONTENT:
{content}

Generate a JSON array of 20 objects, each with:
- "query": a natural user request (1-2 sentences)
- "should_trigger": boolean

Requirements:
- 10 queries where should_trigger=true: natural phrasings a user would say
  when they want THIS skill. Vary the wording — don't just paraphrase the
  description. Include indirect requests, domain-specific jargon, and
  conversational phrasings.
- 10 queries where should_trigger=false: near-miss requests that seem related
  but belong to a different skill or general capability. These should be
  plausible confusions, not obviously unrelated.

Return ONLY a JSON array, no other text."""

    response = call_claude(prompt, model=model)

    # Extract JSON from response (may be wrapped in code fence)
    json_text = response
    fence_match = re.search(r"```(?:json)?\s*\n(.*?)\n```", response, re.DOTALL)
    if fence_match:
        json_text = fence_match.group(1)

    queries = json.loads(json_text)

    # Validate structure
    if not isinstance(queries, list):
        raise ValueError("Expected a JSON array of query objects")
    for entry in queries:
        if not isinstance(entry, dict):
            raise ValueError(f"Expected dict, got {type(entry)}")
        if "query" not in entry or "should_trigger" not in entry:
            raise ValueError(f"Missing required keys in entry: {entry}")

    return queries


def split_eval_set(query_set, holdout=0.4, seed=42):
    """Split evaluation queries into train and test sets.

    Stratifies by should_trigger to maintain balance in both sets.

    Args:
        query_set: List of query dicts with 'should_trigger' key.
        holdout: Fraction of each group to reserve for test (0.0 to 1.0).
        seed: Random seed for reproducibility.

    Returns:
        Tuple of (train_set, test_set) lists.
    """
    rng = random.Random(seed)

    positive = [e for e in query_set if e["should_trigger"]]
    negative = [e for e in query_set if not e["should_trigger"]]

    rng.shuffle(positive)
    rng.shuffle(negative)

    pos_split = int(len(positive) * holdout)
    neg_split = int(len(negative) * holdout)

    test_set = positive[:pos_split] + negative[:neg_split]
    train_set = positive[pos_split:] + negative[neg_split:]

    return (train_set, test_set)


def improve_description(
    skill_name, skill_content, current_description, results, history, model
):
    """Ask Claude to improve the skill description based on evaluation failures.

    Analyzes which queries failed and generates a better description that
    addresses the failures without overfitting to specific queries.

    Args:
        skill_name: Name of the skill.
        skill_content: Full SKILL.md content.
        current_description: The current description being optimized.
        results: Dict from run_eval with results and summary.
        history: List of past attempts with descriptions and scores.
        model: Model name for Claude invocation.

    Returns:
        Improved description string (max 1024 chars).
    """
    # Extract failures for the prompt
    failed_triggers = []
    false_positives = []
    for result in results["results"]:
        if not result["pass"]:
            if result["should_trigger"]:
                failed_triggers.append(result["query"])
            else:
                false_positives.append(result["query"])

    history_text = ""
    if history:
        history_lines = []
        for entry in history:
            history_lines.append(
                f"  Iteration {entry['iteration']}: "
                f"train={entry['train_score']:.0%}, test={entry['test_score']:.0%}\n"
                f"    Description: {entry['description'][:200]}..."
            )
        history_text = "PAST ATTEMPTS:\n" + "\n".join(history_lines)

    prompt = f"""Improve this skill description for better trigger accuracy.

SKILL NAME: {skill_name}
CURRENT DESCRIPTION: {current_description}

CURRENT SCORES:
- Passed: {results['summary']['passed']}/{results['summary']['total']}

FAILED TO TRIGGER (should have matched but didn't):
{json.dumps(failed_triggers, indent=2) if failed_triggers else "None"}

FALSE POSITIVES (should NOT have matched but did):
{json.dumps(false_positives, indent=2) if false_positives else "None"}

{history_text}

SKILL CONTENT (for reference):
{skill_content[:3000]}

GUIDELINES:
- Maximum {MAX_DESCRIPTION_CHARS} characters
- Use imperative style ("Use when..." or "Invoke for...")
- Generalize from failures -- don't overfit to specific query wordings
- Include key differentiators that separate this skill from similar ones
- Mention core capabilities and domains the skill handles

Return the improved description wrapped in <new_description> tags:
<new_description>your improved description here</new_description>"""

    response = call_claude(prompt, model=model)

    # Extract description from tags
    tag_match = re.search(
        r"<new_description>(.*?)</new_description>", response, re.DOTALL
    )
    if tag_match:
        new_description = tag_match.group(1).strip()
    else:
        # Fallback: use entire response stripped
        new_description = response.strip()

    # Enforce length limit
    if len(new_description) > MAX_DESCRIPTION_CHARS:
        shorten_prompt = (
            f"Shorten this skill description to under {MAX_DESCRIPTION_CHARS} "
            f"characters while preserving its key trigger signals:\n\n"
            f"{new_description}\n\n"
            f"Return ONLY the shortened description, no other text."
        )
        new_description = call_claude(shorten_prompt, model=model)
        # Truncate as last resort
        if len(new_description) > MAX_DESCRIPTION_CHARS:
            new_description = new_description[:MAX_DESCRIPTION_CHARS]

    return new_description


def optimize_loop(
    skill_path,
    max_iterations,
    holdout,
    num_workers,
    timeout,
    runs_per_query,
    trigger_threshold,
    model,
    verbose,
    query_set_override=None,
):
    """Run the iterative description optimization loop.

    Generates (or loads) evaluation queries, splits into train/test, then
    iterates: evaluate on train, evaluate on test, record scores, improve
    description if train isn't perfect yet.

    Args:
        skill_path: Path to skill directory containing SKILL.md.
        max_iterations: Maximum optimization iterations.
        holdout: Fraction of queries for test set.
        num_workers: Parallel workers for trigger evaluation.
        timeout: Per-query timeout in seconds.
        runs_per_query: Runs per query for trigger evaluation.
        trigger_threshold: Fraction threshold for trigger pass.
        model: Model name for Claude invocations.
        verbose: If True, print progress to stderr.
        query_set_override: Optional pre-loaded query list (skips generation).

    Returns:
        Dict with original_description, best_description, best_test_score,
        iterations_run, and history.
    """
    skill_name, original_description, skill_content = parse_frontmatter(skill_path)
    current_description = original_description

    project_root = find_project_root()

    # Generate or load queries
    if query_set_override is not None:
        all_queries = query_set_override
    else:
        if verbose:
            print("Generating evaluation queries...", file=sys.stderr)
        all_queries = generate_eval_queries(skill_path, model)

    train_set, test_set = split_eval_set(all_queries, holdout=holdout)

    if verbose:
        print(
            f"Split: {len(train_set)} train, {len(test_set)} test",
            file=sys.stderr,
        )

    history = []

    for iteration in range(1, max_iterations + 1):
        if verbose:
            print(f"\n--- Iteration {iteration} ---", file=sys.stderr)
            print(
                f"Description: {current_description[:100]}...",
                file=sys.stderr,
            )

        # Evaluate on train set
        train_results = run_eval(
            eval_set=train_set,
            skill_name=skill_name,
            description=current_description,
            num_workers=num_workers,
            timeout=timeout,
            project_root=project_root,
            runs_per_query=runs_per_query,
            trigger_threshold=trigger_threshold,
            model=model,
        )

        # Evaluate on test set
        test_results = run_eval(
            eval_set=test_set,
            skill_name=skill_name,
            description=current_description,
            num_workers=num_workers,
            timeout=timeout,
            project_root=project_root,
            runs_per_query=runs_per_query,
            trigger_threshold=trigger_threshold,
            model=model,
        )

        train_total = train_results["summary"]["total"]
        train_passed = train_results["summary"]["passed"]
        test_total = test_results["summary"]["total"]
        test_passed = test_results["summary"]["passed"]

        train_score = train_passed / train_total if train_total > 0 else 0.0
        test_score = test_passed / test_total if test_total > 0 else 0.0

        history.append({
            "iteration": iteration,
            "description": current_description,
            "train_score": train_score,
            "test_score": test_score,
        })

        if verbose:
            print(
                f"Train: {train_passed}/{train_total} ({train_score:.0%}), "
                f"Test: {test_passed}/{test_total} ({test_score:.0%})",
                file=sys.stderr,
            )

        # Early exit if train set is perfect
        if train_passed == train_total:
            if verbose:
                print("Train set perfect -- stopping early.", file=sys.stderr)
            break

        # Improve description based on train failures
        current_description = improve_description(
            skill_name=skill_name,
            skill_content=skill_content,
            current_description=current_description,
            results=train_results,
            history=history,
            model=model,
        )

    # Select best iteration by test score
    best_entry = max(history, key=lambda h: h["test_score"])

    return {
        "original_description": original_description,
        "best_description": best_entry["description"],
        "best_test_score": best_entry["test_score"],
        "iterations_run": len(history),
        "history": history,
    }


def main():
    parser = argparse.ArgumentParser(
        description="Optimize a skill description for trigger accuracy"
    )
    parser.add_argument(
        "--skill-path", required=True,
        help="Path to skill directory containing SKILL.md",
    )
    parser.add_argument(
        "--max-iterations", type=int, default=5,
        help="Maximum optimization iterations (default: 5)",
    )
    parser.add_argument(
        "--holdout", type=float, default=0.4,
        help="Fraction of queries reserved for test set (default: 0.4)",
    )
    parser.add_argument(
        "--eval-set", default=None,
        help="Path to pre-generated query JSON (skips generation step)",
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
        "--model", required=True,
        help="Model to use for Claude invocations",
    )
    parser.add_argument(
        "--verbose", action="store_true",
        help="Print progress to stderr",
    )
    args = parser.parse_args()

    # Load pre-generated queries if provided
    query_set_override = None
    if args.eval_set:
        query_set_override = json.loads(Path(args.eval_set).read_text())

    result = optimize_loop(
        skill_path=args.skill_path,
        max_iterations=args.max_iterations,
        holdout=args.holdout,
        num_workers=args.num_workers,
        timeout=args.timeout,
        runs_per_query=args.runs_per_query,
        trigger_threshold=args.trigger_threshold,
        model=args.model,
        verbose=args.verbose,
        query_set_override=query_set_override,
    )

    print(json.dumps(result, indent=2))


if __name__ == "__main__":
    main()
