import { z } from 'zod';
import { decide } from '@/modules/learning/decisions';
import { requireAdmin } from '@/modules/core/auth';
import { toResponse, err } from '@/modules/core/errors';
import { dbAdmin } from '@/modules/core/db';
import Ajv from 'ajv';

const ajv = new Ajv({ allErrors: true });

const Body = z.object({
  entity_type: z.literal('profile'),
  entity_id: z.string().uuid(),
  decision: z.enum(['approved', 'rejected', 'edited_approved']),
  reason_code: z.string().optional(),
  edited_content: z.unknown().optional(),
  notes: z.string().optional(),
  time_spent_ms: z.number().int().nonnegative().optional(),
}).refine(b => b.decision !== 'rejected' || !!b.reason_code,
          { message: 'reason_code required when rejecting' })
  .refine(b => b.reason_code !== 'other' || !!b.notes,
          { message: 'notes required for reason \'other\'' })
  .refine(b => b.decision !== 'edited_approved' || b.edited_content !== undefined,
          { message: 'edited_content required for edits' });

export async function POST(req: Request) {
  try {
    const admin = await requireAdmin(req);
    const b = Body.parse(await req.json());

    // If edited_approved, validate edited_content against generator's output_schema
    if (b.decision === 'edited_approved') {
      const { data: profile, error: profileErr } = await dbAdmin
        .from('profiles')
        .select(`
          generation_run_id,
          generation_runs (
            generator_id,
            generators (
              output_schema
            )
          )
        `)
        .eq('id', b.entity_id)
        .single();

      if (profileErr || !profile) {
        throw err('not_found', 404, 'Profile not found');
      }

      const run = profile.generation_runs as any;
      if (!run || !run.generators) {
        throw err('invalid_params', 400, 'Profile does not have associated generator output schema');
      }

      const outputSchema = run.generators.output_schema;
      const validate = ajv.compile(outputSchema);
      const isValid = validate(b.edited_content);
      if (!isValid) {
        throw err('invalid_params', 400, 'edited_content does not match generator output_schema', validate.errors);
      }
    }

    const id = await decide({
      entityType: b.entity_type,
      entityId: b.entity_id,
      decision: b.decision,
      reasonCode: b.reason_code,
      editedContent: b.edited_content,
      notes: b.notes,
      timeSpentMs: b.time_spent_ms,
      decidedBy: admin.email,
    });

    return Response.json({ decision_id: id });
  } catch (e) {
    return toResponse(e);
  }
}
