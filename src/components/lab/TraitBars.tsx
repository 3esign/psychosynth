'use client';

export function TraitBars({ bigFive }: { bigFive: Record<string, number> }) {
  const traits = ['openness', 'conscientiousness', 'extraversion', 'agreeableness', 'neuroticism'];
  const abbreviations: Record<string, string> = {
    openness: 'O',
    conscientiousness: 'C',
    extraversion: 'E',
    agreeableness: 'A',
    neuroticism: 'N',
  };

  return (
    <div className="space-y-3 bg-neutral-950/40 p-4 rounded-xl border border-neutral-900 shadow-inner">
      {traits.map(trait => {
        const val = bigFive[trait] ?? 0;
        return (
          <div key={trait} className="flex items-center text-xs">
            <span className="w-20 text-neutral-400 capitalize font-medium flex items-center gap-1.5">
              <span className="inline-flex h-5 w-5 items-center justify-center rounded-md bg-purple-500/10 text-[10px] font-bold text-purple-400 border border-purple-500/20">
                {abbreviations[trait]}
              </span>
              {trait.slice(0, 4)}
            </span>
            <div className="flex-1 h-1.5 bg-neutral-900 rounded-full overflow-hidden ml-2 border border-neutral-900/50">
              <div
                className="h-full bg-purple-500 shadow-[0_0_10px_rgba(168,85,247,0.5)] rounded-full transition-all duration-500"
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
  );
}
