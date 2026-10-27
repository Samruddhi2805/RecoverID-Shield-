# Run all test suites across smart contracts, shared package, backend, and frontend
$ErrorActionPreference = "Stop"
$env:PATH += ";$env:USERPROFILE\.foundry\bin"

Write-Host "=========================================" -ForegroundColor Cyan
Write-Host " Running Foundry Smart Contract Tests" -ForegroundColor Cyan
Write-Host "=========================================" -ForegroundColor Cyan
Set-Location contracts
forge test -vv
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
Set-Location ..

Write-Host "`n=========================================" -ForegroundColor Cyan
Write-Host " Running Shared Cryptography Tests" -ForegroundColor Cyan
Write-Host "=========================================" -ForegroundColor Cyan
pnpm --filter @recoverid/shared test
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

Write-Host "`n=========================================" -ForegroundColor Cyan
Write-Host " Running Express Backend Integration Tests" -ForegroundColor Cyan
Write-Host "=========================================" -ForegroundColor Cyan
pnpm --filter @recoverid/api test
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

Write-Host "`n=========================================" -ForegroundColor Cyan
Write-Host " Running Frontend React Component Tests" -ForegroundColor Cyan
Write-Host "=========================================" -ForegroundColor Cyan
pnpm --filter @recoverid/web test
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

Write-Host "`n=========================================" -ForegroundColor Green
Write-Host " ALL TEST SUITES PASSED CLEANLY!" -ForegroundColor Green
Write-Host "=========================================" -ForegroundColor Green
