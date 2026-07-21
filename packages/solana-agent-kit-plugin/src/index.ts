import { Connection, PublicKey, Transaction, SystemProgram, Keypair } from '@solana/web3.js';
import bs58 from 'bs58';
import * as nacl from 'tweetnacl';

// We define a minimal interface that matches SolanaAgentKit for typing purposes,
// avoiding a strict dependency failure if their types change slightly.
export interface SolanaAgentKitLike {
  wallet: Keypair;
  connection: Connection;
  wallet_address: PublicKey;
}

export interface Plugin {
  name: string;
  description: string;
  actions: any[];
}

export class PsychosynthPlugin implements Plugin {
  name = "psychosynth";
  description = "Discover and query Psychosynth synthetic psychometric data (Big Five profiles, cognitive biases, profile-conditioned behavioral responses) over the x402 protocol.";

  private apiUrl: string;

  constructor(apiUrl: string = "https://psychosynth.vercel.app") {
    this.apiUrl = apiUrl;
  }

  actions = [
    {
      name: "psychosynth_list_products",
      description: "List the Psychosynth data products available for purchase.",
      handler: async (agent: SolanaAgentKitLike, params: any) => {
        const res = await fetch(`${this.apiUrl}/api/v1/products`);
        if (!res.ok) throw new Error(`Failed to list products: ${res.statusText}`);
        return await res.json();
      }
    },
    {
      name: "psychosynth_preview_records",
      description: "Fetch a free, deterministic sample of a product's records.",
      handler: async (agent: SolanaAgentKitLike, params: { slug: string; filters?: Record<string, string> }) => {
        const url = new URL(`${this.apiUrl}/api/v1/preview/${params.slug}`);
        if (params.filters) {
          Object.entries(params.filters).forEach(([k, v]) => url.searchParams.set(k, v));
        }
        const res = await fetch(url.toString());
        if (!res.ok) throw new Error(`Failed to preview records: ${res.statusText}`);
        return await res.json();
      }
    },
    {
      name: "psychosynth_get_quote",
      description: "Get the x402 payment quote for a paid query.",
      handler: async (agent: SolanaAgentKitLike, params: { slug: string; filters?: Record<string, string> }) => {
        const url = new URL(`${this.apiUrl}/api/v1/query/${params.slug}`);
        if (params.filters) {
          Object.entries(params.filters).forEach(([k, v]) => url.searchParams.set(k, v));
        }
        const res = await fetch(url.toString());
        if (res.status === 402) {
           return await res.json();
        }
        if (!res.ok) throw new Error(`Failed to get quote: ${res.statusText}`);
        return await res.json();
      }
    },
    {
      name: "psychosynth_query_records",
      description: "Run a paid query and return the full records using Solana USDC.",
      handler: async (agent: SolanaAgentKitLike, params: { slug: string; filters?: Record<string, string> }) => {
        const url = new URL(`${this.apiUrl}/api/v1/query/${params.slug}`);
        if (params.filters) {
          Object.entries(params.filters).forEach(([k, v]) => url.searchParams.set(k, v));
        }
        
        // 1. Get quote
        const quoteRes = await fetch(url.toString());
        if (quoteRes.status === 200) {
          return await quoteRes.json();
        }
        if (quoteRes.status !== 402) {
          throw new Error(`Failed to query: ${quoteRes.statusText}`);
        }
        
        const quote = await quoteRes.json();
        const accept = quote.accepts?.find((a: any) => a.network === 'solana');
        if (!accept) {
          throw new Error('No Solana payment method accepted by the server for this product.');
        }

        const payTo = accept.payTo;
        const requiredUnits = BigInt(accept.maxAmountRequired);

        // 2. Perform Solana transfer using SolanaAgentKit's assumed SPL transfer capability, or raw spl-token transfer.
        // For standard solana-agent-kit, there is usually `agent.transfer(payTo, amount, mint)`.
        const USDC_MINT = new PublicKey("EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v");
        const amountDecimals = Number(requiredUnits) / 1000000;
        
        let txHash: string;
        try {
          // Attempting standard solana-agent-kit transfer method
          // The agent.transfer usually takes (to: PublicKey, amount: number, mint?: PublicKey)
          // Adjust to match the exact signature of solana-agent-kit transfer action
          if (typeof (agent as any).transfer === 'function') {
            txHash = await (agent as any).transfer(new PublicKey(payTo), amountDecimals, USDC_MINT);
          } else {
             throw new Error("agent.transfer method not found on the provided agent instance.");
          }
        } catch (e: any) {
           throw new Error(`Solana USDC transfer failed: ${e.message}`);
        }

        // 3. Create x402 payment binding signature
        // The server requires the challenge format from payment-verify.ts
        const challengeString = [
          'x402-payment-binding',
          'v1',
          'solana',
          txHash,
          payTo,
          requiredUnits.toString(),
          url.pathname
        ].join('\n');
        
        const messageBytes = new TextEncoder().encode(challengeString);
        const signatureBytes = nacl.sign.detached(messageBytes, agent.wallet.secretKey);
        const signature = bs58.encode(signatureBytes);

        const xPaymentPayload = {
          scheme: 'exact',
          network: 'solana',
          payload: {
            txHash,
            payer: agent.wallet_address.toString(),
            signature
          }
        };

        const xPaymentHeader = Buffer.from(JSON.stringify(xPaymentPayload)).toString('base64');

        // 4. Resend request with X-PAYMENT header
        const finalRes = await fetch(url.toString(), {
          headers: {
            'X-PAYMENT': xPaymentHeader
          }
        });

        if (!finalRes.ok) throw new Error(`Paid query failed after payment: ${finalRes.statusText}`);
        return await finalRes.json();
      }
    }
  ];
}
