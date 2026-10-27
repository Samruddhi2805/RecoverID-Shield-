# Deploy contracts to local Anvil
$ErrorActionPreference = "Stop"
Write-Host "Deploying RecoverID Shield to local Anvil..." -ForegroundColor Cyan
pnpm --filter @recoverid/api exec tsx ../../scripts/deploy-local.ts
