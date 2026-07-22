// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title BehavioralGuardModule
 * @dev ERC-7579 module to validate an agent's Psychosynth behavioral certification
 * before executing high-risk transactions. Blocks trades if the agent's 
 * panic or loss-aversion metrics exceed safe thresholds.
 */
contract BehavioralGuardModule {
    address public psychosynthSigner;
    uint256 public maxPanicIndex; // 0 to 100

    event TradeBlocked(address indexed account, uint256 panicIndex);
    event TradeAllowed(address indexed account, uint256 panicIndex);

    constructor(address _psychosynthSigner, uint256 _maxPanicIndex) {
        psychosynthSigner = _psychosynthSigner;
        maxPanicIndex = _maxPanicIndex;
    }

    /**
     * @dev Called before an agent executes a transaction.
     * The agent passes a signed Psychosynth evaluation (report_sha256 + panic_index)
     * as extra data.
     */
    function preCheck(
        address account,
        bytes calldata data,
        bytes calldata signature,
        uint256 panicIndex
    ) external {
        // Recover signer from signature
        bytes32 messageHash = keccak256(abi.encodePacked(account, panicIndex));
        bytes32 ethSignedMessageHash = keccak256(
            abi.encodePacked("\x19Ethereum Signed Message:\n32", messageHash)
        );
        
        address recoveredSigner = recoverSigner(ethSignedMessageHash, signature);
        require(recoveredSigner == psychosynthSigner, "Invalid Psychosynth certification");

        if (panicIndex > maxPanicIndex) {
            emit TradeBlocked(account, panicIndex);
            revert("Behavioral Guard: Agent panic index too high");
        }

        emit TradeAllowed(account, panicIndex);
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
