#!/usr/bin/env python3
"""Lightweight skill validation without packaging."""

import sys
import re
import argparse
from pathlib import Path

ALLOWED_FRONTMATTER_KEYS = {
    "name", "description", "allowed-tools", "metadata", "compatibility"
}


def validate_frontmatter(content: str) -> tuple[bool, list[str]]:
    """Validate SKILL.md frontmatter format and required fields.

    Checks for opening/closing --- delimiters, required name/description
    fields, name format (lowercase kebab-case, max 64 chars), description
    length (max 1024 chars), and unexpected frontmatter keys.

    Args:
        content: Full text content of a SKILL.md file.

    Returns:
        Tuple of (valid, issues) where valid is True if no issues found
        and issues is a list of human-readable problem descriptions.
    """
    issues = []

    if not content.startswith("---"):
        return False, ["Missing frontmatter (no opening ---)"]

    end = content.find("---", 3)
    if end == -1:
        return False, ["Unclosed frontmatter (no closing ---)"]

    frontmatter = content[3:end].strip()

    # Validate name field
    name_match = re.search(r'^name:\s*(.+)$', frontmatter, re.MULTILINE)
    if not name_match:
        issues.append("Missing 'name' field")
    else:
        name = name_match.group(1).strip().strip('"').strip("'")
        if len(name) > 64:
            issues.append(f"Name too long: {len(name)} chars (max 64)")
        if len(name) > 1:
            if not re.match(r'^[a-z0-9][a-z0-9-]*[a-z0-9]$', name):
                issues.append(f"Name must be lowercase kebab-case: {name}")
        elif len(name) == 1:
            if not re.match(r'^[a-z0-9]$', name):
                issues.append(f"Name must be lowercase kebab-case: {name}")

    # Validate description field
    # Note: multiline YAML (| or >) is handled by utils.parse_frontmatter.
    # This regex handles the common single-line case for validation purposes.
    desc_match = re.search(
        r'^description:\s*(.+?)(?=\n[a-z]|\Z)',
        frontmatter,
        re.MULTILINE | re.DOTALL,
    )
    if not desc_match:
        issues.append("Missing 'description' field")
    else:
        desc = desc_match.group(1).strip().strip('"').strip("'")
        if len(desc) > 1024:
            issues.append(
                f"Description too long: {len(desc)} chars (max 1024)"
            )

    # Check for unexpected keys
    found_keys = set(
        re.findall(r'^([a-z][a-z-]*):', frontmatter, re.MULTILINE)
    )
    unexpected = found_keys - ALLOWED_FRONTMATTER_KEYS
    if unexpected:
        issues.append(
            f"Unexpected frontmatter keys: {', '.join(sorted(unexpected))}"
        )

    return len(issues) == 0, issues


def validate_structure(skill_path: Path) -> tuple[bool, list[str]]:
    """Validate skill directory structure and file constraints.

    Checks that SKILL.md exists and is under 500 lines, that references/
    has no nested subdirectories, and that forbidden files (README.md,
    CHANGELOG.md) are absent.

    Args:
        skill_path: Path to the skill directory.

    Returns:
        Tuple of (valid, issues) where valid is True if no issues found.
    """
    issues = []

    skill_md = skill_path / "SKILL.md"
    if not skill_md.exists():
        return False, ["Missing SKILL.md"]

    lines = skill_md.read_text().splitlines()
    if len(lines) > 500:
        issues.append(f"SKILL.md too long: {len(lines)} lines (max 500)")

    refs_dir = skill_path / "references"
    if refs_dir.exists():
        for item in refs_dir.iterdir():
            if item.is_dir():
                issues.append(
                    f"Nested directory in references/: {item.name}"
                )

    for forbidden in ["README.md", "CHANGELOG.md"]:
        if (skill_path / forbidden).exists():
            issues.append(f"Skills should not include {forbidden}")

    return len(issues) == 0, issues


def validate_skill(skill_path: str | Path) -> tuple[bool, list[str]]:
    """Run all validations on a skill directory.

    Combines structure validation and frontmatter validation into a
    single pass. Safe to call on directories that may be missing SKILL.md
    (will report it as an issue rather than raising).

    Args:
        skill_path: Path to skill directory (str or Path).

    Returns:
        Tuple of (valid, all_issues) across all validation checks.
    """
    skill_path = Path(skill_path)
    all_issues = []

    _struct_ok, struct_issues = validate_structure(skill_path)
    all_issues.extend(struct_issues)

    skill_md = skill_path / "SKILL.md"
    if skill_md.exists():
        content = skill_md.read_text()
        _fm_ok, fm_issues = validate_frontmatter(content)
        all_issues.extend(fm_issues)

    return len(all_issues) == 0, all_issues


def main():
    parser = argparse.ArgumentParser(
        description="Validate a Claude Code skill"
    )
    parser.add_argument("skill_path", help="Path to skill directory")
    args = parser.parse_args()

    valid, issues = validate_skill(args.skill_path)

    if valid:
        print("✓ Skill validation passed")
        sys.exit(0)
    else:
        print("✗ Skill validation failed:")
        for issue in issues:
            print(f"  - {issue}")
        sys.exit(1)


if __name__ == "__main__":
    main()
