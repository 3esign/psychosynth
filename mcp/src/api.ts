// Thin HTTP client for the Psychosynth public API. Every endpoint used here
// (catalog, preview, quote) is free and unauthenticated — no wallet involved.

import { readBodySafe } from './util.js';

export const API_BASE = (process.env.PSYCHOSYNTH_API_URL || 'https://psychosynth.vercel.app').replace(/\/+$/, '');

export interface ApiResult {
  status: number;
  body: any;
}

export function buildQueryUrl(slug: string, filters?: Record<string, string | undefined>): string {
  const url = new URL(`${API_BASE}/api/v1/query/${encodeURIComponent(slug)}`);
  for (const [k, v] of Object.entries(filters ?? {})) {
    if (v != null && v !== '') url.searchParams.set(k, String(v));
  }
  return url.toString();
}

export async function getJson(url: string): Promise<ApiResult> {
  const res = await fetch(url, { headers: { accept: 'application/json' } });
  return { status: res.status, body: await readBodySafe(res) };
}

export async function listProducts(): Promise<ApiResult> {
  return getJson(`${API_BASE}/api/v1/products`);
}

export async function previewRecords(slug: string): Promise<ApiResult> {
  return getJson(`${API_BASE}/api/v1/preview/${encodeURIComponent(slug)}`);
}

// Hitting the paid endpoint with no X-PAYMENT header returns the 402 quote
// (price + available pack tiers). Pure discovery: no wallet, no money moved.
export async function getQuote(slug: string, filters?: Record<string, string | undefined>): Promise<ApiResult> {
  return getJson(buildQueryUrl(slug, filters));
}
