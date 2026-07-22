'use client';

import React, { useState } from 'react';

export const HandshakeVisualizer: React.FC = () => {
  const [activeStep, setActiveStep] = useState<number>(0);
  const [simulating, setSimulating] = useState(false);

  const steps = [
    {
      step: 1,
      title: '1. Initial Agent Request',
      method: 'GET',
      path: '/api/v1/query/personality-profile-library',
      desc: 'The autonomous agent initiates an unauthenticated request for dataset records.',
      status: '200 / Initial',
    },
    {
      step: 2,
      title: '2. HTTP 402 Payment Required',
      method: '402 PAYMENT REQUIRED',
      path: 'Headers: X-PAYMENT-QUOTE',
      desc: 'Server returns a structured x402 payment demand specifying asset (USDC on Base), price ($0.01), recipient wallet, and `@x402/extensions` Bazaar metadata.',
      status: '402 Quote Received',
    },
    {
      step: 3,
      title: '3. EIP-3009 Gasless Signing',
      method: 'EIP-712 SIGNATURE',
      path: 'TransferWithAuthorization(from, to, value, validAfter, validBefore, nonce)',
      desc: 'The agent wallet signs an off-chain authorization message. No ETH gas is consumed by the buyer wallet.',
      status: 'Signed',
    },
    {
      step: 4,
      title: '4. Base On-Chain Settlement',
      method: 'FACILITATOR BROADCAST',
      path: 'Base Mainnet (Chain ID 8453)',
      desc: 'The x402 facilitator submits the signed EIP-3009 authorization to the USDC smart contract on Base.',
      status: 'Verified Block 1892542',
    },
    {
      step: 5,
      title: '5. Payload Unlocked',
      method: 'HTTP 200 OK',
      path: 'Decrypted JSON Response',
      desc: 'The server verifies the on-chain transfer and returns the conditioned psychometric dataset payload.',
      status: '200 OK Delivered',
    },
  ];

  const runFullFlow = async () => {
    setSimulating(true);
    for (let i = 0; i < steps.length; i++) {
      setActiveStep(i);
      await new Promise((r) => setTimeout(r, 900));
    }
    setSimulating(false);
  };

  return (
    <div className="w-full max-w-4xl bg-slate-950/90 border border-slate-800/80 rounded-3xl p-6 sm:p-8 backdrop-blur-xl shadow-2xl flex flex-col gap-6">
      
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center border-b border-slate-800 pb-4 gap-4">
        <div>
          <span className="text-[10px] uppercase font-mono tracking-widest text-cyan-400 font-bold block">Protocol Architecture</span>
          <h2 className="text-xl font-bold text-slate-100">x402 Base Payment Handshake Inspector</h2>
        </div>

        <button
          onClick={runFullFlow}
          disabled={simulating}
          className="px-5 py-2 rounded-xl text-xs font-bold bg-cyan-500 hover:bg-cyan-400 text-slate-950 shadow-lg shadow-cyan-500/20 active:scale-95 transition disabled:opacity-50"
        >
          {simulating ? 'Running Inspector...' : '▶ Step Through Handshake'}
        </button>
      </div>

      {/* Steps Pipeline Navigation Bar */}
      <div className="grid grid-cols-5 gap-2">
        {steps.map((s, idx) => (
          <button
            key={s.step}
            onClick={() => setActiveStep(idx)}
            className={`p-3 rounded-xl border text-left flex flex-col gap-1 transition ${activeStep === idx ? 'bg-cyan-950/40 border-cyan-500 text-slate-100 shadow-md shadow-cyan-500/10' : 'bg-slate-900/40 border-slate-800 text-slate-400 hover:text-slate-200'}`}
          >
            <span className="text-[10px] font-mono font-bold uppercase">{`Step 0${s.step}`}</span>
            <span className="text-xs font-semibold truncate">{s.title.split('.')[1]}</span>
          </button>
        ))}
      </div>

      {/* Step Detail Display Card */}
      <div className="bg-slate-900/60 border border-slate-800/80 rounded-2xl p-6 flex flex-col gap-4 font-mono">
        <div className="flex justify-between items-center border-b border-slate-800 pb-3">
          <div className="flex items-center gap-2">
            <span className="text-xs px-2.5 py-1 rounded bg-slate-800 border border-slate-700 text-cyan-300 font-bold">
              {steps[activeStep].method}
            </span>
            <span className="text-xs text-slate-300">{steps[activeStep].path}</span>
          </div>
          <span className="text-[10px] text-emerald-400 bg-emerald-950/40 border border-emerald-800/60 px-2 py-0.5 rounded">
            {steps[activeStep].status}
          </span>
        </div>

        <p className="text-xs text-slate-300 font-sans leading-relaxed">
          {steps[activeStep].desc}
        </p>

        {/* Dynamic Code / JSON Mock Display */}
        <div className="bg-slate-950 p-4 rounded-xl border border-slate-900 text-xs overflow-x-auto">
          {activeStep === 0 && (
            <pre className="text-slate-300">
{`GET /api/v1/query/personality-profile-library HTTP/1.1
Host: psychosynth.vercel.app
Accept: application/json
User-Agent: AutonomousAgentRuntime/2.1`}
            </pre>
          )}

          {activeStep === 1 && (
            <pre className="text-amber-300/90">
{`HTTP/1.1 402 Payment Required
Content-Type: application/json

{
  "error": { "code": "payment_required", "message": "x402 payment required" },
  "quote": {
    "asset": "USDC",
    "network": "Base (Chain ID 8453)",
    "payTo": "0x7reeD...BaseWallet",
    "amountUsdc": 0.01,
    "scheme": "exact"
  },
  "extensions": {
    "bazaar": {
      "version": "1.0",
      "schema": { "properties": { "limit": { "type": "number" }, "tags": { "type": "string" } } }
    }
  }
}`}
            </pre>
          )}

          {activeStep === 2 && (
            <pre className="text-violet-300">
{`// EIP-712 Typed Data Structure
const domain = { name: 'USD Coin', version: '2', chainId: 8453, verifyingContract: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913' };
const types = {
  TransferWithAuthorization: [
    { name: 'from', type: 'address' },
    { name: 'to', type: 'address' },
    { name: 'value', type: 'uint256' },
    { name: 'validAfter', type: 'uint256' },
    { name: 'validBefore', type: 'uint256' },
    { name: 'nonce', type: 'bytes32' }
  ]
};

// Signature: 0x9f8e...71ab (Gasless for Buyer)`}
            </pre>
          )}

          {activeStep === 3 && (
            <pre className="text-cyan-300">
{`// Facilitator broadcast payload
POST https://facilitator.payai.network/settle
X-PAYMENT: {
  "scheme": "exact",
  "authorization": { "from": "0xAgentWallet", "to": "0x7reeD...BaseWallet", "value": "10000", "signature": "0x9f8e..." }
}

Result: Settlement confirmed on Base in 1.2s. Gas paid by Facilitator.`}
            </pre>
          )}

          {activeStep === 4 && (
            <pre className="text-emerald-300">
{`HTTP/1.1 200 OK
Content-Type: application/json

{
  "status": "success",
  "data": [
    {
      "profile_id": "prof_9824",
      "mbti": "INTJ",
      "decision_style": "analytical",
      "prospect_theory": { "lambda": 2.25, "alpha": 0.88, "beta": 0.88 },
      "dark_triad": { "machiavellianism": 0.75 }
    }
  ]
}`}
            </pre>
          )}
        </div>
      </div>

    </div>
  );
};
