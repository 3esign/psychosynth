-- Migration 0010: Cryptographic buyer reviews table
CREATE TABLE reviews (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_slug    TEXT NOT NULL,
  buyer_wallet    TEXT NOT NULL,
  rating          INT NOT NULL CHECK (rating BETWEEN 1 AND 5),
  comment         TEXT,
  signature       TEXT NOT NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (product_slug, buyer_wallet)
);

CREATE INDEX idx_reviews_product ON reviews(product_slug);
