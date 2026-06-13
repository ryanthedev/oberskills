#!/usr/bin/env bash
set -e

cd /Users/r/repos/oberskills/.claude/worktrees/browser-mcp/mcp-browser

echo "=== bun install ==="
bun install 2>&1

echo ""
echo "=== bunx tsc --noEmit ==="
bunx tsc --noEmit 2>&1
echo "tsc exit: $?"

echo ""
echo "=== bun test (unit suite, no live tests) ==="
bun test 2>&1
echo "bun test exit: $?"

echo ""
echo "=== static puppeteer check in src/core and src/tools ==="
echo "--- src/core ---"
grep -rn "puppeteer" /Users/r/repos/oberskills/.claude/worktrees/browser-mcp/mcp-browser/src/core/ 2>&1 || echo "(none)"
echo "--- src/tools ---"
grep -rn "puppeteer" /Users/r/repos/oberskills/.claude/worktrees/browser-mcp/mcp-browser/src/tools/ 2>&1 || echo "(none)"

echo ""
echo "=== console.log check in src/ ==="
grep -rn "console\.log" /Users/r/repos/oberskills/.claude/worktrees/browser-mcp/mcp-browser/src/ 2>&1 || echo "(none)"

echo ""
echo "=== plugin.json validity ==="
python3 -c "import json,sys; json.load(open('$(pwd)/../.claude-plugin/plugin.json')); print('valid JSON')"

echo ""
echo "=== Done ==="
