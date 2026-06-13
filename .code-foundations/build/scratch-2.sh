#!/usr/bin/env bash
set -euo pipefail
cd /Users/r/repos/oberskills/.claude/worktrees/browser-mcp/mcp-browser

echo "=== bun install ==="
bun install 2>&1

echo ""
echo "=== typecheck ==="
bunx tsc --noEmit 2>&1; echo "tsc exit: $?"

echo ""
echo "=== unit tests (non-live) ==="
bun test 2>&1; echo "bun test exit: $?"
