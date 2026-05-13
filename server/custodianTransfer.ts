import fs from "fs/promises";
import path from "path";

export type CustodianTransferEvent = {
  type:
    | "age18_handoff_requested"
    | "age18_transfer_completed_in_kado"
    | "withdrawal_requested"
    | "liquidation_requested";
  fundId: string;
  childEmail?: string | null;
  childUserId?: string | null;
  previousCustodianUserId?: string | null;
  requestedByUserId?: string | null;
  ownershipTransferredAt?: string | null;
  requestedAt?: string | null;
  // Money-movement metadata (for withdrawal_requested / liquidation_requested)
  amount?: string | null;
  currency?: string | null;
  bankAccountId?: string | null;
  bankName?: string | null;
  bankLast4?: string | null;
  withdrawalId?: string | null;
};

export function isCustodianAchEnabled(): boolean {
  return Boolean(String(process.env.CUSTODIAN_TRANSFER_WEBHOOK_URL || "").trim());
}

export type CustodianTransferResult = {
  mode: "webhook" | "outbox_fallback";
  delivered: boolean;
};

const CUSTODIAN_TRANSFER_OUTBOX_PATH = path.join(process.cwd(), ".local", "custodian-transfer-outbox.jsonl");

async function appendOutbox(payload: Record<string, unknown>) {
  await fs.mkdir(path.dirname(CUSTODIAN_TRANSFER_OUTBOX_PATH), { recursive: true });
  await fs.appendFile(CUSTODIAN_TRANSFER_OUTBOX_PATH, JSON.stringify(payload) + "\n", "utf8");
}

export async function queueCustodianTransfer(event: CustodianTransferEvent): Promise<CustodianTransferResult> {
  const webhookUrl = String(process.env.CUSTODIAN_TRANSFER_WEBHOOK_URL || "").trim();
  const webhookSecret = String(process.env.CUSTODIAN_TRANSFER_WEBHOOK_SECRET || "").trim();

  if (webhookUrl) {
    try {
      const response = await fetch(webhookUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(webhookSecret ? { Authorization: `Bearer ${webhookSecret}` } : {}),
        },
        body: JSON.stringify({
          sentAt: new Date().toISOString(),
          ...event,
        }),
      });

      if (!response.ok) {
        const detail = await response.text();
        throw new Error(`Custodian webhook failed (${response.status}): ${detail}`);
      }

      return { mode: "webhook", delivered: true };
    } catch (error) {
      await appendOutbox({
        queuedAt: new Date().toISOString(),
        mode: "outbox_fallback",
        reason: error instanceof Error ? error.message : String(error),
        ...event,
      });
      return { mode: "outbox_fallback", delivered: false };
    }
  }

  await appendOutbox({
    queuedAt: new Date().toISOString(),
    mode: "outbox_fallback",
    reason: "No custodian transfer webhook configured",
    ...event,
  });
  return { mode: "outbox_fallback", delivered: false };
}
