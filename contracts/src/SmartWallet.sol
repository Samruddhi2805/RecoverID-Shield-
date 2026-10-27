// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {ECDSA} from "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import {MessageHashUtils} from "@openzeppelin/contracts/utils/cryptography/MessageHashUtils.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {Address} from "@openzeppelin/contracts/utils/Address.sol";

/**
 * @title SmartWallet
 * @notice Self-custodial smart contract wallet supporting direct owner execution,
 *         EIP-712/digest signed transaction authorization, native/ERC-20 transfers,
 *         and ownership replacement strictly restricted to an authorized RecoveryModule.
 */
contract SmartWallet {
    using SafeERC20 for IERC20;
    using Address for address payable;

    // --- State Variables ---
    address public owner;
    address public recoveryModule;
    uint256 public nonce;
    bool public initialized;

    // --- EIP-712 Type Hashes ---
    bytes32 public constant DOMAIN_TYPEHASH =
        keccak256("EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)");
    bytes32 public constant EXECUTE_TYPEHASH =
        keccak256("Execute(address target,uint256 value,bytes data,uint256 nonce)");

    // --- Events ---
    event Initialized(address indexed owner, address indexed recoveryModule);
    event TransactionExecuted(address indexed target, uint256 value, bytes data, bytes returnData);
    event OwnerChanged(address indexed previousOwner, address indexed newOwner);
    event RecoveryModuleUpdated(address indexed previousModule, address indexed newModule);
    event NativeTransferred(address indexed recipient, uint256 amount);
    event ERC20Transferred(address indexed token, address indexed recipient, uint256 amount);
    event Received(address indexed sender, uint256 amount);

    // --- Custom Errors ---
    error AlreadyInitialized();
    error NotInitialized();
    error UnauthorizedCaller(address caller);
    error OnlyRecoveryModule(address caller, address recoveryModule);
    error InvalidOwnerAddress(address proposedOwner);
    error InvalidRecoveryModuleAddress();
    error InvalidSignature();
    error InvalidNonce(uint256 expected, uint256 provided);
    error TargetCallFailed(bytes returnData);
    error InsufficientBalance(uint256 requested, uint256 available);

    // --- Modifiers ---
    modifier onlyOwner() {
        if (msg.sender != owner) {
            revert UnauthorizedCaller(msg.sender);
        }
        _;
    }

    modifier onlyRecoveryModule() {
        if (msg.sender != recoveryModule) {
            revert OnlyRecoveryModule(msg.sender, recoveryModule);
        }
        _;
    }

    /**
     * @notice Constructor leaves contract uninitialized to allow factory clone/initialization pattern
     */
    constructor() {
        // Implementation constructor
    }

    /**
     * @notice Initializes wallet with owner and recovery module
     * @param _owner Initial wallet owner
     * @param _recoveryModule Address of authorized recovery module
     */
    function initialize(address _owner, address _recoveryModule) external {
        if (initialized) revert AlreadyInitialized();
        if (_owner == address(0) || _owner == address(this)) revert InvalidOwnerAddress(_owner);
        if (_recoveryModule == address(0)) revert InvalidRecoveryModuleAddress();

        initialized = true;
        owner = _owner;
        recoveryModule = _recoveryModule;

        emit Initialized(_owner, _recoveryModule);
    }

    /**
     * @notice Returns the EIP-712 domain separator
     */
    function domainSeparator() public view returns (bytes32) {
        return keccak256(
            abi.encode(
                DOMAIN_TYPEHASH,
                keccak256(bytes("RecoverID SmartWallet")),
                keccak256(bytes("1")),
                block.chainid,
                address(this)
            )
        );
    }

    /**
     * @notice Execute a transaction directly by the owner
     * @param target Contract or account address to call
     * @param value Native wei value to send
     * @param data Calldata for the transaction
     */
    function execute(
        address target,
        uint256 value,
        bytes calldata data
    ) external payable onlyOwner returns (bytes memory) {
        if (address(this).balance < value) {
            revert InsufficientBalance(value, address(this).balance);
        }

        (bool success, bytes memory returnData) = target.call{value: value}(data);
        if (!success) {
            revert TargetCallFailed(returnData);
        }

        emit TransactionExecuted(target, value, data, returnData);
        return returnData;
    }

    /**
     * @notice Execute a transaction signed off-chain by the owner
     * @param target Destination address
     * @param value ETH amount in wei
     * @param data Payload data
     * @param _nonce Replay protection nonce
     * @param signature Owner's cryptographic ECDSA signature
     */
    function executeSigned(
        address target,
        uint256 value,
        bytes calldata data,
        uint256 _nonce,
        bytes calldata signature
    ) external payable returns (bytes memory) {
        if (_nonce != nonce) {
            revert InvalidNonce(nonce, _nonce);
        }
        if (address(this).balance < value) {
            revert InsufficientBalance(value, address(this).balance);
        }

        bytes32 structHash = keccak256(
            abi.encode(EXECUTE_TYPEHASH, target, value, keccak256(data), _nonce)
        );
        bytes32 digest = MessageHashUtils.toTypedDataHash(domainSeparator(), structHash);
        address recoveredSigner = ECDSA.recover(digest, signature);

        if (recoveredSigner != owner) {
            revert InvalidSignature();
        }

        nonce++;

        (bool success, bytes memory returnData) = target.call{value: value}(data);
        if (!success) {
            revert TargetCallFailed(returnData);
        }

        emit TransactionExecuted(target, value, data, returnData);
        return returnData;
    }

    /**
     * @notice Convenience function to transfer native ETH
     * @param recipient Target recipient
     * @param amount Amount in wei
     */
    function transferNative(address payable recipient, uint256 amount) external onlyOwner {
        if (address(this).balance < amount) {
            revert InsufficientBalance(amount, address(this).balance);
        }
        recipient.sendValue(amount);
        emit NativeTransferred(recipient, amount);
    }

    /**
     * @notice Convenience function to transfer ERC-20 tokens
     * @param token Address of ERC-20 contract
     * @param recipient Target recipient
     * @param amount Token amount
     */
    function transferERC20(address token, address recipient, uint256 amount) external onlyOwner {
        IERC20(token).safeTransfer(recipient, amount);
        emit ERC20Transferred(token, recipient, amount);
    }

    /**
     * @notice Replaces wallet owner. STRICTLY CALLABLE ONLY BY THE RECOVERY MODULE.
     * @param newOwner Address of new authorized owner
     */
    function changeOwner(address newOwner) external onlyRecoveryModule {
        if (newOwner == address(0) || newOwner == address(this) || newOwner == owner) {
            revert InvalidOwnerAddress(newOwner);
        }

        address previousOwner = owner;
        owner = newOwner;

        emit OwnerChanged(previousOwner, newOwner);
    }

    /**
     * @notice Update recovery module address if authorized by current owner
     * @param newModule Address of new recovery module
     */
    function setRecoveryModule(address newModule) external onlyOwner {
        if (newModule == address(0) || newModule == address(this)) {
            revert InvalidRecoveryModuleAddress();
        }
        address previous = recoveryModule;
        recoveryModule = newModule;
        emit RecoveryModuleUpdated(previous, newModule);
    }

    /**
     * @dev Accept native ETH deposits
     */
    receive() external payable {
        emit Received(msg.sender, msg.value);
    }

    fallback() external payable {
        emit Received(msg.sender, msg.value);
    }
}
