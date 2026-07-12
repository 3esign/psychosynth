'use client';

import { useState, useEffect } from 'react';
import { TraitBars } from '@/components/lab/TraitBars';

export default function BrowsePage() {
  const [activeTab, setActiveTab] = useState<'browse' | 'stats'>('browse');

  // --- BROWSE TAB STATE ---
  const [profiles, setProfiles] = useState<any[]>([]);
  const [totalProfiles, setTotalProfiles] = useState(0);
  const [browseLoading, setBrowseLoading] = useState(true);
  const [limit] = useState(15);
  const [offset, setOffset] = useState(0);

  // Filters
  const [filterStatus, setFilterStatus] = useState<string>('approved');
  const [filterTags, setFilterTags] = useState<string>('');
  const [filterDecisionStyle, setFilterDecisionStyle] = useState<string>('');
  const [filterMbti, setFilterMbti] = useState<string>('');
  
  // Big Five Trait range filters (min and max)
  const [traitMins, setTraitMins] = useState<Record<string, string>>({
    openness: '', conscientiousness: '', extraversion: '', agreeableness: '', neuroticism: ''
  });
  const [traitMaxs, setTraitMaxs] = useState<Record<string, string>>({
    openness: '', conscientiousness: '', extraversion: '', agreeableness: '', neuroticism: ''
  });

  // Selected profile drawer
  const [selectedProfileId, setSelectedProfileId] = useState<string | null>(null);
  const [selectedProfileData, setSelectedProfileData] = useState<any | null>(null);
  const [drawerLoading, setDrawerLoading] = useState(false);

  // --- STATS TAB STATE ---
  const [stats, setStats] = useState<any | null>(null);
  const [statsLoading, setStatsLoading] = useState(true);

  // Load profiles list
  const loadProfiles = async () => {
    setBrowseLoading(true);
    try {
      const params = new URLSearchParams();
      params.set('limit', String(limit));
      params.set('offset', String(offset));
      if (filterStatus) params.set('status', filterStatus);
      if (filterTags) params.set('tags', filterTags);
      if (filterDecisionStyle) params.set('decision_style', filterDecisionStyle);
      if (filterMbti) params.set('mbti_label', filterMbti);

      // Trait skews
      const minPairs = Object.entries(traitMins)
        .filter(([_, v]) => v !== '')
        .map(([k, v]) => `${k}:${v}`)
        .join(',');
      if (minPairs) params.set('big_five_min', minPairs);

      const maxPairs = Object.entries(traitMaxs)
        .filter(([_, v]) => v !== '')
        .map(([k, v]) => `${k}:${v}`)
        .join(',');
      if (maxPairs) params.set('big_five_max', maxPairs);

      const res = await fetch(`/api/lab/entities/profiles?${params.toString()}`);
      if (!res.ok) throw new Error('Failed to load profiles');
      const data = await res.json();
      setProfiles(data.items || []);
      setTotalProfiles(data.total || 0);
    } catch (err) {
      console.error(err);
    } finally {
      setBrowseLoading(false);
    }
  };

  // Load stats data
  const loadStats = async () => {
    setStatsLoading(true);
    try {
      const res = await fetch('/api/lab/stats');
      if (!res.ok) throw new Error('Failed to load stats');
      const data = await res.json();
      setStats(data);
    } catch (err) {
      console.error(err);
    } finally {
      setStatsLoading(false);
    }
  };

  // Reload lists on filters change
  useEffect(() => {
    if (activeTab === 'browse') {
      loadProfiles();
    } else {
      loadStats();
    }
  }, [activeTab, offset, filterStatus, filterTags, filterDecisionStyle, filterMbti]);

  // Handle drawer click
  const handleRowClick = async (profileId: string) => {
    setSelectedProfileId(profileId);
    setDrawerLoading(true);
    try {
      const res = await fetch(`/api/lab/entities/profiles/${profileId}`);
      if (!res.ok) throw new Error('Failed to fetch profile details');
      const data = await res.json();
      setSelectedProfileData(data);
    } catch (err) {
      console.error(err);
      setSelectedProfileId(null);
    } finally {
      setDrawerLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header / Tabs */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-neutral-900 pb-4">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-white font-sans">
            Data Explorer
          </h1>
          <p className="text-xs text-neutral-500 font-mono mt-1">
            Browse synthetic output datasets, verify provenance chains, and track loop metrics
          </p>
        </div>

        <div className="flex rounded-xl bg-neutral-900/60 p-1 border border-neutral-900 font-mono text-xs">
          <button
            onClick={() => setActiveTab('browse')}
            className={`px-4 py-2 rounded-lg transition-all ${activeTab === 'browse' ? 'bg-purple-600 text-white font-bold' : 'text-neutral-400 hover:text-white'}`}
          >
            Browse Data
          </button>
          <button
            onClick={() => setActiveTab('stats')}
            className={`px-4 py-2 rounded-lg transition-all ${activeTab === 'stats' ? 'bg-purple-600 text-white font-bold' : 'text-neutral-400 hover:text-white'}`}
          >
            System Metrics
          </button>
        </div>
      </div>

      {activeTab === 'browse' ? (
        <div className="grid grid-cols-1 xl:grid-cols-4 gap-8">
          {/* Filters Sidebar */}
          <div className="xl:col-span-1 rounded-2xl border border-neutral-900 bg-neutral-900/10 p-5 space-y-6 self-start font-mono text-xs">
            <h2 className="text-[10px] font-bold text-neutral-400 uppercase tracking-widest border-b border-neutral-900 pb-2">
              Explorer Filters
            </h2>

            <div className="space-y-4">
              {/* Status filter */}
              <div className="space-y-1.5">
                <span className="text-[10px] text-neutral-500 uppercase tracking-wider block">Status</span>
                <select
                  value={filterStatus}
                  onChange={(e) => { setFilterStatus(e.target.value); setOffset(0); }}
                  className="w-full bg-neutral-950 border border-neutral-900 rounded-xl px-3 py-2 text-white outline-none focus:border-purple-600"
                >
                  <option value="">All</option>
                  <option value="pending">Pending</option>
                  <option value="approved">Approved</option>
                  <option value="rejected">Rejected</option>
                  <option value="archived">Archived</option>
                </select>
              </div>

              {/* Tags filter */}
              <div className="space-y-1.5">
                <span className="text-[10px] text-neutral-500 uppercase tracking-wider block">Tags (comma-sep)</span>
                <input
                  type="text"
                  placeholder="e.g. trading, general"
                  value={filterTags}
                  onChange={(e) => setFilterTags(e.target.value)}
                  onBlur={() => setOffset(0)}
                  className="w-full bg-neutral-950 border border-neutral-900 rounded-xl px-3 py-2 text-white outline-none focus:border-purple-600 placeholder-neutral-700"
                />
              </div>

              {/* Decision style */}
              <div className="space-y-1.5">
                <span className="text-[10px] text-neutral-500 uppercase tracking-wider block">Decision Style</span>
                <select
                  value={filterDecisionStyle}
                  onChange={(e) => { setFilterDecisionStyle(e.target.value); setOffset(0); }}
                  className="w-full bg-neutral-950 border border-neutral-900 rounded-xl px-3 py-2 text-white outline-none focus:border-purple-600"
                >
                  <option value="">All</option>
                  <option value="analytical">Analytical</option>
                  <option value="intuitive">Intuitive</option>
                  <option value="dependent">Dependent</option>
                  <option value="avoidant">Avoidant</option>
                  <option value="spontaneous">Spontaneous</option>
                  <option value="deliberative">Deliberative</option>
                </select>
              </div>

              {/* MBTI label */}
              <div className="space-y-1.5">
                <span className="text-[10px] text-neutral-500 uppercase tracking-wider block">MBTI Label</span>
                <input
                  type="text"
                  placeholder="e.g. INTJ"
                  maxLength={4}
                  value={filterMbti}
                  onChange={(e) => setFilterMbti(e.target.value)}
                  onBlur={() => setOffset(0)}
                  className="w-full bg-neutral-950 border border-neutral-900 rounded-xl px-3 py-2 text-white uppercase outline-none focus:border-purple-600 placeholder-neutral-700 font-mono"
                />
              </div>

              {/* Trait ranges */}
              <div className="border-t border-neutral-900/60 pt-4 space-y-3">
                <span className="text-[10px] font-bold text-neutral-400 uppercase tracking-widest block">Trait Skew Ranges (0-1)</span>
                
                {['openness', 'conscientiousness', 'extraversion', 'agreeableness', 'neuroticism'].map(trait => (
                  <div key={trait} className="space-y-1.5">
                    <span className="text-[10px] text-neutral-500 capitalize block">{trait.slice(0, 4)} min / max</span>
                    <div className="flex gap-2">
                      <input
                        type="number"
                        min={0}
                        max={1}
                        step={0.1}
                        placeholder="0.0"
                        value={traitMins[trait]}
                        onChange={(e) => setTraitMins(p => ({ ...p, [trait]: e.target.value }))}
                        onBlur={() => setOffset(0)}
                        className="w-1/2 bg-neutral-950 border border-neutral-900 rounded-xl px-3 py-1.5 text-white outline-none focus:border-purple-600 placeholder-neutral-850"
                      />
                      <input
                        type="number"
                        min={0}
                        max={1}
                        step={0.1}
                        placeholder="1.0"
                        value={traitMaxs[trait]}
                        onChange={(e) => setTraitMaxs(p => ({ ...p, [trait]: e.target.value }))}
                        onBlur={() => setOffset(0)}
                        className="w-1/2 bg-neutral-950 border border-neutral-900 rounded-xl px-3 py-1.5 text-white outline-none focus:border-purple-600 placeholder-neutral-850"
                      />
                    </div>
                  </div>
                ))}
              </div>

              <button
                onClick={() => {
                  setFilterTags('');
                  setFilterDecisionStyle('');
                  setFilterMbti('');
                  setTraitMins({ openness: '', conscientiousness: '', extraversion: '', agreeableness: '', neuroticism: '' });
                  setTraitMaxs({ openness: '', conscientiousness: '', extraversion: '', agreeableness: '', neuroticism: '' });
                  setOffset(0);
                  loadProfiles();
                }}
                className="w-full py-2 bg-neutral-950 hover:bg-neutral-900 border border-neutral-800 hover:border-neutral-700 text-neutral-400 hover:text-white rounded-xl transition-all"
              >
                Clear Filters
              </button>
            </div>
          </div>

          {/* Profiles Grid/Table */}
          <div className="xl:col-span-3 rounded-2xl border border-neutral-900 bg-neutral-900/10 p-6 shadow-2xl space-y-4">
            <div className="flex justify-between items-center border-b border-neutral-900 pb-3">
              <span className="font-mono text-xs text-neutral-400">
                Found {totalProfiles} profiles
              </span>
              {/* Pagination controls */}
              <div className="flex rounded-lg border border-neutral-800 bg-neutral-950 p-0.5 font-mono text-xs">
                <button
                  onClick={() => setOffset(o => Math.max(0, o - limit))}
                  disabled={offset === 0}
                  className="px-3 py-1 text-neutral-400 hover:text-white disabled:opacity-30 transition-colors"
                >
                  ◀
                </button>
                <span className="px-3 py-1 text-neutral-500 border-x border-neutral-900">
                  Page {Math.floor(offset / limit) + 1}
                </span>
                <button
                  onClick={() => setOffset(o => o + limit)}
                  disabled={offset + limit >= totalProfiles}
                  className="px-3 py-1 text-neutral-400 hover:text-white disabled:opacity-30 transition-colors"
                >
                  ▶
                </button>
              </div>
            </div>

            {browseLoading ? (
              <div className="py-24 text-center">
                <div className="h-8 w-8 animate-spin rounded-full border-4 border-purple-500 border-t-transparent mx-auto mb-4"></div>
                <div className="text-neutral-500 font-mono text-xs uppercase tracking-widest animate-pulse">Querying Database...</div>
              </div>
            ) : profiles.length === 0 ? (
              <div className="py-24 text-center text-neutral-500 italic font-mono">
                No profiles matching your filters could be found.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left font-mono text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-neutral-900 text-neutral-500">
                      <th className="pb-3 uppercase tracking-wider text-[9px] w-2/5 font-semibold">Summary Preview</th>
                      <th className="pb-3 uppercase tracking-wider text-[9px] font-semibold">OCEAN Map</th>
                      <th className="pb-3 uppercase tracking-wider text-[9px] font-semibold">MBTI</th>
                      <th className="pb-3 uppercase tracking-wider text-[9px] font-semibold">Style</th>
                      <th className="pb-3 uppercase tracking-wider text-[9px] text-right font-semibold">Score</th>
                      <th className="pb-3 uppercase tracking-wider text-[9px] text-right font-semibold">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-neutral-900/40">
                    {profiles.map((p: any) => {
                      const c = p.content || {};
                      const bigFive = c.big_five || {};
                      
                      // OCEAN scores string
                      const oStr = `O:${(bigFive.openness ?? 0).toFixed(1)} C:${(bigFive.conscientiousness ?? 0).toFixed(1)} E:${(bigFive.extraversion ?? 0).toFixed(1)} A:${(bigFive.agreeableness ?? 0).toFixed(1)} N:${(bigFive.neuroticism ?? 0).toFixed(1)}`;
                      
                      return (
                        <tr
                          key={p.id}
                          onClick={() => handleRowClick(p.id)}
                          className="hover:bg-neutral-950/30 cursor-pointer transition-colors border-b border-neutral-900/20"
                        >
                          <td className="py-3.5 pr-4">
                            <p className="line-clamp-2 text-neutral-200">{c.summary}</p>
                          </td>
                          <td className="py-3.5 whitespace-nowrap text-neutral-400 font-mono text-[10px]">
                            {oStr}
                          </td>
                          <td className="py-3.5">
                            <span className="bg-purple-500/10 text-purple-400 border border-purple-500/20 px-2 py-0.5 rounded text-[10px] font-bold">
                              {c.mbti_label}
                            </span>
                          </td>
                          <td className="py-3.5 capitalize text-neutral-300">
                            {c.decision_style}
                          </td>
                          <td className="py-3.5 text-right font-semibold text-neutral-400">
                            {Number(p.quality_score || 0).toFixed(2)}
                          </td>
                          <td className="py-3.5 text-right">
                            <span
                              className={`inline-flex px-1.5 py-0.5 rounded text-[9px] font-bold uppercase border ${
                                p.status === 'approved'
                                  ? 'bg-green-500/10 text-green-400 border-green-500/20'
                                  : p.status === 'rejected'
                                  ? 'bg-red-500/10 text-red-400 border-red-500/20'
                                  : 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20 animate-pulse'
                              }`}
                            >
                              {p.status}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      ) : (
        /* SYSTEM METRICS TAB */
        <div className="space-y-8">
          {statsLoading ? (
            <div className="py-36 text-center">
              <div className="h-8 w-8 animate-spin rounded-full border-4 border-purple-500 border-t-transparent mx-auto mb-4"></div>
              <div className="text-neutral-500 font-mono text-xs uppercase tracking-widest animate-pulse">Compiling System Metrics...</div>
            </div>
          ) : !stats ? (
            <div className="py-24 text-center text-neutral-500 italic font-mono">
              Failed to load metrics.
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 font-mono text-xs">
              {/* Curation Throughput Stats */}
              <div className="rounded-2xl border border-neutral-900 bg-neutral-900/10 p-6 space-y-4">
                <h2 className="text-[10px] font-bold text-neutral-400 uppercase tracking-widest border-b border-neutral-900 pb-2">
                  Curation Throughput
                </h2>
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-neutral-950 p-4 rounded-xl border border-neutral-900/50 shadow-inner">
                    <span className="text-[10px] text-neutral-500 uppercase tracking-wider block">Total Decisions</span>
                    <span className="text-2xl font-bold text-white font-sans">{stats.throughput?.total_decisions || 0}</span>
                  </div>
                  <div className="bg-neutral-950 p-4 rounded-xl border border-neutral-900/50 shadow-inner">
                    <span className="text-[10px] text-neutral-500 uppercase tracking-wider block">Median Time Spent</span>
                    <span className="text-2xl font-bold text-purple-400 font-sans">
                      {stats.throughput?.median_time_spent_ms ? (stats.throughput.median_time_spent_ms / 1000).toFixed(2) : 0}s
                    </span>
                  </div>
                </div>

                <div className="space-y-2">
                  <span className="text-[10px] text-neutral-500 uppercase tracking-wider block">Throughput per Day</span>
                  <div className="rounded-xl border border-neutral-900 bg-neutral-950/40 p-4 space-y-2 max-h-[150px] overflow-y-auto">
                    {(stats.throughput?.decisions_per_day || []).map((d: any) => (
                      <div key={d.day} className="flex justify-between border-b border-neutral-900/30 pb-1 last:border-0">
                        <span>{d.day}</span>
                        <span className="text-white font-semibold">{d.count} decisions</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Leaderboard */}
              <div className="rounded-2xl border border-neutral-900 bg-neutral-900/10 p-6 space-y-4">
                <h2 className="text-[10px] font-bold text-neutral-400 uppercase tracking-widest border-b border-neutral-900 pb-2">
                  Rejection Reason Leaderboard
                </h2>
                <div className="rounded-xl border border-neutral-900 bg-neutral-950/40 p-4 space-y-2 max-h-[250px] overflow-y-auto">
                  {(stats.reason_leaderboard || []).length === 0 ? (
                    <div className="text-center text-neutral-600 italic">No rejection reasons recorded yet.</div>
                  ) : (
                    stats.reason_leaderboard.map((r: any) => (
                      <div key={r.code} className="flex justify-between items-center border-b border-neutral-900/30 pb-2 last:border-0 last:pb-0">
                        <span className="capitalize">{r.code.replace(/_/g, ' ')}</span>
                        <span className="px-2 py-0.5 rounded bg-red-500/10 border border-red-500/20 text-red-400 font-bold">{r.count}</span>
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* Approval Funnel & Cost per Generator */}
              <div className="rounded-2xl border border-neutral-900 bg-neutral-900/10 p-6 space-y-4 lg:col-span-2">
                <h2 className="text-[10px] font-bold text-neutral-400 uppercase tracking-widest border-b border-neutral-900 pb-2">
                  Approval Funnel & Cost Analysis
                </h2>
                <div className="overflow-x-auto">
                  <table className="w-full text-left font-mono text-xs border-collapse">
                    <thead>
                      <tr className="border-b border-neutral-900 text-neutral-500">
                        <th className="pb-3 w-1/4 uppercase tracking-wider text-[9px]">Generator</th>
                        <th className="pb-3 text-right uppercase tracking-wider text-[9px]">Requested</th>
                        <th className="pb-3 text-right uppercase tracking-wider text-[9px]">Hook-Rej</th>
                        <th className="pb-3 text-right uppercase tracking-wider text-[9px]">Pending</th>
                        <th className="pb-3 text-right uppercase tracking-wider text-[9px]">Approved</th>
                        <th className="pb-3 text-right uppercase tracking-wider text-[9px]">Rejected</th>
                        <th className="pb-3 text-right uppercase tracking-wider text-[9px]">Total Cost</th>
                        <th className="pb-3 text-right uppercase tracking-wider text-[9px]">Cost/Approved</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-neutral-900/40">
                      {Object.entries(stats.funnel || {}).length === 0 ? (
                        <tr>
                          <td colSpan={8} className="py-6 text-center text-neutral-600 italic">No funnel stats populated yet.</td>
                        </tr>
                      ) : (
                        Object.entries(stats.funnel).map(([key, f]: [string, any]) => (
                          <tr key={key} className="hover:bg-neutral-950/20">
                            <td className="py-3 pr-2 truncate text-neutral-300 font-medium">{key}</td>
                            <td className="py-3 text-right font-semibold">{f.requested}</td>
                            <td className="py-3 text-right text-red-400">{f.hook_rejected}</td>
                            <td className="py-3 text-right text-yellow-400">{f.pending}</td>
                            <td className="py-3 text-right text-green-400">{f.approved}</td>
                            <td className="py-3 text-right text-red-400">{f.rejected}</td>
                            <td className="py-3 text-right text-neutral-400">${Number(f.total_cost).toFixed(3)}</td>
                            <td className="py-3 text-right text-purple-400 font-semibold">${Number(f.cost_per_approved).toFixed(4)}</td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Demand Stats */}
              <div className="rounded-2xl border border-neutral-900 bg-neutral-900/10 p-6 space-y-4 lg:col-span-2">
                <h2 className="text-[10px] font-bold text-neutral-400 uppercase tracking-widest border-b border-neutral-900 pb-2">
                  Market Demand Analytics
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Served Combos */}
                  <div className="space-y-3">
                    <span className="text-[10px] text-green-400 uppercase tracking-wider block font-bold">Served Query Combos</span>
                    <div className="bg-neutral-950/40 border border-neutral-900 rounded-xl p-4 max-h-[200px] overflow-y-auto space-y-3">
                      {(stats.demand?.served_combos || []).length === 0 ? (
                        <div className="text-center text-neutral-600 italic py-6">No served query events.</div>
                      ) : (
                        stats.demand.served_combos.map((c: any, i: number) => (
                          <div key={i} className="flex justify-between items-center text-[10px] border-b border-neutral-900/30 pb-2 last:border-0 last:pb-0">
                            <span className="truncate max-w-[80%] text-neutral-400">{JSON.stringify(c.filters)}</span>
                            <span className="px-2 py-0.5 rounded bg-green-500/10 border border-green-500/20 text-green-400 font-bold">{c.count}</span>
                          </div>
                        ))
                      )}
                    </div>
                  </div>

                  {/* Unserved Combos */}
                  <div className="space-y-3">
                    <span className="text-[10px] text-red-400 uppercase tracking-wider block font-bold">Unserved Query Combos</span>
                    <div className="bg-neutral-950/40 border border-neutral-900 rounded-xl p-4 max-h-[200px] overflow-y-auto space-y-3">
                      {(stats.demand?.unserved_combos || []).length === 0 ? (
                        <div className="text-center text-neutral-600 italic py-6">No unserved query events.</div>
                      ) : (
                        stats.demand.unserved_combos.map((c: any, i: number) => (
                          <div key={i} className="flex justify-between items-center text-[10px] border-b border-neutral-900/30 pb-2 last:border-0 last:pb-0">
                            <span className="truncate max-w-[80%] text-neutral-400">{JSON.stringify(c.filters)}</span>
                            <span className="px-2 py-0.5 rounded bg-red-500/10 border border-red-500/20 text-red-400 font-bold">{c.count}</span>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Provenance Detail Drawer */}
      {selectedProfileId && (
        <div className="fixed inset-y-0 right-0 z-50 w-full max-w-2xl bg-neutral-950 border-l border-neutral-900 shadow-2xl p-6 flex flex-col font-mono text-xs max-h-screen overflow-y-auto space-y-6">
          <div className="flex items-center justify-between border-b border-neutral-900 pb-3 flex-shrink-0">
            <div>
              <h3 className="text-sm font-bold uppercase tracking-wider text-neutral-300">
                Provenance Chain Verification
              </h3>
              <span className="text-[10px] text-neutral-500 mt-0.5 block truncate max-w-[400px]">ID: {selectedProfileId}</span>
            </div>
            <button
              onClick={() => { setSelectedProfileId(null); setSelectedProfileData(null); }}
              className="text-neutral-500 hover:text-white transition-colors"
            >
              Close ✕
            </button>
          </div>

          {drawerLoading ? (
            <div className="py-24 text-center">
              <div className="h-8 w-8 animate-spin rounded-full border-4 border-purple-500 border-t-transparent mx-auto mb-4"></div>
              <div className="text-neutral-500 animate-pulse text-[10px] uppercase tracking-widest">Tracing Provenance Chain...</div>
            </div>
          ) : selectedProfileData ? (
            <div className="space-y-6 flex-1 overflow-y-auto pr-1">
              {/* 1. Profile Content JSON */}
              <div className="space-y-2">
                <span className="text-[10px] font-bold text-purple-400 uppercase tracking-widest block">1. Target Content Object</span>
                <pre className="bg-neutral-900/60 p-4 rounded-xl border border-neutral-900 text-[10px] text-neutral-300 overflow-x-auto max-h-[200px]">
                  {JSON.stringify(selectedProfileData.content, null, 2)}
                </pre>
              </div>

              {/* 2. Cognitive Biases Strength Links */}
              <div className="space-y-2">
                <span className="text-[10px] font-bold text-purple-400 uppercase tracking-widest block">2. Associated Cognitive Biases</span>
                <div className="space-y-2">
                  {selectedProfileData.bias_links?.length === 0 ? (
                    <div className="text-neutral-600 italic">No cognitive biases associated.</div>
                  ) : (
                    selectedProfileData.bias_links.map((link: any, i: number) => (
                      <div key={i} className="rounded-xl border border-neutral-900 bg-neutral-950 p-4 space-y-2">
                        <div className="flex justify-between items-center">
                          <span className="font-bold text-white text-xs">{link.biases?.name}</span>
                          <span className="px-2 py-0.5 rounded bg-purple-500/10 text-purple-400 font-bold border border-purple-500/20 text-[10px]">
                            strength: {Number(link.strength).toFixed(2)}
                          </span>
                        </div>
                        <p className="text-neutral-400 text-[10px] leading-relaxed">{link.biases?.description}</p>
                        {link.context_notes && (
                          <div className="text-neutral-500 text-[10px] pt-1.5 border-t border-neutral-900/50">
                            Notes: {link.context_notes}
                          </div>
                        )}
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* 3. Provenance Chain (Generation/Edit steps) */}
              <div className="space-y-2">
                <span className="text-[10px] font-bold text-purple-400 uppercase tracking-widest block">3. Generation Provenance Chain</span>
                <div className="space-y-3">
                  {selectedProfileData.provenance?.length === 0 ? (
                    <div className="text-neutral-600 italic">No provenance record.</div>
                  ) : (
                    selectedProfileData.provenance.map((prov: any, i: number) => (
                      <div key={prov.id} className="rounded-xl border border-neutral-900 bg-neutral-950 p-4 space-y-2">
                        <div className="flex justify-between items-center border-b border-neutral-900 pb-2">
                          <span className="font-bold text-neutral-300 uppercase tracking-wider text-[10px]">Step {i + 1}: {prov.model}</span>
                          <span className="text-neutral-500 text-[10px]">{new Date(prov.created_at).toLocaleDateString()}</span>
                        </div>
                        <div className="space-y-1.5 text-[10px] text-neutral-400 font-mono">
                          <div className="flex justify-between">
                            <span>Content Hash (SHA256):</span>
                            <span className="text-neutral-300 font-mono truncate max-w-[250px]">{prov.sha256_content}</span>
                          </div>
                          <div className="flex justify-between">
                            <span>Prompt Hash:</span>
                            <span className="text-neutral-300 font-mono truncate max-w-[250px]">{prov.prompt_hash}</span>
                          </div>
                          <div className="flex justify-between">
                            <span>Template Hash:</span>
                            <span className="text-neutral-300 font-mono truncate max-w-[250px]">{prov.template_hash}</span>
                          </div>
                        </div>
                        <div className="pt-2 border-t border-neutral-900/50 text-[10px] text-neutral-500">
                          Params: {JSON.stringify(prov.params)}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* 4. Curation Decisions History */}
              <div className="space-y-2">
                <span className="text-[10px] font-bold text-purple-400 uppercase tracking-widest block">4. Curation Decisions History</span>
                <div className="space-y-3">
                  {selectedProfileData.decisions?.length === 0 ? (
                    <div className="text-neutral-600 italic">No curation actions recorded yet.</div>
                  ) : (
                    selectedProfileData.decisions.map((dec: any) => (
                      <div key={dec.id} className="rounded-xl border border-neutral-900 bg-neutral-950 p-4 space-y-2">
                        <div className="flex justify-between items-center">
                          <span
                            className={`inline-flex px-2 py-0.5 rounded text-[10px] font-bold uppercase border ${
                              dec.decision === 'approved' || dec.decision === 'edited_approved'
                                ? 'bg-green-500/10 text-green-400 border-green-500/20'
                                : 'bg-red-500/10 text-red-400 border-red-500/20'
                            }`}
                          >
                            {dec.decision}
                          </span>
                          <span className="text-neutral-500 text-[10px]">{new Date(dec.created_at).toLocaleDateString()}</span>
                        </div>
                        <div className="space-y-1.5 text-[10px] text-neutral-400">
                          <div>Judge / Decided By: <span className="text-neutral-300 font-semibold">{dec.decided_by}</span></div>
                          {dec.reason_code && <div>Reason Code: <span className="text-red-400 font-mono">{dec.reason_code}</span></div>}
                          {dec.notes && <div className="text-neutral-500">Notes: {dec.notes}</div>}
                          <div>Curation duration: <span className="text-purple-400 font-semibold">{(dec.time_spent_ms / 1000).toFixed(2)}s</span></div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
}
