#!/usr/bin/env bash
set -e

echo "Deploying RecoverID Shield to local Anvil..."
pnpm --filter @recoverid/api exec tsx ../../scripts/deploy-local.ts
