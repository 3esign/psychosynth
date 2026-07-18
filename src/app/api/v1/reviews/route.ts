import { NextResponse } from 'next/server';
import { verifyMessage, getAddress } from 'viem';
import { dbAdmin } from '@/modules/core/db';
import { err, toResponse } from '@/modules/core/errors';

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const productSlug = searchParams.get('product_slug');

    if (!productSlug) {
      throw err('invalid_params', 400, 'product_slug is required');
    }

    const { data: reviews, error } = await dbAdmin
      .from('reviews')
      .select('id, product_slug, buyer_wallet, rating, comment, created_at')
      .eq('product_slug', productSlug)
      .order('created_at', { ascending: false });

    if (error) {
      throw err('internal', 500, error.message);
    }

    return NextResponse.json({ reviews });
  } catch (e) {
    return toResponse(e);
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { product_slug, buyer_wallet, rating, comment, signature } = body;

    if (!product_slug || !buyer_wallet || !rating || !signature) {
      throw err('invalid_params', 400, 'Missing required fields: product_slug, buyer_wallet, rating, signature');
    }

    const ratingNum = Number(rating);
    if (Number.isNaN(ratingNum) || ratingNum < 1 || ratingNum > 5) {
      throw err('invalid_params', 400, 'Rating must be an integer between 1 and 5');
    }

    let checksumWallet: string;
    try {
      checksumWallet = getAddress(buyer_wallet);
    } catch {
      throw err('invalid_params', 400, 'Invalid wallet address');
    }

    // 1. Verify EIP-191 personal signature off-chain
    const message = `Rate product "${product_slug}" with rating ${ratingNum} and comment "${comment || ''}"`;
    let isSigValid = false;
    try {
      isSigValid = await verifyMessage({
        address: checksumWallet as `0x${string}`,
        message,
        signature: signature as `0x${string}`,
      });
    } catch (sigErr: any) {
      console.error('[reviews-signature-check-failed]', sigErr);
    }

    if (!isSigValid) {
      throw err('unauthorized', 401, 'Invalid signature: does not match wallet and message payload');
    }

    // 2. Verify payment history: must have a settled x402 payment row for this product
    const { data: payment } = await dbAdmin
      .from('x402_payments')
      .select('id')
      .eq('product_slug', product_slug)
      .ilike('buyer_wallet', checksumWallet)
      .eq('status', 'settled')
      .limit(1)
      .maybeSingle();

    if (!payment) {
      throw err('forbidden', 403, 'Only verified buyers who settled a paid query for this product can submit a review.');
    }

    // 3. Upsert or Insert review (since unique constraint exists, it updates or fails gracefully)
    // To handle upsert in Supabase:
    const { data: inserted, error: insertError } = await dbAdmin
      .from('reviews')
      .upsert({
        product_slug,
        buyer_wallet: checksumWallet,
        rating: ratingNum,
        comment,
        signature,
      }, { onConflict: 'product_slug, buyer_wallet' })
      .select()
      .single();

    if (insertError) {
      throw err('internal', 500, insertError.message);
    }

    return NextResponse.json({
      success: true,
      review: inserted,
    });

  } catch (e) {
    return toResponse(e);
  }
}
