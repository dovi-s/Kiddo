// State-by-state UTMA / UGMA age of majority.
//
// NAMING (2026-06-04): South Carolina is the one state that never adopted
// UTMA — custodial accounts there are UGMA (Uniform Gifts to Minors Act).
// For a securities-only fund the mechanics are identical (irrevocable gift,
// custodian manages, transfers at majority — 18 in SC, captured below), so
// the product says "UTMA" generally and special-cases SC copy where the
// statute is named (see UtmaByState.tsx). When the custodian is wired, the
// account's statute label should come from the custodian record per state.
//
// UTMA (Uniform Transfers to Minors Act) age of majority is set by state law.
// Most states default to 18, several extend higher, and a few let the custodian
// pick a higher age (e.g. California up to 25). This map captures the most
// commonly observed default per state. Where a state allows a custodian to
// elect a higher age, we still default to the statutory minimum and let the
// parent override per-fund via funds.majority_age.
//
// Why this matters: at-18 transition copy, the kid_age_18 visibility unlock,
// the age18TransitionWorker, the KidView countdown, and every "she gets full
// control at 18" line all depend on this. Hardcoding 18 means a kid in PA
// (majority 21) gets the wrong handoff date — a real legal/operational error,
// not a copy nit.

export const UTMA_DEFAULT_MAJORITY_AGE = 18;

// 2-letter USPS code → default UTMA majority age. Source: state UTMA statutes
// as of 2026. Where a state has elected a higher default by statute (PA, MS),
// it's reflected here. Where custodians can elect higher (CA, DE, NV, TN), the
// statutory default is what's stored — parents who want a longer custodianship
// can override per fund.
const UTMA_MAJORITY_BY_STATE: Record<string, number> = {
  AL: 19,
  AK: 18,
  AZ: 18,
  AR: 21,
  CA: 18,
  CO: 21,
  CT: 21,
  DE: 18,
  DC: 18,
  FL: 21,
  GA: 21,
  HI: 21,
  ID: 21,
  IL: 21,
  IN: 21,
  IA: 21,
  KS: 21,
  KY: 18,
  LA: 18,
  ME: 18,
  MD: 21,
  MA: 21,
  MI: 18,
  MN: 21,
  MS: 21,
  MO: 21,
  MT: 21,
  NE: 19,
  NV: 18,
  NH: 21,
  NJ: 21,
  NM: 21,
  NY: 21,
  NC: 21,
  ND: 21,
  OH: 21,
  OK: 18,
  OR: 21,
  PA: 21,
  RI: 21,
  SC: 18,
  SD: 18,
  TN: 21,
  TX: 21,
  UT: 21,
  VT: 21,
  VA: 18,
  WA: 21,
  WV: 21,
  WI: 21,
  WY: 21,
};

// Get the UTMA age of majority for a state code. Falls back to the federal
// default (18) for unknown / missing codes. Always uppercases the input so
// "ca" and "CA" both resolve.
export function getMajorityAgeForState(state: string | null | undefined): number {
  if (!state) return UTMA_DEFAULT_MAJORITY_AGE;
  const code = String(state).trim().toUpperCase();
  return UTMA_MAJORITY_BY_STATE[code] ?? UTMA_DEFAULT_MAJORITY_AGE;
}

// Compute the date the kid hits majority. Uses the fund's locked-in
// `majorityAge` if present (so historical funds don't shift when the table
// changes), otherwise derives from state.
export function getMajorityDate(
  birthdate: string | Date | null | undefined,
  majorityAgeOrState: number | string | null | undefined,
): Date | null {
  if (!birthdate) return null;
  const bd = birthdate instanceof Date ? birthdate : new Date(birthdate);
  if (isNaN(bd.getTime())) return null;
  const age =
    typeof majorityAgeOrState === "number"
      ? majorityAgeOrState
      : getMajorityAgeForState(typeof majorityAgeOrState === "string" ? majorityAgeOrState : null);
  const out = new Date(bd);
  out.setFullYear(out.getFullYear() + age);
  return out;
}

// Each row matches the value attribute used by US state form selects. Keep the
// list canonical here so AddFundSheet, Settings, and any future state pickers
// share one source.
export const US_STATES: Array<{ code: string; name: string }> = [
  { code: "AL", name: "Alabama" },
  { code: "AK", name: "Alaska" },
  { code: "AZ", name: "Arizona" },
  { code: "AR", name: "Arkansas" },
  { code: "CA", name: "California" },
  { code: "CO", name: "Colorado" },
  { code: "CT", name: "Connecticut" },
  { code: "DE", name: "Delaware" },
  { code: "DC", name: "District of Columbia" },
  { code: "FL", name: "Florida" },
  { code: "GA", name: "Georgia" },
  { code: "HI", name: "Hawaii" },
  { code: "ID", name: "Idaho" },
  { code: "IL", name: "Illinois" },
  { code: "IN", name: "Indiana" },
  { code: "IA", name: "Iowa" },
  { code: "KS", name: "Kansas" },
  { code: "KY", name: "Kentucky" },
  { code: "LA", name: "Louisiana" },
  { code: "ME", name: "Maine" },
  { code: "MD", name: "Maryland" },
  { code: "MA", name: "Massachusetts" },
  { code: "MI", name: "Michigan" },
  { code: "MN", name: "Minnesota" },
  { code: "MS", name: "Mississippi" },
  { code: "MO", name: "Missouri" },
  { code: "MT", name: "Montana" },
  { code: "NE", name: "Nebraska" },
  { code: "NV", name: "Nevada" },
  { code: "NH", name: "New Hampshire" },
  { code: "NJ", name: "New Jersey" },
  { code: "NM", name: "New Mexico" },
  { code: "NY", name: "New York" },
  { code: "NC", name: "North Carolina" },
  { code: "ND", name: "North Dakota" },
  { code: "OH", name: "Ohio" },
  { code: "OK", name: "Oklahoma" },
  { code: "OR", name: "Oregon" },
  { code: "PA", name: "Pennsylvania" },
  { code: "RI", name: "Rhode Island" },
  { code: "SC", name: "South Carolina" },
  { code: "SD", name: "South Dakota" },
  { code: "TN", name: "Tennessee" },
  { code: "TX", name: "Texas" },
  { code: "UT", name: "Utah" },
  { code: "VT", name: "Vermont" },
  { code: "VA", name: "Virginia" },
  { code: "WA", name: "Washington" },
  { code: "WV", name: "West Virginia" },
  { code: "WI", name: "Wisconsin" },
  { code: "WY", name: "Wyoming" },
];
