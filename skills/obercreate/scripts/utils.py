#!/usr/bin/env python3
"""Shared utilities for obercreate description optimization pipeline.

Provides frontmatter parsing for SKILL.md files and a wrapper for
invoking `claude -p` as a subprocess (text mode, no streaming).
"""

import os
import subprocess
from pathlib import Path


def parse_frontmatter(skill_path):
    """Parse YAML frontmatter from a SKILL.md file.

    Args:
        skill_path: Path to directory containing SKILL.md (str or Path).

    Returns:
        Tuple of (name, description, full_content) where name and description
        are extracted from the YAML frontmatter and full_content is the
        entire file text.

    Raises:
        FileNotFoundError: If SKILL.md does not exist at skill_path.
        ValueError: If no valid YAML frontmatter (--- delimiters) is found.
    """
    skill_file = Path(skill_path) / "SKILL.md"
    content = skill_file.read_text()

    # Find opening and closing --- delimiters
    if not content.startswith("---"):
        raise ValueError(f"No frontmatter found in {skill_file}")

    close_idx = content.find("---", 3)
    if close_idx < 0:
        raise ValueError(f"No closing frontmatter delimiter in {skill_file}")

    frontmatter_block = content[3:close_idx].strip()

    name = ""
    description = ""

    lines = frontmatter_block.split("\n")
    idx = 0
    while idx < len(lines):
        line = lines[idx]

        if line.startswith("name:"):
            name = line[len("name:"):].strip()

        elif line.startswith("description:"):
            value = line[len("description:"):].strip()
            # Handle multiline YAML (| or >)
            if value in ("|", ">"):
                parts = []
                idx += 1
                while idx < len(lines):
                    next_line = lines[idx]
                    # Continuation lines are indented
                    if next_line and (next_line[0] == " " or next_line[0] == "\t"):
                        parts.append(next_line.strip())
                    else:
                        break
                    idx += 1
                joiner = "\n" if value == "|" else " "
                description = joiner.join(parts)
                continue  # skip idx increment, already advanced
            else:
                description = value

        idx += 1

    return (name, description, content)


def call_claude(prompt, model=None, timeout=300):
    """Invoke claude CLI in prompt mode and return the text response.

    Strips CLAUDE_CODE_ENTRYPOINT from the environment so nested
    `claude -p` calls work correctly.

    Args:
        prompt: The prompt string to send on stdin.
        model: Optional model name to pass via --model.
        timeout: Subprocess timeout in seconds (default 300).

    Returns:
        Stripped stdout text from claude.

    Raises:
        RuntimeError: If claude exits with a nonzero status.
        subprocess.TimeoutExpired: If the process exceeds timeout.
    """
    cmd = ["claude", "-p", "--output-format", "text"]
    if model:
        cmd.extend(["--model", model])

    env = {k: v for k, v in os.environ.items() if k != "CLAUDE_CODE_ENTRYPOINT"}

    result = subprocess.run(
        cmd,
        input=prompt,
        capture_output=True,
        text=True,
        timeout=timeout,
        env=env,
    )

    if result.returncode != 0:
        raise RuntimeError(
            f"claude exited with code {result.returncode}: {result.stderr.strip()}"
        )

    return result.stdout.strip()
