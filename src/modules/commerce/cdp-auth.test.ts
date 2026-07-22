import { describe, it, expect } from 'vitest';
import { signCdpJwt } from './cdp-auth';

// The JWT must byte-for-byte match what @coinbase/cdp-sdk's generateJwt
// produces (same header/claim shape) or CDP rejects it with a 401 and every
// standard-x402 settlement fails. Verified against cdp-sdk 1.54.0 source.

const td = new TextDecoder();

function b64urlDecode(s: string): Uint8Array {
  const b64 = s.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - (s.length % 4)) % 4);
  return Uint8Array.from(Buffer.from(b64, 'base64'));
}

async function makeKey(): Promise<{ secretB64: string; publicJwk: JsonWebKey }> {
  const pair = (await crypto.subtle.generateKey({ name: 'Ed25519' } as any, true, [
    'sign',
    'verify',
  ])) as CryptoKeyPair;
  const priv = (await crypto.subtle.exportKey('jwk', pair.privateKey)) as JsonWebKey;
  const seed = b64urlDecode(priv.d as string);
  const pub = b64urlDecode(priv.x as string);
  const secret = new Uint8Array(64);
  secret.set(seed, 0);
  secret.set(pub, 32);
  return {
    secretB64: Buffer.from(secret).toString('base64'),
    publicJwk: { kty: 'OKP', crv: 'Ed25519', x: priv.x },
  };
}

describe('signCdpJwt', () => {
  it('produces a verifiable EdDSA JWT with the exact CDP claim shape', async () => {
    const { secretB64, publicJwk } = await makeKey();
    const jwt = await signCdpJwt('key-id-1', secretB64, 'POST', 'api.cdp.coinbase.com', '/platform/v2/x402/settle');
    expect(jwt).toBeTruthy();

    const [h, p, s] = (jwt as string).split('.');
    const header = JSON.parse(td.decode(b64urlDecode(h)));
    const payload = JSON.parse(td.decode(b64urlDecode(p)));

    expect(header).toMatchObject({ alg: 'EdDSA', kid: 'key-id-1', typ: 'JWT' });
    expect(typeof header.nonce).toBe('string');
    expect(header.nonce.length).toBe(32);

    expect(payload).toMatchObject({
      sub: 'key-id-1',
      iss: 'cdp',
      uris: ['POST api.cdp.coinbase.com/platform/v2/x402/settle'],
    });
    expect(payload.nbf).toBe(payload.iat);
    expect(payload.exp - payload.iat).toBe(120);

    const key = await crypto.subtle.importKey('jwk', publicJwk, { name: 'Ed25519' } as any, false, ['verify']);
    const ok = await crypto.subtle.verify(
      { name: 'Ed25519' } as any,
      key,
      b64urlDecode(s) as unknown as ArrayBuffer,
      new TextEncoder().encode(`${h}.${p}`),
    );
    expect(ok).toBe(true);
  });

  it('returns null for a secret that is not a 64-byte base64 Ed25519 key', async () => {
    expect(await signCdpJwt('k', 'not-base64!!', 'POST', 'h', '/p')).toBeNull();
    expect(await signCdpJwt('k', Buffer.alloc(32).toString('base64'), 'POST', 'h', '/p')).toBeNull();
    expect(
      await signCdpJwt('k', '-----BEGIN EC PRIVATE KEY-----', 'POST', 'h', '/p'),
    ).toBeNull();
  });
});
