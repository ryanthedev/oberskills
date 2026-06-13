#!/bin/bash
set -e

cd /Users/r/repos/oberskills/.claude/worktrees/browser-mcp/mcp-browser

echo "=== Installing dependencies ==="
bun install

echo "=== Running typecheck ==="
bunx tsc --noEmit

echo "=== Running test suite ==="
bun test

echo "All tests passed!"
