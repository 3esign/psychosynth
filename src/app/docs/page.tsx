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
              <span className="text-emerald-400">GET /api/v1/eval/:slug</span>
              <p className="font-sans text-slate-400 mt-1">Free. Fetch behavioral eval battery scenarios, prompt descriptions, and scoring rubric (e.g. <code className="text-indigo-300">robinhood-stress-battery</code>, <code className="text-indigo-300">a2a-commerce-battery</code>).</p>
            </div>
            <div className="p-4 bg-slate-900 rounded-xl border border-slate-800">
              <span className="text-purple-400">POST /api/v1/eval/:slug</span>
              <p className="font-sans text-slate-400 mt-1">Paid via x402 ($2.00 USDC flat). Submit your agent's scenario responses to receive a signed behavioral certification report card with per-dimension susceptibility scores.</p>
            </div>
            <div className="p-4 bg-slate-900 rounded-xl border border-slate-800">
              <span className="text-indigo-400">GET /api/v1/query/:slug</span>
              <p className="font-sans text-slate-400 mt-1">Paid via x402. Full records with filter support. Add <code className="text-emerald-400">?tier=&lt;pack&gt;</code> to buy a bulk pack (many records in one paid call) where offered — the 402 quote lists available tiers.</p>
            </div>
          </div>
        </section>

        <section className="space-y-4">
          <h2 className="text-2xl font-semibold text-white border-b border-slate-800 pb-3">The 402 payment flow</h2>
          <ol className="list-decimal list-inside space-y-2 text-slate-300">
            <li>Request <code className="text-indigo-400">/api/v1/query/:slug</code> with no payment → HTTP 402 + a JSON quote (price, payTo address, USDC contract, network).</li>
            <li>Send the quoted USDC amount on-chain to the returned <code className="text-indigo-400">payTo</code> address — your wallet pays the network gas (agent-paid).</li>
            <li>Retry the request with your <code className="text-indigo-400">txHash</code> in the <code className="text-indigo-400">X-PAYMENT</code> header (base64 JSON).</li>
            <li>We verify the transfer on-chain (correct asset, recipient, and amount), record it once against replays, and serve your data.</li>
          </ol>
          <p className="text-slate-400">
            The whole handshake is plain HTTP plus one on-chain transfer:
          </p>
          <pre className="p-4 bg-slate-900 rounded-xl border border-slate-800 text-sm text-slate-300 overflow-x-auto">
{`import { erc20Abi } from 'viem';

// 1. Ask for the resource -> HTTP 402 + quote
const resource = 'https://<host>/api/v1/query/personality-profile-library?tags=trading&limit=20';
const { accepts } = await (await fetch(resource)).json();
const { payTo, maxAmountRequired, asset } = accepts.find(a => a.network === 'base');

// 2. Pay on-chain: transfer the USDC yourself (you pay gas)
const txHash = await walletClient.writeContract({
  address: asset, abi: erc20Abi, functionName: 'transfer',
  args: [payTo, BigInt(maxAmountRequired)],
});

// 3. Retry with the tx hash in X-PAYMENT (base64 JSON)
const xPayment = btoa(JSON.stringify({
  x402Version: 1, scheme: 'exact', network: 'base', payload: { txHash },
}));
const res = await fetch(resource, { headers: { 'X-PAYMENT': xPayment } });
const { records } = await res.json();`}
          </pre>
        </section>

        <section className="space-y-4">
          <h2 className="text-2xl font-semibold text-white border-b border-slate-800 pb-3">Virtuals Protocol &amp; G.A.M.E. SDK</h2>
          <p className="text-slate-400 leading-relaxed">
            Autonomous agents in the Virtuals Protocol ecosystem running the <strong>G.A.M.E. Framework</strong> can integrate Psychosynth natively as a custom action tool. This requires zero setup or agent registration on your end. The agent simply signs a gasless EIP-3009 transfer authorization payload and calls our API.
          </p>
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-white">1. G.A.M.E. Custom Action JSON Definition</h3>
            <pre className="p-4 bg-slate-900 rounded-xl border border-slate-800 text-sm text-slate-300 overflow-x-auto">
{`{
  "name": "query_psychosynth_data",
  "description": "Queries detailed synthetic psychometric profiles or behavioral responses. Settles dynamically in USDC on Base.",
  "parameters": {
    "type": "object",
    "properties": {
      "slug": {
        "type": "string",
        "description": "Product slug, e.g. 'personality-profile-library'"
      },
      "filters": {
        "type": "object",
        "description": "Optional filters, e.g. { \\"decision_style\\": \\"analytical\\" }"
      }
    },
    "required": ["slug"]
  }
}`}
            </pre>
            <h3 className="text-lg font-semibold text-white">2. G.A.M.E. Custom Tool Execution</h3>
            <p className="text-slate-400 leading-relaxed">
              When the agent triggers this action, it generates and signs an EVM <code className="text-indigo-400">TransferWithAuthorization</code> payload (EIP-3009) using its on-chain wallet. The agent then performs a POST/GET request to our endpoint:
            </p>
            <pre className="p-4 bg-slate-900 rounded-xl border border-slate-800 text-sm text-slate-300 overflow-x-auto">
{`// Example of the final HTTP call your Virtuals custom function makes:
const res = await fetch('https://psychosynth.vercel.app/api/v1/query/' + slug, {
  method: 'GET',
  headers: {
    'X-PAYMENT': btoa(JSON.stringify({
      x402Version: 1,
      scheme: 'exact',
      network: 'base',
      payload: {
        signature: eip3009Signature,
        authorization: {
          from: agentWalletAddress,
          to: payToAddress, // From 402 Quote
          value: amountBaseUnits, // From 402 Quote
          validAfter: 0,
          validBefore: expiryTimestamp,
          nonce: random32BytesHex
        }
      }
    }))
  }
});
const { records } = await res.json();`}
            </pre>
          </div>
        </section>

        <section className="space-y-4">
          <h2 className="text-2xl font-semibold text-white border-b border-slate-800 pb-3">Smart Contract Guardian Infrastructure</h2>
          <p className="text-slate-400 leading-relaxed">
            Psychosynth integrates deeply with on-chain execution environments to enforce <strong>Behavioral Safety Rails</strong> for autonomous agents.
            These on-chain modules consume cryptographic receipts from the <code className="text-indigo-400">/api/v1/eval/:slug</code> endpoint to verify an agent's behavioral stability before allowing high-risk trades.
          </p>
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-white">1. ERC-7579 Behavioral Guard Module</h3>
            <p className="text-slate-400 leading-relaxed">
              A Smart Account execution guard that blocks transactions if an agent's panic or loss-aversion index exceeds safe parameters under current market volatility.
            </p>
            <pre className="p-4 bg-slate-900 rounded-xl border border-slate-800 text-sm text-slate-300 overflow-x-auto">
{`// Example usage of BehavioralGuardModule
const tx = await smartAccount.execute({
  to: targetDEX,
  value: 0,
  data: swapData,
  // Agent includes the Psychosynth panic_index and signature
  extraData: abi.encode(panicIndex, psychosynthSignature)
});`}
            </pre>
            <h3 className="text-lg font-semibold text-white">2. Uniswap v4 Behavior-Aware Hook</h3>
            <p className="text-slate-400 leading-relaxed">
              A custom liquidity pool hook that dynamically adjusts swap fee spreads based on the swapper's certified panic index, protecting LPs during systemic market stress.
            </p>
            <pre className="p-4 bg-slate-900 rounded-xl border border-slate-800 text-sm text-slate-300 overflow-x-auto">
{`// Agent passes Psychosynth certification in hookData during swap
const hookData = abi.encode(panicIndex, psychosynthSignature);
await poolManager.swap(poolKey, params, hookData);`}
            </pre>
          </div>
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
                {Array.isArray(p.price_model?.packs) && p.price_model.packs.length > 0 && (
                  <div className="space-y-2">
                    <span className="text-sm text-slate-500">Bulk packs (one paid call, many rows):</span>
                    <div className="flex flex-wrap gap-2">
                      {p.price_model.packs.map((pk: any) => (
                        <code key={pk.slug} className="px-2 py-1 bg-slate-950 rounded border border-slate-800 text-xs text-emerald-400">
                          ?tier={pk.slug} → ${Number(pk.amount_usdc).toFixed(2)} USDC / up to {pk.max_rows} records
                        </code>
                      ))}
                    </div>
                  </div>
                )}
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
