'use client';

import { useEffect } from 'react';

export const REJECTION_REASONS = [
  { code: 'incoherent_traits', label: 'Incoherent traits', key: '1' },
  { code: 'bias_mismatch', label: 'Bias mismatch', key: '2' },
  { code: 'generic_content', label: 'Generic content', key: '3' },
  { code: 'unrealistic', label: 'Unrealistic', key: '4' },
  { code: 'distribution_outlier', label: 'Distribution outlier', key: '5' },
  { code: 'duplicate_like', label: 'Near-duplicate', key: '6' },
  { code: 'schema_drift', label: 'Schema drift', key: '7' },
  { code: 'other', label: 'Other (requires notes)', key: '8' },
];

export function ReasonPalette({
  onSelect,
  onClose,
  showNotesForm,
  notes,
  setNotes,
  onSubmitOther,
}: {
  onSelect: (code: string) => void;
  onClose: () => void;
  showNotesForm: boolean;
  notes: string;
  setNotes: (notes: string) => void;
  onSubmitOther: () => void;
}) {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore keys if user is typing in notes textarea
      if (document.activeElement?.tagName === 'TEXTAREA' || document.activeElement?.tagName === 'INPUT') {
        if (e.key === 'Enter' && !e.shiftKey && showNotesForm && notes.trim()) {
          e.preventDefault();
          onSubmitOther();
        }
        return;
      }
      
      const num = Number(e.key);
      if (num >= 1 && num <= 8) {
        const reason = REJECTION_REASONS[num - 1];
        onSelect(reason.code);
      } else if (e.key === 'Escape') {
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onSelect, onClose, showNotesForm, notes, onSubmitOther]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="w-full max-w-md rounded-2xl border border-neutral-900 bg-neutral-950 p-6 shadow-2xl space-y-6">
        <div className="flex items-center justify-between border-b border-neutral-900 pb-3">
          <h3 className="text-sm font-bold uppercase tracking-wider text-neutral-400 font-mono">
            Select Rejection Reason
          </h3>
          <button onClick={onClose} className="text-neutral-500 hover:text-white transition-colors">
            ✕
          </button>
        </div>

        <div className="grid grid-cols-1 gap-2">
          {REJECTION_REASONS.map((r) => (
            <button
              key={r.code}
              onClick={() => onSelect(r.code)}
              className="w-full py-2.5 px-4 text-left text-neutral-400 hover:text-red-400 hover:bg-red-500/5 border border-neutral-900 hover:border-red-500/30 rounded-xl text-xs transition-all flex justify-between items-center bg-neutral-950 font-mono"
            >
              <span>{r.label}</span>
              <span className="inline-flex h-5 w-5 items-center justify-center rounded bg-neutral-900 text-[10px] font-bold text-neutral-600 border border-neutral-800">
                {r.key}
              </span>
            </button>
          ))}
        </div>

        {showNotesForm && (
          <div className="border-t border-neutral-900 pt-4 space-y-3">
            <label className="block text-xs font-semibold uppercase tracking-wider text-neutral-400 font-mono">
              Provide required notes for reason 'Other'
            </label>
            <textarea
              autoFocus
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Explain the rejection reason in detail..."
              rows={3}
              className="w-full rounded-xl border border-neutral-900 bg-neutral-950 px-4 py-3 text-xs text-white outline-none focus:border-purple-600"
            />
            <div className="flex gap-3 justify-end">
              <button
                onClick={onClose}
                className="px-4 py-2 rounded-xl border border-neutral-800 hover:border-neutral-700 bg-neutral-950 text-neutral-400 text-xs transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={onSubmitOther}
                disabled={!notes.trim()}
                className="px-4 py-2 rounded-xl bg-red-600 hover:bg-red-500 text-white text-xs font-bold transition-colors disabled:opacity-50"
              >
                Reject (Enter)
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
