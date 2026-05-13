type Queryable = {
  query: (text: string, params?: any[]) => Promise<{ rows: any[] }>;
};

function toNum(v: any): number {
  const n = Number(v || 0);
  return Number.isFinite(n) ? n : 0;
}

export type GiftReconciliationRepairPreview = {
  linkableTransactions: number;
  txAmountMismatches: number;
  pendingBalanceMismatches: number;
  giftsWithoutMemoryEntries: number;
  giftsWithoutThankYouDrafts: number;
};

export type GiftReconciliationRepairApplied = {
  linkedTransactions: number;
  fixedTransactionAmounts: number;
  fixedPendingBalances: number;
  createdMemoryEntries: number;
  createdThankYouDrafts: number;
};

export async function getGiftReconciliationRepairPreview(db: Queryable): Promise<GiftReconciliationRepairPreview> {
  const linkedPreview = await db.query(`
    SELECT COUNT(*)::int AS count
    FROM transactions t
    JOIN gifts g ON g.stripe_payment_intent_id = t.stripe_payment_intent_id
    WHERE t.type = 'gift'
      AND t.status = 'completed'
      AND t.gift_id IS NULL
      AND t.stripe_payment_intent_id IS NOT NULL
  `);
  const amountFixPreview = await db.query(`
    SELECT COUNT(*)::int AS count
    FROM transactions t
    JOIN gifts g ON (g.id = t.gift_id OR (t.gift_id IS NULL AND g.stripe_payment_intent_id = t.stripe_payment_intent_id))
    WHERE t.type = 'gift'
      AND t.status = 'completed'
      AND ABS(
        COALESCE(CAST(t.amount AS numeric), 0) - (
          CASE
            WHEN CAST(g.net_amount AS numeric) < CAST(g.amount AS numeric)
              THEN CAST(g.amount AS numeric)
            ELSE CAST(g.amount AS numeric) + CAST(g.processing_fee AS numeric) + CAST(g.kora_fee AS numeric)
          END
        )
      ) > 0.009
  `);
  const pendingFixPreview = await db.query(`
    SELECT COUNT(*)::int AS count
    FROM funds f
    LEFT JOIN (
      SELECT fund_id, COALESCE(SUM(CAST(net_amount AS numeric)), 0) AS pending_net
      FROM gifts
      WHERE status IN ('pending', 'processing')
      GROUP BY fund_id
    ) pg ON pg.fund_id = f.id
    WHERE ABS(COALESCE(CAST(f.pending_balance AS numeric), 0) - COALESCE(pg.pending_net, 0)) > 0.009
  `);
  const missingMemoryPreview = await db.query(`
    SELECT COUNT(*)::int AS count
    FROM gifts g
    LEFT JOIN memory_entries m ON m.gift_id = g.id
    WHERE m.id IS NULL
  `);
  const missingThankYouPreview = await db.query(`
    SELECT COUNT(*)::int AS count
    FROM gifts g
    LEFT JOIN thank_yous t ON t.gift_id = g.id
    WHERE t.id IS NULL
  `);

  return {
    linkableTransactions: toNum(linkedPreview.rows[0]?.count),
    txAmountMismatches: toNum(amountFixPreview.rows[0]?.count),
    pendingBalanceMismatches: toNum(pendingFixPreview.rows[0]?.count),
    giftsWithoutMemoryEntries: toNum(missingMemoryPreview.rows[0]?.count),
    giftsWithoutThankYouDrafts: toNum(missingThankYouPreview.rows[0]?.count),
  };
}

export async function runGiftReconciliationRepair(db: Queryable): Promise<GiftReconciliationRepairApplied> {
  const linkedApplied = await db.query(`
    WITH updated AS (
      UPDATE transactions t
      SET
        gift_id = g.id,
        fund_id = COALESCE(t.fund_id, g.fund_id),
        event_id = COALESCE(t.event_id, g.event_id),
        user_id = COALESCE(t.user_id, f.user_id),
        updated_at = NOW()
      FROM gifts g
      JOIN funds f ON f.id = g.fund_id
      WHERE t.type = 'gift'
        AND t.status = 'completed'
        AND t.gift_id IS NULL
        AND t.stripe_payment_intent_id IS NOT NULL
        AND g.stripe_payment_intent_id = t.stripe_payment_intent_id
      RETURNING t.id
    )
    SELECT COUNT(*)::int AS count FROM updated
  `);
  const amountFixApplied = await db.query(`
    WITH updated AS (
      UPDATE transactions t
      SET
        amount = (
          CASE
            WHEN CAST(g.net_amount AS numeric) < CAST(g.amount AS numeric)
              THEN CAST(g.amount AS numeric)
            ELSE CAST(g.amount AS numeric) + CAST(g.processing_fee AS numeric) + CAST(g.kora_fee AS numeric)
          END
        ),
        updated_at = NOW()
      FROM gifts g
      WHERE t.type = 'gift'
        AND t.status = 'completed'
        AND (g.id = t.gift_id OR (t.gift_id IS NULL AND g.stripe_payment_intent_id = t.stripe_payment_intent_id))
        AND ABS(
          COALESCE(CAST(t.amount AS numeric), 0) - (
            CASE
              WHEN CAST(g.net_amount AS numeric) < CAST(g.amount AS numeric)
                THEN CAST(g.amount AS numeric)
              ELSE CAST(g.amount AS numeric) + CAST(g.processing_fee AS numeric) + CAST(g.kora_fee AS numeric)
            END
          )
        ) > 0.009
      RETURNING t.id
    )
    SELECT COUNT(*)::int AS count FROM updated
  `);
  const pendingFixApplied = await db.query(`
    WITH pending_by_fund AS (
      SELECT
        f.id AS fund_id,
        COALESCE(SUM(CAST(g.net_amount AS numeric)) FILTER (WHERE g.status IN ('pending', 'processing')), 0) AS pending_net
      FROM funds f
      LEFT JOIN gifts g ON g.fund_id = f.id
      GROUP BY f.id
    ),
    updated AS (
      UPDATE funds f
      SET
        pending_balance = pb.pending_net,
        updated_at = NOW()
      FROM pending_by_fund pb
      WHERE pb.fund_id = f.id
        AND ABS(COALESCE(CAST(f.pending_balance AS numeric), 0) - COALESCE(pb.pending_net, 0)) > 0.009
      RETURNING f.id
    )
    SELECT COUNT(*)::int AS count FROM updated
  `);
  const memoryApplied = await db.query(`
    WITH inserted AS (
      INSERT INTO memory_entries (fund_id, gift_id, type, content, author_name, photo_url, video_url, created_at)
      SELECT
        g.fund_id,
        g.id,
        'gift_message',
        COALESCE(NULLIF(g.message, ''), 'No note this time, just a gift added to the story.'),
        COALESCE(NULLIF(g.sender_name, ''), 'Someone who loves this child'),
        g.photo_url,
        NULL,
        COALESCE(g.created_at, NOW())
      FROM gifts g
      LEFT JOIN memory_entries m ON m.gift_id = g.id
      WHERE m.id IS NULL
      RETURNING id
    )
    SELECT COUNT(*)::int AS count FROM inserted
  `);
  const thankYouApplied = await db.query(`
    WITH inserted AS (
      INSERT INTO thank_yous (fund_id, gift_id, sender_name, sender_email, message, status, created_at)
      SELECT
        g.fund_id,
        g.id,
        COALESCE(NULLIF(g.sender_name, ''), 'Someone who loves this child'),
        g.sender_email,
        CONCAT(
          'Thank you for adding $',
          TRIM(TRAILING '.' FROM TRIM(TRAILING '0' FROM CAST(COALESCE(CAST(g.net_amount AS numeric), CAST(g.amount AS numeric), 0) AS text))),
          ' to the story, Your gift is already part of the Memory Book.'
        ),
        'draft',
        COALESCE(g.created_at, NOW())
      FROM gifts g
      LEFT JOIN thank_yous t ON t.gift_id = g.id
      WHERE t.id IS NULL
      RETURNING id
    )
    SELECT COUNT(*)::int AS count FROM inserted
  `);

  return {
    linkedTransactions: toNum(linkedApplied.rows[0]?.count),
    fixedTransactionAmounts: toNum(amountFixApplied.rows[0]?.count),
    fixedPendingBalances: toNum(pendingFixApplied.rows[0]?.count),
    createdMemoryEntries: toNum(memoryApplied.rows[0]?.count),
    createdThankYouDrafts: toNum(thankYouApplied.rows[0]?.count),
  };
}
