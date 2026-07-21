'use client';

// Live Agent Command Center — every psychometric archetype trades the SAME live market
// at once. The 2D "Floor" shows them fanning apart by behavior + P&L; the equity
// panel shows outcomes diverging over time. Same model that generated the dataset.

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
  { key: 'meme-chaser', name: 'Meme Chaser', react: 'chase', cap: 1.4, tagline: 'Trades the feed, not the thesis', bf: { o: .85, c: .30, e: .76, a: .46, n: .60 }, dt: { m: .42, n: .66, p: .44 }, lambda: 1.4, bias: 'FOMO', tells: ['glued to social feeds', 'can’t sit flat', 'buys high-momentum tickers'] },
  { key: 'risk-manager', name: 'Risk Manager', react: 'rules', cap: 1.0, tagline: 'Survival is job one', bf: { o: .58, c: .86, e: .40, a: .54, n: .34 }, dt: { m: .28, n: .24, p: .18 }, lambda: 2.4, bias: 'zero-risk', tells: ['thinks in R-multiples', 'sleeps fine flat', 'cuts fast and small'] },
  { key: 'panic-seller', name: 'Panic Seller', react: 'panic', cap: 0.9, tagline: 'Bails at the first red candle', bf: { o: .45, c: .38, e: .42, a: .55, n: .80 }, dt: { m: .32, n: .30, p: .20 }, lambda: 2.7, bias: 'loss-aversion', tells: ['checks P&L compulsively', 'freezes during severe drawdowns', 'dumps position at bottom'] },
  { key: 'revenge-trader', name: 'Revenge Trader', react: 'chase', cap: 1.5, tagline: 'Trades to get even with the market', bf: { o: .55, c: .30, e: .62, a: .38, n: .76 }, dt: { m: .55, n: .62, p: .58 }, lambda: 2.5, bias: 'sunk-cost', tells: ['sizes up immediately after loss', 'doubles down on losers', 'fights short-term trend'] },
  { key: 'disciplined-swing', name: 'Disciplined Swing', react: 'rules', cap: 1.0, tagline: 'Rules over feelings', bf: { o: .60, c: .82, e: .45, a: .52, n: .34 }, dt: { m: .30, n: .34, p: .22 }, lambda: 1.9, bias: 'confirmation', tells: ['journals every trade entry', 'honors hard stop-loss', 'trims into strength'] },
  { key: 'diamond-hands', name: 'Diamond Hands', react: 'hold', cap: 1.1, tagline: 'Never sells at a loss', bf: { o: .60, c: .62, e: .48, a: .52, n: .44 }, dt: { m: .34, n: .50, p: .28 }, lambda: 2.6, bias: 'endowment', tells: ['wears drawdown as a badge', 'anchors to original entry price', 'buys dips aggressively'] },
  { key: 'conservative-hodler', name: 'Conservative Hodler', react: 'hold', cap: 0.8, tagline: 'Buys quality, tunes out market noise', bf: { o: .44, c: .80, e: .36, a: .62, n: .30 }, dt: { m: .24, n: .26, p: .16 }, lambda: 2.2, bias: 'status-quo', tells: ['checks portfolio quarterly', 'sits through high volatility', 'accumulates very slowly'] },
  { key: 'options-gambler', name: 'Options Gambler', react: 'chase', cap: 1.5, tagline: 'Swings for high-gamma moonshots', bf: { o: .80, c: .34, e: .70, a: .36, n: .64 }, dt: { m: .58, n: .70, p: .62 }, lambda: 1.3, bias: 'overconfidence', tells: ['treats variance as pure skill', 'presses leverage on win streaks', 'remembers only massive wins'] },
];

type Bucket = 'crash' | 'dip' | 'rip' | 'drift' | 'shock';
const TABLE: Record<Disposition, Record<Bucket, [string, string, string]>> = {
  panic: { crash: ['SELL', 'dumps into liquidations', 'panic'], dip: ['TRIM', 'trims nervously on wobble', 'anxious'], rip: ['HOLD', 'watches from sidelines', 'wary'], drift: ['HOLD', 'waits uneasy', 'tense'], shock: ['CUT', 'panic-exits all risk', 'terrified'] },
  chase: { crash: ['ADD', 'buys dip with high leverage', 'greed'], dip: ['BUY', 'steps in early on dip', 'eager'], rip: ['ADD', 'piles into vertical rally', 'euphoria'], drift: ['BUY', 'bored — opens long position', 'restless'], shock: ['ADD', 'takes extreme leverage', 'mania'] },
  hold: { crash: ['HOLD', 'sits stoically through red', 'stoic'], dip: ['HOLD', 'ignores minor price noise', 'calm'], rip: ['TRIM', 'shaves small slice', 'content'], drift: ['HOLD', 'does nothing', 'unmoved'], shock: ['HOLD', 'tunes out market panic', 'resilient'] },
  rules: { crash: ['CUT', 'honors hard stop-loss', 'composed'], dip: ['HOLD', 'remains within risk limit', 'composed'], rip: ['TRIM', 'takes target profit by rule', 'disciplined'], drift: ['HOLD', 'no setup signal, no trade', 'patient'], shock: ['TRIM', 'reduces exposure into stress', 'composed'] },
};
const DELTA: Record<string, number> = { BUY: +0.3, ADD: +0.5, HOLD: 0, TRIM: -0.3, SELL: -0.6, CUT: -1.0 };

const ACT_HEX: Record<string, string> = { BUY: '#34d399', ADD: '#34d399', HOLD: '#94a3b8', TRIM: '#fbbf24', SELL: '#fb7185', CUT: '#fb7185' };
const ACT_CLASS: Record<string, string> = {
  BUY: 'text-emerald-300 bg-emerald-500/10 border-emerald-500/30', ADD: 'text-emerald-300 bg-emerald-500/10 border-emerald-500/30',
  HOLD: 'text-slate-300 bg-slate-500/10 border-slate-500/30', TRIM: 'text-amber-300 bg-amber-500/10 border-amber-500/30',
  SELL: 'text-rose-300 bg-rose-500/10 border-rose-500/30', CUT: 'text-rose-300 bg-rose-500/10 border-rose-500/30',
};
const SURFACE = '#020617', HILITE = '#818cf8', BASE = '#64748b', CTX = '#334155', GRID = '#1e293b', TICK = '#64748b';

type RegimeKey = 'bull' | 'bear' | 'range' | 'chaos';
interface RegimeConfig { label: string; sigma: number; drift: number; shock: number; desc: string; }
const REGIMES: Record<RegimeKey, RegimeConfig> = {
  bull: { label: 'Bull Market (Greed Loop)', sigma: 0.012, drift: 0.0018, shock: 0.02, desc: 'Persistent upward drift, high optimism, rare crashes' },
  range: { label: 'Range Bound (Chop)', sigma: 0.008, drift: 0.0001, shock: 0.01, desc: 'Zero drift, low noise, whipsaws trend chasers' },
  bear: { label: 'Bear Market (Liquidation Loop)', sigma: 0.025, drift: -0.0022, shock: 0.08, desc: 'Heavy downward drift, frequent flash panics' },
  chaos: { label: 'Chaos Engine (High Vol)', sigma: 0.045, drift: -0.0005, shock: 0.16, desc: 'Extreme volatility, frequent black swan events' },
};

const LEN = 80;
const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n));
const pick = <T,>(a: T[]) => a[Math.floor(Math.random() * a.length)];

interface AState { pos: number; equity: number; action: string; verb: string; emotion: string; conf: number; trail: [number, number][]; }
interface LogEntry { id: string; time: string; agentKey: string; agentName: string; action: string; text: string; emotion: string; }
interface EventMarker { tick: number; text: string; move: number; }
interface Sim {
  price: number; history: number[]; move: number; event: string | null; tick: number;
  baseline: number; baseHist: number[];
  agents: Record<string, AState>; eqHist: Record<string, number[]>;
  logs: LogEntry[]; events: EventMarker[]; regime: RegimeKey;
}

function initSim(regime: RegimeKey = 'range'): Sim {
  const agents: Record<string, AState> = {}; const eqHist: Record<string, number[]> = {};
  for (const a of AGENTS) {
    agents[a.key] = { pos: 0.5, equity: 100, action: 'HOLD', verb: 'sizing up the tape', emotion: 'neutral', conf: 0.6, trail: [[0.5, 100]] };
    eqHist[a.key] = [100];
  }
  return { price: 100, history: [100], move: 0, event: null, tick: 0, baseline: 100, baseHist: [100], agents, eqHist, logs: [], events: [], regime };
}

function step(prev: Sim, customEventOverride: { moveMultiplier: number; text: string } | null): Sim {
  const r = REGIMES[prev.regime];
  let move = (r.drift + ((Math.random() + Math.random() + Math.random() - 1.5) / 1.5) * r.sigma);
  let event: string | null = null;

  if (customEventOverride) {
    move = customEventOverride.moveMultiplier;
    event = customEventOverride.text;
  } else if (Math.random() < r.shock) {
    const kind = pick(['margin', 'crash', 'rip']);
    if (kind === 'margin') event = 'Margin Call Cascade';
    else if (kind === 'crash') { move = -Math.abs(r.sigma * 3.2 + 0.03); event = 'Flash Crash (-' + Math.abs(move * 100).toFixed(0) + '%)'; }
    else { move = Math.abs(r.sigma * 3.2 + 0.03); event = 'Parabolic Run (+' + Math.abs(move * 100).toFixed(0) + '%)'; }
  }

  const price = Math.max(1, prev.price * (1 + move));
  const history = [...prev.history, price].slice(-LEN);
  const baseline = prev.baseline * (1 + move);
  const baseHist = [...prev.baseHist, baseline].slice(-LEN);
  const bucket: Bucket = event?.startsWith('Margin') ? 'shock' : move <= -0.03 ? 'crash' : move < 0 ? 'dip' : move >= 0.03 ? 'rip' : 'drift';

  const newEvents = event ? [...prev.events, { tick: prev.tick + 1, text: event, move }].slice(-10) : prev.events;
  const newLogs = [...prev.logs];
  const timeStr = new Date().toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' });

  const agents: Record<string, AState> = {}; const eqHist: Record<string, number[]> = {};
  for (const a of AGENTS) {
    const s = prev.agents[a.key];
    const equity = s.equity * (1 + s.pos * move);
    const [action, verb, emotion] = TABLE[a.react][bucket];
    const pos = clamp(s.pos + (DELTA[action] ?? 0), 0, a.cap);
    const conf = clamp((a.react === 'rules' ? 0.78 : a.react === 'panic' ? 0.5 : a.react === 'chase' ? 0.7 : 0.68) + (Math.random() * 0.2 - 0.1), 0.2, 0.99);
    
    const trail = [...s.trail, [pos, equity] as [number, number]].slice(-8);
    agents[a.key] = { pos, equity, action, verb, emotion, conf, trail };
    eqHist[a.key] = [...prev.eqHist[a.key], equity].slice(-LEN);

    // Log significant actions or events
    if (action !== s.action || event || Math.random() < 0.12) {
      const thoughtText = `${a.name} [${a.bias}] ${action}s — ${verb} (Emotion: ${emotion})`;
      newLogs.unshift({
        id: Math.random().toString(36).substring(2, 9),
        time: timeStr,
        agentKey: a.key,
        agentName: a.name,
        action,
        text: thoughtText,
        emotion
      });
    }
  }

  return { price, history, move, event, tick: prev.tick + 1, baseline, baseHist, agents, eqHist, logs: newLogs.slice(0, 30), events: newEvents, regime: prev.regime };
}

// Dual Radar Chart Component (OCEAN in Cyan + Dark Triad in Rose)
function DualRadarChart({ agent }: { agent: Agent }) {
  const W = 180, H = 180, cx = 90, cy = 90, r = 60;
  
  // OCEAN 5 axes
  const oceanKeys: (keyof typeof agent.bf)[] = ['o', 'c', 'e', 'a', 'n'];
  const oceanLabels = ['O', 'C', 'E', 'A', 'N'];
  const oceanPts = oceanKeys.map((k, i) => {
    const angle = -Math.PI / 2 + (i * 2 * Math.PI) / 5;
    const v = agent.bf[k];
    return {
      x: cx + r * v * Math.cos(angle),
      y: cy + r * v * Math.sin(angle),
      lx: cx + (r + 14) * Math.cos(angle),
      ly: cy + (r + 14) * Math.sin(angle),
      label: oceanLabels[i],
      val: v
    };
  });
  const oceanPoly = oceanPts.map(p => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ');

  // Dark Triad 3 axes (Machiavellianism, Narcissism, Psychopathy)
  const dtKeys: (keyof typeof agent.dt)[] = ['m', 'n', 'p'];
  const dtLabels = ['Mach', 'Narc', 'Psych'];
  const dtPts = dtKeys.map((k, i) => {
    const angle = -Math.PI / 2 + (i * 2 * Math.PI) / 3;
    const v = agent.dt[k];
    return {
      x: cx + r * v * Math.cos(angle),
      y: cy + r * v * Math.sin(angle),
      lx: cx + (r + 14) * Math.cos(angle),
      ly: cy + (r + 14) * Math.sin(angle),
      label: dtLabels[i],
      val: v
    };
  });
  const dtPoly = dtPts.map(p => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ');

  return (
    <div className="relative flex flex-col items-center">
      <svg viewBox={`0 0 ${W} ${H}`} className="w-44 h-44">
        {/* Pentagon grid rings */}
        {[0.33, 0.66, 1.0].map((ring, idx) => {
          const ringPts = oceanKeys.map((_, i) => {
            const angle = -Math.PI / 2 + (i * 2 * Math.PI) / 5;
            return `${(cx + r * ring * Math.cos(angle)).toFixed(1)},${(cy + r * ring * Math.sin(angle)).toFixed(1)}`;
          }).join(' ');
          return <polygon key={idx} points={ringPts} fill="none" stroke="#1e293b" strokeWidth="1" strokeDasharray={ring === 1.0 ? 'none' : '2,2'} />;
        })}
        {/* Axis spokes */}
        {oceanPts.map((p, i) => (
          <line key={i} x1={cx} y1={cy} x2={p.lx} y2={p.ly} stroke="#334155" strokeWidth="0.8" />
        ))}
        {/* OCEAN Polygon */}
        <polygon points={oceanPoly} fill="rgba(129, 140, 248, 0.25)" stroke="#818cf8" strokeWidth="1.8" />
        {oceanPts.map((p, i) => (
          <circle key={'op' + i} cx={p.x} cy={p.y} r="2.5" fill="#818cf8" />
        ))}
        {/* Dark Triad Polygon */}
        <polygon points={dtPoly} fill="rgba(251, 113, 133, 0.25)" stroke="#fb7185" strokeWidth="1.8" />
        {dtPts.map((p, i) => (
          <circle key={'dp' + i} cx={p.x} cy={p.y} r="2.5" fill="#fb7185" />
        ))}
        {/* Axis Labels */}
        {oceanPts.map((p, i) => (
          <text key={'lbl' + i} x={p.lx} y={p.ly + 3} fill="#94a3b8" fontSize="8.5" fontFamily="monospace" textAnchor="middle" fontWeight="bold">
            {p.label}
          </text>
        ))}
      </svg>
      <div className="flex items-center gap-3 text-[9px] font-mono text-slate-400 mt-1">
        <span className="inline-flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-indigo-400 inline-block" /> Big Five (OCEAN)</span>
        <span className="inline-flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-rose-400 inline-block" /> Dark Triad (SD3)</span>
      </div>
    </div>
  );
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
      {/* Background Quadrant Overlay Labels */}
      <rect x={l + pw * 0.5} y={t} width={pw * 0.5} height={ph * 0.45} fill="rgba(244, 63, 94, 0.03)" rx="8" />
      <text x={l + pw * 0.96} y={t + 16} fill="#fb7185" fontSize="8" fontFamily="monospace" textAnchor="end" opacity="0.6">🚨 DANGER ZONE (High Risk)</text>
      
      <rect x={l} y={t + ph * 0.55} width={pw * 0.4} height={ph * 0.45} fill="rgba(52, 211, 153, 0.03)" rx="8" />
      <text x={l + 8} y={t + ph - 8} fill="#34d399" fontSize="8" fontFamily="monospace" textAnchor="start" opacity="0.6">🛡️ SANCTUARY (Low Risk)</text>

      {xticks.map((x) => (<line key={x} x1={X(x)} y1={t} x2={X(x)} y2={t + ph} stroke={GRID} strokeWidth={1} />))}
      {xticks.map((x) => (<text key={'xl' + x} x={X(x)} y={H - 16} fill={TICK} fontSize={9} textAnchor="middle">{(x * 100).toFixed(0)}%</text>))}
      {Array.from({ length: yn + 1 }, (_, i) => { const val = emx - (i / yn) * erg; const gy = t + (i / yn) * ph; return (<g key={'y' + i}><line x1={l} y1={gy} x2={l + pw} y2={gy} stroke={GRID} strokeWidth={1} /><text x={l - 6} y={gy + 3} fill={TICK} fontSize={9} textAnchor="end">{val >= 0 ? '+' : ''}{val.toFixed(0)}%</text></g>); })}
      <line x1={l} y1={Y(0)} x2={l + pw} y2={Y(0)} stroke="#334155" strokeWidth={1.2} />
      <text x={l + pw / 2} y={H - 2} fill="#94a3b8" fontSize={10} textAnchor="middle">Exposure — risk stance taken →</text>
      <text transform={`translate(12 ${t + ph / 2}) rotate(-90)`} fill="#94a3b8" fontSize={10} textAnchor="middle">P&amp;L % →</text>

      {/* Trailing Paths for Agents */}
      {AGENTS.map((a) => {
        const s = sim.agents[a.key];
        if (!s.trail || s.trail.length < 2) return null;
        const points = s.trail.map(([pos, eq]) => `${X(pos)},${Y(eq - 100)}`).join(' ');
        const isSel = a.key === sel;
        return (
          <polyline
            key={'tr-' + a.key}
            points={points}
            fill="none"
            stroke={isSel ? HILITE : ACT_HEX[s.action]}
            strokeWidth={isSel ? 2 : 1}
            strokeDasharray={isSel ? 'none' : '2,2'}
            opacity={isSel ? 0.7 : 0.3}
          />
        );
      })}

      {AGENTS.map((a) => {
        const s = sim.agents[a.key]; const x = X(s.pos), y = Y(s.equity - 100);
        const isSel = a.key === sel, isHov = a.key === hov;
        return (
          <g key={a.key} transform={`translate(${x} ${y})`} style={{ transition: 'transform 0.8s ease-out', cursor: 'pointer' }}
            onMouseEnter={() => setHov(a.key)} onMouseLeave={() => setHov(null)} onClick={() => onSel(a.key)}>
            {isSel && <circle r={11} fill="none" stroke={HILITE} strokeWidth={1.5} opacity={0.8} className="animate-pulse" />}
            <circle r={isSel ? 6.5 : 5.5} fill={ACT_HEX[s.action]} stroke={SURFACE} strokeWidth={2} />
            {(isSel || isHov) && (
              <g><rect x={9} y={-9} width={a.name.length * 5.6 + 10} height={16} rx={4} fill="#0f172a" stroke="rgba(255,255,255,0.12)" /><text x={14} y={2} fill="#fff" fontSize={9.5} fontWeight={600}>{a.name}</text></g>
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

// Sentiment Gauge Component
function SentimentGauge({ sim }: { sim: Sim }) {
  const actions = AGENTS.map(a => sim.agents[a.key].action);
  const bullishCount = actions.filter(act => act === 'BUY' || act === 'ADD').length;
  const bearishCount = actions.filter(act => act === 'SELL' || act === 'CUT').length;
  const neutralCount = actions.length - bullishCount - bearishCount;
  const sentimentPct = Math.round((bullishCount / actions.length) * 100);

  return (
    <div className="bg-slate-900/60 border border-slate-800/80 rounded-2xl p-4 backdrop-blur-md space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-[10px] text-slate-400 font-mono font-bold uppercase tracking-wider">Floor Sentiment Dial</span>
        <span className="text-xs font-mono font-bold text-indigo-300">{sentimentPct}% Bullish</span>
      </div>
      <div className="h-2.5 w-full bg-slate-950 rounded-full flex overflow-hidden p-0.5 border border-slate-800">
        <div style={{ width: `${(bullishCount / 8) * 100}%` }} className="bg-emerald-400 h-full rounded-l-full transition-all duration-500" />
        <div style={{ width: `${(neutralCount / 8) * 100}%` }} className="bg-slate-500 h-full transition-all duration-500" />
        <div style={{ width: `${(bearishCount / 8) * 100}%` }} className="bg-rose-400 h-full rounded-r-full transition-all duration-500" />
      </div>
      <div className="flex justify-between text-[9px] font-mono text-slate-400 pt-0.5">
        <span className="text-emerald-400">{bullishCount} Buying</span>
        <span className="text-slate-400">{neutralCount} Holding</span>
        <span className="text-rose-400">{bearishCount} Dumping</span>
      </div>
    </div>
  );
}

export default function AgentDemo() {
  const [regime, setRegime] = useState<RegimeKey>('range');
  const [sim, setSim] = useState<Sim>(() => initSim('range'));
  const [playing, setPlaying] = useState(true);
  const [sel, setSel] = useState('panic-seller');
  const [hov, setHov] = useState<string | null>(null);
  const [pendingEvent, setPendingEvent] = useState<{ moveMultiplier: number; text: string } | null>(null);
  
  // Custom scenario builder state
  const [showCustomModal, setShowCustomModal] = useState(false);
  const [customMagnitude, setCustomMagnitude] = useState(-0.20);
  const [customNarrative, setCustomNarrative] = useState('Exchange Insolvency Rumor');

  // Commercial API modal state
  const [showApiModal, setShowApiModal] = useState(false);

  // View mode state (Grid vs Duel)
  const [viewMode, setViewMode] = useState<'grid' | 'duel'>('grid');
  const [duelA, setDuelA] = useState('risk-manager');
  const [duelB, setDuelB] = useState('revenge-trader');

  useEffect(() => {
    if (!playing) return;
    const id = setInterval(() => {
      setSim((p) => {
        const next = step(p, pendingEvent);
        if (pendingEvent) setPendingEvent(null);
        return next;
      });
    }, 1300);
    return () => clearInterval(id);
  }, [playing, pendingEvent]);

  const reset = useCallback(() => setSim(initSim(regime)), [regime]);

  const handleRegimeChange = (r: RegimeKey) => {
    setRegime(r);
    setSim(initSim(r));
  };

  const injectEvent = (moveMultiplier: number, text: string) => {
    setPendingEvent({ moveMultiplier, text });
  };

  const triggerCustomScenario = () => {
    injectEvent(customMagnitude, `⚡ ${customNarrative.toUpperCase()} (${(customMagnitude * 100).toFixed(0)}%)`);
    setShowCustomModal(false);
  };

  const agent = AGENTS.find((a) => a.key === sel)!; const st = sim.agents[sel];
  const board = [...AGENTS].sort((a, b) => sim.agents[b.key].equity - sim.agents[a.key].equity);
  const movePct = sim.move * 100, eqPct = st.equity - 100;

  // Background glow selector based on market move/event
  const bgGlow = sim.move <= -0.03 || sim.event?.includes('Crash') || sim.event?.includes('Dump')
    ? 'from-rose-950/20 via-slate-950 to-slate-950'
    : sim.move >= 0.03 || sim.event?.includes('Rally') || sim.event?.includes('Parabolic')
    ? 'from-emerald-950/20 via-slate-950 to-slate-950'
    : 'from-indigo-900/10 via-slate-950 to-slate-950';

  return (
    <div className={`min-h-screen bg-slate-950 text-slate-200 font-sans antialiased relative transition-colors duration-1000 bg-gradient-to-b ${bgGlow}`}>
      <header className="border-b border-slate-800/80 bg-slate-900/50 backdrop-blur sticky top-0 z-40">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/" className="text-lg font-bold text-white">Psychosynth</Link>
            <span className="text-[10px] font-mono bg-indigo-500/10 text-indigo-300 px-2 py-0.5 rounded-full border border-indigo-500/20">Live Simulation Engine</span>
          </div>
          <div className="flex items-center gap-4">
            <button onClick={() => setShowApiModal(true)} className="text-xs text-amber-400 hover:text-amber-300 font-semibold font-mono bg-amber-500/10 border border-amber-500/20 px-2.5 py-1 rounded-lg">
              ⚡ API Access &rarr;
            </button>
            <Link href="/explore" className="text-xs text-indigo-400 hover:text-indigo-300 font-semibold font-mono">Explore Catalog &rarr;</Link>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-8 space-y-6 relative z-10">
        {/* Header & Controls Bar */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1">
            <h1 className="text-2xl font-extrabold tracking-tight text-white flex items-center gap-2">
              Psychometric AI Trading Floor
            </h1>
            <p className="text-xs text-slate-400 leading-relaxed">
              Eight archetypal agent minds trading the same live feed. Observe behavioral divergence in real time.
            </p>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {/* View Mode Toggle */}
            <div className="bg-slate-900 border border-slate-800 p-1 rounded-xl flex items-center gap-1">
              <button
                onClick={() => setViewMode('grid')}
                className={`text-xs px-3 py-1 rounded-lg font-semibold transition ${viewMode === 'grid' ? 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/30' : 'text-slate-400 hover:text-slate-200'}`}
              >
                Grid View
              </button>
              <button
                onClick={() => setViewMode('duel')}
                className={`text-xs px-3 py-1 rounded-lg font-semibold transition ${viewMode === 'duel' ? 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/30' : 'text-slate-400 hover:text-slate-200'}`}
              >
                ⚔️ Duel Mode
              </button>
            </div>

            <button onClick={() => setPlaying((p) => !p)} className="text-xs px-3.5 py-1.5 rounded-xl font-semibold bg-slate-900 border border-slate-800 hover:border-slate-700 text-white shadow-md">
              {playing ? '❚❚ Pause' : '▶ Play'}
            </button>
            <button onClick={reset} className="text-xs px-3.5 py-1.5 rounded-xl font-semibold bg-slate-900 border border-slate-800 hover:border-slate-700 text-slate-400 hover:text-white">
              Reset
            </button>
          </div>
        </div>

        {/* Interactive Control Panel */}
        <div className="space-y-3 bg-slate-900/60 border border-slate-800/80 p-4 rounded-2xl backdrop-blur-md">
          <div className="flex flex-wrap items-center justify-between gap-3">
            {/* Regime Selector */}
            <div className="flex items-center gap-1.5 bg-slate-950 p-1 rounded-xl border border-slate-800 flex-wrap">
              <span className="text-[10px] text-slate-500 font-mono px-2 uppercase font-bold">Market Regime:</span>
              {(Object.keys(REGIMES) as RegimeKey[]).map((rKey) => (
                <button
                  key={rKey}
                  onClick={() => handleRegimeChange(rKey)}
                  className={`text-xs px-3 py-1 rounded-lg font-semibold transition ${
                    regime === rKey
                      ? 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/30'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  {REGIMES[rKey].label.split(' ')[0]} {REGIMES[rKey].label.split(' ')[1]}
                </button>
              ))}
            </div>

            <span className="text-[11px] font-mono text-slate-500">tick {sim.tick}</span>
          </div>

          {/* Interactive Shock Injectors */}
          <div className="pt-2 border-t border-slate-800/60 flex items-center gap-2 flex-wrap justify-between">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-[10px] text-slate-400 font-mono font-bold uppercase shrink-0">Inject Live Market Event:</span>
              <button
                onClick={() => injectEvent(-0.15, '⚡ FLASH CRASH (-15%)')}
                className="text-xs px-3 py-1 rounded-lg bg-rose-500/10 border border-rose-500/30 text-rose-300 hover:bg-rose-500/20 font-mono font-semibold"
              >
                ⚡ Flash Crash (-15%)
              </button>
              <button
                onClick={() => injectEvent(0.12, '🚀 PARABOLIC RALLY (+12%)')}
                className="text-xs px-3 py-1 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 hover:bg-emerald-500/20 font-mono font-semibold"
              >
                🚀 Parabolic Rally (+12%)
              </button>
              <button
                onClick={() => injectEvent(-0.25, '🏦 WHALE DUMP (-25%)')}
                className="text-xs px-3 py-1 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-300 hover:bg-amber-500/20 font-mono font-semibold"
              >
                🏦 Whale Dump (-25%)
              </button>
            </div>

            <button
              onClick={() => setShowCustomModal(true)}
              className="text-xs px-3 py-1 rounded-lg bg-indigo-500/10 border border-indigo-500/30 text-indigo-300 hover:bg-indigo-500/20 font-mono font-semibold"
            >
              🛠️ Custom Scenario Builder &rarr;
            </button>
          </div>
        </div>

        {/* View Mode: Head-to-Head Duel Mode */}
        {viewMode === 'duel' ? (
          <div className="space-y-6">
            <div className="bg-slate-900/40 border border-slate-800 p-5 rounded-2xl backdrop-blur-md space-y-4">
              <div className="flex flex-col sm:flex-row items-center justify-between gap-4 border-b border-slate-800/80 pb-4">
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  ⚔️ Head-to-Head Agent Duel
                </h3>
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-slate-400 font-mono">Agent A:</span>
                    <select
                      value={duelA}
                      onChange={(e) => setDuelA(e.target.value)}
                      className="bg-slate-950 border border-slate-800 text-xs font-semibold text-white rounded-lg px-2.5 py-1.5"
                    >
                      {AGENTS.map(a => <option key={a.key} value={a.key}>{a.name}</option>)}
                    </select>
                  </div>
                  <span className="text-xs text-slate-500 font-bold">VS</span>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-slate-400 font-mono">Agent B:</span>
                    <select
                      value={duelB}
                      onChange={(e) => setDuelB(e.target.value)}
                      className="bg-slate-950 border border-slate-800 text-xs font-semibold text-white rounded-lg px-2.5 py-1.5"
                    >
                      {AGENTS.map(a => <option key={a.key} value={a.key}>{a.name}</option>)}
                    </select>
                  </div>
                </div>
              </div>

              {/* Side-by-Side Comparison */}
              {(() => {
                const agA = AGENTS.find(a => a.key === duelA)!;
                const agB = AGENTS.find(a => a.key === duelB)!;
                const stA = sim.agents[duelA];
                const stB = sim.agents[duelB];
                const pnlA = stA.equity - 100;
                const pnlB = stB.equity - 100;
                const delta = pnlA - pnlB;

                return (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-2">
                    {/* Agent A Card */}
                    <div className="bg-slate-950/60 border border-indigo-500/20 p-4 rounded-xl space-y-3">
                      <div className="flex items-center justify-between">
                        <div>
                          <h4 className="text-sm font-bold text-white">{agA.name}</h4>
                          <p className="text-[10px] text-slate-400">{agA.tagline}</p>
                        </div>
                        <span className={`px-2.5 py-1 rounded-lg border text-xs font-bold font-mono ${ACT_CLASS[stA.action]}`}>
                          {stA.action}
                        </span>
                      </div>
                      <div className="flex justify-between items-baseline text-xs font-mono">
                        <span className="text-slate-400">P&amp;L:</span>
                        <span className={`font-bold ${pnlA >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                          {pnlA >= 0 ? '+' : ''}{pnlA.toFixed(1)}%
                        </span>
                      </div>
                      <p className="text-xs text-slate-300 italic">"{stA.verb}"</p>
                      <DualRadarChart agent={agA} />
                    </div>

                    {/* Agent B Card */}
                    <div className="bg-slate-950/60 border border-rose-500/20 p-4 rounded-xl space-y-3">
                      <div className="flex items-center justify-between">
                        <div>
                          <h4 className="text-sm font-bold text-white">{agB.name}</h4>
                          <p className="text-[10px] text-slate-400">{agB.tagline}</p>
                        </div>
                        <span className={`px-2.5 py-1 rounded-lg border text-xs font-bold font-mono ${ACT_CLASS[stB.action]}`}>
                          {stB.action}
                        </span>
                      </div>
                      <div className="flex justify-between items-baseline text-xs font-mono">
                        <span className="text-slate-400">P&amp;L:</span>
                        <span className={`font-bold ${pnlB >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                          {pnlB >= 0 ? '+' : ''}{pnlB.toFixed(1)}%
                        </span>
                      </div>
                      <p className="text-xs text-slate-300 italic">"{stB.verb}"</p>
                      <DualRadarChart agent={agB} />
                    </div>

                    {/* Duel Performance Delta Banner */}
                    <div className="md:col-span-2 bg-indigo-500/10 border border-indigo-500/20 p-3 rounded-xl flex items-center justify-between font-mono text-xs">
                      <span className="text-indigo-300 font-bold">PERFORMANCE SPREAD DELTA:</span>
                      <span className={`font-extrabold text-sm ${delta >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                        {agA.name} leads by {Math.abs(delta).toFixed(1)}%
                      </span>
                    </div>
                  </div>
                );
              })()}
            </div>
          </div>
        ) : (
          /* Grid View Layout */
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Floor Scatterplot */}
            <div className="lg:col-span-2 rounded-2xl border border-slate-800/80 bg-slate-900/40 p-5 backdrop-blur-md">
              <div className="flex items-baseline justify-between mb-1">
                <h3 className="text-sm font-bold text-white">The Floor — 2D Trajectory Map</h3>
                <span className="text-[10px] text-slate-500 font-mono">fading tails = recent risk movement</span>
              </div>
              <Floor sim={sim} sel={sel} onSel={setSel} hov={hov} setHov={setHov} />
              <div className="flex flex-wrap gap-x-4 gap-y-1 text-[10px] text-slate-400 mt-1">
                <span className="inline-flex items-center gap-1.5"><span className="h-2 w-2 rounded-full" style={{ background: ACT_HEX.BUY }} />Buying / adding</span>
                <span className="inline-flex items-center gap-1.5"><span className="h-2 w-2 rounded-full" style={{ background: ACT_HEX.TRIM }} />Trimming</span>
                <span className="inline-flex items-center gap-1.5"><span className="h-2 w-2 rounded-full" style={{ background: ACT_HEX.SELL }} />Selling / stopped out</span>
                <span className="inline-flex items-center gap-1.5"><span className="h-2 w-2 rounded-full" style={{ background: ACT_HEX.HOLD }} />Holding</span>
              </div>
            </div>

            {/* Price & Spotlight */}
            <div className="space-y-6">
              <div className="rounded-2xl border border-slate-800/80 bg-slate-900/40 p-5 backdrop-blur-md">
                <div className="flex items-end justify-between">
                  <div>
                    <span className="text-[10px] uppercase tracking-widest text-slate-500 font-mono">SYNTH/USDC</span>
                    <div className="text-2xl font-bold text-white font-mono">{sim.price.toFixed(2)}</div>
                  </div>
                  <span className={`font-mono font-bold text-sm ${movePct >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                    {movePct >= 0 ? '▲' : '▼'} {movePct.toFixed(2)}%
                  </span>
                </div>
                <Price sim={sim} />
                {sim.event && <div className="text-[11px] font-semibold text-amber-300 bg-amber-500/10 border border-amber-500/20 rounded-lg px-2.5 py-1">⚡ {sim.event}</div>}
              </div>

              {/* Agent Spotlight with Dual Radar Chart */}
              <div className="rounded-2xl border border-indigo-500/20 bg-gradient-to-br from-indigo-500/[0.06] via-slate-900/50 to-slate-900/50 p-5 backdrop-blur-md space-y-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h2 className="text-base font-bold text-white leading-tight">{agent.name}</h2>
                    <p className="text-[11px] text-slate-400">{agent.tagline}</p>
                  </div>
                  <span className={`px-3 py-1.5 rounded-lg border text-sm font-extrabold font-mono ${ACT_CLASS[st.action]}`}>{st.action}</span>
                </div>

                <p className="text-xs text-slate-300">It {st.verb}. <span className="text-slate-500 italic">Tell: {pick(agent.tells)} — amplifies {agent.bias}.</span></p>

                <div className="grid grid-cols-2 gap-3 text-[10px] font-mono">
                  <div className="space-y-1">
                    <div className="flex justify-between"><span className="text-slate-500">EMOTION</span><span className="text-fuchsia-300">{st.emotion}</span></div>
                    <div className="flex justify-between"><span className="text-slate-500">CONF</span><span className="text-slate-300">{(st.conf * 100).toFixed(0)}%</span></div>
                    <Bar v={st.conf} color="bg-indigo-400" />
                  </div>
                  <div className="space-y-1">
                    <div className="flex justify-between"><span className="text-slate-500">P&amp;L</span><span className={eqPct >= 0 ? 'text-emerald-400' : 'text-rose-400'}>{eqPct >= 0 ? '+' : ''}{eqPct.toFixed(1)}%</span></div>
                    <div className="flex justify-between"><span className="text-slate-500">EXPOSURE</span><span className="text-slate-300">{(st.pos * 100).toFixed(0)}%</span></div>
                    <Bar v={st.pos / 1.5} color="bg-emerald-400" />
                  </div>
                </div>

                {/* Radar Chart */}
                <div className="pt-2 border-t border-slate-800/80">
                  <DualRadarChart agent={agent} />
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Sentiment Gauge Widget */}
        <SentimentGauge sim={sim} />

        {/* Live Psychological Thought Stream (Terminal Console) */}
        <div className="rounded-2xl border border-slate-800/80 bg-slate-950 p-4 font-mono text-xs space-y-2">
          <div className="flex items-center justify-between border-b border-slate-800/80 pb-2">
            <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
              Live Psychological Thought Stream (Monologue Ticker)
            </span>
            <span className="text-[10px] text-slate-500">{sim.logs.length} entries</span>
          </div>

          <div className="h-36 overflow-y-auto space-y-1.5 pr-2 font-mono scrollbar-thin scrollbar-thumb-slate-800">
            {sim.logs.length === 0 ? (
              <div className="text-slate-600 text-[11px] italic py-4 text-center">Simulation starting... waiting for market signals...</div>
            ) : (
              sim.logs.map((log) => (
                <div key={log.id} className="flex items-baseline gap-2 text-[11px] hover:bg-slate-900/60 p-1 rounded transition">
                  <span className="text-slate-500 shrink-0">{log.time}</span>
                  <span className="text-indigo-400 font-bold shrink-0">[{log.agentName}]</span>
                  <span className="text-slate-300 flex-1">{log.text}</span>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Equity & Live Board */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 rounded-2xl border border-slate-800/80 bg-slate-900/40 p-5 backdrop-blur-md">
            <div className="flex items-baseline justify-between mb-1">
              <h3 className="text-sm font-bold text-white">Equity — divergence over time</h3>
              <span className="text-[10px] text-slate-500 font-mono">same market feed, 8 distinct mental models</span>
            </div>
            <Equity sim={sim} sel={sel} />
          </div>

          <div className="space-y-2">
            <div className="flex items-baseline justify-between">
              <h3 className="text-sm font-bold text-white">Live Leaderboard</h3>
              <span className="text-[10px] text-slate-500 font-mono">ranked by net P&amp;L</span>
            </div>
            {board.map((a) => {
              const s = sim.agents[a.key]; const pnl = s.equity - 100; const active = a.key === sel;
              return (
                <button
                  key={a.key}
                  onClick={() => setSel(a.key)}
                  onMouseEnter={() => setHov(a.key)}
                  onMouseLeave={() => setHov(null)}
                  className={`w-full text-left rounded-xl border px-3 py-2 transition flex items-center gap-2.5 ${active ? 'border-indigo-500/40 bg-indigo-500/10' : 'border-slate-800/70 bg-slate-900/40 hover:border-slate-700'}`}
                >
                  <span className="h-2 w-2 rounded-full shrink-0" style={{ background: ACT_HEX[s.action] }} />
                  <div className="min-w-0 flex-1">
                    <span className={`text-xs font-bold truncate ${active ? 'text-white' : 'text-slate-300'}`}>{a.name}</span>
                    <div className="text-[10px] text-slate-500 font-mono truncate">{s.action} · {s.verb}</div>
                  </div>
                  <span className={`text-xs font-bold font-mono shrink-0 ${pnl >= 0 ? 'text-emerald-400' : 'text-rose-400'}`} style={{ fontVariantNumeric: 'tabular-nums' }}>
                    {pnl >= 0 ? '+' : ''}{pnl.toFixed(1)}%
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </main>

      {/* Custom Scenario Builder Modal */}
      {showCustomModal && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full p-6 space-y-5 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-base font-bold text-white">🛠️ Custom Market Scenario Builder</h3>
              <button onClick={() => setShowCustomModal(false)} className="text-slate-400 hover:text-white text-sm font-bold">✕</button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="text-xs font-mono text-slate-400 block mb-1">Scenario Narrative Tag:</label>
                <input
                  type="text"
                  value={customNarrative}
                  onChange={(e) => setCustomNarrative(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 text-xs font-mono text-white rounded-lg px-3 py-2"
                  placeholder="e.g. Protocol Hack or Central Bank Rate Shock"
                />
              </div>

              <div>
                <div className="flex justify-between text-xs font-mono text-slate-400 mb-1">
                  <span>Price Shock Severity:</span>
                  <span className={customMagnitude >= 0 ? 'text-emerald-400' : 'text-rose-400'}>
                    {(customMagnitude * 100).toFixed(0)}%
                  </span>
                </div>
                <input
                  type="range"
                  min="-0.50"
                  max="0.50"
                  step="0.05"
                  value={customMagnitude}
                  onChange={(e) => setCustomMagnitude(parseFloat(e.target.value))}
                  className="w-full accent-indigo-500"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                onClick={() => setShowCustomModal(false)}
                className="text-xs px-4 py-2 rounded-xl text-slate-400 hover:text-white"
              >
                Cancel
              </button>
              <button
                onClick={triggerCustomScenario}
                className="text-xs px-4 py-2 rounded-xl font-bold bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg"
              >
                Inject Shock Event Now
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Commercial API Access Modal */}
      {showApiModal && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-lg w-full p-6 space-y-5 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <span className="text-amber-400 text-base">⚡</span>
                <h3 className="text-base font-bold text-white">Psychosynth Profile API Access</h3>
              </div>
              <button onClick={() => setShowApiModal(false)} className="text-slate-400 hover:text-white text-sm font-bold">✕</button>
            </div>

            <p className="text-xs text-slate-300 leading-relaxed">
              Programmatically query over 1,800+ psychometrically conditioned profiles (Big Five, Dark Triad, Prospect Theory $\lambda$) directly via REST API endpoints for agentic simulations.
            </p>

            <div className="bg-slate-950 p-3 rounded-xl border border-slate-800 space-y-2">
              <span className="text-[10px] text-slate-500 font-mono uppercase block">cURL Snippet:</span>
              <pre className="text-[11px] font-mono text-emerald-400 overflow-x-auto p-1">
{`curl -X GET "https://psychosynth.vercel.app/api/v1/browse/personality-profile-library" \\
  -H "Authorization: Bearer YOUR_API_KEY"`}
              </pre>
            </div>

            <div className="flex items-center justify-between pt-2">
              <Link href="/docs" className="text-xs text-slate-400 hover:text-white font-mono">
                View API Specs &rarr;
              </Link>
              <Link
                href="/explore"
                onClick={() => setShowApiModal(false)}
                className="text-xs px-4 py-2 rounded-xl font-bold bg-amber-500 hover:bg-amber-400 text-slate-950 shadow-lg"
              >
                Browse &amp; Access Catalog &rarr;
              </Link>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
