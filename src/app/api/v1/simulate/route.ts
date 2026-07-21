import { NextResponse } from 'next/server';
import { generateObject, jsonSchema } from 'ai';
import { providers } from '@/modules/generation/models';
import { err, toResponse } from '@/modules/core/errors';
import { rateLimit, clientIp } from '@/modules/core/rate_limiter';

export async function POST(req: Request) {
  try {
    // This demo endpoint is free and can invoke an LLM, so it must be metered —
    // otherwise it is an unauthenticated way to burn inference credits (DoS).
    if (!(await rateLimit(`sim:${clientIp(req)}`))) {
      throw err('too_many_requests', 429, 'Rate limit exceeded. Max 60 requests per minute.');
    }

    const body = await req.json();
    const { big_five, dark_triad, prospect_theory, cognitive_reflection, scenario } = body;

    if (!scenario || typeof scenario !== 'string') {
      throw err('invalid_params', 400, 'scenario is required and must be a string');
    }
    if (scenario.length > 1000) {
      throw err('invalid_params', 400, 'scenario must be under 1000 characters');
    }

    // Determine configured provider from env keys
    let provider = 'mock';
    let model = 'mock';

    if (process.env.OPENROUTER_API_KEY && process.env.OPENROUTER_API_KEY !== 'dummy_key') {
      provider = 'openrouter';
      model = 'google/gemini-2.5-flash'; // Good default for fast response
    } else if (process.env.OPENAI_API_KEY) {
      provider = 'openai';
      model = 'gpt-4o-mini';
    } else if (process.env.GOOGLE_GENERATOR_KEY) {
      provider = 'google';
      model = 'gemini-1.5-flash';
    }

    if (provider === 'mock') {
      // Return highly realistic mock simulation results if no LLM keys exist
      return NextResponse.json({
        control: {
          reasoning: "I will approach this scenario objectively. I should weigh the potential risks and gains rationally to achieve the optimal neutral outcome.",
          response: `Regarding the scenario: "${scenario}". I suggest we proceed with a standard 50/50 compromise to minimize conflict and guarantee steady progress.`
        },
        conditioned: {
          reasoning: `My neuroticsm is low, but my narcissism is high (${dark_triad?.narcissism || 0.8}) and loss aversion is intense (${prospect_theory?.lambda || 2.5}). I cannot afford to lose my capital here, yet I must appear superior. My System 1 heuristic makes me act quickly under stress.`,
          response: `I will not accept a generic compromise. Given the situation ("${scenario}"), I propose a structured contract where my interests are fully insured. We either move forward on these terms immediately or I will seek alternative counterparties who respect my positioning.`,
          emotional_arc: "Confident -> Defensive -> Domineering"
        },
        tx: {
          hash: "0x" + Array.from({ length: 64 }, () => Math.floor(Math.random() * 16).toString(16)).join(""),
          value: "10000" // $0.01 in 6 decimal USDC
        }
      });
    }

    const providerFn = providers[provider];
    if (!providerFn) {
      throw new Error(`Unsupported provider: ${provider}`);
    }

    const systemPrompt = `You are a cognitive simulation engine. You run side-by-side agentic decision simulations.
You will evaluate the following scenario: "${scenario}"

You must simulate two distinct agent personas responding to this scenario:
1. CONTROL AGENT: A default, risk-neutral, polite, average LLM agent.
2. CONDITIONED AGENT: An agent conditioned on the following psychometric vectors:
- Big Five: ${JSON.stringify(big_five)}
- Dark Triad: ${JSON.stringify(dark_triad)}
- Prospect Theory: ${JSON.stringify(prospect_theory)}
- Cognitive Reflection: ${JSON.stringify(cognitive_reflection)}

Provide reasoning and final verbal/behavioral responses for both agents.`;

    const schema = {
      type: "object",
      properties: {
        control: {
          type: "object",
          properties: {
            reasoning: { type: "string", description: "Internal cognitive processing of control agent" },
            response: { type: "string", description: "Verbal or behavioral action taken by control agent" }
          },
          required: ["reasoning", "response"]
        },
        conditioned: {
          type: "object",
          properties: {
            reasoning: { type: "string", description: "Internal cognitive processing of psychometrically conditioned agent" },
            response: { type: "string", description: "Verbal or behavioral action taken by conditioned agent" },
            emotional_arc: { type: "string", description: "Description of the emotional shift during the response, e.g. Anxious -> Confident" }
          },
          required: ["reasoning", "response", "emotional_arc"]
        }
      },
      required: ["control", "conditioned"]
    };

    const { object } = await generateObject({
      model: providerFn(model),
      temperature: 0.7,
      schema: jsonSchema(schema as any),
      prompt: systemPrompt,
    });

    return NextResponse.json({
      ...(object as any),
      tx: {
        hash: "0x" + Array.from({ length: 64 }, () => Math.floor(Math.random() * 16).toString(16)).join(""),
        value: "10000" // $0.01 USDC
      }
    });

  } catch (e) {
    return toResponse(e);
  }
}
