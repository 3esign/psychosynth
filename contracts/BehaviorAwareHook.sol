// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {BaseHook} from "v4-periphery/src/base/hooks/BaseHook.sol";
import {IPoolManager} from "v4-core/src/interfaces/IPoolManager.sol";
import {Hooks} from "v4-core/src/libraries/Hooks.sol";
import {PoolKey} from "v4-core/src/types/PoolKey.sol";
import {BeforeSwapDelta, BeforeSwapDeltaLibrary} from "v4-core/src/types/BeforeSwapDelta.sol";
import {LPFeeLibrary} from "v4-core/src/libraries/LPFeeLibrary.sol";

/**
 * @title BehaviorAwareHook
 * @dev Uniswap v4 Hook that dynamically adjusts pool swap fees based on the
 * swapper's certified Psychosynth panic_index. Protects LPs during volatility.
 */
contract BehaviorAwareHook is BaseHook {
    using LPFeeLibrary for uint24;

    address public immutable psychosynthSigner;
    uint24 public immutable baseFee;
    uint24 public immutable maxDynamicFee;

    event FeeAdjusted(address indexed swapper, uint24 newFee, uint256 panicIndex);

    constructor(
        IPoolManager _poolManager,
        address _psychosynthSigner,
        uint24 _baseFee,
        uint24 _maxDynamicFee
    ) BaseHook(_poolManager) {
        psychosynthSigner = _psychosynthSigner;
        baseFee = _baseFee;
        maxDynamicFee = _maxDynamicFee;
    }

    function getHookPermissions() public pure override returns (Hooks.Permissions memory) {
        return Hooks.Permissions({
            beforeInitialize: false,
            afterInitialize: false,
            beforeAddLiquidity: false,
            afterAddLiquidity: false,
            beforeRemoveLiquidity: false,
            afterRemoveLiquidity: false,
            beforeSwap: true,
            afterSwap: false,
            beforeDonate: false,
            afterDonate: false,
            beforeSwapReturnDelta: false,
            afterSwapReturnDelta: false,
            afterAddLiquidityReturnDelta: false,
            afterRemoveLiquidityReturnDelta: false
        });
    }

    /**
     * @dev Called before a swap. Verifies the agent's signature and adjusts fee.
     * The hookData contains the signed panicIndex from Psychosynth.
     */
    function beforeSwap(
        address sender,
        PoolKey calldata key,
        IPoolManager.SwapParams calldata params,
        bytes calldata hookData
    ) external override returns (bytes4, BeforeSwapDelta, uint24) {
        // If the pool is not configured for dynamic fees, we cannot override the fee
        if (!key.fee.isDynamicFee()) {
            return (BaseHook.beforeSwap.selector, BeforeSwapDeltaLibrary.ZERO_DELTA, 0);
        }

        // hookData: abi.encode(panicIndex, signature)
        (uint256 panicIndex, bytes memory signature) = abi.decode(hookData, (uint256, bytes));

        // Verify signature
        bytes32 messageHash = keccak256(abi.encodePacked(sender, panicIndex));
        bytes32 ethSignedMessageHash = keccak256(
            abi.encodePacked("\x19Ethereum Signed Message:\n32", messageHash)
        );
        
        address recoveredSigner = recoverSigner(ethSignedMessageHash, signature);
        require(recoveredSigner == psychosynthSigner, "Invalid Psychosynth signature");

        // Calculate dynamic fee
        // If panicIndex is 0, fee is baseFee. If panicIndex is 100, fee is maxDynamicFee.
        uint24 dynamicFee = baseFee + uint24((panicIndex * (maxDynamicFee - baseFee)) / 100);

        // Apply Uniswap v4 dynamic fee override flag
        uint24 feeWithFlag = dynamicFee | LPFeeLibrary.OVERRIDE_FEE_FLAG;

        emit FeeAdjusted(sender, dynamicFee, panicIndex);
        return (BaseHook.beforeSwap.selector, BeforeSwapDeltaLibrary.ZERO_DELTA, feeWithFlag);
    }

    function recoverSigner(bytes32 _ethSignedMessageHash, bytes memory _signature)
        internal
        pure
        returns (address)
    {
        (bytes32 r, bytes32 s, uint8 v) = splitSignature(_signature);
        return ecrecover(_ethSignedMessageHash, v, r, s);
    }

    function splitSignature(bytes memory sig)
        internal
        pure
        returns (bytes32 r, bytes32 s, uint8 v)
    {
        require(sig.length == 65, "invalid signature length");
        assembly {
            r := mload(add(sig, 32))
            s := mload(add(sig, 64))
            v := byte(0, mload(add(sig, 96)))
        }
    }
}
