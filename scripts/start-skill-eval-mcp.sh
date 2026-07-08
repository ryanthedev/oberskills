#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT/mcp"
if [ ! -d node_modules ]; then
  echo "Missing mcp/node_modules. Installing dependencies in $ROOT/mcp ..." >&2
  bun install --silent
fi
exec bun run src/server.ts
