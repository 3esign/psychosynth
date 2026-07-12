import { dbAdmin } from '@/modules/core/db';
import { emit } from '@/modules/learning/events';

export async function recordPayment(p: {
  productSlug: string;
  buyerWallet?: string;
  amountUsdc: number;
  txRef?: string;
  paymentSig?: string;
  queryParams: Record<string, string>;
  rowsServed: number;
}) {
  // Default network matches the proxy, which settles on Base mainnet.
  const { error } = await dbAdmin.from('x402_payments').insert({
    product_slug: p.productSlug,
    buyer_wallet: p.buyerWallet ?? null,
    network: process.env.X402_NETWORK || 'base',
    amount_usdc: p.amountUsdc,
    tx_ref: p.txRef ?? null,
    payment_sig: p.paymentSig ?? null,
    query_params: p.queryParams,
    rows_served: p.rowsServed,
  });
  if (error) console.error('[payments] failed to record payment:', error.message);
  
  emit({
    event_type: 'payment.settled',
    actor_type: 'agent',
    actor_id: p.buyerWallet,
    payload: { product_slug: p.productSlug, amount_usdc: p.amountUsdc }
  });
}
