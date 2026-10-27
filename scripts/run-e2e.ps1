# Run end-to-end verification
$ErrorActionPreference = "Stop"
Write-Host "Running automated end-to-end recovery verification against Anvil..." -ForegroundColor Cyan
pnpm --filter @recoverid/api exec tsx ../../scripts/run-e2e.ts
