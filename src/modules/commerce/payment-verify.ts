// Payment verification for the x402 "agent-paid" gate.
//
// The agent settles a USDC payment on-chain itself and hands us a transaction
// hash. This module verifies that the hash corresponds to a real, final USDC
// transfer of at least the required amount to our payout address — on Base or
// Solana — and (when binding is enabled) that the wallet redeeming the payment
// actually controls the paying account, which closes txHash front-running.
//
// Everything here fails CLOSED: any doubt throws a PaymentError and the caller
// refuses service. Transient infrastructure failures are distinguished from
// genuine payment problems so a paid buyer is never told their valid payment is
// invalid (they can retry) — and no payment row is written unless verification
// fully succeeds, so a failed attempt never consumes the txHash.

import { createPublicClient, http, getAddress, decodeEventLog } from 'viem';
import { base } from 'viem/chains';
import {
  looksLikeEip3009Payload,
  isEip3009Payload,
  buildPaymentRequirements,
  facilitatorVerify,
  facilitatorSettle,
  facilitatorEnabled,
} from './facilitator';

export type PaymentErrorKind =
  | 'malformed'      // client sent a structurally invalid payment payload
  | 'unsupported'    // scheme/network we don't accept
  | 'invalid'        // on-chain state contradicts the claim (reverted, too old, wrong token)
  | 'insufficient'   // no qualifying transfer for the required amount
  | 'replay'         // txHash already redeemed
  | 'not_ready'      // not mined / not enough confirmations / not finalized yet — retry
  | 'binding'        // payer-binding signature missing or invalid
  | 'infra'          // RPC / network failure verifying — retry
  | 'misconfig';     // server misconfiguration (bad price, missing payout)

export class PaymentError extends Error {
  constructor(public kind: PaymentErrorKind, message: string) {
    super(message);
    this.name = 'PaymentError';
  }
}

export function httpStatusFor(kind: PaymentErrorKind): number {
  switch (kind) {
    case 'malformed':
    case 'unsupported': return 400;
    case 'invalid':
    case 'insufficient':
    case 'binding': return 402;
    case 'replay': return 409;
    case 'not_ready': return 425;
    case 'infra': return 503;
    case 'misconfig': return 500;
    default: return 402;
  }
}

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

export const usdcContractAddress = getAddress('0x833589fcd6edb6e08f4c7c32d4f71b54bda02913');
export const usdcSolanaMint = 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v';

// Payout wallet is required. Fail fast with a clear message if it is missing,
// instead of viem's opaque getAddress error deep in a request.
export const evmPayoutAddress = (() => {
  const raw = process.env.X402_PAYOUT_ADDRESS;
  if (!raw) {
    throw new Error('X402_PAYOUT_ADDRESS is not set — the payment payout wallet must be configured.');
  }
  return getAddress(raw);
})();
export const solanaPayoutAddress = process.env.SOLANA_PAYOUT_ADDRESS;

// Binding closes txHash front-running: it requires the paying wallet to sign a
// challenge, so a public txHash cannot be redeemed by whoever merely observed
// it. It is ON by default. REQUIRE_PAYMENT_BINDING=false is honoured ONLY
// outside production (for local agents that cannot sign); in production the flag
// is ignored and binding is always enforced. See the 402 quote's `binding` block
// for the exact challenge format clients must sign.
const isProduction = (process.env.VERCEL_ENV ?? process.env.NODE_ENV) === 'production';
const bindingEnvDisabled = (process.env.REQUIRE_PAYMENT_BINDING ?? 'true').toLowerCase() === 'false';
if (bindingEnvDisabled && isProduction) {
  console.error(
    '[payment-verify] REQUIRE_PAYMENT_BINDING=false is IGNORED in production — payer binding is ' +
    'enforced to prevent txHash front-running. Unset the flag to silence this warning.',
  );
}
export const bindingRequired = isProduction ? true : !bindingEnvDisabled;

const usdcAbi = [
  {
    name: 'Transfer',
    type: 'event',
    inputs: [
      { indexed: true, name: 'from', type: 'address' },
      { indexed: true, name: 'to', type: 'address' },
      { indexed: false, name: 'value', type: 'uint256' },
    ],
  },
] as const;

const rpcUrl = process.env.BASE_RPC_URL || 'https://mainnet.base.org';
const publicClient = createPublicClient({ chain: base, transport: http(rpcUrl) });

const solanaRpcUrl = process.env.SOLANA_RPC_URL || 'https://api.mainnet-beta.solana.com';

const minEvmConfirmations = (() => {
  const n = BigInt(process.env.MIN_EVM_CONFIRMATIONS || '1');
  return n < BigInt(1) ? BigInt(1) : n;
})();

// Reject settlements older than this (seconds). Defence-in-depth against
// redeeming an old/observed transfer to the payout address; 0 disables. The
// default matches the 402 quote's advertised maxTimeoutSeconds (86400 = 24h) so
// a payment the quote says is valid is not rejected as "too old".
const paymentMaxAgeSeconds = Math.max(0, Number(process.env.PAYMENT_MAX_AGE_SECONDS || '86400'));

// ---------------------------------------------------------------------------
// Pure helpers (unit-tested in src/modules/commerce/payment-verify.test.ts)
// ---------------------------------------------------------------------------

const B58_ALPHABET = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
const B58_RE = /^[1-9A-HJ-NP-Za-km-z]+$/;

export function isHexTxHash(s: unknown): s is `0x${string}` {
  return typeof s === 'string' && /^0x[0-9a-fA-F]{64}$/.test(s);
}

export function isBase58Signature(s: unknown): s is string {
  return typeof s === 'string' && s.length >= 43 && s.length <= 128 && B58_RE.test(s);
}

export function base58Decode(str: string): Uint8Array {
  if (str.length === 0 || !B58_RE.test(str)) throw new Error('invalid base58');
  const bytes: number[] = [];
  for (const ch of str) {
    let carry = B58_ALPHABET.indexOf(ch);
    if (carry < 0) throw new Error('invalid base58 char');
    for (let j = 0; j < bytes.length; j++) {
      carry += bytes[j] * 58;
      bytes[j] = carry & 0xff;
      carry >>= 8;
    }
    while (carry > 0) {
      bytes.push(carry & 0xff);
      carry >>= 8;
    }
  }
  for (let k = 0; k < str.length && str[k] === '1'; k++) bytes.push(0);
  return Uint8Array.from(bytes.reverse());
}

// Net USDC (base units) credited to `owner` by this transaction, from the token
// balance deltas. Handles the recipient's token account being created inside the
// same transaction (no pre-entry) and multiple accounts sharing an owner.
export function usdcCreditedToOwner(meta: any, owner: string, mint: string): bigint {
  const sumFor = (arr: any[] | undefined): bigint =>
    (arr || [])
      .filter((b) => b?.mint === mint && b?.owner === owner)
      .reduce((acc: bigint, b: any) => acc + BigInt(b?.uiTokenAmount?.amount ?? '0'), BigInt(0));
  return sumFor(meta?.postTokenBalances) - sumFor(meta?.preTokenBalances);
}

// The exact string a paying wallet must sign to bind a payment to itself.
// Clients rebuild this verbatim (values from the 402 quote + their own txHash).
export function buildBindingChallenge(p: {
  network: string;
  txHash: string;
  payTo: string;
  requiredUnits: bigint;
  resourcePath: string;
}): string {
  return [
    'x402-payment-binding',
    'v1',
    p.network,
    p.txHash,
    p.payTo,
    p.requiredUnits.toString(),
    p.resourcePath,
  ].join('\n');
}

export const bindingChallengeTemplate =
  'x402-payment-binding\\nv1\\n{network}\\n{txHash}\\n{payTo}\\n{amountBaseUnits}\\n{resourcePath}';

async function verifyEd25519(pubkeyB58: string, sigB58: string, message: string): Promise<boolean> {
  let pub: Uint8Array;
  let sig: Uint8Array;
  try {
    pub = base58Decode(pubkeyB58);
    sig = base58Decode(sigB58);
  } catch {
    return false;
  }
  if (pub.length !== 32 || sig.length !== 64) return false;
  const subtle = globalThis.crypto?.subtle;
  if (!subtle) throw new Error('WebCrypto unavailable');
  try {
    const key = await subtle.importKey('raw', pub as unknown as ArrayBuffer, { name: 'Ed25519' } as any, false, ['verify']);
    return await subtle.verify({ name: 'Ed25519' } as any, key, sig as unknown as ArrayBuffer, new TextEncoder().encode(message));
  } catch {
    return false;
  }
}

// Minimal Solana JSON-RPC getTransaction (finalized, parsed). Returns the
// `result` object, or null if the signature is unknown / not yet finalized.
async function solanaGetTransaction(signature: string): Promise<any | null> {
  const res = await fetch(solanaRpcUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      jsonrpc: '2.0',
      id: 1,
      method: 'getTransaction',
      params: [signature, { commitment: 'finalized', maxSupportedTransactionVersion: 0, encoding: 'jsonParsed' }],
    }),
  });
  if (!res.ok) throw new Error(`Solana RPC HTTP ${res.status}`);
  const json = await res.json();
  if (json.error) throw new Error(`Solana RPC error: ${json.error.message || 'unknown'}`);
  return json.result ?? null;
}

// ---------------------------------------------------------------------------
// Chain verifiers
// ---------------------------------------------------------------------------

// Standard x402 path: the agent signed a gasless EIP-3009
// `TransferWithAuthorization` and WE settle it via a facilitator (which
// broadcasts and pays gas). This is how Bankr agents, x402-fetch, and most
// agent wallet layers pay. No binding signature is required on this path: the
// authorization itself is payer-bound (signed by `from`, payable only to our
// payout address, single-use nonce enforced on-chain by the USDC contract), so
// the txHash front-running that binding exists to stop cannot occur.
//
// Fail-closed: every doubt throws. Data is only served after /settle reports
// an on-chain transaction; that tx hash then flows into the same single-use
// replay guard (x402_payments.payment_sig) as self-settled payments.
async function verifyBaseEip3009(
  payload: any,
  requiredUnits: bigint,
  payTo: string,
  resourceUrl: string,
): Promise<{ buyerWallet: string; txHash: string }> {
  if (!facilitatorEnabled) {
    throw new PaymentError(
      'unsupported',
      'EIP-3009 settlement is disabled on this server — settle on-chain yourself and submit { txHash, payer, signature }',
    );
  }
  if (!isEip3009Payload(payload)) {
    throw new PaymentError('malformed', 'Malformed exact-scheme payload: expected { signature, authorization: { from, to, value, validAfter, validBefore, nonce } }');
  }

  const auth = payload.authorization;

  // Cheap local checks before any facilitator round-trip.
  if (getAddress(auth.to) !== getAddress(payTo)) {
    throw new PaymentError('invalid', 'authorization.to is not the payout address from the 402 quote');
  }
  if (BigInt(auth.value) < requiredUnits) {
    throw new PaymentError('insufficient', 'authorization.value is less than the required amount');
  }
  const now = Math.floor(Date.now() / 1000);
  if (Number(auth.validBefore) <= now + 5) {
    throw new PaymentError('invalid', 'Authorization expired (validBefore is in the past)');
  }
  if (Number(auth.validAfter) > now) {
    throw new PaymentError('invalid', 'Authorization not yet valid (validAfter is in the future)');
  }

  const requirements = buildPaymentRequirements({
    network: 'base',
    payTo,
    asset: usdcContractAddress,
    requiredUnits,
    resource: resourceUrl,
    description: 'Psychosynth x402 query',
  });

  const verified = await facilitatorVerify('base', payload, requirements);
  if (!verified.ok) {
    throw new PaymentError(verified.reason === 'infra' ? 'infra' : 'invalid', verified.message);
  }

  const settled = await facilitatorSettle('base', payload, requirements);
  if (!settled.ok) {
    throw new PaymentError(settled.reason === 'infra' ? 'infra' : 'invalid', settled.message);
  }

  return { buyerWallet: getAddress(auth.from), txHash: settled.transaction };
}

async function verifyBasePayment(
  payload: any,
  requiredUnits: bigint,
  payTo: string,
  resourcePath: string,
  resourceUrl?: string,
): Promise<{ buyerWallet: string; txHash: string }> {
  // Route between the two settlement models. An authorization-shaped payload
  // is the standard x402 flow (we settle); a txHash-shaped payload is the
  // self-settled flow (the agent already settled). Ambiguity fails closed as
  // malformed inside each verifier.
  if (looksLikeEip3009Payload(payload)) {
    return verifyBaseEip3009(payload, requiredUnits, payTo, resourceUrl || resourcePath);
  }

  const txHash = payload?.txHash;
  if (!isHexTxHash(txHash)) throw new PaymentError('malformed', 'Missing or malformed Base txHash');

  let receipt;
  try {
    receipt = await publicClient.getTransactionReceipt({ hash: txHash });
  } catch (e: any) {
    if (e?.name === 'TransactionReceiptNotFoundError') {
      throw new PaymentError('not_ready', 'Transaction not yet mined — retry after it confirms');
    }
    throw new PaymentError('infra', 'Base RPC error fetching receipt');
  }

  if (receipt.status !== 'success') throw new PaymentError('invalid', 'Transaction reverted on-chain');

  let head: bigint;
  try {
    head = await publicClient.getBlockNumber();
  } catch {
    throw new PaymentError('infra', 'Base RPC error fetching head block');
  }
  const confirmations = head >= receipt.blockNumber ? head - receipt.blockNumber + BigInt(1) : BigInt(0);
  if (confirmations < minEvmConfirmations) {
    throw new PaymentError('not_ready', `Awaiting confirmations (${confirmations}/${minEvmConfirmations})`);
  }

  if (paymentMaxAgeSeconds > 0) {
    let block;
    try {
      block = await publicClient.getBlock({ blockNumber: receipt.blockNumber });
    } catch {
      throw new PaymentError('infra', 'Base RPC error fetching block');
    }
    if (Math.floor(Date.now() / 1000) - Number(block.timestamp) > paymentMaxAgeSeconds) {
      throw new PaymentError('invalid', 'Payment transaction is too old');
    }
  }

  // Only trust Transfer logs emitted by the canonical USDC contract, so a
  // look-alike token cannot spoof a payment.
  const payToLc = payTo.toLowerCase();
  let sender = '';
  let found = false;
  for (const log of receipt.logs) {
    if (log.address.toLowerCase() !== usdcContractAddress.toLowerCase()) continue;
    try {
      const ev = decodeEventLog({ abi: usdcAbi, data: log.data, topics: log.topics });
      if (ev.eventName === 'Transfer') {
        const { from, to, value } = ev.args;
        if (to.toLowerCase() === payToLc && BigInt(value) >= requiredUnits) {
          sender = from;
          found = true;
          break;
        }
      }
    } catch {
      // not a Transfer log we understand
    }
  }
  if (!found) throw new PaymentError('insufficient', 'No USDC transfer to the payout address for the required amount');

  if (bindingRequired) {
    const { payer, signature } = payload || {};
    if (typeof payer !== 'string' || typeof signature !== 'string') {
      throw new PaymentError('binding', 'Payment binding required: include { payer, signature }');
    }
    let payerAddr: string;
    try {
      payerAddr = getAddress(payer);
    } catch {
      throw new PaymentError('malformed', 'Malformed payer address');
    }
    if (payerAddr.toLowerCase() !== sender.toLowerCase()) {
      throw new PaymentError('binding', 'Binding signer is not the payment sender');
    }
    const challenge = buildBindingChallenge({ network: 'base', txHash, payTo, requiredUnits, resourcePath });
    let ok = false;
    try {
      ok = await publicClient.verifyMessage({ address: payerAddr as `0x${string}`, message: challenge, signature: signature as `0x${string}` });
    } catch {
      throw new PaymentError('infra', 'Error verifying binding signature');
    }
    if (!ok) throw new PaymentError('binding', 'Invalid payment binding signature');
  }

  return { buyerWallet: sender, txHash };
}

async function verifySolanaPayment(
  payload: any,
  requiredUnits: bigint,
  payTo: string | undefined,
  resourcePath: string,
): Promise<{ buyerWallet: string; txHash: string }> {
  const txHash = payload?.txHash;
  if (!isBase58Signature(txHash)) throw new PaymentError('malformed', 'Missing or malformed Solana signature');
  if (!payTo) throw new PaymentError('misconfig', 'Solana payments are not configured');

  let tx: any;
  try {
    tx = await solanaGetTransaction(txHash);
  } catch {
    throw new PaymentError('infra', 'Solana RPC error');
  }
  if (!tx) throw new PaymentError('not_ready', 'Transaction not found or not finalized — retry');
  if (tx.meta?.err) throw new PaymentError('invalid', 'Solana transaction failed on-chain');

  if (paymentMaxAgeSeconds > 0 && typeof tx.blockTime === 'number') {
    if (Math.floor(Date.now() / 1000) - tx.blockTime > paymentMaxAgeSeconds) {
      throw new PaymentError('invalid', 'Payment transaction is too old');
    }
  }

  const credited = usdcCreditedToOwner(tx.meta, payTo, usdcSolanaMint);
  if (credited < requiredUnits) {
    throw new PaymentError('insufficient', 'USDC credited to the payout address is less than required');
  }

  const keys: any[] = tx.transaction?.message?.accountKeys ?? [];
  const feePayer = keys[0];
  let buyer = typeof feePayer === 'string' ? feePayer : (feePayer?.pubkey ?? '');

  if (bindingRequired) {
    const { payer, signature } = payload || {};
    if (typeof payer !== 'string' || typeof signature !== 'string') {
      throw new PaymentError('binding', 'Payment binding required: include { payer, signature }');
    }
    const isSigner = keys.some((k) => typeof k !== 'string' && k?.pubkey === payer && k?.signer === true);
    if (!isSigner) throw new PaymentError('binding', 'Binding signer did not authorize the payment transaction');
    const challenge = buildBindingChallenge({ network: 'solana', txHash, payTo, requiredUnits, resourcePath });
    let ok = false;
    try {
      ok = await verifyEd25519(payer, signature, challenge);
    } catch {
      throw new PaymentError('infra', 'Error verifying binding signature');
    }
    if (!ok) throw new PaymentError('binding', 'Invalid payment binding signature');
    buyer = payer;
  }

  if (!buyer) throw new PaymentError('invalid', 'Could not determine payer wallet');
  return { buyerWallet: buyer, txHash };
}

// ---------------------------------------------------------------------------
// Entry point
// ---------------------------------------------------------------------------

export async function verifyPayment(args: {
  network: string;
  payload: any;
  requiredUnits: bigint;
  resourcePath: string;
  resourceUrl?: string;
}): Promise<{ buyerWallet: string; txHash: string }> {
  const { network, payload, requiredUnits, resourcePath, resourceUrl } = args;
  if (requiredUnits <= BigInt(0)) throw new PaymentError('misconfig', 'Server price is not configured');
  if (network === 'base') return verifyBasePayment(payload, requiredUnits, evmPayoutAddress, resourcePath, resourceUrl);
  if (network === 'solana') return verifySolanaPayment(payload, requiredUnits, solanaPayoutAddress, resourcePath);
  throw new PaymentError('unsupported', 'Unsupported network');
}
