'use client';

import { useState, useEffect, useRef } from 'react';
import { SchemaForm } from '@/components/lab/SchemaForm';

export default function RunPage() {
  const [generators, setGenerators] = useState<any[]>([]);
  const [selectedGen, setSelectedGen] = useState<any>(null);
  const [params, setParams] = useState<Record<string, any>>({});
  const [count, setCount] = useState<number>(20);
  const [runs, setRuns] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Poll intervals tracker
  const pollersRef = useRef<Record<string, NodeJS.Timeout>>({});

  // Toast notifications
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  const showToast = (message: string, type: 'success' | 'error' = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  };

  // Fetch active generators and run history
  useEffect(() => {
    const init = async () => {
      try {
        // Fetch generators
        const genRes = await fetch('/api/lab/generators');
        if (!genRes.ok) throw new Error('Failed to fetch generators');
        const genData = await genRes.json();
        
        // Filter active generators
        const active = (genData.items || []).filter((g: any) => g.status === 'active');
        setGenerators(active);
        
        if (active.length > 0) {
          setSelectedGen(active[0]);
          // Initialize params with defaults from schema
          const defaults: Record<string, any> = {};
          const props = active[0].params_schema?.properties || {};
          Object.entries<any>(props).forEach(([k, p]) => {
            if (p.default !== undefined) defaults[k] = p.default;
          });
          setParams(defaults);
        }

        // Fetch run history (last 20 runs)
        const runRes = await fetch('/api/lab/runs');
        if (runRes.ok) {
          const runData = await runRes.json();
          setRuns(runData.items || []);
          (runData.items || []).forEach((r: any) => {
            if (r.status === 'running') {
              startPolling(r.id);
            }
          });
        }
      } catch (err: any) {
        setError(err.message || 'Initialization failed');
      } finally {
        setLoading(false);
      }
    };

    init();

    // Clean up pollers on unmount
    return () => {
      Object.values(pollersRef.current).forEach(clearInterval);
    };
  }, []);

  const loadHistory = async () => {
    try {
      const res = await fetch('/api/lab/runs');
      if (res.ok) {
        const data = await res.json();
        setRuns(data.items || []);
        
        // Start polling for any running runs in the history
        (data.items || []).forEach((r: any) => {
          if (r.status === 'running') {
            startPolling(r.id);
          }
        });
      }
    } catch {}
  };

  useEffect(() => {
    if (generators.length > 0) {
      loadHistory();
    }
  }, [generators]);

  // Poller function
  const startPolling = (runId: string) => {
    if (pollersRef.current[runId]) return;

    const interval = setInterval(async () => {
      try {
        const res = await fetch(`/api/lab/runs/${runId}`);
        if (!res.ok) return;
        const run = await res.json();

        // Update run in state
        setRuns(prev => prev.map(r => r.id === runId ? run : r));

        if (run.status === 'done' || run.status === 'failed') {
          clearInterval(interval);
          delete pollersRef.current[runId];
          showToast(`Generator run ${run.status === 'done' ? 'completed successfully!' : 'failed.'}`, run.status === 'done' ? 'success' : 'error');
        }
      } catch {}
    }, 2000);

    pollersRef.current[runId] = interval;
  };

  const handleGeneratorChange = (slug: string) => {
    const gen = generators.find(g => g.slug === slug);
    if (!gen) return;
    setSelectedGen(gen);
    
    // Reset params with defaults
    const defaults: Record<string, any> = {};
    const props = gen.params_schema?.properties || {};
    Object.entries<any>(props).forEach(([k, p]) => {
      if (p.default !== undefined) defaults[k] = p.default;
    });
    setParams(defaults);
  };

  const handleRunSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedGen) return;

    setRunning(true);
    setError(null);

    try {
      const res = await fetch('/api/lab/runs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          generator_slug: selectedGen.slug,
          params,
          count,
        }),
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.message || 'Failed to trigger run');
      }

      const { runId } = await res.json();
      showToast('Generation run started in the background.');

      // Refresh history & start polling
      await loadHistory();
      startPolling(runId);
    } catch (err: any) {
      setError(err.message || 'Error triggering generator run');
    } finally {
      setRunning(false);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="space-y-4 text-center">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-purple-500 border-t-transparent mx-auto"></div>
          <div className="text-neutral-500 animate-pulse text-xs tracking-widest uppercase font-mono">
            Loading Generator cockpit...
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Toast Alert */}
      {toast && (
        <div className="fixed bottom-6 right-6 z-50 flex items-center gap-2 rounded-xl border border-neutral-800 bg-neutral-950 p-4 text-xs font-mono text-white shadow-2xl transition-all animate-bounce">
          <span className={`h-2 w-2 rounded-full ${toast.type === 'error' ? 'bg-red-500 animate-pulse' : 'bg-green-500'}`}></span>
          <span>{toast.message}</span>
        </div>
      )}

      {/* Header */}
      <div className="border-b border-neutral-900 pb-4">
        <h1 className="text-xl font-bold tracking-tight text-white font-sans flex items-center gap-2">
          Run Generator
          <span className="inline-flex h-2 w-2 rounded-full bg-green-500"></span>
        </h1>
        <p className="text-xs text-neutral-500 font-mono mt-1">
          Synthesize new personality profile batches in the background
        </p>
      </div>

      {error && (
        <div className="rounded-xl border border-red-500/20 bg-red-500/10 p-4 text-xs font-semibold text-red-400 font-mono">
          <div className="flex items-start gap-2">
            <span className="h-2 w-2 rounded-full bg-red-500 mt-1.5 flex-shrink-0 animate-pulse"></span>
            <div className="space-y-1">
              <div className="font-bold uppercase tracking-wider text-[10px]">Execution Error:</div>
              <p>{error}</p>
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left Column: Form Settings */}
        <div className="lg:col-span-1 rounded-2xl border border-neutral-900 bg-neutral-900/10 p-6 shadow-2xl space-y-6 self-start">
          <h2 className="text-xs font-bold text-neutral-400 uppercase tracking-widest font-mono border-b border-neutral-900 pb-3">
            Generator Configuration
          </h2>

          <form onSubmit={handleRunSubmit} className="space-y-5">
            {/* Dropdown select active generator */}
            <div className="space-y-1.5">
              <label className="block text-xs font-semibold uppercase tracking-wider text-neutral-400 font-mono">
                Select Active Model
              </label>
              <select
                value={selectedGen?.slug || ''}
                onChange={e => handleGeneratorChange(e.target.value)}
                disabled={running}
                className="block w-full rounded-xl border border-neutral-900 bg-neutral-950 px-4 py-3 text-sm text-white outline-none focus:border-purple-600 focus:ring-1 focus:ring-purple-600 disabled:opacity-50"
              >
                {generators.map((g: any) => (
                  <option key={g.slug} value={g.slug} className="bg-neutral-950 text-white">
                    {g.slug} (v{g.version})
                  </option>
                ))}
              </select>
            </div>

            {/* Render dynamic SchemaForm */}
            {selectedGen && (
              <SchemaForm
                schema={selectedGen.params_schema}
                value={params}
                onChange={setParams}
              />
            )}

            {/* Batch count field */}
            <div className="space-y-1.5 border-t border-neutral-900/60 pt-4">
              <label className="block text-xs font-semibold uppercase tracking-wider text-neutral-400 font-mono">
                Batch Target Count (Profiles)
              </label>
              <input
                type="number"
                min={1}
                max={100}
                required
                value={count}
                onChange={e => setCount(parseInt(e.target.value, 10))}
                disabled={running}
                className="block w-full rounded-xl border border-neutral-900 bg-neutral-950 px-4 py-3 text-sm text-white placeholder-neutral-700 outline-none focus:border-purple-600 focus:ring-1 focus:ring-purple-600 disabled:opacity-50"
              />
              <span className="block text-[10px] text-neutral-500 font-mono">
                Specify number of profiles to generate in this job batch
              </span>
            </div>

            <button
              type="submit"
              disabled={running || !selectedGen}
              className="group relative flex w-full justify-center rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 py-3 text-xs font-bold uppercase tracking-wider text-white shadow-lg shadow-purple-500/10 outline-none hover:brightness-110 focus:ring-2 focus:ring-purple-600 disabled:opacity-50"
            >
              {running ? 'Submitting Batch Job...' : 'Execute Generator Run'}
            </button>
          </form>
        </div>

        {/* Right 2 Columns: Run History Table */}
        <div className="lg:col-span-2 rounded-2xl border border-neutral-900 bg-neutral-900/10 p-6 shadow-2xl space-y-4">
          <h2 className="text-xs font-bold text-neutral-400 uppercase tracking-widest font-mono border-b border-neutral-900 pb-3">
            Batch Run History (Last 20)
          </h2>

          <div className="overflow-x-auto">
            <table className="w-full text-left font-mono text-xs border-collapse">
              <thead>
                <tr className="border-b border-neutral-900 text-neutral-500">
                  <th className="pb-3 font-semibold uppercase tracking-wider text-[10px] w-2/5">Generator</th>
                  <th className="pb-3 font-semibold uppercase tracking-wider text-[10px]">Status</th>
                  <th className="pb-3 font-semibold uppercase tracking-wider text-[10px] text-right">Progress</th>
                  <th className="pb-3 font-semibold uppercase tracking-wider text-[10px] text-right">Cost (USD)</th>
                  <th className="pb-3 font-semibold uppercase tracking-wider text-[10px] text-right">Created</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-900/40">
                {runs.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-8 text-center text-neutral-600 italic">
                      No runs executed yet. Trigger a run on the left.
                    </td>
                  </tr>
                ) : (
                  runs.map((r: any) => {
                    const progress = `${r.items_created}/${r.items_requested}`;
                    const age = new Date(r.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
                    
                    return (
                      <tr key={r.id} className="hover:bg-neutral-950/20 transition-colors">
                        <td className="py-3.5 pr-4 truncate font-medium text-neutral-300">
                          {r.generator_slug}@v{r.generator_ver}
                        </td>
                        <td className="py-3.5">
                          <span
                            className={`inline-flex px-2 py-0.5 rounded text-[10px] font-bold uppercase border ${
                              r.status === 'done'
                                ? 'bg-green-500/10 text-green-400 border-green-500/20'
                                : r.status === 'failed'
                                ? 'bg-red-500/10 text-red-400 border-red-500/20'
                                : 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20 animate-pulse'
                            }`}
                          >
                            {r.status}
                          </span>
                        </td>
                        <td className="py-3.5 text-right font-semibold text-neutral-400">
                          {progress}
                        </td>
                        <td className="py-3.5 text-right text-neutral-400">
                          ${Number(r.cost_usd || 0).toFixed(4)}
                        </td>
                        <td className="py-3.5 text-right text-neutral-500">
                          {age}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
