import * as path from 'path';
import * as fs from 'fs';
import { createWalletClient, http, publicActions, getAddress, erc20Abi } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { base } from 'viem/chains';

function loadEnv() {
  const p = path.join(process.cwd(), '.env');
  if (!fs.existsSync(p)) return;
  for (const line of fs.readFileSync(p, 'utf8').split('\n')) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m) process.env[m[1]] = m[2].trim().replace(/^["']|["']$/g, '');
  }
}
loadEnv();

const privateKey = process.env.TEST_BUYER_PRIVATE_KEY;
const rpcUrl = process.env.BASE_RPC_URL || 'https://mainnet.base.org';
const targetUrl = process.argv[2] || 'http://localhost:3000/api/v1/query/personality-profile-library?tags=trading&limit=2';

// USDC on Base mainnet (6 decimals).
const USDC = getAddress('0x833589fcd6edb6e08f4c7c32d4f71b54bda02913');

// Must match src/modules/commerce/payment-verify.ts::buildBindingChallenge.
function buildBindingChallenge(p: {
  network: string;
  txHash: string;
  payTo: string;
  requiredUnits: bigint;
  resourcePath: string;
}): string {
  return ['x402-payment-binding', 'v1', p.network, p.txHash, p.payTo, p.requiredUnits.toString(), p.resourcePath].join('\n');
}

function toXPayment(payload: Record<string, unknown>): string {
  return Buffer.from(JSON.stringify({ x402Version: 1, scheme: 'exact', network: 'base', payload })).toString('base64');
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function run() {
  if (!privateKey) {
    console.error('Missing env var: TEST_BUYER_PRIVATE_KEY');
    process.exit(1);
  }

  const account = privateKeyToAccount(privateKey as `0x${string}`);
  const client = createWalletClient({ account, chain: base, transport: http(rpcUrl) }).extend(publicActions);

  console.log('==================================================');
  console.log(`Buyer Address: ${account.address}`);
  console.log(`Target URL:    ${targetUrl}`);
  console.log('==================================================');

  // 1. Quote (expect HTTP 402).
  console.log('1) Requesting quote (expect HTTP 402)...');
  const quoteRes = await fetch(targetUrl);
  if (quoteRes.status !== 402) {
    console.error(`Expected HTTP 402, got ${quoteRes.status}. Body:`);
    console.error(JSON.stringify(await quoteRes.json().catch(() => ({})), null, 2));
    process.exit(1);
  }
  const quote = await quoteRes.json();
  const accept = (quote.accepts || []).find((a: any) => a.network === 'base');
  if (!accept) {
    console.error('No Base payment option in the quote.');
    process.exit(1);
  }
  const payTo = getAddress(accept.payTo);
  const requiredUnits = BigInt(accept.maxAmountRequired);
  const bindingRequired = Boolean(quote.binding?.required);
  console.log(`   Quote: ${accept.price} → send ${requiredUnits} USDC base units to ${payTo} (binding=${bindingRequired})`);

  // 2. Pay on-chain (buyer pays gas — the "agent-paid" model).
  console.log('2) Sending USDC transfer on Base...');
  const txHash = await client.writeContract({
    address: USDC,
    abi: erc20Abi,
    functionName: 'transfer',
    args: [payTo, requiredUnits],
  });
  console.log(`   tx: ${txHash}`);
  const receipt = await client.waitForTransactionReceipt({ hash: txHash });
  console.log(`   settled in block ${receipt.blockNumber} (status: ${receipt.status})`);

  // 3. Build the X-PAYMENT payload, signing the binding challenge so the server
  //    knows *we* (the paying wallet) are redeeming this txHash.
  const payload: Record<string, unknown> = { txHash };
  if (bindingRequired) {
    const u = new URL(targetUrl);
    const challenge = buildBindingChallenge({
      network: 'base',
      txHash,
      payTo,
      requiredUnits,
      resourcePath: u.pathname + u.search,
    });
    const signature = await account.signMessage({ message: challenge });
    payload.payer = account.address;
    payload.signature = signature;
    console.log('   signed payment binding challenge');
  }
  const header = toXPayment(payload);

  // 4. Retry with the payment header. The server may briefly answer 425/409
  //    while the tx finalizes — retry a few times.
  console.log('3) Requesting with X-PAYMENT header...');
  let res: Response | null = null;
  for (let attempt = 1; attempt <= 5; attempt++) {
    res = await fetch(targetUrl, { headers: { 'X-PAYMENT': header } });
    if (res.status !== 425 && res.status !== 409) break;
    const body = await res.json().catch(() => ({}));
    console.log(`   attempt ${attempt}: ${res.status} (${body.kind || body.message || 'retrying'}), waiting...`);
    await sleep(3000);
  }
  if (!res) {
    console.error('No response received.');
    process.exit(1);
  }

  console.log(`Response Status: ${res.status}`);
  const data = await res.json();
  console.log('Response Body:');
  console.log(JSON.stringify(data, null, 2));

  if (res.ok) {
    console.log('==================================================');
    console.log('SUCCESS: Paid query resolved successfully!');
    console.log('==================================================');
  } else {
    console.error('ERROR: Query returned failure status.');
    process.exit(1);
  }
}

run().catch((error) => {
  console.error('Buyer test failed:', error);
  process.exit(1);
});
