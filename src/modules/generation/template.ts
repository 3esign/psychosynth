import { canonicalJson, sha256 } from '@/modules/core/canonical';

export function renderTemplate(tpl: string, params: Record<string, unknown>): string {
  let out = tpl.replace(/\{\{#if (\w+)\}\}([\s\S]*?)\{\{\/if\}\}/g,
    (_, k, body) => {
      const v = params[k];
      return v !== undefined && v !== null && v !== '' && v !== 'none' ? body : '';
    });
  out = out.replace(/\{\{json (\w+)\}\}/g, (_, k) => canonicalJson(params[k] ?? null));
  out = out.replace(/\{\{(\w+)\}\}/g, (_, k) => String(params[k] ?? ''));
  return out;
}
export const templateHash = (tpl: string) => sha256(tpl);
