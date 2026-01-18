#!/usr/bin/env python3
"""
Extract code metrics from baseline vs skill-guided implementations.
"""

import ast
import re
from pathlib import Path
from typing import Dict, Any

def analyze_file(filepath: str) -> Dict[str, Any]:
    """Extract metrics from a Python file."""
    with open(filepath, 'r') as f:
        content = f.read()

    tree = ast.parse(content)

    metrics = {
        'lines_total': len(content.split('\n')),
        'lines_code': 0,
        'lines_comment': 0,
        'lines_docstring': 0,
        'public_methods': 0,
        'private_methods': 0,
        'total_params': 0,
        'max_params': 0,
        'classes': 0,
        'has_type_hints': False,
        'has_error_handling': False,
    }

    # Count code lines (non-empty, non-comment)
    for line in content.split('\n'):
        stripped = line.strip()
        if stripped and not stripped.startswith('#'):
            metrics['lines_code'] += 1
        if stripped.startswith('#'):
            metrics['lines_comment'] += 1

    # Analyze AST
    for node in ast.walk(tree):
        if isinstance(node, ast.ClassDef):
            metrics['classes'] += 1

        elif isinstance(node, ast.FunctionDef):
            name = node.name
            if name.startswith('_') and not name.startswith('__'):
                metrics['private_methods'] += 1
            elif not name.startswith('_'):
                metrics['public_methods'] += 1

            # Count parameters (excluding self)
            params = len([arg for arg in node.args.args if arg.arg != 'self'])
            metrics['total_params'] += params
            metrics['max_params'] = max(metrics['max_params'], params)

            # Check for type hints
            if node.returns or any(arg.annotation for arg in node.args.args):
                metrics['has_type_hints'] = True

            # Check for docstring
            if (node.body and isinstance(node.body[0], ast.Expr) and
                isinstance(node.body[0].value, ast.Constant)):
                docstring = node.body[0].value
                if isinstance(docstring.value, str):
                    metrics['lines_docstring'] += len(docstring.value.split('\n'))

        elif isinstance(node, ast.Try):
            metrics['has_error_handling'] = True

    # Calculate interface depth ratio (functionality / interface)
    if metrics['public_methods'] > 0:
        metrics['depth_ratio'] = round(metrics['lines_code'] / metrics['public_methods'], 1)
    else:
        metrics['depth_ratio'] = 0

    return metrics


def compare_implementations():
    """Compare baseline vs skill implementations."""

    # Define the pairs to compare
    pairs = [
        ('UserCache', 'baseline_1_usercache.py', 'skill_1_usercache.py'),
        ('EventEmitter', 'baseline_4_eventemitter.py', 'skill_4_eventemitter.py'),
    ]

    results = []

    for name, baseline_file, skill_file in pairs:
        base_path = Path(__file__).parent

        baseline = analyze_file(base_path / baseline_file)
        skill = analyze_file(base_path / skill_file)

        results.append({
            'name': name,
            'baseline': baseline,
            'skill': skill,
        })

    # Print comparison
    print("=" * 80)
    print("CODE METRICS COMPARISON: BASELINE vs WITH-SKILL")
    print("=" * 80)

    for result in results:
        name = result['name']
        b = result['baseline']
        s = result['skill']

        print(f"\n### {name}")
        print("-" * 40)
        print(f"{'Metric':<25} {'Baseline':>12} {'With Skill':>12} {'Delta':>10}")
        print("-" * 40)

        metrics_to_compare = [
            ('Lines (total)', 'lines_total'),
            ('Lines (code)', 'lines_code'),
            ('Public methods', 'public_methods'),
            ('Private methods', 'private_methods'),
            ('Total params', 'total_params'),
            ('Max params/method', 'max_params'),
            ('Depth ratio', 'depth_ratio'),
            ('Has type hints', 'has_type_hints'),
            ('Has error handling', 'has_error_handling'),
        ]

        for label, key in metrics_to_compare:
            bv = b[key]
            sv = s[key]

            if isinstance(bv, bool):
                delta = '→' if bv == sv else ('✓' if sv else '✗')
                bv = '✓' if bv else '✗'
                sv = '✓' if sv else '✗'
            else:
                delta = sv - bv
                if delta > 0:
                    delta = f"+{delta}"
                elif delta == 0:
                    delta = "="

            print(f"{label:<25} {str(bv):>12} {str(sv):>12} {str(delta):>10}")

    print("\n" + "=" * 80)
    print("SUMMARY")
    print("=" * 80)

    # Aggregate comparison
    total_baseline_public = sum(r['baseline']['public_methods'] for r in results)
    total_skill_public = sum(r['skill']['public_methods'] for r in results)
    total_baseline_lines = sum(r['baseline']['lines_code'] for r in results)
    total_skill_lines = sum(r['skill']['lines_code'] for r in results)

    print(f"\nPublic methods: Baseline={total_baseline_public}, Skill={total_skill_public}")
    print(f"Code lines: Baseline={total_baseline_lines}, Skill={total_skill_lines}")
    print(f"\nInterface surface area change: {total_skill_public - total_baseline_public:+d} methods")
    print(f"Code size change: {total_skill_lines - total_baseline_lines:+d} lines")

    if total_baseline_public > 0 and total_skill_public > 0:
        baseline_depth = total_baseline_lines / total_baseline_public
        skill_depth = total_skill_lines / total_skill_public
        print(f"\nAverage depth ratio: Baseline={baseline_depth:.1f}, Skill={skill_depth:.1f}")
        print(f"  (Higher = more functionality per interface method = 'deeper' module)")


if __name__ == '__main__':
    compare_implementations()
