// "Last used" sign-in method — the Lovable/Google pattern: remind a returning
// user which method they used last so they don't fumble ("did I use my passkey,
// the email link, or a password?"). Biggest beneficiary is the low-tech, infrequent
// gifter (grandma), who most needs "just press this one."
//
// GUARDRAILS (deliberate):
//   • LOCAL ONLY — never sent to the server. It's a device-side hint, not identity.
//   • METHOD ONLY — we store the method name, NEVER the email/credentials, so a
//     shared/family device can't leak WHO last signed in (only HOW).
//   • CLEARABLE — clearLastAuthMethod() wipes it (e.g. on explicit sign-out).

export type AuthMethod = "password" | "magic" | "passkey";

const KEY = "kiddo:last-auth-method";

export function setLastAuthMethod(method: AuthMethod): void {
  try {
    localStorage.setItem(KEY, method);
  } catch {
    /* private mode / storage blocked — the badge just won't show; no worse than before */
  }
}

export function getLastAuthMethod(): AuthMethod | null {
  try {
    const v = localStorage.getItem(KEY);
    return v === "password" || v === "magic" || v === "passkey" ? v : null;
  } catch {
    return null;
  }
}

export function clearLastAuthMethod(): void {
  try {
    localStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
}
