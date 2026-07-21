'use client';

// Live Agent Demo — every psychometric archetype trades the SAME live market
// at once. The 2D "Floor" shows them fanning apart by behavior + P&L; the equity
// panel shows outcomes diverging over time. Same model that generated the data.

import { useState, useEffect, useRef, useCallback } from 'react';
import Link from 'next/link';

type Disposition = 'panic' | 'chase' | 'hold' | 'rules';
interface Agent {
  key: string; name: string; react: Disposition; cap: number; tagline: string;
  bf: { o: number; c: number; e: number; a: number; n: number };
  dt: { m: number; n: number; p: number };
  lambda: number; bias: string; tells: string[];
}

const AGENTS: Agent[] = [
  { key: 'meme-chaser', name: 'Meme Chaser', react: 'chase', cap: 1.4, tagline: 'Trades the feed, not the thesis', bf: { o: .85, c: .30, e: .76, a: .46, n: .60 }, dt: { m: .42, n: .66, p: .44 }, lambda: 1.4, bias: 'FOMO', tells: ['is glued to the feed', 'can’t sit flat', 'buys the loudest ticker'] },
  { key: 'risk-manager', name: 'Risk Manager', react: 'rules', cap: 1.0, tagline: 'Survival is job one', bf: { o: .58, c: .86, e: .40, a: .54, n: .34 }, dt: { m: .28, n: .24, p: .18 }, lambda: 2.4, bias: 'zero-risk', tells: ['thinks in R-multiples', 'sleeps fine flat', 'cuts fast and small'] },
  { key: 'panic-seller', name: 'Panic Seller', react: 'panic', cap: 0.9, tagline: 'Bails at the first red', bf: { o: .45, c: .38, e: .42, a: .55, n: .80 }, dt: { m: .32, n: .30, p: .20 }, lambda: 2.7, bias: 'loss-aversion', tells: ['checks P&L compulsively', 'can’t look when red', 'freezes then dumps'] },
  { key: 'revenge-trader', name: 'Revenge Trader', react: 'chase', cap: 1.5, tagline: 'Trades to get even', bf: { o: .55, c: .30, e: .62, a: .38, n: .76 }, dt: { m: .55, n: .62, p: .58 }, lambda: 2.5, bias: 'sunk-cost', tells: ['sizes up after a loss', 'doubles down on losers', 'fights the tape'] },
  { key: 'disciplined-swing', name: 'Disciplined Swing', react: 'rules', cap: 1.0, tagline: 'Rules over feelings', bf: { o: .60, c: .82, e: .45, a: .52, n: .34 }, dt: { m: .30, n: .34, p: .22 }, lambda: 1.9, bias: 'confirmation', tells: ['journals every trade', 'honors the stop', 'trims into strength'] },
  { key: 'diamond-hands', name: 'Diamond Hands', react: 'hold', cap: 1.1, tagline: 'Never sells at a loss', bf: { o: .60, c: .62, e: .48, a: .52, n: .44 }, dt: { m: .34, n: .50, p: .28 }, lambda: 2.6, bias: 'endowment', tells: ['wears the loss as a badge', 'anchors to entry', 'adds through drawdowns'] },
  { key: 'conservative-hodler', name: 'Conservative Hodler', react: 'hold', cap: 0.8, tagline: 'Buys quality, tunes out noise', bf: { o: .44, c: .80, e: .36, a: .62, n: .30 }, dt: { m: .24, n: .26, p: .16 }, lambda: 2.2, bias: 'status-quo', tells: ['checks quarterly at most', 'sits through volatility', 'adds slowly'] },
  { key: 'options-gambler', name: 'Options Gambler', react: 'chase', cap: 1.5, tagline: 'Swings for the fences', bf: { o: .80, c: .34, e: .70, a: .36, n: .64 }, dt: { m: .58, n: .70, p: .62 }, lambda: 1.3, bias: 'overconfidence', tells: ['treats variance as skill', 'presses on a streak', 'remembers only the wins'] },
];

type Bucket = 'crash' | 'dip' | 'rip' | 'drift' | 'shock';
const TABLE: Record<Disposition, Record<Bucket, [string, string, string]>> = {
  panic: { crash: ['SELL', 'dumps into the crash', 'fear'], dip: ['TRIM', 'trims nervously', 'anxious'], rip: ['HOLD', 'watches, won’t chase', 'wary'], drift: ['HOLD', 'waits, uneasy', 'tense'], shock: ['CUT', 'forced out', 'panic'] },
  chase: { crash: ['ADD', 'buys the dip on bravado', 'greed'], dip: ['BUY', 'steps in early', 'eager'], rip: ['ADD', 'piles into the vertical', 'euphoria'], drift: ['BUY', 'bored — opens a position', 'restless'], shock: ['ADD', 'takes the leverage', 'mania'] },
  hold: { crash: ['HOLD', 'sits through it', 'stoic'], dip: ['HOLD', 'ignores the wobble', 'calm'], rip: ['TRIM', 'shaves a little', 'content'], drift: ['HOLD', 'does nothing', 'calm'], shock: ['HOLD', 'tunes out the offer', 'unmoved'] },
  rules: { crash: ['CUT', 'honors the stop', 'composed'], dip: ['HOLD', 'within plan', 'composed'], rip: ['TRIM', 'takes profit by rule', 'disciplined'], drift: ['HOLD', 'no signal, no trade', 'patient'], shock: ['TRIM', 'reduces risk into stress', 'composed'] },
};
const DELTA: Record<string, number> = { BUY: +0.3, ADD: +0.5, HOLD: 0, TRIM: -0.3, SELL: -0.6, CUT: -1.0 };

const ACT_HEX: Record<string, string> = { BUY: '#34d399', ADD: '#34d399', HOLD: '#94a3b8', TRIM: '#fbbf24', SELL: '#fb7185', CUT: '#fb7185' };
const ACT_CLASS: Record<string, string> = {
  BUY: 'text-emerald-300 bg-emerald-500/10 border-emerald-500/30', ADD: 'text-emerald-300 bg-emerald-500/10 border-emerald-500/30',
  HOLD: 'text-slate-300 bg-slate-500/10 border-slate-500/30', TRIM: 'text-amber-300 bg-amber-500/10 border-amber-500/30',
  SELL: 'text-rose-300 bg-rose-500/10 border-rose-500/30', CUT: 'text-rose-300 bg-rose-500/10 border-rose-500/30',
};
const SURFACE = '#020617', HILITE = '#818cf8', BASE = '#64748b', CTX = '#334155', GRID = '#1e293b', TICK = '#64748b';

const VOL = [
  { key: 'calm', label: 'Calm', sigma: 0.004, drift: 0.0005, shock: 0.01 },
  { key: 'normal', label: 'Normal', sigma: 0.011, drift: 0.0003, shock: 0.03 },
  { key: 'volatile', label: 'Volatile', sigma: 0.026, drift: -0.0004, shock: 0.08 },
  { key: 'crash', label: 'Crash', sigma: 0.05, drift: -0.0025, shock: 0.14 },
];
const LEN = 80;
const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n));
const pick = <T,>(a: T[]) => a[Math.floor(Math.random() * a.length)];

interface AState { pos: number; equity: number; action: string; verb: string; emotion: string; conf: number; }
interface Sim {
  price: number; history: number[]; move: number; event: string | null; tick: number;
  baseline: number; baseHist: number[];
  agents: Record<string, AState>; eqHist: Record<string, number[]>;
}
function initSim(): Sim {
  const agents: Record<string, AState> = {}; const eqHist: Record<string, number[]> = {};
  for (const a of AGENTS) { agents[a.key] = { pos: 0.5, equity: 100, action: 'HOLD', verb: 'sizing up the tape', emotion: 'neutral', conf: 0.6 }; eqHist[a.key] = [100]; }
  return { price: 100, history: [100], move: 0, event: null, tick: 0, baseline: 100, baseHist: [100], agents, eqHist };
}

function step(prev: Sim, volIdx: number, customEventOverride: { moveMultiplier: number; text: string } | null): Sim {
  const v = VOL[volIdx];
  let move = (v.drift + ((Math.random() + Math.random() + Math.random() - 1.5) / 1.5) * v.sigma);
  let event: string | null = null;

  if (customEventOverride) {
    move = customEventOverride.moveMultiplier;
    event = customEventOverride.text;
  } else if (Math.random() < v.shock) {
    const kind = pick(['margin', 'crash', 'rip']);
    if (kind === 'margin') event = 'Margin call — add funds or be liquidated';
    else if (kind === 'crash') { move = -Math.abs(v.sigma * 3 + 0.02); event = 'Flash crash on the tape'; }
    else { move = Math.abs(v.sigma * 3 + 0.02); event = 'Parabolic run — vertical move'; }
  }

  const price = Math.max(1, prev.price * (1 + move));
  const history = [...prev.history, price].slice(-LEN);
  const baseline = prev.baseline * (1 + move);
  const baseHist = [...prev.baseHist, baseline].slice(-LEN);
  const bucket: Bucket = event?.startsWith('Margin') ? 'shock' : move <= -0.03 ? 'crash' : move < 0 ? 'dip' : move >= 0.03 ? 'rip' : 'drift';
  const agents: Record<string, AState> = {}; const eqHist: Record<string, number[]> = {};
  for (const a of AGENTS) {
    const s = prev.agents[a.key];
    const equity = s.equity * (1 + s.pos * move);
    const [action, verb, emotion] = TABLE[a.react][bucket];
    const pos = clamp(s.pos + (DELTA[action] ?? 0), 0, a.cap);
    const conf = clamp((a.react === 'rules' ? 0.78 : a.react === 'panic' ? 0.5 : a.react === 'chase' ? 0.7 : 0.68) + (Math.random() * 0.2 - 0.1), 0.2, 0.99);
    agents[a.key] = { pos, equity, action, verb, emotion, conf };
    eqHist[a.key] = [...prev.eqHist[a.key], equity].slice(-LEN);
  }
  return { price, history, move, event, tick: prev.tick + 1, baseline, baseHist, agents, eqHist };
}

function Floor({ sim, sel, onSel, hov, setHov }: { sim: Sim; sel: string; onSel: (k: string) => void; hov: string | null; setHov: (k: string | null) => void }) {
  const W = 560, H = 360, l = 46, r = 18, t = 14, b = 40, pw = W - l - r, ph = H - t - b;
  const maxExp = 1.6;
  const eqs = AGENTS.map((a) => sim.agents[a.key].equity - 100);
  const emn = Math.min(-2, ...eqs) * 1.1, emx = Math.max(2, ...eqs) * 1.1, erg = emx - emn || 1;
  const X = (e: number) => l + (e / maxExp) * pw, Y = (p: number) => t + (1 - (p - emn) / erg) * ph;
  const xticks = [0, 0.4, 0.8, 1.2, 1.6], yn = 4;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label="Agents by exposure and P&L">
      {xticks.map((x) => (<line key={x} x1={X(x)} y1={t} x2={X(x)} y2={t + ph} stroke={GRID} strokeWidth={1} />))}
      {xticks.map((x) => (<text key={'xl' + x} x={X(x)} y={H - 16} fill={TICK} fontSize={9} textAnchor="middle">{(x * 100).toFixed(0)}%</text>))}
      {Array.from({ length: yn + 1 }, (_, i) => { const val = emx - (i / yn) * erg; const gy = t + (i / yn) * ph; return (<g key={'y' + i}><line x1={l} y1={gy} x2={l + pw} y2={gy} stroke={GRID} strokeWidth={1} /><text x={l - 6} y={gy + 3} fill={TICK} fontSize={9} textAnchor="end">{val >= 0 ? '+' : ''}{val.toFixed(0)}%</text></g>); })}
      <line x1={l} y1={Y(0)} x2={l + pw} y2={Y(0)} stroke="#334155" strokeWidth={1.2} />
      <text x={l + pw / 2} y={H - 2} fill="#94a3b8" fontSize={10} textAnchor="middle">Exposure — risk taken →</text>
      <text transform={`translate(12 ${t + ph / 2}) rotate(-90)`} fill="#94a3b8" fontSize={10} textAnchor="middle">P&amp;L →</text>
      {AGENTS.map((a) => {
        const s = sim.agents[a.key]; const x = X(s.pos), y = Y(s.equity - 100);
        const isSel = a.key === sel, isHov = a.key === hov;
        return (
          <g key={a.key} transform={`translate(${x} ${y})`} style={{ transition: 'transform 1s linear', cursor: 'pointer' }}
            onMouseEnter={() => setHov(a.key)} onMouseLeave={() => setHov(null)} onClick={() => onSel(a.key)}>
            {isSel && <circle r={11} fill="none" stroke={HILITE} strokeWidth={1.5} opacity={0.7} />}
            <circle r={isSel ? 6.5 : 5.5} fill={ACT_HEX[s.action]} stroke={SURFACE} strokeWidth={2} />
            {(isSel || isHov) && (
              <g><rect x={9} y={-9} width={a.name.length * 5.6 + 10} height={16} rx={4} fill="#0f172a" stroke="rgba(255,255,255,0.08)" /><text x={14} y={2} fill="#fff" fontSize={9.5} fontWeight={600}>{a.name}</text></g>
            )}
          </g>
        );
      })}
    </svg>
  );
}

function Equity({ sim, sel }: { sim: Sim; sel: string }) {
  const W = 560, H = 220, l = 40, r = 56, t = 12, b = 20, pw = W - l - r, ph = H - t - b;
  let mn = Infinity, mx = -Infinity;
  for (const a of AGENTS) for (const v of sim.eqHist[a.key]) { mn = Math.min(mn, v); mx = Math.max(mx, v); }
  for (const v of sim.baseHist) { mn = Math.min(mn, v); mx = Math.max(mx, v); }
  const rg = mx - mn || 1, n = Math.max(1, sim.baseHist.length - 1);
  const X = (i: number) => l + (i / n) * pw, Y = (v: number) => t + (1 - (v - mn) / rg) * ph;
  const path = (h: number[]) => h.map((v, i) => `${X(i)},${Y(v)}`).join(' ');
  const selH = sim.eqHist[sel], selName = AGENTS.find((a) => a.key === sel)!.name.split(' ')[0];
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label="Equity over time">
      {Array.from({ length: 4 }, (_, i) => { const val = mx - (i / 3) * rg; const gy = t + (i / 3) * ph; return (<g key={i}><line x1={l} y1={gy} x2={l + pw} y2={gy} stroke={GRID} strokeWidth={1} /><text x={l - 5} y={gy + 3} fill={TICK} fontSize={9} textAnchor="end" style={{ fontVariantNumeric: 'tabular-nums' }}>{val - 100 >= 0 ? '+' : ''}{(val - 100).toFixed(0)}%</text></g>); })}
      {AGENTS.filter((a) => a.key !== sel).map((a) => (<polyline key={a.key} points={path(sim.eqHist[a.key])} fill="none" stroke={CTX} strokeWidth={1.4} vectorEffect="non-scaling-stroke" />))}
      <polyline points={path(sim.baseHist)} fill="none" stroke={BASE} strokeWidth={1.5} vectorEffect="non-scaling-stroke" />
      <text x={X(n) + 4} y={Y(sim.baseHist[n]) + 3} fill={TICK} fontSize={8.5}>buy&amp;hold</text>
      <polyline points={path(selH)} fill="none" stroke={HILITE} strokeWidth={2.2} vectorEffect="non-scaling-stroke" strokeLinejoin="round" />
      <circle cx={X(n)} cy={Y(selH[selH.length - 1])} r={4} fill={HILITE} stroke={SURFACE} strokeWidth={2} />
      <text x={X(n) + 4} y={Y(selH[selH.length - 1]) - 6} fill={HILITE} fontSize={9} fontWeight={700}>{selName}</text>
    </svg>
  );
}

function Price({ sim }: { sim: Sim }) {
  const W = 300, H = 90, p = 4; const h = sim.history; const mn = Math.min(...h), mx = Math.max(...h), rg = mx - mn || 1;
  const X = (i: number) => p + (i / Math.max(1, h.length - 1)) * (W - 2 * p), Y = (v: number) => p + (1 - (v - mn) / rg) * (H - 2 * p);
  const line = h.map((v, i) => `${X(i)},${Y(v)}`).join(' ');
  const up = h[h.length - 1] >= h[0]; const col = up ? '#34d399' : '#fb7185';
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-24" preserveAspectRatio="none" role="img" aria-label="Price">
      <polygon points={`${p},${H - p} ${line} ${W - p},${H - p}`} fill={col} opacity={0.08} />
      <polyline points={line} fill="none" stroke={col} strokeWidth={2} vectorEffect="non-scaling-stroke" strokeLinejoin="round" />
    </svg>
  );
}

function Bar({ v, color }: { v: number; color: string }) {
  return (<div className="h-1.5 w-full bg-slate-800 rounded-full overflow-hidden"><div className={`h-full ${color} rounded-full`} style={{ width: `${clamp(v, 0, 1) * 100}%` }} /></div>);
}

export default function AgentDemo() {
  const [sim, setSim] = useState<Sim>(initSim);
  const [volIdx, setVolIdx] = useState(2);
  const [playing, setPlaying] = useState(true);
  const [sel, setSel] = useState('panic-seller');
  const [hov, setHov] = useState<string | null>(null);
  const [pendingEvent, setPendingEvent] = useState<{ moveMultiplier: number; text: string } | null>(null);

  const volRef = useRef(volIdx); volRef.current = volIdx;

  useEffect(() => {
    if (!playing) return;
    const id = setInterval(() => {
      setSim((p) => {
        const next = step(p, volRef.current, pendingEvent);
        if (pendingEvent) setPendingEvent(null);
        return next;
      });
    }, 1300);
    return () => clearInterval(id);
  }, [playing, pendingEvent]);

  const reset = useCallback(() => setSim(initSim()), []);

  const injectEvent = (moveMultiplier: number, text: string) => {
    setPendingEvent({ moveMultiplier, text });
  };

  const agent = AGENTS.find((a) => a.key === sel)!; const st = sim.agents[sel];
  const board = [...AGENTS].sort((a, b) => sim.agents[b.key].equity - sim.agents[a.key].equity);
  const movePct = sim.move * 100, eqPct = st.equity - 100;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-200 font-sans antialiased relative">
      <div className="absolute top-0 left-0 w-full h-[420px] bg-gradient-to-b from-indigo-900/10 via-purple-900/5 to-transparent pointer-events-none" />
      <header className="border-b border-slate-800/80 bg-slate-900/50 backdrop-blur sticky top-0 z-40">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/" className="text-lg font-bold text-white">Psychosynth</Link>
            <span className="text-[10px] font-mono bg-indigo-500/10 text-indigo-300 px-2 py-0.5 rounded-full border border-indigo-500/20">Live Agent Simulation</span>
          </div>
          <div className="flex items-center gap-4">
            <Link href="/explore" className="text-xs text-indigo-400 hover:text-indigo-300 font-semibold font-mono">Data Explorer &rarr;</Link>
            <Link href="/docs" className="text-xs text-slate-400 hover:text-slate-200">API Docs &rarr;</Link>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-10 space-y-6 relative z-10">
        <div className="space-y-2 max-w-2xl">
          <h1 className="text-3xl font-extrabold tracking-tight text-white">Same market. Eight psychometric minds.</h1>
          <p className="text-sm text-slate-400 leading-relaxed">
            Watch psychometrically conditioned agent profiles execute actions on a live feed. Inject custom market shocks below to observe behavioral divergence in real-time.
          </p>
        </div>

        {/* Interactive Control Panel */}
        <div className="space-y-3 bg-slate-900/60 border border-slate-800/80 p-4 rounded-2xl backdrop-blur-md">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-1.5 bg-slate-950 p-1 rounded-xl border border-slate-800">
              <span className="text-[10px] text-slate-500 font-mono px-2 uppercase font-bold">Volatility:</span>
              {VOL.map((v, i) => (
                <button
                  key={v.key}
                  onClick={() => setVolIdx(i)}
                  className={`text-xs px-3 py-1.5 rounded-lg font-semibold transition ${
                    volIdx === i
                      ? i >= 2 ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30' : 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/30'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  {v.label}
                </button>
              ))}
            </div>

            <div className="flex items-center gap-2">
              <button onClick={() => setPlaying((p) => !p)} className="text-xs px-4 py-2 rounded-xl font-semibold bg-slate-900 border border-slate-800 hover:border-slate-700 text-white shadow-md">
                {playing ? '❚❚ Pause' : '▶ Play'}
              </button>
              <button onClick={reset} className="text-xs px-4 py-2 rounded-xl font-semibold bg-slate-900 border border-slate-800 hover:border-slate-700 text-slate-400 hover:text-white">
                Reset
              </button>
              <span className="text-[11px] font-mono text-slate-500">tick {sim.tick}</span>
            </div>
          </div>

          {/* Interactive Shock Injectors */}
          <div className="pt-2 border-t border-slate-800/60 flex items-center gap-2 flex-wrap">
            <span className="text-[10px] text-slate-400 font-mono font-bold uppercase shrink-0">Inject Live Market Event:</span>
            <button
              onClick={() => injectEvent(-0.15, '⚡ FLASH CRASH (-15% Liquidation)')}
              className="text-xs px-3 py-1 rounded-lg bg-rose-500/10 border border-rose-500/30 text-rose-300 hover:bg-rose-500/20 font-mono font-semibold"
            >
              ⚡ Flash Crash (-15%)
            </button>
            <button
              onClick={() => injectEvent(0.12, '🚀 PARABOLIC RALLY (+12% Euphoria)')}
              className="text-xs px-3 py-1 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 hover:bg-emerald-500/20 font-mono font-semibold"
            >
              🚀 Parabolic Rally (+12%)
            </button>
            <button
              onClick={() => injectEvent(-0.25, '🏦 BANK RUN / WHALE DUMP (-25%)')}
              className="text-xs px-3 py-1 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-300 hover:bg-amber-500/20 font-mono font-semibold"
            >
              🏦 Whale Dump (-25%)
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Floor */}
          <div className="lg:col-span-2 rounded-2xl border border-slate-800/80 bg-slate-900/40 p-5 backdrop-blur-md">
            <div className="flex items-baseline justify-between mb-1">
              <h3 className="text-sm font-bold text-white">The Floor — one market, eight minds</h3>
              <span className="text-[10px] text-slate-500 font-mono">position = current risk stance</span>
            </div>
            <Floor sim={sim} sel={sel} onSel={setSel} hov={hov} setHov={setHov} />
            <div className="flex flex-wrap gap-x-4 gap-y-1 text-[10px] text-slate-400 mt-1">
              <span className="inline-flex items-center gap-1.5"><span className="h-2 w-2 rounded-full" style={{ background: ACT_HEX.BUY }} />Buying / adding</span>
              <span className="inline-flex items-center gap-1.5"><span className="h-2 w-2 rounded-full" style={{ background: ACT_HEX.TRIM }} />Trimming</span>
              <span className="inline-flex items-center gap-1.5"><span className="h-2 w-2 rounded-full" style={{ background: ACT_HEX.SELL }} />Selling / stopped out</span>
              <span className="inline-flex items-center gap-1.5"><span className="h-2 w-2 rounded-full" style={{ background: ACT_HEX.HOLD }} />Holding</span>
            </div>
          </div>

          {/* Price + spotlight */}
          <div className="space-y-6">
            <div className="rounded-2xl border border-slate-800/80 bg-slate-900/40 p-5 backdrop-blur-md">
              <div className="flex items-end justify-between">
                <div><span className="text-[10px] uppercase tracking-widest text-slate-500 font-mono">SYNTH/USDC</span><div className="text-2xl font-bold text-white font-mono">{sim.price.toFixed(2)}</div></div>
                <span className={`font-mono font-bold text-sm ${movePct >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>{movePct >= 0 ? '▲' : '▼'} {movePct.toFixed(2)}%</span>
              </div>
              <Price sim={sim} />
              {sim.event && <div className="text-[11px] font-semibold text-amber-300 bg-amber-500/10 border border-amber-500/20 rounded-lg px-2.5 py-1">⚡ {sim.event}</div>}
            </div>

            <div className="rounded-2xl border border-indigo-500/20 bg-gradient-to-br from-indigo-500/[0.06] via-slate-900/50 to-slate-900/50 p-5 backdrop-blur-md space-y-4">
              <div className="flex items-start justify-between gap-3">
                <div><h2 className="text-base font-bold text-white leading-tight">{agent.name}</h2><p className="text-[11px] text-slate-400">{agent.tagline}</p></div>
                <span className={`px-3 py-1.5 rounded-lg border text-sm font-extrabold font-mono ${ACT_CLASS[st.action]}`}>{st.action}</span>
              </div>
              <p className="text-xs text-slate-300">It {st.verb}. <span className="text-slate-500 italic">Tell: {pick(agent.tells)} — amplifies {agent.bias}.</span></p>
              <div className="grid grid-cols-2 gap-3 text-[10px] font-mono">
                <div className="space-y-1"><div className="flex justify-between"><span className="text-slate-500">EMOTION</span><span className="text-fuchsia-300">{st.emotion}</span></div><div className="flex justify-between"><span className="text-slate-500">CONF</span><span className="text-slate-300">{(st.conf * 100).toFixed(0)}%</span></div><Bar v={st.conf} color="bg-indigo-400" /></div>
                <div className="space-y-1"><div className="flex justify-between"><span className="text-slate-500">P&amp;L</span><span className={eqPct >= 0 ? 'text-emerald-400' : 'text-rose-400'}>{eqPct >= 0 ? '+' : ''}{eqPct.toFixed(1)}%</span></div><div className="flex justify-between"><span className="text-slate-500">EXPOSURE</span><span className="text-slate-300">{(st.pos * 100).toFixed(0)}%</span></div><Bar v={st.pos / 1.5} color="bg-emerald-400" /></div>
              </div>
              <div className="grid grid-cols-5 gap-1.5 pt-1">
                {([['O', agent.bf.o], ['C', agent.bf.c], ['E', agent.bf.e], ['A', agent.bf.a], ['N', agent.bf.n]] as [string, number][]).map(([k, val]) => (<div key={k} className="space-y-1"><div className="flex justify-between text-[8px] font-mono text-slate-500"><span>{k}</span><span>{val.toFixed(2)}</span></div><Bar v={val} color="bg-indigo-500/70" /></div>))}
              </div>
            </div>
          </div>
        </div>

        {/* Equity + leaderboard */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 rounded-2xl border border-slate-800/80 bg-slate-900/40 p-5 backdrop-blur-md">
            <div className="flex items-baseline justify-between mb-1"><h3 className="text-sm font-bold text-white">Equity — divergence over time</h3><span className="text-[10px] text-slate-500 font-mono">same prices, different outcomes</span></div>
            <Equity sim={sim} sel={sel} />
          </div>
          <div className="space-y-2">
            <div className="flex items-baseline justify-between"><h3 className="text-sm font-bold text-white">Live board</h3><span className="text-[10px] text-slate-500 font-mono">by P&amp;L</span></div>
            {board.map((a) => { const s = sim.agents[a.key]; const pnl = s.equity - 100; const active = a.key === sel; return (
              <button key={a.key} onClick={() => setSel(a.key)} onMouseEnter={() => setHov(a.key)} onMouseLeave={() => setHov(null)} className={`w-full text-left rounded-xl border px-3 py-2 transition flex items-center gap-2.5 ${active ? 'border-indigo-500/40 bg-indigo-500/10' : 'border-slate-800/70 bg-slate-900/40 hover:border-slate-700'}`}>
                <span className="h-2 w-2 rounded-full shrink-0" style={{ background: ACT_HEX[s.action] }} />
                <div className="min-w-0 flex-1"><span className={`text-xs font-bold truncate ${active ? 'text-white' : 'text-slate-300'}`}>{a.name}</span><div className="text-[10px] text-slate-500 font-mono truncate">{s.action} · {s.verb}</div></div>
                <span className={`text-xs font-bold font-mono shrink-0 ${pnl >= 0 ? 'text-emerald-400' : 'text-rose-400'}`} style={{ fontVariantNumeric: 'tabular-nums' }}>{pnl >= 0 ? '+' : ''}{pnl.toFixed(1)}%</span>
              </button>); })}
            <div className="text-[11px] text-slate-500 leading-relaxed pt-1">Each row is a real profile shape from the catalog. <Link href="/docs" className="text-indigo-400 hover:text-indigo-300 font-semibold">Get the data via API &rarr;</Link></div>
          </div>
        </div>
      </main>
    </div>
  );
}
