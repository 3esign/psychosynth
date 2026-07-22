import { describe, it, expect } from 'vitest';
import {
  validateDiscoveryExtension,
  isDiscoverableV1,
  extractDiscoveryInfoV1,
} from '@x402/extensions/bazaar';
import { queryBazaarDiscovery, evalBazaarDiscovery } from './bazaar';
import { buildPaymentRequirements } from './facilitator';

// The whole point of bazaar.ts is that the metadata it emits passes the
// package's OWN validator — the raw declareDiscoveryExtension output does not
// (missing input.method; input example must satisfy inputSchema). If these
// break, CDP silently drops the metadata at index time.

const bazaarOf = (d: { extensions: Record<string, unknown> }) =>
  (d.extensions as any).bazaar;

describe('queryBazaarDiscovery', () => {
  const d = queryBazaarDiscovery('personality-profile-library');

  it('emits a v2 extension that passes the package validator', () => {
    const v = validateDiscoveryExtension(bazaarOf(d));
    expect(v).toMatchObject({ valid: true });
  });

  it('declares a GET http input (method patched in — the builder omits it)', () => {
    expect(bazaarOf(d).info.input).toMatchObject({ type: 'http', method: 'GET' });
  });

  it('outputSchema (v1) equals the extension info and reflects the real response shape', () => {
    expect(d.outputSchema).toBe(bazaarOf(d).info);
    expect((d.outputSchema as any).output.example).toHaveProperty('records');
    expect((d.outputSchema as any).output.example).toHaveProperty('provenance');
  });
});

describe('evalBazaarDiscovery', () => {
  const d = evalBazaarDiscovery('robinhood-stress-battery', 2);

  it('emits a v2 extension that passes the package validator', () => {
    const v = validateDiscoveryExtension(bazaarOf(d));
    expect(v).toMatchObject({ valid: true });
  });

  it('declares a POST json-body input whose example satisfies required fields', () => {
    const input = bazaarOf(d).info.input;
    expect(input).toMatchObject({ type: 'http', method: 'POST', bodyType: 'json' });
    expect(input.body).toHaveProperty('responses');
  });
});

describe('v1 discoverability through PaymentRequirements', () => {
  const base = {
    network: 'base',
    payTo: '0x0000000000000000000000000000000000000001',
    asset: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
    requiredUnits: BigInt(10000),
    resource: 'https://x.test/api/v1/query/foo',
    description: 'test',
  };

  it('requirements WITH outputSchema are discoverable and round-trip the info', () => {
    const d = queryBazaarDiscovery('foo');
    const reqs = buildPaymentRequirements({ ...base, outputSchema: d.outputSchema });
    expect(isDiscoverableV1(reqs as any)).toBe(true);
    expect(extractDiscoveryInfoV1(reqs as any)).not.toBeNull();
  });

  it('requirements WITHOUT outputSchema omit the field entirely (no `outputSchema: undefined` leak)', () => {
    const reqs = buildPaymentRequirements(base);
    expect('outputSchema' in reqs).toBe(false);
    expect(isDiscoverableV1(reqs as any)).toBe(false);
  });
});
