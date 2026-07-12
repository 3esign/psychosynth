import { NextResponse } from 'next/server';
import { dbAdmin } from '@/modules/core/db';
import { requireAdmin } from '@/modules/core/auth';
import { toResponse, err } from '@/modules/core/errors';
import { emit } from '@/modules/learning/events';

export async function POST(req: Request, { params }: { params: Promise<{ slug: string }> }) {
  try {
    const admin = await requireAdmin(req);
    const { slug } = await params;
    const body = await req.json();

    // 1. Fetch latest version of this generator
    const { data: latestGen, error: fetchErr } = await dbAdmin
      .from('generators')
      .select('*')
      .eq('slug', slug)
      .order('version', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (fetchErr) throw fetchErr;
    if (!latestGen) {
      throw err('not_found', 404, `Generator with slug ${slug} not found`);
    }

    const nextVer = latestGen.version + 1;
    const newStatus = body.status || 'draft';

    // 2. Insert new version
    const { data: newGen, error: insertErr } = await dbAdmin
      .from('generators')
      .insert({
        slug,
        version: nextVer,
        entity_type: body.entity_type ?? latestGen.entity_type,
        description: body.description ?? latestGen.description,
        prompt_template: body.prompt_template ?? latestGen.prompt_template,
        params_schema: body.params_schema ?? latestGen.params_schema,
        output_schema: body.output_schema ?? latestGen.output_schema,
        model_config: body.model_config ?? latestGen.model_config,
        hooks: body.hooks ?? latestGen.hooks,
        status: newStatus,
      })
      .select()
      .single();

    if (insertErr) throw insertErr;

    // 3. If new status is active, deprecate all older versions
    if (newStatus === 'active') {
      const { error: deprecateErr } = await dbAdmin
        .from('generators')
        .update({ status: 'deprecated' })
        .eq('slug', slug)
        .lt('version', nextVer);
      if (deprecateErr) throw deprecateErr;
    }

    // 4. Emit version_bumped event
    emit({
      event_type: 'generator.version_bumped',
      actor_type: 'human',
      actor_id: admin.email,
      payload: {
        slug,
        previous_version: latestGen.version,
        new_version: nextVer,
        status: newStatus,
      },
    });

    return NextResponse.json(newGen);
  } catch (e) {
    return toResponse(e);
  }
}
