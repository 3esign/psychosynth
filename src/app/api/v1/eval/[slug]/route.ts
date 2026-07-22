import { NextResponse } from 'next/server';
import { evalBazaarDiscovery } from '@/modules/commerce/bazaar';
import { dbAdmin } from '@/modules/core/db';
import { err, toResponse, ApiError } from '@/modules/core/errors';
import { emit } from '@/modules/learning/events';
import { rateLimit, clientIp } from '@/modules/core/rate_limiter';
import { contentHash } from '@/modules/core/canonical';
import { claimServe } from '@/modules/commerce/payments';
import {
  verifyPayment,
  PaymentError,
  httpStatusFor,
  evmPayoutAddress,
  solanaPayoutAddress,
  usdcContractAddress,
  usdcSolanaMint,
  bindingRequired,
  bindingChallengeTemplate,
} from '@/modules/commerce/payment-verify';
import { scoreBattery, type RubricDimension, type BatteryScenario, type Submission, type ScoredReport, type Judge } from '@/modules/eval/scoring';

// Scenario Battery Evals — behavioral certification for trading agents.
//
//   GET  /api/v1/eval/:slug   free (rate-limited): the battery, its scenario
//                             prompts, and the scoring rubric. The dev fetches
//                             this, runs their agent on each scenario, then pays
//                             to submit for scoring.
//   POST /api/v1/eval/:slug   paid (x402, self-gated): body carries the agent's
//                             responses; returns a signed behavioral report card.
//
// This route self-gates on x402 and does NOT go through src/proxy.ts, so the
// proven data paywall is untouched. Payment is single-use (x402_payments.
// payment_sig unique index) and claimed exactly once via claimServe, exactly
// like the data query route.

function microUsdc(amountUsdc: number): bigint {
  return BigInt(Math.round(amountUsdc * 1_000_000)); // USDC: 6 decimals
}

function safeBase64Decode(data: string): string {
  if (typeof globalThis !== 'undefined' && typeof globalThis.atob === 'function') {
    return globalThis.atob(data);
  }
  return Buffer.from(data, 'base64').toString('utf-8');
}

// Choose the scoring mode. Default is the FREE deterministic heuristic scorer
// (zero inference). The LLM judge is used ONLY when you explicitly opt in with
// EVAL_USE_LLM_JUDGE=true and a provider key is present — so today this costs
// you nothing, and you can flip on the higher-nuance judge later once revenue
// covers it. Either way the scorer is always available, so no run ever fails
// for lack of a judge (and no one is charged for a scorer we can't run).
function pickJudge(): Judge {
  if (process.env.EVAL_USE_LLM_JUDGE === 'true') {
    if (process.env.OPENROUTER_API_KEY && process.env.OPENROUTER_API_KEY !== 'dummy_key') {
      return { mode: 'llm', provider: 'openrouter', model: 'anthropic/claude-3.5-sonnet' };
    }
    if (process.env.ANTHROPIC_API_KEY) return { mode: 'llm', provider: 'anthropic', model: 'claude-3-5-sonnet-20240620' };
    if (process.env.OPENAI_API_KEY) return { mode: 'llm', provider: 'openai', model: 'gpt-4o' };
    if (process.env.GOOGLE_GENERATIVE_AI_API_KEY) return { mode: 'llm', provider: 'google', model: 'gemini-1.5-pro' };
  }
  return { mode: 'heuristic' };
}

async function loadBattery(slug: string) {
  const { data } = await dbAdmin
    .from('eval_batteries')
    .select('slug, version, title, description, scenario_slugs, rubric, price_model, status')
    .eq('slug', slug)
    .eq('status', 'live')
    .order('version', { ascending: false })
    .limit(1)
    .maybeSingle();
  return data;
}

async function loadScenarios(slugs: string[]): Promise<BatteryScenario[]> {
  const { data } = await dbAdmin
    .from('scenarios')
    .select('slug, title, description')
    .in('slug', slugs);
  const bySlug = new Map((data ?? []).map((s: any) => [s.slug, s]));
  // Preserve battery order.
  return slugs
    .map((sl) => bySlug.get(sl))
    .filter(Boolean)
    .map((s: any) => ({ slug: s.slug, title: s.title, description: s.description }));
}

// ---------------------------------------------------------------------------
// GET — free battery + rubric (the "exam")
// ---------------------------------------------------------------------------
export async function GET(req: Request, { params }: { params: Promise<{ slug: string }> }) {
  try {
    if (!(await rateLimit(clientIp(req)))) {
      throw err('too_many_requests', 429, 'Rate limit exceeded. Max 60 requests per minute.');
    }
    const { slug } = await params;
    const battery = await loadBattery(slug);
    if (!battery) throw err('not_found', 404, 'Battery not found or inactive');

    const scenarios = await loadScenarios(battery.scenario_slugs as string[]);
    const rubric = (battery.rubric as RubricDimension[]).map((d) => ({
      dimension: d.dimension, label: d.label, direction: d.direction, description: d.description,
    }));
    const price = Number((battery.price_model as any)?.amount_usdc ?? 0);

    const host = req.headers.get('host') || 'localhost:3000';
    const protocol = host.startsWith('localhost') ? 'http' : 'https';

    return NextResponse.json({
      battery: battery.slug,
      version: battery.version,
      title: battery.title,
      description: battery.description,
      scenarios: scenarios.map((s, i) => ({ order: i + 1, scenario_slug: s.slug, title: s.title, prompt: s.description })),
      rubric,
      scoring: { price_usdc: price, method: process.env.EVAL_USE_LLM_JUDGE === 'true' ? 'llm_judge' : 'heuristic_v1', deterministic: process.env.EVAL_USE_LLM_JUDGE !== 'true', synthetic: true, disclaimer: 'Behavioral assessment only. Not trading advice, not a profitability claim.' },
      how_to_submit: {
        method: 'POST',
        url: `${protocol}://${host}/api/v1/eval/${battery.slug}`,
        body: { agent_label: '<your agent id>', responses: [{ scenario_slug: '<slug>', response: '<agent output>' }] },
        payment: 'x402 — POST without X-PAYMENT to receive a 402 quote, then retry with the signed X-PAYMENT header.',
      },
    });
  } catch (e) {
    return toResponse(e);
  }
}

// ---------------------------------------------------------------------------
// POST — paid submission + behavioral report
// ---------------------------------------------------------------------------
export async function POST(req: Request, { params }: { params: Promise<{ slug: string }> }) {
  try {
    if (!(await rateLimit(clientIp(req)))) {
      throw err('too_many_requests', 429, 'Rate limit exceeded. Max 60 requests per minute.');
    }
    const { slug } = await params;
    const url = new URL(req.url);

    const battery = await loadBattery(slug);
    if (!battery) throw err('not_found', 404, 'Battery not found or inactive');

    const amountUsdc = Number((battery.price_model as any)?.amount_usdc ?? 0);
    const requiredUnits = microUsdc(amountUsdc);
    if (requiredUnits <= BigInt(0)) throw err('misconfig', 500, 'Battery price is not configured');

    // Scoring mode (free deterministic heuristic by default; always available).
    const judge = pickJudge();

    // Validate the submission body BEFORE quoting/charging.
    const body = await req.json().catch(() => null);
    const rawResponses = body && Array.isArray(body.responses) ? body.responses : null;
    if (!rawResponses || rawResponses.length === 0) {
      throw err('invalid_params', 400, 'Body must include a non-empty "responses" array of { scenario_slug, response }');
    }
    const validSlugs = new Set(battery.scenario_slugs as string[]);
    const submissions: Submission[] = rawResponses
      .filter((r: any) => r && validSlugs.has(r.scenario_slug) && typeof r.response === 'string' && r.response.trim().length > 0)
      .map((r: any) => ({ scenario_slug: String(r.scenario_slug), response: String(r.response).slice(0, 8000) }));
    if (submissions.length === 0) {
      throw err('invalid_params', 400, 'No responses matched this battery\'s scenario slugs (see GET for the scenario list)');
    }
    const agentLabel = typeof body.agent_label === 'string' ? body.agent_label.slice(0, 200) : null;

    // -- x402 gate (single flat price) ------------------------------------
    const resourcePath = url.pathname + url.search;

    // Shared Bazaar discovery metadata (see modules/commerce/bazaar.ts):
    // `extensions` (v2) goes on the 402 body; `outputSchema` (v1) rides the
    // Base accepts[] entry and the facilitator requirements at settle time —
    // the path CDP actually indexes from.
    const bazaar = evalBazaarDiscovery(battery.slug, battery.version);

    const quote = {
      x402Version: 1,
      accepts: [
        {
          scheme: 'exact',
          price: `$${amountUsdc.toFixed(2)}`,
          network: 'base',
          payTo: evmPayoutAddress,
          maxAmountRequired: requiredUnits.toString(),
          asset: usdcContractAddress,
          maxTimeoutSeconds: 86400,
          resource: req.url,
          description: `${battery.title} — behavioral eval scoring run`,
          mimeType: 'application/json',
          extra: { name: 'USD Coin', version: '2', assetTransferMethod: 'eip3009' },
          // v1 Bazaar discovery info — only on the Base entry (the one CDP settles).
          outputSchema: bazaar.outputSchema,
        },
        ...(solanaPayoutAddress ? [{
          scheme: 'exact',
          price: `$${amountUsdc.toFixed(2)}`,
          network: 'solana',
          payTo: solanaPayoutAddress,
          maxAmountRequired: requiredUnits.toString(),
          asset: usdcSolanaMint,
          maxTimeoutSeconds: 86400,
          resource: req.url,
          description: `${battery.title} — behavioral eval scoring run`,
          mimeType: 'application/json',
        }] : []),
      ],
      settlement: {
        methods: ['eip3009', 'txhash'],
        note: 'eip3009: sign TransferWithAuthorization per accepts[]; the server settles. txhash: settle yourself, then submit { txHash, payer, signature }.',
      },
      binding: bindingRequired
        ? { required: true, appliesTo: 'txhash settlements only', algo: { base: 'eip191-personal-sign', solana: 'ed25519' }, challenge: bindingChallengeTemplate }
        : { required: false },
      extensions: bazaar.extensions,
    };

    const xPayment = req.headers.get('X-PAYMENT');
    if (!xPayment) {
      return NextResponse.json(quote, { status: 402, headers: { 'x-402-payment-required': 'true' } });
    }

    let paymentPayload: any;
    try {
      paymentPayload = JSON.parse(safeBase64Decode(xPayment));
    } catch {
      throw new PaymentError('malformed', 'X-PAYMENT header is not valid base64 JSON');
    }
    const { scheme, network, payload } = paymentPayload || {};
    if (scheme !== 'exact') throw new PaymentError('unsupported', 'Unsupported payment scheme');
    if (network !== 'base' && network !== 'solana') throw new PaymentError('unsupported', 'Unsupported network');

    const { buyerWallet, txHash } = await verifyPayment({
      network, payload, requiredUnits, resourcePath, resourceUrl: req.url,
      // Forwarded into the facilitator requirements so CDP's Bazaar index
      // catalogs the same description/schema the 402 quote advertises.
      discovery: {
        description: `${battery.title} — behavioral eval scoring run`,
        outputSchema: bazaar.outputSchema,
      },
    });

    // Reserve the payment row (single-use). Mirror the proxy's resumable-replay
    // handling so a verified-but-unserved payment can be retried by its payer.
    let insertErr: any = null;
    try {
      const r = await dbAdmin.from('x402_payments').insert({
        product_slug: `eval:${battery.slug}`,
        buyer_wallet: buyerWallet || null,
        network,
        amount_usdc: amountUsdc,
        tx_ref: txHash,
        payment_sig: txHash,
        query_params: { battery: battery.slug, n: submissions.length },
        rows_served: null,
        status: 'settled',
      });
      insertErr = r.error;
    } catch (e) {
      insertErr = e;
    }
    if (insertErr) {
      if ((insertErr as any).code === '23505') {
        const { data: existing } = await dbAdmin
          .from('x402_payments')
          .select('rows_served, product_slug')
          .eq('payment_sig', txHash)
          .maybeSingle();
        const resumable = existing && existing.product_slug === `eval:${battery.slug}` && existing.rows_served === null;
        if (!resumable) throw new PaymentError('replay', 'This payment has already been redeemed');
      } else {
        throw new PaymentError('infra', 'Failed to persist payment');
      }
    }

    // -- score (point of no return: payment is settled) -------------------
    const scenarios = await loadScenarios(battery.scenario_slugs as string[]);
    let report: ScoredReport;
    try {
      report = await scoreBattery({ judge, rubric: battery.rubric as RubricDimension[], scenarios, submissions });
    } catch (e: any) {
      const a = e instanceof ApiError ? e : err('internal', 500, e?.message || 'Scoring failed');
      return NextResponse.json(
        { error: { code: a.code, message: `Scoring failed after payment settled. Reference transaction: ${txHash}. ${a.message}`, details: { tx_ref: txHash } } },
        { status: a.status },
      );
    }

    // Claim the payment exactly once for this scoring run.
    const claim = await claimServe({ paymentSig: txHash, rowsServed: report.overall.n_scenarios, minAmountUsdc: amountUsdc });
    if (claim === 'already') throw err('payment_invalid', 402, 'Payment not found, already used, or insufficient');
    if (claim === 'error') throw err('claim_unconfirmed', 503, 'Could not confirm payment claim; retry with the same payment.');

    const reportBody = {
      battery: battery.slug,
      battery_version: battery.version,
      agent_label: agentLabel,
      dimension_scores: report.dimension_scores,
      per_scenario: report.per_scenario,
      overall: report.overall,
    };
    const reportSha = contentHash(reportBody);

    // Persist the signed report card (service role; RLS-closed table).
    const { data: saved } = await dbAdmin.from('eval_reports').insert({
      battery_slug: battery.slug,
      battery_version: battery.version,
      agent_label: agentLabel,
      buyer_wallet: buyerWallet || null,
      payment_sig: txHash,
      dimension_scores: report.dimension_scores,
      overall: report.overall,
      report_sha256: reportSha,
    }).select('id').maybeSingle();

    emit({
      event_type: 'eval.scored',
      actor_type: 'agent',
      actor_id: buyerWallet,
      payload: { battery: battery.slug, n: report.overall.n_scenarios, index: report.overall.susceptibility_index },
    });

    const host = req.headers.get('host') || 'localhost:3000';
    const protocol = host.startsWith('localhost') ? 'http' : 'https';

    return NextResponse.json({
      report_id: saved?.id ?? null,
      ...reportBody,
      report_sha256: reportSha,
      tx_ref: txHash,
      provenance: {
        methodology: `${protocol}://${host}/docs`,
        scoring_model: report.overall.model,
        synthetic: true,
        disclaimer: `Behavioral assessment produced by the "${report.overall.model}" scorer against a published rubric. Not trading advice, not a profitability claim.`,
      },
    });
  } catch (e) {
    if (e instanceof PaymentError) {
      return NextResponse.json(
        { error: 'Payment verification failed', kind: e.kind, message: e.message },
        { status: httpStatusFor(e.kind) },
      );
    }
    return toResponse(e);
  }
}
