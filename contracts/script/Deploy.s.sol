// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {Script, console} from "forge-std/Script.sol";
import {SmartWallet} from "../src/SmartWallet.sol";
import {RecoveryModule} from "../src/RecoveryModule.sol";
import {WalletFactory} from "../src/WalletFactory.sol";
import {MockERC20} from "../src/MockERC20.sol";

contract DeployScript is Script {
    function run() external {
        uint256 deployerPrivateKey = vm.envOr(
            "DEPLOYER_PRIVATE_KEY",
            uint256(0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80)
        );

        address deployer = vm.addr(deployerPrivateKey);
        console.log("Deployer address:", deployer);

        vm.startBroadcast(deployerPrivateKey);

        // 1. Deploy RecoveryModule
        RecoveryModule recoveryModule = new RecoveryModule(address(0));
        console.log("RecoveryModule deployed at:", address(recoveryModule));

        // 2. Deploy WalletFactory
        WalletFactory factory = new WalletFactory(address(recoveryModule));
        console.log("WalletFactory deployed at:", address(factory));

        // 3. Connect factory to recovery module
        recoveryModule.setWalletFactory(address(factory));
        console.log("Linked WalletFactory to RecoveryModule");

        // 4. Deploy MockERC20 token for testing
        MockERC20 mockToken = new MockERC20("RecoverID USD", "rUSD");
        console.log("MockERC20 (rUSD) deployed at:", address(mockToken));

        vm.stopBroadcast();
    }
}
