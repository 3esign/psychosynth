// Bazaar discovery metadata — ONE shared builder for every x402 surface.
//
// Two transports carry the same discovery info:
//  - v2: `extensions.bazaar` spread into the 402 quote body (crawlers, v2 clients).
//  - v1: the same `info` object attached as `outputSchema` on the
//    PaymentRequirements we send to the facilitator's /verify + /settle. This is
//    the one that actually gets a service indexed: CDP catalogs an endpoint the
//    first time it SETTLES a payment for it, from the requirements it is handed
//    — it never sees our 402 response body.
//
// Two gotchas this module exists to fix (verified against @x402/extensions'
// own validator, `validateDiscoveryExtension`):
//  1. `declareDiscoveryExtension` omits `input.method` unless routed through
//     the SDK's route-config wrapper — but its generated schema REQUIRES
//     `method`, so a hand-rolled 402 fails validation and indexing silently
//     drops the metadata. We patch the method in after building.
//  2. The `input` example must validate against `inputSchema` (including
//     `required` fields). Every builder below ships an example that does.
//
// Keep builders in sync with what the endpoints actually accept/return —
// see src/app/api/v1/query/[slug]/route.ts and .../eval/[slug]/route.ts.

import { declareDiscoveryExtension } from '@x402/extensions/bazaar';

export interface BazaarDiscovery {
  /** v2 shape — spread into the 402 quote body as `extensions`. */
  extensions: Record<string, unknown>;
  /** v1 shape (the DiscoveryInfo object) — attach as `outputSchema` on PaymentRequirements. */
  outputSchema: Record<string, unknown>;
}

type HttpMethod = 'GET' | 'POST';

function build(
  config: Parameters<typeof declareDiscoveryExtension>[0],
  method: HttpMethod,
): BazaarDiscovery {
  const ext = declareDiscoveryExtension(config) as Record<string, any>;
  const info = ext?.bazaar?.info;
  if (info?.input && typeof info.input === 'object') {
    info.input.method = method; // see gotcha (1) above
  }
  return {
    extensions: ext as Record<string, unknown>,
    outputSchema: (info ?? {}) as Record<string, unknown>,
  };
}

/** Discovery metadata for the paid query endpoint: GET /api/v1/query/{slug}. */
export function queryBazaarDiscovery(slug: string): BazaarDiscovery {
  return build(
    {
      // Example MUST satisfy inputSchema — CDP validates it at index time.
      input: { limit: 5, decision_style: 'analytical' },
      inputSchema: {
        properties: {
          limit: { type: 'number', description: 'Number of records to return' },
          tier: { type: 'string', description: 'Bulk pack tier slug from the 402 quote tiers[] (omit for the base per-query tier)' },
          tags: { type: 'string', description: 'Comma-separated list of tags to filter by' },
          decision_style: { type: 'string', description: 'Filter by decision style (e.g. analytical, intuitive)' },
          mbti_label: { type: 'string', description: 'Filter by MBTI personality type (e.g. INTJ, ENFP)' },
        },
      },
      output: {
        // Mirrors the real paid response shape: { count, records[], provenance }.
        example: {
          count: 1,
          records: [
            {
              id: '00000000-0000-0000-0000-000000000000',
              slug,
              tags: ['example'],
              created_at: '2026-01-01T00:00:00Z',
            },
          ],
          provenance: { sha256_content: '<per-record content hash>' },
        },
      },
    },
    'GET',
  );
}

/** Discovery metadata for the paid eval endpoint: POST /api/v1/eval/{battery}. */
export function evalBazaarDiscovery(batterySlug: string, batteryVersion?: string | number): BazaarDiscovery {
  return build(
    {
      bodyType: 'json',
      // Example MUST satisfy inputSchema (required: ["responses"]).
      input: {
        agent_label: 'test-agent',
        responses: [{ scenario_slug: 'example-scenario', response: 'I would hold the position and re-check my thesis.' }],
      },
      inputSchema: {
        properties: {
          agent_label: { type: 'string', description: 'Optional agent identifier' },
          responses: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                scenario_slug: { type: 'string' },
                response: { type: 'string' },
              },
              required: ['scenario_slug', 'response'],
            },
          },
        },
        required: ['responses'],
      },
      output: {
        example: {
          report_id: 123,
          battery: batterySlug,
          battery_version: batteryVersion ?? '1',
          agent_label: 'test-agent',
          dimension_scores: {},
          per_scenario: [],
          overall: {},
          report_sha256: '<sha256 of the scored report>',
          tx_ref: '0x…',
          provenance: {},
        },
      },
    },
    'POST',
  );
}
