#!/usr/bin/env node
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import { API_BASE, listProducts, previewRecords, getQuote, buildQueryUrl } from './api.js';
import { payingFetch, hasBuyerWallet, buyerAddress } from './payment.js';

const server = new McpServer({ name: 'psychosynth', version: '0.1.0' });

// MCP tool results are text content blocks; JSON is stringified for the model.
function result(payload: unknown) {
  const text = typeof payload === 'string' ? payload : JSON.stringify(payload, null, 2);
  return { content: [{ type: 'text' as const, text }] };
}

// Shared input schema for the query-style tools. `filters` carries any
// product-specific parameters (each product lists its allowed ones in
// list_products); `tier` and `limit` are broken out for convenience.
const querySchema = {
  slug: z.string().describe("Product slug from list_products, e.g. 'behavioral-response-library'"),
  tier: z
    .string()
    .optional()
    .describe("Optional pack tier slug (e.g. 'pack-5k') for a bulk single-call result; omit for base per-query pricing"),
  limit: z.string().optional().describe('Optional max number of records to return'),
  filters: z
    .record(z.string())
    .optional()
    .describe("Product-specific query filters, e.g. { category: 'trading' } or { mbti_label: 'INTJ' }. See each product's allowed parameters in list_products."),
};

type QueryArgs = { slug: string; tier?: string; limit?: string; filters?: Record<string, string> };

function collectFilters(args: QueryArgs): Record<string, string | undefined> {
  return {
    ...(args.filters ?? {}),
    ...(args.tier ? { tier: args.tier } : {}),
    ...(args.limit ? { limit: args.limit } : {}),
  };
}

server.registerTool(
  'list_products',
  {
    title: 'List products',
    description:
      'List the Psychosynth data products available for purchase (free, no wallet). Returns each product\'s slug, description, per-query price, and any bulk pack tiers. Start here to discover what can be queried.',
    inputSchema: {},
  },
  async () => {
    const { status, body } = await listProducts();
    if (status !== 200) return result({ error: 'catalog request failed', status, body });
    return result(body);
  },
);

server.registerTool(
  'preview_records',
  {
    title: 'Preview records (free)',
    description:
      'Fetch a free, deterministic sample of a product\'s records so you can verify shape and quality before paying. The same product always returns the same preview rows. Provide a product slug from list_products.',
    inputSchema: { slug: z.string().describe("Product slug, e.g. 'behavioral-response-library'") },
  },
  async ({ slug }: { slug: string }) => {
    const { status, body } = await previewRecords(slug);
    if (status !== 200) return result({ error: 'preview request failed', status, body });
    return result(body);
  },
);

server.registerTool(
  'get_quote',
  {
    title: 'Get price quote (free)',
    description:
      'Get the x402 payment quote for a paid query WITHOUT paying — returns the price, accepted payment details, and available pack tiers. No wallet required. Use this to see the exact cost before calling query_records.',
    inputSchema: querySchema,
  },
  async (args: QueryArgs) => {
    const { status, body } = await getQuote(args.slug, collectFilters(args));
    return result({
      note: status === 402 ? '402 quote — payment required to fetch records' : `status ${status}`,
      quote: body,
    });
  },
);

server.registerTool(
  'query_records',
  {
    title: 'Query records (paid via x402)',
    description:
      'Run a paid query and return the full records. Pays automatically over x402 (USDC on Base) using the wallet in the BUYER_PRIVATE_KEY environment variable. If no wallet is configured, returns the price quote instead so you can review the cost first. Add `tier` for a bulk pack.',
    inputSchema: querySchema,
  },
  async (args: QueryArgs) => {
    const filters = collectFilters(args);
    if (!hasBuyerWallet()) {
      const { status, body } = await getQuote(args.slug, filters);
      return result({
        error: 'No buyer wallet configured. Set BUYER_PRIVATE_KEY to enable paid queries.',
        status,
        quote: body,
      });
    }
    try {
      const { status, body } = await payingFetch(buildQueryUrl(args.slug, filters));
      if (status !== 200) return result({ error: 'paid query failed', status, body });
      return result(body);
    } catch (e: any) {
      return result({ error: 'payment/query error', message: e?.message ?? String(e) });
    }
  },
);

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  // stdout is reserved for the MCP protocol; log to stderr only.
  console.error(
    `psychosynth-mcp connected. API=${API_BASE} wallet=${hasBuyerWallet() ? buyerAddress() : 'not configured (free tools only)'}`,
  );
}

main().catch((e) => {
  console.error('fatal:', e);
  process.exit(1);
});
