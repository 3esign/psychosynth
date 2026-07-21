'use client';

// Public data explorer / shopfront. Filter the corpus by Big Five ranges, Dark
// Triad thresholds, decision style, MBTI and tags; compare profiles side-by-side;
// browse scenario responses; and jump directly into the live agent simulation.

import { useState, useEffect, useMemo, useCallback } from 'react';
import Link from 'next/link';

const PRODUCTS = [
  { slug: 'personality-profile-library', name: 'Personality Profiles', type: 'profile' },
  { slug: 'behavioral-response-library', name: 'Behavioral Responses', type: 'response' },
  { slug: 'robinhood-counterparty-pack', name: 'Robinhood Pack', type: 'profile' },
  { slug: 'solana-trading-pack', name: 'Solana Pack', type: 'profile' },
];

const TRAITS: [string, string][] = [
  ['openness', 'Openness'],
  ['conscientiousness', 'Conscientiousness'],
  ['extraversion', 'Extraversion'],
  ['agreeableness', 'Agreeableness'],
  ['neuroticism', 'Neuroticism'],
];
const DARK: [string, string][] = [
  ['machiavellianism', 'Machiavellianism'],
  ['narcissism', 'Narcissism'],
  ['psychopathy', 'Psychopathy'],
];
const STYLES = ['analytical', 'intuitive', 'deliberative', 'spontaneous', 'avoidant', 'dependent'];
const TAGS = ['general-population', 'retail-trading', 'robinhood', 'solana', 'dark-triad-elevated', 'high-neuroticism', 'high-conscientiousness'];
const MBTI = ['ISTJ', 'ISFJ', 'INFJ', 'INTJ', 'ISTP', 'ISFP', 'INFP', 'INTP', 'ESTP', 'ESFP', 'ENFP', 'ENTP', 'ESTJ', 'ESFJ', 'ENFJ', 'ENTJ'];

const r2 = (n: number) => Math.round(n * 100) / 100;

function Bar({ v, color = 'bg-indigo-500/70' }: { v: number; color?: string }) {
  return (
    <div className="h-1.5 w-full bg-slate-800 rounded-full overflow-hidden">
      <div className={`h-full ${color} rounded-full transition-all duration-300`} style={{ width: `${Math.max(0, Math.min(1, v)) * 100}%` }} />
    </div>
  );
}

export default function Explore() {
  const [product, setProduct] = useState('personality-profile-library');
  const [bf, setBf] = useState<Record<string, [number, number]>>(Object.fromEntries(TRAITS.map(([t]) => [t, [0, 1]])));
  const [dark, setDark] = useState<Record<string, number>>({ machiavellianism: 0, narcissism: 0, psychopathy: 0 });
  const [style, setStyle] = useState('');
  const [mbti, setMbti] = useState('');
  const [tags, setTags] = useState<string[]>([]);
  const [data, setData] = useState<{ total: number; records: any[] } | null>(null);
  const [loading, setLoading] = useState(false);

  // Side-by-Side Comparison State (Feature E)
  const [comparedProfiles, setComparedProfiles] = useState<any[]>([]);
  const [showCompareDrawer, setShowCompareDrawer] = useState(false);

  const currentProdObj = PRODUCTS.find((p) => p.slug === product) ?? PRODUCTS[0];
  const isResponseProduct = currentProdObj.type === 'response';

  const qs = useMemo(() => {
    if (isResponseProduct) return '';
    const q = new URLSearchParams();
    const mins = TRAITS.filter(([t]) => bf[t][0] > 0).map(([t]) => `${t}:${r2(bf[t][0])}`);
    const maxs = TRAITS.filter(([t]) => bf[t][1] < 1).map(([t]) => `${t}:${r2(bf[t][1])}`);
    if (mins.length) q.set('big_five_min', mins.join(','));
    if (maxs.length) q.set('big_five_max', maxs.join(','));
    for (const [d] of DARK) if (dark[d] > 0) q.set(`${d}_min`, String(r2(dark[d])));
    if (style) q.set('decision_style', style);
    if (mbti) q.set('mbti_label', mbti);
    if (tags.length) q.set('tags', tags.join(','));
    return q.toString();
  }, [bf, dark, style, mbti, tags, isResponseProduct]);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    const id = setTimeout(async () => {
      try {
        const res = await fetch(`/api/v1/browse/${product}${qs ? `?${qs}` : ''}`);
        const j = await res.json();
        if (alive) setData(res.ok ? { total: j.total ?? 0, records: j.records ?? [] } : { total: 0, records: [] });
      } catch {
        if (alive) setData({ total: 0, records: [] });
      } finally {
        if (alive) setLoading(false);
      }
    }, 280);
    return () => { alive = false; clearTimeout(id); };
  }, [product, qs]);

  const reset = useCallback(() => {
    setBf(Object.fromEntries(TRAITS.map(([t]) => [t, [0, 1]])));
    setDark({ machiavellianism: 0, narcissism: 0, psychopathy: 0 });
    setStyle(''); setMbti(''); setTags([]);
  }, []);

  const toggleTag = (t: string) => setTags((cur) => cur.includes(t) ? cur.filter((x) => x !== t) : [...cur, t]);
  const active = qs.length > 0;

  const toggleCompare = (p: any) => {
    setComparedProfiles((cur) => {
      const exists = cur.some((item) => item.id === p.id);
      if (exists) {
        return cur.filter((item) => item.id !== p.id);
      }
      if (cur.length >= 3) return cur; // Max 3 comparison slots
      return [...cur, p];
    });
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-200 font-sans antialiased relative">
      <div className="absolute top-0 left-0 w-full h-[360px] bg-gradient-to-b from-indigo-900/10 via-purple-900/5 to-transparent pointer-events-none" />

      <header className="border-b border-slate-800/80 bg-slate-900/50 backdrop-blur sticky top-0 z-40">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/" className="text-lg font-bold text-white tracking-wide">Psychosynth</Link>
            <span className="text-[10px] font-mono bg-indigo-500/10 text-indigo-300 px-2.5 py-0.5 rounded-full border border-indigo-500/20">Data Explorer &amp; Compare</span>
          </div>
          <div className="flex items-center gap-4">
            {comparedProfiles.length > 0 && (
              <button
                onClick={() => setShowCompareDrawer(true)}
                className="text-xs px-3 py-1.5 rounded-lg bg-indigo-600 text-white font-semibold font-mono shadow-md animate-pulse"
              >
                Compare ({comparedProfiles.length}/3) &rarr;
              </button>
            )}
            <Link href="/agent" className="text-sm text-indigo-400 hover:text-indigo-300 font-semibold">
              Live Agent Demo &rarr;
            </Link>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-8 relative z-10 space-y-6">
        <div className="space-y-1 max-w-2xl">
          <h1 className="text-3xl font-extrabold tracking-tight text-white">Explore &amp; Compare Corpus</h1>
          <p className="text-sm text-slate-400 leading-relaxed">
            Slice 3,080+ psychometric profiles and 3,400+ scenario responses. Use dual-thumb controls to bound traits, compare profiles side-by-side, or launch an archetype into the live simulation floor.
          </p>
        </div>

        {/* Product / Dataset Tab Switcher (Feature A) */}
        <div className="flex items-center gap-1.5 bg-slate-900/80 border border-slate-800 rounded-xl p-1.5 w-fit">
          {PRODUCTS.map((p) => (
            <button
              key={p.slug}
              onClick={() => { setProduct(p.slug); setComparedProfiles([]); }}
              className={`text-xs px-4 py-2 rounded-lg font-semibold transition-all ${
                product === p.slug
                  ? 'bg-indigo-600 text-white shadow-md'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/40'
              }`}
            >
              {p.name}
            </button>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Filters Sidebar (Feature C - Dual Thumb Range Sliders) */}
          <aside className="lg:col-span-4 space-y-5">
            <div className="rounded-2xl border border-slate-800/80 bg-slate-900/40 p-5 space-y-5 backdrop-blur-md">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold text-white">Filters</h3>
                {active && <button onClick={reset} className="text-[11px] text-indigo-400 hover:text-indigo-300 font-semibold font-mono">Reset Filters</button>}
              </div>

              {!isResponseProduct ? (
                <>
                  <div className="space-y-3">
                    <span className="text-[10px] uppercase tracking-wider text-indigo-400 font-mono font-bold block">Big Five Bounds (Dual Sliders)</span>
                    {TRAITS.map(([t, label]) => (
                      <div key={t} className="space-y-1.5 bg-slate-950/60 p-2.5 rounded-xl border border-slate-800/60">
                        <div className="flex justify-between text-[11px]">
                          <span className="text-slate-300 font-semibold">{label}</span>
                          <span className="font-mono text-indigo-300 text-[10px] bg-indigo-500/10 border border-indigo-500/20 px-1.5 py-0.5 rounded">
                            {r2(bf[t][0])} – {r2(bf[t][1])}
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <input
                            type="range" min={0} max={1} step={0.05} value={bf[t][0]}
                            onChange={(e) => setBf((c) => ({ ...c, [t]: [Math.min(parseFloat(e.target.value), c[t][1]), c[t][1]] }))}
                            className="w-full accent-indigo-500 h-1 bg-slate-800 rounded-lg appearance-none cursor-pointer"
                          />
                          <input
                            type="range" min={0} max={1} step={0.05} value={bf[t][1]}
                            onChange={(e) => setBf((c) => ({ ...c, [t]: [c[t][0], Math.max(parseFloat(e.target.value), c[t][0])] }))}
                            className="w-full accent-indigo-500 h-1 bg-slate-800 rounded-lg appearance-none cursor-pointer"
                          />
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="space-y-3 border-t border-slate-800 pt-4">
                    <span className="text-[10px] uppercase tracking-wider text-rose-400 font-mono font-bold block">Dark Triad Thresholds</span>
                    {DARK.map(([d, label]) => (
                      <div key={d} className="space-y-1.5 bg-slate-950/60 p-2.5 rounded-xl border border-slate-800/60">
                        <div className="flex justify-between text-[11px]">
                          <span className="text-slate-300 font-semibold">{label}</span>
                          <span className="font-mono text-rose-400 text-[10px] bg-rose-500/10 border border-rose-500/20 px-1.5 py-0.5 rounded">
                            {dark[d] > 0 ? `≥ ${r2(dark[d])}` : 'any'}
                          </span>
                        </div>
                        <input
                          type="range" min={0} max={1} step={0.05} value={dark[d]}
                          onChange={(e) => setDark((c) => ({ ...c, [d]: parseFloat(e.target.value) }))}
                          className="w-full accent-rose-500 h-1 bg-slate-800 rounded-lg appearance-none cursor-pointer"
                        />
                      </div>
                    ))}
                  </div>

                  <div className="space-y-2 border-t border-slate-800 pt-4">
                    <span className="text-[10px] uppercase tracking-wider text-slate-400 font-mono font-bold block">Decision Style</span>
                    <div className="flex flex-wrap gap-1.5">
                      {STYLES.map((s) => (
                        <button
                          key={s}
                          onClick={() => setStyle(style === s ? '' : s)}
                          className={`text-[11px] px-2.5 py-1 rounded-lg border transition ${
                            style === s ? 'bg-indigo-500/20 text-indigo-300 border-indigo-500/40' : 'bg-slate-900 text-slate-400 border-slate-800 hover:border-slate-700'
                          }`}
                        >
                          {s}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-2 border-t border-slate-800 pt-4">
                    <span className="text-[10px] uppercase tracking-wider text-slate-400 font-mono font-bold block">Tags</span>
                    <div className="flex flex-wrap gap-1.5">
                      {TAGS.map((t) => (
                        <button
                          key={t}
                          onClick={() => toggleTag(t)}
                          className={`text-[11px] px-2.5 py-1 rounded-lg border transition ${
                            tags.includes(t) ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/40' : 'bg-slate-900 text-slate-400 border-slate-800 hover:border-slate-700'
                          }`}
                        >
                          {t}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-2 border-t border-slate-800 pt-4">
                    <span className="text-[10px] uppercase tracking-wider text-slate-400 font-mono font-bold block">MBTI Archetype</span>
                    <select
                      value={mbti}
                      onChange={(e) => setMbti(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-indigo-500/50"
                    >
                      <option value="">Any MBTI Archetype</option>
                      {MBTI.map((m) => <option key={m} value={m}>{m}</option>)}
                    </select>
                  </div>
                </>
              ) : (
                <div className="text-xs text-slate-400 leading-relaxed font-sans p-2">
                  Showing 3,400+ scenario-conditioned behavioral responses. Each response models decision logic, emotional trajectory, and confidence metrics under specific scenario stress.
                </div>
              )}
            </div>
          </aside>

          {/* Results Display */}
          <section className="lg:col-span-8 space-y-5">
            {/* Header Hero Box */}
            <div className="rounded-2xl border border-indigo-500/20 bg-gradient-to-br from-indigo-500/[0.07] via-slate-900/50 to-slate-900/50 p-6 backdrop-blur-md">
              <div className="flex flex-wrap items-end justify-between gap-4">
                <div>
                  <span className="text-[10px] uppercase tracking-widest text-slate-400 font-mono">
                    {active ? 'Filtered Corpus Matches' : 'Total Items in Catalog'}
                  </span>
                  <div className="text-4xl font-extrabold text-white tabular-nums">
                    {loading ? <span className="text-slate-600">…</span> : (data?.total ?? 0).toLocaleString()}
                  </div>
                </div>
                <a
                  href={`/api/v1/query/${product}${qs ? `?${qs}` : ''}`}
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 hover:brightness-110 text-white text-sm font-semibold shadow-lg shadow-indigo-500/10"
                >
                  Query via Paywalled API &rarr;
                </a>
              </div>
              <code className="block mt-4 text-[11px] font-mono text-indigo-300/90 bg-slate-950/80 border border-slate-800 rounded-lg px-3 py-2 break-all">
                GET /api/v1/query/{product}{qs ? `?${qs}` : ''}
              </code>
              <p className="text-[11px] text-slate-400 mt-2">
                Free sample below. The full un-truncated vector dataset settles per query over x402 on Base or Solana. <Link href="/docs" className="text-indigo-400 hover:text-indigo-300 font-semibold">Docs &rarr;</Link>
              </p>
            </div>

            {/* Results Grid */}
            {data && data.records.length === 0 && !loading && (
              <div className="rounded-2xl border border-slate-800/80 bg-slate-900/40 p-10 text-center text-sm text-slate-400">
                No matching records found. Try adjusting filter bounds or clearing active tags.
              </div>
            )}

            {!isResponseProduct ? (
              /* Profiles Grid */
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {(data?.records ?? []).map((p) => {
                  const isCompared = comparedProfiles.some((item) => item.id === p.id);
                  return (
                    <div
                      key={p.id}
                      className={`rounded-xl border p-4 space-y-3 transition-all ${
                        isCompared ? 'border-indigo-500/50 bg-indigo-500/10' : 'border-slate-800/70 bg-slate-900/40 hover:border-slate-700'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <input
                            type="checkbox"
                            checked={isCompared}
                            onChange={() => toggleCompare(p)}
                            className="accent-indigo-500 h-4 w-4 rounded cursor-pointer"
                          />
                          <span className="text-xs font-bold font-mono text-white">{p.mbti_label ?? '—'}</span>
                        </div>
                        <span className="text-[10px] font-mono text-slate-300 bg-slate-800/70 px-2 py-0.5 rounded">
                          {p.decision_style ?? '—'}
                        </span>
                      </div>

                      <div className="grid grid-cols-5 gap-1.5">
                        {TRAITS.map(([t, label]) => (
                          <div key={t} className="space-y-1" title={label}>
                            <div className="flex justify-between text-[8px] font-mono text-slate-400">
                              <span>{label[0]}</span>
                              <span>{r2(Number(p.big_five?.[t] ?? 0))}</span>
                            </div>
                            <Bar v={Number(p.big_five?.[t] ?? 0)} />
                          </div>
                        ))}
                      </div>

                      <p className="text-[11px] text-slate-350 leading-relaxed line-clamp-3">{p.summary}</p>

                      <div className="flex items-center justify-between pt-2 border-t border-slate-800/40 text-[10px]">
                        {Array.isArray(p.tags) && p.tags.length > 0 ? (
                          <div className="flex flex-wrap gap-1">
                            {p.tags.slice(0, 2).map((t: string) => (
                              <span key={t} className="font-mono text-slate-400 bg-slate-800/50 px-1.5 py-0.5 rounded">{t}</span>
                            ))}
                          </div>
                        ) : <div />}
                        <Link
                          href={`/agent?agent=${p.mbti_label?.toLowerCase() || 'panic-seller'}`}
                          className="text-indigo-400 hover:text-indigo-300 font-mono font-semibold flex items-center gap-1"
                        >
                          ⚡ Simulate &rarr;
                        </Link>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              /* Scenario Responses Grid (Feature A) */
              <div className="space-y-4">
                {(data?.records ?? []).map((r: any) => (
                  <div key={r.id} className="rounded-xl border border-slate-800/80 bg-slate-900/50 p-5 space-y-3 backdrop-blur-md">
                    <div className="flex items-center justify-between text-xs font-mono">
                      <span className="text-indigo-400 font-bold">Scenario Decision Payload</span>
                      <span className="text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded text-[10px]">
                        Confidence: {(Number(r.confidence ?? 0.8) * 100).toFixed(0)}%
                      </span>
                    </div>
                    <p className="text-xs text-slate-200 font-sans leading-relaxed font-medium bg-slate-950/70 p-3 rounded-lg border border-slate-800/60">
                      &ldquo;{r.response}&rdquo;
                    </p>
                    {r.reasoning_chain && (
                      <div className="text-[11px] text-slate-400 font-sans leading-relaxed">
                        <span className="text-slate-500 font-mono font-semibold block uppercase text-[9px]">Reasoning Chain:</span>
                        {r.reasoning_chain}
                      </div>
                    )}
                    {r.emotional_arc && (
                      <div className="text-[10px] text-fuchsia-300 font-mono">
                        Emotional Arc: {r.emotional_arc}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}

            {data && data.total > data.records.length && (
              <p className="text-center text-xs text-slate-500 pt-2 font-mono">
                Showing {data.records.length} of {data.total.toLocaleString()} — query full dataset via API above.
              </p>
            )}
          </section>
        </div>
      </main>

      {/* Side-by-Side Profile Comparison Drawer (Feature E) */}
      {comparedProfiles.length > 0 && (
        <div className="fixed bottom-0 left-0 w-full z-50 bg-slate-900/95 border-t border-indigo-500/30 backdrop-blur-xl shadow-2xl transition-all duration-300 p-5">
          <div className="max-w-6xl mx-auto space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-sm font-bold text-white font-mono">Side-by-Side Profile Comparison Matrix</span>
                <span className="text-xs text-indigo-400 font-mono">({comparedProfiles.length}/3 selected)</span>
              </div>
              <button
                onClick={() => setComparedProfiles([])}
                className="text-xs text-slate-400 hover:text-slate-200 font-mono"
              >
                Clear Matrix ✕
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {comparedProfiles.map((p) => (
                <div key={p.id} className="p-4 rounded-xl bg-slate-950/80 border border-slate-800 space-y-3 text-xs">
                  <div className="flex justify-between items-center">
                    <span className="font-bold text-white font-mono text-sm">{p.mbti_label}</span>
                    <span className="text-[10px] font-mono text-indigo-300 bg-indigo-500/10 border border-indigo-500/20 px-2 py-0.5 rounded">
                      {p.decision_style}
                    </span>
                  </div>

                  <div className="space-y-1.5">
                    <span className="text-[9px] uppercase tracking-wider text-slate-500 font-mono font-bold block">Big Five Trait Vector</span>
                    {TRAITS.map(([t, label]) => (
                      <div key={t} className="space-y-0.5">
                        <div className="flex justify-between text-[8px] font-mono text-slate-400">
                          <span>{label}</span>
                          <span>{r2(Number(p.big_five?.[t] ?? 0))}</span>
                        </div>
                        <Bar v={Number(p.big_five?.[t] ?? 0)} />
                      </div>
                    ))}
                  </div>

                  <p className="text-[10px] text-slate-350 leading-relaxed line-clamp-3 italic">
                    &ldquo;{p.summary}&rdquo;
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
