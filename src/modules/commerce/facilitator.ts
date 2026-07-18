// x402 facilitator client — standard "exact"-scheme (EIP-3009) settlement.
//
// Psychosynth's original payment path is SELF-SETTLED: the agent broadcasts a
// USDC transfer itself and hands us the txHash (verified in payment-verify.ts).
// The dominant pattern in the wider x402 ecosystem — Bankr agents, Coinbase's
// x402-fetch, most agent wallet layers — is the opposite: the agent signs a
// gasless EIP-3009 `TransferWithAuthorization` payload and expects the SELLER
// to settle it on-chain. This module performs that settlement through an x402
// facilitator (default: PayAI's public facilitator, which is free, requires no
// API key, and supports `exact` on Base mainnet). The facilitator broadcasts
// the transfer and pays gas, so accepting standard agents costs us nothing.
//
// This file is deliberately dependency-free and side-effect-free: pure shape
// validators plus a thin HTTP client that returns discriminated results.
// payment-verify.ts owns the mapping to PaymentError and the fail-closed
// policy — nothing is ever served unless /settle reports on-chain success.

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

// Public facilitators known to support x402Version 1 `exact` on Base mainnet
// without auth (checked July 2026): https://facilitator.payai.network
// Override with X402_FACILITATOR_URL (e.g. a CDP or Bankr facilitator).
export const facilitatorUrl = (
  process.env.X402_FACILITATOR_URL || 'https://facilitator.payai.network'
).replace(/\/+$/, '');

// EIP-3009 settlement is ON by default (it is what makes the API payable by
// standard x402 clients). Set X402_FACILITATOR_ENABLED=false to refuse
// authorization payloads and accept only self-settled txHash payments.
export const facilitatorEnabled =
  (process.env.X402_FACILITATOR_ENABLED ?? 'true').toLowerCase() !== 'false';

// ---------------------------------------------------------------------------
// Payload shape (x402Version 1, scheme "exact", EVM)
// ---------------------------------------------------------------------------

export interface Eip3009Authorization {
  from: string;
  to: string;
  value: string;        // USDC base units as a decimal string
  validAfter: string;   // unix seconds, decimal string
  validBefore: string;  // unix seconds, decimal string
  nonce: string;        // 32-byte hex
}

export interface Eip3009Payload {
  signature: string;    // 65-byte hex EIP-712 signature
  authorization: Eip3009Authorization;
}

const HEX_ADDR_RE = /^0x[0-9a-fA-F]{40}$/;
const HEX_SIG_RE = /^0x[0-9a-fA-F]{130}$/;
const HEX_32_RE = /^0x[0-9a-fA-F]{64}$/;
const DEC_RE = /^\d+$/;

// True iff the client is attempting the standard-x402 authorization path at
// all (as opposed to the self-settled txHash path). Used to route between the
// two verifiers; a payload that "looks eip3009" but fails strict validation
// must be rejected as malformed, not silently retried as a txHash payment.
export function looksLikeEip3009Payload(p: unknown): boolean {
  if (!p || typeof p !== 'object') return false;
  const o = p as Record<string, unknown>;
  return o.authorization !== undefined && o.txHash === undefined;
}

// Strict validation of attacker-controlled input. Never throws.
export function isEip3009Payload(p: unknown): p is Eip3009Payload {
  if (!p || typeof p !== 'object') return false;
  const o = p as Record<string, unknown>;
  if (typeof o.signature !== 'string' || !HEX_SIG_RE.test(o.signature)) return false;
  const a = o.authorization as Record<string, unknown> | undefined;
  if (!a || typeof a !== 'object') return false;
  if (typeof a.from !== 'string' || !HEX_ADDR_RE.test(a.from)) return false;
  if (typeof a.to !== 'string' || !HEX_ADDR_RE.test(a.to)) return false;
  if (typeof a.value !== 'string' || !DEC_RE.test(a.value)) return false;
  if (typeof a.validAfter !== 'string' || !DEC_RE.test(a.validAfter)) return false;
  if (typeof a.validBefore !== 'string' || !DEC_RE.test(a.validBefore)) return false;
  if (typeof a.nonce !== 'string' || !HEX_32_RE.test(a.nonce)) return false;
  return true;
}

// ---------------------------------------------------------------------------
// PaymentRequirements (the accepts[] entry, canonical x402 v1 fields only)
// ---------------------------------------------------------------------------

export interface PaymentRequirements {
  scheme: 'exact';
  network: string;
  maxAmountRequired: string;
  resource: string;
  description: string;
  mimeType: string;
  payTo: string;
  maxTimeoutSeconds: number;
  asset: string;
  extra: { name: string; version: string };
}

export function buildPaymentRequirements(p: {
  network: string;
  payTo: string;
  asset: string;
  requiredUnits: bigint;
  resource: string;
  description: string;
}): PaymentRequirements {
  return {
    scheme: 'exact',
    network: p.network,
    maxAmountRequired: p.requiredUnits.toString(),
    resource: p.resource,
    description: p.description,
    mimeType: 'application/json',
    payTo: p.payTo,
    maxTimeoutSeconds: 86400,
    asset: p.asset,
    extra: { name: 'USD Coin', version: '2' },
  };
}

// ---------------------------------------------------------------------------
// Facilitator HTTP client
// ---------------------------------------------------------------------------

export type FacilitatorVerifyResult =
  | { ok: true; payer?: string }
  | { ok: false; reason: 'invalid'; message: string }
  | { ok: false; reason: 'infra'; message: string };

export type FacilitatorSettleResult =
  | { ok: true; transaction: string; payer?: string }
  | { ok: false; reason: 'invalid'; message: string }
  | { ok: false; reason: 'infra'; message: string };

// The facilitator expects the FULL x402 payment envelope, not just the inner
// payload — reconstruct it exactly as a standard client would have sent it.
function envelope(network: string, payload: Eip3009Payload) {
  return { x402Version: 1, scheme: 'exact', network, payload };
}

async function post(path: string, body: unknown): Promise<{ status: number; json: any } | null> {
  try {
    const res = await fetch(`${facilitatorUrl}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    let json: any = null;
    try {
      json = await res.json();
    } catch {
      json = null;
    }
    return { status: res.status, json };
  } catch {
    return null; // network-level failure — caller treats as infra
  }
}

export async function facilitatorVerify(
  network: string,
  payload: Eip3009Payload,
  requirements: PaymentRequirements,
): Promise<FacilitatorVerifyResult> {
  const res = await post('/verify', {
    x402Version: 1,
    paymentPayload: envelope(network, payload),
    paymentRequirements: requirements,
  });
  if (!res) return { ok: false, reason: 'infra', message: 'Facilitator unreachable' };
  if (res.status >= 500) return { ok: false, reason: 'infra', message: `Facilitator error (HTTP ${res.status})` };
  if (res.json?.isValid === true) return { ok: true, payer: res.json.payer };
  return {
    ok: false,
    reason: 'invalid',
    message: String(res.json?.invalidReason || `Facilitator rejected the payment (HTTP ${res.status})`),
  };
}

export async function facilitatorSettle(
  network: string,
  payload: Eip3009Payload,
  requirements: PaymentRequirements,
): Promise<FacilitatorSettleResult> {
  const res = await post('/settle', {
    x402Version: 1,
    paymentPayload: envelope(network, payload),
    paymentRequirements: requirements,
  });
  if (!res) return { ok: false, reason: 'infra', message: 'Facilitator unreachable' };
  if (res.status >= 500) return { ok: false, reason: 'infra', message: `Facilitator error (HTTP ${res.status})` };
  const tx = res.json?.transaction;
  if (res.json?.success === true && typeof tx === 'string' && /^0x[0-9a-fA-F]{64}$/.test(tx)) {
    return { ok: true, transaction: tx, payer: res.json.payer };
  }
  return {
    ok: false,
    reason: 'invalid',
    message: String(res.json?.errorReason || `Facilitator settlement failed (HTTP ${res.status})`),
  };
}
