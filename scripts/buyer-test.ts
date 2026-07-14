import * as path from 'path';
import * as fs from 'fs';
import { createPublicClient, createWalletClient, http, publicActions } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { base } from 'viem/chains';
import { wrapFetchWithPayment } from 'x402-fetch';

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
const targetUrl = process.argv[2] || 'http://localhost:3000/api/v1/query/personality-profile-library?tags=trading&limit=2';

async function run() {
  if (!privateKey) {
    console.error('Missing env var: TEST_BUYER_PRIVATE_KEY');
    process.exit(1);
  }

  // 1. Compute clock drift dynamically by fetching the latest block timestamp from Base Mainnet
  console.log('Synchronizing clock with Base Mainnet...');
  const publicClient = createPublicClient({
    chain: base,
    transport: http('https://mainnet.base.org'),
  });
  const block = await publicClient.getBlock();
  const blockTime = Number(block.timestamp);
  const localTime = Math.floor(Date.now() / 1000);
  const driftSeconds = localTime - blockTime;

  console.log(`Clock drift detected: ${driftSeconds} seconds (~${(driftSeconds / 3600).toFixed(2)} hours)`);

  // Mock Date.now to compensate for drift
  const originalNow = Date.now;
  Date.now = () => originalNow() - (driftSeconds + 300) * 1000; // Subtract drift + 5m safety margin to ensure validAfter is in the past

  const account = privateKeyToAccount(privateKey as `0x${string}`);
  const client = createWalletClient({
    account,
    chain: base,
    transport: http('https://mainnet.base.org'),
  }).extend(publicActions);

  console.log('==================================================');
  console.log(`Buyer Address: ${account.address}`);
  console.log(`Target URL:    ${targetUrl}`);
  console.log('==================================================');

  // Wrap standard fetch with x402 payment handling
  const payingFetch = wrapFetchWithPayment(fetch, client as any);

  console.log('Sending request to paid endpoint...');
  try {
    const res = await payingFetch(targetUrl);
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
    }
  } catch (error) {
    console.error('Verification failed with error:', error);
  }
}

run().catch(console.error);
