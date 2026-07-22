import { NextResponse } from 'next/server';

export async function GET() {
  const manifest = {
    name: 'Psychosynth MCP Server',
    description: 'Synthetic agent psychometrics, prospect theory decision vectors, cognitive bias models, and stress-test evaluation batteries payable via x402 on Base.',
    version: '0.1.1',
    npmPackage: 'psychosynth-mcp',
    mcpVersion: '1.0.0',
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
      api_base: 'https://psychosynth.vercel.app/api/v1',
      discovery: 'https://psychosynth.vercel.app/api/v1/discovery'
    }
  };

  return NextResponse.json(manifest, {
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Cache-Control': 'public, max-age=3600'
    }
  });
}
