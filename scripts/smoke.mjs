import fs from 'fs';
import path from 'path';

const prodUrl = process.env.PSYCHOSYNTH_BASE_URL || 'https://psychosynth.vercel.app';

console.log(`psychosynth smoke test → ${prodUrl}`);
console.log("----------------------------------------------------------------");

let fail = false;

async function check(name, url, assertFn) {
  try {
    const res = await fetch(url);
    if (res.status !== 200) {
      console.log(`FAIL  ${name.padEnd(42)} HTTP ${res.status}`);
      fail = true;
      return;
    }
    const data = await res.json();
    const passed = assertFn(data);
    if (passed) {
      console.log(`PASS  ${name.padEnd(42)} HTTP 200`);
    } else {
      console.log(`FAIL  ${name.padEnd(42)} 200 but assertion failed`);
      fail = true;
    }
  } catch (e) {
    console.log(`FAIL  ${name.padEnd(42)} Fetch error: ${e.message}`);
    fail = true;
  }
}

async function run() {
  // 1. Discovery
  await check("discovery", `${prodUrl}/api/v1/discovery`, data => {
    return data.products && data.products.length >= 5;
  });

  // 2. Products Catalog
  await check("products catalog", `${prodUrl}/api/v1/products`, data => {
    return Array.isArray(data) && data.length >= 5;
  });

  // 3. Previews
  const slugs = [
    'personality-profile-library',
    'robinhood-counterparty-pack',
    'solana-trading-pack',
    'behavioral-response-library',
    'cognitive-bias-simulator'
  ];

  for (const slug of slugs) {
    await check(`preview/${slug}`, `${prodUrl}/api/v1/preview/${slug}`, data => {
      return data.count > 0 && data.records && data.records.length > 0;
    });
  }

  // 4. Bias examples+mitigations
  await check("bias examples+mitigations", `${prodUrl}/api/v1/preview/cognitive-bias-simulator`, data => {
    const first = data.records?.[0];
    return first && Array.isArray(first.examples) && first.examples.length > 0 && Array.isArray(first.mitigations) && first.mitigations.length > 0;
  });

  // 5. Tag hygiene
  const hygieneSlugs = [
    'personality-profile-library',
    'robinhood-counterparty-pack',
    'solana-trading-pack'
  ];
  for (const slug of hygieneSlugs) {
    await check(`tag-hygiene/${slug}`, `${prodUrl}/api/v1/preview/${slug}`, data => {
      const records = data.records || [];
      for (const r of records) {
        const tags = r.tags || [];
        if (tags.some(t => t.startsWith('batch-'))) {
          return false;
        }
      }
      return true;
    });
  }

  // 6. Shapes
  await check("shape/profiles(big_five+mbti)", `${prodUrl}/api/v1/preview/personality-profile-library`, data => {
    const first = data.records?.[0];
    return first && ('big_five' in first) && ('mbti_label' in first) && ('decision_style' in first) && (first.big_five && 'neuroticism' in first.big_five);
  });

  await check("shape/responses(embeds are objects)", `${prodUrl}/api/v1/preview/behavioral-response-library`, data => {
    const first = data.records?.[0];
    return first && (typeof first.scenarios === 'object') && (typeof first.profiles === 'object') && ('response' in first) && ('reasoning_chain' in first) && ('confidence' in first);
  });

  // 7. Hosted runner
  try {
    const res = await fetch(`${prodUrl}/psychosynth.mjs`);
    if (res.status === 200) {
      const text = await res.text();
      const hasHeader = text.includes('zero-dependency') && text.includes('const COMMANDS');
      if (hasHeader) {
        console.log(`PASS  ${"hosted runner /psychosynth.mjs".padEnd(42)} HTTP 200`);
      } else {
        console.log(`FAIL  ${"hosted runner /psychosynth.mjs".padEnd(42)} 200 but content verification failed`);
        fail = true;
      }
    } else {
      console.log(`FAIL  ${"hosted runner /psychosynth.mjs".padEnd(42)} HTTP ${res.status}`);
      fail = true;
    }
  } catch (e) {
    console.log(`FAIL  ${"hosted runner /psychosynth.mjs".padEnd(42)} Fetch error: ${e.message}`);
    fail = true;
  }

  // 8. Evals
  await check("eval/robinhood-stress-battery", `${prodUrl}/api/v1/eval/robinhood-stress-battery`, data => {
    return data.scenarios || data.battery || data.title || data.rubric;
  });

  await check("eval/a2a-commerce-battery", `${prodUrl}/api/v1/eval/a2a-commerce-battery`, data => {
    return data.scenarios || data.battery || data.title || data.rubric;
  });

  console.log("----------------------------------------------------------------");
  if (!fail) {
    console.log("ALL CHECKS PASSED");
  } else {
    console.log("SOME CHECKS FAILED (see above)");
    process.exit(1);
  }
}

run().catch(console.error);
