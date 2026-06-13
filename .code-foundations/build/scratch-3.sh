#!/usr/bin/env bash
set -uo pipefail

cd /Users/r/repos/oberskills/.claude/worktrees/browser-mcp/mcp-browser

echo "=== bun install ==="
bun install 2>&1; echo "install exit: $?"

echo ""
echo "=== bunx tsc --noEmit ==="
bunx tsc --noEmit 2>&1; echo "tsc exit: $?"

echo ""
echo "=== bun test (unit suite, no live) ==="
bun test 2>&1; echo "bun-test exit: $?"
