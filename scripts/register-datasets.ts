import { createWalletClient, createPublicClient, http, getAddress } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { baseSepolia } from 'viem/chains';
import { dbAdmin } from '../src/modules/core/db';

const ABI = [
  {
    "inputs": [
      { "internalType": "string", "name": "datasetSlug", "type": "string" },
      { "internalType": "string", "name": "sha256Hash", "type": "string" },
      { "internalType": "string", "name": "promptHash", "type": "string" },
      { "internalType": "uint256", "name": "generatorVer", "type": "uint256" }
    ],
    "name": "registerDataset",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  }
];

async function main() {
  const registryAddress = process.env.NEXT_PUBLIC_REGISTRY_ADDRESS;
  const pk = process.env.SETTLEMENT_PRIVATE_KEY;

  if (!registryAddress) {
    console.error("NEXT_PUBLIC_REGISTRY_ADDRESS is not set in environment");
    process.exit(1);
  }
  if (!pk) {
    console.error("SETTLEMENT_PRIVATE_KEY is not set in environment");
    process.exit(1);
  }

  const account = privateKeyToAccount((pk.startsWith('0x') ? pk : `0x${pk}`) as `0x${string}`);
  const rpcUrl = process.env.BASE_RPC_URL || 'https://sepolia.base.org';

  console.log(`Using registry contract at: ${registryAddress}`);
  console.log(`Executing from administrator address: ${account.address}`);

  // 1. Query frozen datasets from database
  const { data: datasets, error } = await dbAdmin
    .from('datasets')
    .select('id, slug, version, sha256_hash, entity_type')
    .not('frozen_at', 'is', null);

  if (error) {
    console.error(`Database error fetching datasets: ${error.message}`);
    process.exit(1);
  }

  if (!datasets || datasets.length === 0) {
    console.log("No frozen datasets found to register.");
    return;
  }

  const walletClient = createWalletClient({
    account,
    chain: baseSepolia,
    transport: http(rpcUrl),
  });

  const publicClient = createPublicClient({
    chain: baseSepolia,
    transport: http(rpcUrl),
  });

  for (const ds of datasets) {
    if (!ds.sha256_hash) {
      console.log(`Skipping dataset ${ds.slug} v${ds.version}: no SHA-256 hash computed.`);
      continue;
    }

    console.log(`Registering dataset: ${ds.slug} (version ${ds.version})...`);

    // Find a sample item's provenance to get generator details
    const { data: items } = await dbAdmin
      .from('dataset_items')
      .select('entity_id')
      .eq('dataset_id', ds.id)
      .limit(1);

    let samplePromptHash = "0x0000000000000000000000000000000000000000000000000000000000000000";
    let sampleVer = 1;

    if (items && items.length > 0) {
      const { data: prov } = await dbAdmin
        .from('provenance')
        .select('prompt_hash, entity_version')
        .eq('entity_id', items[0].entity_id)
        .eq('entity_type', ds.entity_type)
        .maybeSingle();

      if (prov) {
        samplePromptHash = prov.prompt_hash;
        sampleVer = prov.entity_version;
      }
    }

    try {
      const hash = await walletClient.writeContract({
        address: getAddress(registryAddress),
        abi: ABI,
        functionName: 'registerDataset',
        args: [
          `${ds.slug}-v${ds.version}`,
          ds.sha256_hash,
          samplePromptHash,
          BigInt(sampleVer)
        ]
      });

      console.log(`Submitted transaction: ${hash}. Waiting for verification...`);
      await publicClient.waitForTransactionReceipt({ hash });
      console.log(`Successfully registered dataset ${ds.slug}-v${ds.version} on-chain.`);
    } catch (e: any) {
      console.error(`Failed to register ${ds.slug}:`, e.message || e);
    }
  }
}

main().catch(console.error);
