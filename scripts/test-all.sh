#!/usr/bin/env bash
set -e

echo "=== Running Foundry Smart Contract Tests ==="
cd contracts && forge test -vv && cd ..

echo "=== Running Shared Package Cryptography Tests ==="
pnpm --filter @recoverid/shared test

echo "=== Running Express Backend Integration Tests ==="
pnpm --filter @recoverid/api test

echo "=== Running Frontend React Component Tests ==="
pnpm --filter @recoverid/web test

echo "=== ALL TESTS PASSED SUCCESSFULLY! ==="
