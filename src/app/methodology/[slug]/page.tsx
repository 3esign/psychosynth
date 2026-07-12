import { notFound } from 'next/navigation';
import { dbAdmin } from '@/modules/core/db';
import { templateHash } from '@/modules/generation/template';

// Rendered from the live generator row — never cached at build time.
export const dynamic = 'force-dynamic';

export default async function MethodologyPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;

  // Latest version of this generator, regardless of status (old paid payloads
  // must keep resolving even after a version is deprecated).
  const { data: gen } = await dbAdmin
    .from('generators')
    .select('slug, version, entity_type, description, prompt_template, params_schema, output_schema, model_config, hooks, status, created_at')
    .eq('slug', slug)
    .order('version', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!gen) notFound();

  const { data: biases } = await dbAdmin
    .from('biases')
    .select('slug, name, source')
    .order('slug');

  const cfg = gen.model_config as any;
  const hooks = (gen.hooks as any[]) ?? [];

  return (
    <main className="min-h-screen bg-slate-950 text-slate-200">
      <div className="max-w-4xl mx-auto px-6 py-16 space-y-10">
        <header className="space-y-3">
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-3xl font-bold tracking-tight text-white font-mono">{gen.slug}@v{gen.version}</h1>
            <span className={`px-2 py-0.5 rounded text-xs font-bold uppercase border ${
              gen.status === 'active'
                ? 'bg-green-500/10 text-green-400 border-green-500/20'
                : 'bg-slate-500/10 text-slate-400 border-slate-500/20'
            }`}>{gen.status}</span>
          </div>
          <p className="text-slate-400 text-lg">{gen.description}</p>
          <p className="text-slate-500 text-sm">
            Methodology page for entity type <code className="text-indigo-400">{gen.entity_type}</code>, referenced by the{' '}
            <code className="text-indigo-400">provenance.methodology</code> field of paid API responses.
          </p>
        </header>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold text-white border-b border-slate-800 pb-2">Generation model</h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 font-mono text-sm">
            <div className="p-4 bg-slate-900 rounded-xl border border-slate-800">
              <span className="block text-xs text-slate-500 uppercase mb-1">Provider</span>
              {cfg?.provider}
            </div>
            <div className="p-4 bg-slate-900 rounded-xl border border-slate-800">
              <span className="block text-xs text-slate-500 uppercase mb-1">Model</span>
              {cfg?.model}
            </div>
            <div className="p-4 bg-slate-900 rounded-xl border border-slate-800">
              <span className="block text-xs text-slate-500 uppercase mb-1">Temperature</span>
              {cfg?.temperature}
            </div>
          </div>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold text-white border-b border-slate-800 pb-2">Prompt integrity</h2>
          <p className="text-slate-400 text-sm leading-relaxed">
            The prompt template itself is proprietary; its SHA-256 hash below lets you verify that
            the <code className="text-indigo-400">template_hash</code> recorded in any record&apos;s provenance chain matches this
            published methodology version.
          </p>
          <code className="block p-4 bg-slate-900 rounded-xl border border-slate-800 text-xs text-indigo-400 font-mono break-all">
            template_hash (sha256): {templateHash(gen.prompt_template)}
          </code>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold text-white border-b border-slate-800 pb-2">Validation pipeline</h2>
          <p className="text-slate-400 text-sm">Every generated item passes this hook chain, in order, before it can reach a human curator:</p>
          <div className="flex flex-wrap gap-2 font-mono text-xs">
            {hooks.map((h: any, i: number) => (
              <span key={i} className="px-3 py-1.5 bg-slate-900 rounded-lg border border-slate-800 text-slate-300">
                {i + 1}. {h.type}{h.config ? ` ${JSON.stringify(h.config)}` : ''}
              </span>
            ))}
          </div>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold text-white border-b border-slate-800 pb-2">Output schema</h2>
          <p className="text-slate-400 text-sm">Records are guaranteed to satisfy this JSON Schema (invalid items are rejected, never repaired):</p>
          <pre className="p-4 bg-slate-900 rounded-xl border border-slate-800 text-xs text-slate-300 overflow-x-auto max-h-[420px]">
            {JSON.stringify(gen.output_schema, null, 2)}
          </pre>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold text-white border-b border-slate-800 pb-2">Generation parameters</h2>
          <pre className="p-4 bg-slate-900 rounded-xl border border-slate-800 text-xs text-slate-300 overflow-x-auto">
            {JSON.stringify(gen.params_schema, null, 2)}
          </pre>
        </section>

        {(biases ?? []).length > 0 && (
          <section className="space-y-3">
            <h2 className="text-xl font-semibold text-white border-b border-slate-800 pb-2">Cognitive bias taxonomy</h2>
            <p className="text-slate-400 text-sm">Bias links attached to profiles draw exclusively from this literature-sourced set:</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {(biases ?? []).map((b: any) => (
                <div key={b.slug} className="p-3 bg-slate-900 rounded-lg border border-slate-800 text-sm flex justify-between gap-3">
                  <span className="text-slate-200">{b.name}</span>
                  <span className="text-slate-500 text-xs text-right">{b.source}</span>
                </div>
              ))}
            </div>
          </section>
        )}

        <footer className="pt-6 border-t border-slate-800 text-sm text-slate-500">
          All output is synthetic. Full API reference: <a href="/docs" className="text-indigo-400 hover:text-indigo-300">/docs</a>
        </footer>
      </div>
    </main>
  );
}
