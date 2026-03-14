#!/usr/bin/env python3
"""Validate and package a skill into a .skill file."""

import sys
import argparse
import zipfile
from pathlib import Path

from scripts.quick_validate import validate_skill

# Directories excluded everywhere in the tree
EXCLUDE_DIRS = {"__pycache__", "node_modules", ".git"}
# Filenames excluded everywhere
EXCLUDE_FILES = {".DS_Store"}
# Extensions excluded everywhere
EXCLUDE_EXTENSIONS = {".pyc"}
# Directories excluded only at the skill root level
ROOT_EXCLUDE_DIRS = {"evals"}


def should_exclude(rel_path: Path, is_root_level: bool = False) -> bool:
    """Check if a path should be excluded from packaging.

    Args:
        rel_path: Path relative to the skill directory root.
        is_root_level: True when checking against root-only exclusions.

    Returns:
        True if the file should be skipped during packaging.
    """
    for part in rel_path.parts:
        if part in EXCLUDE_DIRS:
            return True
    if rel_path.name in EXCLUDE_FILES:
        return True
    if rel_path.suffix in EXCLUDE_EXTENSIONS:
        return True
    if is_root_level and rel_path.parts[0] in ROOT_EXCLUDE_DIRS:
        return True
    return False


def package_skill(
    skill_path: str | Path, output_dir: str | Path | None = None
) -> Path | None:
    """Validate and package a skill directory into a .skill zip file.

    Runs validation first; if validation fails, prints errors to stderr
    and returns None without creating any file. On success, creates a
    ZIP_DEFLATED archive named {skill_name}.skill with the skill directory
    name as the archive root.

    Args:
        skill_path: Path to the skill directory.
        output_dir: Where to write the .skill file (default: cwd).

    Returns:
        Path to the created .skill file, or None on validation failure.
    """
    skill_path = Path(skill_path).resolve()

    if not skill_path.is_dir():
        print(f"Error: {skill_path} is not a directory", file=sys.stderr)
        return None

    valid, issues = validate_skill(skill_path)
    if not valid:
        print("Validation failed:", file=sys.stderr)
        for issue in issues:
            print(f"  - {issue}", file=sys.stderr)
        return None

    skill_name = skill_path.name
    output_dir = Path(output_dir).resolve() if output_dir else Path.cwd()
    output_dir.mkdir(parents=True, exist_ok=True)
    output_path = output_dir / f"{skill_name}.skill"

    file_count = 0
    with zipfile.ZipFile(output_path, 'w', zipfile.ZIP_DEFLATED) as zf:
        for file_path in sorted(skill_path.rglob("*")):
            if not file_path.is_file():
                continue
            rel_path = file_path.relative_to(skill_path)
            is_root = (
                len(rel_path.parts) == 1
                or rel_path.parts[0] in ROOT_EXCLUDE_DIRS
            )
            if should_exclude(rel_path, is_root_level=is_root):
                continue
            arc_name = Path(skill_name) / rel_path
            zf.write(file_path, arc_name)
            file_count += 1

    print(f"Packaged {file_count} files → {output_path}")
    return output_path


def main():
    parser = argparse.ArgumentParser(
        description="Package a Claude Code skill"
    )
    parser.add_argument("skill_path", help="Path to skill directory")
    parser.add_argument(
        "--output", help="Output directory (default: current directory)"
    )
    args = parser.parse_args()

    result = package_skill(args.skill_path, args.output)
    sys.exit(0 if result else 1)


if __name__ == "__main__":
    main()
