CREATE TABLE recipes (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  version           INT NOT NULL DEFAULT 1,
  query_rules       JSONB NOT NULL,
  composition_rules JSONB,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE products (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug        TEXT UNIQUE NOT NULL,
  name        TEXT NOT NULL,
  description TEXT,
  recipe_id   UUID NOT NULL REFERENCES recipes(id),
  dataset_id  UUID REFERENCES datasets(id),
  price_model JSONB NOT NULL,
  preview_pct NUMERIC(4,3) NOT NULL DEFAULT 0.05,
  status      TEXT NOT NULL DEFAULT 'draft'
              CHECK (status IN ('draft','live','retired')),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE x402_payments (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_slug TEXT NOT NULL,
  buyer_wallet TEXT,
  network      TEXT NOT NULL,
  amount_usdc  NUMERIC(12,6) NOT NULL,
  tx_ref       TEXT,
  query_params JSONB,
  rows_served  INT,
  status       TEXT NOT NULL DEFAULT 'settled'
               CHECK (status IN ('settled','failed','refunded')),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_payments_wallet ON x402_payments(buyer_wallet);

DO $$ DECLARE t text;
BEGIN
  FOR t IN SELECT tablename FROM pg_tables WHERE schemaname='public' LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
  END LOOP;
END $$;
