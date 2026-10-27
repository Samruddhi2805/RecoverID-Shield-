// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {SmartWallet} from "./SmartWallet.sol";
import {RecoveryModule} from "./RecoveryModule.sol";

/**
 * @title WalletFactory
 * @notice Factory for deploying and initializing SmartWallet instances with
 *         associated RecoveryModule bindings and optional atomic guardian setup.
 */
contract WalletFactory {
    // --- State Variables ---
    address public immutable recoveryModule;
    address[] public allWallets;
    mapping(address => address[]) internal _userWallets;
    mapping(address => bool) public isCreatedWallet;

    // --- Events ---
    event WalletCreated(
        address indexed wallet,
        address indexed owner,
        address indexed recoveryModule,
        address[3] guardians
    );

    // --- Errors ---
    error InvalidRecoveryModule();
    error InvalidOwner();
    error InitializationFailed();

    /**
     * @param _recoveryModule Address of the deployed social recovery module
     */
    constructor(address _recoveryModule) {
        if (_recoveryModule == address(0)) revert InvalidRecoveryModule();
        recoveryModule = _recoveryModule;
    }

    /**
     * @notice Deploys a new SmartWallet with atomic guardian registration
     * @param _owner Initial owner of the smart wallet (defaults to msg.sender if address(0))
     * @param guardians Exactly 3 guardian addresses (can be zeroes if setup later)
     * @return wallet Address of newly deployed SmartWallet
     */
    function deployWallet(
        address _owner,
        address[3] calldata guardians
    ) external returns (address wallet) {
        address walletOwner = _owner == address(0) ? msg.sender : _owner;
        if (walletOwner == address(0)) revert InvalidOwner();

        SmartWallet newWallet = new SmartWallet();
        wallet = address(newWallet);

        newWallet.initialize(walletOwner, recoveryModule);

        // If guardians are provided, register them atomically
        if (guardians[0] != address(0)) {
            RecoveryModule(recoveryModule).registerGuardiansByFactory(wallet, guardians);
        }

        allWallets.push(wallet);
        _userWallets[walletOwner].push(wallet);
        isCreatedWallet[wallet] = true;

        emit WalletCreated(wallet, walletOwner, recoveryModule, guardians);
    }

    /**
     * @notice Returns total number of wallets deployed by this factory
     */
    function totalWallets() external view returns (uint256) {
        return allWallets.length;
    }

    /**
     * @notice Returns all wallets created for a given owner
     */
    function getWalletsByOwner(address _owner) external view returns (address[] memory) {
        return _userWallets[_owner];
    }
}
