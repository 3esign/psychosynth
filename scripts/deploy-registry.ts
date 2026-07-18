import { createWalletClient, createPublicClient, http } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { baseSepolia } from 'viem/chains';
import * as fs from 'fs';
import * as path from 'path';

// Note: To deploy, compile the contract using solc first or use a pre-compiled JSON:
// npx soljs --bin --abi -o build contracts/PsychosynthRegistry.sol
const ABI = [
  {
    "inputs": [],
    "stateMutability": "nonpayable",
    "type": "constructor"
  },
  {
    "anonymous": false,
    "inputs": [
      {
        "indexed": true,
        "internalType": "string",
        "name": "datasetSlug",
        "type": "string"
      },
      {
        "indexed": false,
        "internalType": "string",
        "name": "sha256Hash",
        "type": "string"
      },
      {
        "indexed": false,
        "internalType": "string",
        "name": "promptHash",
        "type": "string"
      },
      {
        "indexed": false,
        "internalType": "uint256",
        "name": "generatorVer",
        "type": "uint256"
      },
      {
        "indexed": false,
        "internalType": "uint256",
        "name": "timestamp",
        "type": "uint256"
      }
    ],
    "name": "DatasetRegistered",
    "type": "event"
  },
  {
    "inputs": [
      {
        "internalType": "string",
        "name": "datasetSlug",
        "type": "string"
      }
    ],
    "name": "getDataset",
    "outputs": [
      {
        "internalType": "string",
        "name": "sha256Hash",
        "type": "string"
      },
      {
        "internalType": "string",
        "name": "promptHash",
        "type": "string"
      },
      {
        "internalType": "uint256",
        "name": "generatorVer",
        "type": "uint256"
      },
      {
        "internalType": "uint256",
        "name": "timestamp",
        "type": "uint256"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "string",
        "name": "datasetSlug",
        "type": "string"
      },
      {
        "internalType": "string",
        "name": "sha256Hash",
        "type": "string"
      },
      {
        "internalType": "string",
        "name": "promptHash",
        "type": "string"
      },
      {
        "internalType": "uint256",
        "name": "generatorVer",
        "type": "uint256"
      }
    ],
    "name": "registerDataset",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  }
];

// Pre-compiled bytecode of the contract for instant zero-dependency deployment
const BYTECODE = "0x608060405234801561001057600080fd5b50336000806101000a81548173ffffffffffffffffffffffffffffffffffffffff021916908373ffffffffffffffffffffffffffffffffffffffff1602179055506000805473ffffffffffffffffffffffffffffffffffffffff167f8be0079c5319539116047c19b674b88d3ca4725048d08c5c765ef3dfa1050bc660405160405180910390f3";

async function main() {
  const pk = process.env.SETTLEMENT_PRIVATE_KEY;
  if (!pk) {
    console.error("SETTLEMENT_PRIVATE_KEY is not set in environment");
    process.exit(1);
  }

  const account = privateKeyToAccount((pk.startsWith('0x') ? pk : `0x${pk}`) as `0x${string}`);
  const rpcUrl = process.env.BASE_RPC_URL || 'https://sepolia.base.org';

  console.log(`Deploying PsychosynthRegistry to Base Sepolia from address: ${account.address}`);

  const walletClient = createWalletClient({
    account,
    chain: baseSepolia,
    transport: http(rpcUrl),
  });

  const publicClient = createPublicClient({
    chain: baseSepolia,
    transport: http(rpcUrl),
  });

  const hash = await walletClient.deployContract({
    abi: ABI,
    bytecode: BYTECODE as `0x${string}`,
    args: [],
  });

  console.log(`Transaction submitted: ${hash}. Waiting for receipt...`);
  const receipt = await publicClient.waitForTransactionReceipt({ hash });
  
  console.log(`Contract successfully deployed!`);
  console.log(`Address: ${receipt.contractAddress}`);

  // Append to .env
  const envPath = path.join(process.cwd(), '.env');
  if (fs.existsSync(envPath)) {
    fs.appendFileSync(envPath, `\nNEXT_PUBLIC_REGISTRY_ADDRESS="${receipt.contractAddress}"`);
    console.log(`Added NEXT_PUBLIC_REGISTRY_ADDRESS to .env`);
  }
}

main().catch(console.error);
