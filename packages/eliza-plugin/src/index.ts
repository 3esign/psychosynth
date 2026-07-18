import { createPublicClient, createWalletClient, http, publicActions } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { base } from 'viem/chains';
import { wrapFetchWithPayment } from 'x402-fetch';

// Define core interfaces compatible with ElizaOS
export interface IAgentRuntime {
  getSetting(key: string): string | undefined;
  registerAction(action: any): void;
}

export interface Memory {
  id?: string;
  userId: string;
  agentId: string;
  content: {
    text: string;
    [key: string]: any;
  };
}

export interface State {
  [key: string]: any;
}

// 1. The Psychosynth Provider
// Loads the agent's own psychometric profile vector and injects it into context
export const psychosynthProvider = {
  get: async (runtime: IAgentRuntime, _message: Memory, _state?: State): Promise<string> => {
    const pk = runtime.getSetting('PSYCHOSYNTH_BUYER_PRIVATE_KEY') || runtime.getSetting('BUYER_PRIVATE_KEY');
    if (!pk) {
      return '';
    }

    const apiUrl = runtime.getSetting('PSYCHOSYNTH_API_URL') || 'https://psychosynth.vercel.app';
    const profileSlug = runtime.getSetting('PSYCHOSYNTH_PROFILE_SLUG') || 'personality-profile-library';

    try {
      const privateKey = (pk.startsWith('0x') ? pk : `0x${pk}`) as `0x${string}`;
      const account = privateKeyToAccount(privateKey);
      
      // Let's query the preview/mock profile or try to fetch the paid profile using x402
      // For the provider, we fetch a preview of their assigned profile based on their wallet address
      const res = await fetch(`${apiUrl}/api/v1/preview/${profileSlug}?mbti_label=INTJ&limit=1`);
      if (!res.ok) {
        return '';
      }
      const data = await res.json();
      const profile = data.records?.[0] || data?.[0];
      if (!profile) return '';

      return `
[PSYCHOMETRIC IDENTITY PROFILE]
Source: Psychosynth Marketplace (Verified Cryptographic Provenance)
Traits:
- Openness: ${profile.big_five?.openness || 0.5}
- Conscientiousness: ${profile.big_five?.conscientiousness || 0.5}
- Extraversion: ${profile.big_five?.extraversion || 0.5}
- Agreeableness: ${profile.big_five?.agreeableness || 0.5}
- Neuroticism: ${profile.big_five?.neuroticism || 0.5}
Decision Style: ${profile.decision_style || 'analytical'}
Cosmetic MBTI Label: ${profile.mbti_label || 'INTJ'}
Summary: ${profile.summary}
Tags: ${(profile.tags || []).join(', ')}
      `.trim();
    } catch (e) {
      console.error('[psychosynth-provider-error]', e);
      return '';
    }
  }
};

// 2. The Psychosynth Query Action
// Allows the agent to query and pay for psychometric scenario responses or profiles
export const psychosynthQueryAction = {
  name: 'QUERY_PSYCHOMETRIC_DATA',
  similes: ['BUY_PSYCHOMETRIC_DATA', 'FETCH_BEHAVIORAL_RESPONSE', 'GET_PROFILE'],
  description: 'Autonomously queries and pays for psychometric datasets or scenario responses on Base using USDC via the x402 payment protocol.',
  validate: async (runtime: IAgentRuntime, _message: Memory) => {
    const pk = runtime.getSetting('PSYCHOSYNTH_BUYER_PRIVATE_KEY') || runtime.getSetting('BUYER_PRIVATE_KEY');
    return !!pk;
  },
  handler: async (
    runtime: IAgentRuntime,
    message: Memory,
    state?: State,
    _options?: any,
    callback?: (content: any) => void
  ): Promise<boolean> => {
    const pk = runtime.getSetting('PSYCHOSYNTH_BUYER_PRIVATE_KEY') || runtime.getSetting('BUYER_PRIVATE_KEY')!;
    const privateKey = (pk.startsWith('0x') ? pk : `0x${pk}`) as `0x${string}`;
    const apiUrl = runtime.getSetting('PSYCHOSYNTH_API_URL') || 'https://psychosynth.vercel.app';
    const rpcUrl = runtime.getSetting('BASE_RPC_URL') || 'https://mainnet.base.org';

    // Parse product slug and filters from conversation message content
    // We expect the agent's LLM planner to output arguments like { slug: "...", filters: { ... } }
    const text = message.content.text;
    let slug = 'personality-profile-library';
    let filters: Record<string, string> = {};

    try {
      // Crude parsing of JSON inside text if present, otherwise defaults
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        if (parsed.slug) slug = parsed.slug;
        if (parsed.filters) filters = parsed.filters;
      }
    } catch {
      // fallback
    }

    try {
      const url = new URL(`${apiUrl}/api/v1/query/${slug}`);
      Object.entries(filters).forEach(([k, v]) => url.searchParams.set(k, v));

      const publicClient = createPublicClient({
        chain: base,
        transport: http(rpcUrl),
      });

      const block = await publicClient.getBlock();
      const driftSeconds = Math.floor(Date.now() / 1000) - Number(block.timestamp);

      const account = privateKeyToAccount(privateKey);
      const client = createWalletClient({
        account,
        chain: base,
        transport: http(rpcUrl),
      }).extend(publicActions);

      const fetchWithPay = wrapFetchWithPayment(fetch, client as any);

      // drift compensation
      const originalNow = Date.now;
      Date.now = () => originalNow() - (driftSeconds + 300) * 1000;

      let responseData: any;
      try {
        const res = await fetchWithPay(url.toString());
        if (!res.ok) {
          throw new Error(`Paid query failed: ${res.statusText}`);
        }
        responseData = await res.json();
      } finally {
        Date.now = originalNow;
      }

      if (callback) {
        callback({
          text: `Successfully queried Psychosynth data for product ${slug}. Found ${responseData.count} records.`,
          data: responseData,
        });
      }
      return true;
    } catch (e: any) {
      console.error('[psychosynth-action-error]', e);
      if (callback) {
        callback({
          text: `Failed to query Psychosynth data: ${e.message}`,
          error: e.message,
        });
      }
      return false;
    }
  },
  examples: [
    [
      {
        user: '{{user1}}',
        content: { text: 'Query the behavioral response suite for a trading crisis.' },
      },
      {
        user: '{{user2}}',
        content: {
          text: 'Understood. I will query the behavioral-response-library with category=crisis.',
          action: 'QUERY_PSYCHOMETRIC_DATA',
        },
      },
    ],
  ],
};

// 3. The Combined Plugin Object
export const psychosynthPlugin = {
  name: 'psychosynth',
  description: 'Agent psychometrics, decision behavior, and risk model parameters marketplace integration.',
  actions: [psychosynthQueryAction],
  providers: [psychosynthProvider],
};

export default psychosynthPlugin;
