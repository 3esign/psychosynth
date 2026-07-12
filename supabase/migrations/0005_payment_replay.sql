-- Replay protection for the custom EIP-3009 payment gate (src/proxy.ts).
-- The proxy looks up incoming client signatures here BEFORE spending settlement
-- gas; the query route stores the signature on success. tx_ref keeps holding
-- the on-chain settlement tx hash (audit trail), payment_sig holds the buyer's
-- EIP-3009 authorization signature (uniqueness = replay guard).
ALTER TABLE x402_payments ADD COLUMN payment_sig TEXT;

CREATE UNIQUE INDEX idx_payments_sig ON x402_payments(payment_sig)
  WHERE payment_sig IS NOT NULL;
