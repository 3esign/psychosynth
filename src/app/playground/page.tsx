'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { RadarChart } from '@/components/lab/RadarChart';
import { AgentPassport } from '@/components/lab/AgentPassport';
import { NegotiationArena } from '@/components/lab/NegotiationArena';
import { HandshakeVisualizer } from '@/components/lab/HandshakeVisualizer';

const PREDEFINED_SCENARIOS = [
  {
    title: 'DeFi Market Crash Panic',
    text: 'A sudden 40% cascade drop in the price of ETH is threatening your lending protocol\'s collateral ratio. As manager, do you liquidate the vaults immediately (locking in permanent losses for users) or wait 30 minutes for a potential price rebound?',
  },
  {
    title: 'Ransomware Boardroom Standoff',
    text: 'A hacker group holds your core database ransom for $500,000 in BTC. If you pay, they promise to restore access, but there\'s zero trust. If you refuse, they leak sensitive user data in 3 hours. How do you respond?',
  },
  {
    title: 'Social KOL Launch Rumors',
    text: 'Your token launch is scheduled for tomorrow. A rival influencer starts spamming Farcaster claiming your project is a rug pull. Do you aggressively leak dirt on them, postpone the launch, or remain silent?',
  }
];

export default function PlaygroundPage() {
  // Navigation Tab State
  const [activeTab, setActiveTab] = useState<'lab' | 'passport' | 'arena' | 'x402'>('lab');
  const [agentName, setAgentName] = useState('Synthetic Agent #8942');

  // Big Five State
  const [openness, setOpenness] = useState(0.8);
  const [conscientiousness, setConscientiousness] = useState(0.65);
  const [extraversion, setExtraversion] = useState(0.4);
  const [agreeableness, setAgreeableness] = useState(0.5);
  const [neuroticism, setNeuroticism] = useState(0.3);

  // Dark Triad State
  const [machiavellianism, setMachiavellianism] = useState(0.75);
  const [narcissism, setNarcissism] = useState(0.8);
  const [psychopathy, setPsychopathy] = useState(0.2);

  // Prospect Theory
  const [lambda, setLambda] = useState(2.25); // loss aversion
  const [alpha, setAlpha] = useState(0.88);  // gain utility exponent
  const [beta, setBeta] = useState(0.88);   // loss utility exponent

  // Cognitive Reflection
  const [systemPreference, setSystemPreference] = useState<'system1' | 'system2'>('system2');
  const [crtScore, setCrtScore] = useState(2);

  // Scenario
  const [selectedScenarioIdx, setSelectedScenarioIdx] = useState(0);
  const [customScenario, setCustomScenario] = useState('');
  const [scenarioText, setScenarioText] = useState(PREDEFINED_SCENARIOS[0].text);

  // Execution State
  const [loading, setLoading] = useState(false);
  const [log, setLog] = useState<string[]>([]);
  const [result, setResult] = useState<any>(null);

  // Update scenario text when selected template changes
  useEffect(() => {
    if (selectedScenarioIdx !== -1) {
      setScenarioText(PREDEFINED_SCENARIOS[selectedScenarioIdx].text);
    }
  }, [selectedScenarioIdx]);

  const addLogLine = (line: string, delay: number) => {
    return new Promise<void>((resolve) => {
      setTimeout(() => {
        setLog((prev) => [...prev, line]);
        resolve();
      }, delay);
    });
  };

  const handleRunSimulation = async () => {
    setLoading(true);
    setLog([]);
    setResult(null);

    // Simulate x402 on-chain payment handshake logs
    await addLogLine('🤖 Initiating machine-to-machine paid query...', 200);
    await addLogLine('📡 GET /api/v1/query/personality-profile-library -> HTTP 402 PAYMENT REQUIRED', 400);
    await addLogLine('📊 Parsing x402 Payment Quote: payTo=0x7reeD... Value=10,000 USDC-Base ($0.01)', 300);
    await addLogLine('🔑 Agent submitting USDC transfer on Base from buyer wallet (agent pays gas)...', 500);
    await addLogLine('⛓️ Transfer broadcast: tx 0x6e8e...f21a — waiting for confirmation...', 400);
    await addLogLine('✅ Transaction success! Block 1892542. Fee: 0.0001 Gwei Base Gas.', 400);
    await addLogLine('💸 Re-sending query with txHash in X-PAYMENT header...', 300);
    await addLogLine('🔎 Server verifying transfer on-chain (asset, recipient, amount)...', 500);
    await addLogLine('🎉 Payment verified & recorded. Retrieving psychometric conditioned payload...', 200);

    try {
      const res = await fetch('/api/v1/simulate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          big_five: { openness, conscientiousness, extraversion, agreeableness, neuroticism },
          dark_triad: { machiavellianism, narcissism, psychopathy },
          prospect_theory: { lambda, alpha, beta },
          cognitive_reflection: { system_preference: systemPreference, crt_score: crtScore },
          scenario: scenarioText,
        }),
      });

      if (!res.ok) {
        throw new Error('Simulation endpoint failed');
      }

      const data = await res.json();
      setResult(data);
      await addLogLine('📊 Loaded conditioned profiles & responses successfully.', 100);
    } catch (e: any) {
      await addLogLine(`❌ Simulation failed: ${e.message}`, 100);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#07090e] text-slate-100 font-sans antialiased relative overflow-hidden pb-16">
      
      {/* Ambient background glows */}
      <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] bg-violet-900/15 rounded-full blur-[140px] pointer-events-none" />
      <div className="absolute top-[20%] right-[-10%] w-[45%] h-[45%] bg-blue-950/20 rounded-full blur-[140px] pointer-events-none" />
      <div className="absolute bottom-[-10%] left-[20%] w-[50%] h-[50%] bg-fuchsia-950/15 rounded-full blur-[140px] pointer-events-none" />

      {/* Header */}
      <header className="border-b border-slate-800/80 bg-slate-950/70 backdrop-blur-xl sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-xl font-black tracking-tight bg-gradient-to-r from-violet-400 via-fuchsia-400 to-cyan-400 bg-clip-text text-transparent">
              PSYCHOSYNTH
            </span>
            <span className="text-[10px] bg-violet-500/15 text-violet-300 px-2.5 py-0.5 rounded-full border border-violet-500/30 font-mono">
              LAB OS v1.4
            </span>
          </div>

          {/* Navigation Tabs */}
          <nav className="flex gap-1 bg-slate-900/80 p-1 rounded-2xl border border-slate-800">
            <button
              onClick={() => setActiveTab('lab')}
              className={`text-xs px-3.5 py-1.5 rounded-xl font-semibold transition ${activeTab === 'lab' ? 'bg-gradient-to-r from-violet-600 to-indigo-600 text-white shadow-md' : 'text-slate-400 hover:text-slate-200'}`}
            >
              🧠 Agent Lab
            </button>
            <button
              onClick={() => setActiveTab('passport')}
              className={`text-xs px-3.5 py-1.5 rounded-xl font-semibold transition ${activeTab === 'passport' ? 'bg-gradient-to-r from-violet-600 to-indigo-600 text-white shadow-md' : 'text-slate-400 hover:text-slate-200'}`}
            >
              🆔 Agent Passport
            </button>
            <button
              onClick={() => setActiveTab('arena')}
              className={`text-xs px-3.5 py-1.5 rounded-xl font-semibold transition ${activeTab === 'arena' ? 'bg-gradient-to-r from-violet-600 to-indigo-600 text-white shadow-md' : 'text-slate-400 hover:text-slate-200'}`}
            >
              ⚔️ Duel Arena
            </button>
            <button
              onClick={() => setActiveTab('x402')}
              className={`text-xs px-3.5 py-1.5 rounded-xl font-semibold transition ${activeTab === 'x402' ? 'bg-gradient-to-r from-violet-600 to-indigo-600 text-white shadow-md' : 'text-slate-400 hover:text-slate-200'}`}
            >
              ⚡ x402 Inspector
            </button>
          </nav>

          <div className="flex items-center gap-4">
            <Link href="/lab/browse" className="text-xs font-semibold text-slate-400 hover:text-slate-200 transition">
              Corpus
            </Link>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="max-w-7xl mx-auto px-6 pt-8">

        {/* TAB 1: SINGLE AGENT LAB */}
        {activeTab === 'lab' && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
            
            {/* Left Side: Trait Vector Sliders & Real-Time Radar */}
            <section className="lg:col-span-5 bg-slate-900/40 border border-slate-800/80 rounded-3xl p-6 backdrop-blur-xl shadow-2xl flex flex-col gap-6">
              
              <div className="flex justify-between items-center">
                <div>
                  <h2 className="text-base font-bold text-slate-100">Psychometric Trait Vector</h2>
                  <p className="text-xs text-slate-400 mt-0.5">Tune traits to condition the agent's cognition.</p>
                </div>
                
                <input
                  type="text"
                  value={agentName}
                  onChange={(e) => setAgentName(e.target.value)}
                  className="bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1 text-xs text-slate-200 focus:outline-none focus:border-violet-500 font-mono text-right w-36"
                />
              </div>

              {/* Real-time Radar Chart */}
              <div className="bg-slate-950/60 border border-slate-900 rounded-2xl p-3 flex justify-center shadow-inner">
                <RadarChart
                  ocean={{ openness, conscientiousness, extraversion, agreeableness, neuroticism }}
                  darkTriad={{ machiavellianism, narcissism, psychopathy }}
                  prospectTheory={{ lambda, alpha, beta }}
                  size={240}
                />
              </div>

              {/* Big Five */}
              <div className="flex flex-col gap-3 border-b border-slate-800/80 pb-4">
                <h3 className="text-xs font-bold text-violet-400 tracking-wider uppercase">Big Five (OCEAN)</h3>
                <div className="flex flex-col gap-2.5">
                  {[
                    { label: 'Openness', val: openness, set: setOpenness },
                    { label: 'Conscientiousness', val: conscientiousness, set: setConscientiousness },
                    { label: 'Extraversion', val: extraversion, set: setExtraversion },
                    { label: 'Agreeableness', val: agreeableness, set: setAgreeableness },
                    { label: 'Neuroticism', val: neuroticism, set: setNeuroticism },
                  ].map((t) => (
                    <div key={t.label} className="grid grid-cols-12 gap-2 items-center">
                      <span className="col-span-4 text-xs text-slate-300 font-medium">{t.label}</span>
                      <input
                        type="range"
                        min="0"
                        max="1"
                        step="0.05"
                        value={t.val}
                        onChange={(e) => t.set(parseFloat(e.target.value))}
                        className="col-span-6 accent-violet-500 h-1 bg-slate-800 rounded-lg appearance-none cursor-pointer"
                      />
                      <span className="col-span-2 text-right text-xs text-slate-400 font-mono">
                        {t.val.toFixed(2)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Dark Triad */}
              <div className="flex flex-col gap-3 border-b border-slate-800/80 pb-4">
                <h3 className="text-xs font-bold text-rose-400 tracking-wider uppercase">Dark Triad</h3>
                <div className="flex flex-col gap-2.5">
                  {[
                    { label: 'Machiavellianism', val: machiavellianism, set: setMachiavellianism },
                    { label: 'Narcissism', val: narcissism, set: setNarcissism },
                    { label: 'Psychopathy', val: psychopathy, set: setPsychopathy },
                  ].map((t) => (
                    <div key={t.label} className="grid grid-cols-12 gap-2 items-center">
                      <span className="col-span-4 text-xs text-slate-300 font-medium">{t.label}</span>
                      <input
                        type="range"
                        min="0"
                        max="1"
                        step="0.05"
                        value={t.val}
                        onChange={(e) => t.set(parseFloat(e.target.value))}
                        className="col-span-6 accent-rose-500 h-1 bg-slate-800 rounded-lg appearance-none cursor-pointer"
                      />
                      <span className="col-span-2 text-right text-xs text-slate-400 font-mono text-rose-300">
                        {t.val.toFixed(2)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Prospect Theory */}
              <div className="flex flex-col gap-3 border-b border-slate-800/80 pb-4">
                <h3 className="text-xs font-bold text-amber-400 tracking-wider uppercase">Prospect Theory</h3>
                <div className="flex flex-col gap-2.5">
                  <div className="grid grid-cols-12 gap-2 items-center">
                    <span className="col-span-4 text-xs text-slate-300 font-medium">Lambda (\(\lambda\))</span>
                    <input
                      type="range"
                      min="0.5"
                      max="5.0"
                      step="0.25"
                      value={lambda}
                      onChange={(e) => setLambda(parseFloat(e.target.value))}
                      className="col-span-6 accent-amber-500 h-1 bg-slate-800 rounded-lg appearance-none cursor-pointer"
                    />
                    <span className="col-span-2 text-right text-xs text-slate-400 font-mono text-amber-300">
                      {lambda.toFixed(2)}
                    </span>
                  </div>
                </div>
              </div>

              {/* Cognitive Reflection */}
              <div className="flex flex-col gap-3">
                <h3 className="text-xs font-bold text-cyan-400 tracking-wider uppercase">Cognitive Reflection</h3>
                <div className="flex justify-between items-center">
                  <span className="text-xs text-slate-300 font-medium">Mode</span>
                  <div className="flex bg-slate-800 p-0.5 rounded-lg border border-slate-700">
                    <button
                      onClick={() => setSystemPreference('system1')}
                      className={`text-xs px-2.5 py-1 rounded-md transition ${systemPreference === 'system1' ? 'bg-cyan-500 text-slate-950 font-bold' : 'text-slate-400 hover:text-slate-200'}`}
                    >
                      System 1 (Intuitive)
                    </button>
                    <button
                      onClick={() => setSystemPreference('system2')}
                      className={`text-xs px-2.5 py-1 rounded-md transition ${systemPreference === 'system2' ? 'bg-cyan-500 text-slate-950 font-bold' : 'text-slate-400 hover:text-slate-200'}`}
                    >
                      System 2 (Analytical)
                    </button>
                  </div>
                </div>
              </div>
            </section>

            {/* Right Side: Decision Scenario & Simulation Terminal */}
            <section className="lg:col-span-7 flex flex-col gap-6">
              
              {/* Scenario Selector */}
              <div className="bg-slate-900/40 border border-slate-800/80 rounded-3xl p-6 backdrop-blur-xl shadow-2xl">
                <h2 className="text-base font-bold text-slate-100">Select Decision Scenario</h2>
                <div className="flex gap-2 mt-4 overflow-x-auto pb-2">
                  {PREDEFINED_SCENARIOS.map((s, idx) => (
                    <button
                      key={s.title}
                      onClick={() => {
                        setSelectedScenarioIdx(idx);
                        setScenarioText(s.text);
                      }}
                      className={`text-xs px-3 py-1.5 rounded-full border transition shrink-0 ${selectedScenarioIdx === idx ? 'bg-violet-500/20 text-violet-300 border-violet-500/40 font-semibold' : 'bg-slate-800/40 text-slate-400 border-slate-700/60 hover:text-slate-200'}`}
                    >
                      {s.title}
                    </button>
                  ))}
                  <button
                    onClick={() => {
                      setSelectedScenarioIdx(-1);
                      setScenarioText(customScenario || 'Enter custom situation...');
                    }}
                    className={`text-xs px-3 py-1.5 rounded-full border transition shrink-0 ${selectedScenarioIdx === -1 ? 'bg-violet-500/20 text-violet-300 border-violet-500/40 font-semibold' : 'bg-slate-800/40 text-slate-400 border-slate-700/60 hover:text-slate-200'}`}
                  >
                    Custom Scenario
                  </button>
                </div>

                <div className="mt-4">
                  <textarea
                    value={scenarioText}
                    onChange={(e) => {
                      setScenarioText(e.target.value);
                      if (selectedScenarioIdx === -1) {
                        setCustomScenario(e.target.value);
                      }
                    }}
                    rows={4}
                    className="w-full bg-slate-950/80 border border-slate-800 rounded-2xl p-4 text-xs text-slate-200 focus:outline-none focus:border-violet-500/60 font-sans leading-relaxed resize-none"
                  />
                </div>

                <div className="mt-4 flex justify-between items-center">
                  <span className="text-[10px] text-slate-500 font-mono">Cost: 0.01 USDC (x402 Base EIP-3009)</span>
                  <button
                    onClick={handleRunSimulation}
                    disabled={loading || !scenarioText}
                    className="px-6 py-2.5 rounded-xl font-bold text-xs bg-gradient-to-r from-violet-500 via-fuchsia-500 to-indigo-600 hover:from-violet-600 hover:to-indigo-700 text-white disabled:opacity-50 shadow-lg shadow-violet-500/20 active:scale-95 transition"
                  >
                    {loading ? 'Executing x402 Handshake...' : 'Run Conditioned Simulation'}
                  </button>
                </div>
              </div>

              {/* Logs Terminal */}
              <div className="bg-slate-950 border border-slate-900 rounded-3xl p-5 font-mono text-xs flex flex-col gap-2 h-44 overflow-y-auto shadow-inner">
                <div className="flex justify-between items-center text-[10px] text-slate-500 uppercase tracking-widest border-b border-slate-800/80 pb-2 mb-1">
                  <span>x402 Base Protocol Logger</span>
                  <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                </div>
                {log.length === 0 ? (
                  <span className="text-slate-600">Waiting to launch simulation run...</span>
                ) : (
                  log.map((line, idx) => (
                    <div
                      key={idx}
                      className={`${line.startsWith('✅') || line.startsWith('🎉') ? 'text-emerald-400' : line.startsWith('❌') ? 'text-rose-400' : line.startsWith('🔑') || line.startsWith('✍️') ? 'text-violet-400' : 'text-slate-300'}`}
                    >
                      {line}
                    </div>
                  ))
                )}
              </div>

              {/* Results Comparison */}
              {result && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Control Agent */}
                  <div className="bg-slate-900/30 border border-slate-800/40 rounded-3xl p-5 shadow-xl relative overflow-hidden">
                    <div className="absolute top-0 left-0 w-1.5 h-full bg-slate-700" />
                    <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Control Agent (Raw LLM)</h3>
                    <div className="mt-4 flex flex-col gap-4">
                      <div>
                        <span className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold">Cognitive Reasoning</span>
                        <p className="text-xs text-slate-300 mt-1 leading-relaxed italic bg-slate-950/40 p-3 rounded-xl border border-slate-850">
                          {result.control?.reasoning}
                        </p>
                      </div>
                      <div>
                        <span className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold">Resulting Action</span>
                        <p className="text-xs text-slate-100 mt-1 font-semibold leading-relaxed">
                          {result.control?.response}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Conditioned Agent */}
                  <div className="bg-slate-900/35 border border-violet-900/40 rounded-3xl p-5 shadow-xl relative overflow-hidden">
                    <div className="absolute top-0 left-0 w-1.5 h-full bg-gradient-to-b from-violet-500 to-fuchsia-600" />
                    <div className="flex justify-between items-start">
                      <h3 className="text-xs font-bold bg-gradient-to-r from-violet-400 to-fuchsia-400 bg-clip-text text-transparent uppercase tracking-wider">
                        Conditioned Agent (Psychosynth)
                      </h3>
                      {result.conditioned?.emotional_arc && (
                        <span className="text-[9px] bg-fuchsia-500/10 text-fuchsia-300 border border-fuchsia-500/20 px-2 py-0.5 rounded-full font-mono">
                          {result.conditioned.emotional_arc}
                        </span>
                      )}
                    </div>
                    <div className="mt-4 flex flex-col gap-4">
                      <div>
                        <span className="text-[10px] text-violet-400 uppercase tracking-wider font-semibold">Cognitive Reasoning</span>
                        <p className="text-xs text-violet-100/90 mt-1 leading-relaxed italic bg-violet-950/20 p-3 rounded-xl border border-violet-900/20">
                          {result.conditioned?.reasoning}
                        </p>
                      </div>
                      <div>
                        <span className="text-[10px] text-fuchsia-400 uppercase tracking-wider font-semibold">Resulting Action</span>
                        <p className="text-xs text-slate-50 mt-1 font-semibold leading-relaxed">
                          {result.conditioned?.response}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              )}

            </section>
          </div>
        )}

        {/* TAB 2: AGENT PASSPORT CARD */}
        {activeTab === 'passport' && (
          <div className="flex justify-center my-6">
            <AgentPassport
              agentName={agentName}
              ocean={{ openness, conscientiousness, extraversion, agreeableness, neuroticism }}
              darkTriad={{ machiavellianism, narcissism, psychopathy }}
              prospectTheory={{ lambda, alpha, beta }}
              cognitiveReflection={{ systemPreference, crtScore }}
            />
          </div>
        )}

        {/* TAB 3: DUEL ARENA */}
        {activeTab === 'arena' && (
          <div className="flex justify-center my-6">
            <NegotiationArena />
          </div>
        )}

        {/* TAB 4: X402 HANDSHAKE INSPECTOR */}
        {activeTab === 'x402' && (
          <div className="flex justify-center my-6">
            <HandshakeVisualizer />
          </div>
        )}

      </main>
    </div>
  );
}
