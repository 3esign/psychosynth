import { dbAdmin } from '@/modules/core/db';

// Always render fresh — product catalog and prices live in the database.
export const dynamic = 'force-dynamic';

export default async function DocsPage() {
  const { data: products } = await dbAdmin
    .from('products')
    .select('slug, name, description, price_model, recipes(query_rules)')
    .eq('status', 'live');

  return (
    <main className="min-h-screen bg-slate-950 text-slate-200">
      <div className="max-w-4xl mx-auto px-6 py-16 space-y-12">
        <header>
          <h1 className="text-4xl font-bold tracking-tight text-white mb-4">API Documentation</h1>
          <p className="text-slate-400 text-lg leading-relaxed">
            Psychosynth sells synthetic psychometric data to autonomous agents over HTTP.
            Catalog and previews are free; queries are paid per request via the x402
            protocol (USDC on Base). Every payload is marked <code className="text-indigo-400">synthetic: true</code>.
          </p>
        </header>

        <section className="space-y-4">
          <h2 className="text-2xl font-semibold text-white border-b border-slate-800 pb-3">Endpoints</h2>
          <div className="space-y-3 font-mono text-sm">
            <div className="p-4 bg-slate-900 rounded-xl border border-slate-800">
              <span className="text-green-400">GET /api/v1/products</span>
              <p className="font-sans text-slate-400 mt-1">Free. Machine-readable catalog: slug, description, price model.</p>
            </div>
            <div className="p-4 bg-slate-900 rounded-xl border border-slate-800">
              <span className="text-green-400">GET /api/v1/preview/:slug</span>
              <p className="font-sans text-slate-400 mt-1">Free. Deterministic sample (lowest content hashes — stable across calls, so you can verify we are not cherry-picking). Rate limited to 60 req/min per IP.</p>
            </div>
            <div className="p-4 bg-slate-900 rounded-xl border border-slate-800">
              <span className="text-indigo-400">GET /api/v1/query/:slug</span>
              <p className="font-sans text-slate-400 mt-1">Paid via x402. Full records with filter support.</p>
            </div>
          </div>
        </section>

        <section className="space-y-4">
          <h2 className="text-2xl font-semibold text-white border-b border-slate-800 pb-3">The 402 payment flow</h2>
          <ol className="list-decimal list-inside space-y-2 text-slate-300">
            <li>Request <code className="text-indigo-400">/api/v1/query/:slug</code> with no payment → HTTP 402 + a JSON quote (price, payTo address, USDC contract, network).</li>
            <li>Sign an EIP-3009 <code className="text-indigo-400">TransferWithAuthorization</code> for the quoted amount with your wallet — no gas needed on your side.</li>
            <li>Retry the request with the signed authorization in the <code className="text-indigo-400">X-PAYMENT</code> header (base64 JSON).</li>
            <li>We verify the signature, settle it on-chain (we pay the gas), and serve your data in the same request.</li>
          </ol>
          <p className="text-slate-400">
            Clients like <code className="text-indigo-400">x402-fetch</code> automate the whole handshake:
          </p>
          <pre className="p-4 bg-slate-900 rounded-xl border border-slate-800 text-sm text-slate-300 overflow-x-auto">
{`import { wrapFetchWithPayment } from 'x402-fetch';

const payingFetch = wrapFetchWithPayment(fetch, walletClient);
const res = await payingFetch(
  'https://<host>/api/v1/query/personality-profile-library?tags=trading&limit=20'
);
const { records } = await res.json();`}
          </pre>
        </section>

        <section className="space-y-4">
          <h2 className="text-2xl font-semibold text-white border-b border-slate-800 pb-3">Products &amp; filters</h2>
          {(products ?? []).map((p: any) => {
            const rules = Array.isArray(p.recipes) ? p.recipes[0]?.query_rules : p.recipes?.query_rules;
            return (
              <div key={p.slug} className="p-6 bg-slate-900 rounded-xl border border-slate-800 space-y-3">
                <div className="flex items-baseline justify-between flex-wrap gap-2">
                  <h3 className="text-lg font-semibold text-white">{p.name}</h3>
                  <span className="text-indigo-400 font-mono text-sm">${Number(p.price_model?.amount_usdc ?? 0).toFixed(2)} USDC / query</span>
                </div>
                <p className="text-slate-400">{p.description}</p>
                <div className="font-mono text-xs text-slate-400">
                  <span className="text-slate-500">slug:</span> {p.slug}
                </div>
                {rules?.allow_request_filters && (
                  <div className="space-y-2">
                    <span className="text-sm text-slate-500">Allowed query parameters:</span>
                    <div className="flex flex-wrap gap-2">
                      {rules.allow_request_filters.map((f: string) => (
                        <code key={f} className="px-2 py-1 bg-slate-950 rounded border border-slate-800 text-xs text-indigo-400">{f}</code>
                      ))}
                      <code className="px-2 py-1 bg-slate-950 rounded border border-slate-800 text-xs text-indigo-400">limit (max {rules.max_limit})</code>
                    </div>
                    <p className="text-xs text-slate-500">
                      Trait ranges use <code>big_five_min</code>/<code>big_five_max</code> as comma-separated <code>trait:value</code> pairs,
                      e.g. <code className="text-indigo-400">big_five_min=openness:0.7,neuroticism:0.4</code>.
                    </p>
                  </div>
                )}
              </div>
            );
          })}
        </section>

        <section className="space-y-3">
          <h2 className="text-2xl font-semibold text-white border-b border-slate-800 pb-3">Zero-result policy</h2>
          <p className="text-slate-400 leading-relaxed">
            You pay for the query, not the rows. A paid query whose filters match nothing returns
            HTTP 200 with <code className="text-indigo-400">count: 0</code> — and logs your filter combination as unmet demand,
            which directly feeds our generation backlog. Check the free preview first if you want certainty before paying.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-2xl font-semibold text-white border-b border-slate-800 pb-3">Data honesty &amp; terms</h2>
          <p className="text-slate-400 leading-relaxed">
            All records are synthetic, generated by LLMs and human-curated. They describe no real person and contain no PII by
            construction. Every paid response includes a <code className="text-indigo-400">provenance</code> block linking to the
            generating methodology. Prohibited uses: representing this data as real human subjects, deception of end users,
            or any application targeting real individuals.
          </p>
        </section>
      </div>
    </main>
  );
}
