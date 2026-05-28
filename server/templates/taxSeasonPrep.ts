// Tax-season prep email. Fires in January and again mid-February
// with a reminder about UTMA tax docs from DriveWealth. Tone is
// helpful, not panicky. UTMA tax obligations are real but
// usually small (kiddie-tax threshold).

import type { EmailMessage } from "../emailDelivery";
import { renderKiddoEmail } from "./baseTemplate";

export type TaxSeasonPrepInput = {
  to: string;
  parentFirstName?: string | null;
  childFirstName: string;
  taxYear: number;
  dashboardUrl: string;
  taxDocsUrl: string;
  unsubscribeUrl?: string | null;
};

export function buildTaxSeasonPrepEmail(input: TaxSeasonPrepInput): EmailMessage {
  const { to, parentFirstName, childFirstName, taxYear, dashboardUrl, taxDocsUrl, unsubscribeUrl } = input;
  const greeting = parentFirstName?.trim() ? `Hi ${parentFirstName.trim()},` : "Hi there,";
  const intro = [
    greeting,
    ``,
    `Quick heads up for ${taxYear} taxes.`,
    ``,
    `Once investing is live, DriveWealth will issue 1099-DIV and 1099-B forms for ${childFirstName}'s UTMA account each year, and you'll find them on the Tax Documents page when they're ready (typically mid-February).`,
    ``,
    `Most kiddie-tax situations are simple: the first portion of unearned income is tax-free, the next portion is taxed at the kid's bracket, and only above a threshold does the parent's rate apply. Check with your CPA on the exact numbers for your year, but this isn't usually a big-dollar concern at typical UTMA fund sizes.`,
    ``,
    `Nothing for you to do today. We'll send a follow-up when the 1099s post.`,
  ].join("\n");
  const { html } = renderKiddoEmail({
    heading: `${taxYear} tax docs are coming`,
    intro,
    cta: { text: "Open Tax Documents", url: taxDocsUrl },
    postscript: `Dashboard: ${dashboardUrl}`,
    unsubscribeUrl: unsubscribeUrl ?? undefined,
  });
  const text = [
    greeting,
    ``,
    `Quick heads up for ${taxYear} taxes.`,
    ``,
    `Once investing is live, DriveWealth will issue 1099-DIV and 1099-B forms for ${childFirstName}'s UTMA account each year, and you'll find them on the Tax Documents page when they're ready (typically mid-February).`,
    ``,
    `Most kiddie-tax situations are simple. Check with your CPA on exact numbers; this isn't usually a big-dollar concern at typical UTMA fund sizes.`,
    ``,
    `Tax Documents: ${taxDocsUrl}`,
    ``,
    `The Kiddo team`,
  ].join("\n");
  return {
    to,
    subject: `${taxYear} tax docs are coming`,
    text,
    html,
    tags: ["tax-season-prep"],
    metadata: { kind: "tax_season_prep", taxYear },
    listUnsubscribeUrl: unsubscribeUrl ?? undefined,
  };
}
