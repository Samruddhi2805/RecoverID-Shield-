// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {Test} from "forge-std/Test.sol";
import {SmartWallet} from "../src/SmartWallet.sol";
import {RecoveryModule} from "../src/RecoveryModule.sol";
import {WalletFactory} from "../src/WalletFactory.sol";
import {MockERC20} from "../src/MockERC20.sol";
import {MessageHashUtils} from "@openzeppelin/contracts/utils/cryptography/MessageHashUtils.sol";

contract SmartWalletTest is Test {
    SmartWallet public wallet;
    RecoveryModule public recoveryModule;
    WalletFactory public factory;
    MockERC20 public token;

    uint256 internal ownerPrivateKey;
    address internal owner;
    address internal unauthorizedUser;
    address internal recipient;

    address internal guardian1;
    address internal guardian2;
    address internal guardian3;

    event TransactionExecuted(address indexed target, uint256 value, bytes data, bytes returnData);
    event OwnerChanged(address indexed previousOwner, address indexed newOwner);
    event NativeTransferred(address indexed recipient, uint256 amount);
    event ERC20Transferred(address indexed token, address indexed recipient, uint256 amount);

    function setUp() public {
        ownerPrivateKey = 0xA11CE;
        owner = vm.addr(ownerPrivateKey);
        unauthorizedUser = makeAddr("unauthorized");
        recipient = makeAddr("recipient");

        guardian1 = makeAddr("guardian1");
        guardian2 = makeAddr("guardian2");
        guardian3 = makeAddr("guardian3");

        // Deploy recovery module and factory
        recoveryModule = new RecoveryModule(address(0));
        factory = new WalletFactory(address(recoveryModule));
        recoveryModule.setWalletFactory(address(factory));

        // Deploy wallet via factory with 3 guardians
        address[3] memory guardians = [guardian1, guardian2, guardian3];
        address walletAddr = factory.deployWallet(owner, guardians);
        wallet = SmartWallet(payable(walletAddr));

        // Deploy mock token and mint to wallet
        token = new MockERC20("RecoverID Token", "RID");
        token.mint(address(wallet), 1000 ether);

        // Fund wallet with 10 ETH
        vm.deal(address(wallet), 10 ether);
    }

    // 1. Wallet deployment & 2. Correct owner initialization
    function test_WalletDeploymentAndOwnerInit() public view {
        assertEq(wallet.owner(), owner, "Owner must match initialized owner");
        assertEq(wallet.recoveryModule(), address(recoveryModule), "RecoveryModule must match");
        assertTrue(wallet.initialized(), "Wallet must be initialized");
        assertEq(address(wallet).balance, 10 ether, "Wallet must hold 10 ETH");
        assertEq(token.balanceOf(address(wallet)), 1000 ether, "Wallet must hold 1000 RID");
    }

    // Prevent re-initialization
    function test_RevertIf_Reinitializing() public {
        vm.expectRevert(SmartWallet.AlreadyInitialized.selector);
        wallet.initialize(unauthorizedUser, address(recoveryModule));
    }

    // 3. Owner-authorized transactions: Native ETH transfer
    function test_OwnerAuthorizedNativeTransfer() public {
        uint256 recipientInitial = recipient.balance;
        uint256 transferAmount = 2.5 ether;

        vm.prank(owner);
        wallet.transferNative(payable(recipient), transferAmount);

        assertEq(recipient.balance, recipientInitial + transferAmount);
        assertEq(address(wallet).balance, 7.5 ether);
    }

    // 3. Owner-authorized transactions: ERC-20 token transfer
    function test_OwnerAuthorizedERC20Transfer() public {
        uint256 transferAmount = 150 ether;

        vm.prank(owner);
        wallet.transferERC20(address(token), recipient, transferAmount);

        assertEq(token.balanceOf(recipient), transferAmount);
        assertEq(token.balanceOf(address(wallet)), 850 ether);
    }

    // 3. Owner-authorized generic call execution
    function test_OwnerAuthorizedGenericExecution() public {
        bytes memory data = abi.encodeWithSelector(token.transfer.selector, recipient, 50 ether);

        vm.prank(owner);
        wallet.execute(address(token), 0, data);

        assertEq(token.balanceOf(recipient), 50 ether);
    }

    // 3. Owner-authorized signed off-chain execution with EIP-712 replay protection
    function test_OwnerAuthorizedSignedExecution() public {
        uint256 currentNonce = wallet.nonce();
        bytes memory data = abi.encodeWithSelector(token.transfer.selector, recipient, 25 ether);

        bytes32 structHash = keccak256(
            abi.encode(wallet.EXECUTE_TYPEHASH(), address(token), 0, keccak256(data), currentNonce)
        );
        bytes32 digest = MessageHashUtils.toTypedDataHash(wallet.domainSeparator(), structHash);
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(ownerPrivateKey, digest);
        bytes memory signature = abi.encodePacked(r, s, v);

        // Can be submitted by any relayer
        vm.prank(unauthorizedUser);
        wallet.executeSigned(address(token), 0, data, currentNonce, signature);

        assertEq(token.balanceOf(recipient), 25 ether);
        assertEq(wallet.nonce(), currentNonce + 1);
    }

    // 4. Unauthorized transaction rejection
    function test_RevertIf_UnauthorizedCallerExecutesNative() public {
        vm.prank(unauthorizedUser);
        vm.expectRevert(abi.encodeWithSelector(SmartWallet.UnauthorizedCaller.selector, unauthorizedUser));
        wallet.transferNative(payable(recipient), 1 ether);
    }

    function test_RevertIf_UnauthorizedCallerExecutesERC20() public {
        vm.prank(unauthorizedUser);
        vm.expectRevert(abi.encodeWithSelector(SmartWallet.UnauthorizedCaller.selector, unauthorizedUser));
        wallet.transferERC20(address(token), recipient, 50 ether);
    }

    function test_RevertIf_UnauthorizedCallerExecutesCall() public {
        bytes memory data = abi.encodeWithSelector(token.transfer.selector, recipient, 50 ether);
        vm.prank(unauthorizedUser);
        vm.expectRevert(abi.encodeWithSelector(SmartWallet.UnauthorizedCaller.selector, unauthorizedUser));
        wallet.execute(address(token), 0, data);
    }

    // Direct changeOwner call rejected if caller is not RecoveryModule
    function test_RevertIf_NonRecoveryModuleCallsChangeOwner() public {
        address newOwner = makeAddr("newOwner");
        vm.prank(owner);
        vm.expectRevert(abi.encodeWithSelector(SmartWallet.OnlyRecoveryModule.selector, owner, address(recoveryModule)));
        wallet.changeOwner(newOwner);

        vm.prank(unauthorizedUser);
        vm.expectRevert(abi.encodeWithSelector(SmartWallet.OnlyRecoveryModule.selector, unauthorizedUser, address(recoveryModule)));
        wallet.changeOwner(newOwner);
    }
}
