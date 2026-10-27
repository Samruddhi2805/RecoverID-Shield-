# Start local Anvil blockchain node
$env:PATH += ";$env:USERPROFILE\.foundry\bin"
Write-Host "Starting Anvil on 127.0.0.1:8545 (Chain ID: 31337)..." -ForegroundColor Cyan
anvil --host 127.0.0.1 --port 8545 --chain-id 31337
