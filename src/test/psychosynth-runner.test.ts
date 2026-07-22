// Regression guards for the bankr-skill runner (psychosynth.mjs).
//
// These mechanics broke (or nearly broke) in the field before, so they are
// pinned here and run in the pre-publish gate (`npm run test` in publish.sh):
//
//  1. COPY SYNC — public/psychosynth.mjs and the bankr-skill copy must be
//     byte-identical. `prebuild` syncs them at build time, but a commit made
//     without a build ships drifted copies to the Bankr repo.
//  2. IMPORT SAFETY — importing the module must NOT execute main() (no
//     network, no process.exit). The skill's renderers are imported by tests
//     and potentially by other tooling; a regression in the invoked-directly
//     check would fire live HTTP calls at import time.
//  3. RENDERER CONTRACTS — the exact shapes the live API serves (verified
//     against production 2026-07-22) must render, and malformed/empty/
//     array-embedded variants must not crash any renderer.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = process.cwd();
const PUBLIC_COPY = join(ROOT, 'public', 'psychosynth.mjs');
const SKILL_COPY = join(ROOT, 'integrations', 'bankr-skills', 'psychosynth', 'psychosynth.mjs');

// Dynamic import of the shipped module itself (not a rebuilt approximation).
// @ts-expect-error — plain .mjs module without type declarations
const runner = await import(/* @vite-ignore */ PUBLIC_COPY);

describe('runner copy sync', () => {
  it('public/ and bankr-skill copies are byte-identical', () => {
    expect(readFileSync(PUBLIC_COPY, 'utf8')).toBe(readFileSync(SKILL_COPY, 'utf8'));
  });

  it('module exports the four workflow renderers', () => {
    for (const fn of ['renderDoppler', 'renderGuardrails', 'renderNegotiation', 'renderPersonalize']) {
      expect(typeof (runner as any)[fn], fn).toBe('function');
    }
  });
});

// --- fixtures mirroring the live API shapes (checked against prod previews) --
const profileRec = (over: Record<string, unknown> = {}) => ({
  id: 'abcdef12-3456-7890-abcd-ef1234567890',
  version: 4,
  big_five: { openness: 0.5, conscientiousness: 0.5, extraversion: 0.5, agreeableness: 0.5, neuroticism: 0.54 },
  mbti_label: 'INTJ',
  decision_style: 'analytical',
  summary: 's',
  tags: ['robinhood', 'retail-trading'],
  ...over,
});

describe('renderDoppler', () => {
  it('free mode: counts neuroticism >= 0.6 as high-resistance', () => {
    const out = runner.renderDoppler({
      records: [
        profileRec({ big_five: { neuroticism: 0.7 } }),
        profileRec({ big_five: { neuroticism: 0.6 } }), // boundary: counts
        profileRec({ big_five: { neuroticism: 0.59 } }),
      ],
    }, { paid: false });
    expect(out.at(-1)).toContain('2/3');
  });

  it('paid mode: counts prospect-theory lambda >= 2.5', () => {
    const out = runner.renderDoppler({
      records: [
        profileRec({ content: { prospect_theory: { lambda: 3.1 } } }),
        profileRec({ content: { prospect_theory: { lambda: 1.2 } } }),
      ],
    }, { paid: true });
    expect(out.at(-1)).toContain('1/2');
    expect(out[0]).toContain('lambda=3.1');
  });

  it('never crashes on null/empty/malformed input', () => {
    expect(runner.renderDoppler(null, {})).toEqual([expect.stringContaining('0/0')]);
    expect(runner.renderDoppler({ records: [{}] }, { paid: true })[0]).toContain('n/a');
  });
});

describe('renderGuardrails', () => {
  it('renders name/description/example/mitigation per bias', () => {
    const out = runner.renderGuardrails({
      records: [{ slug: 'anchoring', name: 'Anchoring', description: 'd', examples: ['e1'], mitigations: ['m1'] }],
    });
    expect(out[0]).toBe('Bias: Anchoring (anchoring)');
    expect(out[2]).toContain('e1');
    expect(out[3]).toContain('m1');
  });

  it('empty arrays fall back to n/a; null json renders nothing', () => {
    const out = runner.renderGuardrails({ records: [{ name: 'X', slug: 'x', description: 'd', examples: [], mitigations: [] }] });
    expect(out[2]).toContain('n/a');
    expect(runner.renderGuardrails(null)).toEqual([]);
  });
});

describe('renderNegotiation', () => {
  const rec = {
    response: 'counters aggressively',
    reasoning_chain: 'weighted criteria',
    emotional_arc: 'calm',
    confidence: 0.54,
    scenarios: { slug: 's', category: 'trading', title: 'T', description: 'd' },
    profiles: { id: 'p', mbti_label: 'ENTJ', decision_style: 'analytical', big_five: {} },
  };

  it('renders object embeds (current live shape) and filters by category', () => {
    const out = runner.renderNegotiation({ records: [rec, { ...rec, scenarios: { ...rec.scenarios, category: 'crisis' } }] }, 'trading');
    expect(out[0]).toBe('Scenario: T [trading]');
    expect(out.filter((l: string) => l.startsWith('Scenario:'))).toHaveLength(1);
  });

  it('survives array embeds (PostgREST to-many shape) without breaking output', () => {
    const out = runner.renderNegotiation({ records: [{ ...rec, scenarios: [rec.scenarios], profiles: [rec.profiles] }] }, 'trading');
    expect(out[0]).toBe('Scenario: T [trading]');
    expect(out[1]).toContain('ENTJ / analytical');
  });

  it('never crashes on null json or missing embeds', () => {
    expect(runner.renderNegotiation(null, '')).toEqual([]);
    const out = runner.renderNegotiation({ records: [{ response: 'r', reasoning_chain: 'c' }] }, undefined);
    expect(out[0]).toContain('n/a');
  });
});

describe('renderPersonalize', () => {
  it('free mode: neuroticism > 0.55 => conservative UX', () => {
    const [hi, lo] = runner.renderPersonalize({
      records: [profileRec({ big_five: { neuroticism: 0.9 } }), profileRec({ big_five: { neuroticism: 0.2 } })],
    }, { paid: false });
    expect(hi.ux_config.risk_style).toBe('conservative');
    expect(lo.ux_config.risk_style).toBe('aggressive');
  });

  it('paid mode: lambda > 2.0 => conservative UX', () => {
    const [hi] = runner.renderPersonalize({
      records: [profileRec({ content: { prospect_theory: { lambda: 2.4 } } })],
    }, { paid: true });
    expect(hi.ux_config.risk_style).toBe('conservative');
    expect(hi.loss_aversion_lambda).toBe(2.4);
  });
});

describe('shipped source invariants', () => {
  const src = readFileSync(PUBLIC_COPY, 'utf8');

  it('stays zero-dependency (only node: builtin imports)', () => {
    const imports = [...src.matchAll(/^\s*import\s.+?from\s+['"]([^'"]+)['"]/gm)].map((m) => m[1]);
    for (const spec of imports) expect(spec.startsWith('node:'), `non-builtin import: ${spec}`).toBe(true);
  });

  it('uses pathToFileURL for the invoked-directly check (Windows/symlink safe)', () => {
    expect(src).toContain('pathToFileURL(');
    expect(src).not.toContain('new URL(`file://${process.argv[1]}`)');
  });

  it('never auto-retries requests carrying a payment header', () => {
    expect(src).toMatch(/sendsPayment \? 1 :/);
  });
});
