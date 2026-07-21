import Link from 'next/link';
import { dbAdmin } from '@/modules/core/db';

export const dynamic = 'force-dynamic';

export default async function LandingPage() {
  const { data: products } = await dbAdmin
    .from('products')
    .select('slug, name, description, price_model, recipes(query_rules)')
    .eq('status', 'live');

  // Agent runtimes & payment rails Psychosynth connects to. Badges are honest:
  // "Live" = verified working today, "Available" = plugin/config shipped in-repo,
  // "Planned" = on the roadmap (see docs/VIRTUALS_ACP.md).
  const connections = [
    { name: 'Bankr', tag: 'Live', badge: 'bg-amber-500/10 border-amber-500/20 text-amber-300', blurb: 'Bankr agents discover the catalog and pay per query in gasless USDC via the Psychosynth skill.', href: 'https://skills.bankr.bot', external: true, cta: 'View on Bankr' },
    { name: 'x402-fetch', tag: 'Live', badge: 'bg-amber-500/10 border-amber-500/20 text-amber-300', blurb: 'Any agent using x402-fetch settles out of the box — no API keys, no signup.', href: '/api/v1/discovery', external: false, cta: 'Discovery' },
    { name: 'MCP', tag: 'Native', badge: 'bg-indigo-500/10 border-indigo-500/20 text-indigo-300', blurb: 'A standard MCP server exposes list, preview, quote and query as agent tools.', href: 'https://modelcontextprotocol.io', external: true, cta: 'Learn more' },
    { name: 'ElizaOS', tag: 'Available', badge: 'bg-indigo-500/10 border-indigo-500/20 text-indigo-300', blurb: 'Connect through @elizaos/plugin-mcp in your agent character config.', href: '/docs', external: false, cta: 'Setup' },
    { name: 'OpenClaw', tag: 'Available', badge: 'bg-indigo-500/10 border-indigo-500/20 text-indigo-300', blurb: 'Add via MCPorter: openclaw mcp add psychosynth.', href: '/docs', external: false, cta: 'Setup' },
    { name: 'Hermes', tag: 'Available', badge: 'bg-indigo-500/10 border-indigo-500/20 text-indigo-300', blurb: 'Nous Research agents register the server over stdio in their config.', href: '/docs', external: false, cta: 'Setup' },
    { name: 'Solana Agent Kit', tag: 'Available', badge: 'bg-emerald-500/10 border-emerald-500/20 text-emerald-300', blurb: 'Solana-native agents settle payments in USDC-SPL on Solana.', href: '/docs', external: false, cta: 'Setup' },
    { name: 'Virtuals · ACP', tag: 'Planned', badge: 'bg-slate-600/20 border-slate-600/30 text-slate-400', blurb: 'Provider integration for the Virtuals agent economy (escrowed USDC on Base).', href: '/docs', external: false, cta: 'Roadmap' },
  ];

  return (
    <main className="min-h-screen bg-slate-950 text-slate-200 selection:bg-indigo-500/30 font-sans">
      {/* Background gradients */}
      <div className="absolute top-0 left-0 w-full h-[600px] bg-gradient-to-b from-indigo-900/10 via-purple-900/5 to-transparent pointer-events-none" />

      <div className="max-w-5xl mx-auto px-6 py-20 relative z-10 space-y-16">
        {/* Hero Section */}
        <header className="space-y-4 max-w-3xl">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-xs font-semibold text-indigo-400 font-mono">
            <span className="h-1.5 w-1.5 rounded-full bg-indigo-400 animate-pulse" />
            Milestone 1 Live
          </div>
          <h1 className="text-5xl font-extrabold tracking-tight text-white mb-2 bg-gradient-to-r from-white via-slate-100 to-indigo-400 bg-clip-text text-transparent">
            Psychosynth API
          </h1>
          <p className="text-lg text-slate-400 leading-relaxed font-sans">
            Synthetic psychometric data built on the Five-Factor Model (OCEAN). Grounded, curated, and cryptographic behavioral datasets sold directly to autonomous agents over the x402 protocol on Base mainnet.
          </p>
          <div className="flex flex-wrap gap-4 pt-2">
            <Link
              href="/agent"
              className="inline-flex items-center justify-center px-5 py-2.5 bg-gradient-to-tr from-indigo-600 to-purple-650 hover:brightness-110 text-white rounded-xl font-semibold transition-all shadow-lg shadow-indigo-500/10"
            >
              &#9654; Live Agent Demo
            </Link>
            <Link
              href="/explore"
              className="inline-flex items-center justify-center px-5 py-2.5 bg-slate-900 hover:bg-slate-850 text-white rounded-xl border border-slate-800 font-semibold transition-all hover:border-slate-700 shadow-md"
            >
              Explore Data &rarr;
            </Link>
            <a
              href="/docs"
              className="inline-flex items-center justify-center px-5 py-2.5 bg-slate-900 hover:bg-slate-850 text-white rounded-xl border border-slate-800 font-semibold transition-all hover:border-slate-700 shadow-md"
            >
              API Reference &rarr;
            </a>
            <Link
              href="/lab"
              className="inline-flex items-center justify-center px-5 py-2.5 bg-slate-900 hover:bg-slate-850 text-white rounded-xl border border-slate-800 font-semibold transition-all hover:border-slate-700 shadow-md"
            >
              Curation Cockpit &rarr;
            </Link>
          </div>
        </header>

        {/* Agent Quickstart — standard x402 + Bankr ecosystem */}
        <section className="rounded-2xl border border-indigo-500/20 bg-gradient-to-br from-indigo-500/5 via-slate-900/40 to-purple-500/5 p-8 space-y-6 shadow-2xl">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="space-y-1 max-w-xl">
              <h2 className="text-2xl font-bold tracking-tight text-white">Built for autonomous agents</h2>
              <p className="text-sm text-slate-400 font-sans leading-relaxed">
                Standard x402: your agent signs a gasless USDC authorization (EIP-3009) and the server settles on-chain — no API keys, no signup, no gas. Works out of the box with Bankr agents, x402-fetch, and MCP runtimes.
              </p>
            </div>
            <div className="flex flex-wrap gap-2 text-[10px] font-mono font-bold">
              <span className="px-2.5 py-1 rounded-lg bg-blue-500/10 border border-blue-500/20 text-blue-300">USDC · Base mainnet</span>
              <span className="px-2.5 py-1 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-300">EIP-3009 · gasless</span>
              <span className="px-2.5 py-1 rounded-lg bg-purple-500/10 border border-purple-500/20 text-purple-300">Free previews</span>
              <span className="px-2.5 py-1 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-300">No API keys</span>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 font-mono text-[11px]">
            <div className="p-4 rounded-xl bg-slate-950/70 border border-slate-800/60 space-y-2">
              <span className="text-indigo-400 font-bold block">1 · Discover — free</span>
              <code className="block text-slate-300 leading-relaxed break-all">GET /api/v1/discovery</code>
              <p className="text-slate-500 font-sans text-xs leading-relaxed">Products, live prices, tiers, and the full payment surface in one call.</p>
            </div>
            <div className="p-4 rounded-xl bg-slate-950/70 border border-slate-800/60 space-y-2">
              <span className="text-indigo-400 font-bold block">2 · Preview — free</span>
              <code className="block text-slate-300 leading-relaxed break-all">{'GET /api/v1/preview/{slug}'}</code>
              <p className="text-slate-500 font-sans text-xs leading-relaxed">Deterministic sample rows — verify the exact record shape before paying.</p>
            </div>
            <div className="p-4 rounded-xl bg-slate-950/70 border border-slate-800/60 space-y-2">
              <span className="text-indigo-400 font-bold block">3 · Query — from $0.01</span>
              <code className="block text-slate-300 leading-relaxed break-all">{'GET /api/v1/query/{slug}'} &rarr; 402 &rarr; sign &rarr; 200</code>
              <p className="text-slate-500 font-sans text-xs leading-relaxed">One HTTP loop: quote, sign, settle, records. The server pays the gas.</p>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 pt-1 border-t border-slate-800/40 text-xs">
            <p className="text-slate-500 font-sans pt-3">
              Running a Bankr agent? Install the skill:{' '}
              <code className="text-indigo-300 font-mono">install the psychosynth skill</code>
            </p>
            <a href="/api/v1/discovery" className="pt-3 text-indigo-400 hover:text-indigo-300 font-bold font-mono">
              Try discovery live &rarr;
            </a>
          </div>
        </section>

        {/* Live Products Grid */}
        <section className="space-y-6">
          <div className="space-y-1">
            <h2 className="text-2xl font-bold tracking-tight text-white">Active Product Catalog</h2>
            <p className="text-sm text-slate-500">Live, validated psychometric profiles and response packages, purchasable per query via on-chain USDC payments (x402) on Base or Solana.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {(products || []).map((p: any) => {
              const rules = Array.isArray(p.recipes) ? p.recipes[0]?.query_rules : p.recipes?.query_rules;
              const hasPacks = Array.isArray(p.price_model?.packs) && p.price_model.packs.length > 0;

              return (
                <div 
                  key={p.slug} 
                  className="p-8 rounded-2xl bg-slate-900/50 border border-slate-800/80 shadow-2xl backdrop-blur-md flex flex-col justify-between transition-all duration-300 hover:border-indigo-500/20 hover:bg-slate-900/80"
                >
                  <div className="space-y-4">
                    <div className="flex items-start justify-between gap-4">
                      <h3 className="text-lg font-bold text-white tracking-wide">{p.name}</h3>
                      <span className="shrink-0 bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 px-2.5 py-1 rounded-lg text-xs font-bold font-mono">
                        ${Number(p.price_model?.amount_usdc ?? 0).toFixed(2)} USDC / query
                      </span>
                    </div>

                    <p className="text-slate-400 text-sm leading-relaxed font-sans">{p.description}</p>

                    {/* Query parameters list */}
                    {rules?.allow_request_filters && (
                      <div className="space-y-1.5 pt-1">
                        <span className="text-[10px] text-slate-500 uppercase tracking-wider block font-mono">Allowed filters:</span>
                        <div className="flex flex-wrap gap-1.5">
                          {rules.allow_request_filters.map((f: string) => (
                            <code key={f} className="px-2 py-0.5 bg-slate-950 rounded border border-slate-800 text-[10px] text-indigo-300 font-mono">{f}</code>
                          ))}
                          <code className="px-2 py-0.5 bg-slate-950 rounded border border-slate-800 text-[10px] text-indigo-300 font-mono">limit (max {rules.max_limit})</code>
                        </div>
                      </div>
                    )}

                    {/* Bulk Packs */}
                    {hasPacks && (
                      <div className="space-y-2 pt-2 border-t border-slate-800/40">
                        <span className="text-[10px] text-emerald-400 uppercase tracking-wider block font-bold font-mono">Available Tiers &amp; Bulk Packs:</span>
                        <div className="space-y-1.5">
                          {p.price_model.packs.map((pk: any) => (
                            <div key={pk.slug} className="flex justify-between items-center bg-slate-950/60 rounded-xl px-3 py-1.5 border border-slate-800/50 text-[11px] font-mono">
                              <span className="text-slate-400 font-semibold">{pk.label}</span>
                              <span className="text-emerald-400 font-bold">?tier={pk.slug} → ${Number(pk.amount_usdc).toFixed(0)} USDC</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="flex items-center gap-4 mt-6 pt-4 border-t border-slate-800/30">
                    <a 
                      href={`/api/v1/preview/${p.slug}`}
                      className="text-xs text-indigo-400 hover:text-indigo-300 font-semibold font-mono flex items-center gap-1"
                    >
                      Free Preview &rarr;
                    </a>
                    <a 
                      href={`/methodology/${rules?.entity === 'bias' ? 'docs' : rules?.entity === 'scenario_response' ? 'response-gen' : 'big-five-profile-gen'}`}
                      className="text-xs text-slate-500 hover:text-slate-400 font-semibold font-mono"
                    >
                      Methodology
                    </a>
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {/* Connections & Integrations */}
        <section className="space-y-6">
          <div className="space-y-1">
            <h2 className="text-2xl font-bold tracking-tight text-white">Connections &amp; Integrations</h2>
            <p className="text-sm text-slate-500">Psychosynth is agent-native — reach it from any of these runtimes and settle per query over x402. More rails on the way.</p>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {connections.map((c) => (
              <a
                key={c.name}
                href={c.href}
                {...(c.external ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
                className="group p-5 rounded-xl bg-slate-900/40 border border-slate-800/70 hover:border-slate-700 hover:bg-slate-900/70 transition-all flex flex-col gap-2"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm font-bold text-white tracking-wide">{c.name}</span>
                  <span className={`shrink-0 px-2 py-0.5 rounded text-[9px] font-bold font-mono border ${c.badge}`}>{c.tag}</span>
                </div>
                <p className="text-xs text-slate-400 leading-relaxed font-sans">{c.blurb}</p>
                <span className="text-[10px] text-slate-500 group-hover:text-slate-300 font-mono font-semibold mt-auto pt-1">{c.cta} &rarr;</span>
              </a>
            ))}
          </div>
        </section>

        {/* Methodology loop info */}
        <section className="prose prose-invert max-w-none space-y-6 pt-4 border-t border-slate-900">
          <div className="space-y-1">
            <h3 className="text-2xl font-bold text-white">Trust, Quality &amp; Curation Loop</h3>
            <p className="text-sm text-slate-500">Every synthetic item in our library passes through a verified, cryptographic pipeline.</p>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 font-mono text-xs">
            <div className="p-5 rounded-xl border border-slate-900 bg-slate-900/10 space-y-2">
              <span className="text-indigo-400 font-bold block">1. Generation</span>
              <p className="text-slate-400 leading-relaxed font-sans text-xs">Schema-constrained LLM iterations, strictly grounded in the Five-Factor model (IPIP-NEO taxonomy). No freeform hallucinations.</p>
            </div>
            <div className="p-5 rounded-xl border border-slate-900 bg-slate-900/10 space-y-2">
              <span className="text-indigo-400 font-bold block">2. Curation</span>
              <p className="text-slate-400 leading-relaxed font-sans text-xs">Keyboard-driven human-in-the-loop review. Incoherent traits, duplicates, and violations are edited or rejected on-the-fly.</p>
            </div>
            <div className="p-5 rounded-xl border border-slate-900 bg-slate-900/10 space-y-2">
              <span className="text-indigo-400 font-bold block">3. Provenance</span>
              <p className="text-slate-400 leading-relaxed font-sans text-xs">Every record is frozen, version-tagged, and carries a cryptographic SHA-256 content and template hash. Verification drawer live in the Cockpit.</p>
            </div>
          </div>

          <div className="rounded-2xl border border-slate-900 bg-slate-900/20 p-6 flex flex-wrap justify-between items-center gap-4 text-xs">
            <div className="space-y-1">
              <span className="text-white font-bold block font-sans">Full Synthetic Disclosure</span>
              <p className="text-slate-500 font-sans leading-relaxed">No real person details or PII are processed. Every payload returned is marked with <code className="text-indigo-400">synthetic: true</code>.</p>
            </div>
            <a 
              href="/docs" 
              className="px-4 py-2 bg-slate-950 hover:bg-slate-900 rounded-xl border border-slate-800 text-indigo-400 font-bold transition-all text-center shrink-0"
            >
              Read ToS &amp; Privacy Policies
            </a>
          </div>
        </section>
      </div>
    </main>
  );
}
