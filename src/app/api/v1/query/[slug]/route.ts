import { NextResponse } from 'next/server';
import { dbAdmin } from '@/modules/core/db';
import { resolveQuery } from '@/modules/recipes/resolver';
import { claimServe } from '@/modules/commerce/payments';
import { err, toResponse, ApiError } from '@/modules/core/errors';
import { emit } from '@/modules/learning/events';
import { selectTier } from '@/modules/commerce/pricing';

export async function GET(req: Request, { params }: { params: Promise<{ slug: string }> }) {
  try {
    const { slug } = await params;
    const url = new URL(req.url);
    const queryParams = url.searchParams;

    const buyerWallet = req.headers.get('x-buyer-wallet') || undefined;
    const txRef = req.headers.get('x-tx-ref') || undefined;
    const paymentSig = req.headers.get('x-payment-sig') || undefined;

    // Fetch product and its query rules
    const { data: product } = await dbAdmin.from('products')
      .select('id, slug, status, price_model, recipes(query_rules)')
      .eq('slug', slug)
      .single();

    if (!product || product.status !== 'live') {
      throw err('not_found', 404, 'Product not found or inactive');
    }

    // Payment is enforced by the paywall middleware (src/proxy.ts), which sets
    // these headers only after verifying settlement on-chain. Requiring them
    // here too means the route refuses to serve even if it were ever reached
    // without passing through the gate.
    if (!paymentSig || !txRef) {
      throw err('payment_required', 402, 'Payment required');
    }

    const rules = (product.recipes as any).query_rules;

    // Resolve the purchased tier (base per-query, or a bulk pack via ?tier=).
    // A pack unlocks a larger single-call result, so raise the row cap for this
    // request; the base tier is served unchanged.
    const tier = selectTier(product.price_model, queryParams);
    const effectiveRules = tier.maxRows != null
      ? { ...rules, default_limit: tier.maxRows, max_limit: tier.maxRows }
      : rules;

    let records: any[] = [];
    let resolveError: any = null;
    try {
      records = await resolveQuery(effectiveRules, queryParams);
    } catch (e) {
      resolveError = e;
    }

    // Point of no return: atomically claim the payment for serving. This is
    // single-use and tier-bound — a replayed, forged, or underpaid payment is
    // rejected here and no data is returned.
    const claim = await claimServe({
      paymentSig,
      rowsServed: resolveError ? 0 : records.length,
      minAmountUsdc: tier.amountUsdc,
    });
    if (claim === 'already') {
      throw err('payment_invalid', 402, 'Payment not found, already used, or insufficient for this tier');
    }
    // Fail CLOSED on a transient DB/infra failure: we cannot confirm the payment
    // was claimed, so we do not serve. The payment row stays reserved
    // (rows_served = NULL), and the proxy's resumable-replay path lets the same
    // payer retry this exact payment without being locked out as a replay.
    if (claim === 'error') {
      throw err('claim_unconfirmed', 503, 'Could not confirm payment claim; please retry with the same payment.');
    }
    const paymentRecorded = claim === 'claimed';

    // If query resolution threw, surface the failure but still cite the tx as
    // proof of payment (the payment has now been consumed).
    if (resolveError) {
      const a = resolveError instanceof ApiError ? resolveError : err('internal', 500, resolveError.message || 'Internal query resolution error');
      const message = `Query failed after payment settled on-chain. Reference transaction: ${txRef}. ${a.message}`;
      const details = {
        ...(a.details as object || {}),
        tx_ref: txRef,
        payment_recorded: paymentRecorded,
      };
      return NextResponse.json({ error: { code: a.code, message, details } }, { status: a.status });
    }

    // Emit served/unserved events for Learning Loop demand telemetry
    if (records.length > 0) {
      emit({
        event_type: 'query.served',
        actor_type: 'agent',
        actor_id: buyerWallet,
        payload: {
          product_slug: slug,
          filters: Object.fromEntries(queryParams.entries()),
          rows_found: records.length,
        },
      });
    } else {
      emit({
        event_type: 'query.unserved',
        actor_type: 'agent',
        actor_id: buyerWallet,
        payload: {
          product_slug: slug,
          filters: Object.fromEntries(queryParams.entries()),
          rows_found: 0,
        },
      });
    }

    const host = req.headers.get('host') || 'localhost:3000';
    const protocol = host.startsWith('localhost') ? 'http' : 'https';

    // Methodology link depends on what the recipe actually serves. Generator
    // output points at its generator's live methodology page; static
    // literature-sourced reference rows (e.g. biases) cite their own academic
    // source per record, so there is no generator methodology page.
    const methodologyGeneratorSlug: Record<string, string> = {
      profile: 'big-five-profile-gen',
      scenario_response: 'response-gen',
    };
    const generatorSlug = methodologyGeneratorSlug[rules.entity];

    return NextResponse.json({
      product: product.slug,
      product_version: 1,
      tier: tier.slug,
      count: records.length,
      records,
      provenance: {
        methodology: generatorSlug
          ? `${protocol}://${host}/methodology/${generatorSlug}`
          : `${protocol}://${host}/docs`,
        ...(generatorSlug ? {} : {
          note: 'Reference taxonomy, not generator output — each record cites its own academic source directly.',
        }),
        synthetic: true,
      },
      docs: `${protocol}://${host}/docs`,
    });

  } catch (e) {
    return toResponse(e);
  }
}
