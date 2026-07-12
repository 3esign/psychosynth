import { NextResponse } from 'next/server';
import { dbAdmin } from '@/modules/core/db';
import { requireAdmin } from '@/modules/core/auth';
import { toResponse, err } from '@/modules/core/errors';

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireAdmin(req);
    const { id } = await params;

    // 1. Fetch profile
    const { data: profile, error: profileErr } = await dbAdmin
      .from('profiles')
      .select('*')
      .eq('id', id)
      .single();

    if (profileErr) throw profileErr;
    if (!profile) throw err('not_found', 404, 'Profile not found');

    // 2. Fetch bias links (joined with biases table)
    const { data: biases, error: biasesErr } = await dbAdmin
      .from('profile_bias_links')
      .select('strength, context_notes, biases (slug, name, description)')
      .eq('profile_id', id);

    if (biasesErr) throw biasesErr;

    // 3. Fetch provenance chain
    const { data: provenance, error: provErr } = await dbAdmin
      .from('provenance')
      .select('*')
      .eq('entity_id', id)
      .eq('entity_type', 'profile')
      .order('entity_version', { ascending: true });

    if (provErr) throw provErr;

    // 4. Fetch curation decisions history
    const { data: decisions, error: decErr } = await dbAdmin
      .from('curation_decisions')
      .select('*')
      .eq('entity_id', id)
      .eq('entity_type', 'profile')
      .order('created_at', { ascending: true });

    if (decErr) throw decErr;

    return NextResponse.json({
      ...profile,
      bias_links: biases || [],
      provenance: provenance || [],
      decisions: decisions || [],
    });
  } catch (e) {
    return toResponse(e);
  }
}
