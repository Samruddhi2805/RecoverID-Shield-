// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {Test} from "forge-std/Test.sol";
import {SmartWallet} from "../src/SmartWallet.sol";
import {RecoveryModule} from "../src/RecoveryModule.sol";
import {WalletFactory} from "../src/WalletFactory.sol";
import {MockERC20} from "../src/MockERC20.sol";
import {MessageHashUtils} from "@openzeppelin/contracts/utils/cryptography/MessageHashUtils.sol";

contract RecoveryModuleTest is Test {
    SmartWallet public wallet;
    RecoveryModule public recoveryModule;
    WalletFactory public factory;
    MockERC20 public token;

    uint256 internal oldOwnerKey;
    address internal oldOwner;

    uint256 internal newOwnerKey;
    address internal newOwner;

    uint256 internal guardian1Key;
    address internal guardian1;

    uint256 internal guardian2Key;
    address internal guardian2;

    uint256 internal guardian3Key;
    address internal guardian3;

    address internal attacker;
    uint256 internal constant CUSTOM_DELAY = 120 seconds; // 2 minutes

    function setUp() public {
        oldOwnerKey = 0xAA11;
        oldOwner = vm.addr(oldOwnerKey);

        newOwnerKey = 0xBB22;
        newOwner = vm.addr(newOwnerKey);

        guardian1Key = 0x1111;
        guardian1 = vm.addr(guardian1Key);

        guardian2Key = 0x2222;
        guardian2 = vm.addr(guardian2Key);

        guardian3Key = 0x3333;
        guardian3 = vm.addr(guardian3Key);

        attacker = makeAddr("attacker");

        // Deploy system
        recoveryModule = new RecoveryModule(address(0));
        factory = new WalletFactory(address(recoveryModule));
        recoveryModule.setWalletFactory(address(factory));

        address[3] memory guardians = [guardian1, guardian2, guardian3];
        address walletAddr = factory.deployWallet(oldOwner, guardians);
        wallet = SmartWallet(payable(walletAddr));

        // Configure custom delay for testing (120 seconds)
        vm.prank(oldOwner);
        recoveryModule.setWalletRecoveryDelay(address(wallet), CUSTOM_DELAY);

        // Fund wallet with 100 ETH and 5000 RID tokens
        vm.deal(address(wallet), 100 ether);
        token = new MockERC20("RecoverID Token", "RID");
        token.mint(address(wallet), 5000 ether);
    }

    // 5. Guardian registration & view check
    function test_GuardianRegistration() public view {
        assertTrue(recoveryModule.guardiansConfigured(address(wallet)));
        assertTrue(recoveryModule.isGuardian(address(wallet), guardian1));
        assertTrue(recoveryModule.isGuardian(address(wallet), guardian2));
        assertTrue(recoveryModule.isGuardian(address(wallet), guardian3));
        assertFalse(recoveryModule.isGuardian(address(wallet), attacker));

        address[3] memory registered = recoveryModule.getGuardians(address(wallet));
        assertEq(registered[0], guardian1);
        assertEq(registered[1], guardian2);
        assertEq(registered[2], guardian3);
    }

    // 6. Duplicate guardian rejection
    function test_RevertIf_DuplicateGuardians() public {
        SmartWallet standaloneWallet = new SmartWallet();
        standaloneWallet.initialize(oldOwner, address(recoveryModule));

        address[3] memory badGuardians = [guardian1, guardian1, guardian3];
        vm.prank(oldOwner);
        vm.expectRevert(abi.encodeWithSelector(RecoveryModule.DuplicateGuardianAddress.selector, guardian1));
        recoveryModule.registerGuardians(address(standaloneWallet), badGuardians);
    }

    // Guardian cannot be owner or zero address
    function test_RevertIf_GuardianIsOwnerOrZero() public {
        SmartWallet standaloneWallet = new SmartWallet();
        standaloneWallet.initialize(oldOwner, address(recoveryModule));

        address[3] memory ownerAsGuardian = [guardian1, oldOwner, guardian3];
        vm.prank(oldOwner);
        vm.expectRevert(abi.encodeWithSelector(RecoveryModule.GuardianCannotBeOwner.selector, oldOwner));
        recoveryModule.registerGuardians(address(standaloneWallet), ownerAsGuardian);

        address[3] memory zeroGuardian = [guardian1, address(0), guardian3];
        vm.prank(oldOwner);
        vm.expectRevert(abi.encodeWithSelector(RecoveryModule.InvalidGuardianAddress.selector, address(0)));
        recoveryModule.registerGuardians(address(standaloneWallet), zeroGuardian);
    }

    // 7. One approval being insufficient to execute
    function test_RevertIf_ExecutingWithOnlyOneApproval() public {
        // Guardian 1 initiates (automatically records approval #1)
        vm.prank(guardian1);
        uint256 requestId = recoveryModule.initiateRecovery(address(wallet), newOwner);

        RecoveryModule.RecoveryRequest memory req = recoveryModule.getRequest(requestId);
        assertEq(req.approvalCount, 1, "Should have 1 approval");

        // Warp past delay
        vm.warp(block.timestamp + CUSTOM_DELAY + 10);

        // Attempt execution with only 1 approval
        vm.expectRevert(abi.encodeWithSelector(RecoveryModule.ThresholdNotReached.selector, 1, 2));
        recoveryModule.executeRecovery(requestId);
    }

    // 8. Two distinct approvals satisfying the threshold
    function test_TwoDistinctApprovalsSatisfyThreshold() public {
        vm.prank(guardian1);
        uint256 requestId = recoveryModule.initiateRecovery(address(wallet), newOwner);

        // Guardian 2 approves
        vm.prank(guardian2);
        recoveryModule.approveRecovery(requestId);

        RecoveryModule.RecoveryRequest memory req = recoveryModule.getRequest(requestId);
        assertEq(req.approvalCount, 2, "Threshold of 2 satisfied");
        assertTrue(recoveryModule.hasApproved(requestId, guardian1));
        assertTrue(recoveryModule.hasApproved(requestId, guardian2));
        assertFalse(recoveryModule.hasApproved(requestId, guardian3));
    }

    // 9. Duplicate approval rejection
    function test_RevertIf_DuplicateApproval() public {
        vm.prank(guardian1);
        uint256 requestId = recoveryModule.initiateRecovery(address(wallet), newOwner);

        // Guardian 1 attempts to approve again
        vm.prank(guardian1);
        vm.expectRevert(abi.encodeWithSelector(RecoveryModule.GuardianAlreadyApproved.selector, requestId, guardian1));
        recoveryModule.approveRecovery(requestId);

        // Guardian 2 approves
        vm.prank(guardian2);
        recoveryModule.approveRecovery(requestId);

        // Guardian 2 attempts duplicate approval
        vm.prank(guardian2);
        vm.expectRevert(abi.encodeWithSelector(RecoveryModule.GuardianAlreadyApproved.selector, requestId, guardian2));
        recoveryModule.approveRecovery(requestId);
    }

    // 10. Recovery execution before the delay being rejected
    function test_RevertIf_ExecutionBeforeDelayElapsed() public {
        vm.prank(guardian1);
        uint256 requestId = recoveryModule.initiateRecovery(address(wallet), newOwner);

        vm.prank(guardian2);
        recoveryModule.approveRecovery(requestId);

        // Advance only 60 seconds (delay is 120 seconds)
        vm.warp(block.timestamp + 60);

        uint256 unlockTime = recoveryModule.getRequest(requestId).createdAt + CUSTOM_DELAY;
        vm.expectRevert(abi.encodeWithSelector(RecoveryModule.DelayNotElapsed.selector, unlockTime, block.timestamp));
        recoveryModule.executeRecovery(requestId);
    }

    // 11. Cancellation preventing execution
    function test_CancellationPreventsExecution() public {
        vm.prank(guardian1);
        uint256 requestId = recoveryModule.initiateRecovery(address(wallet), newOwner);

        vm.prank(guardian2);
        recoveryModule.approveRecovery(requestId);

        // Legitimate owner detects unauthorized / mistaken recovery and cancels it
        vm.prank(oldOwner);
        recoveryModule.cancelRecovery(requestId, "False alarm: Owner still holds private key");

        RecoveryModule.RecoveryRequest memory req = recoveryModule.getRequest(requestId);
        assertTrue(req.canceled);

        // Warp past delay
        vm.warp(block.timestamp + CUSTOM_DELAY + 20);

        // Execution must fail because request is canceled
        vm.expectRevert(abi.encodeWithSelector(RecoveryModule.RequestCanceled.selector, requestId));
        recoveryModule.executeRecovery(requestId);

        // Cannot approve a canceled request either
        vm.prank(guardian3);
        vm.expectRevert(abi.encodeWithSelector(RecoveryModule.RequestCanceled.selector, requestId));
        recoveryModule.approveRecovery(requestId);
    }

    // 12. Expired requests being rejected
    function test_RevertIf_RequestIsExpired() public {
        vm.prank(guardian1);
        uint256 requestId = recoveryModule.initiateRecovery(address(wallet), newOwner);

        vm.prank(guardian2);
        recoveryModule.approveRecovery(requestId);

        RecoveryModule.RecoveryRequest memory req = recoveryModule.getRequest(requestId);

        // Warp past expiration time (CUSTOM_DELAY + EXPIRY_WINDOW + 1 hour)
        vm.warp(req.expirationTime + 3600);

        vm.expectRevert(
            abi.encodeWithSelector(RecoveryModule.RequestExpired.selector, requestId, req.expirationTime, block.timestamp)
        );
        recoveryModule.executeRecovery(requestId);
    }

    // 13. Successful owner replacement, 14. Old owner fails, 15. New owner succeeds, 16. Assets remain in same wallet
    function test_FullSuccessfulRecoveryFlowAndAssetIntegrity() public {
        address walletAddress = address(wallet);
        uint256 initialETH = walletAddress.balance;
        uint256 initialTokens = token.balanceOf(walletAddress);

        assertEq(wallet.owner(), oldOwner);
        assertEq(initialETH, 100 ether);
        assertEq(initialTokens, 5000 ether);

        // Step 1: Guardian 1 initiates recovery
        vm.prank(guardian1);
        uint256 requestId = recoveryModule.initiateRecovery(walletAddress, newOwner);

        // Step 2: Guardian 2 approves
        vm.prank(guardian2);
        recoveryModule.approveRecovery(requestId);

        // Step 3: Wait for security delay
        vm.warp(block.timestamp + CUSTOM_DELAY + 1);

        // Step 4: Execute recovery
        recoveryModule.executeRecovery(requestId);

        // 13. Verify owner replacement
        assertEq(wallet.owner(), newOwner, "Owner must be successfully replaced by newOwner");

        // 16. Verify assets remain in same wallet address
        assertEq(address(wallet), walletAddress, "Smart wallet address must remain identical");
        assertEq(walletAddress.balance, initialETH, "ETH balance must remain intact");
        assertEq(token.balanceOf(walletAddress), initialTokens, "Token balance must remain intact");

        // 14. Verify old owner authorization FAILS
        address recipient = makeAddr("recipient");
        vm.prank(oldOwner);
        vm.expectRevert(abi.encodeWithSelector(SmartWallet.UnauthorizedCaller.selector, oldOwner));
        wallet.transferNative(payable(recipient), 10 ether);

        vm.prank(oldOwner);
        vm.expectRevert(abi.encodeWithSelector(SmartWallet.UnauthorizedCaller.selector, oldOwner));
        wallet.transferERC20(address(token), recipient, 500 ether);

        // 15. Verify new owner authorization SUCCEEDS
        vm.prank(newOwner);
        wallet.transferNative(payable(recipient), 10 ether);
        assertEq(recipient.balance, 10 ether);
        assertEq(walletAddress.balance, 90 ether);

        vm.prank(newOwner);
        wallet.transferERC20(address(token), recipient, 500 ether);
        assertEq(token.balanceOf(recipient), 500 ether);
        assertEq(token.balanceOf(walletAddress), 4500 ether);
    }

    // 17. Unauthorized recovery attempts failing
    function test_RevertIf_UnauthorizedCallerInitiatesWithGuardianAsProposedOwner() public {
        // Proposed owner cannot be an existing guardian
        vm.prank(guardian1);
        vm.expectRevert(abi.encodeWithSelector(RecoveryModule.ProposedOwnerCannotBeGuardian.selector, guardian2));
        recoveryModule.initiateRecovery(address(wallet), guardian2);

        // Proposed owner cannot be current owner or zero
        vm.prank(guardian1);
        vm.expectRevert(abi.encodeWithSelector(RecoveryModule.InvalidProposedOwner.selector, oldOwner));
        recoveryModule.initiateRecovery(address(wallet), oldOwner);

        vm.prank(guardian1);
        vm.expectRevert(abi.encodeWithSelector(RecoveryModule.InvalidProposedOwner.selector, address(0)));
        recoveryModule.initiateRecovery(address(wallet), address(0));
    }

    // 18. Replay protection
    function test_ReplayProtectionAfterExecution() public {
        vm.prank(guardian1);
        uint256 requestId = recoveryModule.initiateRecovery(address(wallet), newOwner);

        vm.prank(guardian2);
        recoveryModule.approveRecovery(requestId);

        vm.warp(block.timestamp + CUSTOM_DELAY + 10);
        recoveryModule.executeRecovery(requestId);

        // Cannot re-execute the same request
        vm.expectRevert(abi.encodeWithSelector(RecoveryModule.RequestAlreadyExecuted.selector, requestId));
        recoveryModule.executeRecovery(requestId);

        // Cannot re-approve the executed request
        vm.prank(guardian3);
        vm.expectRevert(abi.encodeWithSelector(RecoveryModule.RequestAlreadyExecuted.selector, requestId));
        recoveryModule.approveRecovery(requestId);
    }

    // 19. Invalid signature rejection
    function test_SignatureBasedApprovalAndInvalidSignatureRejection() public {
        vm.prank(guardian1);
        uint256 requestId = recoveryModule.initiateRecovery(address(wallet), newOwner);

        // Valid signature from guardian2
        bytes32 structHash = keccak256(
            abi.encode(
                recoveryModule.APPROVAL_TYPEHASH(),
                requestId,
                address(wallet),
                newOwner,
                recoveryModule.guardianNonces(guardian2)
            )
        );
        bytes32 digest = MessageHashUtils.toTypedDataHash(recoveryModule.domainSeparator(), structHash);
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(guardian2Key, digest);
        bytes memory validSig = abi.encodePacked(r, s, v);

        // Attacker relays the valid signature (should succeed)
        vm.prank(attacker);
        recoveryModule.approveRecoveryBySignature(requestId, validSig);

        assertTrue(recoveryModule.hasApproved(requestId, guardian2));

        // Invalid signature from attacker claiming to be a guardian
        uint256 attackerKey = 0x9999;
        (uint8 av, bytes32 ar, bytes32 asig) = vm.sign(attackerKey, digest);
        bytes memory fakeSig = abi.encodePacked(ar, asig, av);

        vm.prank(attacker);
        vm.expectRevert(RecoveryModule.InvalidSignature.selector);
        recoveryModule.approveRecoveryBySignature(requestId, fakeSig);
    }

    // 20. Repeated recovery requests following the defined policy
    function test_RepeatedRecoveryRequestsPolicy() public {
        // Request 1 is initiated and then canceled
        vm.prank(guardian1);
        uint256 req1 = recoveryModule.initiateRecovery(address(wallet), newOwner);

        // Cannot create concurrent active request while req1 is pending
        address anotherCandidate = makeAddr("anotherCandidate");
        vm.prank(guardian2);
        vm.expectRevert(abi.encodeWithSelector(RecoveryModule.ActiveRecoveryPending.selector, req1));
        recoveryModule.initiateRecovery(address(wallet), anotherCandidate);

        // Cancel req1
        vm.prank(oldOwner);
        recoveryModule.cancelRecovery(req1, "Canceled to start fresh");

        // Now a new request CAN be created
        vm.prank(guardian2);
        uint256 req2 = recoveryModule.initiateRecovery(address(wallet), anotherCandidate);
        assertEq(req2, 2, "Second request assigned new unique ID");

        // Complete req2
        vm.prank(guardian3);
        recoveryModule.approveRecovery(req2);

        vm.warp(block.timestamp + CUSTOM_DELAY + 10);
        recoveryModule.executeRecovery(req2);

        assertEq(wallet.owner(), anotherCandidate);

        // A third recovery can be initiated in the future under new ownership
        address thirdOwner = makeAddr("thirdOwner");
        vm.prank(guardian1);
        uint256 req3 = recoveryModule.initiateRecovery(address(wallet), thirdOwner);
        assertEq(req3, 3);
    }
}
