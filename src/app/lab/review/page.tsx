'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { TraitBars } from '@/components/lab/TraitBars';
import { ReasonPalette } from '@/components/lab/ReasonPalette';
import { JsonEditor } from '@/components/lab/JsonEditor';

export default function ReviewPage() {
  const [queue, setQueue] = useState<any[]>([]);
  const [idx, setIdx] = useState(0);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [mode, setMode] = useState<'view' | 'reasons' | 'edit'>('view');
  
  // For 'other' rejection notes
  const [notes, setNotes] = useState('');
  const [pendingOtherRejectCode, setPendingOtherRejectCode] = useState<string | null>(null);

  // Time spent tracker
  const shownAtRef = useRef<number>(Date.now());

  // Toast notifications for rollback/errors
  const [toast, setToast] = useState<{ message: string; type: 'error' | 'success' } | null>(null);

  const showToast = (message: string, type: 'error' | 'success' = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  };

  // Fetch queue items
  const loadQueue = async (offset = 0, append = false) => {
    try {
      const res = await fetch(`/api/lab/queue?limit=20&offset=${offset}`);
      if (!res.ok) throw new Error('Failed to fetch queue');
      const data = await res.json();
      
      setQueue(prev => append ? [...prev, ...(data.items || [])] : (data.items || []));
      setTotal(data.total || 0);
    } catch (err: any) {
      showToast(err.message || 'Error loading queue', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadQueue(0, false);
  }, []);

  // Preload next items if remaining queue is small
  useEffect(() => {
    if (queue.length > 0 && queue.length - idx < 5) {
      // Append more items using the next offset
      loadQueue(queue.length, true);
    }
  }, [idx, queue.length]);

  // Reset timer on card change
  useEffect(() => {
    shownAtRef.current = Date.now();
  }, [idx]);

  const currentItem = queue[idx];
  const currentProfile = currentItem?.content;

  // Submit decision
  const submitDecision = async (decision: 'approved' | 'rejected' | 'edited_approved', extra: any = {}) => {
    if (!currentItem) return;

    const timeSpentMs = Date.now() - shownAtRef.current;
    const body = {
      entity_type: 'profile',
      entity_id: currentItem.entity_id,
      decision,
      time_spent_ms: timeSpentMs,
      ...extra,
    };

    // Store state for rollback
    const prevIdx = idx;
    const prevQueue = [...queue];

    // Optimistic Update: Remove from queue list and update counts
    setQueue(q => q.filter((_, i) => i !== idx));
    setTotal(t => Math.max(0, t - 1));
    // Keep index clamped
    setIdx(i => Math.min(i, Math.max(0, queue.length - 2)));
    setMode('view');
    setNotes('');
    setPendingOtherRejectCode(null);

    try {
      const res = await fetch('/api/lab/decisions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.message || 'Server rejected decision');
      }

      showToast(`Profile ${decision === 'rejected' ? 'rejected' : 'approved'} successfully!`);
    } catch (err: any) {
      // Rollback on failure
      setQueue(prevQueue);
      setIdx(prevIdx);
      setTotal(prevQueue.length);
      showToast(err.message || 'Failed to submit decision. Rolled back.', 'error');
    }
  };

  // Handles standard rejection reason select
  const handleSelectReason = (code: string) => {
    if (code === 'other') {
      setPendingOtherRejectCode('other');
    } else {
      submitDecision('rejected', { reason_code: code });
    }
  };

  const handleSubmitOtherReason = () => {
    if (!notes.trim()) return;
    submitDecision('rejected', { reason_code: 'other', notes });
  };

  const handleSaveEdit = (editedContent: any) => {
    submitDecision('edited_approved', { edited_content: editedContent });
  };

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (mode !== 'view') return; // let modals handle their keydowns
      if (document.activeElement?.tagName === 'TEXTAREA' || document.activeElement?.tagName === 'INPUT') {
        return; // ignore global hotkeys if typing
      }

      const key = e.key.toLowerCase();
      if (key === 'a') {
        submitDecision('approved');
      } else if (key === 'r') {
        setMode('reasons');
      } else if (key === 'e') {
        setMode('edit');
      } else if (key === 'j') {
        // Skip forward (without submitting)
        setIdx(i => Math.min(i + 1, queue.length - 1));
      } else if (key === 'k') {
        // Skip backward
        setIdx(i => Math.max(i - 1, 0));
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [mode, queue, idx]);

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="space-y-4 text-center">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-purple-500 border-t-transparent mx-auto"></div>
          <div className="text-neutral-500 animate-pulse text-xs tracking-widest uppercase font-mono">
            Loading Curation Queue...
          </div>
        </div>
      </div>
    );
  }

  if (queue.length === 0 || !currentItem) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center px-4">
        <div className="w-full max-w-md space-y-6 rounded-2xl border border-dashed border-neutral-800 bg-neutral-900/10 p-12 text-center">
          <div className="text-4xl">✨</div>
          <h3 className="text-white text-lg font-bold font-sans">Queue is clear</h3>
          <p className="text-neutral-400 text-sm font-mono leading-relaxed">
            All synthetic profiles have been processed. Run a generator to synthesize more.
          </p>
          <div className="pt-2">
            <Link
              href="/lab/run"
              className="inline-flex items-center justify-center rounded-xl bg-purple-600 px-6 py-3 text-xs font-bold text-white shadow-lg shadow-purple-500/10 hover:bg-purple-500 transition-all font-mono"
            >
              Go to Generator
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // Hook diagnostics: hook.executed events carry run_id but no entity_id (the
  // item isn't inserted yet when hooks fire), so results are per-RUN, not
  // per-card. Aggregate pass counts per hook and label them honestly.
  const renderHookDiagnostics = () => {
    if (!currentItem.hook_results || currentItem.hook_results.length === 0) {
      return <span className="text-neutral-600">None executed</span>;
    }

    const byHook: Record<string, { passed: number; total: number; scoreSum: number; scored: number }> = {};
    for (const r of currentItem.hook_results) {
      if (!r?.hook) continue;
      byHook[r.hook] ??= { passed: 0, total: 0, scoreSum: 0, scored: 0 };
      byHook[r.hook].total++;
      if (r.passed) byHook[r.hook].passed++;
      if (r.score !== null && r.score !== undefined) {
        byHook[r.hook].scoreSum += Number(r.score);
        byHook[r.hook].scored++;
      }
    }

    return (
      <div className="flex flex-wrap gap-2 text-[10px]">
        {Object.entries(byHook).map(([hook, s]) => (
          <span
            key={hook}
            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded border ${
              s.passed === s.total
                ? 'bg-green-500/10 text-green-400 border-green-500/20'
                : 'bg-red-500/10 text-red-400 border-red-500/20'
            }`}
          >
            <span>{hook}</span>
            <span className="opacity-60">{s.passed}/{s.total} passed</span>
            {s.scored > 0 && (
              <span className="opacity-60">avg {(s.scoreSum / s.scored).toFixed(2)}</span>
            )}
          </span>
        ))}
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {/* Toast Alert */}
      {toast && (
        <div className="fixed bottom-6 right-6 z-50 flex items-center gap-2 rounded-xl border border-neutral-800 bg-neutral-950 p-4 text-xs font-mono text-white shadow-2xl transition-all animate-bounce">
          <span className={`h-2 w-2 rounded-full ${toast.type === 'error' ? 'bg-red-500 animate-pulse' : 'bg-green-500'}`}></span>
          <span>{toast.message}</span>
        </div>
      )}

      {/* Header bar */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-neutral-900 pb-4">
        <div className="space-y-1">
          <h1 className="text-xl font-bold tracking-tight text-white font-sans flex items-center gap-2">
            Curation Queue
            <span className="inline-flex h-2 w-2 rounded-full bg-purple-500 animate-pulse"></span>
          </h1>
          <p className="text-xs text-neutral-500 font-mono">
            Keyboard Map: (A) Approve • (R) Reject Reason • (E) Edit JSON • (J/K) Skip Card
          </p>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs font-mono text-neutral-400 bg-neutral-900 border border-neutral-800 px-3 py-1.5 rounded-lg shadow-inner">
            Card {idx + 1} of {total} pending
          </span>
          <div className="flex rounded-lg border border-neutral-800 bg-neutral-950 p-0.5">
            <button
              onClick={() => setIdx(i => Math.max(0, i - 1))}
              disabled={idx === 0}
              className="px-3 py-1 text-xs text-neutral-400 hover:text-white disabled:opacity-30 transition-colors"
            >
              ◀
            </button>
            <button
              onClick={() => setIdx(i => Math.min(i + 1, queue.length - 1))}
              disabled={idx === queue.length - 1}
              className="px-3 py-1 text-xs text-neutral-400 hover:text-white disabled:opacity-30 transition-colors"
            >
              ▶
            </button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left 2 Columns: Profile Details Card */}
        <div className="lg:col-span-2 space-y-6">
          <div className="rounded-2xl border border-neutral-900 bg-neutral-900/20 p-8 shadow-2xl space-y-8 hover:border-purple-900/20 transition-all duration-300">
            {/* Top info */}
            <div className="flex justify-between items-start border-b border-neutral-900 pb-4">
              <div>
                <h2 className="text-lg font-bold text-white">Personality Profile</h2>
                <div className="text-[10px] text-neutral-500 font-mono mt-0.5">
                  Generated via <span className="text-purple-400">{currentItem.generator_slug}@v{currentItem.generator_ver}</span>
                </div>
              </div>
              <span className="px-3 py-1 rounded-md bg-neutral-950 border border-neutral-900 text-[10px] text-neutral-400 font-mono">
                Quality: {Number(currentItem.quality_score || 0).toFixed(2)}
              </span>
            </div>

            {/* Profile summary */}
            <div className="space-y-2">
              <span className="text-[10px] font-bold uppercase tracking-wider text-purple-400 font-mono">Behavioral Summary</span>
              <p className="text-sm text-neutral-200 leading-relaxed bg-neutral-950/80 p-5 rounded-xl border border-neutral-900/50 shadow-inner">
                {currentProfile.summary}
              </p>
            </div>

            {/* OCEAN / Traits and Badges */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-purple-400 font-mono block mb-2">Five-Factor Personality Matrix</span>
                <TraitBars bigFive={currentProfile.big_five} />
              </div>

              <div className="space-y-6">
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-purple-400 font-mono block mb-2">System Attributes</span>
                  <div className="rounded-xl border border-neutral-900 bg-neutral-950/40 p-4 space-y-3 font-mono text-xs shadow-inner">
                    <div className="flex justify-between items-center border-b border-neutral-900/50 pb-2">
                      <span className="text-neutral-500 text-[10px] uppercase">Decision Style</span>
                      <span className="text-neutral-300 font-medium capitalize">{currentProfile.decision_style}</span>
                    </div>
                    <div className="flex justify-between items-center border-b border-neutral-900/50 pb-2">
                      <span className="text-neutral-500 text-[10px] uppercase">MBTI Classification</span>
                      <span className="bg-purple-500/10 text-purple-400 border border-purple-500/20 px-2 py-0.5 rounded text-[10px] font-bold">
                        {currentProfile.mbti_label}
                      </span>
                    </div>
                    <div>
                      <span className="text-neutral-500 text-[10px] uppercase block mb-1.5">Metadata Tags</span>
                      <div className="flex flex-wrap gap-1">
                        {currentProfile.tags.map((t: string) => (
                          <span key={t} className="px-2 py-0.5 rounded bg-neutral-900 text-neutral-400 text-[10px] border border-neutral-800">
                            {t}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Cognitive Biases */}
            <div className="space-y-2">
              <span className="text-[10px] font-bold uppercase tracking-wider text-purple-400 font-mono block">Associated Cognitive Biases</span>
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                {currentProfile.suggested_biases.map((b: any) => (
                  <div key={b.slug} className="flex justify-between items-center p-3 rounded-xl border border-neutral-900 bg-neutral-950/30 hover:bg-neutral-900/20 transition-colors">
                    <span className="text-neutral-300 text-xs font-mono">{b.slug}</span>
                    <span className="text-purple-400 font-mono text-[10px] bg-purple-500/10 px-2 py-0.5 rounded border border-purple-500/20">
                      {b.strength.toFixed(2)}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Hook Diagnostics */}
            <div className="space-y-2 pt-2 border-t border-neutral-900">
              <span className="text-[10px] font-bold uppercase tracking-wider text-purple-400 font-mono block">Run Hook Diagnostics (all items in this run)</span>
              {renderHookDiagnostics()}
            </div>
          </div>
        </div>

        {/* Right Column: Actions Panel */}
        <div className="space-y-6">
          <div className="rounded-2xl border border-neutral-900 bg-neutral-950 p-6 shadow-2xl relative overflow-hidden space-y-6">
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-green-500 via-purple-500 to-red-500 opacity-50"></div>
            <h3 className="text-xs font-bold text-neutral-400 uppercase tracking-widest font-mono">
              Action Desk
            </h3>

            <div className="space-y-3">
              <button
                onClick={() => submitDecision('approved')}
                className="w-full py-4 rounded-xl bg-gradient-to-b from-green-600/20 to-green-600/10 hover:from-green-600/30 hover:to-green-600/20 text-green-400 border border-green-500/30 font-bold uppercase tracking-wider transition-all shadow-[0_0_15px_rgba(34,197,94,0.05)] hover:shadow-[0_0_25px_rgba(34,197,94,0.15)] flex justify-between items-center px-6"
              >
                <span>Approve Profile</span>
                <span className="text-xs font-mono font-bold bg-green-500/10 px-2 py-0.5 rounded border border-green-500/20">A</span>
              </button>

              <button
                onClick={() => setMode('reasons')}
                className="w-full py-4 rounded-xl bg-gradient-to-b from-red-600/20 to-red-600/10 hover:from-red-600/30 hover:to-red-600/20 text-red-400 border border-red-500/30 font-bold uppercase tracking-wider transition-all shadow-[0_0_15px_rgba(239,68,68,0.05)] hover:shadow-[0_0_25px_rgba(239,68,68,0.15)] flex justify-between items-center px-6"
              >
                <span>Reject Profile</span>
                <span className="text-xs font-mono font-bold bg-red-500/10 px-2 py-0.5 rounded border border-red-500/20">R</span>
              </button>

              <button
                onClick={() => setMode('edit')}
                className="w-full py-4 rounded-xl bg-gradient-to-b from-purple-600/20 to-purple-600/10 hover:from-purple-600/30 hover:to-purple-600/20 text-purple-400 border border-purple-500/30 font-bold uppercase tracking-wider transition-all shadow-[0_0_15px_rgba(168,85,247,0.05)] hover:shadow-[0_0_25px_rgba(168,85,247,0.15)] flex justify-between items-center px-6"
              >
                <span>Edit JSON & Approve</span>
                <span className="text-xs font-mono font-bold bg-purple-500/10 px-2 py-0.5 rounded border border-purple-500/20">E</span>
              </button>
            </div>
          </div>

          <div className="rounded-2xl border border-neutral-900 bg-neutral-900/20 p-6 shadow-2xl font-mono text-xs text-neutral-500 space-y-3">
            <div className="flex justify-between">
              <span>Generator:</span>
              <span className="text-neutral-400">{currentItem.generator_slug}</span>
            </div>
            <div className="flex justify-between">
              <span>Run ID:</span>
              <span className="text-neutral-400 font-mono text-[10px]">{currentItem.generation_run_id?.split('-')[0]}...</span>
            </div>
          </div>
        </div>
      </div>

      {/* Reason Palette Modal */}
      {mode === 'reasons' && (
        <ReasonPalette
          onSelect={handleSelectReason}
          onClose={() => setMode('view')}
          showNotesForm={pendingOtherRejectCode !== null}
          notes={notes}
          setNotes={setNotes}
          onSubmitOther={handleSubmitOtherReason}
        />
      )}

      {/* JSON Editor Modal */}
      {mode === 'edit' && (
        <JsonEditor
          initialContent={currentProfile}
          itemSchema={currentItem.output_schema?.properties?.items?.items}
          onSave={handleSaveEdit}
          onCancel={() => setMode('view')}
        />
      )}
    </div>
  );
}
