# Start backend and web dev server concurrently for interactive local demo
$ErrorActionPreference = "Stop"
Write-Host "Starting RecoverID Shield Backend API & Frontend Dashboard..." -ForegroundColor Cyan

Start-Process powershell -ArgumentList "-NoExit", "-Command", "pnpm --filter @recoverid/api dev"
Start-Process powershell -ArgumentList "-NoExit", "-Command", "pnpm --filter @recoverid/web dev"

Write-Host "Services launched:" -ForegroundColor Green
Write-Host "  API Backend: http://localhost:4000" -ForegroundColor Yellow
Write-Host "  Web Dashboard: http://localhost:5173" -ForegroundColor Yellow
