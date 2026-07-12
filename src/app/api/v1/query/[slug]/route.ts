import { NextResponse } from 'next/server';
import { dbAdmin } from '@/modules/core/db';
import { resolveQuery } from '@/modules/recipes/resolver';
import { recordPayment } from '@/modules/commerce/payments';
import { err, toResponse } from '@/modules/core/errors';
import { emit } from '@/modules/learning/events';

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
    const records = await resolveQuery(rules, queryParams);

    const priceUsdc = product.price_model.amount_usdc;

    // Record payment
    await recordPayment({
      productSlug: slug,
      buyerWallet,
      amountUsdc: priceUsdc,
      txRef,
      paymentSig,
      queryParams: Object.fromEntries(queryParams.entries()),
      rowsServed: records.length
    });

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

    return NextResponse.json({
      product: product.slug,
      product_version: 1,
      count: records.length,
      records,
      provenance: {
        methodology: `${protocol}://${host}/methodology/big-five-profile-gen`,
        synthetic: true
      },
      docs: `${protocol}://${host}/docs`
    });

  } catch (e) {
    return toResponse(e);
  }
}
