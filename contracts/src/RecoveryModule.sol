// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {ECDSA} from "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import {MessageHashUtils} from "@openzeppelin/contracts/utils/cryptography/MessageHashUtils.sol";
import {SmartWallet} from "./SmartWallet.sol";

/**
 * @title RecoveryModule
 * @notice Enforces 2-of-3 social recovery for SmartWallet instances with
 *         cryptographic verification, configurable time-lock security delay,
 *         rigorous cancellation policies, and replay protection.
 */
contract RecoveryModule {
    // --- Constants ---
    uint256 public constant GUARDIAN_COUNT = 3;
    uint256 public constant THRESHOLD = 2;
    uint256 public constant DEFAULT_DELAY = 1 days;
    uint256 public constant MIN_DELAY = 60 seconds;
    uint256 public constant MAX_DELAY = 30 days;
    uint256 public constant EXPIRY_WINDOW = 7 days;

    bytes32 public constant DOMAIN_TYPEHASH =
        keccak256("EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)");
    bytes32 public constant APPROVAL_TYPEHASH =
        keccak256("ApproveRecovery(uint256 requestId,address wallet,address proposedOwner,uint256 nonce)");

    // --- Structs ---
    struct RecoveryRequest {
        uint256 id;
        address wallet;
        address proposedOwner;
        uint256 createdAt;
        uint256 executionDelay;
        uint256 expirationTime;
        uint256 approvalCount;
        bool executed;
        bool canceled;
        address initiator;
    }

    // --- State Variables ---
    uint256 public nextRequestId = 1;

    // wallet => guardians array
    mapping(address => address[GUARDIAN_COUNT]) internal _walletGuardians;
    // wallet => guardian => isRegistered
    mapping(address => mapping(address => bool)) public isGuardian;
    // wallet => configured
    mapping(address => bool) public guardiansConfigured;
    // wallet => custom recovery delay
    mapping(address => uint256) public walletDelay;
    // wallet => active requestId (0 if none)
    mapping(address => uint256) public activeRequestId;

    // requestId => RecoveryRequest
    mapping(uint256 => RecoveryRequest) public requests;
    // requestId => guardian => approved
    mapping(uint256 => mapping(address => bool)) public requestApprovals;
    // guardian => nonce for signature approvals
    mapping(address => uint256) public guardianNonces;

    // --- Events ---
    event GuardiansRegistered(address indexed wallet, address[GUARDIAN_COUNT] guardians);
    event DelayUpdated(address indexed wallet, uint256 newDelay);
    event RecoveryInitiated(
        uint256 indexed requestId,
        address indexed wallet,
        address indexed proposedOwner,
        address initiator,
        uint256 unlockTime,
        uint256 expirationTime
    );
    event RecoveryApproved(
        uint256 indexed requestId,
        address indexed wallet,
        address indexed guardian,
        uint256 totalApprovals
    );
    event RecoveryCanceled(
        uint256 indexed requestId,
        address indexed wallet,
        address indexed canceledBy,
        string reason
    );
    event RecoveryExecuted(
        uint256 indexed requestId,
        address indexed wallet,
        address indexed oldOwner,
        address newOwner
    );

    // --- Custom Errors ---
    error GuardiansAlreadyConfigured();
    error GuardiansNotConfigured();
    error InvalidGuardianAddress(address guardian);
    error DuplicateGuardianAddress(address guardian);
    error GuardianCannotBeOwner(address guardian);
    error GuardianCannotBeWallet(address guardian);
    error NotWalletOwner(address caller);
    error InvalidDelay(uint256 delay);
    error ActiveRecoveryPending(uint256 requestId);
    error NoActiveRecovery();
    error RequestNotFound(uint256 requestId);
    error RequestAlreadyExecuted(uint256 requestId);
    error RequestCanceled(uint256 requestId);
    error RequestExpired(uint256 requestId, uint256 expirationTime, uint256 currentTime);
    error DelayNotElapsed(uint256 unlockTime, uint256 currentTime);
    error ThresholdNotReached(uint256 approvals, uint256 required);
    error NotAuthorizedGuardian(address caller);
    error GuardianAlreadyApproved(uint256 requestId, address guardian);
    error InvalidProposedOwner(address proposedOwner);
    error ProposedOwnerCannotBeGuardian(address proposedOwner);
    error UnauthorizedCancellation(address caller);
    error UnauthorizedCaller(address caller);
    error InvalidSignature();

    // --- Modifiers ---
    // Factory authorized to atomically initialize new wallets
    address public walletFactory;

    modifier onlyWalletOwner(address wallet) {
        if (msg.sender != SmartWallet(payable(wallet)).owner()) {
            revert NotWalletOwner(msg.sender);
        }
        _;
    }

    constructor(address _factory) {
        walletFactory = _factory;
    }

    /**
     * @notice Set or update the factory contract address
     * @param _factory Address of the wallet factory
     */
    function setWalletFactory(address _factory) external {
        if (walletFactory != address(0)) {
            // Only allow current factory to update or if not set
            if (msg.sender != walletFactory) revert UnauthorizedCaller(msg.sender);
        }
        walletFactory = _factory;
    }

    /**
     * @notice Register guardians directly by an authorized factory during deployment
     */
    function registerGuardiansByFactory(
        address wallet,
        address[GUARDIAN_COUNT] calldata guardians
    ) external {
        if (msg.sender != walletFactory) {
            revert UnauthorizedCaller(msg.sender);
        }
        if (guardiansConfigured[wallet]) {
            revert GuardiansAlreadyConfigured();
        }
        address currentOwner = SmartWallet(payable(wallet)).owner();
        _validateAndSetGuardians(wallet, currentOwner, guardians);
    }

    /**
     * @notice Returns EIP-712 Domain Separator
     */
    function domainSeparator() public view returns (bytes32) {
        return keccak256(
            abi.encode(
                DOMAIN_TYPEHASH,
                keccak256(bytes("RecoverID RecoveryModule")),
                keccak256(bytes("1")),
                block.chainid,
                address(this)
            )
        );
    }

    /**
     * @notice Register exactly three distinct guardians for a smart wallet
     * @param wallet Address of the smart wallet
     * @param guardians Array of 3 distinct guardian addresses
     */
    function registerGuardians(
        address wallet,
        address[GUARDIAN_COUNT] calldata guardians
    ) external {
        address currentOwner = SmartWallet(payable(wallet)).owner();
        if (msg.sender != currentOwner && msg.sender != wallet) {
            revert NotWalletOwner(msg.sender);
        }
        if (guardiansConfigured[wallet]) {
            revert GuardiansAlreadyConfigured();
        }

        _validateAndSetGuardians(wallet, currentOwner, guardians);
    }

    /**
     * @notice Update guardians if already configured and no active recovery is pending
     * @param wallet Address of the smart wallet
     * @param newGuardians Array of 3 new guardian addresses
     */
    function updateGuardians(
        address wallet,
        address[GUARDIAN_COUNT] calldata newGuardians
    ) external onlyWalletOwner(wallet) {
        if (!guardiansConfigured[wallet]) {
            revert GuardiansNotConfigured();
        }
        uint256 activeId = activeRequestId[wallet];
        if (activeId != 0 && !requests[activeId].executed && !requests[activeId].canceled) {
            if (block.timestamp <= requests[activeId].expirationTime) {
                revert ActiveRecoveryPending(activeId);
            }
        }

        // Clear existing guardian flags
        address[GUARDIAN_COUNT] memory oldGuardians = _walletGuardians[wallet];
        for (uint256 i = 0; i < GUARDIAN_COUNT; i++) {
            isGuardian[wallet][oldGuardians[i]] = false;
        }

        address currentOwner = SmartWallet(payable(wallet)).owner();
        _validateAndSetGuardians(wallet, currentOwner, newGuardians);
    }

    /**
     * @dev Internal helper to validate and assign 3 distinct guardians
     */
    function _validateAndSetGuardians(
        address wallet,
        address currentOwner,
        address[GUARDIAN_COUNT] memory guardians
    ) internal {
        for (uint256 i = 0; i < GUARDIAN_COUNT; i++) {
            address g = guardians[i];
            if (g == address(0)) revert InvalidGuardianAddress(g);
            if (g == wallet) revert GuardianCannotBeWallet(g);
            if (g == currentOwner) revert GuardianCannotBeOwner(g);

            for (uint256 j = 0; j < i; j++) {
                if (guardians[j] == g) revert DuplicateGuardianAddress(g);
            }

            _walletGuardians[wallet][i] = g;
            isGuardian[wallet][g] = true;
        }

        guardiansConfigured[wallet] = true;
        emit GuardiansRegistered(wallet, guardians);
    }

    /**
     * @notice Configure custom security delay for wallet (between MIN_DELAY and MAX_DELAY)
     * @param wallet Smart wallet address
     * @param delay Delay in seconds
     */
    function setWalletRecoveryDelay(address wallet, uint256 delay) external onlyWalletOwner(wallet) {
        if (delay < MIN_DELAY || delay > MAX_DELAY) {
            revert InvalidDelay(delay);
        }
        uint256 activeId = activeRequestId[wallet];
        if (activeId != 0 && !requests[activeId].executed && !requests[activeId].canceled) {
            if (block.timestamp <= requests[activeId].expirationTime) {
                revert ActiveRecoveryPending(activeId);
            }
        }

        walletDelay[wallet] = delay;
        emit DelayUpdated(wallet, delay);
    }

    /**
     * @notice Initiate social recovery for a smart wallet
     * @param wallet Address of the smart wallet
     * @param proposedOwner New address to receive wallet ownership
     * @return requestId Unique request identifier
     */
    function initiateRecovery(
        address wallet,
        address proposedOwner
    ) external returns (uint256 requestId) {
        if (!guardiansConfigured[wallet]) {
            revert GuardiansNotConfigured();
        }

        address currentOwner = SmartWallet(payable(wallet)).owner();
        if (
            proposedOwner == address(0) ||
            proposedOwner == wallet ||
            proposedOwner == currentOwner
        ) {
            revert InvalidProposedOwner(proposedOwner);
        }

        if (isGuardian[wallet][proposedOwner]) {
            revert ProposedOwnerCannotBeGuardian(proposedOwner);
        }

        // Check if there is an existing pending recovery
        uint256 existingId = activeRequestId[wallet];
        if (existingId != 0) {
            RecoveryRequest storage existing = requests[existingId];
            if (!existing.executed && !existing.canceled) {
                if (block.timestamp <= existing.expirationTime) {
                    revert ActiveRecoveryPending(existingId);
                }
            }
        }

        requestId = nextRequestId++;
        uint256 delay = walletDelay[wallet] == 0 ? DEFAULT_DELAY : walletDelay[wallet];
        uint256 unlockTime = block.timestamp + delay;
        uint256 expirationTime = unlockTime + EXPIRY_WINDOW;

        RecoveryRequest storage req = requests[requestId];
        req.id = requestId;
        req.wallet = wallet;
        req.proposedOwner = proposedOwner;
        req.createdAt = block.timestamp;
        req.executionDelay = delay;
        req.expirationTime = expirationTime;
        req.initiator = msg.sender;
        req.approvalCount = 0;

        activeRequestId[wallet] = requestId;

        emit RecoveryInitiated(
            requestId,
            wallet,
            proposedOwner,
            msg.sender,
            unlockTime,
            expirationTime
        );

        // If initiator is a guardian, record initial approval immediately
        if (isGuardian[wallet][msg.sender]) {
            req.approvalCount = 1;
            requestApprovals[requestId][msg.sender] = true;
            emit RecoveryApproved(requestId, wallet, msg.sender, 1);
        }
    }

    /**
     * @notice Approve recovery request as a registered guardian
     * @param requestId Request identifier
     */
    function approveRecovery(uint256 requestId) external {
        _approveRecoveryInternal(requestId, msg.sender);
    }

    /**
     * @notice Approve recovery request using a guardian's EIP-712 cryptographic signature
     * @param requestId Request identifier
     * @param signature Cryptographic signature by a registered guardian
     */
    function approveRecoveryBySignature(uint256 requestId, bytes calldata signature) external {
        RecoveryRequest storage req = requests[requestId];
        if (req.id == 0) revert RequestNotFound(requestId);

        bytes32 structHash = keccak256(
            abi.encode(
                APPROVAL_TYPEHASH,
                requestId,
                req.wallet,
                req.proposedOwner,
                guardianNonces[msg.sender]
            )
        );
        bytes32 digest = MessageHashUtils.toTypedDataHash(domainSeparator(), structHash);
        address guardian = ECDSA.recover(digest, signature);

        if (!isGuardian[req.wallet][guardian]) {
            revert InvalidSignature();
        }

        guardianNonces[guardian]++;
        _approveRecoveryInternal(requestId, guardian);
    }

    /**
     * @dev Internal approval logic with validations
     */
    function _approveRecoveryInternal(uint256 requestId, address guardian) internal {
        RecoveryRequest storage req = requests[requestId];
        if (req.id == 0) revert RequestNotFound(requestId);
        if (req.executed) revert RequestAlreadyExecuted(requestId);
        if (req.canceled) revert RequestCanceled(requestId);
        if (block.timestamp > req.expirationTime) {
            revert RequestExpired(requestId, req.expirationTime, block.timestamp);
        }

        if (!isGuardian[req.wallet][guardian]) {
            revert NotAuthorizedGuardian(guardian);
        }
        if (requestApprovals[requestId][guardian]) {
            revert GuardianAlreadyApproved(requestId, guardian);
        }

        requestApprovals[requestId][guardian] = true;
        req.approvalCount += 1;

        emit RecoveryApproved(requestId, req.wallet, guardian, req.approvalCount);
    }

    /**
     * @notice Cancel pending recovery request
     * @dev Callable by the current wallet owner at ANY time before execution,
     *      or by the initiator before threshold is reached.
     * @param requestId Request identifier
     * @param reason Human readable cancellation reason
     */
    function cancelRecovery(uint256 requestId, string calldata reason) external {
        RecoveryRequest storage req = requests[requestId];
        if (req.id == 0) revert RequestNotFound(requestId);
        if (req.executed) revert RequestAlreadyExecuted(requestId);
        if (req.canceled) revert RequestCanceled(requestId);

        address currentOwner = SmartWallet(payable(req.wallet)).owner();
        bool isOwner = (msg.sender == currentOwner || msg.sender == req.wallet);
        bool isInitiator = (msg.sender == req.initiator && req.approvalCount < THRESHOLD);
        bool isWalletGuardian = isGuardian[req.wallet][msg.sender];

        if (!isOwner && !isInitiator && !isWalletGuardian) {
            revert UnauthorizedCancellation(msg.sender);
        }

        req.canceled = true;
        if (activeRequestId[req.wallet] == requestId) {
            activeRequestId[req.wallet] = 0;
        }

        emit RecoveryCanceled(requestId, req.wallet, msg.sender, reason);
    }

    /**
     * @notice Complete recovery and replace owner after threshold and delay are satisfied
     * @param requestId Request identifier
     */
    function executeRecovery(uint256 requestId) external {
        RecoveryRequest storage req = requests[requestId];
        if (req.id == 0) revert RequestNotFound(requestId);
        if (req.executed) revert RequestAlreadyExecuted(requestId);
        if (req.canceled) revert RequestCanceled(requestId);
        if (block.timestamp > req.expirationTime) {
            revert RequestExpired(requestId, req.expirationTime, block.timestamp);
        }

        uint256 unlockTime = req.createdAt + req.executionDelay;
        if (block.timestamp < unlockTime) {
            revert DelayNotElapsed(unlockTime, block.timestamp);
        }

        if (req.approvalCount < THRESHOLD) {
            revert ThresholdNotReached(req.approvalCount, THRESHOLD);
        }

        req.executed = true;
        activeRequestId[req.wallet] = 0;

        SmartWallet walletContract = SmartWallet(payable(req.wallet));
        address oldOwner = walletContract.owner();

        emit RecoveryExecuted(requestId, req.wallet, oldOwner, req.proposedOwner);

        // Perform owner replacement on the SmartWallet
        walletContract.changeOwner(req.proposedOwner);
    }

    // --- View Helpers ---

    function getGuardians(address wallet) external view returns (address[GUARDIAN_COUNT] memory) {
        return _walletGuardians[wallet];
    }

    function getRequest(uint256 requestId) external view returns (RecoveryRequest memory) {
        return requests[requestId];
    }

    function hasApproved(uint256 requestId, address guardian) external view returns (bool) {
        return requestApprovals[requestId][guardian];
    }

    function getEffectiveDelay(address wallet) external view returns (uint256) {
        return walletDelay[wallet] == 0 ? DEFAULT_DELAY : walletDelay[wallet];
    }
}
