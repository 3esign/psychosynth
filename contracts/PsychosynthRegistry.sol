// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title PsychosynthRegistry
 * @dev Cryptographic trust and reputation registry for the Psychosynth synthetic data marketplace.
 * Records the SHA-256 content hashes and prompt methodology hashes of datasets on-chain.
 */
contract PsychosynthRegistry {
    // Contract Owner / Administrator
    address public owner;

    // Pending owner for the two-step ownership transfer (see transferOwnership /
    // acceptOwnership). Ownership only moves once the new owner accepts, so a
    // typo'd or dead address can never permanently brick admin control.
    address public pendingOwner;

    // Struct to represent a registered dataset's cryptographic metadata
    struct DatasetMetadata {
        string sha256Hash;       // SHA-256 content hash of the frozen dataset rows
        string promptHash;       // SHA-256 hash of the Generator prompt template
        uint256 generatorVer;    // Generator OS version used to produce the data
        uint256 timestamp;       // Block timestamp of registration
    }

    // Maps dataset slug -> metadata
    mapping(string => DatasetMetadata) private registry;

    // Maps dataset slug -> list of historical hashes (for versioned updates)
    mapping(string => DatasetMetadata[]) private registryHistory;

    event DatasetRegistered(
        string indexed datasetSlug,
        string sha256Hash,
        string promptHash,
        uint256 generatorVer,
        uint256 timestamp
    );

    event OwnershipTransferStarted(address indexed previousOwner, address indexed newOwner);
    event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);

    modifier onlyOwner() {
        require(msg.sender == owner, "PsychosynthRegistry: caller is not the owner");
        _;
    }

    constructor() {
        owner = msg.sender;
        emit OwnershipTransferred(address(0), msg.sender);
    }

    /**
     * @dev Registers or updates a dataset's cryptographic fingerprint on-chain.
     */
    function registerDataset(
        string calldata datasetSlug,
        string calldata sha256Hash,
        string calldata promptHash,
        uint256 generatorVer
    ) external onlyOwner {
        require(bytes(datasetSlug).length > 0, "PsychosynthRegistry: empty slug");
        require(bytes(sha256Hash).length > 0, "PsychosynthRegistry: empty sha256Hash");
        require(bytes(promptHash).length > 0, "PsychosynthRegistry: empty promptHash");

        DatasetMetadata memory meta = DatasetMetadata({
            sha256Hash: sha256Hash,
            promptHash: promptHash,
            generatorVer: generatorVer,
            timestamp: block.timestamp
        });

        registry[datasetSlug] = meta;
        registryHistory[datasetSlug].push(meta);

        emit DatasetRegistered(
            datasetSlug,
            sha256Hash,
            promptHash,
            generatorVer,
            block.timestamp
        );
    }

    /**
     * @dev Returns the latest registered metadata for a dataset slug.
     */
    function getDataset(string calldata datasetSlug)
        external
        view
        returns (
            string memory sha256Hash,
            string memory promptHash,
            uint256 generatorVer,
            uint256 timestamp
        )
    {
        DatasetMetadata memory meta = registry[datasetSlug];
        require(meta.timestamp > 0, "PsychosynthRegistry: dataset not found");
        return (meta.sha256Hash, meta.promptHash, meta.generatorVer, meta.timestamp);
    }

    /**
     * @dev Returns the total number of versions registered for a dataset slug.
     */
    function getDatasetVersionCount(string calldata datasetSlug) external view returns (uint256) {
        return registryHistory[datasetSlug].length;
    }

    /**
     * @dev Returns a specific historical version metadata for a dataset.
     */
    function getDatasetHistory(string calldata datasetSlug, uint256 index)
        external
        view
        returns (
            string memory sha256Hash,
            string memory promptHash,
            uint256 generatorVer,
            uint256 timestamp
        )
    {
        require(index < registryHistory[datasetSlug].length, "PsychosynthRegistry: index out of bounds");
        DatasetMetadata memory meta = registryHistory[datasetSlug][index];
        return (meta.sha256Hash, meta.promptHash, meta.generatorVer, meta.timestamp);
    }

    /**
     * @dev Step 1 of a two-step ownership transfer: nominate a new owner. The
     * nominee must call acceptOwnership() before ownership actually moves, so a
     * mistyped or uncontrolled address cannot lock out the registry.
     */
    function transferOwnership(address newOwner) external onlyOwner {
        require(newOwner != address(0), "PsychosynthRegistry: new owner is the zero address");
        pendingOwner = newOwner;
        emit OwnershipTransferStarted(owner, newOwner);
    }

    /**
     * @dev Step 2 of a two-step ownership transfer: the nominated owner accepts
     * and ownership moves to them.
     */
    function acceptOwnership() external {
        require(msg.sender == pendingOwner, "PsychosynthRegistry: caller is not the pending owner");
        address previousOwner = owner;
        owner = pendingOwner;
        pendingOwner = address(0);
        emit OwnershipTransferred(previousOwner, owner);
    }

    /**
     * @dev Cancel a pending ownership transfer.
     */
    function cancelOwnershipTransfer() external onlyOwner {
        pendingOwner = address(0);
    }
}
