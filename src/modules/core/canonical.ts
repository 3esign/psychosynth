import { createHash } from 'crypto';

export function canonicalJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;
  if (value && typeof value === 'object') {
    const keys = Object.keys(value as object).sort();
    return `{${keys.map(k =>
      `${JSON.stringify(k)}:${canonicalJson((value as Record<string, unknown>)[k])}`
    ).join(',')}}`;
  }
  return JSON.stringify(value);
}

export const sha256 = (s: string) =>
  createHash('sha256').update(s, 'utf8').digest('hex');

export const contentHash = (c: unknown) => sha256(canonicalJson(c));
