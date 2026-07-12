'use client';

export function SchemaForm({ schema, value, onChange }: {
  schema: any; value: Record<string, any>;
  onChange: (v: Record<string, any>) => void;
}) {
  const props = schema.properties ?? {};
  const set = (k: string, v: any) => onChange({ ...value, [k]: v });
  return (
    <div className="space-y-4">
      {Object.entries<any>(props).map(([key, p]) => (
        <label key={key} className="block space-y-1.5">
          <span className="text-xs font-semibold uppercase tracking-wider text-neutral-400 font-mono">
            {key}
            {schema.required?.includes(key) && <span className="text-purple-500 ml-1">*</span>}
          </span>
          {p.enum ? (
            <select
              className="block w-full rounded-xl border border-neutral-900 bg-neutral-950 px-4 py-3 text-sm text-white outline-none transition-all focus:border-purple-600 focus:ring-1 focus:ring-purple-600"
              value={value[key] ?? p.default ?? ''}
              onChange={e => set(key, e.target.value)}
            >
              <option value="" disabled className="text-neutral-600">Select an option</option>
              {p.enum.map((o: string) => <option key={o} value={o} className="bg-neutral-950 text-white">{o}</option>)}
            </select>
          ) : p.type === 'boolean' ? (
            <div className="flex items-center h-12">
              <input
                type="checkbox"
                className="h-5 w-5 rounded border-neutral-900 bg-neutral-950 text-purple-600 focus:ring-purple-600 focus:ring-offset-neutral-950"
                checked={value[key] ?? p.default ?? false}
                onChange={e => set(key, e.target.checked)}
              />
            </div>
          ) : p.type === 'integer' || p.type === 'number' ? (
            <input
              type="number"
              className="block w-full rounded-xl border border-neutral-900 bg-neutral-950 px-4 py-3 text-sm text-white placeholder-neutral-700 outline-none transition-all focus:border-purple-600 focus:ring-1 focus:ring-purple-600"
              min={p.minimum}
              max={p.maximum}
              placeholder={p.default !== undefined ? String(p.default) : ''}
              value={value[key] ?? p.default ?? ''}
              onChange={e => set(key, p.type === 'integer' ? parseInt(e.target.value, 10) : parseFloat(e.target.value))}
            />
          ) : p.type === 'array' ? (
            <input
              type="text"
              className="block w-full rounded-xl border border-neutral-900 bg-neutral-950 px-4 py-3 text-sm text-white placeholder-neutral-700 outline-none transition-all focus:border-purple-600 focus:ring-1 focus:ring-purple-600"
              placeholder="comma-separated list"
              value={(value[key] ?? p.default ?? []).join(', ')}
              onChange={e => set(key, e.target.value.split(',').map(s => s.trim()).filter(Boolean))}
            />
          ) : (
            <input
              type="text"
              className="block w-full rounded-xl border border-neutral-900 bg-neutral-950 px-4 py-3 text-sm text-white placeholder-neutral-700 outline-none transition-all focus:border-purple-600 focus:ring-1 focus:ring-purple-600"
              placeholder={p.default !== undefined ? String(p.default) : ''}
              value={value[key] ?? p.default ?? ''}
              onChange={e => set(key, e.target.value)}
            />
          )}
          {p.description && <span className="block text-xs text-neutral-500 font-mono mt-1">{p.description}</span>}
        </label>
      ))}
    </div>
  );
}
