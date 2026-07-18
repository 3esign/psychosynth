import { describe, it, expect } from 'vitest';
import bs58 from 'bs58';
import {
  isHexTxHash,
  isBase58Signature,
  base58Decode,
  usdcCreditedToOwner,
  buildBindingChallenge,
  bindingChallengeTemplate,
  httpStatusFor,
  verifyPayment,
  PaymentError,
  usdcSolanaMint,
} from './payment-verify';

// These are the pure, deterministic helpers that the on-chain payment gate
// depends on. They handle attacker-controlled input (txHashes, signatures, RPC
// token-balance blobs) and must never throw on bad input or silently miscount a
// credited amount — so they are the highest-value thing to lock down with tests.

describe('isHexTxHash', () => {
  it('accepts a well-formed 32-byte hex hash', () => {
    expect(isHexTxHash('0x' + 'a'.repeat(64))).toBe(true);
    expect(isHexTxHash('0x' + 'A1b2'.repeat(16))).toBe(true);
  });
  it('rejects wrong length, missing prefix, non-hex, and non-strings', () => {
    expect(isHexTxHash('0x' + 'a'.repeat(63))).toBe(false);
    expect(isHexTxHash('0x' + 'a'.repeat(65))).toBe(false);
    expect(isHexTxHash('a'.repeat(64))).toBe(false);
    expect(isHexTxHash('0x' + 'g'.repeat(64))).toBe(false);
    expect(isHexTxHash(null)).toBe(false);
    expect(isHexTxHash(12345)).toBe(false);
    expect(isHexTxHash(undefined)).toBe(false);
  });
});

describe('isBase58Signature', () => {
  it('accepts a plausible base58 Solana signature (64-byte sig ~= 87-88 chars)', () => {
    const sig = bs58.encode(new Uint8Array(64).fill(7));
    expect(isBase58Signature(sig)).toBe(true);
  });
  it('rejects too-short, too-long, non-base58, and non-strings', () => {
    expect(isBase58Signature('abc')).toBe(false); // too short (<43)
    expect(isBase58Signature('1'.repeat(129))).toBe(false); // too long (>128)
    expect(isBase58Signature('0OIl' + 'a'.repeat(50))).toBe(false); // contains 0,O,I,l
    expect(isBase58Signature(null)).toBe(false);
    expect(isBase58Signature(42)).toBe(false);
  });
});

describe('base58Decode', () => {
  it('round-trips against the bs58 library for random byte arrays', () => {
    for (let i = 0; i < 25; i++) {
      const len = 1 + Math.floor(Math.random() * 64);
      const bytes = new Uint8Array(len);
      for (let j = 0; j < len; j++) bytes[j] = Math.floor(Math.random() * 256);
      const encoded = bs58.encode(bytes);
      const decoded = base58Decode(encoded);
      expect(Array.from(decoded)).toEqual(Array.from(bytes));
    }
  });
  it('preserves leading zero bytes (encoded as leading "1"s)', () => {
    const bytes = new Uint8Array([0, 0, 0, 5, 9]);
    const decoded = base58Decode(bs58.encode(bytes));
    expect(Array.from(decoded)).toEqual([0, 0, 0, 5, 9]);
  });
  it('throws on empty or invalid input', () => {
    expect(() => base58Decode('')).toThrow();
    expect(() => base58Decode('0OIl')).toThrow();
  });
});

describe('usdcCreditedToOwner', () => {
  const owner = 'OwnerPubkey111111111111111111111111111111111';
  const other = 'OtherPubkey11111111111111111111111111111111';

  const bal = (o: string, mint: string, amount: string) => ({ owner: o, mint, uiTokenAmount: { amount } });

  it('computes the net credit when the recipient token account is created in-tx (no pre-entry)', () => {
    const meta = {
      preTokenBalances: [],
      postTokenBalances: [bal(owner, usdcSolanaMint, '1500000')],
    };
    expect(usdcCreditedToOwner(meta, owner, usdcSolanaMint)).toBe(BigInt(1500000));
  });

  it('computes the delta across pre and post balances', () => {
    const meta = {
      preTokenBalances: [bal(owner, usdcSolanaMint, '1000000')],
      postTokenBalances: [bal(owner, usdcSolanaMint, '3000000')],
    };
    expect(usdcCreditedToOwner(meta, owner, usdcSolanaMint)).toBe(BigInt(2000000));
  });

  it('sums multiple accounts sharing the same owner', () => {
    const meta = {
      preTokenBalances: [],
      postTokenBalances: [
        bal(owner, usdcSolanaMint, '500000'),
        bal(owner, usdcSolanaMint, '500000'),
      ],
    };
    expect(usdcCreditedToOwner(meta, owner, usdcSolanaMint)).toBe(BigInt(1000000));
  });

  it('ignores a look-alike mint and other owners', () => {
    const meta = {
      preTokenBalances: [],
      postTokenBalances: [
        bal(owner, 'FAKEMINT1111111111111111111111111111111111', '9999999'),
        bal(other, usdcSolanaMint, '9999999'),
      ],
    };
    expect(usdcCreditedToOwner(meta, owner, usdcSolanaMint)).toBe(BigInt(0));
  });

  it('is robust to missing arrays and malformed entries', () => {
    expect(usdcCreditedToOwner({}, owner, usdcSolanaMint)).toBe(BigInt(0));
    expect(usdcCreditedToOwner(undefined, owner, usdcSolanaMint)).toBe(BigInt(0));
    const meta = { postTokenBalances: [{ owner, mint: usdcSolanaMint }] }; // no uiTokenAmount
    expect(usdcCreditedToOwner(meta, owner, usdcSolanaMint)).toBe(BigInt(0));
  });
});

describe('buildBindingChallenge / template', () => {
  it('produces the exact newline-joined challenge a client must sign', () => {
    const challenge = buildBindingChallenge({
      network: 'base',
      txHash: '0xabc',
      payTo: '0xPayTo',
      requiredUnits: BigInt(250000),
      resourcePath: '/api/v1/query/foo?tier=base',
    });
    expect(challenge).toBe(
      ['x402-payment-binding', 'v1', 'base', '0xabc', '0xPayTo', '250000', '/api/v1/query/foo?tier=base'].join('\n'),
    );
  });

  it('advertised template matches the real challenge structure (7 newline-separated fields)', () => {
    // The template uses literal "\n" sequences that clients expand to newlines.
    const expandedTemplate = bindingChallengeTemplate.replace(/\\n/g, '\n');
    const challenge = buildBindingChallenge({
      network: '{network}',
      txHash: '{txHash}',
      payTo: '{payTo}',
      requiredUnits: BigInt(0),
      resourcePath: '{resourcePath}',
    });
    // Field count and fixed header/version must line up.
    expect(expandedTemplate.split('\n').length).toBe(challenge.split('\n').length);
    expect(expandedTemplate.split('\n').slice(0, 3)).toEqual(['x402-payment-binding', 'v1', '{network}']);
  });
});

describe('httpStatusFor', () => {
  it('maps each payment error kind to the intended HTTP status', () => {
    expect(httpStatusFor('malformed')).toBe(400);
    expect(httpStatusFor('unsupported')).toBe(400);
    expect(httpStatusFor('invalid')).toBe(402);
    expect(httpStatusFor('insufficient')).toBe(402);
    expect(httpStatusFor('binding')).toBe(402);
    expect(httpStatusFor('replay')).toBe(409);
    expect(httpStatusFor('not_ready')).toBe(425);
    expect(httpStatusFor('infra')).toBe(503);
    expect(httpStatusFor('misconfig')).toBe(500);
  });
});

describe('verifyPayment guards (no network)', () => {
  it('rejects a non-positive required amount as misconfig before any RPC', async () => {
    await expect(
      verifyPayment({ network: 'base', payload: {}, requiredUnits: BigInt(0), resourcePath: '/x' }),
    ).rejects.toMatchObject({ kind: 'misconfig' });
  });

  it('rejects an unsupported network', async () => {
    await expect(
      verifyPayment({ network: 'dogecoin', payload: {}, requiredUnits: BigInt(1), resourcePath: '/x' }),
    ).rejects.toBeInstanceOf(PaymentError);
    await expect(
      verifyPayment({ network: 'dogecoin', payload: {}, requiredUnits: BigInt(1), resourcePath: '/x' }),
    ).rejects.toMatchObject({ kind: 'unsupported' });
  });

  it('rejects a malformed Base txHash before touching the RPC', async () => {
    await expect(
      verifyPayment({ network: 'base', payload: { txHash: 'not-a-hash' }, requiredUnits: BigInt(1), resourcePath: '/x' }),
    ).rejects.toMatchObject({ kind: 'malformed' });
  });

  it('rejects a malformed Solana signature before touching the RPC', async () => {
    await expect(
      verifyPayment({ network: 'solana', payload: { txHash: 'short' }, requiredUnits: BigInt(1), resourcePath: '/x' }),
    ).rejects.toMatchObject({ kind: 'malformed' });
  });
});
