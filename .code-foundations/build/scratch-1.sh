#!/usr/bin/env bash
set -o pipefail
cd /Users/r/repos/oberskills/.claude/worktrees/browser-mcp/mcp-browser

echo "=== bun install ==="
bun install 2>&1
echo "install exit: $?"

echo ""
echo "=== typecheck ==="
bunx tsc --noEmit 2>&1
echo "tsc exit: $?"

echo ""
echo "=== unit tests ==="
bun test 2>&1
echo "test exit: $?"
