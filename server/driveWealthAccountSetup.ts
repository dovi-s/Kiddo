// DriveWealth UTMA account setup — payload assembly + scaffolded entry points.
//
// Status: SCAFFOLDED. The HTTP client is NOT wired. This module exists so that:
//   1. We have a single, named place where the brokerage account-creation
//      logic lives. When DW credentials arrive, only the `submitToDriveWealth`
//      function changes — every other call site stays the same.
//   2. The payload assembly is correct TODAY: it takes the data Kiddo actually
//      collects (custodian KYC + child fund + child SSN passed-through) and
//      shapes a DW UTMA account-creation request. We can validate the shape
//      against DW's docs before flipping the switch.
//   3. UTMA-specific fields the audit flagged (state-of-majority, irrevocable
//      acknowledgment, successor custodian, full child SSN) are all included,
//      so we never ship a partial account that would fail DW's validation
//      or break tax reporting.
//
// To go live:
//   - Set DRIVEWEALTH_API_KEY, DRIVEWEALTH_API_SECRET, DRIVEWEALTH_BASE_URL
//   - Replace the stub body of `submitToDriveWealth` with an authenticated POST
//   - Update the fund row with the returned drivewealthAccountId
//   - Remove the "scaffolded" log lines

import type { Request } from "express";
import { db } from "./db";
import { eq } from "drizzle-orm";
import { funds, users } from "@shared/schema";
import { getMajorityAgeForState, getMajorityDate } from "@shared/utma";

export interface DriveWealthCustodianPayload {
  legalFirstName: string;
  legalLastName: string;
  dob: string;          // YYYY-MM-DD
  ssn: string;          // 9 digits, no dashes
  email: string;
  phone: string;        // E.164 ideally; 10-digit US accepted
  citizenship: string;  // "us_citizen" | "permanent_resident"
  address: {
    street: string;
    city: string;
    state: string;      // 2-letter
    zip: string;        // 5 digits
    country: "USA";
  };
}

export interface DriveWealthMinorPayload {
  legalFirstName: string;
  legalLastName: string;
  dob: string;          // YYYY-MM-DD
  ssn: string;          // 9 digits, no dashes — child's SSN
  state: string;        // 2-letter, the kid's state of residence
  majorityAge: number;  // 18-25, locked at fund creation per state law
}

export interface DriveWealthAccountPayload {
  accountType: "UTMA";
  // The legal account title is "{Minor full legal name} UTMA {Custodian full legal name}".
  // DW computes this server-side from the fields, but we send it explicitly so
  // it appears the same on every statement.
  accountTitle: string;
  custodian: DriveWealthCustodianPayload;
  minor: DriveWealthMinorPayload;
  irrevocabilityAcknowledgedAt: string;        // ISO timestamp from funds.utmaAcknowledgedAt
  irrevocabilityAcknowledgedByUserId: string;  // funds.utmaAcknowledgedByUserId
  // The successor custodian is optional but DW lets us register it so it shows
  // on the account record. Used by their estate-handoff workflow if the
  // primary custodian becomes incapacitated.
  successorCustodian?: {
    name: string;
    email?: string;
    relation?: string;
  };
  // Computed from majority age + birthdate. DW uses this to gate the at-18
  // ownership transfer event (which is when our age18TransitionWorker fires).
  majorityDate: string; // YYYY-MM-DD
}

export interface AssemblePayloadInput {
  fundId: string;
  childSsnDigits: string; // 9 digits; passed through from the request, NEVER persisted
}

export class AssemblePayloadError extends Error {
  field: string;
  constructor(message: string, field: string) {
    super(message);
    this.field = field;
    this.name = "AssemblePayloadError";
  }
}

function ymd(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

// Pull the custodian + child + acknowledgment + successor data out of the DB
// and shape it into DW's expected payload. Throws AssemblePayloadError naming
// the missing field so the caller can return a precise 400 to the client.
//
// The full child SSN is passed in via `input.childSsnDigits` — we never read
// it from the DB. The current contract: client posts the SSN with the
// activate-investing request, server validates + forwards here, then DW
// stores it in their PII vault. We only persist `recipient_ssn_collected_at`.
export async function assembleUTMAAccountPayload(
  input: AssemblePayloadInput,
): Promise<DriveWealthAccountPayload> {
  const [fund] = await db.select().from(funds).where(eq(funds.id, input.fundId)).limit(1);
  if (!fund) throw new AssemblePayloadError("Fund not found", "fund");

  if (String(fund.accountType || "").toUpperCase() !== "UTMA") {
    throw new AssemblePayloadError("Only UTMA funds can be opened at the brokerage", "accountType");
  }

  // Custodian — from the parent's KYC submission.
  const [custodian] = await db.select().from(users).where(eq(users.id, fund.userId)).limit(1);
  if (!custodian) throw new AssemblePayloadError("Custodian user not found", "custodian");
  const kycData: any = (custodian as any).kycData || {};
  if (!kycData?.firstName || !kycData?.lastName) {
    throw new AssemblePayloadError("Custodian must complete KYC before opening an account", "custodian.kyc");
  }
  // The custodian's full SSN isn't stored in our DB (PCI-style: we hold only
  // ssnProvided=true). When this function ships for real, custodian SSN must
  // be re-collected at activate-investing time and passed through, same as
  // the child SSN — never persisted, only forwarded to DW.
  // Until then, this field is a placeholder so the payload is structurally complete.
  const custodianSsn = (kycData as any)?._unstoredSsn || "<unstored — collect at activate-time>";

  // Child / minor.
  if (!fund.recipientFirstName || !fund.recipientLastName) {
    throw new AssemblePayloadError("Child first and last name are required for the UTMA legal title", "minor.name");
  }
  if (!fund.recipientBirthdate) {
    throw new AssemblePayloadError("Child date of birth is required", "minor.dob");
  }
  const childState = String((fund as any).recipientState || kycData.address?.state || "").toUpperCase();
  if (!/^[A-Z]{2}$/.test(childState)) {
    throw new AssemblePayloadError("Child state of residence is required (UTMA majority age varies by state)", "minor.state");
  }
  const ssnDigits = String(input.childSsnDigits || "").replace(/\D/g, "");
  if (ssnDigits.length !== 9) {
    throw new AssemblePayloadError("Child SSN must be 9 digits", "minor.ssn");
  }
  const majorityAge = Number((fund as any).majorityAge) || getMajorityAgeForState(childState);
  const majorityDate = getMajorityDate(fund.recipientBirthdate, majorityAge);
  if (!majorityDate) {
    throw new AssemblePayloadError("Could not compute majority date from birthdate", "minor.majorityDate");
  }

  // UTMA acknowledgment — required per fund (not just once at signup).
  if (!(fund as any).utmaAcknowledgedAt || !(fund as any).utmaAcknowledgedByUserId) {
    throw new AssemblePayloadError(
      "Per-fund UTMA irrevocability acknowledgment is required",
      "utmaAcknowledgment",
    );
  }

  // Build the payload.
  const minorFullName = `${fund.recipientFirstName} ${fund.recipientLastName}`.trim();
  const custodianFullName = `${kycData.firstName} ${kycData.lastName}`.trim();
  const accountTitle = `${minorFullName} UTMA ${custodianFullName}`;

  const successor = (fund as any).successorCustodianName
    ? {
        name: String((fund as any).successorCustodianName),
        email: (fund as any).successorCustodianEmail
          ? String((fund as any).successorCustodianEmail)
          : undefined,
        relation: (fund as any).successorCustodianRelation
          ? String((fund as any).successorCustodianRelation)
          : undefined,
      }
    : undefined;

  return {
    accountType: "UTMA",
    accountTitle,
    custodian: {
      legalFirstName: String(kycData.firstName).trim(),
      legalLastName: String(kycData.lastName).trim(),
      dob: String(kycData.dob || "").trim(),
      ssn: custodianSsn,
      email: String((custodian as any).email || "").trim(),
      phone: String(kycData.phone || "").trim(),
      citizenship: String(kycData.citizenship || "us_citizen"),
      address: {
        street: String(kycData.address?.street || "").trim(),
        city: String(kycData.address?.city || "").trim(),
        state: String(kycData.address?.state || "").trim().toUpperCase(),
        zip: String(kycData.address?.zip || "").trim(),
        country: "USA",
      },
    },
    minor: {
      legalFirstName: String(fund.recipientFirstName).trim(),
      legalLastName: String(fund.recipientLastName).trim(),
      dob: ymd(fund.recipientBirthdate instanceof Date ? fund.recipientBirthdate : new Date(fund.recipientBirthdate)),
      ssn: ssnDigits,
      state: childState,
      majorityAge,
    },
    irrevocabilityAcknowledgedAt: ((fund as any).utmaAcknowledgedAt instanceof Date
      ? ((fund as any).utmaAcknowledgedAt as Date)
      : new Date((fund as any).utmaAcknowledgedAt)).toISOString(),
    irrevocabilityAcknowledgedByUserId: String((fund as any).utmaAcknowledgedByUserId),
    successorCustodian: successor,
    majorityDate: ymd(majorityDate),
  };
}

// Submit the assembled payload to DriveWealth.
//
// CURRENTLY SCAFFOLDED. When DriveWealth API access is available:
//   1. Replace the stub below with an authenticated POST to
//      `${DRIVEWEALTH_BASE_URL}/back-office/accounts` (or whatever DW's
//      v2 endpoint is at flip-time)
//   2. Persist the returned `drivewealthAccountId` onto funds row
//   3. Remove the [scaffolded] log line
//
// Today this returns a synthetic account id and logs that the request was
// assembled but not actually sent — so callers can be wired in advance and
// no real money is implied.
export async function submitToDriveWealth(
  payload: DriveWealthAccountPayload,
  context: { fundId: string; req?: Request },
): Promise<{ accountId: string; live: boolean }> {
  const apiKey = process.env.DRIVEWEALTH_API_KEY;
  const apiSecret = process.env.DRIVEWEALTH_API_SECRET;
  if (!apiKey || !apiSecret) {
    console.log(
      `[drivewealth:scaffolded] would create UTMA account for fund=${context.fundId} title="${payload.accountTitle}" majority=${payload.majorityDate}`,
    );
    return { accountId: `dw_scaffold_${context.fundId.slice(0, 8)}`, live: false };
  }
  // TODO(drivewealth-wiring): real API call goes here.
  //   const res = await fetch(`${process.env.DRIVEWEALTH_BASE_URL}/back-office/accounts`, {
  //     method: "POST",
  //     headers: { Authorization: `Basic ${btoa(`${apiKey}:${apiSecret}`)}`, "Content-Type": "application/json" },
  //     body: JSON.stringify(payload),
  //   });
  //   if (!res.ok) throw new Error(`DriveWealth account create failed: ${res.status}`);
  //   const { accountId } = await res.json();
  //   return { accountId, live: true };
  console.log(`[drivewealth:scaffolded] credentials present but client not yet implemented for fund=${context.fundId}`);
  return { accountId: `dw_pending_${context.fundId.slice(0, 8)}`, live: false };
}
