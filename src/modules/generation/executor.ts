import Ajv from 'ajv';
import { after } from 'next/server';
import { dbAdmin } from '@/modules/core/db';
import { emit } from '@/modules/learning/events';
import { contentHash, sha256 } from '@/modules/core/canonical';
import { renderTemplate, templateHash } from './template';
import { generateItems } from './models';
import { runHookChain, finalVerdict } from '@/modules/hooks/registry';
import { err } from '@/modules/core/errors';

const ajv = new Ajv({ allErrors: true });

export async function executeRun(input: { generatorSlug: string;
    params: Record<string, unknown>; count: number; actorId: string }) {
  const { data: gen } = await dbAdmin.from('generators').select('*')
    .eq('slug', input.generatorSlug).eq('status', 'active')
    .order('version', { ascending: false }).limit(1).single();
  if (!gen) throw err('not_found', 404, `no active generator ${input.generatorSlug}`);

  const validate = ajv.compile(gen.params_schema);
  if (!validate(input.params))
    throw err('invalid_params', 400, 'params failed schema', validate.errors);

  const { data: run } = await dbAdmin.from('generation_runs').insert({
    generator_id: gen.id, generator_slug: gen.slug, generator_ver: gen.version,
    params: input.params, model_used: gen.model_config.model,
    items_requested: input.count,
  }).select().single();

  emit({ event_type: 'generation.run_started', actor_type: 'human',
         actor_id: input.actorId, run_id: run.id,
         payload: { params: input.params, count: input.count } });

  // Serverless note: respond immediately with run.id; continue via background
  after(() => {
    processRun(gen, run, input).catch(() => {});
  });
  return { runId: run.id };
}

async function processRun(gen: any, run: any,
    input: { params: Record<string, unknown>; count: number }) {
  try {
    const { data: biasRows } = await dbAdmin.from('biases').select('slug');
    const sys = { bias_slugs: (biasRows ?? []).map(b => b.slug) };
    let created = 0, cost = 0;
    for (const batch of batches(input.count, gen.model_config.max_items_per_call)) {
      const prompt = renderTemplate(gen.prompt_template,
        { ...input.params, ...sys, count: batch });
      const { items, costUsd } = await generateItems(gen.model_config, prompt,
        gen.output_schema);
      cost += costUsd;
      for (const item of items) {
        const results = await runHookChain(gen.hooks, { item, generator: gen, run });
        const verdict = finalVerdict(results);
        if (verdict === 'reject') {
          await bump(run.id, 'items_rejected_by_hooks'); continue;
        }
        const entityId = await insertProfile(item, verdict, run.id);
        await dbAdmin.from('provenance').insert({
          entity_type: 'profile', entity_id: entityId, entity_version: 1,
          model: gen.model_config.model,
          prompt_hash: sha256(prompt), template_hash: templateHash(gen.prompt_template),
          params: { ...input.params, temperature: gen.model_config.temperature },
          sha256_content: contentHash(item),
        });
        emit({ event_type: 'generation.item_created', actor_type: 'system',
               entity_type: 'profile', entity_id: entityId, run_id: run.id,
               payload: { verdict } });
        created++;
      }
    }
    await dbAdmin.from('generation_runs').update({
      items_created: created, cost_usd: cost, status: 'done',
      finished_at: new Date().toISOString(),
    }).eq('id', run.id);
    emit({ event_type: 'generation.run_completed', actor_type: 'system',
           run_id: run.id, payload: { items_created: created, cost_usd: cost } });
  } catch (e) {
    await dbAdmin.from('generation_runs').update({
      status: 'failed', error: String(e), finished_at: new Date().toISOString(),
    }).eq('id', run.id);
    emit({ event_type: 'generation.run_failed', actor_type: 'system',
           run_id: run.id, payload: { error: String(e) } });
  }
}

async function insertProfile(item: any, verdict: string, runId: string) {
  const { data: row } = await dbAdmin.from('profiles').insert({
    content: item, big_five: item.big_five, mbti_label: item.mbti_label,
    decision_style: item.decision_style, summary: item.summary, tags: item.tags,
    status: verdict === 'approve' ? 'approved' : 'pending',
    generation_run_id: runId,
  }).select('id').single();
  
  const { data: biasRows } = await dbAdmin.from('biases').select('id,slug');
  const bySlug = new Map((biasRows ?? []).map(b => [b.slug, b.id]));
  const links = (item.suggested_biases ?? [])
    .filter((s: any) => bySlug.has(s.slug))
    .map((s: any) => ({ profile_id: row!.id, bias_id: bySlug.get(s.slug),
                        strength: s.strength, generation_run_id: runId }));
  if (links.length) await dbAdmin.from('profile_bias_links').insert(links);
  return row!.id as string;
}

function* batches(total: number, size: number) {
  for (let left = total; left > 0; left -= size) yield Math.min(left, size);
}

async function bump(runId: string, col: string) {
  await dbAdmin.rpc('increment_run_counter', { p_run_id: runId, p_col: col })
    .then(() => {}, () => {});
}
