#!/usr/bin/env bash
set -e

echo "Starting local Anvil node..."
anvil --host 127.0.0.1 --port 8545 --chain-id 31337
