// Test environment bootstrap.
//
// payment-verify.ts fails fast at import time if X402_PAYOUT_ADDRESS is unset
// (a deliberate, security-motivated guard). Provide a valid address here so the
// module — and its pure helpers under test — can be imported. Tests must NOT run
// in production mode, so binding stays configurable and no real keys are needed.
process.env.X402_PAYOUT_ADDRESS ??= '0x0000000000000000000000000000000000000001';
(process.env as any).NODE_ENV ??= 'test';
delete process.env.VERCEL_ENV;
