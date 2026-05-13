const DEFAULT_SUPER_ADMIN_EMAILS = ["dovisherman@gmail.com"] as const;

export function normalizeAdminEmail(email: string | null | undefined) {
  return String(email || "").trim().toLowerCase();
}

export function getDefaultSuperAdminEmails() {
  return new Set(DEFAULT_SUPER_ADMIN_EMAILS.map(normalizeAdminEmail).filter(Boolean));
}

export function getConfiguredSuperAdminEmails(
  rawValue: string | null | undefined,
  fallbackValues: readonly string[] = DEFAULT_SUPER_ADMIN_EMAILS,
) {
  const parsed = String(rawValue || "")
    .split(",")
    .map(normalizeAdminEmail)
    .filter(Boolean);

  if (parsed.length > 0) {
    return new Set(parsed);
  }

  return new Set(fallbackValues.map(normalizeAdminEmail).filter(Boolean));
}

export function isEmailInAdminSet(
  email: string | null | undefined,
  emails: ReadonlySet<string>,
) {
  const normalized = normalizeAdminEmail(email);
  return Boolean(normalized && emails.has(normalized));
}

export function getEffectiveAdminFlags<T extends { email?: string | null; isAdmin?: boolean | null; isSuperAdmin?: boolean | null }>(
  user: T | null | undefined,
  superAdminEmails: ReadonlySet<string>,
) {
  const isSuperAdmin =
    Boolean(user?.isSuperAdmin) || isEmailInAdminSet(user?.email, superAdminEmails);
  const isAdmin = Boolean(user?.isAdmin) || isSuperAdmin;

  return {
    isAdmin,
    isSuperAdmin,
  };
}

export { DEFAULT_SUPER_ADMIN_EMAILS };
