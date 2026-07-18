import { createPublicClient, createWalletClient, http, publicActions } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { base } from 'viem/chains';
import { wrapFetchWithPayment } from 'x402-fetch';

export interface PsychosynthConfig {
  privateKey: string;
  rpcUrl?: string;
  apiUrl?: string;
}

export class PsychosynthClient {
  private privateKey: `0x${string}`;
  private rpcUrl: string;
  private apiUrl: string;

  constructor(config: PsychosynthConfig) {
    const pk = config.privateKey;
    this.privateKey = (pk.startsWith('0x') ? pk : `0x${pk}`) as `0x${string}`;
    this.rpcUrl = config.rpcUrl || 'https://mainnet.base.org';
    this.apiUrl = config.apiUrl || 'https://psychosynth.vercel.app';
  }

  async listProducts() {
    const res = await fetch(`${this.apiUrl}/api/v1/products`);
    if (!res.ok) {
      throw new Error(`Failed to list products: ${res.statusText}`);
    }
    return res.json();
  }

  async previewRecords(slug: string, filters?: Record<string, string>) {
    const url = new URL(`${this.apiUrl}/api/v1/preview/${slug}`);
    if (filters) {
      Object.entries(filters).forEach(([k, v]) => url.searchParams.set(k, v));
    }
    const res = await fetch(url.toString());
    if (!res.ok) {
      throw new Error(`Failed to preview records: ${res.statusText}`);
    }
    return res.json();
  }

  async queryRecords(slug: string, filters?: Record<string, string>) {
    const url = new URL(`${this.apiUrl}/api/v1/query/${slug}`);
    if (filters) {
      Object.entries(filters).forEach(([k, v]) => url.searchParams.set(k, v));
    }

    const publicClient = createPublicClient({
      chain: base,
      transport: http(this.rpcUrl),
    });

    // Compensate for local/chain clock drift
    const block = await publicClient.getBlock();
    const driftSeconds = Math.floor(Date.now() / 1000) - Number(block.timestamp);

    const account = privateKeyToAccount(this.privateKey);
    const client = createWalletClient({
      account,
      chain: base,
      transport: http(this.rpcUrl),
    }).extend(publicActions);

    const fetchWithPay = wrapFetchWithPayment(fetch, client as any);

    const originalNow = Date.now;
    Date.now = () => originalNow() - (driftSeconds + 300) * 1000;

    try {
      const res = await fetchWithPay(url.toString());
      if (!res.ok) {
        throw new Error(`Paid query failed: ${res.statusText} (${res.status})`);
      }
      return res.json();
    } finally {
      Date.now = originalNow;
    }
  }
}
