-- Realized gain tracking on the transactions ledger.
--
-- Adds three columns populated when type='sell' rows are written:
--   realized_gain   — saleProceeds - costBasisSold (signed; can be negative)
--   cost_basis_sold — the cost basis of the specific shares sold
--   holding_period  — 'short_term' or 'long_term', based on earliest
--                     purchase date of that ticker in that fund
--
-- Plus a composite index on (fund_id, completed_at) to make the
-- "realized sales for fund X in tax year Y" query on the Tax
-- Documents page cheap.
--
-- Idempotent — IF NOT EXISTS on every clause so re-running is a
-- no-op. Existing sell transactions remain in place with NULLs in
-- the new columns (we don't backfill historic sales because the
-- cost basis at sell time would have to be reconstructed, and
-- there are few enough historic sells in production right now
-- that a manual reconciliation is cheaper than getting backfill
-- math right).

ALTER TABLE "transactions"
  ADD COLUMN IF NOT EXISTS "realized_gain" decimal(12,2);

ALTER TABLE "transactions"
  ADD COLUMN IF NOT EXISTS "cost_basis_sold" decimal(12,2);

ALTER TABLE "transactions"
  ADD COLUMN IF NOT EXISTS "holding_period" text;

CREATE INDEX IF NOT EXISTS "transactions_fund_id_completed_at_idx"
  ON "transactions" ("fund_id", "completed_at");
