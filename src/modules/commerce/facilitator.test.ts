import { describe, it, expect, vi, afterEach } from 'vitest';
import { getAddress } from 'viem';
import {
  looksLikeEip3009Payload,
  isEip3009Payload,
  buildPaymentRequirements,
  facilitatorVerify,
  facilitatorSettle,
} from './facilitator';
import { verifyPayment } from './payment-verify';

// The EIP-3009 path handles attacker-controlled input end-to-end: the payload
// shape, the authorization fields, and the facilitator's responses. Everything
// local must reject bad input BEFORE any facilitator round-trip, and the
// client must map facilitator failures to fail-closed results.

const ADDR_FROM = '0x00000000000000000000000000000000000000aa';
const PAY_TO = '0x0000000000000000000000000000000000000001'; // test payout (setup-env.ts)
const SIG = '0x' + 'ab'.repeat(65);
const NONCE = '0x' + 'cd'.repeat(32);

function validAuth(overrides: Record<string, string> = {}) {
  const now = Math.floor(Date.now() / 1000);
  return {
    from: ADDR_FROM,
    to: PAY_TO,
    value: '10000',
    validAfter: '0',
    validBefore: String(now + 3600),
    nonce: NONCE,
    ...overrides,
  };
}

function validPayload(overrides: Record<string, unknown> = {}) {
  return { signature: SIG, authorization: validAuth(), ...overrides };
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('looksLikeEip3009Payload', () => {
  it('routes authorization-shaped payloads to the eip3009 verifier', () => {
    expect(looksLikeEip3009Payload({ authorization: {} })).toBe(true);
    expect(looksLikeEip3009Payload(validPayload())).toBe(true);
  });
  it('routes txHash-shaped payloads to the self-settled verifier', () => {
    expect(looksLikeEip3009Payload({ txHash: '0xabc' })).toBe(false);
    expect(looksLikeEip3009Payload({ txHash: '0xabc', authorization: {} })).toBe(false);
    expect(looksLikeEip3009Payload({})).toBe(false);
    expect(looksLikeEip3009Payload(null)).toBe(false);
  });
});

describe('isEip3009Payload', () => {
  it('accepts a well-formed payload', () => {
    expect(isEip3009Payload(validPayload())).toBe(true);
  });
  it('rejects missing or malformed signature', () => {
    expect(isEip3009Payload({ authorization: validAuth() })).toBe(false);
    expect(isEip3009Payload(validPayload({ signature: '0x1234' }))).toBe(false);
    expect(isEip3009Payload(validPayload({ signature: 'ab'.repeat(65) }))).toBe(false);
  });
  it('rejects malformed authorization fields', () => {
    expect(isEip3009Payload({ signature: SIG })).toBe(false);
    expect(isEip3009Payload({ signature: SIG, authorization: validAuth({ from: 'nope' }) })).toBe(false);
    expect(isEip3009Payload({ signature: SIG, authorization: validAuth({ value: '1.5' }) })).toBe(false);
    expect(isEip3009Payload({ signature: SIG, authorization: validAuth({ value: '-1' }) })).toBe(false);
    expect(isEip3009Payload({ signature: SIG, authorization: validAuth({ nonce: '0x12' }) })).toBe(false);
    expect(isEip3009Payload({ signature: SIG, authorization: validAuth({ validBefore: 'soon' }) })).toBe(false);
  });
  it('never throws on junk', () => {
    for (const junk of [null, undefined, 42, 'str', [], { authorization: null }]) {
      expect(isEip3009Payload(junk)).toBe(false);
    }
  });
});

describe('buildPaymentRequirements', () => {
  it('produces the canonical x402 v1 requirements shape', () => {
    const r = buildPaymentRequirements({
      network: 'base',
      payTo: PAY_TO,
      asset: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
      requiredUnits: BigInt(10000),
      resource: 'https://x.test/api/v1/query/foo',
      description: 'test',
    });
    expect(r).toMatchObject({
      scheme: 'exact',
      network: 'base',
      maxAmountRequired: '10000',
      payTo: PAY_TO,
      mimeType: 'application/json',
      maxTimeoutSeconds: 86400,
      extra: { name: 'USD Coin', version: '2' },
    });
  });
});

function stubFetchOnce(responses: Array<{ status?: number; json?: unknown } | 'network-error'>) {
  const fn = vi.fn();
  for (const r of responses) {
    if (r === 'network-error') {
      fn.mockRejectedValueOnce(new Error('ECONNREFUSED'));
    } else {
      fn.mockResolvedValueOnce({
        status: r.status ?? 200,
        json: async () => r.json ?? {},
      });
    }
  }
  vi.stubGlobal('fetch', fn);
  return fn;
}

const REQS = buildPaymentRequirements({
  network: 'base',
  payTo: PAY_TO,
  asset: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
  requiredUnits: BigInt(10000),
  resource: 'https://x.test/r',
  description: 'test',
});

describe('facilitatorVerify / facilitatorSettle result mapping', () => {
  it('maps isValid=true to ok', async () => {
    stubFetchOnce([{ json: { isValid: true, payer: ADDR_FROM } }]);
    const r = await facilitatorVerify('base', validPayload() as any, REQS);
    expect(r.ok).toBe(true);
  });
  it('maps isValid=false to invalid with the facilitator reason', async () => {
    stubFetchOnce([{ json: { isValid: false, invalidReason: 'insufficient_funds' } }]);
    const r = await facilitatorVerify('base', validPayload() as any, REQS);
    expect(r).toMatchObject({ ok: false, reason: 'invalid', message: 'insufficient_funds' });
  });
  it('maps HTTP 5xx and network failure to infra (retryable, fail-closed)', async () => {
    stubFetchOnce([{ status: 503, json: {} }, 'network-error']);
    expect(await facilitatorVerify('base', validPayload() as any, REQS)).toMatchObject({ ok: false, reason: 'infra' });
    expect(await facilitatorVerify('base', validPayload() as any, REQS)).toMatchObject({ ok: false, reason: 'infra' });
  });
  it('settle: requires success=true AND a well-formed tx hash', async () => {
    const tx = '0x' + 'ef'.repeat(32);
    stubFetchOnce([
      { json: { success: true, transaction: tx } },
      { json: { success: true, transaction: 'not-a-hash' } },
      { json: { success: false, errorReason: 'nonce_used' } },
    ]);
    expect(await facilitatorSettle('base', validPayload() as any, REQS)).toMatchObject({ ok: true, transaction: tx });
    expect(await facilitatorSettle('base', validPayload() as any, REQS)).toMatchObject({ ok: false, reason: 'invalid' });
    expect(await facilitatorSettle('base', validPayload() as any, REQS)).toMatchObject({ ok: false, reason: 'invalid', message: 'nonce_used' });
  });
});

describe('verifyPayment eip3009 routing (local guards, no facilitator round-trip)', () => {
  const base = { network: 'base', requiredUnits: BigInt(10000), resourcePath: '/x', resourceUrl: 'https://x.test/x' };

  it('rejects a payload that looks eip3009 but fails strict validation as malformed', async () => {
    await expect(
      verifyPayment({ ...base, payload: { authorization: { from: 'junk' } } }),
    ).rejects.toMatchObject({ kind: 'malformed' });
  });

  it('rejects authorization.to that is not the payout address', async () => {
    const payload = { signature: SIG, authorization: validAuth({ to: ADDR_FROM }) };
    await expect(verifyPayment({ ...base, payload })).rejects.toMatchObject({ kind: 'invalid' });
  });

  it('rejects an underpaying authorization.value', async () => {
    const payload = { signature: SIG, authorization: validAuth({ value: '9999' }) };
    await expect(verifyPayment({ ...base, payload })).rejects.toMatchObject({ kind: 'insufficient' });
  });

  it('rejects an expired authorization', async () => {
    const payload = { signature: SIG, authorization: validAuth({ validBefore: '10' }) };
    await expect(verifyPayment({ ...base, payload })).rejects.toMatchObject({ kind: 'invalid' });
  });

  it('rejects a not-yet-valid authorization', async () => {
    const future = String(Math.floor(Date.now() / 1000) + 999);
    const payload = { signature: SIG, authorization: validAuth({ validAfter: future }) };
    await expect(verifyPayment({ ...base, payload })).rejects.toMatchObject({ kind: 'invalid' });
  });

  it('settles a valid authorization via the facilitator and returns the settlement tx', async () => {
    const tx = '0x' + '12'.repeat(32);
    const fn = stubFetchOnce([
      { json: { isValid: true, payer: ADDR_FROM } },
      { json: { success: true, transaction: tx, payer: ADDR_FROM } },
    ]);
    const r = await verifyPayment({ ...base, payload: validPayload() });
    expect(r).toEqual({ buyerWallet: getAddress(ADDR_FROM), txHash: tx });
    expect(fn).toHaveBeenCalledTimes(2);
    expect(String(fn.mock.calls[0][0])).toContain('/verify');
    expect(String(fn.mock.calls[1][0])).toContain('/settle');
    // The facilitator receives the FULL x402 envelope + canonical requirements.
    const body = JSON.parse(fn.mock.calls[0][1].body);
    expect(body).toMatchObject({
      x402Version: 1,
      paymentPayload: { x402Version: 1, scheme: 'exact', network: 'base' },
      paymentRequirements: { scheme: 'exact', network: 'base', maxAmountRequired: '10000' },
    });
  });

  it('fails closed (infra) when the facilitator is unreachable — no data served', async () => {
    stubFetchOnce(['network-error']);
    await expect(verifyPayment({ ...base, payload: validPayload() })).rejects.toMatchObject({ kind: 'infra' });
  });

  it('fails closed when settle fails even after a valid verify', async () => {
    stubFetchOnce([
      { json: { isValid: true } },
      { json: { success: false, errorReason: 'nonce_used' } },
    ]);
    await expect(verifyPayment({ ...base, payload: validPayload() })).rejects.toMatchObject({ kind: 'invalid' });
  });
});
