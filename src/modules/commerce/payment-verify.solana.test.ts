import { describe, it, expect, beforeAll, afterEach, vi } from 'vitest';
import bs58 from 'bs58';

// End-to-end coverage of the Solana settlement path (verifyPayment → Solana RPC).
// The pure helpers are covered in payment-verify.test.ts; this locks down the
// orchestration: a real USDC-SPL credit is accepted, and every failure mode
// (insufficient, not-finalized, on-chain failure, wrong mint/owner) is rejected.
//
// Isolated file: we set the env BEFORE importing the module so binding is off
// (no keypair needed) and a Solana payout is configured. The RPC is mocked at
// the fetch boundary, so no network is touched.

const PAYTO = 'HXFDaHyZ3i477z1BakiTWZg9UQN8rcreruuv9ifC1HvM';
const BUYER = '4Nd1mBQtrMJVYVfKf2PJy9NZUZdTAsp7D4xWLs4gDB4T';
const SIG = bs58.encode(Uint8Array.from({ length: 64 }, (_, i) => (i * 7 + 3) & 0xff)); // valid 64-byte base58

let verifyPayment: (a: any) => Promise<{ buyerWallet: string; txHash: string }>;
let MINT: string;

beforeAll(async () => {
  process.env.SOLANA_PAYOUT_ADDRESS = PAYTO;
  process.env.REQUIRE_PAYMENT_BINDING = 'false'; // honoured outside production
  const m = await import('./payment-verify');
  verifyPayment = m.verifyPayment;
  MINT = m.usdcSolanaMint;
});

afterEach(() => vi.unstubAllGlobals());

function mockRpc(result: unknown) {
  vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, json: async () => ({ jsonrpc: '2.0', id: 1, result }) })));
}
const bal = (owner: string, mint: string, amount: string) => ({ owner, mint, uiTokenAmount: { amount } });
function tx(post: any[], opts: { err?: unknown; pre?: any[]; blockTime?: number } = {}) {
  return {
    blockTime: opts.blockTime ?? Math.floor(Date.now() / 1000),
    meta: { err: opts.err ?? null, preTokenBalances: opts.pre ?? [], postTokenBalances: post },
    transaction: { message: { accountKeys: [{ pubkey: BUYER, signer: true }] } },
  };
}
const call = () => verifyPayment({ network: 'solana', payload: { txHash: SIG }, requiredUnits: BigInt(1_000_000), resourcePath: '/api/v1/query/x' });
async function kind(p: Promise<unknown>): Promise<string> {
  try { await p; return 'NO_THROW'; } catch (e: any) { return e?.kind ?? 'NOT_PAYMENT_ERROR'; }
}

describe('verifyPayment(solana) — end to end', () => {
  it('accepts a finalized tx that credits enough USDC to the payout owner', async () => {
    mockRpc(tx([bal(PAYTO, MINT, '1500000')]));
    await expect(call()).resolves.toEqual({ buyerWallet: BUYER, txHash: SIG });
  });

  it('accepts when the payout token account is created inside the same tx (no pre-balance)', async () => {
    mockRpc(tx([bal(PAYTO, MINT, '1000000')], { pre: [] }));
    await expect(call()).resolves.toEqual({ buyerWallet: BUYER, txHash: SIG });
  });

  it('rejects an underpayment as insufficient', async () => {
    mockRpc(tx([bal(PAYTO, MINT, '500000')]));
    expect(await kind(call())).toBe('insufficient');
  });

  it('rejects credit to the wrong owner as insufficient', async () => {
    mockRpc(tx([bal('SomeOtherWa11et1111111111111111111111111111', MINT, '9000000')]));
    expect(await kind(call())).toBe('insufficient');
  });

  it('rejects the wrong SPL mint (look-alike token) as insufficient', async () => {
    mockRpc(tx([bal(PAYTO, 'FakeMint1111111111111111111111111111111111', '9000000')]));
    expect(await kind(call())).toBe('insufficient');
  });

  it('rejects a not-yet-finalized signature as not_ready (retryable)', async () => {
    mockRpc(null);
    expect(await kind(call())).toBe('not_ready');
  });

  it('rejects an on-chain-failed tx as invalid', async () => {
    mockRpc(tx([bal(PAYTO, MINT, '2000000')], { err: { InstructionError: [0, 'Custom'] } }));
    expect(await kind(call())).toBe('invalid');
  });

  it('rejects a stale payment as invalid (older than max age)', async () => {
    mockRpc(tx([bal(PAYTO, MINT, '2000000')], { blockTime: Math.floor(Date.now() / 1000) - 90000 }));
    expect(await kind(call())).toBe('invalid');
  });

  it('rejects a malformed signature before any RPC call', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => { throw new Error('should not be called'); }));
    expect(await kind(verifyPayment({ network: 'solana', payload: { txHash: 'nope' }, requiredUnits: BigInt(1), resourcePath: '/x' }))).toBe('malformed');
  });
});
