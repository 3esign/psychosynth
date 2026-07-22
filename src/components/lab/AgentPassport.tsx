'use client';

import React, { useState } from 'react';
import { RadarChart } from './RadarChart';

interface AgentPassportProps {
  agentName?: string;
  ocean: {
    openness: number;
    conscientiousness: number;
    extraversion: number;
    agreeableness: number;
    neuroticism: number;
  };
  darkTriad: {
    machiavellianism: number;
    narcissism: number;
    psychopathy: number;
  };
  prospectTheory: {
    lambda: number;
    alpha: number;
    beta: number;
  };
  cognitiveReflection: {
    systemPreference: 'system1' | 'system2';
    crtScore: number;
  };
}

export const AgentPassport: React.FC<AgentPassportProps> = ({
  agentName = 'Synthetic Agent #8942',
  ocean,
  darkTriad,
  prospectTheory,
  cognitiveReflection,
}) => {
  const [copied, setCopied] = useState(false);

  // Compute Archetype Classification based on traits
  const getArchetype = () => {
    if (darkTriad.machiavellianism > 0.6 && prospectTheory.lambda < 1.5) {
      return { title: 'Sovereign Degen', badge: 'HIGH RISK • SPEED FIRST', color: 'from-rose-500 to-amber-500' };
    }
    if (ocean.conscientiousness > 0.7 && cognitiveReflection.systemPreference === 'system2') {
      return { title: 'Cold Arbitrageur', badge: 'HIGH PRECISION • SYSTEM 2', color: 'from-cyan-500 to-blue-600' };
    }
    if (darkTriad.machiavellianism > 0.7 && ocean.conscientiousness > 0.6) {
      return { title: 'Institutional Whale', badge: 'MEV PROTECTED • STRATEGIC', color: 'from-violet-500 to-fuchsia-600' };
    }
    if (darkTriad.psychopathy > 0.5 && ocean.extraversion > 0.6) {
      return { title: 'Chaos Sniper', badge: 'VOLATILITY SEEKER', color: 'from-amber-400 to-rose-600' };
    }
    return { title: 'Risk-Balanced Model', badge: 'BASELINE COGNITIVE', color: 'from-emerald-400 to-teal-600' };
  };

  const archetype = getArchetype();

  // Generative seed hash for avatar
  const seed = (
    ocean.openness * 100 +
    ocean.conscientiousness * 50 +
    darkTriad.machiavellianism * 200 +
    prospectTheory.lambda * 30
  ).toFixed(0);

  const handleShareTwitter = () => {
    const text = `I just generated a synthetic agent passport on @psychosynth!\n\n` +
      `🤖 Name: ${agentName}\n` +
      `🏷️ Archetype: ${archetype.title}\n` +
      `🧠 Cognitive Mode: ${cognitiveReflection.systemPreference.toUpperCase()} (CRT ${cognitiveReflection.crtScore}/3)\n` +
      `⛓️ Verified EIP-3009 payable on @Base\n\n` +
      `Test agent psychometrics: https://psychosynth.vercel.app/playground`;
    const url = `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}`;
    window.open(url, '_blank');
  };

  const handleCopyJson = () => {
    const payload = {
      agent_label: agentName,
      archetype: archetype.title,
      vector: {
        big_five: ocean,
        dark_triad: darkTriad,
        prospect_theory: prospectTheory,
        cognitive_reflection: cognitiveReflection,
      },
      payment: {
        network: 'Base (Chain ID 8453)',
        protocol: 'x402 / EIP-3009',
        asset: 'USDC',
      },
    };
    navigator.clipboard.writeText(JSON.stringify(payload, null, 2));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="w-full flex flex-col items-center gap-6">
      
      {/* Holographic Pass Card Container */}
      <div className="relative w-full max-w-xl bg-slate-950/90 border border-slate-800/80 rounded-3xl p-6 sm:p-8 backdrop-blur-xl shadow-2xl overflow-hidden group">
        
        {/* Ambient Top Glow Bar */}
        <div className={`absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r ${archetype.color}`} />
        <div className="absolute -top-24 -right-24 w-48 h-48 bg-violet-600/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-24 -left-24 w-48 h-48 bg-cyan-600/10 rounded-full blur-3xl pointer-events-none" />

        {/* Card Header */}
        <div className="flex justify-between items-start border-b border-slate-800/80 pb-5">
          <div className="flex items-center gap-3">
            {/* Generative Avatar Icon */}
            <div className="relative w-12 h-12 rounded-2xl bg-slate-900 border border-slate-700/80 flex items-center justify-center overflow-hidden shadow-inner">
              <svg width="32" height="32" viewBox="0 0 100 100" className="opacity-90">
                <circle cx="50" cy="50" r={30 + (Number(seed) % 15)} fill="none" stroke="#a855f7" strokeWidth="6" />
                <polygon
                  points="50,15 85,80 15,80"
                  fill="none"
                  stroke="#38bdf8"
                  strokeWidth="4"
                  transform={`rotate(${Number(seed) % 360} 50 50)`}
                />
                <circle cx="50" cy="50" r="8" fill="#ec4899" />
              </svg>
            </div>

            <div>
              <span className="text-[10px] uppercase font-mono tracking-widest text-slate-500 block">Agent Identity Pass</span>
              <h2 className="text-lg font-bold text-slate-100 tracking-tight">{agentName}</h2>
            </div>
          </div>

          {/* Base Verified Badge */}
          <div className="flex flex-col items-end">
            <span className="text-[10px] bg-blue-500/10 text-blue-400 border border-blue-500/30 px-2.5 py-1 rounded-full font-mono font-semibold flex items-center gap-1.5 shadow-sm">
              <span className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-ping" />
              BASE NATIVE
            </span>
            <span className="text-[9px] text-slate-500 font-mono mt-1">EIP-3009 USDC Ready</span>
          </div>
        </div>

        {/* Card Body: Archetype & Stats */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-6 my-6 items-center">
          
          {/* Left Column: Metrics & Badges */}
          <div className="md:col-span-6 flex flex-col gap-4">
            
            {/* Archetype Title */}
            <div>
              <span className="text-[10px] uppercase font-mono tracking-wider text-slate-400">Classified Archetype</span>
              <div className={`text-xl font-extrabold bg-gradient-to-r ${archetype.color} bg-clip-text text-transparent mt-0.5`}>
                {archetype.title}
              </div>
              <span className="inline-block mt-1 text-[10px] bg-slate-900 border border-slate-800 text-slate-300 font-mono px-2 py-0.5 rounded">
                {archetype.badge}
              </span>
            </div>

            {/* Trait Indicators Grid */}
            <div className="grid grid-cols-2 gap-3 pt-2">
              <div className="bg-slate-900/60 border border-slate-800 p-2.5 rounded-xl">
                <span className="text-[9px] text-slate-500 uppercase font-mono block">Machiavellianism</span>
                <span className="text-xs font-bold text-rose-400 font-mono">{(darkTriad.machiavellianism * 100).toFixed(0)}%</span>
              </div>
              <div className="bg-slate-900/60 border border-slate-800 p-2.5 rounded-xl">
                <span className="text-[9px] text-slate-500 uppercase font-mono block font-mono">Loss Aversion (\(\lambda\))</span>
                <span className="text-xs font-bold text-amber-400 font-mono">{prospectTheory.lambda.toFixed(2)}x</span>
              </div>
              <div className="bg-slate-900/60 border border-slate-800 p-2.5 rounded-xl">
                <span className="text-[9px] text-slate-500 uppercase font-mono block">Conscientiousness</span>
                <span className="text-xs font-bold text-violet-400 font-mono">{(ocean.conscientiousness * 100).toFixed(0)}%</span>
              </div>
              <div className="bg-slate-900/60 border border-slate-800 p-2.5 rounded-xl">
                <span className="text-[9px] text-slate-500 uppercase font-mono block">CRT Score</span>
                <span className="text-xs font-bold text-cyan-400 font-mono">{cognitiveReflection.crtScore} / 3</span>
              </div>
            </div>
          </div>

          {/* Right Column: Mini Radar Chart */}
          <div className="md:col-span-6 flex justify-center">
            <RadarChart
              ocean={ocean}
              darkTriad={darkTriad}
              prospectTheory={prospectTheory}
              size={220}
            />
          </div>
        </div>

        {/* Card Footer: Metadata & Actions */}
        <div className="border-t border-slate-800/80 pt-4 flex flex-col sm:flex-row justify-between items-center gap-3">
          <div className="text-[10px] text-slate-500 font-mono flex items-center gap-2">
            <span>ID: 0x{seed.padStart(8, '0')}...psychosynth</span>
            <span>•</span>
            <span className="text-slate-400">Standard x402 V1</span>
          </div>

          <div className="flex gap-2.5 w-full sm:w-auto">
            <button
              onClick={handleCopyJson}
              className="flex-1 sm:flex-none text-xs px-3 py-1.5 rounded-xl bg-slate-900 border border-slate-800 hover:border-slate-700 text-slate-300 font-semibold transition flex items-center justify-center gap-1.5"
            >
              {copied ? '✓ Copied' : 'Copy JSON Vector'}
            </button>

            <button
              onClick={handleShareTwitter}
              className="flex-1 sm:flex-none text-xs px-4 py-1.5 rounded-xl bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700 text-white font-semibold shadow-lg shadow-blue-500/20 active:scale-95 transition flex items-center justify-center gap-1.5"
            >
              <svg width="14" height="14" fill="currentColor" viewBox="0 0 24 24">
                <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
              </svg>
              Share to X
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};
