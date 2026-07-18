import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { dbAdmin } from '@/modules/core/db';
import { emit } from '@/modules/learning/events';
import { rateLimit, clientIp } from '@/modules/core/rate_limiter';
import { selectTier, listTiers } from '@/modules/commerce/pricing';
import {
  verifyPayment,
  PaymentError,
  httpStatusFor,
  evmPayoutAddress,
  solanaPayoutAddress,
  usdcContractAddress,
  usdcSolanaMint,
  bindingRequired,
  bindingChallengeTemplate,
} from '@/modules/commerce/payment-verify';

function safeBase64Decode(data: string): string {
  if (typeof globalThis !== 'undefined' && typeof globalThis.atob === 'function') {
    return globalThis.atob(data);
  }
  return Buffer.from(data, 'base64').toString('utf-8');
}

function microUsdc(amountUsdc: number): bigint {
  return BigInt(Math.round(amountUsdc * 1_000_000)); // USDC: 6 decimals
}

export async function proxy(request: NextRequest) {
  // Only paywall /api/v1/query/:path*
  if (request.nextUrl.pathname.startsWith('/api/v1/query/')) {
    const slug = request.nextUrl.pathname.replace('/api/v1/query/', '').split('/')[0];

    // Throttle BEFORE any catalog lookup or on-chain RPC. Verifying a payment
    // fires several Base/Solana RPC calls; without this an attacker could send a
    // flood of well-formed-but-bogus X-PAYMENT headers and amplify each cheap
    // request into expensive RPC work (cost / DoS). Keyed on the trusted client
    // IP, shared with the public read limiter.
    if (!(await rateLimit(clientIp(request)))) {
      return NextResponse.json(
        { error: { code: 'too_many_requests', message: 'Rate limit exceeded. Max 60 requests per minute.', details: {} } },
        { status: 429 },
      );
    }

    // Price (and existence) come from the product row.
    let product: any = null;
    try {
      const r = await dbAdmin
        .from('products')
        .select('slug, name, description, status, price_model')
        .eq('slug', slug)
        .maybeSingle();
      product = r.data;
    } catch {
      return NextResponse.json(
        { error: { code: 'infra', message: 'Catalog lookup failed', details: {} } },
        { status: 503 },
      );
    }

    if (!product || product.status !== 'live') {
      return NextResponse.json(
        { error: { code: 'not_found', message: 'Product not found or inactive', details: {} } },
        { status: 404 },
      );
    }

    // Which tier this request is buying (base per-query, or a bulk pack via
    // ?tier=<slug>). The query route resolves the same tier, so the amount we
    // quote and verify here matches the rows served there.
    const tier = selectTier(product.price_model, request.nextUrl.searchParams);
    const amountUsdc = tier.amountUsdc;
    const requiredUnits = microUsdc(amountUsdc);

    if (requiredUnits <= BigInt(0)) {
      // Never fall through to a $0 quote — that would serve data for free.
      return NextResponse.json(
        { error: { code: 'misconfig', message: 'Product price is not configured', details: {} } },
        { status: 500 },
      );
    }

    const quoteDescription = tier.slug === 'base'
      ? (product.description || `${product.name} - per query`)
      : `${product.name} — ${tier.label} (up to ${tier.maxRows} records in one call)`;

    const tiers = listTiers(product.price_model).map((t) => {
      const sep = request.url.includes('?') ? '&' : '?';
      return {
        tier: t.slug,
        price: `$${t.amountUsdc.toFixed(2)}`,
        maxAmountRequired: microUsdc(t.amountUsdc).toString(),
        rows: t.maxRows, // null for the base per-query tier
        resource: t.slug === 'base' ? request.url : `${request.url}${sep}tier=${t.slug}`,
      };
    });

    const xPayment = request.headers.get('X-PAYMENT');

    const paymentQuote = {
      x402Version: 1,
      accepts: [
        {
          scheme: 'exact',
          price: `$${amountUsdc.toFixed(2)}`,
          network: 'base',
          payTo: evmPayoutAddress,
          maxAmountRequired: requiredUnits.toString(),
          asset: usdcContractAddress,
          maxTimeoutSeconds: 86400,
          resource: request.url,
          description: quoteDescription,
          mimeType: 'application/json',
          // extra.name/version form the EIP-712 domain standard x402 clients
          // sign against; assetTransferMethod tells agents which signing
          // primitive this entry expects (Capacitr-style ecosystem hint).
          extra: { name: 'USD Coin', version: '2', assetTransferMethod: 'eip3009' },
        },
        ...(solanaPayoutAddress ? [{
          scheme: 'exact',
          price: `$${amountUsdc.toFixed(2)}`,
          network: 'solana',
          payTo: solanaPayoutAddress,
          maxAmountRequired: requiredUnits.toString(),
          asset: usdcSolanaMint,
          maxTimeoutSeconds: 86400,
          resource: request.url,
          description: quoteDescription,
          mimeType: 'application/json',
        }] : []),
      ],
      tiers,
      // Two settlement models are accepted on Base:
      //  1. STANDARD x402 (recommended; what Bankr agents and x402-fetch do):
      //     sign a gasless EIP-3009 TransferWithAuthorization and send
      //     { x402Version: 1, scheme: 'exact', network: 'base',
      //       payload: { signature, authorization } } — the server settles via
      //     facilitator. No binding signature is needed on this path.
      //  2. SELF-SETTLED: broadcast the USDC transfer yourself and submit
      //     { txHash } (plus the binding fields below when required).
      settlement: {
        methods: ['eip3009', 'txhash'],
        note: 'eip3009: sign TransferWithAuthorization per accepts[]; the server settles and pays gas. txhash: settle on-chain yourself, then submit { txHash, payer, signature } with the binding challenge below.',
      },
      binding: bindingRequired
        ? {
            required: true,
            appliesTo: 'txhash settlements only — eip3009 authorization payloads need no binding signature',
            algo: { base: 'eip191-personal-sign', solana: 'ed25519' },
            challenge: bindingChallengeTemplate,
            note: 'Sign the newline-separated challenge (values filled in) with the wallet that sent the payment, then include { payer, signature } next to txHash in the X-PAYMENT payload. payer must equal the paying wallet.',
          }
        : { required: false },
    };

    if (!xPayment) {
      return NextResponse.json(paymentQuote, {
        status: 402,
        headers: { 'x-402-payment-required': 'true' },
      });
    }

    try {
      let paymentPayload: any;
      try {
        paymentPayload = JSON.parse(safeBase64Decode(xPayment));
      } catch {
        throw new PaymentError('malformed', 'X-PAYMENT header is not valid base64 JSON');
      }

      const { scheme, network, payload } = paymentPayload || {};
      if (scheme !== 'exact') throw new PaymentError('unsupported', 'Unsupported payment scheme');
      if (network !== 'base' && network !== 'solana') throw new PaymentError('unsupported', 'Unsupported network');

      const resourcePath = request.nextUrl.pathname + request.nextUrl.search;
      const { buyerWallet, txHash } = await verifyPayment({
        network,
        payload,
        requiredUnits,
        resourcePath,
        resourceUrl: request.url,
      });

      // Atomic reservation + replay guard. The unique index on payment_sig
      // (migration 0005) makes this the authoritative single-use gate; the row
      // is committed BEFORE any data is served. rows_served stays NULL until the
      // query route claims it exactly once (see claimServe).
      let insertErr: any = null;
      try {
        const r = await dbAdmin.from('x402_payments').insert({
          product_slug: slug,
          buyer_wallet: buyerWallet || null,
          network,
          amount_usdc: amountUsdc,
          tx_ref: txHash,
          payment_sig: txHash,
          query_params: Object.fromEntries(request.nextUrl.searchParams.entries()),
          rows_served: null,
          status: 'settled',
        });
        insertErr = r.error;
      } catch (e) {
        insertErr = e;
      }

      if (insertErr) {
        if ((insertErr as any).code === '23505') {
          // A row for this txHash already exists. Distinguish a genuine replay
          // (already served) from a resumable payment (verified earlier but never
          // served — e.g. the query route hit a transient DB error and failed
          // closed). If rows_served is still NULL for this slug, let the request
          // through to claim it exactly once; the conditional UPDATE in
          // claimServe keeps serve-once semantics even under concurrency. Binding
          // (enforced in production) guarantees only the real payer reaches here,
          // so resuming cannot hand a paid row to an observer.
          let existing: any = null;
          try {
            const r = await dbAdmin
              .from('x402_payments')
              .select('rows_served, product_slug')
              .eq('payment_sig', txHash)
              .maybeSingle();
            existing = r.data;
          } catch {
            existing = null;
          }
          const resumable =
            existing && existing.product_slug === slug && existing.rows_served === null;
          if (!resumable) {
            throw new PaymentError('replay', 'This txHash has already been redeemed');
          }
          // fall through to serve (resume the unserved payment)
        } else {
          throw new PaymentError('infra', 'Failed to persist payment');
        }
      }

      emit({
        event_type: 'payment.settled',
        actor_type: 'agent',
        actor_id: buyerWallet,
        payload: { product_slug: slug, amount_usdc: amountUsdc, network },
      });

      const requestHeaders = new Headers(request.headers);
      requestHeaders.set('x-buyer-wallet', buyerWallet);
      requestHeaders.set('x-tx-ref', txHash);
      requestHeaders.set('x-payment-sig', txHash);
      requestHeaders.set('x-next-pathname', request.nextUrl.pathname);

      return NextResponse.next({ request: { headers: requestHeaders } });
    } catch (e: any) {
      if (e instanceof PaymentError) {
        return NextResponse.json(
          { error: 'Payment verification failed', kind: e.kind, message: e.message },
          { status: httpStatusFor(e.kind) },
        );
      }
      console.error('[payment-gate-error]', e);
      return NextResponse.json(
        { error: 'Payment verification failed', message: 'Internal error' },
        { status: 500 },
      );
    }
  }

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set('x-next-pathname', request.nextUrl.pathname);
  return NextResponse.next({ request: { headers: requestHeaders } });
}

export const config = {
  matcher: ['/api/v1/query/:path*', '/lab', '/lab/:path*'],
};
