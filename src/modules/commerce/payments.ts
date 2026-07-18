import { dbAdmin } from '@/modules/core/db';

export type ClaimResult = 'claimed' | 'already' | 'error';

// Atomically claim a verified-but-unserved payment for serving.
//
// The paywall middleware (src/proxy.ts) reserves the payment row — with
// rows_served = NULL — the moment payment is verified on-chain, BEFORE any data
// is served. This flips that row to the served count in a single conditional
// UPDATE, so a given payment can be served at most once, even under concurrent
// requests and even if a client replayed the payment headers directly against
// the route. `minAmountUsdc` blocks redeeming a cheap payment against a more
// expensive tier.
//
// Returns:
//   'claimed' — this call won the row; go ahead and serve.
//   'already' — already served, unknown, or underpaid for this tier; do NOT serve.
//   'error'   — a database/infra failure (not a payment problem). The caller
//               fails CLOSED (does not serve) and returns a 503; the row stays
//               reserved so the same payer can resume via the proxy on retry.
export async function claimServe(p: {
  paymentSig: string;
  rowsServed: number;
  minAmountUsdc: number;
}): Promise<ClaimResult> {
  try {
    const { data, error } = await dbAdmin
      .from('x402_payments')
      .update({ rows_served: p.rowsServed })
      .eq('payment_sig', p.paymentSig)
      .is('rows_served', null)
      .gte('amount_usdc', p.minAmountUsdc)
      .select('id');

    if (error) {
      console.error('[payments] claim failed:', error.message);
      return 'error';
    }
    return Array.isArray(data) && data.length > 0 ? 'claimed' : 'already';
  } catch (e: any) {
    console.error('[payments] claim threw:', e?.message || e);
    return 'error';
  }
}
