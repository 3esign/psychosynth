import Link from 'next/link';
import { dbAdmin } from '@/modules/core/db';

export const dynamic = 'force-dynamic';

export default async function LandingPage() {
  const { data: products } = await dbAdmin
    .from('products')
    .select('slug, name, description, price_model, recipes(query_rules)')
    .eq('status', 'live');

  const { count: profileCount } = await dbAdmin
    .from('profiles')
    .select('*', { count: 'exact', head: true })
    .eq('status', 'approved');

  const { count: responseCount } = await dbAdmin
    .from('profile_scenario_responses')
    .select('*', { count: 'exact', head: true });

  const totalProfiles = (profileCount ?? 6880);
  const totalResponses = (responseCount ?? 4000);

  // Agent runtimes & payment rails Psychosynth connects to.
  const connections = [
    { name: 'Faces Wallet MCP', tag: 'Native', badge: 'bg-amber-500/10 border-amber-500/20 text-amber-300', blurb: 'Gives Buzz agents by Block an on-chain Base wallet to autonomously query Psychosynth over x402.', href: 'https://github.com/3esign/Faces-Wallet-MCP', external: true, cta: 'Faces Repo' },
    { name: 'Bankr', tag: 'Live', badge: 'bg-amber-500/10 border-amber-500/20 text-amber-300', blurb: 'Bankr agents discover the catalog and pay per query in gasless USDC via the Psychosynth skill.', href: 'https://skills.bankr.bot', external: true, cta: 'View on Bankr' },
    { name: 'x402-fetch', tag: 'Live', badge: 'bg-amber-500/10 border-amber-500/20 text-amber-300', blurb: 'Any agent using x402-fetch settles out of the box — no API keys, no signup.', href: '/api/v1/discovery', external: false, cta: 'Discovery' },
    { name: 'MCP', tag: 'Native', badge: 'bg-indigo-500/10 border-indigo-500/20 text-indigo-300', blurb: 'A standard MCP server exposes list, preview, quote and query as agent tools.', href: 'https://modelcontextprotocol.io', external: true, cta: 'Learn more' },
    { name: 'Solana Agent Kit', tag: 'Live', badge: 'bg-emerald-500/10 border-emerald-500/20 text-emerald-300', blurb: 'Solana-native agents settle payments in USDC-SPL on Solana via Helius RPC.', href: '/docs', external: false, cta: 'Setup' },
    { name: 'ElizaOS', tag: 'Available', badge: 'bg-indigo-500/10 border-indigo-500/20 text-indigo-300', blurb: 'Connect through @elizaos/plugin-mcp in your agent character config.', href: '/docs', external: false, cta: 'Setup' },
    { name: 'OpenClaw', tag: 'Available', badge: 'bg-indigo-500/10 border-indigo-500/20 text-indigo-300', blurb: 'Add via MCPorter: openclaw mcp add psychosynth.', href: '/docs', external: false, cta: 'Setup' },
    { name: 'Hermes', tag: 'Available', badge: 'bg-indigo-500/10 border-indigo-500/20 text-indigo-300', blurb: 'Nous Research agents register the server over stdio in their config.', href: '/docs', external: false, cta: 'Setup' },
    { name: 'Virtuals (G.A.M.E.)', tag: 'Live', badge: 'bg-indigo-500/10 border-indigo-500/20 text-indigo-300', blurb: 'Virtuals G.A.M.E. SDK agents call Psychosynth dynamically as a custom tool.', href: '/docs', external: false, cta: 'Setup' },
    { name: 'Uniswap v4 Hooks', tag: 'Live', badge: 'bg-pink-500/10 border-pink-500/20 text-pink-300', blurb: 'Our BehaviorAwareHook dynamically adjusts pool swap fee spreads using the swapper panic_index.', href: '/docs', external: false, cta: 'View Hook' },
  ];

  return (
    <main className="min-h-screen bg-slate-950 text-slate-200 selection:bg-indigo-500/30 font-sans">
      {/* Background gradients */}
      <div className="absolute top-0 left-0 w-full h-[600px] bg-gradient-to-b from-indigo-900/15 via-purple-900/5 to-transparent pointer-events-none" />

      <div className="max-w-5xl mx-auto px-6 py-16 relative z-10 space-y-16">
        {/* Hero Section */}
        <header className="space-y-6 max-w-4xl">
          <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-indigo-500/10 border border-indigo-500/25 text-xs font-semibold text-indigo-400 font-mono">
            <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
            Live Production Dataset &amp; Multi-Chain API
          </div>
          <h1 className="text-4xl md:text-6xl font-extrabold tracking-tight text-white leading-tight bg-gradient-to-r from-white via-slate-100 to-indigo-300 bg-clip-text text-transparent">
            Psychosynth API
          </h1>
          <p className="text-lg md:text-xl text-slate-350 leading-relaxed font-sans max-w-3xl">
            Grounded synthetic human psychometrics, Prospect Theory risk curves ($\lambda, \alpha, \beta$), Dark Triad vectors, and decision responses. Built for autonomous agents and market simulators, queryable programmatically over Base and Solana.
          </p>

          {/* Quick Metrics Bar */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2 font-mono">
            <div className="p-3.5 rounded-xl bg-slate-900/60 border border-slate-800/80 backdrop-blur-sm">
              <span className="text-2xl font-bold text-white block">{totalProfiles.toLocaleString()}+</span>
              <span className="text-[11px] text-slate-400 uppercase tracking-wider font-semibold">Verified Profiles</span>
            </div>
            <div className="p-3.5 rounded-xl bg-slate-900/60 border border-slate-800/80 backdrop-blur-sm">
              <span className="text-2xl font-bold text-indigo-400 block">{totalResponses.toLocaleString()}+</span>
              <span className="text-[11px] text-slate-400 uppercase tracking-wider font-semibold">Scenario Responses</span>
            </div>
            <div className="p-3.5 rounded-xl bg-slate-900/60 border border-slate-800/80 backdrop-blur-sm">
              <span className="text-2xl font-bold text-emerald-400 block">4 Dimensions</span>
              <span className="text-[11px] text-slate-400 uppercase tracking-wider font-semibold">Big 5 · DT · PT · CRT</span>
            </div>
            <div className="p-3.5 rounded-xl bg-slate-900/60 border border-slate-800/80 backdrop-blur-sm">
              <span className="text-2xl font-bold text-purple-400 block">x402</span>
              <span className="text-[11px] text-slate-400 uppercase tracking-wider font-semibold">Base &amp; Solana Pay</span>
            </div>
          </div>

          <div className="flex flex-wrap gap-4 pt-3">
            <Link
              href="/playground"
              className="inline-flex items-center justify-center px-6 py-3 bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 hover:from-indigo-500 hover:via-purple-500 hover:to-pink-500 text-white rounded-xl font-bold transition-all shadow-lg shadow-indigo-500/25 border border-indigo-400/30"
            >
              🧠 Interactive Playground &rarr;
            </Link>
            <Link
              href="/explore"
              className="inline-flex items-center justify-center px-5 py-3 bg-slate-900 hover:bg-slate-850 text-slate-200 hover:text-white rounded-xl border border-slate-800 font-semibold transition-all hover:border-slate-700 shadow-md"
            >
              Explore Data Browser
            </Link>
            <Link
              href="/agent"
              className="inline-flex items-center justify-center px-5 py-3 bg-slate-900 hover:bg-slate-850 text-slate-200 hover:text-white rounded-xl border border-slate-800 font-semibold transition-all hover:border-slate-700 shadow-md"
            >
              📈 Market Simulator
            </Link>
            <a
              href="/docs"
              className="inline-flex items-center justify-center px-5 py-3 bg-slate-900 hover:bg-slate-850 text-slate-200 hover:text-white rounded-xl border border-slate-800 font-semibold transition-all hover:border-slate-700 shadow-md font-mono text-sm"
            >
              API Reference &rarr;
            </a>
            <Link
              href="/lab"
              className="inline-flex items-center justify-center px-5 py-3 bg-slate-900 hover:bg-slate-850 text-slate-400 hover:text-slate-200 rounded-xl border border-slate-800/80 text-sm font-semibold transition-all hover:border-slate-700"
            >
              Curation Cockpit
            </Link>
          </div>
        </header>

        {/* Faces Wallet MCP Feature Banner */}
        <section className="p-8 rounded-2xl border border-amber-500/30 bg-gradient-to-br from-amber-500/10 via-slate-900/80 to-indigo-900/20 space-y-6 shadow-2xl backdrop-blur-md">
          <div className="flex flex-col md:flex-row items-start justify-between gap-6">
            <div className="space-y-2 max-w-2xl">
              <span className="text-[10px] bg-amber-500/10 text-amber-300 px-2.5 py-1 rounded-full border border-amber-500/30 font-mono font-bold uppercase tracking-wider">
                Buzz by Block Payment Rails
              </span>
              <h2 className="text-3xl font-extrabold tracking-tight text-white">Faces Wallet MCP Integration</h2>
              <p className="text-sm text-slate-300 leading-relaxed font-sans">
                Buzz makes AI agents first-class teammates with their own cryptographic identity. Faces hands any Buzz agent (Goose, Codex, Claude Code) a real on-chain Base wallet to query Psychosynth over x402 automatically under a configured spend cap.
              </p>
            </div>
            <a
              href="https://github.com/3esign/Faces-Wallet-MCP"
              target="_blank"
              rel="noopener noreferrer"
              className="shrink-0 inline-flex items-center justify-center px-5 py-3 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-extrabold rounded-xl shadow-lg transition-all text-xs font-mono"
            >
              View Faces Repo &rarr;
            </a>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 font-mono text-xs pt-2">
            <div className="p-4 rounded-xl bg-slate-950/80 border border-slate-800/80 space-y-2">
              <span className="text-amber-400 font-bold block">1. Plug-and-Play MCP</span>
              <p className="text-slate-400 font-sans text-xs leading-relaxed">Single configuration line in your Buzz workspace or agent host launches the Faces wallet server over stdio.</p>
            </div>
            <div className="p-4 rounded-xl bg-slate-950/80 border border-slate-800/80 space-y-2">
              <span className="text-amber-400 font-bold block">2. On-Chain Base Treasury</span>
              <p className="text-slate-400 font-sans text-xs leading-relaxed">Backed by Coinbase CDP server wallets or local self-custodied keys. Full balance reads, sends, and message signing.</p>
            </div>
            <div className="p-4 rounded-xl bg-slate-950/80 border border-slate-800/80 space-y-2">
              <span className="text-amber-400 font-bold block">3. Autonomous x402 Settlement</span>
              <p className="text-slate-400 font-sans text-xs leading-relaxed">The x402_fetch tool receives HTTP 402 payment quotes and settles Psychosynth queries in USDC instantly.</p>
            </div>
          </div>
        </section>

        {/* Agent Quickstart — standard x402 + Multi-Chain rails */}
        <section className="rounded-2xl border border-indigo-500/20 bg-gradient-to-br from-indigo-500/10 via-slate-900/50 to-purple-500/10 p-8 space-y-6 shadow-2xl">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="space-y-1.5 max-w-xl">
              <h2 className="text-2xl font-bold tracking-tight text-white">Built for Autonomous AI Agents</h2>
              <p className="text-sm text-slate-350 font-sans leading-relaxed">
                Zero friction, zero registration. Autonomous agents query datasets via machine-to-machine HTTP using standard x402 payment headers settled in gasless USDC on Base mainnet or SPL-USDC on Solana.
              </p>
            </div>
            <div className="flex flex-wrap gap-2 text-[10px] font-mono font-bold">
              <span className="px-2.5 py-1 rounded-lg bg-blue-500/10 border border-blue-500/20 text-blue-300">Base Mainnet (USDC)</span>
              <span className="px-2.5 py-1 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-300">Solana RPC (SPL-USDC)</span>
              <span className="px-2.5 py-1 rounded-lg bg-purple-500/10 border border-purple-500/20 text-purple-300">x402 Protocol</span>
              <span className="px-2.5 py-1 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-300">Free Live Previews</span>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 font-mono text-[11px]">
            <div className="p-4 rounded-xl bg-slate-950/80 border border-slate-800/80 space-y-2">
              <span className="text-indigo-400 font-bold block">1 · Discover — Free</span>
              <code className="block text-slate-300 leading-relaxed break-all">GET /api/v1/discovery</code>
              <p className="text-slate-400 font-sans text-xs leading-relaxed">Products, live pricing tiers, supported filter fields, and payment options in one payload.</p>
            </div>
            <div className="p-4 rounded-xl bg-slate-950/80 border border-slate-800/80 space-y-2">
              <span className="text-indigo-400 font-bold block">2 · Browse &amp; Preview — Free</span>
              <code className="block text-slate-300 leading-relaxed break-all">{'GET /api/v1/browse/{slug}'}</code>
              <p className="text-slate-400 font-sans text-xs leading-relaxed">Public dynamic browse endpoint returning exact matching record counts and deterministic sample cards.</p>
            </div>
            <div className="p-4 rounded-xl bg-slate-950/80 border border-slate-800/80 space-y-2">
              <span className="text-indigo-400 font-bold block">3 · Query Payload — Pay-per-query</span>
              <code className="block text-slate-300 leading-relaxed break-all">{'GET /api/v1/query/{slug}'} &rarr; 402 &rarr; sign &rarr; 200</code>
              <p className="text-slate-400 font-sans text-xs leading-relaxed">Single HTTP handshake: server quotes price, agent signs authorization, server settles and returns full psychometric vectors.</p>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-slate-800/60 text-xs">
            <p className="text-slate-400 font-sans pt-2">
              Using Bankr or MCP? Install the skill:{' '}
              <code className="text-indigo-300 font-mono bg-slate-950 px-2 py-0.5 rounded border border-slate-800">install the psychosynth skill</code>
            </p>
            <a href="/api/v1/discovery" className="pt-2 text-indigo-400 hover:text-indigo-300 font-bold font-mono">
              Try live discovery API &rarr;
            </a>
          </div>
        </section>

        {/* On-Chain Guardian Rails Feature Section */}
        <section className="p-8 rounded-2xl border border-pink-500/20 bg-gradient-to-br from-pink-500/5 via-slate-900/60 to-purple-500/5 space-y-6 shadow-2xl backdrop-blur-md">
          <div className="flex flex-col md:flex-row items-start justify-between gap-6">
            <div className="space-y-2 max-w-2xl">
              <span className="text-[10px] bg-pink-500/10 text-pink-300 px-2.5 py-1 rounded-full border border-pink-500/30 font-mono font-bold uppercase tracking-wider">
                New Integration: Smart Contract Guard Rails
              </span>
              <h2 className="text-3xl font-extrabold tracking-tight text-white">On-Chain Behavioral Firewalls</h2>
              <p className="text-sm text-slate-350 leading-relaxed font-sans">
                Protect protocol liquidity and secure autonomous agent transactions directly on-chain. Psychosynth integrates with execution environments to verify behavioral metrics before transaction confirmation.
              </p>
            </div>
            <Link 
              href="/playground?tab=guardian" 
              className="shrink-0 inline-flex items-center justify-center px-5 py-3 bg-slate-950 hover:bg-slate-900 text-pink-300 hover:text-white rounded-xl border border-pink-500/30 hover:border-pink-500/60 font-bold transition-all text-xs font-mono"
            >
              Simulate dynamic hook &rarr;
            </Link>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-2 font-mono text-xs">
            <div className="p-5 rounded-xl bg-slate-950/80 border border-slate-800/60 space-y-3">
              <div className="flex items-center gap-2 text-indigo-400">
                <span className="text-base">🛡️</span>
                <span className="font-bold">ERC-7579 Behavioral Guard Module</span>
              </div>
              <p className="text-slate-400 font-sans text-xs leading-relaxed">
                Intercepts high-risk smart account transactions. Checks signed Psychosynth certifications on-chain to block execution if the agent's volatility panic index is currently triggered.
              </p>
              <pre className="p-3 bg-slate-900/50 rounded border border-slate-800/80 text-[10px] text-slate-300 overflow-x-auto leading-relaxed">
{`// Guard blocks txn if panic exceeds limit
require(panicIndex <= maxPanicLimit, "Agent Panic Exceeded");`}
              </pre>
            </div>
            <div className="p-5 rounded-xl bg-slate-950/80 border border-slate-800/60 space-y-3">
              <div className="flex items-center gap-2 text-pink-400">
                <span className="text-base">🦄</span>
                <span className="font-bold">Uniswap v4 Behavior-Aware Hook</span>
              </div>
              <p className="text-slate-400 font-sans text-xs leading-relaxed">
                LPs suffer from toxic flow during market stress. The hook adjusts swap fee spreads based on the swapper's signed Psychosynth panic index, neutralizing high-volatility trading stress.
              </p>
              <pre className="p-3 bg-slate-900/50 rounded border border-slate-800/80 text-[10px] text-slate-300 overflow-x-auto leading-relaxed">
{`// Adjusts swap fee dynamically in v4 pool
uint24 feeWithFlag = dynamicFee | OVERRIDE_FEE_FLAG;
return (beforeSwap.selector, ZERO_DELTA, feeWithFlag);`}
              </pre>
            </div>
          </div>
        </section>

        {/* Live Products Grid */}
        <section className="space-y-6">
          <div className="space-y-1.5">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <h2 className="text-2xl font-bold tracking-tight text-white">Active Synthetic Product Catalog</h2>
              <Link href="/explore" className="text-xs text-indigo-400 hover:text-indigo-300 font-mono font-semibold">
                Open Full Interactive Explorer &rarr;
              </Link>
            </div>
            <p className="text-sm text-slate-400">Validated psychometric datasets, risk behavior models, and behavioral response packages queryable live via x402 on Base or Solana.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {(products || []).map((p: any) => {
              const rules = Array.isArray(p.recipes) ? p.recipes[0]?.query_rules : p.recipes?.query_rules;
              const hasPacks = Array.isArray(p.price_model?.packs) && p.price_model.packs.length > 0;
              const filterCount = rules?.allow_request_filters?.length ?? 0;

              return (
                <div 
                  key={p.slug} 
                  className="p-7 rounded-2xl bg-slate-900/60 border border-slate-800/80 shadow-2xl backdrop-blur-md flex flex-col justify-between transition-all duration-300 hover:border-indigo-500/30 hover:bg-slate-900/90"
                >
                  <div className="space-y-4">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <h3 className="text-lg font-bold text-white tracking-wide">{p.name}</h3>
                        <span className="text-[11px] text-slate-500 font-mono">slug: {p.slug}</span>
                      </div>
                      <span className="shrink-0 bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 px-3 py-1 rounded-lg text-xs font-bold font-mono">
                        ${Number(p.price_model?.amount_usdc ?? 0).toFixed(2)} USDC
                      </span>
                    </div>

                    <p className="text-slate-350 text-sm leading-relaxed font-sans">{p.description}</p>

                    {/* Query parameters list */}
                    {rules?.allow_request_filters && (
                      <div className="space-y-1.5 pt-1">
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] text-slate-400 uppercase tracking-wider font-mono font-semibold">Filterable Surface ({filterCount} parameters):</span>
                        </div>
                        <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto pr-1 scrollbar-thin">
                          {rules.allow_request_filters.map((f: string) => (
                            <code key={f} className="px-2 py-0.5 bg-slate-950 rounded border border-slate-800/80 text-[10px] text-indigo-300 font-mono">{f}</code>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Bulk Packs */}
                    {hasPacks && (
                      <div className="space-y-2 pt-2 border-t border-slate-800/50">
                        <span className="text-[10px] text-emerald-400 uppercase tracking-wider block font-bold font-mono">Bulk Packs &amp; Tiered Slices:</span>
                        <div className="space-y-1.5">
                          {p.price_model.packs.map((pk: any) => (
                            <div key={pk.slug} className="flex justify-between items-center bg-slate-950/70 rounded-xl px-3 py-1.5 border border-slate-800/60 text-[11px] font-mono">
                              <span className="text-slate-300 font-semibold">{pk.label}</span>
                              <span className="text-emerald-400 font-bold">?tier={pk.slug} → ${Number(pk.amount_usdc).toFixed(0)} USDC</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="flex items-center gap-4 mt-6 pt-4 border-t border-slate-800/40">
                    <a 
                      href={`/api/v1/browse/${p.slug}`}
                      className="text-xs text-indigo-400 hover:text-indigo-300 font-semibold font-mono flex items-center gap-1"
                    >
                      Browse Samples &rarr;
                    </a>
                    <a 
                      href={`/api/v1/preview/${p.slug}`}
                      className="text-xs text-slate-400 hover:text-slate-200 font-semibold font-mono"
                    >
                      Raw Schema
                    </a>
                    <a 
                      href={`/methodology/${rules?.entity === 'bias' ? 'docs' : rules?.entity === 'scenario_response' ? 'response-gen' : 'big-five-profile-gen'}`}
                      className="text-xs text-slate-500 hover:text-slate-400 font-semibold font-mono ml-auto"
                    >
                      Methodology
                    </a>
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {/* Ecosystem Runtimes */}
        <section className="space-y-6">
          <div className="space-y-1">
            <h2 className="text-2xl font-bold tracking-tight text-white">Agent Framework Connections</h2>
            <p className="text-sm text-slate-400">Psychosynth is agent-native — accessible directly from your agent framework over MCP or standard x402 HTTP headers.</p>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {connections.map((c) => (
              <a
                key={c.name}
                href={c.href}
                {...(c.external ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
                className="group p-5 rounded-xl bg-slate-900/40 border border-slate-800/70 hover:border-indigo-500/30 hover:bg-slate-900/70 transition-all flex flex-col gap-2"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm font-bold text-white tracking-wide">{c.name}</span>
                  <span className={`shrink-0 px-2 py-0.5 rounded text-[9px] font-bold font-mono border ${c.badge}`}>{c.tag}</span>
                </div>
                <p className="text-xs text-slate-400 leading-relaxed font-sans">{c.blurb}</p>
                <span className="text-[10px] text-slate-400 group-hover:text-indigo-300 font-mono font-semibold mt-auto pt-1">{c.cta} &rarr;</span>
              </a>
            ))}
          </div>
        </section>

        {/* Methodology & Quality Control Pipeline */}
        <section className="prose prose-invert max-w-none space-y-6 pt-6 border-t border-slate-900">
          <div className="space-y-1">
            <h3 className="text-2xl font-bold text-white">Scientific Methodology &amp; Quality Control</h3>
            <p className="text-sm text-slate-400 font-sans">Every synthetic profile and scenario response is constructed upon validated psychometric literature and verified through cryptographic pipelines.</p>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 font-mono text-xs">
            <div className="p-4 rounded-xl border border-slate-800/70 bg-slate-900/30 space-y-2">
              <span className="text-indigo-400 font-bold block">1. OCEAN (Big Five)</span>
              <p className="text-slate-400 leading-relaxed font-sans text-xs">IPIP-NEO taxonomy mapping Openness, Conscientiousness, Extraversion, Agreeableness, and Neuroticism numeric scales.</p>
            </div>
            <div className="p-4 rounded-xl border border-slate-800/70 bg-slate-900/30 space-y-2">
              <span className="text-indigo-400 font-bold block">2. Dark Triad</span>
              <p className="text-slate-400 leading-relaxed font-sans text-xs">Dirty Dozen spectrum mapping Machiavellianism, Narcissism, and Psychopathy vectors for edge-case simulations.</p>
            </div>
            <div className="p-4 rounded-xl border border-slate-800/70 bg-slate-900/30 space-y-2">
              <span className="text-indigo-400 font-bold block">3. Prospect Theory</span>
              <p className="text-slate-400 leading-relaxed font-sans text-xs">Kahneman &amp; Tversky behavioral economics modeling loss aversion ($\lambda$), gain curvature ($\alpha$), and loss curvature ($\beta$).</p>
            </div>
            <div className="p-4 rounded-xl border border-slate-800/70 bg-slate-900/30 space-y-2">
              <span className="text-indigo-400 font-bold block">4. CRT &amp; Decision Styles</span>
              <p className="text-slate-400 leading-relaxed font-sans text-xs">Frederick Cognitive Reflection Test scores (System 1 vs System 2 preference) and MBTI decision archetypes.</p>
            </div>
          </div>

          <div className="rounded-2xl border border-slate-800/80 bg-slate-900/40 p-6 flex flex-wrap justify-between items-center gap-4 text-xs">
            <div className="space-y-1">
              <span className="text-white font-bold block font-sans">Cryptographic Verification &amp; Synthetic Disclosure</span>
              <p className="text-slate-400 font-sans leading-relaxed">No real-world PII or private human data is used. Every payload is synthetic (<code className="text-indigo-400">synthetic: true</code>) and stamped with SHA-256 content hashes.</p>
            </div>
            <a 
              href="/docs" 
              className="px-4 py-2.5 bg-slate-950 hover:bg-slate-900 rounded-xl border border-slate-800 text-indigo-400 font-bold transition-all text-center shrink-0 font-mono"
            >
              API Reference &amp; Docs &rarr;
            </a>
          </div>
        </section>
      </div>
    </main>
  );
}
