import { NextResponse } from 'next/server';

// Keep in sync with mcp/package.json + mcp/server.json (bumped together by the
// publish-mcp workflow's version guard).
const MCP_VERSION = '0.1.3';

export async function GET(req: Request) {
  // Derive the origin from the request (same convention as /api/v1/discovery)
  // so previews, forks, and self-hosted deployments never advertise another
  // deployment's endpoints.
  const host = req.headers.get('host') || 'localhost:3000';
  const protocol = host.startsWith('localhost') ? 'http' : 'https';
  const origin = `${protocol}://${host}`;

  const manifest = {
    name: 'Psychosynth MCP Server',
    description: 'Synthetic agent psychometrics, prospect theory decision vectors, cognitive bias models, and stress-test evaluation batteries payable via x402 on Base.',
    version: MCP_VERSION,
    npmPackage: 'psychosynth-mcp',
    mcpName: 'io.github.3esign/psychosynth',
    install: 'npx psychosynth-mcp',
    capabilities: {
      tools: [
        {
          name: 'list_products',
          description: 'Lists available psychometric datasets, decision bias libraries, and evaluation batteries.'
        },
        {
          name: 'preview_records',
          description: 'Preview sample psychometric profiles or scenario questions for free.'
        },
        {
          name: 'get_quote',
          description: 'Get an x402 payment quote for full dataset or evaluation access.'
        },
        {
          name: 'query_records',
          description: 'Query paid dataset or evaluation battery with an x402 EIP-3009 payment signature on Base.'
        }
      ]
    },
    endpoints: {
      api_base: `${origin}/api/v1`,
      discovery: `${origin}/api/v1/discovery`
    }
  };

  return NextResponse.json(manifest, {
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Cache-Control': 'public, max-age=3600'
    }
  });
}
