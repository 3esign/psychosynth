import { NextResponse } from 'next/server';
import { dbAdmin } from '@/modules/core/db';
import { requireAdmin } from '@/modules/core/auth';
import { toResponse } from '@/modules/core/errors';

export async function GET(req: Request) {
  try {
    await requireAdmin(req);
    const { data, error } = await dbAdmin
      .from('generators')
      .select('*')
      .order('created_at', { ascending: false });
    if (error) throw error;
    return NextResponse.json({ items: data });
  } catch (e) {
    return toResponse(e);
  }
}

export async function POST(req: Request) {
  try {
    await requireAdmin(req);
    const body = await req.json();
    const { data, error } = await dbAdmin
      .from('generators')
      .insert({
        slug: body.slug,
        entity_type: body.entity_type,
        description: body.description,
        prompt_template: body.prompt_template,
        params_schema: body.params_schema,
        output_schema: body.output_schema,
        model_config: body.model_config,
        hooks: body.hooks ?? [],
        status: 'draft',
      })
      .select()
      .single();

    if (error) throw error;
    return NextResponse.json(data);
  } catch (e) {
    return toResponse(e);
  }
}
