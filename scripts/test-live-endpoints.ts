import * as fs from 'fs';
import * as path from 'path';

function loadEnv() {
  const p = path.join(process.cwd(), '.env');
  if (!fs.existsSync(p)) return;
  for (const line of fs.readFileSync(p, 'utf8').split('\n')) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m) process.env[m[1]] = m[2].trim().replace(/^["']|["']$/g, '');
  }
}
loadEnv();

async function main() {
  console.log("=== Testing Live API Browse Endpoints ===");

  const prodUrl = 'https://psychosynth.vercel.app';

  // 1. Test Solana Pack
  try {
    const r1 = await fetch(`${prodUrl}/api/v1/browse/solana-trading-pack`);
    const d1 = await r1.json();
    console.log('\n[Solana Trading Pack Live API]:');
    console.log(`Product: ${d1.product?.name}, Total Matching Records: ${d1.total}`);
    console.log(`Sample Profile: ${d1.records?.[0]?.name} (${d1.records?.[0]?.mbti_label})`);
  } catch (e: any) {
    console.error("Solana fetch err:", e.message);
  }

  // 2. Test Robinhood Pack
  try {
    const r2 = await fetch(`${prodUrl}/api/v1/browse/robinhood-counterparty-pack`);
    const d2 = await r2.json();
    console.log('\n[Robinhood Counterparty Pack Live API]:');
    console.log(`Product: ${d2.product?.name}, Total Matching Records: ${d2.total}`);
    console.log(`Sample Persona: ${d2.records?.[0]?.name}`);
  } catch (e: any) {
    console.error("Robinhood fetch err:", e.message);
  }

  // 3. Test Behavioral Response Library
  try {
    const r3 = await fetch(`${prodUrl}/api/v1/browse/behavioral-response-library`);
    const d3 = await r3.json();
    console.log('\n[Behavioral Response Library Live API]:');
    console.log(`Product: ${d3.product?.name}, Total Matching Records: ${d3.total}`);
    console.log(`Sample Response: ${d3.records?.[0]?.response?.substring(0, 100)}...`);
  } catch (e: any) {
    console.error("Behavioral fetch err:", e.message);
  }
}

main().catch(console.error);
