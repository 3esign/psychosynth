'use client';

import { useState, useEffect } from 'react';
import Ajv from 'ajv';

const ajv = new Ajv({ allErrors: true });

export function JsonEditor({
  initialContent,
  itemSchema,
  onSave,
  onCancel,
}: {
  initialContent: any;
  itemSchema: any;
  onSave: (content: any) => void;
  onCancel: () => void;
}) {
  const [text, setText] = useState(() => JSON.stringify(initialContent, null, 2));
  const [errors, setErrors] = useState<string[]>([]);

  const handleSave = () => {
    setErrors([]);
    let parsed: any;

    // 1. Try parsing JSON
    try {
      parsed = JSON.parse(text);
    } catch (e: any) {
      setErrors([`Invalid JSON format: ${e.message}`]);
      return;
    }

    // 2. Validate against output schema properties (if schema is provided)
    if (itemSchema) {
      try {
        const validate = ajv.compile(itemSchema);
        const valid = validate(parsed);
        if (!valid) {
          const errList = (validate.errors || []).map(
            err => `${err.instancePath ? err.instancePath + ': ' : ''}${err.message} (${JSON.stringify(err.params)})`
          );
          setErrors(errList);
          return;
        }
      } catch (e: any) {
        setErrors([`Schema compilation/validation error: ${e.message}`]);
        return;
      }
    }

    onSave(parsed);
  };

  // Keyboard shortcuts advertised on the buttons: Esc cancels, Ctrl/Cmd+Enter saves.
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onCancel();
      } else if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        handleSave();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="w-full max-w-2xl rounded-2xl border border-neutral-900 bg-neutral-950 p-6 shadow-2xl space-y-4 flex flex-col max-h-[90vh]">
        <div className="flex items-center justify-between border-b border-neutral-900 pb-3 flex-shrink-0">
          <h3 className="text-sm font-bold uppercase tracking-wider text-neutral-400 font-mono">
            Edit Profile Content (JSON)
          </h3>
          <button onClick={onCancel} className="text-neutral-500 hover:text-white transition-colors">
            ✕
          </button>
        </div>

        <div className="flex-1 overflow-hidden min-h-[300px] flex flex-col space-y-3">
          <textarea
            autoFocus
            value={text}
            onChange={(e) => setText(e.target.value)}
            className="w-full flex-1 rounded-xl border border-neutral-900 bg-neutral-950 px-4 py-3 text-xs text-white font-mono outline-none focus:border-purple-600 resize-none overflow-y-auto"
            placeholder="Edit raw profile JSON..."
          />

          {errors.length > 0 && (
            <div className="rounded-lg border border-red-500/20 bg-red-500/10 p-4 text-xs font-mono text-red-400 max-h-[150px] overflow-y-auto space-y-1 flex-shrink-0">
              <div className="font-bold uppercase tracking-wide text-[10px] text-red-500 mb-1">Validation Failures:</div>
              {errors.map((err, i) => (
                <div key={i} className="flex gap-2">
                  <span>•</span>
                  <span>{err}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="flex gap-3 justify-end border-t border-neutral-900 pt-4 flex-shrink-0">
          <button
            onClick={onCancel}
            className="px-4 py-2.5 rounded-xl border border-neutral-800 hover:border-neutral-700 bg-neutral-950 text-neutral-400 text-xs transition-colors"
          >
            Cancel (Esc)
          </button>
          <button
            onClick={handleSave}
            className="px-4 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold transition-colors shadow-lg shadow-purple-500/10"
          >
            Save & Approve (Ctrl+Enter)
          </button>
        </div>
      </div>
    </div>
  );
}
