#!/usr/bin/env bash
set -euo pipefail
cd /Users/r/repos/oberskills/.claude/worktrees/browser-mcp/mcp-browser

echo "=== bun install ==="
bun install 2>&1 || true

echo ""
echo "=== typecheck ==="
bunx tsc --noEmit 2>&1; echo "tsc exit: $?"

echo ""
echo "=== unit tests (non-live) — verbose for phase4 files ==="
bun test --timeout 30000 test/perf-network.test.ts test/har-writer.test.ts 2>&1; echo "bun test exit: $?"

echo ""
echo "=== full suite for reference ==="
bun test --timeout 30000 2>&1; echo "full test exit: $?"
