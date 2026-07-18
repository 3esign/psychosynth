'use client';

interface DarkTriad {
  machiavellianism: number;
  narcissism: number;
  psychopathy: number;
}

interface ProspectTheory {
  loss_aversion_lambda: number;
  risk_aversion_gains_alpha: number;
  risk_seeking_losses_beta: number;
}

interface CognitiveReflection {
  system_preference: 'system_1' | 'system_2' | 'hybrid';
  crt_score: number;
}

interface AdvancedParamsProps {
  darkTriad?: DarkTriad;
  prospectTheory?: ProspectTheory;
  cognitiveReflection?: CognitiveReflection;
}

export function AdvancedParams({ darkTriad, prospectTheory, cognitiveReflection }: AdvancedParamsProps) {
  if (!darkTriad && !prospectTheory && !cognitiveReflection) {
    return null;
  }

  const dtTraits = ['machiavellianism', 'narcissism', 'psychopathy'];
  const dtLabels: Record<string, string> = {
    machiavellianism: 'Machiavellianism',
    narcissism: 'Narcissism',
    psychopathy: 'Psychopathy',
  };
  const dtAbbr: Record<string, string> = {
    machiavellianism: 'Mach',
    narcissism: 'Narc',
    psychopathy: 'Psyc',
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
      {/* Dark Triad Section */}
      {darkTriad && (
        <div className="space-y-2">
          <span className="text-[10px] font-bold uppercase tracking-wider text-rose-400 font-mono block">
            Dark Triad Traits
          </span>
          <div className="space-y-3 bg-neutral-950/40 p-4 rounded-xl border border-neutral-900 shadow-inner">
            {dtTraits.map(trait => {
              const val = (darkTriad as any)[trait] ?? 0;
              return (
                <div key={trait} className="flex items-center text-xs">
                  <span className="w-20 text-neutral-400 capitalize font-medium flex items-center gap-1.5" title={dtLabels[trait]}>
                    <span className="inline-flex h-5 w-5 items-center justify-center rounded-md bg-rose-500/10 text-[9px] font-bold text-rose-400 border border-rose-500/20">
                      {dtAbbr[trait]}
                    </span>
                    {trait.slice(0, 4)}
                  </span>
                  <div className="flex-1 h-1.5 bg-neutral-900 rounded-full overflow-hidden ml-2 border border-neutral-900/50">
                    <div
                      className="h-full bg-rose-500 shadow-[0_0_10px_rgba(244,63,94,0.5)] rounded-full transition-all duration-500"
                      style={{ width: `${val * 100}%` }}
                    ></div>
                  </div>
                  <span className="w-10 text-right text-neutral-400 font-mono ml-2">
                    {val.toFixed(2)}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Prospect Theory Parameters */}
      {prospectTheory && (
        <div className="space-y-2">
          <span className="text-[10px] font-bold uppercase tracking-wider text-amber-400 font-mono block">
            Prospect Theory Posture
          </span>
          <div className="grid grid-cols-3 gap-2 bg-neutral-950/40 p-3 rounded-xl border border-neutral-900 shadow-inner font-mono text-[10px]">
            <div className="text-center p-2 rounded bg-neutral-950 border border-neutral-900/50">
              <span className="text-neutral-500 uppercase text-[8px] block mb-0.5">Loss Aversion</span>
              <span className="text-amber-400 font-bold text-sm block">
                λ = {Number(prospectTheory.loss_aversion_lambda || 0).toFixed(2)}
              </span>
            </div>
            <div className="text-center p-2 rounded bg-neutral-950 border border-neutral-900/50">
              <span className="text-neutral-500 uppercase text-[8px] block mb-0.5">Gains Utility</span>
              <span className="text-emerald-400 font-bold text-sm block">
                α = {Number(prospectTheory.risk_aversion_gains_alpha || 0).toFixed(2)}
              </span>
            </div>
            <div className="text-center p-2 rounded bg-neutral-950 border border-neutral-900/50">
              <span className="text-neutral-500 uppercase text-[8px] block mb-0.5">Losses Utility</span>
              <span className="text-rose-400 font-bold text-sm block">
                β = {Number(prospectTheory.risk_seeking_losses_beta || 0).toFixed(2)}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Cognitive Reflection Attributes */}
      {cognitiveReflection && (
        <div className="space-y-2">
          <span className="text-[10px] font-bold uppercase tracking-wider text-cyan-400 font-mono block">
            Cognitive Reflection
          </span>
          <div className="grid grid-cols-2 gap-2 bg-neutral-950/40 p-3 rounded-xl border border-neutral-900 shadow-inner font-mono text-xs">
            <div className="flex justify-between items-center px-3 py-2 rounded bg-neutral-950 border border-neutral-900/50">
              <span className="text-neutral-500 text-[9px] uppercase">Preference</span>
              <span className="text-cyan-400 font-bold capitalize text-[10px]">
                {cognitiveReflection.system_preference.replace('_', ' ')}
              </span>
            </div>
            <div className="flex justify-between items-center px-3 py-2 rounded bg-neutral-950 border border-neutral-900/50">
              <span className="text-neutral-500 text-[9px] uppercase">CRT Score</span>
              <span className="text-cyan-400 font-bold text-[10px]">
                {cognitiveReflection.crt_score} / 3
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
