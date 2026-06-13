#!/usr/bin/env bash
set -euo pipefail
cd /Users/r/repos/oberskills/.claude/worktrees/browser-mcp/mcp-browser

echo "=== bun install ==="
bun install 2>&1

echo ""
echo "=== typecheck ==="
bunx tsc --noEmit 2>&1
echo "typecheck exit: $?"

echo ""
echo "=== unit tests ==="
bun test 2>&1
echo "test exit: $?"
