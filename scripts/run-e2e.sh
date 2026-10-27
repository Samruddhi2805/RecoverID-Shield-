#!/usr/bin/env bash
set -e

echo "Running automated end-to-end recovery verification against Anvil..."
pnpm --filter @recoverid/api exec tsx ../../scripts/run-e2e.ts
