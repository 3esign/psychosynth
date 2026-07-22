// CDP facilitator auth — zero-dependency, edge-safe Bearer JWT (Ed25519/EdDSA).
//
// Coinbase's CDP x402 facilitator (https://api.cdp.coinbase.com/platform/v2/x402)
// requires a CDP API key on mainnet: every request carries a short-lived JWT
// signed with the key's secret. Without it /settle returns 401 and every
// standard-x402 payment fails — so pointing X402_FACILITATOR_URL at CDP is only
// safe once CDP_API_KEY_ID + CDP_API_KEY_SECRET are configured.
//
// This reproduces the exact claim shape of @coinbase/cdp-sdk's generateJwt
// (verified against cdp-sdk 1.54.0 source):
//   header  { alg: 'EdDSA', kid: <keyId>, typ: 'JWT', nonce: <random hex> }
//   payload { sub: <keyId>, iss: 'cdp',
//             uris: ['<METHOD> <host><path>'], iat, nbf, exp: iat + 120 }
// using WebCrypto only, so it works in both the Node and middleware (edge)
// runtimes and keeps the facilitator client dependency-free (same discipline as
// payment-verify's Ed25519 binding verifier).
//
// Key format: CDP "Secret API keys" are Ed25519 — base64 of 64 bytes
// (32-byte seed || 32-byte public key). Legacy ECDSA PEM keys are NOT supported
// here; create an Ed25519 key in the CDP portal instead.
//
// Failure mode: if the key is missing or malformed we return {} (request goes
// out unauthenticated) — the facilitator then rejects it and payment-verify
// fails CLOSED upstream. A malformed key is logged loudly once per boot.

const apiKeyId = process.env.CDP_API_KEY_ID || '';
const apiKeySecret = process.env.CDP_API_KEY_SECRET || '';

export const cdpAuthConfigured = Boolean(apiKeyId && apiKeySecret);

let warnedBadKey = false;

function bytesFromBase64(b64: string): Uint8Array | null {
  try {
    if (typeof globalThis.atob === 'function') {
      const bin = globalThis.atob(b64);
      const out = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
      return out;
    }
    return Uint8Array.from(Buffer.from(b64, 'base64'));
  } catch {
    return null;
  }
}

function b64url(bytes: Uint8Array): string {
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  const b64 = typeof globalThis.btoa === 'function'
    ? globalThis.btoa(bin)
    : Buffer.from(bytes).toString('base64');
  return b64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function b64urlJson(obj: unknown): string {
  return b64url(new TextEncoder().encode(JSON.stringify(obj)));
}

/**
 * Sign one CDP JWT with an explicit key pair. Pure — exported for unit tests;
 * production code goes through cdpAuthHeaders (env-driven) below.
 * Returns null when the secret is not a 64-byte base64 Ed25519 key.
 */
export async function signCdpJwt(
  keyId: string,
  keySecret: string,
  requestMethod: string,
  requestHost: string,
  requestPath: string,
): Promise<string | null> {
  const raw = bytesFromBase64(keySecret);
  if (!raw || raw.length !== 64) return null;

  const subtle = globalThis.crypto?.subtle;
  if (!subtle) return null;

  const jwk = {
    kty: 'OKP',
    crv: 'Ed25519',
    d: b64url(raw.slice(0, 32)),
    x: b64url(raw.slice(32)),
  };
  const key = await subtle.importKey('jwk', jwk as JsonWebKey, { name: 'Ed25519' } as any, false, ['sign']);

  const now = Math.floor(Date.now() / 1000);
  const nonce = Array.from(globalThis.crypto.getRandomValues(new Uint8Array(16)))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');

  const header = { alg: 'EdDSA', kid: keyId, typ: 'JWT', nonce };
  const payload = {
    sub: keyId,
    iss: 'cdp',
    uris: [`${requestMethod} ${requestHost}${requestPath}`],
    iat: now,
    nbf: now,
    exp: now + 120,
  };

  const signingInput = `${b64urlJson(header)}.${b64urlJson(payload)}`;
  const sig = new Uint8Array(
    await subtle.sign({ name: 'Ed25519' } as any, key, new TextEncoder().encode(signingInput)),
  );
  return `${signingInput}.${b64url(sig)}`;
}

/**
 * Authorization header for one CDP facilitator request, or {} when CDP auth is
 * not configured (e.g. the default PayAI facilitator, which needs none).
 *
 * @param requestMethod - HTTP method of the facilitator call (e.g. 'POST')
 * @param requestHost - facilitator host (e.g. 'api.cdp.coinbase.com')
 * @param requestPath - full request path (e.g. '/platform/v2/x402/settle')
 */
export async function cdpAuthHeaders(
  requestMethod: string,
  requestHost: string,
  requestPath: string,
): Promise<Record<string, string>> {
  if (!cdpAuthConfigured) return {};
  try {
    const jwt = await signCdpJwt(apiKeyId, apiKeySecret, requestMethod, requestHost, requestPath);
    if (!jwt) {
      if (!warnedBadKey) {
        warnedBadKey = true;
        console.error(
          '[cdp-auth] CDP_API_KEY_SECRET is not a base64 Ed25519 secret (expected 64 bytes: seed || public key). ' +
          'Legacy ECDSA PEM keys are unsupported — create an Ed25519 key in the CDP portal. ' +
          'Facilitator requests will go out UNAUTHENTICATED and CDP will reject them.',
        );
      }
      return {};
    }
    return { Authorization: `Bearer ${jwt}` };
  } catch (e) {
    if (!warnedBadKey) {
      warnedBadKey = true;
      console.error('[cdp-auth] Failed to sign CDP JWT — facilitator requests will go out unauthenticated:', e);
    }
    return {};
  }
}
