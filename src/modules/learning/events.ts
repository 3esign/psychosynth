import { dbAdmin } from '@/modules/core/db';

export type EventInput = {
  event_type: string;
  actor_type: 'human' | 'system' | 'hook' | 'agent';
  actor_id?: string; entity_type?: string; entity_id?: string;
  run_id?: string; payload?: Record<string, unknown>;
};

export function emit(e: EventInput): void {
  void dbAdmin.from('events').insert({ payload: {}, ...e })
    .then(({ error }) => { if (error) console.error('[events]', error.message); });
}
