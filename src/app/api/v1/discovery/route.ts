import { NextResponse } from 'next/server';
import { dbAdmin } from '@/modules/core/db';
import { err, toResponse } from '@/modules/core/errors';
import { rateLimit, clientIp } from '@/modules/core/rate_limiter';
import { listTiers } from '@/modules/commerce/pricing';

// Free, unauthenticated preflight for autonomous agents (Bankr, x402-fetch,
// MCP clients, registry crawlers). One GET returns everything an agent needs
// to decide whether — and how — to pay: the product catalog with live prices,
// the endpoint map, and the exact payment surface (networks, asset, payTo,
// accepted settlement methods). Ecosystem convention (cf. Capacitr's
// /api/skill/discovery): agents browse before they buy; never make them burn a
// paid call to learn the schema.
//
// Deliberately does NOT import payment-verify.ts: that module fail-fast
// throws at import time when payment env is missing, and a discovery endpoint
// should degrade gracefully (payTo: null) rather than 500.

const USDC_BASE = '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913';
const USDC_SOLANA = 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v';

export async function GET(req: Request) {
  try {
    if (!(await rateLimit(clientIp(req)))) {
      throw err('too_many_requests', 429, 'Rate limit exceeded. Max 60 requests per minute.');
    }

    const host = req.headers.get('host') || 'localhost:3000';
    const protocol = host.startsWith('localhost') ? 'http' : 'https';
    const origin = `${protocol}://${host}`;

    const { data } = await dbAdmin
      .from('products')
      .select('slug, name, description, status, price_model')
      .eq('status', 'live')
      .order('slug');

    const products = (data ?? []).map((p) => ({
      slug: p.slug,
      name: p.name,
      description: p.description,
      tiers: listTiers(p.price_model).map((t) => ({
        tier: t.slug,
        price_usdc: t.amountUsdc,
        max_rows: t.maxRows, // null = recipe default row cap
        label: t.label,
      })),
      preview: `${origin}/api/v1/preview/${p.slug}`,
      query: `${origin}/api/v1/query/${p.slug}`,
    }));

    const evmPayTo = process.env.X402_PAYOUT_ADDRESS || null;
    const solanaPayTo = process.env.SOLANA_PAYOUT_ADDRESS || null;

    return NextResponse.json({
      service: 'psychosynth',
      description:
        'Agent-native synthetic psychometric data: Big Five / Dark Triad / prospect-theory personality profiles, profile-conditioned behavioral scenario responses, and a cognitive-bias reference taxonomy. Free deterministic previews; paid queries settle per-call in USDC over x402.',
      docs: `${origin}/docs`,
      endpoints: {
        discovery: `${origin}/api/v1/discovery`,
        catalog: `${origin}/api/v1/products`,
        preview: `${origin}/api/v1/preview/{slug}`,
        query: `${origin}/api/v1/query/{slug}`,
      },
      payment: {
        protocol: 'x402',
        x402Version: 1,
        scheme: 'exact',
        networks: [
          {
            network: 'base',
            asset: USDC_BASE,
            payTo: evmPayTo,
            settlement: ['eip3009', 'txhash'],
            note: 'Standard x402: sign a gasless EIP-3009 TransferWithAuthorization (domain: USD Coin v2, chainId 8453); the server settles via facilitator and pays gas. Bankr agents and x402-fetch do this automatically.',
          },
          ...(solanaPayTo
            ? [{
                network: 'solana',
                asset: USDC_SOLANA,
                payTo: solanaPayTo,
                settlement: ['txhash'],
                note: 'Self-settled: transfer USDC on Solana, then submit the finalized signature as txHash (plus binding when the 402 quote requires it).',
              }]
            : []),
        ],
        flow: 'GET the query endpoint without X-PAYMENT to receive a 402 quote with accepts[] and tiers; sign per accepts[]; retry with X-PAYMENT: base64(JSON envelope).',
      },
      products,
    });
  } catch (e) {
    return toResponse(e);
  }
}
