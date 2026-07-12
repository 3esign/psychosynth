import { dbAdmin } from '@/modules/core/db';
import { contentHash } from '@/modules/core/canonical';
import { err } from '@/modules/core/errors';

export async function decide(input: {
  entityType: string; entityId: string;
  decision: 'approved' | 'rejected' | 'edited_approved';
  reasonCode?: string; editedContent?: unknown; notes?: string;
  timeSpentMs?: number; decidedBy: string;
}) {
  const { data, error } = await dbAdmin.rpc('decide_curation', {
    p_entity_type: input.entityType, p_entity_id: input.entityId,
    p_decision: input.decision, p_reason_code: input.reasonCode ?? null,
    p_edited_content: input.editedContent ?? null,
    p_new_content_sha256: input.editedContent ? contentHash(input.editedContent) : null,
    p_notes: input.notes ?? null, p_time_spent_ms: input.timeSpentMs ?? null,
    p_judge_score: null, p_judge_rubric: null,   // filled from M2's judge hook
    p_decided_by: input.decidedBy,
  });
  
  if (error) throw err('invalid_params', 400, error.message);
  return data as string; // decision id
}
