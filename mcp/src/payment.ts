import { createPublicClient, createWalletClient, http, publicActions } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { base } from 'viem/chains';
import { wrapFetchWithPayment } from 'x402-fetch';
import { readBodySafe } from './util.js';
import type { ApiResult } from './api.js';

const RPC = process.env.BASE_RPC_URL || 'https://mainnet.base.org';

function buyerKey(): `0x${string}` | undefined {
  const pk = process.env.BUYER_PRIVATE_KEY;
  if (!pk) return undefined;
  return (pk.startsWith('0x') ? pk : `0x${pk}`) as `0x${string}`;
}

export function hasBuyerWallet(): boolean {
  return !!buyerKey();
}

export function buyerAddress(): string | null {
  const pk = buyerKey();
  if (!pk) return null;
  try {
    return privateKeyToAccount(pk).address;
  } catch {
    return null;
  }
}

// Paid fetch using the operator's OWN wallet key (BUYER_PRIVATE_KEY). The server
// never holds any other key and never moves funds on its own — a paid query
// only happens when the operator has explicitly configured their wallet.
// Mirrors scripts/buyer-test.ts, including Base clock-drift compensation, which
// keeps the EIP-3009 validAfter/validBefore window inside what the chain accepts.
export async function payingFetch(url: string): Promise<ApiResult> {
  const pk = buyerKey();
  if (!pk) throw new Error('BUYER_PRIVATE_KEY not set');

  const publicClient = createPublicClient({ chain: base, transport: http(RPC) });
  const block = await publicClient.getBlock();
  const driftSeconds = Math.floor(Date.now() / 1000) - Number(block.timestamp);

  const account = privateKeyToAccount(pk);
  const client = createWalletClient({ account, chain: base, transport: http(RPC) }).extend(publicActions);
  const fetchWithPay = wrapFetchWithPayment(fetch, client as any);

  // Compensate for local/chain clock drift (+5m safety) so validAfter is in the
  // past when the settlement contract checks it. Restored immediately after.
  const originalNow = Date.now;
  Date.now = () => originalNow() - (driftSeconds + 300) * 1000;
  try {
    const res = await fetchWithPay(url);
    return { status: res.status, body: await readBodySafe(res) };
  } finally {
    Date.now = originalNow;
  }
}
