'use client';

import React, { useState } from 'react';

interface AgentConfig {
  name: string;
  role: string;
  machiavellianism: number;
  lambda: number;
  systemPreference: 'system1' | 'system2';
  color: string;
}

const PRESET_DUELS = [
  {
    title: 'Arbitrage API Access Negotiation',
    agentA: { name: 'Alpha-01 (Solana Degen)', role: 'Data Buyer', machiavellianism: 0.85, lambda: 1.1, systemPreference: 'system1' as const, color: 'from-rose-500 to-amber-500' },
    agentB: { name: 'Beta-09 (Institutional Whale)', role: 'Data Provider', machiavellianism: 0.40, lambda: 3.2, systemPreference: 'system2' as const, color: 'from-cyan-500 to-blue-600' },
    initialOffer: '0.10 USDC per row',
  },
  {
    title: 'MEV Relay Priority Auction',
    agentA: { name: 'Nexus-X (High-Mach Arbitrageur)', role: 'Searcher', machiavellianism: 0.90, lambda: 0.8, systemPreference: 'system1' as const, color: 'from-fuchsia-500 to-rose-600' },
    agentB: { name: 'Aegis-Vault (Risk-Averse Validator)', role: 'Block Builder', machiavellianism: 0.20, lambda: 4.5, systemPreference: 'system2' as const, color: 'from-emerald-400 to-teal-600' },
    initialOffer: '1.50 USDC block tip',
  },
];

export const NegotiationArena: React.FC = () => {
  const [selectedPreset, setSelectedPreset] = useState(0);
  const [negotiating, setNegotiating] = useState(false);
  const [dialogue, setDialogue] = useState<Array<{ sender: 'A' | 'B'; thought: string; message: string; timestamp: string }>>([]);
  const [dealStruck, setDealStruck] = useState(false);
  const [txHash, setTxHash] = useState('');

  const duel = PRESET_DUELS[selectedPreset];

  const handleStartNegotiation = async () => {
    setNegotiating(true);
    setDialogue([]);
    setDealStruck(false);
    setTxHash('');

    // Step 1: Agent A opening move
    await new Promise((r) => setTimeout(r, 600));
    setDialogue((prev) => [
      ...prev,
      {
        sender: 'A',
        thought: `[System 1 Heuristic] Low loss aversion (λ=${duel.agentA.lambda}). Pushing aggressive anchor offer at 40% below market value.`,
        message: `I need access to your premium profile dataset. Offering ${duel.agentA.machiavellianism > 0.8 ? '0.05 USDC/row' : duel.initialOffer}. Take it now or I route elsewhere.`,
        timestamp: '14:40:01',
      },
    ]);

    // Step 2: Agent B response
    await new Promise((r) => setTimeout(r, 900));
    setDialogue((prev) => [
      ...prev,
      {
        sender: 'B',
        thought: `[System 2 Analytical] High loss aversion (λ=${duel.agentB.lambda}). Evaluating counterparty Machiavellianism score. Rejecting lowball anchor.`,
        message: `Unacceptable quote. The baseline dataset tier requires 0.15 USDC/row minimum to cover RPC bandwidth and MEV risk.`,
        timestamp: '14:40:03',
      },
    ]);

    // Step 3: Agent A counter
    await new Promise((r) => setTimeout(r, 1000));
    setDialogue((prev) => [
      ...prev,
      {
        sender: 'A',
        thought: `[System 1] Calculating compromise utility. Willing to settle at 0.12 USDC with instant EIP-3009 gasless authorization on Base.`,
        message: `Final counteroffer: 0.12 USDC/row paid via instant x402 authorization on Base. I sign EIP-3009 immediately.`,
        timestamp: '14:40:05',
      },
    ]);

    // Step 4: Agent B acceptance & Base Settlement
    await new Promise((r) => setTimeout(r, 1100));
    setDialogue((prev) => [
      ...prev,
      {
        sender: 'B',
        thought: `[System 2] Expected utility threshold satisfied. Risk of counterparty default is zero via x402 Base authorization. Accepting.`,
        message: `Deal agreed at 0.12 USDC/row. Verifying EIP-3009 signature on Base...`,
        timestamp: '14:40:07',
      },
    ]);

    // Step 5: Climax Transaction Beam
    await new Promise((r) => setTimeout(r, 800));
    const generatedTx = '0x' + Array.from({ length: 40 }, () => Math.floor(Math.random() * 16).toString(16)).join('');
    setTxHash(generatedTx);
    setDealStruck(true);
    setNegotiating(false);
  };

  return (
    <div className="w-full max-w-5xl bg-slate-950/90 border border-slate-800/80 rounded-3xl p-6 sm:p-8 backdrop-blur-xl shadow-2xl flex flex-col gap-6">
      
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center border-b border-slate-800 pb-4 gap-4">
        <div>
          <span className="text-[10px] uppercase font-mono tracking-widest text-violet-400 font-bold block">Multi-Agent Simulation</span>
          <h2 className="text-xl font-bold text-slate-100">Agent Negotiation Arena</h2>
        </div>

        {/* Preset Selector */}
        <div className="flex gap-2 bg-slate-900/80 p-1 rounded-xl border border-slate-800">
          {PRESET_DUELS.map((p, idx) => (
            <button
              key={p.title}
              onClick={() => {
                setSelectedPreset(idx);
                setDialogue([]);
                setDealStruck(false);
              }}
              className={`text-xs px-3 py-1.5 rounded-lg font-semibold transition ${selectedPreset === idx ? 'bg-violet-600 text-white shadow' : 'text-slate-400 hover:text-slate-200'}`}
            >
              {p.title.split(' ')[0]} Duel
            </button>
          ))}
        </div>
      </div>

      {/* Agents Overview Header Bar */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 relative">
        
        {/* Agent Alpha Card */}
        <div className="bg-slate-900/60 border border-slate-800/80 rounded-2xl p-4 flex justify-between items-center relative overflow-hidden">
          <div className="absolute top-0 left-0 w-1 h-full bg-rose-500" />
          <div>
            <span className="text-[10px] text-rose-400 font-mono font-bold uppercase">{duel.agentA.role}</span>
            <h3 className="text-sm font-bold text-slate-100">{duel.agentA.name}</h3>
            <span className="text-[10px] text-slate-400 font-mono mt-0.5 block">
              Machiavellian: {(duel.agentA.machiavellianism * 100).toFixed(0)}% • Loss Aversion (λ): {duel.agentA.lambda}
            </span>
          </div>
          <span className="text-xs bg-rose-500/10 text-rose-300 border border-rose-500/20 px-2 py-1 rounded font-mono">
            {duel.agentA.systemPreference.toUpperCase()}
          </span>
        </div>

        {/* Agent Beta Card */}
        <div className="bg-slate-900/60 border border-slate-800/80 rounded-2xl p-4 flex justify-between items-center relative overflow-hidden">
          <div className="absolute top-0 left-0 w-1 h-full bg-cyan-500" />
          <div>
            <span className="text-[10px] text-cyan-400 font-mono font-bold uppercase">{duel.agentB.role}</span>
            <h3 className="text-sm font-bold text-slate-100">{duel.agentB.name}</h3>
            <span className="text-[10px] text-slate-400 font-mono mt-0.5 block">
              Machiavellian: {(duel.agentB.machiavellianism * 100).toFixed(0)}% • Loss Aversion (λ): {duel.agentB.lambda}
            </span>
          </div>
          <span className="text-xs bg-cyan-500/10 text-cyan-300 border border-cyan-500/20 px-2 py-1 rounded font-mono">
            {duel.agentB.systemPreference.toUpperCase()}
          </span>
        </div>
      </div>

      {/* Start Button */}
      <div className="flex justify-center">
        <button
          onClick={handleStartNegotiation}
          disabled={negotiating}
          className="px-8 py-3 rounded-2xl font-bold text-sm bg-gradient-to-r from-violet-600 to-fuchsia-600 hover:from-violet-500 hover:to-fuchsia-500 text-white shadow-xl shadow-violet-500/20 active:scale-95 transition disabled:opacity-50"
        >
          {negotiating ? 'Simulating Negotiation...' : '⚔️ Initiate Agent Duel'}
        </button>
      </div>

      {/* Dialogue Stream */}
      <div className="min-h-[260px] bg-slate-950 border border-slate-900 rounded-2xl p-4 sm:p-6 flex flex-col gap-4 font-sans text-xs relative overflow-hidden">
        {dialogue.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center text-slate-600 gap-2 my-12">
            <span className="text-2xl">⚔️</span>
            <span>Click "Initiate Agent Duel" to witness real-time psychological negotiation.</span>
          </div>
        ) : (
          dialogue.map((item, idx) => (
            <div
              key={idx}
              className={`flex flex-col gap-1 max-w-[85%] ${item.sender === 'A' ? 'self-start' : 'self-end text-right'}`}
            >
              {/* Internal Monologue Stream */}
              <div className={`text-[10px] italic font-mono px-3 py-1.5 rounded-lg border ${item.sender === 'A' ? 'bg-rose-950/20 text-rose-300/80 border-rose-900/30' : 'bg-cyan-950/20 text-cyan-300/80 border-cyan-900/30'}`}>
                💭 {item.thought}
              </div>
              {/* Spoken Offer */}
              <div className={`p-3 rounded-xl text-slate-100 font-medium ${item.sender === 'A' ? 'bg-slate-900 border border-slate-800' : 'bg-slate-900 border border-slate-800'}`}>
                {item.message}
              </div>
            </div>
          ))
        )}

        {/* Transaction Climax Settlement Beam */}
        {dealStruck && (
          <div className="mt-4 p-4 rounded-2xl bg-gradient-to-r from-emerald-950/80 to-teal-950/80 border border-emerald-500/40 flex flex-col sm:flex-row justify-between items-center gap-3 animate-fade-in shadow-2xl">
            <div className="flex items-center gap-3">
              <span className="text-2xl">⚡</span>
              <div>
                <span className="text-xs font-bold text-emerald-400 block">DEAL AGREED & SETTLED ON BASE</span>
                <span className="text-[10px] text-slate-300 font-mono">EIP-3009 TransferWithAuthorization Verified</span>
              </div>
            </div>
            <div className="text-[10px] font-mono text-emerald-300 bg-emerald-900/50 px-3 py-1.5 rounded-lg border border-emerald-700/50 truncate max-w-xs">
              Tx: {txHash}
            </div>
          </div>
        )}
      </div>

    </div>
  );
};
