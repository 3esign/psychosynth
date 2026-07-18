// Pricing tiers.
//
// Every product has a flat per-query "base" tier (price_model.amount_usdc).
// A product MAY also define "packs": bulk tiers where a single paid call
// returns up to `max_rows` records in one response (see the row-limit override
// in the query route). This is the "bulk rows in one call" model — no credit
// tracking, no new tables; the buyer just pays a larger amount once and gets a
// larger single result.
//
// The payment proxy and the query route MUST resolve the SAME tier for a given
// request, or the quoted/verified price won't match what gets served. That is
// the whole reason this lives in one shared helper, keyed off the `?tier=`
// query param that both sides can see.
//
// Shape of a product with packs:
//   {
//     "type": "flat",
//     "amount_usdc": 0.03,
//     "packs": [
//       { "slug": "pack-5k", "amount_usdc": 49, "max_rows": 5000, "label": "5,000-record bulk" }
//     ]
//   }

export interface PriceTier {
  slug: string;            // 'base' or a pack slug
  amountUsdc: number;      // amount charged for this tier
  maxRows: number | null;  // row cap this tier unlocks; null = use recipe default
  label: string;
}

function baseTier(priceModel: any): PriceTier {
  return {
    slug: 'base',
    amountUsdc: Number(priceModel?.amount_usdc ?? 0.01),
    maxRows: null,
    label: 'per query',
  };
}

function packTiers(priceModel: any): PriceTier[] {
  const packs = Array.isArray(priceModel?.packs) ? priceModel.packs : [];
  return packs
    .filter((p: any) => p && p.slug && p.amount_usdc != null && p.max_rows != null)
    .map((p: any) => ({
      slug: String(p.slug),
      amountUsdc: Number(p.amount_usdc),
      maxRows: Number(p.max_rows),
      label: p.label ? String(p.label) : `${Number(p.max_rows)} records`,
    }));
}

// All purchasable tiers, base first. Used to advertise packs in the catalog
// and the 402 quote so agents can discover them.
export function listTiers(priceModel: any): PriceTier[] {
  return [baseTier(priceModel), ...packTiers(priceModel)];
}

// The tier a given request is buying, selected via `?tier=<slug>`. A missing
// or unrecognized tier falls back to base — never to a price cheaper than the
// buyer asked for — so an agent can't underpay for a pack by guessing a slug.
export function selectTier(priceModel: any, req: URLSearchParams): PriceTier {
  const requested = req.get('tier');
  if (!requested || requested === 'base') return baseTier(priceModel);
  const match = packTiers(priceModel).find(t => t.slug === requested);
  return match ?? baseTier(priceModel);
}
