import { NextResponse } from 'next/server';
import { dbAdmin } from '@/modules/core/db';
import { resolveQuery } from '@/modules/recipes/resolver';
import { recordPayment } from '@/modules/commerce/payments';
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

    const rules = (product.recipes as any).query_rules;

    // Resolve the purchased tier (base per-query, or a bulk pack via ?tier=).
    // The proxy already quoted and settled this exact tier's amount. A pack
    // unlocks a larger single-call result, so raise the row cap (and default)
    // to the pack size for this request; the base tier is served unchanged.
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

    const priceUsdc = tier.amountUsdc;

    // Record payment (always record if payment was successfully processed on-chain)
    if (txRef && paymentSig) {
      try {
        await recordPayment({
          productSlug: slug,
          buyerWallet,
          amountUsdc: priceUsdc,
          txRef,
          paymentSig,
          queryParams: Object.fromEntries(queryParams.entries()),
          rowsServed: resolveError ? 0 : records.length
        });
      } catch (recordingErr) {
        console.error('Failed to record payment in DB after on-chain settlement:', recordingErr);
      }
    }

    // If query resolution threw an error, handle the failure gracefully by returning
    // the error details along with the transaction reference (so the buyer has proof of payment).
    if (resolveError) {
      const a = resolveError instanceof ApiError ? resolveError : err('internal', 500, resolveError.message || 'Internal query resolution error');
      const details = {
        ...(a.details as object || {}),
        tx_ref: txRef,
        payment_recorded: true
      };
      return NextResponse.json({
        error: {
          code: a.code,
          message: `Query failed after payment settled on-chain. Reference transaction: ${txRef}. ${a.message}`,
          details
        }
      }, { status: a.status });
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
          rows_found: records.length
        }
      });
    } else {
      emit({
        event_type: 'query.unserved',
        actor_type: 'agent',
        actor_id: buyerWallet,
        payload: {
          product_slug: slug,
          filters: Object.fromEntries(queryParams.entries()),
          rows_found: 0
        }
      });
    }

    const host = req.headers.get('host') || 'localhost:3000';
    const protocol = host.startsWith('localhost') ? 'http' : 'https';

    // Methodology link depends on what the recipe actually serves — this was
    // previously hardcoded to big-five-profile-gen for every product, which
    // was wrong (and misleading) for anything that isn't the profile library.
    // Each entity that is generator output points at its generator's live
    // methodology page. Biases are static literature-sourced reference rows,
    // not generator output, so there is no generator methodology page to point
    // to; each bias record already carries its own academic `source` citation.
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
        synthetic: true
      },
      docs: `${protocol}://${host}/docs`
    });

  } catch (e) {
    return toResponse(e);
  }
}
