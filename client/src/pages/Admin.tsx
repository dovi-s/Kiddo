import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { useAuth } from "@/hooks/use-auth";
import { getDefaultSuperAdminEmails, isEmailInAdminSet } from "@shared/adminAccess";
import { useLocation, useSearch } from "wouter";
import {
  Users, Wallet, Gift, CreditCard, TrendingUp, Shield, Calendar,
  Building2, ArrowUpRight, ArrowDownToLine, ChevronDown, ChevronUp, Eye, Server, Activity, AlertTriangle, Heart, BarChart3, RefreshCw, MoreHorizontal, Download, MessageSquare
} from "lucide-react";
import { Logo } from "@/components/ui/logo";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { Area, AreaChart, CartesianGrid, XAxis } from "recharts";

async function fetchAdminJson(url: string) {
  const res = await fetch(url, {
    credentials: "include",
    cache: "no-store",
    headers: {
      "Cache-Control": "no-cache",
      Pragma: "no-cache",
    },
  });
  const payload = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err: any = new Error((payload as any)?.error || `Request failed: ${res.status}`);
    err.status = res.status;
    err.payload = payload;
    throw err;
  }
  return payload;
}

function getSafeSearchParams(search: string | null | undefined) {
  try {
    return new URLSearchParams(search || "");
  } catch {
    return new URLSearchParams("");
  }
}

function asArray<T = any>(value: unknown): T[] {
  return Array.isArray(value) ? (value as T[]) : [];
}

function toRowsPayload<T = any>(payload: any): { rows: T[]; degraded?: boolean; queryErrors?: string[] } {
  if (Array.isArray(payload)) return { rows: payload };
  return {
    rows: Array.isArray(payload?.rows) ? payload.rows : [],
    degraded: Boolean(payload?.degraded),
    queryErrors: Array.isArray(payload?.queryErrors) ? payload.queryErrors : [],
  };
}

function getAdminErrorMessage(error: any, fallback: string) {
  const message = String(error?.message || fallback || "Unknown error");
  const code = String(error?.payload?.code || "").trim();
  const stripeErrors = Array.isArray(error?.payload?.stripeCleanup?.errors)
    ? error.payload.stripeCleanup.errors.filter(Boolean)
    : [];

  if (code && stripeErrors.length > 0) {
    return `${message} (${code}: ${stripeErrors.join(" | ")})`;
  }
  if (code) {
    return `${message} (${code})`;
  }
  return message;
}

function fmt(val: any): string {
  const n = parseFloat(String(val || "0"));
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 2 }).format(n);
}

function fmtNum(val: any): string {
  return Number(val || 0).toLocaleString();
}

function fmtDate(val: any): string {
  if (!val) return "-";
  return new Date(val).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function fmtDateTime(val: any): string {
  if (!val) return "-";
  return new Date(val).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}

function toNumSafe(val: any): number {
  if (val == null) return 0;
  if (typeof val === "number") return Number.isFinite(val) ? val : 0;
  if (typeof val === "string") {
    const n = Number(val);
    return Number.isFinite(n) ? n : 0;
  }
  if (typeof val === "object") {
    const candidate = (val as any)?.value ?? (val as any)?.amount ?? (val as any)?.toString?.();
    const n = Number(candidate);
    return Number.isFinite(n) ? n : 0;
  }
  return 0;
}

function csvEscape(value: unknown): string {
  const raw = value == null ? "" : String(value);
  return `"${raw.replace(/"/g, '""')}"`;
}

function formatLoopTouchpointLabel(touchpoint: unknown): string {
  const raw = String(touchpoint || "").trim().toLowerCase();
  const labels: Record<string, string> = {
    gift_success_cta: "Gift success CTA",
    gift_receipt_email: "Gift receipt email",
    memory_book_share_email: "Memory Book share email",
    birthday_reminder_email: "Birthday reminder email",
    age_18_email: "Age-18 email",
  };
  if (labels[raw]) return labels[raw];
  if (!raw) return "Unknown";
  return raw
    .split("_")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function formatLoopActionLabel(action: unknown): string {
  const raw = String(action || "").trim().toLowerCase();
  const labels: Record<string, string> = {
    visit: "Visit",
    cta_click: "CTA click",
    signup: "Signup",
  };
  if (labels[raw]) return labels[raw];
  if (!raw) return "Unknown";
  return raw
    .split("_")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function downloadCsv(filename: string, headers: string[], rows: (string | number | null | undefined)[][]) {
  const csv = [
    headers.map(csvEscape).join(","),
    ...rows.map((row) => row.map(csvEscape).join(",")),
  ].join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function StatCard({ label, value, sub, icon: Icon, color = "primary", onClick }: {
  label: string; value: string; sub?: string; icon: any; color?: string; onClick?: () => void;
}) {
  const colorMap: Record<string, string> = {
    primary: "bg-primary/10 text-primary",
    green: "bg-green-100 text-green-700",
    blue: "bg-blue-100 text-blue-700",
    amber: "bg-amber-100 text-amber-700",
    red: "bg-red-100 text-red-700",
    purple: "bg-purple-100 text-purple-700",
  };
  return (
    <button
      type="button"
      onClick={onClick}
      className={`bg-card rounded-xl border border-border/50 p-4 text-left w-full ${onClick ? "hover:bg-muted/30 transition-colors cursor-pointer" : "cursor-default"}`}
      data-testid={`stat-${label.toLowerCase().replace(/\s/g, "-")}`}
    >
      <div className="flex items-start justify-between mb-2">
        <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{label}</span>
        <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${colorMap[color] || colorMap.primary}`}>
          <Icon size={16} />
        </div>
      </div>
      <p className="text-2xl font-bold text-foreground">{value}</p>
      {sub && <p className="text-xs text-muted-foreground mt-1">{sub}</p>}
    </button>
  );
}

function PercentBar({ label, pct, sub, color = "primary" }: { label: string; pct: number; sub?: string; color?: "primary" | "green" | "blue" | "amber" | "red" | "purple" }) {
  const safe = Number.isFinite(pct) ? Math.max(0, Math.min(100, pct)) : 0;
  const barColor: Record<string, string> = {
    primary: "bg-primary",
    green: "bg-green-600",
    blue: "bg-blue-600",
    amber: "bg-amber-500",
    red: "bg-red-600",
    purple: "bg-purple-600",
  };
  return (
    <div className="bg-card rounded-xl border border-border/50 p-3">
      <div className="flex items-center justify-between text-xs mb-2">
        <span className="font-medium text-foreground">{label}</span>
        <span className="font-semibold">{safe.toFixed(2)}%</span>
      </div>
      <div className="h-2 bg-muted rounded-full overflow-hidden">
        <div className={`h-full ${barColor[color] || barColor.primary}`} style={{ width: `${safe}%` }} />
      </div>
      {sub ? <p className="text-[11px] text-muted-foreground mt-1">{sub}</p> : null}
    </div>
  );
}

function SortableTable({ columns, data, defaultSort }: {
  columns: { key: string; label: string; render?: (row: any) => any; align?: string }[];
  data: any[];
  defaultSort?: string;
}) {
  const [sortKey, setSortKey] = useState(defaultSort || columns[0]?.key || "");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  const handleSort = (key: string) => {
    if (sortKey === key) {
      setSortDir(sortDir === "asc" ? "desc" : "asc");
    } else {
      setSortKey(key);
      setSortDir("desc");
    }
  };

  const sorted = [...data].sort((a, b) => {
    const aVal = a[sortKey];
    const bVal = b[sortKey];
    if (aVal == null && bVal == null) return 0;
    if (aVal == null) return 1;
    if (bVal == null) return -1;
    // Money/numeric columns arrive from Postgres as STRINGS (pg numeric -> JS
    // string), so a raw localeCompare sorted them lexicographically ("9" > "100"
    // > "1000") — wrong for the gifters gross/net default sort, user total_value,
    // and fund balances. Compare as numbers when BOTH sides parse cleanly; else
    // fall back to text (names, dates, etc.).
    const aNum = typeof aVal === "number" ? aVal : (String(aVal).trim() !== "" ? Number(aVal) : NaN);
    const bNum = typeof bVal === "number" ? bVal : (String(bVal).trim() !== "" ? Number(bVal) : NaN);
    const cmp = (Number.isFinite(aNum) && Number.isFinite(bNum))
      ? aNum - bNum
      : String(aVal).localeCompare(String(bVal));
    return sortDir === "asc" ? cmp : -cmp;
  });

  return (
    <div className="overflow-x-auto">
      <table className="w-max min-w-full text-sm">
        <thead>
          <tr className="border-b border-border/50">
            {columns.map((col) => (
              <th
                key={col.key}
                className={`py-2 px-3 text-xs font-medium text-muted-foreground uppercase tracking-wide cursor-pointer hover:text-foreground select-none whitespace-nowrap ${col.align === "right" ? "text-right" : "text-left"}`}
                onClick={() => handleSort(col.key)}
              >
                <span className="inline-flex items-center gap-1">
                  {col.label}
                  {sortKey === col.key && (sortDir === "asc" ? <ChevronUp size={12} /> : <ChevronDown size={12} />)}
                </span>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {sorted.map((row, i) => (
            <tr key={i} className="border-b border-border/20 hover:bg-muted/30 transition-colors">
              {columns.map((col) => (
                <td key={col.key} className={`py-2 px-3 whitespace-nowrap ${col.align === "right" ? "text-right" : ""}`}>
                  {col.render ? col.render(row) : (
                    <span className="inline-block max-w-[260px] truncate align-bottom" title={String(row[col.key] ?? "-")}>
                      {row[col.key] ?? "-"}
                    </span>
                  )}
                </td>
              ))}
            </tr>
          ))}
          {sorted.length === 0 && (
            <tr>
              <td colSpan={columns.length} className="py-8 text-center text-muted-foreground">No data</td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

function StatusBadge({ status, map }: { status: string; map?: Record<string, string> }) {
  const defaultMap: Record<string, string> = {
    active: "bg-green-100 text-green-700",
    approved: "bg-green-100 text-green-700",
    completed: "bg-green-100 text-green-700",
    settled: "bg-green-100 text-green-700",
    invested: "bg-blue-100 text-blue-700",
    processing: "bg-blue-100 text-blue-700",
    pending: "bg-amber-100 text-amber-700",
    draft: "bg-gray-100 text-gray-600",
    none: "bg-gray-100 text-gray-600",
    free: "bg-gray-100 text-gray-600",
    family: "bg-purple-100 text-purple-700",
    failed: "bg-red-100 text-red-700",
    canceled: "bg-red-100 text-red-700",
    refunded: "bg-red-100 text-red-700",
  };
  const m = map || defaultMap;
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${m[status] || "bg-gray-100 text-gray-600"}`}>
      {status}
    </span>
  );
}

function RowActionsMenu({ children, label = "Open actions" }: { children: ReactNode; label?: string }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className="h-7 w-7 inline-flex items-center justify-center rounded border border-border hover:bg-muted"
          aria-label={label}
          title={label}
        >
          <MoreHorizontal size={14} />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-44">
        {children}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function AdminDetailModal({ title, endpoint, onClose }: { title: string; endpoint: string; onClose: () => void }) {
  const [showRaw, setShowRaw] = useState(false);
  const { user } = useAuth();
  const isSuperAdmin = Boolean((user as any)?.isSuperAdmin);
  const queryClient = useQueryClient();
  const { data, isLoading, isError, error, refetch } = useQuery<any>({
    queryKey: [endpoint],
    queryFn: async () => fetchAdminJson(endpoint),
    retry: 1,
  });

  const summary = (data && typeof data === "object" ? (data.summary || null) : null) as Record<string, unknown> | null;
  const summaryEntries = summary ? Object.entries(summary) : [];
  const isUserDetails = endpoint.includes("/api/admin/users/");
  const isFundDetails = endpoint.includes("/api/admin/funds/");
  const isGiftDetails = endpoint.includes("/api/admin/gifts/");
  const isTransactionDetails = endpoint.includes("/api/admin/transactions/");
  const isGifterDetails = endpoint.includes("/api/admin/gifters/details");
  const accountSubscription = data?.billing?.accountSubscription || null;
  const starterMemberships = asArray<any>(data?.billing?.starterMemberships);
  const starterMembershipByFundId = new Map(
    starterMemberships.map((row: any) => [String(row?.fund_id || row?.fundId || ""), row]),
  );
  const fundStarterMembership = data?.billing?.starterMembership || null;
  const ownerSubscription = data?.billing?.ownerSubscription || null;

  const runAction = async (label: string, action: () => Promise<void>, confirmText?: string) => {
    if (confirmText && !window.confirm(confirmText)) return;
    try {
      await action();
      await Promise.all([
        refetch(),
        queryClient.invalidateQueries({ queryKey: ["/api/admin/overview"] }),
        queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] }),
        queryClient.invalidateQueries({ queryKey: ["/api/admin/funds"] }),
        queryClient.invalidateQueries({ queryKey: ["/api/admin/gifts"] }),
        queryClient.invalidateQueries({ queryKey: ["/api/admin/transactions"] }),
        queryClient.invalidateQueries({ queryKey: ["/api/admin/gifters?limit=10"] }),
        queryClient.invalidateQueries({ queryKey: ["/api/admin/gifters?limit=500"] }),
      ]);
      window.alert(`${label} complete.`);
    } catch (e: any) {
      window.alert(`${label} failed: ${getAdminErrorMessage(e, "Unknown error")}`);
    }
  };

  const patchJson = async (url: string, payload: Record<string, unknown>) => {
    const res = await fetch(url, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify(payload),
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error((body as any)?.error || "Update failed");
  };

  const postJson = async (url: string) => {
    const res = await fetch(url, {
      method: "POST",
      credentials: "include",
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error((body as any)?.error || "Action failed");
  };

  const renderTable = (
    heading: string,
    rows: any[],
    columns: { key: string; label: string; render?: (row: any) => any }[],
  ) => {
    if (!Array.isArray(rows) || rows.length === 0) return null;
    return (
      <div className="bg-card rounded-xl border border-border/50 overflow-hidden">
        <div className="px-3 py-2 border-b border-border/50 text-sm font-semibold">{heading}</div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-border/50">
                {columns.map((c) => (
                  <th key={c.key} className="text-left px-3 py-2 uppercase tracking-wide text-muted-foreground font-medium">{c.label}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row, idx) => (
                <tr key={idx} className="border-b border-border/20">
                  {columns.map((c) => (
                    <td key={c.key} className="px-3 py-2">{c.render ? c.render(row) : String(row?.[c.key] ?? "-")}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  };

  return (
    <div className="fixed inset-0 z-[100] bg-black/45 backdrop-blur-[1px] flex items-center justify-center p-4">
      <div className="w-full max-w-5xl max-h-[90vh] bg-card border border-border rounded-xl overflow-hidden">
        <div className="px-4 py-3 border-b border-border/50 flex items-center justify-between">
          <h3 className="font-heading text-base font-semibold">{title}</h3>
          <div className="flex items-center gap-3">
            <button className="text-sm text-muted-foreground hover:text-foreground" onClick={() => setShowRaw((v) => !v)}>
              {showRaw ? "Hide raw JSON" : "Show raw JSON"}
            </button>
            <button className="text-sm text-muted-foreground hover:text-foreground" onClick={onClose}>Close</button>
          </div>
        </div>
        <div className="p-4 overflow-auto max-h-[calc(90vh-56px)] space-y-4">
          {isLoading && <div className="text-sm text-muted-foreground">Loading details...</div>}
          {isError && (
            <div className="space-y-2">
              <div className="text-sm text-red-700">Could not load details. {(error as any)?.message || ""}</div>
              <button className="text-sm text-primary hover:underline" onClick={() => refetch()}>Retry</button>
            </div>
          )}
          {!isLoading && !isError && (
            <>
              {summaryEntries.length > 0 && (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                  {summaryEntries.slice(0, 12).map(([k, v]) => (
                    <div key={k} className="bg-muted/30 border border-border/50 rounded-lg p-2">
                      <p className="text-[11px] text-muted-foreground uppercase tracking-wide">{k.replace(/_/g, " ")}</p>
                      <p className="text-sm font-medium">{typeof v === "number" ? (String(k).includes("amount") || String(k).includes("value") || String(k).includes("total") ? fmt(v) : fmtNum(v)) : String(v ?? "-")}</p>
                    </div>
                  ))}
                </div>
              )}

              {isUserDetails && (
                <>
                  <div className="bg-card rounded-xl border border-border/50 p-3">
                    <div className="flex flex-wrap gap-2">
                      <button
                        className="text-[11px] px-2 py-1 rounded border border-border hover:bg-muted disabled:opacity-50"
                        onClick={() => runAction(
                          data?.user?.is_admin ? "Remove admin role" : "Grant admin role",
                          () => patchJson(`/api/admin/users/${encodeURIComponent(String(data?.user?.id || ""))}`, { isAdmin: !Boolean(data?.user?.is_admin) }),
                        )}
                        disabled={!isSuperAdmin}
                        title={!isSuperAdmin ? "Super admin required" : undefined}
                      >
                        {data?.user?.is_admin ? "Remove admin" : "Make admin"}
                      </button>
                      <button
                        className="text-[11px] px-2 py-1 rounded border border-border hover:bg-muted"
                        onClick={() => runAction("Approve KYC", () => patchJson(`/api/admin/users/${encodeURIComponent(String(data?.user?.id || ""))}`, { kycStatus: "approved" }))}
                      >
                        KYC approve
                      </button>
                      <button
                        className="text-[11px] px-2 py-1 rounded border border-border hover:bg-muted"
                        onClick={() => runAction("Set free plan", () => patchJson(`/api/admin/users/${encodeURIComponent(String(data?.user?.id || ""))}/subscription`, { plan: "free", status: "active", billingInterval: "none" }))}
                      >
                        Set free
                      </button>
                      <button
                        className="text-[11px] px-2 py-1 rounded border border-border hover:bg-muted"
                        onClick={() => runAction("Set family plan", () => patchJson(`/api/admin/users/${encodeURIComponent(String(data?.user?.id || ""))}/subscription`, { plan: "family", status: "active" }))}
                      >
                        Set family
                      </button>
                      {data?.user?.sub_plan === "family" && data?.user?.stripe_subscription_id && (
                        <button
                          className="text-[11px] px-2 py-1 rounded border border-amber-300 text-amber-700 hover:bg-amber-50"
                          onClick={() => runAction("Resync from Stripe", () => postJson(`/api/admin/users/${encodeURIComponent(String(data?.user?.id || ""))}/subscription/sync-stripe`))}
                        >
                          Resync Stripe
                        </button>
                      )}
                    </div>
                  </div>
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="bg-card rounded-xl border border-border/50 p-3">
                      <div className="text-sm font-semibold">Account billing</div>
                      {accountSubscription ? (
                        <div className="mt-3 grid grid-cols-2 gap-3 text-xs">
                          <div><span className="text-muted-foreground">Plan:</span> <StatusBadge status={String(accountSubscription.plan || "free")} /></div>
                          <div><span className="text-muted-foreground">Status:</span> <StatusBadge status={String(accountSubscription.status || "active")} /></div>
                          <div><span className="text-muted-foreground">Interval:</span> {String(accountSubscription.billingInterval || "none")}</div>
                          <div><span className="text-muted-foreground">Period End:</span> {fmtDate(accountSubscription.currentPeriodEnd)}</div>
                          <div><span className="text-muted-foreground">Stripe Customer:</span> <span className="font-mono">{String(accountSubscription.stripeCustomerId || "-")}</span></div>
                          <div><span className="text-muted-foreground">Stripe Sub:</span> <span className="font-mono">{String(accountSubscription.stripeSubscriptionId || "-")}</span></div>
                        </div>
                      ) : (
                        <div className="mt-2 text-xs text-muted-foreground">No account-level billing record.</div>
                      )}
                    </div>
                    <div className="bg-card rounded-xl border border-border/50 p-3">
                      <div className="text-sm font-semibold">Fund-level Kiddo+ access</div>
                      {starterMemberships.length > 0 ? (
                        <div className="mt-3 space-y-2">
                          {starterMemberships.map((row: any) => (
                            <div key={String(row?.id || row?.fund_id || row?.fundId)} className="rounded-lg border border-border/50 p-2 text-xs">
                              <div className="flex items-center justify-between gap-3">
                                <span className="font-medium">{String(row?.fund_name || row?.fundName || "Unnamed fund")}</span>
                                <StatusBadge status={String(row?.status || "active")} />
                              </div>
                              <div className="mt-1 text-muted-foreground">
                                {String(row?.billing_interval || row?.billingInterval || "month")} • sub {String(row?.stripe_subscription_id || row?.stripeSubscriptionId || "-")}
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="mt-2 text-xs text-muted-foreground">No fund-level Kiddo+ memberships yet.</div>
                      )}
                    </div>
                  </div>
                  {renderTable("Funds", data?.funds || [], [
                    { key: "name", label: "Fund" },
                    { key: "account_type", label: "Type" },
                    { key: "status", label: "Status", render: (r: any) => <StatusBadge status={String(r.status || "")} /> },
                    {
                      key: "starter_status",
                      label: "Kiddo+",
                      render: (r: any) => {
                        const membership = starterMembershipByFundId.get(String(r?.id || ""));
                        return membership ? <StatusBadge status={String(membership?.status || "active")} /> : <span className="text-muted-foreground">free</span>;
                      },
                    },
                    {
                      key: "starter_actions",
                      label: "Coverage",
                      render: (r: any) => {
                        const membership = starterMembershipByFundId.get(String(r?.id || ""));
                        const membershipStatus = String(membership?.status || "").toLowerCase();
                        return (
                          <div className="flex flex-wrap gap-1">
                            {membershipStatus === "active" ? (
                              <button
                                className="text-[11px] px-2 py-1 rounded border border-border hover:bg-muted"
                                onClick={() => runAction(
                                  "Cancel Kiddo+",
                                  () => postJson(`/api/admin/users/${encodeURIComponent(String(data?.user?.id || ""))}/fund-memberships/${encodeURIComponent(String(r?.id || ""))}/cancel`),
                                )}
                              >
                                Cancel
                              </button>
                            ) : (
                              <button
                                className="text-[11px] px-2 py-1 rounded border border-border hover:bg-muted"
                                onClick={() => runAction(
                                  "Activate Kiddo+",
                                  () => postJson(`/api/admin/users/${encodeURIComponent(String(data?.user?.id || ""))}/fund-memberships/${encodeURIComponent(String(r?.id || ""))}/activate`),
                                )}
                              >
                                Activate
                              </button>
                            )}
                            {membership?.stripe_subscription_id || membership?.stripeSubscriptionId ? (
                              <button
                                className="text-[11px] px-2 py-1 rounded border border-amber-300 text-amber-700 hover:bg-amber-50"
                                onClick={() => runAction(
                                  "Resync Kiddo+ Stripe",
                                  () => postJson(`/api/admin/users/${encodeURIComponent(String(data?.user?.id || ""))}/fund-memberships/${encodeURIComponent(String(r?.id || ""))}/sync-stripe`),
                                )}
                              >
                                Resync
                              </button>
                            ) : null}
                          </div>
                        );
                      },
                    },
                    { key: "balance", label: "Invested", render: (r: any) => fmt(r.balance) },
                    { key: "pending_balance", label: "Pending", render: (r: any) => fmt(r.pending_balance) },
                  ])}
                  {renderTable("Recent Gifts", data?.gifts || [], [
                    { key: "created_at", label: "Date", render: (r: any) => fmtDateTime(r.created_at) },
                    { key: "fund_name", label: "Fund" },
                    { key: "sender_name", label: "Gifter" },
                    { key: "status", label: "Status", render: (r: any) => <StatusBadge status={String(r.status || "")} /> },
                    { key: "net_amount", label: "Net", render: (r: any) => fmt(r.net_amount) },
                  ])}
                </>
              )}

              {isFundDetails && (
                <>
                  <div className="bg-card rounded-xl border border-border/50 p-3">
                    <div className="flex flex-wrap gap-2">
                      <button
                        className="text-[11px] px-2 py-1 rounded border border-border hover:bg-muted"
                        onClick={() => runAction("Toggle discoverability", () => patchJson(`/api/admin/funds/${encodeURIComponent(String(data?.fund?.id || ""))}`, { isDiscoverable: !Boolean(data?.fund?.is_discoverable) }))}
                      >
                        {data?.fund?.is_discoverable ? "Make private" : "Make public"}
                      </button>
                      <button
                        className="text-[11px] px-2 py-1 rounded border border-border hover:bg-muted"
                        onClick={() => runAction("Set active", () => patchJson(`/api/admin/funds/${encodeURIComponent(String(data?.fund?.id || ""))}`, { status: "active" }))}
                      >
                        Set active
                      </button>
                      <button
                        className="text-[11px] px-2 py-1 rounded border border-border hover:bg-muted"
                        onClick={() => runAction("Pause fund", () => patchJson(`/api/admin/funds/${encodeURIComponent(String(data?.fund?.id || ""))}`, { status: "paused" }))}
                      >
                        Pause
                      </button>
                      {String(fundStarterMembership?.status || "").toLowerCase() === "active" ? (
                        <button
                          className="text-[11px] px-2 py-1 rounded border border-border hover:bg-muted"
                          onClick={() => runAction("Cancel Kiddo+", () => postJson(`/api/admin/users/${encodeURIComponent(String(data?.fund?.user_id || data?.fund?.userId || ""))}/fund-memberships/${encodeURIComponent(String(data?.fund?.id || ""))}/cancel`))}
                        >
                          Cancel Kiddo+
                        </button>
                      ) : (
                        <button
                          className="text-[11px] px-2 py-1 rounded border border-border hover:bg-muted"
                          onClick={() => runAction("Activate Kiddo+", () => postJson(`/api/admin/users/${encodeURIComponent(String(data?.fund?.user_id || data?.fund?.userId || ""))}/fund-memberships/${encodeURIComponent(String(data?.fund?.id || ""))}/activate`))}
                        >
                          Activate Kiddo+
                        </button>
                      )}
                      {(fundStarterMembership?.stripeSubscriptionId || fundStarterMembership?.stripe_subscription_id) ? (
                        <button
                          className="text-[11px] px-2 py-1 rounded border border-amber-300 text-amber-700 hover:bg-amber-50"
                          onClick={() => runAction("Resync Kiddo+ Stripe", () => postJson(`/api/admin/users/${encodeURIComponent(String(data?.fund?.user_id || data?.fund?.userId || ""))}/fund-memberships/${encodeURIComponent(String(data?.fund?.id || ""))}/sync-stripe`))}
                        >
                          Resync Kiddo+ Stripe
                        </button>
                      ) : null}
                    </div>
                  </div>
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="bg-card rounded-xl border border-border/50 p-3">
                      <div className="text-sm font-semibold">Fund-level billing</div>
                      {fundStarterMembership ? (
                        <div className="mt-3 grid grid-cols-2 gap-3 text-xs">
                          <div><span className="text-muted-foreground">Plan:</span> <StatusBadge status={String(fundStarterMembership.plan || "starter")} /></div>
                          <div><span className="text-muted-foreground">Status:</span> <StatusBadge status={String(fundStarterMembership.status || "active")} /></div>
                          <div><span className="text-muted-foreground">Interval:</span> {String(fundStarterMembership.billingInterval || "month")}</div>
                          <div><span className="text-muted-foreground">Period End:</span> {fmtDate(fundStarterMembership.currentPeriodEnd)}</div>
                          <div><span className="text-muted-foreground">Stripe Customer:</span> <span className="font-mono">{String(fundStarterMembership.stripeCustomerId || "-")}</span></div>
                          <div><span className="text-muted-foreground">Stripe Sub:</span> <span className="font-mono">{String(fundStarterMembership.stripeSubscriptionId || "-")}</span></div>
                        </div>
                      ) : (
                        <div className="mt-2 text-xs text-muted-foreground">This fund does not currently have a Kiddo+ membership record.</div>
                      )}
                    </div>
                    <div className="bg-card rounded-xl border border-border/50 p-3">
                      <div className="text-sm font-semibold">Owner account billing</div>
                      {ownerSubscription ? (
                        <div className="mt-3 grid grid-cols-2 gap-3 text-xs">
                          <div><span className="text-muted-foreground">Plan:</span> <StatusBadge status={String(ownerSubscription.plan || "free")} /></div>
                          <div><span className="text-muted-foreground">Status:</span> <StatusBadge status={String(ownerSubscription.status || "active")} /></div>
                          <div><span className="text-muted-foreground">Interval:</span> {String(ownerSubscription.billingInterval || "none")}</div>
                          <div><span className="text-muted-foreground">Period End:</span> {fmtDate(ownerSubscription.currentPeriodEnd)}</div>
                          <div><span className="text-muted-foreground">Stripe Customer:</span> <span className="font-mono">{String(ownerSubscription.stripeCustomerId || "-")}</span></div>
                          <div><span className="text-muted-foreground">Stripe Sub:</span> <span className="font-mono">{String(ownerSubscription.stripeSubscriptionId || "-")}</span></div>
                        </div>
                      ) : (
                        <div className="mt-2 text-xs text-muted-foreground">No account-level billing record for this owner.</div>
                      )}
                    </div>
                  </div>
                  {renderTable("Recent Gifts", data?.gifts || [], [
                    { key: "created_at", label: "Date", render: (r: any) => fmtDateTime(r.created_at) },
                    { key: "sender_name", label: "Gifter" },
                    { key: "status", label: "Status", render: (r: any) => <StatusBadge status={String(r.status || "")} /> },
                    { key: "execution_model", label: "Model" },
                    { key: "net_amount", label: "Net", render: (r: any) => fmt(r.net_amount) },
                  ])}
                  {renderTable("Holdings", data?.holdings || [], [
                    { key: "ticker", label: "Ticker" },
                    { key: "shares", label: "Shares" },
                    { key: "cost_basis", label: "Cost", render: (r: any) => fmt(r.cost_basis) },
                    { key: "current_value", label: "Value", render: (r: any) => fmt(r.current_value) },
                    { key: "gain", label: "Gain", render: (r: any) => fmt(r.gain) },
                  ])}
                  {renderTable("Events", data?.events || [], [
                    { key: "created_at", label: "Created", render: (r: any) => fmtDateTime(r.created_at) },
                    { key: "name", label: "Name" },
                    { key: "status", label: "Status", render: (r: any) => <StatusBadge status={String(r.status || "")} /> },
                    { key: "gift_count", label: "Gifts" },
                    { key: "gift_volume", label: "Volume", render: (r: any) => fmt(r.gift_volume) },
                  ])}
                </>
              )}

              {isGiftDetails && (
                <div className="bg-card rounded-xl border border-border/50 p-3">
                  <div className="mb-3 flex flex-wrap gap-2">
                    <button
                      className="text-[11px] px-2 py-1 rounded border border-border hover:bg-muted"
                      onClick={() => runAction("Set invested", () => patchJson(`/api/admin/gifts/${encodeURIComponent(String(data?.id || ""))}`, { status: "invested" }))}
                    >
                      Set invested
                    </button>
                    <button
                      className="text-[11px] px-2 py-1 rounded border border-border hover:bg-muted"
                      onClick={() => runAction("Set settled", () => patchJson(`/api/admin/gifts/${encodeURIComponent(String(data?.id || ""))}`, { status: "settled" }))}
                    >
                      Set settled
                    </button>
                    <button
                      className="text-[11px] px-2 py-1 rounded border border-red-300 text-red-700 hover:bg-red-50 disabled:opacity-50"
                      onClick={() => runAction("Mark failed", () => patchJson(`/api/admin/gifts/${encodeURIComponent(String(data?.id || ""))}`, { status: "failed" }), "Mark this gift as failed?")}
                      disabled={!isSuperAdmin}
                      title={!isSuperAdmin ? "Super admin required" : undefined}
                    >
                      Mark failed
                    </button>
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
                    <div><span className="text-muted-foreground">Gift ID:</span> <span className="font-mono">{String(data?.id || "-")}</span></div>
                    <div><span className="text-muted-foreground">Status:</span> <StatusBadge status={String(data?.status || "")} /></div>
                    <div><span className="text-muted-foreground">Amount:</span> {fmt(data?.amount || 0)}</div>
                    <div><span className="text-muted-foreground">Net:</span> {fmt(data?.net_amount || 0)}</div>
                    <div><span className="text-muted-foreground">Fund:</span> {String(data?.fund_name || "-")}</div>
                    <div><span className="text-muted-foreground">Owner:</span> {String(data?.owner_email || "-")}</div>
                    <div><span className="text-muted-foreground">Event:</span> {String(data?.event_name || "-")}</div>
                    <div><span className="text-muted-foreground">Ticker:</span> {String(data?.selected_ticker || "-")}</div>
                    <div><span className="text-muted-foreground">Transaction:</span> {String(data?.transaction_id || "-")}</div>
                    <div><span className="text-muted-foreground">Memory:</span> {data?.memory_id ? "Yes" : "No"}</div>
                    <div><span className="text-muted-foreground">Thank-you:</span> {data?.thankyou_id ? String(data?.thankyou_status || "yes") : "No"}</div>
                  </div>
                </div>
              )}

              {isTransactionDetails && (
                <div className="bg-card rounded-xl border border-border/50 p-3">
                  <div className="mb-3 flex flex-wrap gap-2">
                    <button
                      className="text-[11px] px-2 py-1 rounded border border-border hover:bg-muted"
                      onClick={() => runAction("Set completed", () => patchJson(`/api/admin/transactions/${encodeURIComponent(String(data?.id || ""))}`, { status: "completed", failureReason: null }))}
                    >
                      Set completed
                    </button>
                    <button
                      className="text-[11px] px-2 py-1 rounded border border-red-300 text-red-700 hover:bg-red-50 disabled:opacity-50"
                      onClick={() => runAction("Set failed", () => patchJson(`/api/admin/transactions/${encodeURIComponent(String(data?.id || ""))}`, { status: "failed", failureReason: "Marked failed by admin" }), "Mark this transaction failed?")}
                      disabled={!isSuperAdmin}
                      title={!isSuperAdmin ? "Super admin required" : undefined}
                    >
                      Set failed
                    </button>
                    <button
                      className="text-[11px] px-2 py-1 rounded border border-border hover:bg-muted disabled:opacity-50"
                      onClick={() => runAction("Set refunded", () => patchJson(`/api/admin/transactions/${encodeURIComponent(String(data?.id || ""))}`, { status: "refunded" }), "Mark this transaction refunded?")}
                      disabled={!isSuperAdmin}
                      title={!isSuperAdmin ? "Super admin required" : undefined}
                    >
                      Set refunded
                    </button>
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
                    <div><span className="text-muted-foreground">Tx ID:</span> <span className="font-mono">{String(data?.id || "-")}</span></div>
                    <div><span className="text-muted-foreground">Type:</span> {String(data?.type || "-")}</div>
                    <div><span className="text-muted-foreground">Status:</span> <StatusBadge status={String(data?.status || "")} /></div>
                    <div><span className="text-muted-foreground">Amount:</span> {fmt(data?.amount || 0)}</div>
                    <div><span className="text-muted-foreground">User:</span> {String(data?.user_email || "-")}</div>
                    <div><span className="text-muted-foreground">Fund:</span> {String(data?.fund_name || "-")}</div>
                    <div><span className="text-muted-foreground">Event:</span> {String(data?.event_name || "-")}</div>
                    <div><span className="text-muted-foreground">Gift:</span> {String(data?.gift_id || "-")}</div>
                    <div><span className="text-muted-foreground">Gift Status:</span> {String(data?.gift_status || "-")}</div>
                    <div><span className="text-muted-foreground">PI:</span> <span className="font-mono">{String(data?.stripe_payment_intent_id || "-")}</span></div>
                  </div>
                </div>
              )}

              {isGifterDetails && (
                <>
                  <div className="bg-card rounded-xl border border-border/50 p-3">
                    <div className="flex flex-wrap gap-2">
                      <button
                        className="text-[11px] px-2 py-1 rounded border border-border hover:bg-muted"
                        onClick={() => {
                          const rows = (data?.funds || []).map((r: any) => [
                            r.fund_id,
                            r.fund_name,
                            r.owner_email,
                            Number(r.gifts_to_fund || 0),
                            Number(r.net_to_fund || 0),
                          ]);
                          downloadCsv(
                            `admin-gifter-funds-${new Date().toISOString().slice(0, 10)}.csv`,
                            ["fund_id", "fund_name", "owner_email", "gifts_to_fund", "net_to_fund"],
                            rows,
                          );
                        }}
                      >
                        Export funds CSV
                      </button>
                      <button
                        className="text-[11px] px-2 py-1 rounded border border-border hover:bg-muted"
                        onClick={() => {
                          const rows = (data?.gifts || []).map((r: any) => [
                            r.id,
                            r.created_at,
                            r.fund_name,
                            r.event_name,
                            r.status,
                            r.execution_model,
                            r.selected_ticker,
                            Number(r.amount || 0),
                            Number(r.net_amount || 0),
                            Number(r.processing_fee || 0),
                            Number(r.kora_fee || 0),
                            r.message || "",
                          ]);
                          downloadCsv(
                            `admin-gifter-gifts-${new Date().toISOString().slice(0, 10)}.csv`,
                            ["gift_id", "created_at", "fund_name", "event_name", "status", "execution_model", "selected_ticker", "gross_amount", "net_amount", "processing_fee", "kora_fee", "message"],
                            rows,
                          );
                        }}
                      >
                        Export gift history CSV
                      </button>
                      <button
                        className="text-[11px] px-2 py-1 rounded border border-border hover:bg-muted"
                        onClick={() => {
                          const rows = (data?.timeline || []).map((r: any) => [
                            r.day,
                            Number(r.gift_count || 0),
                            Number(r.gross_amount || 0),
                            Number(r.net_amount || 0),
                          ]);
                          downloadCsv(
                            `admin-gifter-timeline-${new Date().toISOString().slice(0, 10)}.csv`,
                            ["day", "gift_count", "gross_amount", "net_amount"],
                            rows,
                          );
                        }}
                      >
                        Export timeline CSV
                      </button>
                    </div>
                  </div>
                  {renderTable("Gift Status Mix", data?.statusBreakdown || [], [
                    { key: "status", label: "Status", render: (r: any) => <StatusBadge status={String(r.status || "")} /> },
                    { key: "gift_count", label: "Gifts", render: (r: any) => fmtNum(r.gift_count) },
                    { key: "gross_amount", label: "Gross", render: (r: any) => fmt(r.gross_amount) },
                    { key: "net_amount", label: "Net", render: (r: any) => fmt(r.net_amount) },
                  ])}
                  {renderTable("Execution Mix", data?.executionBreakdown || [], [
                    { key: "execution_model", label: "Model" },
                    { key: "gift_count", label: "Gifts", render: (r: any) => fmtNum(r.gift_count) },
                    { key: "gross_amount", label: "Gross", render: (r: any) => fmt(r.gross_amount) },
                    { key: "net_amount", label: "Net", render: (r: any) => fmt(r.net_amount) },
                  ])}
                  {renderTable("Timeline (Daily)", data?.timeline || [], [
                    { key: "day", label: "Day" },
                    { key: "gift_count", label: "Gifts", render: (r: any) => fmtNum(r.gift_count) },
                    { key: "gross_amount", label: "Gross", render: (r: any) => fmt(r.gross_amount) },
                    { key: "net_amount", label: "Net", render: (r: any) => fmt(r.net_amount) },
                  ])}
                  {renderTable("Funds Gifted", data?.funds || [], [
                    { key: "fund_name", label: "Fund" },
                    { key: "owner_email", label: "Owner" },
                    { key: "gifts_to_fund", label: "Gifts", render: (r: any) => fmtNum(r.gifts_to_fund) },
                    { key: "net_to_fund", label: "Net", render: (r: any) => fmt(r.net_to_fund) },
                  ])}
                  {renderTable("Gift History", data?.gifts || [], [
                    { key: "created_at", label: "Date", render: (r: any) => fmtDateTime(r.created_at) },
                    { key: "fund_name", label: "Fund" },
                    { key: "status", label: "Status", render: (r: any) => <StatusBadge status={String(r.status || "")} /> },
                    { key: "execution_model", label: "Model" },
                    { key: "amount", label: "Amount", render: (r: any) => fmt(r.amount) },
                    { key: "net_amount", label: "Net", render: (r: any) => fmt(r.net_amount) },
                  ])}
                </>
              )}

              {!showRaw &&
                summaryEntries.length === 0 &&
                !isUserDetails &&
                !isFundDetails &&
                !isGiftDetails &&
                !isTransactionDetails &&
                !isGifterDetails && (
                  <div className="text-sm text-muted-foreground">No linked detail records found for this item.</div>
                )}

              {showRaw && (
                <div className="bg-muted/20 border border-border/50 rounded-lg p-3">
                  <pre className="text-xs overflow-auto whitespace-pre-wrap">{JSON.stringify(data, null, 2)}</pre>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function LoopTouchpointModal({
  touchpoint,
  days,
  onClose,
}: {
  touchpoint: string;
  days: number;
  onClose: () => void;
}) {
  const endpoint = `/api/admin/growth/loop-details?touchpoint=${encodeURIComponent(touchpoint)}&days=${days}`;
  const { data, isLoading, isError, error } = useQuery<any>({
    queryKey: [endpoint],
    queryFn: async () => fetchAdminJson(endpoint),
    retry: 1,
  });

  const summary = data?.summary || {};
  const actionBreakdown = Array.isArray(data?.actionBreakdown) ? data.actionBreakdown : [];
  const channelBreakdown = Array.isArray(data?.channelBreakdown) ? data.channelBreakdown : [];
  const recentEvents = Array.isArray(data?.recentEvents) ? data.recentEvents : [];

  const handleExport = () => {
    const dateStr = new Date().toISOString().slice(0, 10);
    const filename = `loop-${touchpoint}-${days}d-${dateStr}.csv`;
    const headers = ["section", "key", "value", "extra1", "extra2", "extra3"];
    const rows: (string | number | null | undefined)[][] = [
      ["summary", "visits", summary.visits ?? 0],
      ["summary", "cta_clicks", summary.ctaClicks ?? 0],
      ["summary", "signups", summary.signups ?? 0],
      ["summary", "visit_to_signup_pct", Number(summary.visitToSignupPct ?? 0).toFixed(2)],
      ["summary", "click_to_signup_pct", Number(summary.clickToSignupPct ?? 0).toFixed(2)],
      ...actionBreakdown.map((r: any) => ["action_breakdown", r.action, r.total]),
      ...channelBreakdown.map((r: any) => ["channel_breakdown", r.channel, r.total]),
      ...recentEvents.map((r: any) => ["recent_event", r.createdAt, r.action, r.channel, r.refCode ?? "", (r.fundId || "") + (r.userId ? `|user:${r.userId}` : "")]),
    ];
    downloadCsv(filename, headers, rows);
  };

  return (
    <div className="fixed inset-0 z-[100] bg-black/45 backdrop-blur-[1px] flex items-center justify-center p-4">
      <div className="w-full max-w-5xl max-h-[90vh] bg-card border border-border rounded-xl overflow-hidden">
        <div className="px-4 py-3 border-b border-border/50 flex items-center justify-between">
          <div>
            <h3 className="font-heading text-base font-semibold">{formatLoopTouchpointLabel(touchpoint)}</h3>
            <p className="text-xs text-muted-foreground mt-1">Warm-loop details for the last {days} days.</p>
          </div>
          <div className="flex items-center gap-3">
            {data && (
              <button
                onClick={handleExport}
                className="flex items-center gap-1.5 text-xs font-medium text-primary hover:text-primary/80 border border-primary/30 hover:border-primary/50 rounded-lg px-2.5 py-1.5 transition-colors"
              >
                <Download size={12} />
                Export CSV
              </button>
            )}
            <button className="text-sm text-muted-foreground hover:text-foreground" onClick={onClose}>Close</button>
          </div>
        </div>
        <div className="p-4 overflow-auto max-h-[calc(90vh-56px)] space-y-4">
          {isLoading ? <div className="text-sm text-muted-foreground">Loading touchpoint details...</div> : null}
          {isError ? <div className="text-sm text-red-700">Could not load touchpoint details. {(error as any)?.message || ""}</div> : null}
          {!isLoading && !isError ? (
            <>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <StatCard label="Visits" value={fmtNum(summary.visits || 0)} icon={Eye} color="blue" />
                <StatCard label="CTA Clicks" value={fmtNum(summary.ctaClicks || 0)} icon={ArrowUpRight} color="amber" />
                <StatCard label="Signups" value={fmtNum(summary.signups || 0)} icon={Users} color="green" />
                <StatCard label="Visit -> Signup" value={`${Number(summary.visitToSignupPct || 0).toFixed(2)}%`} icon={TrendingUp} color="purple" />
              </div>

              <div className="grid md:grid-cols-2 gap-4">
                <div className="bg-card rounded-xl border border-border/50 p-4">
                  <h4 className="text-sm font-semibold mb-3">Action Mix</h4>
                  <SortableTable
                    columns={[
                      { key: "action", label: "Action", render: (r: any) => formatLoopActionLabel(r.action) },
                      { key: "total", label: "Events", align: "right", render: (r: any) => fmtNum(r.total) },
                    ]}
                    data={actionBreakdown}
                    defaultSort="total"
                  />
                </div>
                <div className="bg-card rounded-xl border border-border/50 p-4">
                  <h4 className="text-sm font-semibold mb-3">Channel Mix</h4>
                  <SortableTable
                    columns={[
                      { key: "channel", label: "Channel", render: (r: any) => String(r.channel || "unknown") },
                      { key: "total", label: "Events", align: "right", render: (r: any) => fmtNum(r.total) },
                    ]}
                    data={channelBreakdown}
                    defaultSort="total"
                  />
                </div>
              </div>

              <div className="bg-card rounded-xl border border-border/50 p-4">
                <h4 className="text-sm font-semibold mb-3">Recent Events</h4>
                <SortableTable
                  columns={[
                    { key: "createdAt", label: "Created", render: (r: any) => fmtDateTime(r.createdAt) },
                    { key: "action", label: "Action", render: (r: any) => formatLoopActionLabel(r.action) },
                    { key: "channel", label: "Channel" },
                    { key: "refCode", label: "Ref code", render: (r: any) => <span className="font-mono text-xs">{String(r.refCode || "none")}</span> },
                    { key: "fundId", label: "Fund", render: (r: any) => r.fundId ? <span className="font-mono text-xs">{r.fundId}</span> : "-" },
                    { key: "userId", label: "User", render: (r: any) => r.userId ? <span className="font-mono text-xs">{r.userId}</span> : "-" },
                  ]}
                  data={recentEvents}
                  defaultSort="createdAt"
                />
              </div>
            </>
          ) : null}
        </div>
      </div>
    </div>
  );
}

type Tab = "overview" | "growth" | "funnels" | "access-review" | "users" | "funds" | "assets" | "config" | "gifters" | "gifts" | "transactions" | "audit" | "moderation" | "ops" | "loops" | "integrations" | "deliverability";

const FALLBACK_SUPER_ADMINS = getDefaultSuperAdminEmails();

function isSuperAdminUser(user: { email?: string | null; isSuperAdmin?: boolean | null } | null | undefined) {
  return Boolean(user?.isSuperAdmin) || isEmailInAdminSet(user?.email, FALLBACK_SUPER_ADMINS);
}

export default function Admin() {
  const { user, isAuthenticated, isLoading: authLoading } = useAuth();
  const [, setLocation] = useLocation();
  const isSuperAdmin = isSuperAdminUser(user as any);
  const search = useSearch();
  const params = getSafeSearchParams(search);
  const queryTab = (params.get("tab") || "").toLowerCase();
  const [activeTab, setActiveTab] = useState<Tab>("overview");
  const queryClient = useQueryClient();

  useEffect(() => {
    const allowed: Tab[] = ["overview", "funnels", "access-review", "users", "funds", "assets", "config", "gifters", "gifts", "transactions", "audit", "moderation", "ops", "loops", "integrations", "deliverability"];
    if (allowed.includes(queryTab as Tab)) {
      setActiveTab(queryTab as Tab);
    }
  }, [queryTab]);

  const goTab = (tab: Tab, extra?: Record<string, string>) => {
    const qp = new URLSearchParams();
    qp.set("tab", tab);
    if (extra) {
      Object.entries(extra).forEach(([k, v]) => {
        if (v) qp.set(k, v);
      });
    }
    setLocation(`/admin?${qp.toString()}`);
  };

  const refreshAllAdminData = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["/api/admin/overview"] }),
      queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] }),
      queryClient.invalidateQueries({ queryKey: ["/api/admin/funds"] }),
      queryClient.invalidateQueries({ queryKey: ["/api/admin/gifts"] }),
      queryClient.invalidateQueries({ queryKey: ["/api/admin/transactions"] }),
      queryClient.invalidateQueries({ queryKey: ["/api/admin/assets"] }),
      queryClient.invalidateQueries({ queryKey: ["/api/admin/config/investments"] }),
      queryClient.invalidateQueries({ queryKey: ["/api/admin/webhooks?limit=50"] }),
      queryClient.invalidateQueries({ queryKey: ["/api/admin/stripe-diagnostics?windowHours=24"] }),
      queryClient.invalidateQueries({ queryKey: ["/api/admin/data-integrity"] }),
      queryClient.invalidateQueries({ queryKey: ["/api/admin/stripe/live-health"] }),
      queryClient.invalidateQueries({ queryKey: ["/api/admin/gifters?limit=10"] }),
      queryClient.invalidateQueries({ queryKey: ["/api/admin/gifters?limit=500"] }),
      queryClient.invalidateQueries({ queryKey: ["/api/admin/checkout-diagnostics?windowHours=168"] }),
      queryClient.invalidateQueries({ queryKey: ["/api/admin/growth-cohorts?weeks=12"] }),
      queryClient.invalidateQueries({ queryKey: ["/api/admin/growth?days=30"] }),
      queryClient.invalidateQueries({ queryKey: ["/api/admin/pending-gifts"] }),
    ]);
  };

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      setLocation("/login");
    }
  }, [authLoading, isAuthenticated, setLocation]);

  if (authLoading) return <div className="flex items-center justify-center min-h-screen"><p>Loading...</p></div>;
  if (!isAuthenticated) return null;
  if (!user?.isAdmin) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center px-4">
        <div className="max-w-md w-full bg-card border border-border/50 rounded-xl p-6 text-center">
          <AlertTriangle className="mx-auto mb-3 text-amber-600" size={22} />
          <h1 className="font-heading text-lg font-semibold mb-1">Admin Access Required</h1>
          <p className="text-sm text-muted-foreground mb-4">
            This account does not have admin permissions.
          </p>
          <button
            onClick={() => setLocation("/dashboard")}
            className="text-sm text-primary hover:underline"
            data-testid="link-admin-back-dashboard"
          >
            Back to dashboard
          </button>
        </div>
      </div>
    );
  }

  const tabs: { id: Tab; label: string; icon: any }[] = [
    { id: "overview", label: "Overview", icon: TrendingUp },
    { id: "funnels", label: "Funnels", icon: Activity },
    { id: "access-review", label: "Access Review", icon: Shield },
    { id: "loops", label: "Loops", icon: Activity },
    { id: "users", label: "Users", icon: Users },
    { id: "funds", label: "Funds", icon: Wallet },
    { id: "assets", label: "Assets", icon: BarChart3 },
    { id: "gifts", label: "Gifts", icon: Gift },
    { id: "gifters", label: "Gifters", icon: Users },
    { id: "transactions", label: "Transactions", icon: CreditCard },
    { id: "moderation", label: "Moderation", icon: Shield },
    { id: "ops", label: "Ops", icon: RefreshCw },
    { id: "integrations", label: "Integrations", icon: Activity },
    { id: "deliverability", label: "Deliverability", icon: Activity },
    { id: "audit", label: "Audit", icon: Shield },
    { id: "config", label: "Config", icon: Shield },
  ];

  return (
    <div className="min-h-screen bg-background pb-8">
      <header className="sticky top-0 z-50 bg-background/95 backdrop-blur-sm border-b border-border/50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <div className="flex items-center justify-between h-14">
            <div className="flex items-center gap-3">
              <Logo size="sm" className="text-primary" linkTo="/dashboard" />
              <span className="text-xs font-semibold text-muted-foreground bg-muted px-2 py-0.5 rounded">ADMIN</span>
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={refreshAllAdminData}
                className="text-sm text-muted-foreground hover:text-foreground inline-flex items-center gap-1"
                data-testid="button-admin-refresh"
              >
                <RefreshCw size={14} />
                Refresh
              </button>
              <button onClick={() => setLocation("/dashboard")} className="text-sm text-muted-foreground hover:text-foreground" data-testid="link-back-dashboard">Back to app</button>
            </div>
          </div>
          <div className="flex gap-1 -mb-px overflow-x-auto">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => goTab(tab.id)}
                className={`flex items-center gap-1.5 px-3 py-2.5 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
                  activeTab === tab.id
                    ? "border-primary text-foreground"
                    : "border-transparent text-muted-foreground hover:text-foreground"
                }`}
                data-testid={`tab-${tab.id}`}
              >
                <tab.icon size={15} />
                {tab.label}
              </button>
            ))}
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-6">
        {activeTab === "overview" && <OverviewTab goTab={goTab} />}
        {/* Growth merged into Funnels (2026-05-28): both answer "does the loop
            convert?" off different sources — one tab, two labeled sections. */}
        {activeTab === "funnels" && (
          <div className="space-y-8">
            <FunnelsTab />
            <GrowthTab />
          </div>
        )}
        {activeTab === "access-review" && <AccessReviewTab />}
        {activeTab === "users" && <UsersTab isSuperAdmin={isSuperAdmin} />}
        {activeTab === "funds" && <FundsTab />}
        {activeTab === "assets" && <AssetsTab />}
        {activeTab === "config" && <ConfigTab isSuperAdmin={isSuperAdmin} />}
        {activeTab === "gifters" && <GiftersTab />}
        {activeTab === "gifts" && <GiftsTab isSuperAdmin={isSuperAdmin} />}
        {activeTab === "transactions" && <TransactionsTab isSuperAdmin={isSuperAdmin} />}
        {activeTab === "audit" && <AuditTab />}
        {activeTab === "moderation" && <ModerationTab />}
        {activeTab === "ops" && <OpsTab />}
        {activeTab === "loops" && <LoopsTab />}
        {activeTab === "integrations" && <IntegrationsTab />}
        {activeTab === "deliverability" && <DeliverabilityTab />}
      </main>
    </div>
  );
}

// DeliverabilityTab — admin visibility into the email_suppressions
// table. Hard-bounced + spam-complained addresses written by the
// Postmark webhook handler. Admin can manually unsuppress when a
// recipient confirms the mailbox is valid again.
// Hooks /api/admin/email-suppressions (GET) +
// /api/admin/email-suppressions/:id/unsuppress (POST).
function DeliverabilityTab() {
  const [rows, setRows] = useState<Array<{
    id: string;
    email: string;
    reason: string;
    source: string;
    suppressed_at: string;
    unsuppressed_at: string | null;
    unsuppressed_reason: string | null;
  }>>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [unsuppressing, setUnsuppressing] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/email-suppressions", { credentials: "include" });
      if (!res.ok) throw new Error("Failed to load");
      const data = await res.json();
      setRows(Array.isArray(data) ? data : []);
    } catch (err: any) {
      setError(err?.message || "Failed to load");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void load(); }, []);

  const handleUnsuppress = async (id: string) => {
    const reason = window.prompt("Reason for unsuppressing? (e.g., 'gifter confirmed address is now valid')");
    if (!reason) return;
    setUnsuppressing(id);
    try {
      const res = await fetch(`/api/admin/email-suppressions/${id}/unsuppress`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ reason }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.error || "Failed to unsuppress");
      }
      await load();
    } catch (err: any) {
      alert(err?.message || "Failed to unsuppress");
    } finally {
      setUnsuppressing(null);
    }
  };

  const activeRows = rows.filter((r) => !r.unsuppressed_at);
  const cleared = rows.filter((r) => r.unsuppressed_at);

  return (
    <div className="space-y-6 py-6">
      <div>
        <h2 className="text-lg font-semibold text-foreground">Email deliverability</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Addresses suppressed by the Postmark bounce/complaint webhook. Subsequent emails to these addresses are silently skipped by sendEmail() to protect sender reputation. Unsuppress manually when a recipient confirms the address is valid again.
        </p>
      </div>

      {error && <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800">{error}</div>}
      {loading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : (
        <>
          <section>
            <h3 className="text-sm font-semibold text-foreground mb-3">Active suppressions ({activeRows.length})</h3>
            {activeRows.length === 0 ? (
              <p className="text-sm text-muted-foreground">No active suppressions. Inbox reputation is healthy.</p>
            ) : (
              <div className="overflow-x-auto rounded-xl border border-border">
                <table className="w-full text-sm">
                  <thead className="bg-muted/40 text-left">
                    <tr>
                      <th className="px-3 py-2 font-medium">Email</th>
                      <th className="px-3 py-2 font-medium">Reason</th>
                      <th className="px-3 py-2 font-medium">Source</th>
                      <th className="px-3 py-2 font-medium">When</th>
                      <th className="px-3 py-2 font-medium"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {activeRows.map((r) => (
                      <tr key={r.id} className="border-t border-border" data-testid={`suppression-row-${r.id}`}>
                        <td className="px-3 py-2 font-mono text-xs">{r.email}</td>
                        <td className="px-3 py-2"><span className="rounded-full bg-red-100 text-red-800 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide">{r.reason}</span></td>
                        <td className="px-3 py-2 text-muted-foreground">{r.source}</td>
                        <td className="px-3 py-2 text-muted-foreground">{new Date(r.suppressed_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}</td>
                        <td className="px-3 py-2 text-right">
                          <button
                            type="button"
                            onClick={() => void handleUnsuppress(r.id)}
                            disabled={unsuppressing === r.id}
                            className="text-xs font-semibold text-[hsl(var(--kiddo-evergreen))] hover:underline disabled:opacity-50"
                            data-testid={`button-unsuppress-${r.id}`}
                          >
                            {unsuppressing === r.id ? "Unsuppressing…" : "Unsuppress"}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          {cleared.length > 0 && (
            <section>
              <h3 className="text-sm font-semibold text-foreground mb-3">Manually cleared ({cleared.length})</h3>
              <div className="overflow-x-auto rounded-xl border border-border">
                <table className="w-full text-sm">
                  <thead className="bg-muted/40 text-left">
                    <tr>
                      <th className="px-3 py-2 font-medium">Email</th>
                      <th className="px-3 py-2 font-medium">Original reason</th>
                      <th className="px-3 py-2 font-medium">Cleared</th>
                      <th className="px-3 py-2 font-medium">Note</th>
                    </tr>
                  </thead>
                  <tbody>
                    {cleared.map((r) => (
                      <tr key={r.id} className="border-t border-border">
                        <td className="px-3 py-2 font-mono text-xs">{r.email}</td>
                        <td className="px-3 py-2 text-muted-foreground">{r.reason}</td>
                        <td className="px-3 py-2 text-muted-foreground">{r.unsuppressed_at ? new Date(r.unsuppressed_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "—"}</td>
                        <td className="px-3 py-2 text-muted-foreground">{r.unsuppressed_reason || "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          )}
        </>
      )}
    </div>
  );
}

function OverviewTab({ goTab }: { goTab: (tab: Tab, extra?: Record<string, string>) => void }) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const isSuperAdmin = isSuperAdminUser(user as any);
  // Overview panels are all-time aggregates; they do NOT need second-by-second
  // freshness. Auto-polling (15-60s) + refetchOnWindowFocus across 13 panels
  // meant ~13 background round-trips on a loop AND a full re-fetch on every
  // alt-tab — each writing an admin_*_viewed audit row, spamming audit_logs.
  // De-polled 2026-05-28: fetch on mount, otherwise rely on the top-nav
  // Refresh button. (Live ops surfaces that DO need freshness — Ops SSE,
  // worker queues — poll on their own tabs, unchanged.)
  const { data, isLoading, isError, error } = useQuery<any>({
    queryKey: ["/api/admin/overview"],
    queryFn: async () => fetchAdminJson("/api/admin/overview"),
    refetchOnWindowFocus: false,
  });
  const { data: health, isLoading: healthLoading } = useQuery<any>({
    queryKey: ["/api/health?deep=1"],
    queryFn: async () => fetchAdminJson("/api/health?deep=1"),
    refetchOnWindowFocus: false,
  });
  const { data: webhookEvents = [], isLoading: webhookLoading } = useQuery<any[]>({
    queryKey: ["/api/admin/webhooks?limit=50"],
    queryFn: async () => fetchAdminJson("/api/admin/webhooks?limit=50"),
    refetchOnWindowFocus: false,
  });
  const { data: stripeDiag, isLoading: stripeDiagLoading } = useQuery<any>({
    queryKey: ["/api/admin/stripe-diagnostics?windowHours=24"],
    queryFn: async () => fetchAdminJson("/api/admin/stripe-diagnostics?windowHours=24"),
    refetchOnWindowFocus: false,
  });
  const { data: stripeLive, isLoading: stripeLiveLoading } = useQuery<any>({
    queryKey: ["/api/admin/stripe/live-health"],
    queryFn: async () => fetchAdminJson("/api/admin/stripe/live-health"),
    refetchOnWindowFocus: false,
  });
  const { data: dataIntegrity, isLoading: dataIntegrityLoading, isError: dataIntegrityError, error: dataIntegrityErrorObj } = useQuery<any>({
    queryKey: ["/api/admin/data-integrity"],
    queryFn: async () => fetchAdminJson("/api/admin/data-integrity"),
    refetchOnWindowFocus: false,
  });
  // Gifter LTV + Top Gifters PANELS were cut from Overview (they duplicated the
  // dedicated Gifters tab); Overview links to that tab instead. The aggregate
  // gifter list is still fetched once for the PLG "repeat gifter" retention
  // metric below — cheap at current scale; revisit if the gifter count explodes.
  const { data: allGifters = [] } = useQuery<any[]>({
    queryKey: ["/api/admin/gifters?limit=500"],
    queryFn: async () => fetchAdminJson("/api/admin/gifters?limit=500"),
    refetchOnWindowFocus: false,
  });
  const { data: checkoutDiag, isLoading: checkoutDiagLoading } = useQuery<any>({
    queryKey: ["/api/admin/checkout-diagnostics?windowHours=168"],
    queryFn: async () => fetchAdminJson("/api/admin/checkout-diagnostics?windowHours=168"),
    refetchOnWindowFocus: false,
  });
  const { data: growthCohorts, isLoading: growthCohortsLoading } = useQuery<any>({
    queryKey: ["/api/admin/growth-cohorts?weeks=12"],
    queryFn: async () => fetchAdminJson("/api/admin/growth-cohorts?weeks=12"),
    refetchOnWindowFocus: false,
  });
  const { data: northStar, isLoading: northStarLoading } = useQuery<any>({
    queryKey: ["/api/admin/north-star"],
    queryFn: async () => fetchAdminJson("/api/admin/north-star"),
    refetchOnWindowFocus: false,
  });
  // PMF survey aggregation. The Sean Ellis 40% threshold sits
  // alongside the North Star section as the second quantitative
  // PMF gate (locked 2026-05-26 per
  // project_launch_wedge_and_creator_distribution.md). North Star
  // measures behavioral PMF (are gifters returning?); PMF survey
  // measures stated PMF (would users be very disappointed without us?).
  const { data: pmfSurvey, isLoading: pmfSurveyLoading } = useQuery<any>({
    queryKey: ["/api/admin/pmf-survey"],
    queryFn: async () => fetchAdminJson("/api/admin/pmf-survey"),
    refetchOnWindowFocus: false,
  });
  const { data: pendingGifts = [], isLoading: pendingGiftsLoading } = useQuery<any[]>({
    queryKey: ["/api/admin/pending-gifts"],
    queryFn: async () => fetchAdminJson("/api/admin/pending-gifts"),
    refetchOnWindowFocus: false,
  });
  const repairMutation = useMutation({
    mutationFn: async (apply: boolean) => {
      const res = await fetch("/api/admin/data-integrity/repair-gift-reconciliation", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ apply }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error((body as any)?.error || "Repair request failed");
      return body;
    },
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["/api/admin/data-integrity"] }),
        queryClient.invalidateQueries({ queryKey: ["/api/admin/overview"] }),
        queryClient.invalidateQueries({ queryKey: ["/api/admin/gifters?limit=10"] }),
        queryClient.invalidateQueries({ queryKey: ["/api/admin/gifters?limit=500"] }),
        queryClient.invalidateQueries({ queryKey: ["/api/admin/gifts"] }),
        queryClient.invalidateQueries({ queryKey: ["/api/admin/transactions"] }),
        queryClient.invalidateQueries({ queryKey: ["/api/admin/funds"] }),
      ]);
    },
  });

  if (isLoading) return <div className="text-center py-12 text-muted-foreground">Loading dashboard...</div>;
  if (isError || !data) {
    return (
      <div className="bg-card rounded-xl border border-border/50 p-6 text-sm text-muted-foreground space-y-2">
        <p>Could not load admin overview.</p>
        {error instanceof Error && (
          <p className="text-xs text-muted-foreground/80">{error.message}</p>
        )}
      </div>
    );
  }

  const r = data.revenue;
  const ue = data.unitEconomics || {};
  const u = data.users;
  const f = data.funds;
  const g = data.gifts;
  const s = data.subscriptions;
  const e = data.events;
  const tx = data.transactions;
  const growth = data.growth || {};
  const assetInsights = data.assetInsights || {};
  const webhookStats = stripeDiag?.summary?.webhook_stats || {};
  const pendingAge = stripeDiag?.summary?.pending_age || {};
  const stripeConfigured = Boolean(stripeLive?.configured);
  const stripeOffline = stripeLiveLoading ? false : stripeConfigured && !stripeLive?.stripeReachable;
  const safeWebhookEvents = asArray<any>(webhookEvents);
  const integrityChecks = asArray<any>(dataIntegrity?.checks);
  const integrityGiftCheck = integrityChecks.find((c: any) => c?.id === "gift_tx_reconciliation");
  const cohortRows = asArray<any>(growthCohorts?.cohorts);
  const northStarCohorts = asArray<any>(northStar?.cohorts);
  const northStarLadder = asArray<any>(northStar?.ladder);
  const northStarSummary = northStar?.summary || {};
  const channelRows = asArray<any>(checkoutDiag?.byChannel);
  const allGiftersRows = asArray<any>(allGifters);
  const degradedBanner = data?.degraded ? (
    <div className="bg-card rounded-xl border border-amber-300 p-6 text-sm space-y-2">
      <p className="font-medium text-foreground">Admin overview loaded in degraded mode.</p>
      <p className="text-muted-foreground">
        Some metrics could not be queried, but your admin session is valid.
      </p>
      {Array.isArray(data?.queryErrors) && data.queryErrors.length > 0 && (
        <p className="text-xs text-muted-foreground/80">{String(data.queryErrors[0])}</p>
      )}
    </div>
  ) : null;
  const integrityStatusMap: Record<string, string> = {
    green: "bg-green-100 text-green-700",
    yellow: "bg-amber-100 text-amber-800",
    red: "bg-red-100 text-red-700",
  };
  const northStarStatusMap: Record<string, string> = {
    green: "bg-green-100 text-green-700",
    yellow: "bg-amber-100 text-amber-800",
    red: "bg-red-100 text-red-700",
  };
  const investedOrSettled = Number(g.invested_gifts || 0) + Number(g.settled_gifts || 0);
  const checkoutStarts = Number(checkoutDiag?.starts || 0);
  const checkoutCompletes = Number(checkoutDiag?.completes || 0);
  const checkoutGiftsTotal = Number(checkoutDiag?.giftsTotal || 0);
  const checkoutGiftsInvested = Number(checkoutDiag?.giftsInvested || 0);
  const investmentsFromCheckoutPct = checkoutCompletes > 0 ? (checkoutGiftsInvested / checkoutCompletes) * 100 : 0;
  // Repeat-gifter rate still feeds the PLG "Marketing-led · Retention" row.
  const repeatGifters = allGiftersRows.filter((x: any) => Number(x.gift_count || 0) > 1).length;
  const totalGiftersCount = allGiftersRows.length;
  const repeatGifterRate = totalGiftersCount > 0 ? (repeatGifters / totalGiftersCount) * 100 : 0;
  const chargedFromOverview = toNumSafe(g.total_charged_volume);
  const chargedFromIntegrity = Math.max(toNumSafe(integrityGiftCheck?.left), toNumSafe(integrityGiftCheck?.right));
  const chargedForDisplay = chargedFromOverview > 0.009 ? chargedFromOverview : chargedFromIntegrity;
  const ueAppStore = ue.appStore || {};
  const ueChannels = asArray<any>(ue.channelSummary);
  const onboardingUsersWithFund = Number(growth.onboarding_users_with_fund || 0);
  const onboardingTotalUsers = Number(growth.onboarding_total_users || 0);
  const onboardingCompletionPct = Number(growth.onboarding_completion_pct || 0);
  const trustTooltipOpens = Number(growth.trust_tooltip_opens_30d || 0);
  const trustTooltipClicks = Number(growth.trust_tooltip_clicks_30d || 0);
  const trustTooltipCtrPct = Number(growth.trust_tooltip_ctr_pct || 0);
  const reactivationCanceled = Number(growth.canceled_30d || 0);
  const reactivationRecovered = Number(growth.reactivated_30d || 0);
  const reactivationRecoveryPct = Number(growth.reactivation_recovery_pct || 0);
  const checkoutVisits30d = Number(growth.checkout_visits_30d || 0);
  const checkoutShares30d = Number(growth.checkout_shares_30d || 0);
  const checkoutStarts30d = Number(growth.checkout_start_30d || 0);
  const checkoutCompletes30d = Number(growth.checkout_complete_30d || 0);
  const visitToSharePct = Number(growth.visit_to_share_rate_pct || 0);
  const shareToCheckoutStartPct = Number(growth.share_to_checkout_start_rate_pct || 0);
  const checkoutStartToCompletePct = Number(growth.checkout_start_to_complete_rate_pct || 0);
  const paidPlanPenetrationPct = Number(u.total_users || 0) > 0
    ? (Number(s.active_paid_plans || 0) / Number(u.total_users || 0)) * 100
    : 0;
  const motionsLevers = [
    { motion: "Product-led", lever: "Acquisition", pct: Number(growth.share_to_gift_rate_pct || 0), sub: `${fmtNum(growth.shared_funds_with_gifts)} / ${fmtNum(growth.shared_funds)} shared funds`, color: "blue" as const },
    { motion: "Product-led", lever: "Monetization", pct: Number(growth.gift_completion_rate_pct || 0), sub: `${fmtNum(growth.checkout_complete_events)} / ${fmtNum(growth.checkout_start_events)} checkout`, color: "green" as const },
    { motion: "Product-led", lever: "Retention", pct: Number(growth.recurring_adoption_afrg_pct || 0), sub: `${fmtNum(growth.afrg_with_recurring)} recurring AFRG funds`, color: "purple" as const },
    { motion: "Marketing-led", lever: "Acquisition", pct: visitToSharePct, sub: `${fmtNum(checkoutShares30d)} / ${fmtNum(checkoutVisits30d)} visit->share`, color: "blue" as const },
    { motion: "Marketing-led", lever: "Monetization", pct: shareToCheckoutStartPct, sub: `${fmtNum(checkoutStarts30d)} / ${fmtNum(checkoutShares30d)} share->start`, color: "amber" as const },
    { motion: "Marketing-led", lever: "Retention", pct: repeatGifterRate, sub: `${fmtNum(repeatGifters)} / ${fmtNum(totalGiftersCount)} repeat gifters`, color: "green" as const },
    { motion: "Sales-led", lever: "Acquisition", pct: paidPlanPenetrationPct, sub: `${fmtNum(s.active_paid_plans)} / ${fmtNum(u.total_users)} paid users`, color: "purple" as const },
    { motion: "Sales-led", lever: "Monetization", pct: Number(growth.sub_conversion_after_afrg_14d_pct || 0), sub: `${fmtNum(growth.afrg_converted_to_paid_14d)} converted after AFRG`, color: "green" as const },
    { motion: "Sales-led", lever: "Retention", pct: reactivationRecoveryPct, sub: `${fmtNum(reactivationRecovered)} / ${fmtNum(reactivationCanceled)} reactivated`, color: "amber" as const },
  ];

  const alerts: { level: "red" | "yellow"; text: string; onClick?: () => void }[] = [];
  if (Number(webhookStats?.failed_webhooks || 0) > 0) alerts.push({ level: "red", text: `Webhook failures detected (${fmtNum(webhookStats?.failed_webhooks)})`, onClick: () => goTab("transactions", { status: "failed" }) });
  if (Number(pendingAge?.pending_over_24h || 0) > 0) alerts.push({ level: "red", text: `Pending gifts older than 24h: ${fmtNum(pendingAge?.pending_over_24h)}`, onClick: () => goTab("gifts", { status: "pending" }) });
  if (Number(pendingAge?.pending_over_1h || 0) > 0) alerts.push({ level: "yellow", text: `Pending gifts older than 1h: ${fmtNum(pendingAge?.pending_over_1h)}`, onClick: () => goTab("gifts", { status: "pending" }) });
  if (Number(checkoutDiag?.completionRatePct || 0) < 15 && checkoutStarts >= 10) alerts.push({ level: "yellow", text: `Checkout completion is low (${Number(checkoutDiag?.completionRatePct || 0).toFixed(2)}%)`, onClick: () => goTab("overview") });
  if (Number(dataIntegrity?.overallStatus === "red" ? 1 : 0) > 0) alerts.push({ level: "red", text: "Data integrity has red checks", onClick: () => goTab("assets") });
  if (Number(growth.event_created_no_share_24h_signals_30d || 0) > 0) {
    alerts.push({
      level: "yellow",
      text: `Lifecycle: events with no share after 24h (${fmtNum(growth.event_created_no_share_24h_signals_30d)})`,
      onClick: () => goTab("overview"),
    });
  }
  if (Number(growth.share_no_checkout_48h_signals_30d || 0) > 0) {
    alerts.push({
      level: "yellow",
      text: `Lifecycle: shares with no checkout after 48h (${fmtNum(growth.share_no_checkout_48h_signals_30d)})`,
      onClick: () => goTab("overview"),
    });
  }
  if (Number(growth.no_gift_14d_signals_30d || 0) > 0) {
    alerts.push({
      level: "yellow",
      text: `Lifecycle: funds with no gift after 14d (${fmtNum(growth.no_gift_14d_signals_30d)})`,
      onClick: () => goTab("overview"),
    });
  }

  return (
    <div className="space-y-8">
      {degradedBanner}
      <section>
        <h2 className="font-heading text-lg font-semibold mb-4 flex items-center gap-2" data-testid="heading-system-health">
          <Server size={18} className={health?.ok ? "text-green-600" : "text-red-600"} />
          System Health
        </h2>
        {!stripeConfigured && !stripeLiveLoading && (
          <div className="mb-3 rounded-lg border border-blue-300 bg-blue-50 px-3 py-2 text-sm text-blue-800">
            Stripe is not configured in this environment yet. Add `STRIPE_SECRET_KEY` and `STRIPE_PUBLISHABLE_KEY` to remove this notice.
          </div>
        )}
        {stripeOffline && (
          <div className="mb-3 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-800">
            Stripe is currently unreachable from this environment. Revenue, webhook, and checkout metrics may be incomplete.
          </div>
        )}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          <StatCard
            label="API Status"
            value={healthLoading ? "..." : (health?.ok ? "Healthy" : "Error")}
            icon={Activity}
            color={health?.ok ? "green" : "red"}
            sub={health?.timestamp ? fmtDateTime(health.timestamp) : "Latest check"}
          />
          <StatCard
            label="DB Status"
            value={healthLoading ? "..." : (health?.db === "ok" ? "Connected" : "Issue")}
            icon={Building2}
            color={health?.db === "ok" ? "green" : "red"}
            sub="Deep health check"
          />
          <StatCard
            label="Webhook Failed"
            value={stripeDiagLoading ? "..." : fmtNum(webhookStats?.failed_webhooks)}
            icon={AlertTriangle}
            color={Number(webhookStats?.failed_webhooks || 0) > 0 ? "red" : "green"}
            sub="Last 24h"
          />
          <StatCard
            label="Webhook Processing"
            value={stripeDiagLoading ? "..." : fmtNum(webhookStats?.processing_webhooks)}
            icon={Activity}
            color="blue"
            sub="Last 24h"
          />
          <StatCard
            label="Webhook Processed"
            value={stripeDiagLoading ? "..." : fmtNum(webhookStats?.processed_webhooks)}
            icon={Shield}
            color="green"
            sub="Last 24h"
          />
        </div>
      </section>

      {alerts.length > 0 && (
        <section>
          <h2 className="font-heading text-lg font-semibold mb-4 flex items-center gap-2">
            <AlertTriangle size={18} className="text-amber-600" />
            Operational Alerts
          </h2>
          <div className="space-y-2">
            {alerts.map((a, idx) => (
              <button
                key={idx}
                onClick={a.onClick}
                className={`w-full text-left rounded-lg border px-3 py-2 text-sm ${
                  a.level === "red"
                    ? "border-red-300 bg-red-50 text-red-800"
                    : "border-amber-300 bg-amber-50 text-amber-800"
                }`}
              >
                {a.text}
              </button>
            ))}
          </div>
        </section>
      )}

      <section>
        <div className="mb-4 flex items-center justify-between gap-2">
          <h2 className="font-heading text-lg font-semibold flex items-center gap-2" data-testid="heading-data-integrity">
            <Shield size={18} className={dataIntegrity?.overallStatus === "red" ? "text-red-600" : dataIntegrity?.overallStatus === "yellow" ? "text-amber-600" : "text-green-600"} />
            Data Integrity
          </h2>
          {isSuperAdmin && (
            <button
              className="text-xs px-3 py-1.5 rounded-md border border-border hover:bg-muted disabled:opacity-50"
              disabled={repairMutation.isPending}
              onClick={async () => {
                try {
                  const dry = await repairMutation.mutateAsync(false);
                  const p = (dry as any)?.preview || {};
                  const message = [
                    "Repair preview:",
                    `- Linkable transactions: ${fmtNum(p.linkableTransactions || 0)}`,
                    `- Tx amount mismatches: ${fmtNum(p.txAmountMismatches || 0)}`,
                    `- Pending balance mismatches: ${fmtNum(p.pendingBalanceMismatches || 0)}`,
                    `- Invested-balance mismatches (recompute from holdings): ${fmtNum(p.investedBalanceMismatches || 0)}`,
                    "",
                    "Apply these repairs now?",
                  ].join("\n");
                  if (!window.confirm(message)) return;
                  const applied = await repairMutation.mutateAsync(true);
                  const a = (applied as any)?.applied || {};
                  window.alert(
                    [
                      "Repair complete:",
                      `- Linked transactions: ${fmtNum(a.linkedTransactions || 0)}`,
                      `- Fixed tx amounts: ${fmtNum(a.fixedTransactionAmounts || 0)}`,
                      `- Fixed pending balances: ${fmtNum(a.fixedPendingBalances || 0)}`,
                      `- Recomputed fund balances: ${fmtNum(a.recomputedFundBalances || 0)}`,
                    ].join("\n"),
                  );
                } catch (e: any) {
                  window.alert(`Repair failed: ${e?.message || "Unknown error"}`);
                }
              }}
            >
              {repairMutation.isPending ? "Repairing..." : "Repair Gift Data"}
            </button>
          )}
        </div>
        {dataIntegrityLoading ? (
          <div className="text-sm text-muted-foreground">Computing integrity checks...</div>
        ) : dataIntegrityError ? (
          <div className="text-sm text-red-700">
            Could not load integrity checks. {(dataIntegrityErrorObj as any)?.message || ""}
          </div>
        ) : (
          <div className="bg-card rounded-xl border border-border/50 divide-y divide-border/50">
            {integrityChecks.length === 0 ? (
              <div className="p-4 text-sm text-muted-foreground">No integrity data available.</div>
            ) : (
              integrityChecks.map((check: any) => (
                <div key={check.id} className="p-4">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-sm font-semibold text-foreground">{check.label}</p>
                    <StatusBadge status={check.status} map={integrityStatusMap} />
                  </div>
                  <div className="mt-2 grid grid-cols-1 md:grid-cols-3 gap-2 text-xs text-muted-foreground">
                    <div>{check.leftLabel}: {fmt(check.left)}</div>
                    <div>{check.rightLabel}: {fmt(check.right)}</div>
                    <div>Delta: {fmt(check.delta)}</div>
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">{check.note}</p>
                  <div className="mt-2">
                    <button
                      onClick={() => {
                        if (check.id === "gift_tx_reconciliation") goTab("transactions", { type: "gift" });
                        if (check.id === "invested_vs_holdings") goTab("assets");
                        if (check.id === "pending_vs_pending") goTab("gifts", { status: "pending" });
                      }}
                      className="text-xs text-primary hover:underline"
                    >
                      Open related data
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        )}
      </section>

      <section>
        <h2 className="font-heading text-lg font-semibold mb-4 flex items-center gap-2" data-testid="heading-north-star">
          <TrendingUp size={18} className="text-primary" />
          North Star
        </h2>
        <p className="text-xs text-muted-foreground mb-3">
          Active Gifting Funds % is the share of eligible funds with at least one successful contribution in the last 90 days.
        </p>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <StatCard
            label="Active Gifting Funds %"
            value={northStarLoading ? "..." : `${Number(northStarSummary.activeGiftingFundsPct || 0).toFixed(2)}%`}
            icon={TrendingUp}
            color={
              northStarSummary.healthStatus === "green"
                ? "green"
                : northStarSummary.healthStatus === "yellow"
                  ? "amber"
                  : "red"
            }
            sub={northStarLoading ? "..." : `${fmtNum(northStarSummary.activeGiftingFunds || 0)} active / ${fmtNum(northStarSummary.eligibleFunds || 0)} eligible`}
          />
          <StatCard
            label="Health Status"
            value={northStarLoading ? "..." : String(northStarSummary.healthStatus || "red").toUpperCase()}
            icon={Shield}
            color={
              northStarSummary.healthStatus === "green"
                ? "green"
                : northStarSummary.healthStatus === "yellow"
                  ? "amber"
                  : "red"
            }
            sub="Green 60%+, yellow 40-59%, red below 40%"
          />
          <StatCard
            label="Median Time to 1st Contribution"
            value={northStarLoading ? "..." : `${Number(northStarSummary.medianDaysToFirstContribution || 0).toFixed(2)}d`}
            icon={Calendar}
            color="blue"
            sub={northStarLoading ? "..." : `P75: ${Number(northStarSummary.p75DaysToFirstContribution || 0).toFixed(2)}d`}
          />
          <StatCard
            label="No Contribution Yet"
            value={northStarLoading ? "..." : fmtNum(northStarSummary.noContributionYetFunds || 0)}
            icon={AlertTriangle}
            color={Number(northStarSummary.noContributionYetFunds || 0) > 0 ? "amber" : "green"}
            sub="Activation gap"
          />
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-3">
          <StatCard
            label="3+ Contributions"
            value={northStarLoading ? "..." : fmtNum(northStarSummary.threePlusContributionFunds || 0)}
            icon={Gift}
            color="green"
            sub="Habit formation"
          />
          <StatCard
            label="$500+ Funds"
            value={northStarLoading ? "..." : fmtNum(northStarSummary.funded500PlusFunds || 0)}
            icon={Wallet}
            color="blue"
            sub="Stake formation"
          />
          <StatCard
            label="Sticky Zone"
            value={northStarLoading ? "..." : fmtNum(northStarSummary.stickyZoneFunds || 0)}
            icon={Heart}
            color="purple"
            sub="$2K+ and 2+ years"
          />
          <StatCard
            label="Forever Users"
            value={northStarLoading ? "..." : fmtNum(northStarSummary.foreverUserFunds || 0)}
            icon={Heart}
            color="amber"
            sub="$2K+ and 4+ years"
          />
        </div>
        <div className="mt-4 grid md:grid-cols-3 gap-3">
          {northStarLoading ? (
            <div className="text-sm text-muted-foreground">Loading cohort health...</div>
          ) : (
            northStarCohorts.map((cohort: any) => (
              <PercentBar
                key={cohort.cohort}
                label={cohort.cohort}
                pct={Number(cohort.activeGiftingFundsPct || 0)}
                sub={`${fmtNum(cohort.activeGiftingFunds || 0)} / ${fmtNum(cohort.eligibleFunds || 0)} active gifting funds`}
                color={
                  Number(cohort.activeGiftingFundsPct || 0) >= 60
                    ? "green"
                    : Number(cohort.activeGiftingFundsPct || 0) >= 40
                      ? "amber"
                      : "red"
                }
              />
            ))
          )}
        </div>
        <div className="mt-4 grid md:grid-cols-2 gap-4">
          <div className="bg-card rounded-xl border border-border/50 p-4">
            <div className="flex items-center justify-between gap-3 mb-3">
              <h3 className="text-sm font-semibold">Fund Age Cohorts</h3>
              {!northStarLoading && (
                <StatusBadge status={String(northStarSummary.healthStatus || "red")} map={northStarStatusMap} />
              )}
            </div>
            <SortableTable
              columns={[
                { key: "cohort", label: "Cohort" },
                { key: "eligibleFunds", label: "Eligible" },
                { key: "activeGiftingFunds", label: "Active" },
                {
                  key: "activeGiftingFundsPct",
                  label: "Active %",
                  render: (row) => `${Number(row?.activeGiftingFundsPct || 0).toFixed(2)}%`,
                },
                {
                  key: "medianDaysToFirstContribution",
                  label: "Median to 1st",
                  render: (row) => `${Number(row?.medianDaysToFirstContribution || 0).toFixed(2)}d`,
                },
              ]}
              data={northStarCohorts}
              defaultSort="cohort"
            />
          </div>
          <div className="bg-card rounded-xl border border-border/50 p-4">
            <h3 className="text-sm font-semibold mb-3">Engagement Ladder</h3>
            <SortableTable
              columns={[
                { key: "level", label: "Level" },
                { key: "label", label: "Definition" },
                { key: "fundCount", label: "Funds" },
                {
                  key: "pctOfEligibleFunds",
                  label: "% of Eligible",
                  render: (row) => `${Number(row?.pctOfEligibleFunds || 0).toFixed(2)}%`,
                },
              ]}
              data={northStarLadder}
              defaultSort="level"
            />
          </div>
        </div>
      </section>

      {/* PMF Survey (Sean Ellis test). Sits below North Star because
          they answer different questions: North Star measures whether
          gifters are actually coming back (behavioral signal); the
          Sean Ellis 40%-very-disappointed threshold measures whether
          users would care if Kiddo went away (stated-preference signal).
          Both are required PMF gates per the locked launch wedge.
          Insufficient-sample state below 10 unique respondents — too
          few to call green/yellow/red without statistical lying. */}
      <section>
        <h2 className="font-heading text-lg font-semibold mb-4 flex items-center gap-2" data-testid="heading-pmf-survey">
          <MessageSquare size={18} className="text-primary" />
          PMF Survey (Sean Ellis)
        </h2>
        <p className="text-xs text-muted-foreground mb-3">
          "How would you feel if you could no longer use Kiddo?" Very-disappointed % across unique respondents. 40%+ sustained over 4 weeks is the PMF gate to scale creator spend.
        </p>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <StatCard
            label="Very Disappointed %"
            value={pmfSurveyLoading ? "..." : `${Number(pmfSurvey?.veryDisappointedPct || 0).toFixed(1)}%`}
            icon={Heart}
            color={
              pmfSurvey?.healthStatus === "green"
                ? "green"
                : pmfSurvey?.healthStatus === "yellow"
                  ? "amber"
                  : pmfSurvey?.healthStatus === "insufficient_sample"
                    ? "blue"
                    : "red"
            }
            sub={pmfSurveyLoading ? "..." : `${fmtNum(pmfSurvey?.veryDisappointed || 0)} of ${fmtNum(pmfSurvey?.uniqueRespondents || 0)} respondents`}
          />
          <StatCard
            label="Health Status"
            value={pmfSurveyLoading ? "..." : String(pmfSurvey?.healthStatus || "no_data").replace(/_/g, " ").toUpperCase()}
            icon={Shield}
            color={
              pmfSurvey?.healthStatus === "green"
                ? "green"
                : pmfSurvey?.healthStatus === "yellow"
                  ? "amber"
                  : pmfSurvey?.healthStatus === "insufficient_sample"
                    ? "blue"
                    : "red"
            }
            sub="40%+ green, 30-39% yellow, below 30% red, <10 sample insufficient"
          />
          <StatCard
            label="Somewhat Disappointed"
            value={pmfSurveyLoading ? "..." : fmtNum(pmfSurvey?.somewhatDisappointed || 0)}
            icon={MessageSquare}
            color="amber"
            sub="Middle band, convertible if product gap closes"
          />
          <StatCard
            label="Not Disappointed"
            value={pmfSurveyLoading ? "..." : fmtNum(pmfSurvey?.notDisappointed || 0)}
            icon={AlertTriangle}
            color={Number(pmfSurvey?.notDisappointed || 0) > Number(pmfSurvey?.veryDisappointed || 0) ? "red" : "amber"}
            sub="Wrong audience or weak product fit"
          />
        </div>
        {!pmfSurveyLoading && Array.isArray(pmfSurvey?.recentNotes) && pmfSurvey.recentNotes.length > 0 && (
          <div className="mt-4 bg-card rounded-xl border border-border/50 p-4">
            <h3 className="text-sm font-semibold mb-3">Recent qualitative notes</h3>
            <div className="space-y-3">
              {pmfSurvey.recentNotes.slice(0, 10).map((n: any, idx: number) => (
                <div key={idx} className="border-l-2 border-primary/40 pl-3 py-1">
                  <div className="flex items-center gap-2 mb-1 text-[11px] text-muted-foreground">
                    <span className="font-mono">{n.emailRedacted}</span>
                    <span>·</span>
                    <span className="capitalize">{String(n.responseLabel || n.response || "").replace(/_/g, " ")}</span>
                    <span>·</span>
                    <span>{new Date(n.createdAt).toLocaleDateString()}</span>
                  </div>
                  <p className="text-sm text-foreground leading-relaxed">{n.note}</p>
                </div>
              ))}
            </div>
          </div>
        )}
      </section>

      <section>
        <h2 className="font-heading text-lg font-semibold mb-4 flex items-center gap-2" data-testid="heading-plg-motions-levers">
          <BarChart3 size={18} className="text-primary" />
          PLG Motions x Levers
        </h2>
        <p className="text-xs text-muted-foreground mb-3">
          Proxy scorecards across Product-led, Marketing-led, and Sales-led motions on acquisition, monetization, and retention.
        </p>
        <div className="grid md:grid-cols-3 gap-3">
          {motionsLevers.map((cell) => (
            <PercentBar
              key={`${cell.motion}-${cell.lever}`}
              label={`${cell.motion} · ${cell.lever}`}
              pct={cell.pct}
              sub={cell.sub}
              color={cell.color}
            />
          ))}
        </div>
      </section>

      <section>
        <h2 className="font-heading text-lg font-semibold mb-4 flex items-center gap-2" data-testid="heading-kora-revenue">
          <TrendingUp size={18} className="text-green-600" />
          Kiddo Revenue
        </h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatCard label="Total Revenue" value={fmt(r.totalKoraRevenue)} icon={TrendingUp} color="green" sub="All-time Kiddo earnings" />
          <StatCard label="Gift Platform Fees" value={fmt(r.giftPlatformFees)} icon={Gift} color="primary" sub="Free-plan gift fees + applicable safeguards" />
          <StatCard label="Subscription Revenue" value={fmt((Number(r.starterPlanRevenue || 0) + Number(r.familyPlanRevenue || 0)).toString())} icon={CreditCard} color="purple" sub={`${fmtNum(s.active_paid_plans)} active paid plans`} />
          <StatCard label="Kiddo Occasion Revenue" value={fmt(r.eventPassRevenue)} icon={Calendar} color="amber" sub={`${fmtNum(e.events_with_pass)} premium occasions`} />
        </div>
        <div className="grid grid-cols-2 md:grid-cols-2 gap-4 mt-4">
          <StatCard label="MRR" value={fmt(r.mrr)} icon={TrendingUp} color="blue" sub="Monthly recurring run-rate" />
          <StatCard label="ARR" value={fmt(r.arr)} icon={TrendingUp} color="purple" sub="Annualized recurring run-rate" />
        </div>
      </section>

      <section>
        <h2 className="font-heading text-lg font-semibold mb-4 flex items-center gap-2" data-testid="heading-asset-insights">
          <Wallet size={18} className="text-blue-600" />
          Asset Insights
        </h2>
        <div className="grid md:grid-cols-3 gap-4">
          <div className="bg-card rounded-xl border border-border/50 p-4">
            <h3 className="text-sm font-semibold mb-2">Execution Mix</h3>
            <div className="space-y-1.5 text-sm">
              {(assetInsights.executionMix || []).length === 0 && (
                <p className="text-muted-foreground text-xs">No data</p>
              )}
              {(assetInsights.executionMix || []).map((row: any, idx: number) => (
                <div key={idx} className="flex items-center justify-between">
                  <span className="text-muted-foreground">{row.execution_model || "unknown"}</span>
                  <span className="font-medium">{fmtNum(row.count)}</span>
                </div>
              ))}
            </div>
          </div>
          <div className="bg-card rounded-xl border border-border/50 p-4">
            <h3 className="text-sm font-semibold mb-2">Top Gifted Tickers</h3>
            <div className="space-y-1.5 text-sm">
              {(assetInsights.topGiftedTickers || []).length === 0 && (
                <p className="text-muted-foreground text-xs">No stock-pick gift data</p>
              )}
              {(assetInsights.topGiftedTickers || []).map((row: any, idx: number) => (
                <div key={idx} className="flex items-center justify-between">
                  <span className="font-medium">{row.ticker}</span>
                  <span className="text-muted-foreground">{fmt(row.total_net)} · {fmtNum(row.gift_count)} gifts</span>
                </div>
              ))}
            </div>
          </div>
          <div className="bg-card rounded-xl border border-border/50 p-4">
            <h3 className="text-sm font-semibold mb-2">Holdings Exposure</h3>
            <div className="space-y-1.5 text-sm">
              {(assetInsights.holdingsExposure || []).length === 0 && (
                <p className="text-muted-foreground text-xs">No holdings data</p>
              )}
              {(assetInsights.holdingsExposure || []).map((row: any, idx: number) => (
                <div key={idx} className="flex items-center justify-between">
                  <span className="font-medium">{row.ticker}</span>
                  <span className="text-muted-foreground">{fmt(row.total_value)} · {fmtNum(row.position_count)} positions</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section>
        <h2 className="font-heading text-lg font-semibold mb-4 flex items-center gap-2" data-testid="heading-gift-flow">
          <Gift size={18} className="text-primary" />
          Gift Money Flow
        </h2>
        <div className="bg-card rounded-xl border border-border/50 p-5">
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 text-center">
            <div>
              <p className="text-xs text-muted-foreground mb-1">Total Charged</p>
              <p className="text-xl font-bold">{fmt(chargedForDisplay)}</p>
              <p className="text-xs text-muted-foreground">to gifters</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground mb-1">Gift Amounts</p>
              <p className="text-xl font-bold">{fmt(g.total_gift_volume)}</p>
              <p className="text-xs text-muted-foreground">{fmtNum(g.total_gifts)} gifts (before fees)</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground mb-1">Processing Fees</p>
              <p className="text-xl font-bold text-red-600">{fmt(g.total_processing_fees)}</p>
              <p className="text-xs text-muted-foreground">to Stripe</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground mb-1">Kiddo Platform Fees</p>
              <p className="text-xl font-bold text-green-600">{fmt(g.total_kora_fees)}</p>
              <p className="text-xs text-muted-foreground">Kiddo keeps</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground mb-1">Net to Recipients</p>
              <p className="text-xl font-bold text-blue-600">{fmt(g.total_net_to_recipients)}</p>
              <p className="text-xs text-muted-foreground">invested for kids</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground mb-1">Avg Gift Size</p>
              <p className="text-xl font-bold">{fmt(g.avg_gift_size)}</p>
              <p className="text-xs text-muted-foreground">{fmtNum(g.unique_givers)} unique gifters</p>
            </div>
          </div>
        </div>
      </section>

      <section>
        <h2 className="font-heading text-lg font-semibold mb-4 flex items-center gap-2" data-testid="heading-unit-economics">
          <BarChart3 size={18} className="text-purple-600" />
          Unit Economics
        </h2>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          <StatCard
            label="Platform Revenue"
            value={fmt(ue.platformRevenue)}
            icon={TrendingUp}
            color="green"
            sub="Platform fee + subscriptions + premium events"
          />
          <StatCard
            label="Contribution Margin"
            value={`${Number(ue.estimatedContributionMarginPct || 0).toFixed(2)}%`}
            icon={Activity}
            color={Number(ue.estimatedContributionMarginPct || 0) >= 60 ? "green" : Number(ue.estimatedContributionMarginPct || 0) >= 30 ? "amber" : "red"}
            sub="Estimated, channel-mapped"
          />
          <StatCard label="Processing (Pass-through)" value={fmt(ue.processingPassthroughCollected)} icon={Shield} color="amber" sub="Collected from payers, not Kiddo revenue" />
        </div>
        {/* App-store fee cards (Apple/Google IAP, Store Fees, Net-After-Store)
            and the Revenue Channel Split table were cut 2026-05-28: all $0 /
            single-channel until mobile IAP ships. Re-add from git when mobile
            in-app purchases go live and the channel mix actually splits. */}
      </section>

      <div className="grid md:grid-cols-2 gap-6">
        <section>
          <h2 className="font-heading text-lg font-semibold mb-4 flex items-center gap-2" data-testid="heading-users-overview">
            <Users size={18} />
            Users
          </h2>
          <div className="grid grid-cols-2 gap-3">
            <StatCard label="Total Users" value={fmtNum(u.total_users)} icon={Users} color="blue" onClick={() => goTab("users")} />
            <StatCard label="KYC Verified" value={fmtNum(u.kyc_approved)} icon={Shield} color="green" sub={`${u.kyc_pending} pending, ${u.kyc_none} not started`} onClick={() => goTab("users", { kyc: "approved" })} />
          </div>
        </section>

        <section>
          <h2 className="font-heading text-lg font-semibold mb-4 flex items-center gap-2" data-testid="heading-plans-overview">
            <CreditCard size={18} />
            Plans
          </h2>
          <div className="grid grid-cols-2 gap-3">
            <StatCard label="Free Users" value={fmtNum(s.free_plans)} icon={Users} color="primary" onClick={() => goTab("users", { plan: "free" })} />
            <StatCard label="Paid Plans" value={fmtNum(s.active_paid_plans)} icon={CreditCard} color="purple" sub={`${fmtNum(s.active_family_plans)} family, ${fmtNum(s.active_starter_plans)} starter`} onClick={() => goTab("users", { plan: "paid" })} />
          </div>
        </section>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        <section>
          <h2 className="font-heading text-lg font-semibold mb-4 flex items-center gap-2" data-testid="heading-funds-overview">
            <Wallet size={18} />
            Funds (AUM)
          </h2>
          <div className="grid grid-cols-2 gap-3">
            <StatCard label="Total AUM" value={fmt(f.total_aum)} icon={Wallet} color="green" sub={`${fmtNum(f.total_funds)} funds`} onClick={() => goTab("funds")} />
            <StatCard label="Fund Balance" value={fmt(f.total_invested)} icon={TrendingUp} color="blue" sub={`Pending: ${fmt(f.total_pending)}`} onClick={() => goTab("assets")} />
            <StatCard label="UTMA (Kids)" value={fmtNum(f.utma_funds)} icon={Users} color="amber" sub="Custodial accounts" onClick={() => goTab("funds", { accountType: "UTMA" })} />
            <StatCard label="Personal" value={fmtNum(f.personal_funds)} icon={Wallet} color="primary" sub="Adult accounts" onClick={() => goTab("funds", { accountType: "Personal" })} />
          </div>
        </section>

        <section>
          <h2 className="font-heading text-lg font-semibold mb-4 flex items-center gap-2" data-testid="heading-events-overview">
            <Calendar size={18} />
            Events
          </h2>
          <div className="grid grid-cols-2 gap-3">
            <StatCard label="Total Events" value={fmtNum(e.total_events)} icon={Calendar} color="primary" sub={`${e.active_events} active`} onClick={() => goTab("funds")} />
            <StatCard
              label="Kiddo Occasions"
              value={fmtNum(e.events_with_pass)}
              icon={CreditCard}
              color="amber"
              sub={`${fmt(r.eventPassRevenue)} realized`}
            />
          </div>
        </section>
      </div>

      <section>
        <h2 className="font-heading text-lg font-semibold mb-4 flex items-center gap-2" data-testid="heading-gift-pipeline">
          <Gift size={18} />
          Gift Pipeline
        </h2>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          <StatCard label="Pending" value={fmtNum(g.pending_gifts)} icon={Gift} color="amber" onClick={() => goTab("gifts", { status: "pending" })} />
          <StatCard label="Processing" value={fmtNum(g.processing_gifts)} icon={Gift} color="blue" onClick={() => goTab("gifts", { status: "processing" })} />
          <StatCard label="Invested" value={fmtNum(g.invested_gifts)} icon={TrendingUp} color="green" onClick={() => goTab("gifts", { status: "invested" })} />
          <StatCard label="Settled" value={fmtNum(g.settled_gifts)} icon={Shield} color="primary" onClick={() => goTab("gifts", { status: "settled" })} />
          <StatCard label="Failed" value={fmtNum(g.failed_gifts)} icon={Gift} color="red" onClick={() => goTab("gifts", { status: "failed" })} />
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-3">
          <StatCard
            label="Pending > 1h"
            value={stripeDiagLoading ? "..." : fmtNum(pendingAge?.pending_over_1h)}
            icon={AlertTriangle}
            color={Number(pendingAge?.pending_over_1h || 0) > 0 ? "amber" : "green"}
          />
          <StatCard
            label="Pending > 24h"
            value={stripeDiagLoading ? "..." : fmtNum(pendingAge?.pending_over_24h)}
            icon={AlertTriangle}
            color={Number(pendingAge?.pending_over_24h || 0) > 0 ? "red" : "green"}
          />
          <StatCard
            label="Webhook >10m"
            value={stripeDiagLoading ? "..." : fmtNum(webhookStats?.processing_over_10m)}
            icon={Activity}
            color={Number(webhookStats?.processing_over_10m || 0) > 0 ? "red" : "green"}
          />
          <StatCard
            label="Oldest Processing"
            value={stripeDiagLoading ? "..." : (webhookStats?.oldest_processing_received_at ? fmtDateTime(webhookStats.oldest_processing_received_at) : "-")}
            icon={Calendar}
            color="blue"
            sub="Webhook queue age"
          />
        </div>
      </section>

      <section>
        <h2 className="font-heading text-lg font-semibold mb-4 flex items-center gap-2" data-testid="heading-ux-scorecard">
          <BarChart3 size={18} />
          UX Scorecard (30d)
        </h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <StatCard
            label="Onboarding Completion"
            value={`${onboardingCompletionPct.toFixed(2)}%`}
            icon={Users}
            color="blue"
            sub={`${fmtNum(onboardingUsersWithFund)} / ${fmtNum(onboardingTotalUsers)} users created a fund`}
          />
          <StatCard
            label="Checkout Completion"
            value={`${checkoutStartToCompletePct.toFixed(2)}%`}
            icon={CreditCard}
            color="green"
            sub={`${fmtNum(checkoutCompletes30d)} / ${fmtNum(checkoutStarts30d)} (30d)`}
          />
          <StatCard
            label="Trust Tooltip CTR"
            value={`${trustTooltipCtrPct.toFixed(2)}%`}
            icon={Shield}
            color={trustTooltipOpens > 0 ? "purple" : "amber"}
            sub={`${fmtNum(trustTooltipClicks)} clicks / ${fmtNum(trustTooltipOpens)} opens`}
          />
          <StatCard
            label="Reactivation Recovery"
            value={`${reactivationRecoveryPct.toFixed(2)}%`}
            icon={RefreshCw}
            color={reactivationCanceled > 0 ? "amber" : "blue"}
            sub={`${fmtNum(reactivationRecovered)} recovered / ${fmtNum(reactivationCanceled)} canceled`}
          />
        </div>
        <div className="grid md:grid-cols-3 gap-3 mt-3">
          <PercentBar
            label="Visit ? Share"
            pct={visitToSharePct}
            sub={`${fmtNum(checkoutShares30d)} / ${fmtNum(checkoutVisits30d)}`}
            color="blue"
          />
          <PercentBar
            label="Share ? Checkout Start"
            pct={shareToCheckoutStartPct}
            sub={`${fmtNum(checkoutStarts30d)} / ${fmtNum(checkoutShares30d)}`}
            color="purple"
          />
          <PercentBar
            label="Checkout Start ? Complete"
            pct={checkoutStartToCompletePct}
            sub={`${fmtNum(checkoutCompletes30d)} / ${fmtNum(checkoutStarts30d)}`}
            color="green"
          />
        </div>
      </section>

      <section>
        <h2 className="font-heading text-lg font-semibold mb-4 flex items-center gap-2" data-testid="heading-checkout-diagnostics">
          <CreditCard size={18} />
          Checkout Diagnostics (7d)
        </h2>
        {checkoutDiag?.usedGiftFallback ? (
          <div className="mb-3 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-800">
            Event tracking is partially missing in this window, so checkout metrics are backfilled from successful gift records.
          </div>
        ) : null}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <StatCard label="Checkout Starts" value={checkoutDiagLoading ? "..." : fmtNum(checkoutDiag?.starts)} icon={ArrowUpRight} color="blue" />
          <StatCard label="Checkout Complete" value={checkoutDiagLoading ? "..." : fmtNum(checkoutDiag?.completes)} icon={Shield} color="green" />
          <StatCard label="Abandoned" value={checkoutDiagLoading ? "..." : fmtNum(checkoutDiag?.abandoned)} icon={AlertTriangle} color={Number(checkoutDiag?.abandoned || 0) > 0 ? "amber" : "green"} />
          <StatCard label="Completion Rate" value={checkoutDiagLoading ? "..." : `${Number(checkoutDiag?.completionRatePct || 0).toFixed(2)}%`} icon={TrendingUp} color="primary" />
        </div>
        <div className="grid md:grid-cols-3 gap-3 mt-3">
          <PercentBar
            label="Checkout Start ? Complete"
            pct={Number(checkoutDiag?.completionRatePct || 0)}
            sub={`${fmtNum(checkoutCompletes)} / ${fmtNum(checkoutStarts)}`}
            color="green"
          />
          <PercentBar
            label="Gifts Invested or Settled (7d)"
            pct={checkoutGiftsTotal > 0 ? (checkoutGiftsInvested / checkoutGiftsTotal) * 100 : 0}
            sub={`${fmtNum(checkoutGiftsInvested)} / ${fmtNum(checkoutGiftsTotal)} gift rows`}
            color="blue"
          />
          <PercentBar
            label="Complete Checkout ? Invested"
            pct={investmentsFromCheckoutPct}
            sub={`${fmtNum(checkoutGiftsInvested)} invested vs ${fmtNum(checkoutCompletes)} complete`}
            color="purple"
          />
        </div>
        {checkoutGiftsTotal === 0 && checkoutCompletes > 0 ? (
          <div className="mt-3 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-800">
            Checkout completes were tracked, but no gift rows were found in this 7-day window yet.
            This can happen when gifts land outside the window or finalize after event tracking.
          </div>
        ) : null}
        <div className="bg-card rounded-xl border border-border/50 overflow-hidden mt-3">
          <div className="px-3 py-2 border-b border-border/50 text-sm font-semibold">Top Channels (Checkout)</div>
          <SortableTable
            columns={[
              { key: "channel", label: "Channel", render: (r: any) => <span className="font-medium">{r.channel || "unknown"}</span> },
              { key: "starts", label: "Starts", align: "right", render: (r: any) => fmtNum(r.starts) },
              { key: "completes", label: "Completes", align: "right", render: (r: any) => fmtNum(r.completes) },
              {
                key: "completion_pct",
                label: "Completion",
                align: "right",
                render: (r: any) => {
                  const starts = Number(r.starts || 0);
                  const completes = Number(r.completes || 0);
                  if (starts <= 0 && completes > 0) return "n/a";
                  const pct = starts > 0 ? (completes / starts) * 100 : 0;
                  return `${pct.toFixed(2)}%`;
                },
              },
            ]}
            data={channelRows}
            defaultSort="starts"
          />
        </div>
      </section>

      <section>
        <h2 className="font-heading text-lg font-semibold mb-4 flex items-center gap-2">
          <TrendingUp size={18} className="text-primary" />
          Cohort Retention (12 Weeks)
        </h2>
        {growthCohortsLoading ? (
          <div className="text-sm text-muted-foreground">Loading cohorts...</div>
        ) : (
          <div className="bg-card rounded-xl border border-border/50 overflow-hidden">
            <SortableTable
              columns={[
                { key: "cohort_week", label: "Cohort Week", render: (r: any) => fmtDate(r.cohort_week) },
                { key: "funds_created", label: "Funds", align: "right", render: (r: any) => fmtNum(r.funds_created) },
                { key: "first_gift_7d_count", label: "1st Gift (7d)", align: "right", render: (r: any) => `${fmtNum(r.first_gift_7d_count)} (${Number(r.first_gift_7d_pct || 0).toFixed(1)}%)` },
                { key: "afrg_30d_count", label: "AFRG (30d)", align: "right", render: (r: any) => `${fmtNum(r.afrg_30d_count)} (${Number(r.afrg_30d_pct || 0).toFixed(1)}%)` },
                { key: "paid_14d_after_afrg_count", label: "Paid after AFRG", align: "right", render: (r: any) => `${fmtNum(r.paid_14d_after_afrg_count)} (${Number(r.paid_14d_after_afrg_pct || 0).toFixed(1)}%)` },
              ]}
              data={cohortRows}
              defaultSort="cohort_week"
            />
          </div>
        )}
      </section>

      <section>
        {/* Gifter LTV + Top Gifters cut from Overview (2026-05-28) — they
            duplicated the dedicated Gifters tab. One linking tile instead. */}
        <button
          onClick={() => goTab("gifters")}
          className="w-full bg-card rounded-xl border border-border/50 p-4 flex items-center justify-between gap-3 text-left hover:border-foreground/30 transition-colors"
          data-testid="button-view-all-gifters"
        >
          <span className="flex items-center gap-2 font-heading text-lg font-semibold">
            <Users size={18} /> Gifters
          </span>
          <span className="text-xs text-primary">LTV, top gifters, repeat rate &mdash; view all &rarr;</span>
        </button>
      </section>

      <section>
        <h2 className="font-heading text-lg font-semibold mb-4 flex items-center gap-2" data-testid="heading-pending-by-fund">
          <Wallet size={18} />
          Pending Gifts by Fund
        </h2>
        <div className="bg-card rounded-xl border border-border/50 overflow-hidden">
          <SortableTable
            columns={[
              { key: "fund_name", label: "Fund", render: (r: any) => <span className="font-medium">{r.fund_name}</span> },
              { key: "owner_email", label: "Owner", render: (r: any) => <span className="text-xs text-muted-foreground">{r.owner_email || "-"}</span> },
              { key: "pending_count", label: "Pending", align: "right", render: (r: any) => fmtNum(r.pending_count) },
              { key: "pending_net_amount", label: "Pending Net", align: "right", render: (r: any) => fmt(r.pending_net_amount) },
              { key: "oldest_pending_at", label: "Oldest Pending", render: (r: any) => fmtDateTime(r.oldest_pending_at) },
            ]}
            data={pendingGiftsLoading ? [] : pendingGifts}
            defaultSort="pending_count"
          />
        </div>
      </section>

      <section>
        <h2 className="font-heading text-lg font-semibold mb-4 flex items-center gap-2" data-testid="heading-operations">
          <ArrowUpRight size={18} />
          Operations
        </h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <StatCard label="Sell Volume" value={fmt(tx.sell_volume)} icon={ArrowUpRight} color="red" onClick={() => goTab("transactions", { type: "sell" })} />
          <StatCard label="Withdrawals" value={fmt(tx.withdrawal_volume)} icon={ArrowDownToLine} color="amber" onClick={() => goTab("transactions", { type: "withdrawal" })} />
          <StatCard label="Bank Accounts" value={fmtNum(data.bankAccounts?.total_bank_accounts)} icon={Building2} color="blue" onClick={() => goTab("users")} />
          <StatCard label="Failed Tx" value={fmtNum(tx.failed_transactions)} icon={CreditCard} color="red" onClick={() => goTab("transactions", { status: "failed" })} />
        </div>
      </section>

      <section>
        <h2 className="font-heading text-lg font-semibold mb-4 flex items-center gap-2" data-testid="heading-webhook-events">
          <Activity size={18} />
          Recent Webhook Events
        </h2>
        <div className="bg-card rounded-xl border border-border/50 overflow-hidden">
          <SortableTable
            columns={[
              { key: "receivedAt", label: "Received", render: (r: any) => fmtDateTime(r.receivedAt) },
              { key: "eventType", label: "Event Type", render: (r: any) => <span className="font-mono text-xs">{r.eventType}</span> },
              { key: "status", label: "Status", render: (r: any) => <StatusBadge status={r.status} /> },
              { key: "attempts", label: "Attempts", align: "right", render: (r: any) => fmtNum(r.attempts) },
              { key: "stripeEventId", label: "Stripe Event", render: (r: any) => <span className="font-mono text-xs">{String(r.stripeEventId || "").slice(0, 20)}...</span> },
              { key: "error", label: "Error", render: (r: any) => r.error ? <span className="text-xs text-red-600">{String(r.error).slice(0, 80)}</span> : <span className="text-xs text-muted-foreground">-</span> },
            ]}
            data={safeWebhookEvents}
            defaultSort="receivedAt"
          />
        </div>
      </section>

      <section>
        <h2 className="font-heading text-lg font-semibold mb-4 flex items-center gap-2" data-testid="heading-stripe-diagnostics">
          <AlertTriangle size={18} className="text-amber-600" />
          Stripe Diagnostics (24h)
        </h2>
        {stripeDiagLoading ? (
          <div className="text-sm text-muted-foreground">Loading stripe diagnostics...</div>
        ) : (
          <div className="space-y-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <StatCard
                label="Draft Funds w/ Gifts"
                value={fmtNum(stripeDiag?.summary?.draft_funds_with_gifts)}
                icon={Wallet}
                color={Number(stripeDiag?.summary?.draft_funds_with_gifts || 0) > 0 ? "red" : "green"}
              />
              <StatCard
                label="Gifts Missing Memory"
                value={fmtNum(stripeDiag?.summary?.gifts_without_memory)}
                icon={Gift}
                color={Number(stripeDiag?.summary?.gifts_without_memory || 0) > 0 ? "red" : "green"}
              />
              <StatCard
                label="Gifts Missing Thank-You"
                value={fmtNum(stripeDiag?.summary?.gifts_without_thankyou)}
                icon={Heart}
                color={Number(stripeDiag?.summary?.gifts_without_thankyou || 0) > 0 ? "amber" : "green"}
              />
              <StatCard
                label="Gift Tx Without Gift"
                value={fmtNum(stripeDiag?.summary?.gift_tx_without_gift)}
                icon={CreditCard}
                color={Number(stripeDiag?.summary?.gift_tx_without_gift || 0) > 0 ? "red" : "green"}
              />
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <StatCard
                label="Stripe Reachability"
                value={stripeLiveLoading ? "..." : (!stripeConfigured ? "Not Configured" : (stripeLive?.stripeReachable ? "Connected" : "Offline"))}
                icon={Shield}
                color={!stripeConfigured ? "blue" : (stripeLive?.stripeReachable ? "green" : "red")}
                sub={stripeLive?.keyMode ? `Mode: ${String(stripeLive.keyMode).toUpperCase()}` : "Live API check"}
              />
              <StatCard
                label="Stripe Key Mode"
                value={stripeLiveLoading ? "..." : String(stripeLive?.keyMode || "unknown").toUpperCase()}
                icon={CreditCard}
                color={stripeLive?.keyMode === "live" ? "amber" : "blue"}
                sub="From STRIPE_SECRET_KEY"
              />
              <StatCard
                label="Stripe Available"
                value={stripeLiveLoading ? "..." : fmt(stripeLive?.availableUsd || 0)}
                icon={Wallet}
                color="green"
                sub="Stripe balance (USD available)"
              />
              <StatCard
                label="Stripe Pending"
                value={stripeLiveLoading ? "..." : fmt(stripeLive?.pendingUsd || 0)}
                icon={Activity}
                color="amber"
                sub="Stripe balance (USD pending)"
              />
            </div>

            <div className="bg-card rounded-xl border border-border/50 overflow-hidden">
              <SortableTable
                columns={[
                  { key: "receivedAt", label: "Received", render: (r: any) => fmtDateTime(r.receivedAt) },
                  { key: "eventType", label: "Event Type", render: (r: any) => <span className="font-mono text-xs">{r.eventType}</span> },
                  { key: "attempts", label: "Attempts", align: "right", render: (r: any) => fmtNum(r.attempts) },
                  { key: "stripeEventId", label: "Stripe Event", render: (r: any) => <span className="font-mono text-xs">{String(r.stripeEventId || "").slice(0, 24)}...</span> },
                  { key: "error", label: "Error", render: (r: any) => <span className="text-xs text-red-600">{String(r.error || "").slice(0, 120)}</span> },
                ]}
                data={stripeDiag?.failedWebhooks || []}
                defaultSort="receivedAt"
              />
            </div>
          </div>
        )}
      </section>
    </div>
  );
}

function GrowthTab() {
  const [windowDays, setWindowDays] = useState<7 | 30 | 90>(30);
  const [detailTouchpoint, setDetailTouchpoint] = useState<string | null>(null);
  const { data, isLoading, isError, error } = useQuery<any>({
    queryKey: ["/api/admin/growth", windowDays],
    queryFn: async () => fetchAdminJson(`/api/admin/growth?days=${windowDays}`),
    refetchInterval: 30000,
    refetchOnWindowFocus: true,
    retry: 1,
  });

  if (isLoading) return <div className="text-center py-12 text-muted-foreground">Loading growth data...</div>;
  if (isError) return <div className="text-center py-12 text-muted-foreground">Could not load growth data. {(error as any)?.message || ""}</div>;

  const totals = data?.totals || {};
  const rates = data?.rates || {};
  const dataQuality = data?.dataQuality || {};
  const gifterLoopRows = Array.isArray(data?.gifterLoop?.rows) ? data.gifterLoop.rows : [];
  const totalLoopVisits = gifterLoopRows.reduce((sum: number, row: any) => sum + Number(row?.visits || 0), 0);
  const totalLoopClicks = gifterLoopRows.reduce((sum: number, row: any) => sum + Number(row?.ctaClicks || 0), 0);
  const totalLoopSignups = gifterLoopRows.reduce((sum: number, row: any) => sum + Number(row?.signups || 0), 0);
  const topLoopTouchpoint = [...gifterLoopRows].sort((a: any, b: any) => {
    const signupDelta = Number(b?.signups || 0) - Number(a?.signups || 0);
    if (signupDelta !== 0) return signupDelta;
    return Number(b?.clickToSignupPct || 0) - Number(a?.clickToSignupPct || 0);
  })[0];
  const lowestLoopTouchpoint = [...gifterLoopRows]
    .filter((row: any) => Number(row?.visits || 0) > 0)
    .sort((a: any, b: any) => {
      const signupDelta = Number(a?.signups || 0) - Number(b?.signups || 0);
      if (signupDelta !== 0) return signupDelta;
      return Number(a?.clickToSignupPct || 0) - Number(b?.clickToSignupPct || 0);
    })[0];
  const series = Array.isArray(data?.series) ? data.series : [];
  const chartSeries = series.map((r: any) => ({
    day: new Date(r.day).toLocaleDateString("en-US", { month: "short", day: "numeric" }),
    starts: Number(r.checkoutStarts || 0),
    completes: Number(r.checkoutCompletes || 0),
    invested: Number(r.giftsInvested || 0),
  }));

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <h2 className="font-heading text-lg font-semibold">Growth Funnel (Last {windowDays} Days)</h2>
        <div className="inline-flex w-fit rounded-xl border border-border/60 bg-card p-1">
          {[7, 30, 90].map((days) => {
            const active = windowDays === days;
            return (
              <button
                key={days}
                type="button"
                onClick={() => setWindowDays(days as 7 | 30 | 90)}
                className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
                  active ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:bg-muted hover:text-foreground"
                }`}
              >
                {days}d
              </button>
            );
          })}
        </div>
      </div>
      {dataQuality.usedGiftFallback ? (
        <div className="bg-amber-50 border border-amber-200 rounded-xl px-3 py-2 text-xs text-amber-800">
          Referral checkout events are sparse in this window, so starts/completes are backfilled from successful gifts to avoid false zeros.
        </div>
      ) : null}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <StatCard label="Checkout Starts" value={fmtNum(totals.checkoutStarts || 0)} icon={ArrowUpRight} color="blue" />
        <StatCard label="Checkout Complete" value={fmtNum(totals.checkoutCompletes || 0)} icon={CreditCard} color="primary" />
        <StatCard label="Gifts Invested" value={fmtNum(totals.giftsInvested || 0)} icon={Gift} color="green" />
        <StatCard label="Start -> Complete" value={`${Number(rates.startToCompletePct || 0).toFixed(2)}%`} icon={TrendingUp} color="amber" />
        <StatCard label="Complete -> Invested" value={`${Number(rates.completeToInvestedPct || 0).toFixed(2)}%`} icon={Activity} color="purple" />
      </div>
      <div className="bg-card rounded-xl border border-border/50 p-4">
        <h3 className="text-sm font-semibold mb-2">Daily Funnel Trend</h3>
        <ChartContainer
          className="h-[260px] w-full"
          config={{
            starts: { label: "Starts", color: "hsl(var(--chart-3))" },
            completes: { label: "Completes", color: "hsl(var(--chart-2))" },
            invested: { label: "Invested", color: "hsl(var(--chart-1))" },
          }}
        >
          <AreaChart data={chartSeries} margin={{ top: 8, right: 8, left: 8, bottom: 0 }}>
            <CartesianGrid vertical={false} />
            <XAxis dataKey="day" tickLine={false} axisLine={false} minTickGap={24} />
            <ChartTooltip content={<ChartTooltipContent />} />
            <Area type="monotone" dataKey="starts" stroke="var(--color-starts)" fill="var(--color-starts)" fillOpacity={0.12} strokeWidth={2} />
            <Area type="monotone" dataKey="completes" stroke="var(--color-completes)" fill="var(--color-completes)" fillOpacity={0.12} strokeWidth={2} />
            <Area type="monotone" dataKey="invested" stroke="var(--color-invested)" fill="var(--color-invested)" fillOpacity={0.18} strokeWidth={2} />
          </AreaChart>
        </ChartContainer>
      </div>

      <div className="bg-card rounded-xl border border-border/50 overflow-hidden">
        <div className="px-4 py-3 border-b border-border/50">
          <h3 className="text-sm font-semibold">Gifter -&gt; Parent Loop</h3>
          <p className="mt-1 text-xs text-muted-foreground">How warm gifter touchpoints are turning into parent signups over the last {windowDays} days.</p>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 p-4 border-b border-border/50 bg-muted/10">
          <StatCard
            label="Loop Visits"
            value={fmtNum(totalLoopVisits)}
            sub="Warm starts into parent onboarding"
            icon={Eye}
            color="blue"
          />
          <StatCard
            label="Loop Clicks"
            value={fmtNum(totalLoopClicks)}
            sub="CTA clicks across gifter touchpoints"
            icon={ArrowUpRight}
            color="amber"
          />
          <StatCard
            label="Loop Signups"
            value={fmtNum(totalLoopSignups)}
            sub="Parent accounts started from the loop"
            icon={Users}
            color="green"
          />
          <StatCard
            label="Top Touchpoint"
            value={formatLoopTouchpointLabel(topLoopTouchpoint?.touchpoint)}
            sub={topLoopTouchpoint ? `${fmtNum(topLoopTouchpoint?.signups || 0)} signups` : "No loop conversions yet"}
            icon={TrendingUp}
            color="purple"
            onClick={topLoopTouchpoint?.touchpoint ? () => setDetailTouchpoint(String(topLoopTouchpoint.touchpoint)) : undefined}
          />
        </div>
        <SortableTable
          columns={[
            {
              key: "touchpoint",
              label: "Touchpoint",
              render: (r: any) => {
                const isTop = String(r?.touchpoint || "") === String(topLoopTouchpoint?.touchpoint || "");
                const isLowest = String(r?.touchpoint || "") === String(lowestLoopTouchpoint?.touchpoint || "");
                return (
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      className="font-medium text-left hover:text-primary transition-colors"
                      onClick={() => setDetailTouchpoint(String(r.touchpoint || "unknown"))}
                    >
                      {formatLoopTouchpointLabel(r.touchpoint)}
                    </button>
                    {isTop ? <StatusBadge status="top" map={{ top: "bg-green-100 text-green-700" }} /> : null}
                    {!isTop && isLowest ? <StatusBadge status="watch" map={{ watch: "bg-amber-100 text-amber-700" }} /> : null}
                  </div>
                );
              },
            },
            { key: "visits", label: "Visits", align: "right", render: (r: any) => fmtNum(r.visits) },
            { key: "ctaClicks", label: "Clicks", align: "right", render: (r: any) => fmtNum(r.ctaClicks) },
            { key: "signups", label: "Signups", align: "right", render: (r: any) => fmtNum(r.signups) },
            { key: "visitToSignupPct", label: "Visit -> Signup", align: "right", render: (r: any) => `${Number(r.visitToSignupPct || 0).toFixed(2)}%` },
            { key: "clickToSignupPct", label: "Click -> Signup", align: "right", render: (r: any) => `${Number(r.clickToSignupPct || 0).toFixed(2)}%` },
          ]}
          data={gifterLoopRows}
          defaultSort="signups"
        />
      </div>
      {detailTouchpoint ? (
        <LoopTouchpointModal
          touchpoint={detailTouchpoint}
          days={windowDays}
          onClose={() => setDetailTouchpoint(null)}
        />
      ) : null}
    </div>
  );
}

// Read directly from analytics_events. Two funnels: parent activation
// (signup → fund_created → first share visit → first gift completed)
// and gifter conversion (visit → gift_started → gift_completed).
//
// Why a separate tab from Growth: GrowthTab measures the legacy
// referral checkout funnel (still useful for marketing pixels).
// FunnelsTab measures the first-party event store, which is the
// source of truth going forward.
function FunnelsTab() {
  const [windowDays, setWindowDays] = useState<7 | 30 | 90 | 0>(30);
  const { data, isLoading, isError, error } = useQuery<any>({
    queryKey: ["/api/admin/funnels", windowDays],
    queryFn: async () => fetchAdminJson(`/api/admin/funnels?days=${windowDays}`),
    refetchInterval: 60_000,
    refetchOnWindowFocus: true,
    retry: 1,
  });

  if (isLoading) return <div className="text-center py-12 text-muted-foreground">Loading funnels...</div>;
  if (isError) return <div className="text-center py-12 text-muted-foreground">Could not load funnels. {(error as any)?.message || ""}</div>;

  const parent = data?.parent || { steps: [], dropoffs: [], medianHours: {} };
  const gifter = data?.gifter || { steps: [], dropoffs: [], medianMinutes: {} };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h2 className="font-heading text-lg font-semibold">Activation Funnels</h2>
          <p className="text-xs text-muted-foreground mt-1">
            From the first-party event store. Parent funnel keys on user id; gifter funnel keys on fund id + visitor IP.
          </p>
        </div>
        <div className="inline-flex w-fit rounded-xl border border-border/60 bg-card p-1">
          {([7, 30, 90, 0] as const).map((days) => {
            const active = windowDays === days;
            return (
              <button
                key={days}
                type="button"
                onClick={() => setWindowDays(days)}
                className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
                  active ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:bg-muted hover:text-foreground"
                }`}
              >
                {days === 0 ? "All time" : `${days}d`}
              </button>
            );
          })}
        </div>
      </div>

      <KFactorCard />

      <FunnelCard
        title="Parent activation"
        subtitle="Signup to first received gift on the parent's first fund."
        steps={parent.steps}
        dropoffs={parent.dropoffs}
        medianRows={[
          { label: "Median signup → first fund", value: formatHours(parent.medianHours?.signupToFund) },
          { label: "Median first fund → first share visit", value: formatHours(parent.medianHours?.fundToShare) },
          { label: "Median first fund → first gift", value: formatHours(parent.medianHours?.fundToGift) },
        ]}
      />

      <FunnelCard
        title="Gifter conversion"
        subtitle="Per-fund gift link visit to completed gift. Visit dedupe is by IP per fund."
        steps={gifter.steps}
        dropoffs={gifter.dropoffs}
        medianRows={[
          { label: "Median visit → gift started", value: formatMinutes(gifter.medianMinutes?.visitToStart) },
        ]}
      />

      <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 text-xs text-amber-900">
        <strong>Note:</strong> events were instrumented this session. Funnel
        numbers will look thin until traffic re-accumulates. The {windowDays === 0 ? "all-time" : `last ${windowDays}d`} window
        is honest, not adjusted.
      </div>
    </div>
  );
}

// The gifter-loop k-factor — the single number that decides whether acquisition
// compounds (≥1 = self-sustaining) or whether we're EarlyBird in nicer clothes.
// Business-state, all-time, from /api/admin/k-factor (independent of the window
// toggle above). See the endpoint's caveats: pre-launch volumes are tiny, treat
// as directional.
function KFactorCard() {
  const { data, isLoading, isError } = useQuery<any>({
    queryKey: ["/api/admin/k-factor"],
    queryFn: async () => fetchAdminJson(`/api/admin/k-factor`),
    refetchInterval: 60_000,
    retry: 1,
  });
  if (isLoading) {
    return <div className="bg-card rounded-xl border border-border/50 px-4 py-6 text-center text-xs text-muted-foreground">Loading k-factor…</div>;
  }
  if (isError || !data) return null;
  const k = data.kFactor || {};
  const reach = data.reach || {};
  const conv = data.conversion || {};
  const gifter = data.gifterDriven || {};
  const occasions = Array.isArray(data.byOccasion) ? data.byOccasion : [];
  const strict = Number(k.strict ?? 0);
  const broad = Number(k.broad ?? 0);
  const strong = strict >= 1;
  return (
    <div className="bg-card rounded-xl border border-border/50 overflow-hidden">
      <div className="px-4 py-3 border-b border-border/50">
        <h3 className="text-sm font-semibold">Gifter-loop k-factor</h3>
        <p className="mt-1 text-xs text-muted-foreground">
          All-time, business-state (gifts/funds). The number that decides whether acquisition compounds. {k.formula}
        </p>
      </div>
      <div className="p-4">
        <div className="flex items-end gap-3">
          <div className={`font-mono text-4xl font-bold ${strong ? "text-emerald-600" : "text-foreground"}`}>{strict.toFixed(2)}</div>
          <div className="pb-1 text-xs text-muted-foreground">strict k (true loop) · broad k {broad.toFixed(2)}</div>
        </div>
        {k.interpretation ? (
          <p className={`mt-2 text-xs ${strong ? "text-emerald-700" : "text-amber-700"}`}>{k.interpretation}</p>
        ) : null}
        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4 text-xs">
          <KStat label="Gifts / fund" value={Number(reach.giftsPerFund ?? 0).toFixed(2)} />
          <KStat label="Gifters / fund" value={Number(reach.giftersPerFund ?? 0).toFixed(2)} />
          <KStat label="Gifter→funded parent" value={`${Number(conv.strictConversionPct ?? 0).toFixed(1)}%`} />
          <KStat label="Distinct gifters" value={fmtNum(Number(reach.distinctGifters ?? 0))} />
        </div>

        <div className="mt-4 border-t border-border/50 pt-4">
          <div className="text-[10px] uppercase tracking-wide text-muted-foreground mb-2">Gifter-driven acquisition (the unpaid salesforce)</div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 text-xs">
            <KStat label="Gifter-acquired parents" value={fmtNum(Number(gifter.acquiredParents ?? 0))} />
            <KStat label="…that funded (full loop)" value={fmtNum(Number(gifter.acquiredParentsFunded ?? 0))} />
            <KStat label="Multi-family gifters" value={fmtNum(Number(gifter.multiFundGifters ?? 0))} />
          </div>
        </div>

        {occasions.length > 0 ? (
          <div className="mt-4 border-t border-border/50 pt-4">
            <div className="text-[10px] uppercase tracking-wide text-muted-foreground mb-2">Which occasions spin the loop (gifters per fund)</div>
            <div className="space-y-1">
              {occasions.map((o: any, i: number) => (
                <div key={i} className="flex items-center justify-between gap-3 text-xs">
                  <span className="font-medium capitalize">{String(o.occasion || "unspecified").replace(/_/g, " ")}</span>
                  <span className="font-mono text-muted-foreground">
                    {Number(o.giftersPerFund ?? 0).toFixed(2)} gifters/fund · {fmtNum(Number(o.gifters ?? 0))} gifters · {fmtNum(Number(o.funds ?? 0))} funds
                  </span>
                </div>
              ))}
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}

function KStat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-lg border border-border/50 bg-muted/10 px-3 py-2">
      <div className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="mt-0.5 font-mono text-sm">{value}</div>
    </div>
  );
}

function FunnelCard({
  title,
  subtitle,
  steps,
  dropoffs,
  medianRows,
}: {
  title: string;
  subtitle: string;
  steps: Array<{ name: string; count: number; pctOfStart: number }>;
  dropoffs: Array<{ from: string; to: string; dropPct: number }>;
  medianRows: Array<{ label: string; value: string }>;
}) {
  const startCount = steps[0]?.count || 0;
  return (
    <div className="bg-card rounded-xl border border-border/50 overflow-hidden">
      <div className="px-4 py-3 border-b border-border/50">
        <h3 className="text-sm font-semibold">{title}</h3>
        <p className="mt-1 text-xs text-muted-foreground">{subtitle}</p>
      </div>
      <div className="p-4 space-y-3">
        {steps.map((step, i) => {
          const widthPct = startCount > 0 ? Math.max(2, (step.count / startCount) * 100) : 2;
          return (
            <div key={i} className="space-y-1">
              <div className="flex items-baseline justify-between gap-3 text-sm">
                <span className="font-medium">{step.name}</span>
                <span className="font-mono text-xs text-muted-foreground">
                  {fmtNum(step.count)}{i > 0 ? ` · ${step.pctOfStart.toFixed(1)}%` : ""}
                </span>
              </div>
              <div className="h-2 rounded bg-muted overflow-hidden">
                <div
                  className="h-full bg-primary transition-all"
                  style={{ width: `${widthPct}%` }}
                />
              </div>
              {i < dropoffs.length ? (
                <div className="text-xs text-muted-foreground pl-2 italic">
                  ↓ {dropoffs[i].dropPct.toFixed(1)}% drop {dropoffs[i].from} → {dropoffs[i].to}
                </div>
              ) : null}
            </div>
          );
        })}
      </div>
      {medianRows.length > 0 ? (
        <div className="border-t border-border/50 px-4 py-3 bg-muted/10 text-xs">
          {medianRows.map((row, i) => (
            <div key={i} className="flex justify-between gap-3 py-0.5">
              <span className="text-muted-foreground">{row.label}</span>
              <span className="font-mono">{row.value}</span>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function formatHours(h: any): string {
  const n = Number(h);
  if (!Number.isFinite(n) || n <= 0) return "—";
  if (n < 1) return `${Math.round(n * 60)}m`;
  if (n < 48) return `${n.toFixed(1)}h`;
  return `${(n / 24).toFixed(1)}d`;
}

function formatMinutes(m: any): string {
  const n = Number(m);
  if (!Number.isFinite(n) || n <= 0) return "—";
  if (n < 60) return `${n.toFixed(1)}m`;
  return `${(n / 60).toFixed(1)}h`;
}

// Quarterly access review surface — see policies/access-control.md §5.
// Lists every admin/super-admin user with last activity. Reviewer
// confirms each row, captures notes, and saves a snapshot to
// incidents/access-reviews/YYYY-Q#.md per the policy.
//
// MFA status reads as "—" for everyone today because we don't have
// MFA wired. The honest answer is "unknown for everyone" rather than
// pretending the column is informative.
function AccessReviewTab() {
  const { data, isLoading, isError, error } = useQuery<any>({
    queryKey: ["/api/admin/access-review"],
    queryFn: async () => fetchAdminJson("/api/admin/access-review"),
    refetchInterval: 60_000,
    refetchOnWindowFocus: true,
    retry: 1,
  });

  if (isLoading) return <div className="text-center py-12 text-muted-foreground">Loading access review...</div>;
  if (isError) return <div className="text-center py-12 text-muted-foreground">Could not load access review. {(error as any)?.message || ""}</div>;

  const summary = data?.summary || {};
  const rows: any[] = data?.rows || [];
  const policyRef = data?.policyReference || {};

  const exportSnapshot = () => {
    // Capture the current view as Markdown for the quarterly evidence
    // file. Exact format mirrors what the policy says to save.
    const reviewedAt = new Date().toISOString();
    const quarter = `${reviewedAt.slice(0, 4)}-Q${Math.ceil((new Date().getUTCMonth() + 1) / 3)}`;
    const lines = [
      `# Access Review · ${quarter}`,
      "",
      `**Reviewed at:** ${reviewedAt}`,
      `**Reviewer:** [fill in]`,
      `**Policy:** ${policyRef.policy || "policies/access-control.md"} ${policyRef.section || ""}`,
      "",
      "## Summary",
      "",
      `- Total admin accounts: ${summary.totalAdminAccounts || 0}`,
      `- Total super-admin accounts: ${summary.totalSuperAdminAccounts || 0}`,
      `- Accounts needing review: ${summary.accountsNeedingReview || 0}`,
      `- MFA-verified accounts: 0 (capability not yet wired; see SECURITY.md §6)`,
      "",
      "## Rows",
      "",
      "| Email | Role | Last login | Last action | 90d actions | Needs review | Reason |",
      "|---|---|---|---|---|---|---|",
      ...rows.map((r) =>
        `| ${r.email || "—"} | ${r.isSuperAdmin ? "super-admin" : "admin"} | ${r.lastLoginAt || "—"} | ${r.lastAdminActionAt || "—"} | ${r.actions90d ?? 0} | ${r.needsReview ? "YES" : "no"} | ${r.reviewReason || ""} |`,
      ),
      "",
      "## Reviewer notes",
      "",
      "[fill in: per-row decisions, MFA verification results, follow-up actions]",
      "",
      "## Sign-off",
      "",
      "- Reviewer: [name], [date]",
      "- Founder: [name], [date]",
      "",
    ];
    const blob = new Blob([lines.join("\n")], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `access-review-${quarter}.md`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div className="max-w-2xl">
          <h2 className="font-heading text-lg font-semibold">Access Review</h2>
          <p className="text-xs text-muted-foreground mt-1">
            Quarterly review of every account with admin or super-admin
            privileges. Per <code className="text-xs">policies/access-control.md</code> §5,
            save the export to <code className="text-xs">incidents/access-reviews/YYYY-Q#.md</code>.
          </p>
        </div>
        <button
          type="button"
          onClick={exportSnapshot}
          className="inline-flex items-center gap-2 rounded-xl border border-border/60 bg-card px-4 py-2 text-sm font-medium hover:bg-muted"
          data-testid="button-access-review-export"
        >
          Export snapshot for quarter
        </button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard label="Admin accounts" value={fmtNum(summary.totalAdminAccounts || 0)} icon={Shield} color="blue" />
        <StatCard label="Super-admin accounts" value={fmtNum(summary.totalSuperAdminAccounts || 0)} icon={Shield} color="purple" />
        <StatCard label="Accounts needing review" value={fmtNum(summary.accountsNeedingReview || 0)} icon={AlertTriangle} color={summary.accountsNeedingReview > 0 ? "amber" : "green"} />
      </div>

      <div className="bg-card rounded-xl border border-border/50 overflow-hidden">
        <div className="px-4 py-3 border-b border-border/50">
          <h3 className="text-sm font-semibold">Privileged accounts</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/30 text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-4 py-2 text-left">Email</th>
                <th className="px-4 py-2 text-left">Role</th>
                <th className="px-4 py-2 text-left">Last login</th>
                <th className="px-4 py-2 text-left">Last action</th>
                <th className="px-4 py-2 text-right">90d actions</th>
                <th className="px-4 py-2 text-left">Status</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-6 text-center text-muted-foreground">No admin accounts.</td>
                </tr>
              ) : (
                rows.map((r) => (
                  <tr key={r.userId} className={`border-t border-border/30 ${r.needsReview ? "bg-amber-50/40" : ""}`}>
                    <td className="px-4 py-2 font-mono text-xs">{r.email || "—"}</td>
                    <td className="px-4 py-2">
                      <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${r.isSuperAdmin ? "bg-purple-100 text-purple-700" : "bg-blue-100 text-blue-700"}`}>
                        {r.isSuperAdmin ? "super-admin" : "admin"}
                      </span>
                    </td>
                    <td className="px-4 py-2 font-mono text-xs">{r.lastLoginAt ? new Date(r.lastLoginAt).toLocaleString() : "—"}</td>
                    <td className="px-4 py-2 font-mono text-xs">{r.lastAdminActionAt ? new Date(r.lastAdminActionAt).toLocaleString() : "—"}</td>
                    <td className="px-4 py-2 text-right font-mono text-xs">{r.actions90d ?? 0}</td>
                    <td className="px-4 py-2 text-xs">
                      {r.needsReview ? (
                        <span className="inline-flex items-center gap-1 text-amber-700">
                          <AlertTriangle size={12} />
                          {r.reviewReason || "Review needed"}
                        </span>
                      ) : (
                        <span className="text-green-700">Active</span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="bg-cream/30 border border-border/40 rounded-xl px-4 py-3 text-xs text-muted-foreground">
        <p className="mb-2">
          <strong>How to use this surface:</strong> per <code>policies/access-control.md</code> §5,
          run this review at the end of each calendar quarter. For each
          row marked "Review needed," confirm the account should retain
          admin access. Manually verify MFA in the relevant downstream
          system (Supabase, Stripe, GitHub) since we don't have a
          unified MFA registry today.
        </p>
        <p>
          Export the snapshot above and save it to <code>incidents/access-reviews/YYYY-Q#.md</code>
          with reviewer notes. Retention: 7 years per <code>policies/incident-response.md</code> §7.
        </p>
      </div>
    </div>
  );
}

function ConfigTab({ isSuperAdmin }: { isSuperAdmin: boolean }) {
  // Synced 2026-05-25 with the server's actual ADMIN_ASSET_UNIVERSE.
  // Prior fallback had 8 stocks (DIS/AAPL/NKE/TSLA/NFLX/RBLX/SBUX/AMZN)
  // AND incorrectly marked TSLA as source='stock_pick' — but Tesla is
  // NOT in the server's picker universe. Removed TSLA; added the
  // missing 9 (SPOT, GOOGL, TGT, CMCSA, DUOL, ABNB, NTDOY, DPZ, CHWY,
  // ADBE). This is purely a FALLBACK shown when /api/admin/config/
  // investments fails to load — the real source of truth lives
  // server-side in server/marketQuotes.ts. Keeping it accurate so
  // admins debugging a load failure see the canonical list, not a
  // stale snapshot.
  const DEFAULT_UNIVERSE: Record<string, any> = {
    VTI: { name: "Vanguard Total Stock Market ETF", type: "ETF", source: "auto_invest", enabled: true },
    VXUS: { name: "Vanguard Total International Stock ETF", type: "ETF", source: "auto_invest", enabled: true },
    BND: { name: "Vanguard Total Bond Market ETF", type: "ETF", source: "auto_invest", enabled: true },
    VGT: { name: "Vanguard Information Technology ETF", type: "ETF", source: "auto_invest", enabled: true },
    VUG: { name: "Vanguard Growth ETF", type: "ETF", source: "auto_invest", enabled: true },
    VYM: { name: "Vanguard High Dividend Yield ETF", type: "ETF", source: "auto_invest", enabled: true },
    SCHD: { name: "Schwab US Dividend Equity ETF", type: "ETF", source: "auto_invest", enabled: true },
    QQQ: { name: "Invesco QQQ Trust", type: "ETF", source: "auto_invest", enabled: true },
    DIS: { name: "Disney", type: "Stock", source: "stock_pick", enabled: true },
    AAPL: { name: "Apple", type: "Stock", source: "stock_pick", enabled: true },
    NKE: { name: "Nike", type: "Stock", source: "stock_pick", enabled: true },
    NFLX: { name: "Netflix", type: "Stock", source: "stock_pick", enabled: true },
    RBLX: { name: "Roblox", type: "Stock", source: "stock_pick", enabled: true },
    SBUX: { name: "Starbucks", type: "Stock", source: "stock_pick", enabled: true },
    AMZN: { name: "Amazon", type: "Stock", source: "stock_pick", enabled: true },
    GOOGL: { name: "Google", type: "Stock", source: "stock_pick", enabled: true },
    SPOT: { name: "Spotify", type: "Stock", source: "stock_pick", enabled: true },
    TGT: { name: "Target", type: "Stock", source: "stock_pick", enabled: true },
    CMCSA: { name: "Comcast", type: "Stock", source: "stock_pick", enabled: true },
    DUOL: { name: "Duolingo", type: "Stock", source: "stock_pick", enabled: true },
    ABNB: { name: "Airbnb", type: "Stock", source: "stock_pick", enabled: true },
    NTDOY: { name: "Nintendo", type: "Stock", source: "stock_pick", enabled: true },
    DPZ: { name: "Domino's", type: "Stock", source: "stock_pick", enabled: true },
    CHWY: { name: "Chewy", type: "Stock", source: "stock_pick", enabled: true },
    ADBE: { name: "Adobe", type: "Stock", source: "stock_pick", enabled: true },
  };
  const DEFAULT_AUTO_STRATEGIES: Record<string, any> = {
    growth: { label: "Growth Mix", allocations: { VTI: 0.62, VXUS: 0.28, BND: 0.10 } },
    balanced: { label: "Balanced Mix", allocations: { VTI: 0.50, VXUS: 0.25, BND: 0.25 } },
    conservative: { label: "Conservative Mix", allocations: { VTI: 0.42, VXUS: 0.18, BND: 0.40 } },
  };
  const queryClient = useQueryClient();
  const { data, isLoading, isError, error } = useQuery<any>({
    queryKey: ["/api/admin/config/investments"],
    queryFn: async () => fetchAdminJson("/api/admin/config/investments"),
    refetchOnWindowFocus: true,
  });
  const { data: historyPayload, isLoading: historyLoading } = useQuery<any>({
    queryKey: ["/api/admin/config/investments/history?limit=50"],
    queryFn: async () => fetchAdminJson("/api/admin/config/investments/history?limit=50"),
    refetchOnWindowFocus: true,
  });
  const [universe, setUniverse] = useState<Record<string, any>>({});
  const [autoStrategies, setAutoStrategies] = useState<Record<string, any>>({});
  const [dirty, setDirty] = useState(false);
  const [newTicker, setNewTicker] = useState("");
  const [newStrategy, setNewStrategy] = useState("");
  const [saveNotice, setSaveNotice] = useState<{ type: "success" | "error"; text: string } | null>(null);

  useEffect(() => {
    if (!data) return;
    const nextUniverse = (data.universe && Object.keys(data.universe).length > 0) ? data.universe : DEFAULT_UNIVERSE;
    const nextStrategies = (data.autoStrategies && Object.keys(data.autoStrategies).length > 0) ? data.autoStrategies : DEFAULT_AUTO_STRATEGIES;
    setUniverse(nextUniverse);
    setAutoStrategies(nextStrategies);
    setDirty(false);
    setSaveNotice(null);
  }, [data]);

  const patchMutation = useMutation({
    mutationFn: async (payload: any) => {
      const res = await fetch("/api/admin/config/investments", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(payload),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body?.error || "Failed to save config");
      return body;
    },
    onSuccess: async () => {
      setDirty(false);
      setSaveNotice({ type: "success", text: "Investment config saved successfully." });
      await queryClient.invalidateQueries({ queryKey: ["/api/admin/config/investments"] });
      await queryClient.invalidateQueries({ queryKey: ["/api/admin/assets"] });
    },
    onError: (err: any) => {
      setSaveNotice({ type: "error", text: err?.message || "Failed to save config." });
    },
  });

  if (isLoading) return <div className="text-center py-12 text-muted-foreground">Loading config...</div>;
  if (isError) return <div className="text-center py-12 text-muted-foreground">Could not load config. {(error as any)?.message || ""}</div>;

  const updateUniverse = (ticker: string, patch: Record<string, unknown>) => {
    setUniverse((prev) => ({ ...prev, [ticker]: { ...(prev[ticker] || {}), ...patch } }));
    setDirty(true);
  };
  const removeUniverse = (ticker: string) => {
    setUniverse((prev) => {
      const copy = { ...prev };
      delete copy[ticker];
      return copy;
    });
    setDirty(true);
  };
  const addUniverseTicker = () => {
    const ticker = newTicker.trim().toUpperCase();
    if (!ticker) return;
    if (universe[ticker]) return;
    setUniverse((prev) => ({
      ...prev,
      [ticker]: { name: ticker, type: "Stock", source: "stock_pick", enabled: true },
    }));
    setNewTicker("");
    setDirty(true);
  };

  const allocationsToText = (alloc: Record<string, number>) =>
    Object.entries(alloc || {})
      .map(([t, w]) => `${t}:${Number(w || 0).toFixed(4)}`)
      .join(", ");
  const textToAllocations = (text: string): Record<string, number> => {
    const out: Record<string, number> = {};
    for (const part of String(text || "").split(",")) {
      const [tickerRaw, weightRaw] = part.split(":").map((x) => String(x || "").trim());
      const ticker = tickerRaw.toUpperCase();
      const weight = Number(weightRaw);
      if (!ticker || !Number.isFinite(weight) || weight <= 0) continue;
      out[ticker] = weight;
    }
    return out;
  };
  const updateStrategy = (key: string, patch: Record<string, unknown>) => {
    setAutoStrategies((prev) => ({ ...prev, [key]: { ...(prev[key] || {}), ...patch } }));
    setDirty(true);
  };
  const removeStrategy = (key: string) => {
    setAutoStrategies((prev) => {
      const copy = { ...prev };
      delete copy[key];
      return copy;
    });
    setDirty(true);
  };
  const addStrategy = () => {
    const key = newStrategy.trim().toLowerCase();
    if (!key) return;
    if (autoStrategies[key]) return;
    setAutoStrategies((prev) => ({
      ...prev,
      [key]: { label: key, allocations: { VTI: 0.62, VXUS: 0.28, BND: 0.10 } },
    }));
    setNewStrategy("");
    setDirty(true);
  };

  const getAllocRows = (allocations: Record<string, number> | undefined | null) =>
    Object.entries(allocations || {}).map(([ticker, weight]) => ({
      ticker: String(ticker || "").toUpperCase(),
      weightPct: Number(weight || 0) * 100,
    }));

  const setAllocRows = (strategyKey: string, rows: Array<{ ticker: string; weightPct: number }>) => {
    const next: Record<string, number> = {};
    for (const row of rows) {
      const ticker = String(row.ticker || "").trim().toUpperCase();
      const pct = Number(row.weightPct || 0);
      if (!ticker) continue;
      if (!Number.isFinite(pct) || pct <= 0) continue;
      next[ticker] = pct / 100;
    }
    updateStrategy(strategyKey, { allocations: next });
  };

  const normalizeAllocRows = (strategyKey: string) => {
    const rows = getAllocRows(autoStrategies[strategyKey]?.allocations || {});
    const total = rows.reduce((s, r) => s + Number(r.weightPct || 0), 0);
    if (!Number.isFinite(total) || total <= 0) return;
    const normalized = rows.map((r) => ({ ...r, weightPct: (Number(r.weightPct || 0) / total) * 100 }));
    setAllocRows(strategyKey, normalized);
  };

  const universeRows = Object.entries(universe).sort((a, b) => a[0].localeCompare(b[0]));
  const strategyRows = Object.entries(autoStrategies).sort((a, b) => a[0].localeCompare(b[0]));
  const historyRows = asArray<any>(historyPayload?.rows);

  const strategyDiagnostics = strategyRows.map(([key, row]: any) => {
    const allocations = row?.allocations || {};
    const entries = Object.entries(allocations);
    const sum = entries.reduce((s: number, [, w]: any) => s + Number(w || 0), 0);
    const unknownTickers = entries
      .map(([ticker]) => String(ticker || "").toUpperCase())
      .filter((ticker) => !universe[ticker]);
    const disabledTickers = entries
      .map(([ticker]) => String(ticker || "").toUpperCase())
      .filter((ticker) => universe[ticker] && universe[ticker].enabled === false);
    return {
      key,
      sum,
      count: entries.length,
      unknownTickers,
      disabledTickers,
    };
  });
  const blockingIssues: string[] = [];
  if (strategyRows.length === 0) blockingIssues.push("At least one auto-invest strategy is required.");
  for (const diag of strategyDiagnostics) {
    if (diag.count === 0) blockingIssues.push(`Strategy "${diag.key}" has no allocations.`);
    if (diag.unknownTickers.length > 0) blockingIssues.push(`Strategy "${diag.key}" references unknown tickers: ${diag.unknownTickers.join(", ")}`);
  }
  const warningIssues: string[] = [];
  for (const diag of strategyDiagnostics) {
    if (diag.disabledTickers.length > 0) warningIssues.push(`Strategy "${diag.key}" includes disabled tickers: ${diag.disabledTickers.join(", ")}`);
    if (diag.sum <= 0) warningIssues.push(`Strategy "${diag.key}" has non-positive total weight.`);
    if (Math.abs(diag.sum - 1) > 0.01 && diag.sum > 0) warningIssues.push(`Strategy "${diag.key}" weights sum to ${diag.sum.toFixed(3)} (will normalize on save).`);
  }
  const fieldClass = "h-8 px-2.5 rounded-md border border-border bg-background text-xs";
  const buttonClass = "text-xs px-3 py-1.5 rounded-md border border-border hover:bg-muted disabled:opacity-50";
  const canEdit = Boolean(isSuperAdmin && data?.canEdit !== false);

  return (
    <div className="space-y-4 max-w-6xl">
      {!canEdit && (
        <div className="rounded-xl border border-amber-300 bg-amber-50 p-3 text-sm text-amber-800">
          You have admin access but not super-admin privileges. Config edits are view-only.
        </div>
      )}
      <div className="bg-card rounded-xl border border-border/50 p-5">
        <h2 className="font-heading text-xl font-semibold mb-1">Investment Config</h2>
        <p className="text-sm text-muted-foreground">
          This controls auto-invest strategy baskets and the supported ticker universe used in Admin Assets and investment flows.
        </p>
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <button
            className={buttonClass}
            onClick={() => {
              setUniverse(data?.universe || {});
              setAutoStrategies(data?.autoStrategies || {});
              setDirty(false);
              setSaveNotice(null);
            }}
          >
            Revert unsaved changes
          </button>
          <button
            className="text-xs px-3 py-1.5 rounded-md border border-primary text-primary hover:bg-primary/10 disabled:opacity-50"
            disabled={!canEdit || !dirty || patchMutation.isPending || blockingIssues.length > 0}
            onClick={() => {
              if (warningIssues.length > 0) {
                const proceed = window.confirm(`Validation warnings:\n- ${warningIssues.join("\n- ")}\n\nSave anyway?`);
                if (!proceed) return;
              }
              patchMutation.mutate({ universe, autoStrategies });
            }}
          >
            {patchMutation.isPending ? "Saving..." : "Save config"}
          </button>
        </div>
        {saveNotice && (
          <div className={`mt-3 rounded-lg border px-3 py-2 text-xs ${saveNotice.type === "success" ? "border-green-300 bg-green-50 text-green-800" : "border-red-300 bg-red-50 text-red-800"}`}>
            {saveNotice.text}
          </div>
        )}
      </div>

      {(blockingIssues.length > 0 || warningIssues.length > 0) && (
        <div className={`rounded-xl border p-3 ${blockingIssues.length > 0 ? "border-red-300 bg-red-50" : "border-amber-300 bg-amber-50"}`}>
          <p className={`text-sm font-semibold ${blockingIssues.length > 0 ? "text-red-800" : "text-amber-800"}`}>
            Config validation
          </p>
          {blockingIssues.map((msg, idx) => (
            <p key={`b-${idx}`} className="text-xs text-red-700 mt-1">- {msg}</p>
          ))}
          {warningIssues.map((msg, idx) => (
            <p key={`w-${idx}`} className="text-xs text-amber-700 mt-1">- {msg}</p>
          ))}
        </div>
      )}

      <div className="bg-card rounded-xl border border-border/50 overflow-hidden">
        <div className="px-4 py-3 border-b border-border/50 flex items-center justify-between gap-2">
          <div>
            <p className="text-sm font-semibold">Supported Universe</p>
            <p className="text-xs text-muted-foreground">Tickers available in gifting and/or auto-invest flows.</p>
          </div>
          <div className="flex items-center gap-2">
            <input value={newTicker} onChange={(e) => setNewTicker(e.target.value)} placeholder="Ticker (e.g. MSFT)" className={`${fieldClass} w-44`} />
            <button className={buttonClass} onClick={addUniverseTicker} disabled={!canEdit}>Add ticker</button>
          </div>
        </div>
        <div className="p-4 grid gap-3 md:grid-cols-2">
          {universeRows.map(([ticker, row]: any) => (
            <div key={ticker} className="rounded-lg border border-border/60 p-3 bg-muted/10">
              <div className="flex items-center justify-between gap-2 mb-2">
                <span className="font-mono text-sm font-semibold">{ticker}</span>
                <button
                  className="text-[11px] px-2 py-1 rounded-md border border-red-300 text-red-700 hover:bg-red-50 disabled:opacity-50"
                  onClick={() => removeUniverse(ticker)}
                  disabled={!canEdit}
                >
                  Remove
                </button>
              </div>
              <div className="grid gap-2">
                <div>
                  <label className="text-[11px] uppercase tracking-wide text-muted-foreground">Name</label>
                  <input
                    value={row?.name || ""}
                    onChange={(e) => updateUniverse(ticker, { name: e.target.value })}
                    className={`${fieldClass} w-full mt-1`}
                    disabled={!canEdit}
                  />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-[11px] uppercase tracking-wide text-muted-foreground">Type</label>
                    <select
                      value={row?.type || "Stock"}
                      onChange={(e) => updateUniverse(ticker, { type: e.target.value })}
                      className={`${fieldClass} w-full mt-1`}
                      disabled={!canEdit}
                    >
                      <option value="Stock">Stock</option>
                      <option value="ETF">ETF</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-[11px] uppercase tracking-wide text-muted-foreground">Availability</label>
                    <select
                      value={row?.source || "stock_pick"}
                      onChange={(e) => updateUniverse(ticker, { source: e.target.value })}
                      className={`${fieldClass} w-full mt-1`}
                      disabled={!canEdit}
                    >
                      <option value="auto_invest">Auto-invest</option>
                      <option value="stock_pick">Stock pick</option>
                      <option value="both">Both</option>
                    </select>
                  </div>
                </div>
                <label className="inline-flex items-center gap-2 text-xs text-muted-foreground mt-1">
                  <input
                    type="checkbox"
                    checked={row?.enabled !== false}
                    onChange={(e) => updateUniverse(ticker, { enabled: e.target.checked })}
                    disabled={!canEdit}
                  />
                  Enabled in product flows
                </label>
              </div>
            </div>
          ))}
          {universeRows.length === 0 && (
            <div className="md:col-span-2 rounded-lg border border-dashed border-border p-6 text-center text-muted-foreground">
              No universe rows.
            </div>
          )}
        </div>
      </div>

      <div className="bg-card rounded-xl border border-border/50 overflow-hidden">
        <div className="px-4 py-3 border-b border-border/50 flex items-center justify-between gap-2">
          <div>
            <p className="text-sm font-semibold">Auto-Invest Strategies</p>
            <p className="text-xs text-muted-foreground">Define the model portfolios used when gifts are auto-invested.</p>
          </div>
          <div className="flex items-center gap-2">
            <input value={newStrategy} onChange={(e) => setNewStrategy(e.target.value)} placeholder="new strategy key" className={`${fieldClass} w-44`} />
            <button className={buttonClass} onClick={addStrategy} disabled={!canEdit}>Add strategy</button>
          </div>
        </div>
        <div className="p-4 grid gap-3">
          {strategyRows.map(([key, row]: any) => {
            const allocRows = getAllocRows(row?.allocations || {});
            const sumPct = (Number(Object.values(row?.allocations || {}).reduce((s: number, w: any) => s + Number(w || 0), 0)) * 100);
            return (
              <div key={key} className="rounded-lg border border-border/60 p-3 bg-muted/10">
                <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] uppercase tracking-wide text-muted-foreground">Key</span>
                    <span className="font-mono text-sm">{key}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      className="text-[11px] px-2 py-1 rounded-md border border-border hover:bg-muted disabled:opacity-50"
                      onClick={() => normalizeAllocRows(key)}
                      disabled={!canEdit}
                    >
                      Normalize 100%
                    </button>
                    <button
                      className="text-[11px] px-2 py-1 rounded-md border border-red-300 text-red-700 hover:bg-red-50 disabled:opacity-50"
                      onClick={() => removeStrategy(key)}
                      disabled={!canEdit}
                    >
                      Remove
                    </button>
                  </div>
                </div>
                <div className="mb-2">
                  <label className="text-[11px] uppercase tracking-wide text-muted-foreground">Display Label</label>
                  <input value={row?.label || ""} onChange={(e) => updateStrategy(key, { label: e.target.value })} className={`${fieldClass} w-full mt-1`} disabled={!canEdit} />
                </div>
                <div className="space-y-2">
                  {allocRows.map((allocRow, idx) => (
                    <div key={`${key}-${idx}`} className="grid grid-cols-[1fr_120px_auto] gap-2 items-center">
                      <input
                        value={allocRow.ticker}
                        onChange={(e) => {
                          const next = [...allocRows];
                          next[idx] = { ...next[idx], ticker: String(e.target.value || "").toUpperCase().trim() };
                          setAllocRows(key, next);
                        }}
                        className={`${fieldClass} font-mono`}
                        disabled={!canEdit}
                        placeholder="Ticker"
                      />
                      <div className="relative">
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          value={Number(allocRow.weightPct.toFixed(2))}
                          onChange={(e) => {
                            const next = [...allocRows];
                            next[idx] = { ...next[idx], weightPct: Number(e.target.value || "0") };
                            setAllocRows(key, next);
                          }}
                          className={`${fieldClass} w-full pr-6`}
                          disabled={!canEdit}
                        />
                        <span className="absolute right-2 top-1.5 text-xs text-muted-foreground">%</span>
                      </div>
                      <button
                        className="text-[11px] px-2 py-1 rounded-md border border-red-300 text-red-700 hover:bg-red-50 disabled:opacity-50"
                        onClick={() => {
                          const next = allocRows.filter((_, i) => i !== idx);
                          setAllocRows(key, next);
                        }}
                        disabled={!canEdit}
                      >
                        Remove
                      </button>
                    </div>
                  ))}
                </div>
                <div className="flex items-center justify-between mt-2">
                  <button
                    className="text-[11px] px-2 py-1 rounded-md border border-border hover:bg-muted disabled:opacity-50"
                    onClick={() => {
                      const next = [...allocRows, { ticker: "", weightPct: 0 }];
                      setAllocRows(key, next);
                    }}
                    disabled={!canEdit}
                  >
                    Add allocation row
                  </button>
                  <span className={`text-xs font-medium ${Math.abs(sumPct - 100) <= 0.01 ? "text-green-700" : "text-amber-700"}`}>
                    Sum: {sumPct.toFixed(2)}%
                  </span>
                </div>
              </div>
            );
          })}
          {strategyRows.length === 0 && (
            <div className="rounded-lg border border-dashed border-border p-6 text-center text-muted-foreground">
              No strategy rows.
            </div>
          )}
        </div>
      </div>

      <div className="bg-card rounded-xl border border-border/50 overflow-hidden">
        <div className="px-3 py-2 border-b border-border/50 text-sm font-semibold">Config Change History</div>
        {historyLoading ? (
          <div className="p-3 text-xs text-muted-foreground">Loading history...</div>
        ) : (
          <SortableTable
            columns={[
              { key: "created_at", label: "When", render: (r: any) => fmtDateTime(r.created_at) },
              { key: "actor_email", label: "Actor", render: (r: any) => r.actor_email || "-" },
              { key: "action", label: "Action", render: (r: any) => String(r.action || "-").replace(/_/g, " ") },
              {
                key: "metadata",
                label: "Details",
                render: (r: any) => {
                  const txt = String(r.metadata || "");
                  return <span className="text-xs text-muted-foreground">{txt.length > 120 ? `${txt.slice(0, 120)}...` : txt || "-"}</span>;
                },
              },
            ]}
            data={historyRows}
            defaultSort="created_at"
          />
        )}
      </div>
    </div>
  );
}

function AdminDeletePreviewModal({
  userId,
  email,
  onClose,
  onDeleted,
}: {
  userId: string;
  email: string;
  onClose: () => void;
  onDeleted: () => void;
}) {
  const queryClient = useQueryClient();
  const [busy, setBusy] = useState(false);
  const { data, isLoading, isError, error } = useQuery<any>({
    queryKey: [`/api/admin/users/${userId}/delete-preview`],
    queryFn: async () => fetchAdminJson(`/api/admin/users/${encodeURIComponent(userId)}/delete-preview`),
    retry: 1,
  });

  const runDelete = async (force: boolean, forceStripe = false) => {
    try {
      setBusy(true);
      const query = new URLSearchParams({
        force: force ? "true" : "false",
        forceStripe: forceStripe ? "true" : "false",
      });
      const res = await fetch(`/api/admin/users/${encodeURIComponent(userId)}?${query.toString()}`, {
        method: "DELETE",
        credentials: "include",
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) {
        const err: any = new Error(payload.error || "Failed to delete user");
        err.status = res.status;
        err.payload = payload;
        throw err;
      }
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] }),
        queryClient.invalidateQueries({ queryKey: ["/api/admin/overview"] }),
        queryClient.invalidateQueries({ queryKey: ["/api/admin/stripe-diagnostics?windowHours=24"] }),
      ]);
      window.alert("Delete user complete.");
      onDeleted();
    } catch (err: any) {
      const payload = err?.payload || {};
      if (err?.status === 409 && payload?.requiresForceStripe && !forceStripe) {
        const override = window.confirm(
          "Stripe cleanup failed. Continue hard delete anyway and clean Stripe manually afterward?",
        );
        if (override) {
          await runDelete(true, true);
          return;
        }
      }
      window.alert(`Delete user failed: ${getAdminErrorMessage(err, "Unknown error")}`);
    } finally {
      setBusy(false);
    }
  };

  const usage = data?.usage || {};
  const accountSubscriptions = asArray<any>(data?.stripe?.accountSubscriptions);
  const starterMemberships = asArray<any>(data?.stripe?.starterMemberships);

  return (
    <div className="fixed inset-0 z-[110] bg-black/45 backdrop-blur-[1px] flex items-center justify-center p-4">
      <div className="w-full max-w-3xl max-h-[90vh] overflow-hidden rounded-xl border border-border bg-card">
        <div className="flex items-center justify-between border-b border-border/50 px-4 py-3">
          <h3 className="font-heading text-base font-semibold">Delete Preview: {email}</h3>
          <button className="text-sm text-muted-foreground hover:text-foreground" onClick={onClose}>Close</button>
        </div>
        <div className="max-h-[calc(90vh-56px)] space-y-4 overflow-auto p-4">
          {isLoading && <div className="text-sm text-muted-foreground">Loading delete preview...</div>}
          {isError && <div className="text-sm text-red-700">Could not load delete preview. {(error as any)?.message || ""}</div>}
          {!isLoading && !isError && (
            <>
              <div className="rounded-xl border border-border/50 bg-muted/20 p-3 text-sm text-muted-foreground">
                Review everything that will be removed before you run a hard delete. Stripe-linked records are called out separately.
              </div>
              <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
                {Object.entries(usage).map(([key, value]) => (
                  <div key={key} className="rounded-xl border border-border/50 p-3">
                    <div className="text-[11px] uppercase tracking-wide text-muted-foreground">{key.replace(/_/g, " ")}</div>
                    <div className="mt-1 text-lg font-semibold">{fmtNum(value)}</div>
                  </div>
                ))}
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="rounded-xl border border-border/50 p-3">
                  <div className="text-sm font-semibold">Account subscriptions</div>
                  {accountSubscriptions.length > 0 ? (
                    <div className="mt-3 space-y-2 text-xs">
                      {accountSubscriptions.map((row: any) => (
                        <div key={String(row?.id || row?.stripeSubscriptionId || Math.random())} className="rounded-lg border border-border/50 p-2">
                          <div className="flex items-center justify-between gap-2">
                            <StatusBadge status={String(row?.plan || "family")} />
                            <StatusBadge status={String(row?.status || "active")} />
                          </div>
                          <div className="mt-1 text-muted-foreground">Customer {String(row?.stripeCustomerId || "-")}</div>
                          <div className="text-muted-foreground">Subscription {String(row?.stripeSubscriptionId || "-")}</div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="mt-2 text-xs text-muted-foreground">No account-level Stripe subscriptions.</div>
                  )}
                </div>
                <div className="rounded-xl border border-border/50 p-3">
                  <div className="text-sm font-semibold">Fund-level Kiddo+ memberships</div>
                  {starterMemberships.length > 0 ? (
                    <div className="mt-3 space-y-2 text-xs">
                      {starterMemberships.map((row: any) => (
                        <div key={String(row?.id || row?.fund_id || Math.random())} className="rounded-lg border border-border/50 p-2">
                          <div className="flex items-center justify-between gap-2">
                            <span className="font-medium">{String(row?.fund_name || "Unnamed fund")}</span>
                            <StatusBadge status={String(row?.status || "active")} />
                          </div>
                          <div className="mt-1 text-muted-foreground">Customer {String(row?.stripe_customer_id || "-")}</div>
                          <div className="text-muted-foreground">Subscription {String(row?.stripe_subscription_id || "-")}</div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="mt-2 text-xs text-muted-foreground">No fund-level Stripe memberships.</div>
                  )}
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  className="rounded border border-border px-3 py-2 text-sm hover:bg-muted disabled:opacity-50"
                  onClick={() => void runDelete(false, false)}
                  disabled={busy}
                >
                  Delete if clean
                </button>
                <button
                  className="rounded border border-amber-300 px-3 py-2 text-sm text-amber-700 hover:bg-amber-50 disabled:opacity-50"
                  onClick={() => void runDelete(true, false)}
                  disabled={busy}
                >
                  Hard delete with Stripe cleanup
                </button>
                <button
                  className="rounded border border-red-300 px-3 py-2 text-sm text-red-700 hover:bg-red-50 disabled:opacity-50"
                  onClick={() => {
                    if (!window.confirm("Continue with hard delete and ignore Stripe cleanup failures?")) return;
                    void runDelete(true, true);
                  }}
                  disabled={busy}
                >
                  Force hard delete anyway
                </button>
              </div>
            </>
          )}
        </div>
      </div>

      <FeatureFlagsSection />
      <StripeProductsSection />
      <CulturalStatsSection />
    </div>
  );
}

// ─── Feature flags section (Config tab) ───────────────────────────
function FeatureFlagsSection() {
  const queryClient = useQueryClient();
  const { data, isLoading } = useQuery<{ flags: any[]; suggestions: any[] }>({
    queryKey: ["/api/admin/feature-flags"],
    queryFn: async () => fetchAdminJson("/api/admin/feature-flags"),
  });
  const upsertFlag = useMutation({
    mutationFn: async ({ key, enabled, description }: { key: string; enabled: boolean; description?: string }) => {
      const res = await fetch(`/api/admin/feature-flags/${encodeURIComponent(key)}`, {
        method: "PUT",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled, description }),
      });
      if (!res.ok) throw new Error("Failed to update flag");
      return res.json();
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/admin/feature-flags"] }),
  });
  const deleteFlag = useMutation({
    mutationFn: async (key: string) => {
      const res = await fetch(`/api/admin/feature-flags/${encodeURIComponent(key)}`, {
        method: "DELETE", credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to delete flag");
      return res.json();
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/admin/feature-flags"] }),
  });
  const [newKey, setNewKey] = useState("");
  const [newDesc, setNewDesc] = useState("");
  const flags = asArray<any>(data?.flags);
  const suggestions = asArray<any>(data?.suggestions);
  return (
    <div className="rounded-2xl border border-border/60 bg-card p-5 mt-6">
      <div className="flex items-center justify-between mb-3">
        <div>
          <h3 className="text-sm font-semibold">Feature flags</h3>
          <p className="text-xs text-muted-foreground mt-0.5">Runtime-toggleable booleans. Code reads <code className="text-[10px]">isFeatureEnabled('key', false)</code>. Cache TTL is 5s, so toggles propagate within seconds.</p>
        </div>
      </div>
      {isLoading ? <div className="text-xs text-muted-foreground">Loading…</div> : (
        <div className="space-y-2">
          {flags.map((f) => (
            <div key={f.key} className="rounded border border-border/60 p-3 flex items-center justify-between gap-3">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <code className="text-xs font-bold">{f.key}</code>
                  <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${f.enabled ? "bg-green-100 text-green-700" : "bg-muted text-muted-foreground"}`}>
                    {f.enabled ? "ON" : "OFF"}
                  </span>
                </div>
                {f.description && <p className="text-[11px] text-muted-foreground mt-1">{f.description}</p>}
                <p className="text-[10px] text-muted-foreground/60 mt-0.5">Updated {fmtDateTime(f.updated_at)} by {f.updated_by_email || f.updated_by || "system"}</p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <button onClick={() => upsertFlag.mutate({ key: f.key, enabled: !f.enabled, description: f.description })} className="text-[11px] px-2.5 py-1 rounded border border-border hover:bg-muted">
                  {f.enabled ? "Turn off" : "Turn on"}
                </button>
                <button onClick={() => { if (window.confirm(`Delete flag '${f.key}'?`)) deleteFlag.mutate(f.key); }} className="text-[11px] text-red-700 hover:underline">
                  Delete
                </button>
              </div>
            </div>
          ))}
          {suggestions.length > 0 && (
            <div className="mt-4 rounded border border-dashed border-border/60 p-3">
              <p className="text-[11px] font-semibold text-muted-foreground mb-2">Known flags not yet created (canonical, declared in server/featureFlags.ts):</p>
              <div className="space-y-2">
                {suggestions.map((f) => (
                  <div key={f.key} className="flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <code className="text-[11px] font-bold">{f.key}</code>
                      <p className="text-[10px] text-muted-foreground">{f.description}</p>
                    </div>
                    <button onClick={() => upsertFlag.mutate({ key: f.key, enabled: f.enabled, description: f.description })} className="shrink-0 text-[11px] px-2 py-1 rounded border border-primary text-primary hover:bg-primary/10">
                      Create ({f.enabled ? "on" : "off"})
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
          <div className="mt-4 rounded border border-border/60 p-3">
            <p className="text-[11px] font-semibold text-muted-foreground mb-2">Create a custom flag:</p>
            <div className="flex flex-wrap items-center gap-2">
              <input value={newKey} onChange={(e) => setNewKey(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, "_"))} placeholder="flag_key" className="h-8 rounded border border-border bg-background px-2 text-xs w-44 font-mono" />
              <input value={newDesc} onChange={(e) => setNewDesc(e.target.value)} placeholder="What does it do?" className="h-8 rounded border border-border bg-background px-2 text-xs flex-1 min-w-44" />
              <button
                disabled={!newKey.trim()}
                onClick={() => { upsertFlag.mutate({ key: newKey.trim(), enabled: false, description: newDesc.trim() || undefined }); setNewKey(""); setNewDesc(""); }}
                className="text-[11px] px-3 py-1 rounded border border-primary text-primary hover:bg-primary/10 disabled:opacity-50"
              >
                Create (off)
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Stripe products section (Config tab) ─────────────────────────
function StripeProductsSection() {
  const queryClient = useQueryClient();
  const { data, isLoading } = useQuery<{ products: any[] }>({
    queryKey: ["/api/admin/stripe/products"],
    queryFn: async () => fetchAdminJson("/api/admin/stripe/products"),
  });
  const [showCreate, setShowCreate] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [unitAmount, setUnitAmount] = useState(""); // in dollars, converted to cents on submit
  const [interval, setInterval] = useState<"" | "month" | "year">("month");
  const createProduct = useMutation({
    mutationFn: async () => {
      const cents = Math.round(parseFloat(unitAmount || "0") * 100);
      const res = await fetch("/api/admin/stripe/products", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim(), description: description.trim(), unitAmount: cents, currency: "usd", interval: interval || null }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || data.message || "Create failed");
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/stripe/products"] });
      setShowCreate(false); setName(""); setDescription(""); setUnitAmount(""); setInterval("month");
    },
    onError: (err: any) => window.alert(err?.message || "Create failed"),
  });
  const archiveProduct = useMutation({
    mutationFn: async ({ id, unarchive }: { id: string; unarchive: boolean }) => {
      const res = await fetch(`/api/admin/stripe/products/${encodeURIComponent(id)}/${unarchive ? "unarchive" : "archive"}`, {
        method: "POST", credentials: "include",
      });
      if (!res.ok) throw new Error(`Failed to ${unarchive ? "unarchive" : "archive"}`);
      return res.json();
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/admin/stripe/products"] }),
  });
  const products = asArray<any>(data?.products);
  return (
    <div className="rounded-2xl border border-border/60 bg-card p-5 mt-6">
      <div className="flex items-center justify-between mb-3">
        <div>
          <h3 className="text-sm font-semibold">Stripe products</h3>
          <p className="text-xs text-muted-foreground mt-0.5">Live from Stripe: products + prices used for subscriptions and one-off charges. Create new ones here when launching a tier; archive retired ones to hide from new signups (existing subscribers unaffected).</p>
        </div>
        <button onClick={() => setShowCreate(v => !v)} className="text-[11px] px-3 py-1 rounded border border-primary text-primary hover:bg-primary/10">{showCreate ? "Cancel" : "+ New product"}</button>
      </div>
      {showCreate && (
        <div className="mb-3 rounded border border-primary/30 bg-primary/5 p-3 space-y-2">
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Product name (e.g. Kiddo+ Premium)" className="h-9 w-full rounded border border-border bg-background px-2 text-sm" />
          <input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Description (optional)" className="h-9 w-full rounded border border-border bg-background px-2 text-sm" />
          <div className="flex flex-wrap gap-2 items-center">
            <span className="text-xs">$</span>
            <input value={unitAmount} onChange={(e) => setUnitAmount(e.target.value)} placeholder="9.99" className="h-9 w-24 rounded border border-border bg-background px-2 text-sm" />
            <select value={interval} onChange={(e) => setInterval(e.target.value as any)} className="h-9 rounded border border-border bg-background px-2 text-sm">
              <option value="">one-time</option>
              <option value="month">/month</option>
              <option value="year">/year</option>
            </select>
            <button
              disabled={!name.trim() || !unitAmount.trim() || createProduct.isPending}
              onClick={() => createProduct.mutate()}
              className="text-xs px-3 py-1.5 rounded border border-primary bg-primary text-white disabled:opacity-50"
            >
              {createProduct.isPending ? "Creating…" : "Create"}
            </button>
          </div>
          <p className="text-[11px] text-muted-foreground">Creates a Stripe Product + a single Price. For multi-price products (monthly + yearly), create the product first then add additional prices via Stripe dashboard.</p>
        </div>
      )}
      {isLoading ? <div className="text-xs text-muted-foreground">Loading products…</div> : (
        <div className="space-y-2">
          {products.map((p) => (
            <div key={p.id} className={`rounded border p-3 ${p.active ? "border-border/60" : "border-amber-200/60 bg-amber-50/20"}`}>
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-sm font-semibold">{p.name}</p>
                    {!p.active && <span className="rounded-full bg-amber-100 px-1.5 py-0.5 text-[10px] font-bold text-amber-800">ARCHIVED</span>}
                    <code className="text-[10px] text-muted-foreground">{p.id}</code>
                  </div>
                  {p.description && <p className="text-[11px] text-muted-foreground mt-0.5">{p.description}</p>}
                  {p.prices.length > 0 && (
                    <div className="mt-1.5 flex flex-wrap gap-1">
                      {p.prices.map((pr: any) => (
                        <span key={pr.id} className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] ${pr.active ? "bg-muted" : "bg-muted/40 text-muted-foreground line-through"}`}>
                          ${(pr.unit_amount / 100).toFixed(2)} {pr.currency.toUpperCase()}
                          {pr.recurring ? `/${pr.recurring.interval}` : ""}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
                <button
                  onClick={() => { if (window.confirm(`${p.active ? "Archive" : "Unarchive"} '${p.name}'?`)) archiveProduct.mutate({ id: p.id, unarchive: !p.active }); }}
                  className="shrink-0 text-[11px] px-2 py-1 rounded border border-border hover:bg-muted"
                >
                  {p.active ? "Archive" : "Unarchive"}
                </button>
              </div>
            </div>
          ))}
          {products.length === 0 && <p className="text-xs text-muted-foreground">No Stripe products yet.</p>}
        </div>
      )}
    </div>
  );
}

// ─── Cultural stats section (Config tab) ──────────────────────────
function CulturalStatsSection() {
  const { data, isLoading } = useQuery<{ stats: Array<{ tradition: string; count: number; sampleFunds: any[] }>; totalFundsWithTraditions: number }>({
    queryKey: ["/api/admin/cultural/stats"],
    queryFn: async () => fetchAdminJson("/api/admin/cultural/stats"),
  });
  const stats = asArray<any>(data?.stats);
  return (
    <div className="rounded-2xl border border-border/60 bg-card p-5 mt-6">
      <div className="mb-3">
        <h3 className="text-sm font-semibold">Cultural traditions</h3>
        <p className="text-xs text-muted-foreground mt-0.5">Tradition usage across funds (which families set which heritage). Source of truth for tradition keys: <code className="text-[10px]">client/src/lib/cultural-calendar.ts</code>. Adoption signals which traditions deserve more cultural occasion suggestions and which to redesign.</p>
      </div>
      {isLoading ? <div className="text-xs text-muted-foreground">Loading…</div> : (
        <div className="space-y-2">
          <p className="text-[11px] text-muted-foreground">{fmtNum(data?.totalFundsWithTraditions || 0)} funds have tradition data set.</p>
          {stats.map((s) => (
            <div key={s.tradition} className="rounded border border-border/60 p-2.5">
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-semibold capitalize">{s.tradition.replace(/_/g, " ")}</p>
                  <p className="text-[11px] text-muted-foreground">{s.sampleFunds.map((f: any) => f.recipientFirstName || f.name).filter(Boolean).join(" · ") || "no sample names"}</p>
                </div>
                <span className="shrink-0 rounded-full bg-muted px-2.5 py-1 text-[11px] font-bold tabular-nums">{fmtNum(s.count)} funds</span>
              </div>
            </div>
          ))}
          {stats.length === 0 && <p className="text-xs text-muted-foreground">No cultural traditions set yet.</p>}
        </div>
      )}
    </div>
  );
}

function UsersTab({ isSuperAdmin }: { isSuperAdmin: boolean }) {
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [detailTarget, setDetailTarget] = useState<{ title: string; endpoint: string } | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<{ userId: string; email: string } | null>(null);
  const queryClient = useQueryClient();
  const search = useSearch();
  const params = getSafeSearchParams(search);
  const kycFilter = (params.get("kyc") || "").toLowerCase();
  const planFilter = (params.get("plan") || "").toLowerCase();
  const { data: users = [], isLoading, isError, error } = useQuery<any[]>({
    queryKey: ["/api/admin/users"],
    queryFn: async () => fetchAdminJson("/api/admin/users"),
    refetchInterval: 30000,
    refetchOnWindowFocus: true,
    retry: 1,
  });

  const refreshAdminData = async () => {
    await queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] });
    await queryClient.invalidateQueries({ queryKey: ["/api/admin/overview"] });
    await queryClient.invalidateQueries({ queryKey: ["/api/admin/stripe-diagnostics?windowHours=24"] });
  };

  const patchUserMutation = useMutation({
    mutationFn: async ({ userId, payload }: { userId: string; payload: Record<string, unknown> }) => {
      const res = await fetch(`/api/admin/users/${encodeURIComponent(userId)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Failed to update user");
      return data;
    },
    onSuccess: refreshAdminData,
  });

  const patchSubscriptionMutation = useMutation({
    mutationFn: async ({ userId, payload }: { userId: string; payload: Record<string, unknown> }) => {
      const res = await fetch(`/api/admin/users/${encodeURIComponent(userId)}/subscription`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Failed to update subscription");
      return data;
    },
    onSuccess: refreshAdminData,
  });

  const syncSubscriptionMutation = useMutation({
    mutationFn: async (userId: string) => {
      const res = await fetch(`/api/admin/users/${encodeURIComponent(userId)}/subscription/sync-stripe`, {
        method: "POST",
        credentials: "include",
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Failed to sync subscription");
      return data;
    },
    onSuccess: refreshAdminData,
  });

  const runAdminAction = async (label: string, fn: () => Promise<unknown>) => {
    try {
      await fn();
      window.alert(`${label} complete.`);
    } catch (err: any) {
      window.alert(`${label} failed: ${getAdminErrorMessage(err, "Unknown error")}`);
    }
  };

  if (isLoading) return <div className="text-center py-12 text-muted-foreground">Loading users...</div>;
  if (isError) return <div className="text-center py-12 text-muted-foreground">Could not load users. {(error as any)?.message || ""}</div>;

  const safeUsers = asArray<any>(users);
  const filteredUsers = safeUsers.filter((u: any) => {
    const matchesKyc = !kycFilter || String(u.kyc_status || "").toLowerCase() === kycFilter;
    const normalizedPlan = String(u.sub_plan || "free").toLowerCase();
    const matchesPlan = !planFilter || (planFilter === "paid" ? ["starter", "family", "legacy"].includes(normalizedPlan) : normalizedPlan === planFilter);
    return matchesKyc && matchesPlan;
  });

  const handleExportUsers = () => {
    const headers = [
      "email",
      "first_name",
      "last_name",
      "plan",
      "plan_status",
      "kyc_status",
      "fund_count",
      "utma_count",
      "total_value",
      "gifts_received",
      "bank_accounts",
      "joined",
    ];
    const rows = users.map((u: any) => [
      u.email,
      u.first_name,
      u.last_name,
      u.sub_plan || "free",
      u.sub_status || "-",
      u.kyc_status || "none",
      u.fund_count || 0,
      u.utma_count || 0,
      u.total_value || 0,
      u.gifts_received || 0,
      u.bank_accounts || 0,
      u.created_at,
    ]);
    downloadCsv(`admin-users-${new Date().toISOString().slice(0, 10)}.csv`, headers, rows);
  };

  const baseColumns = [
    { key: "email", label: "Email", render: (r: any) => <span className="font-medium text-xs">{r.email || "-"}</span> },
    { key: "first_name", label: "Name", render: (r: any) => `${r.first_name || ""} ${r.last_name || ""}`.trim() || "-" },
    { key: "sub_plan", label: "Plan", render: (r: any) => <StatusBadge status={r.sub_plan || "free"} /> },
    { key: "kyc_status", label: "KYC", render: (r: any) => <StatusBadge status={r.kyc_status || "none"} /> },
    { key: "total_value", label: "Total Value", align: "right", render: (r: any) => fmt(r.total_value) },
    { key: "fund_count", label: "Funds", align: "right", render: (r: any) => fmtNum(r.fund_count) },
    { key: "gifts_received", label: "Gifts", align: "right", render: (r: any) => fmtNum(r.gifts_received) },
    { key: "created_at", label: "Joined", render: (r: any) => fmtDate(r.created_at) },
    {
      key: "actions",
      label: "Actions",
      render: (r: any) => (
        <RowActionsMenu label={`Open actions for ${r.email || r.id}`}>
          <DropdownMenuItem onSelect={() => setDetailTarget({ title: `User Details: ${r.email || r.id}`, endpoint: `/api/admin/users/${encodeURIComponent(r.id)}/details` })}>
            View details
          </DropdownMenuItem>
          <DropdownMenuItem
            disabled={!isSuperAdmin}
            onSelect={() => runAdminAction(
              r.is_admin ? "Remove admin role" : "Grant admin role",
              () => patchUserMutation.mutateAsync({ userId: r.id, payload: { isAdmin: !Boolean(r.is_admin) } }),
            )}
          >
            {r.is_admin ? "Remove admin" : "Make admin"}
          </DropdownMenuItem>
          <DropdownMenuItem
            onSelect={() => runAdminAction(
              "Approve KYC",
              () => patchUserMutation.mutateAsync({ userId: r.id, payload: { kycStatus: "approved" } }),
            )}
          >
            KYC approve
          </DropdownMenuItem>
          <DropdownMenuItem
            onSelect={() => runAdminAction(
              r.is_test_user ? "Remove test-user flag" : "Mark as test user",
              () => patchUserMutation.mutateAsync({ userId: r.id, payload: { isTestUser: !Boolean(r.is_test_user) } }),
            )}
          >
            {r.is_test_user ? "Unmark test user" : "Mark as test user"}
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            onSelect={() => runAdminAction(
              "Set plan free",
              () => patchSubscriptionMutation.mutateAsync({ userId: r.id, payload: { plan: "free", status: "active", billingInterval: "none" } }),
            )}
          >
            Set free
          </DropdownMenuItem>
          <DropdownMenuItem
            onSelect={() => runAdminAction(
              "Set plan family",
              () => patchSubscriptionMutation.mutateAsync({ userId: r.id, payload: { plan: "family", status: "active" } }),
            )}
          >
            Set family
          </DropdownMenuItem>
          {showAdvanced && r.sub_plan === "family" && r.stripe_subscription_id && (
            <DropdownMenuItem
              onSelect={() => runAdminAction(
                "Resync from Stripe",
                () => syncSubscriptionMutation.mutateAsync(r.id),
              )}
            >
              Resync Stripe
            </DropdownMenuItem>
          )}
          <DropdownMenuSeparator />
          <DropdownMenuItem
            className="text-red-700 focus:text-red-700"
            disabled={!isSuperAdmin}
            onSelect={() => setDeleteTarget({ userId: String(r.id), email: String(r.email || r.id) })}
          >
            Delete
          </DropdownMenuItem>
        </RowActionsMenu>
      ),
    },
  ];
  const advancedColumns = [
    { key: "sub_status", label: "Plan Status", render: (r: any) => r.sub_plan === "family" ? <StatusBadge status={r.sub_status || "active"} /> : <span className="text-xs text-muted-foreground">-</span> },
    { key: "utma_count", label: "Kids", align: "right", render: (r: any) => fmtNum(r.utma_count) },
    { key: "bank_accounts", label: "Banks", align: "right", render: (r: any) => fmtNum(r.bank_accounts) },
    { key: "is_test_user", label: "Test", render: (r: any) => r.is_test_user ? <span className="inline-flex items-center rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-800">TEST</span> : <span className="text-[11px] text-muted-foreground/60">-</span> },
    { key: "id", label: "User ID", render: (r: any) => <span className="font-mono text-[11px]">{String(r.id || "").slice(0, 18)}...</span> },
    { key: "stripe_subscription_id", label: "Stripe Sub", render: (r: any) => r.stripe_subscription_id ? <span className="font-mono text-[11px]">{String(r.stripe_subscription_id).slice(0, 18)}...</span> : "-" },
  ];
  const columns = showAdvanced ? [...baseColumns, ...advancedColumns] : baseColumns;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="font-heading text-lg font-semibold" data-testid="heading-users-tab">All Users ({filteredUsers.length}{filteredUsers.length !== safeUsers.length ? ` of ${safeUsers.length}` : ""})</h2>
        <div className="flex items-center gap-3">
          <button
            onClick={handleExportUsers}
            className="text-xs text-primary hover:underline"
            data-testid="button-users-export-csv"
          >
            Export CSV
          </button>
          <button
            onClick={() => setShowAdvanced((v) => !v)}
            className="text-xs text-muted-foreground hover:text-foreground"
            data-testid="button-users-advanced-toggle"
          >
            {showAdvanced ? "Hide advanced columns" : "Show advanced columns"}
          </button>
        </div>
      </div>
      <div className="bg-card rounded-xl border border-border/50 overflow-hidden">
        {showAdvanced && (
          <div className="px-3 py-2 border-b border-border/50 text-[11px] text-muted-foreground">
            Advanced view enabled. Scroll horizontally to see all columns.
          </div>
        )}
        <SortableTable columns={columns} data={filteredUsers} defaultSort="created_at" />
      </div>
      {detailTarget && (
        <AdminDetailModal
          title={detailTarget.title}
          endpoint={detailTarget.endpoint}
          onClose={() => setDetailTarget(null)}
        />
      )}
      {deleteTarget && (
        <AdminDeletePreviewModal
          userId={deleteTarget.userId}
          email={deleteTarget.email}
          onClose={() => setDeleteTarget(null)}
          onDeleted={() => setDeleteTarget(null)}
        />
      )}
    </div>
  );
}

function FundsTab() {
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [detailTarget, setDetailTarget] = useState<{ title: string; endpoint: string } | null>(null);
  const queryClient = useQueryClient();
  const search = useSearch();
  const params = getSafeSearchParams(search);
  const accountTypeFilter = params.get("accountType");
  const { data: fundsPayload, isLoading, isError, error } = useQuery<any>({
    queryKey: ["/api/admin/funds"],
    queryFn: async () => fetchAdminJson("/api/admin/funds"),
    refetchInterval: 30000,
    refetchOnWindowFocus: true,
    retry: 1,
  });

  const patchFundMutation = useMutation({
    mutationFn: async ({ fundId, payload }: { fundId: string; payload: Record<string, unknown> }) => {
      const res = await fetch(`/api/admin/funds/${encodeURIComponent(fundId)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Failed to update fund");
      return data;
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["/api/admin/funds"] });
      await queryClient.invalidateQueries({ queryKey: ["/api/admin/overview"] });
    },
  });

  const runFundAction = async (label: string, fn: () => Promise<unknown>) => {
    try {
      await fn();
      window.alert(`${label} complete.`);
    } catch (err: any) {
      window.alert(`${label} failed: ${getAdminErrorMessage(err, "Unknown error")}`);
    }
  };

  if (isLoading) return <div className="text-center py-12 text-muted-foreground">Loading funds...</div>;
  if (isError) return <div className="text-center py-12 text-muted-foreground">Could not load funds. {(error as any)?.message || ""}</div>;

  const parsedFunds = toRowsPayload<any>(fundsPayload);
  const safeFunds = asArray<any>(parsedFunds.rows);
  const visibleFunds = safeFunds.filter((f: any) => !accountTypeFilter || String(f.account_type || "").toLowerCase() === accountTypeFilter.toLowerCase());

  const handleExportFunds = () => {
    const headers = [
      "fund_name",
      "owner_email",
      "account_type",
      "status",
      "owner_kyc_status",
      "invested_balance",
      "pending_balance",
      "total_value",
      "holding_count",
      "gift_count",
      "event_count",
      "is_discoverable",
      "recipient_first_name",
      "created_at",
    ];
    const rows = safeFunds.map((f: any) => [
      f.name,
      f.owner_email,
      f.account_type,
      f.status,
      f.owner_kyc_status,
      f.balance || 0,
      f.pending_balance || 0,
      (parseFloat(f.balance || "0") + parseFloat(f.pending_balance || "0")).toFixed(2),
      f.holding_count || 0,
      f.gift_count || 0,
      f.event_count || 0,
      f.is_discoverable ? "true" : "false",
      f.recipient_first_name || "",
      f.created_at,
    ]);
    downloadCsv(`admin-funds-${new Date().toISOString().slice(0, 10)}.csv`, headers, rows);
  };

  const baseColumns = [
    { key: "name", label: "Fund Name", render: (r: any) => <span className="font-medium">{r.name}</span> },
    { key: "owner_email", label: "Owner", render: (r: any) => <span className="text-xs">{r.owner_email}</span> },
    { key: "account_type", label: "Type", render: (r: any) => <StatusBadge status={r.account_type === "UTMA" ? "UTMA" : "Personal"} map={{ UTMA: "bg-amber-100 text-amber-700", Personal: "bg-blue-100 text-blue-700" }} /> },
    { key: "status", label: "Status", render: (r: any) => <StatusBadge status={r.status} /> },
    { key: "total_value", label: "Total Value", align: "right", render: (r: any) => fmt((parseFloat(r.balance || "0") + parseFloat(r.pending_balance || "0")).toFixed(2)) },
    { key: "gift_count", label: "Gifts", align: "right" },
    { key: "event_count", label: "Events", align: "right" },
    { key: "created_at", label: "Created", render: (r: any) => fmtDate(r.created_at) },
    {
      key: "actions",
      label: "Actions",
      render: (r: any) => (
        <RowActionsMenu label={`Open actions for ${r.name || r.id}`}>
          <DropdownMenuItem onSelect={() => setDetailTarget({ title: `Fund Details: ${r.name || r.id}`, endpoint: `/api/admin/funds/${encodeURIComponent(r.id)}/details` })}>
            View details
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => runFundAction("Toggle discoverability", () => patchFundMutation.mutateAsync({ fundId: r.id, payload: { isDiscoverable: !Boolean(r.is_discoverable) } }))}>
            {r.is_discoverable ? "Make private" : "Make public"}
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => runFundAction("Activate fund", () => patchFundMutation.mutateAsync({ fundId: r.id, payload: { status: "active" } }))}>
            Set active
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => runFundAction("Pause fund", () => patchFundMutation.mutateAsync({ fundId: r.id, payload: { status: "paused" } }))}>
            Pause
          </DropdownMenuItem>
        </RowActionsMenu>
      ),
    },
  ];
  const advancedColumns = [
    { key: "owner_kyc_status", label: "Owner KYC", render: (r: any) => <StatusBadge status={r.owner_kyc_status || "none"} /> },
    { key: "balance", label: "Invested", align: "right", render: (r: any) => fmt(r.balance) },
    { key: "pending_balance", label: "Pending", align: "right", render: (r: any) => fmt(r.pending_balance) },
    { key: "holding_count", label: "Holdings", align: "right" },
    { key: "is_discoverable", label: "Public", render: (r: any) => r.is_discoverable ? <Eye size={14} className="text-green-600" /> : <span className="text-xs text-muted-foreground">Private</span> },
    { key: "recipient_first_name", label: "Recipient" },
  ];
  const columns = showAdvanced ? [...baseColumns, ...advancedColumns] : baseColumns;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="font-heading text-lg font-semibold" data-testid="heading-funds-tab">All Funds ({visibleFunds.length}{visibleFunds.length !== safeFunds.length ? ` of ${safeFunds.length}` : ""})</h2>
        <div className="flex items-center gap-3">
          <button
            onClick={handleExportFunds}
            className="text-xs text-primary hover:underline"
            data-testid="button-funds-export-csv"
          >
            Export CSV
          </button>
          <button
            onClick={() => setShowAdvanced((v) => !v)}
            className="text-xs text-muted-foreground hover:text-foreground"
            data-testid="button-funds-advanced-toggle"
          >
            {showAdvanced ? "Hide advanced columns" : "Show advanced columns"}
          </button>
        </div>
      </div>
      {parsedFunds.degraded && (
        <div className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-800">
          Funds tab is in fallback mode. {parsedFunds.queryErrors?.join(" | ")}
        </div>
      )}
      <div className="bg-card rounded-xl border border-border/50 overflow-hidden">
        {showAdvanced && (
          <div className="px-3 py-2 border-b border-border/50 text-[11px] text-muted-foreground">
            Advanced view enabled. Scroll horizontally to see all columns.
          </div>
        )}
        <SortableTable columns={columns} data={visibleFunds} defaultSort="created_at" />
      </div>
      {detailTarget && (
        <AdminDetailModal
          title={detailTarget.title}
          endpoint={detailTarget.endpoint}
          onClose={() => setDetailTarget(null)}
        />
      )}
    </div>
  );
}

function GiftsTab({ isSuperAdmin }: { isSuperAdmin: boolean }) {
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [detailTarget, setDetailTarget] = useState<{ title: string; endpoint: string } | null>(null);
  const queryClient = useQueryClient();
  const search = useSearch();
  const params = getSafeSearchParams(search);
  const statusFilter = (params.get("status") || "").toLowerCase();
  const { data: giftsPayload, isLoading, isError, error } = useQuery<any>({
    queryKey: ["/api/admin/gifts"],
    queryFn: async () => fetchAdminJson("/api/admin/gifts"),
    refetchInterval: 30000,
    refetchOnWindowFocus: true,
    retry: 1,
  });

  const patchGiftMutation = useMutation({
    mutationFn: async ({ giftId, payload }: { giftId: string; payload: Record<string, unknown> }) => {
      const res = await fetch(`/api/admin/gifts/${encodeURIComponent(giftId)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Failed to update gift");
      return data;
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["/api/admin/gifts"] });
      await queryClient.invalidateQueries({ queryKey: ["/api/admin/overview"] });
    },
  });

  const runGiftAction = async (label: string, fn: () => Promise<unknown>, confirmText?: string) => {
    if (confirmText && !window.confirm(confirmText)) return;
    try {
      await fn();
      window.alert(`${label} complete.`);
    } catch (err: any) {
      window.alert(`${label} failed: ${getAdminErrorMessage(err, "Unknown error")}`);
    }
  };

  if (isLoading) return <div className="text-center py-12 text-muted-foreground">Loading gifts...</div>;
  if (isError) return <div className="text-center py-12 text-muted-foreground">Could not load gifts. {(error as any)?.message || ""}</div>;

  const parsedGifts = toRowsPayload<any>(giftsPayload);
  const safeGifts = asArray<any>(parsedGifts.rows);
  const visibleGifts = safeGifts.filter((g: any) => !statusFilter || String(g.status || "").toLowerCase() === statusFilter);

  const handleExportGifts = () => {
    const headers = [
      "created_at",
      "sender_name",
      "sender_email",
      "fund_name",
      "event_name",
      "amount",
      "processing_fee",
      "kora_fee",
      "net_amount",
      "execution_model",
      "selected_ticker",
      "status",
      "has_event_pass",
    ];
    const rows = safeGifts.map((g: any) => [
      g.created_at,
      g.sender_name,
      g.sender_email,
      g.fund_name,
      g.event_name || "",
      g.amount || 0,
      g.processing_fee || 0,
      g.kora_fee || 0,
      g.net_amount || 0,
      g.execution_model || "auto_invest",
      g.selected_ticker || "",
      g.status,
      g.has_event_pass ? "true" : "false",
    ]);
    downloadCsv(`admin-gifts-${new Date().toISOString().slice(0, 10)}.csv`, headers, rows);
  };

  const baseColumns = [
    { key: "sender_name", label: "Gifter", render: (r: any) => (
      <div>
        <p className="font-medium text-sm">{r.sender_name}</p>
        <p className="text-xs text-muted-foreground">{r.sender_email || ""}</p>
      </div>
    )},
    { key: "fund_name", label: "To Fund", render: (r: any) => (
      <div>
        <p className="text-sm">{r.fund_name}</p>
        <p className="text-xs text-muted-foreground">{r.fund_type}</p>
      </div>
    )},
    { key: "amount", label: "Gift Amount", align: "right", render: (r: any) => <span className="font-semibold">{fmt(r.amount)}</span> },
    { key: "net_amount", label: "Recipient Gets", align: "right", render: (r: any) => <span className="text-blue-600 font-medium">{fmt(r.net_amount)}</span> },
    { key: "status", label: "Status", render: (r: any) => <StatusBadge status={r.status} /> },
    { key: "created_at", label: "Date", render: (r: any) => fmtDateTime(r.created_at) },
    {
      key: "actions",
      label: "Actions",
      render: (r: any) => (
        <RowActionsMenu label={`Open actions for gift ${r.id}`}>
          <DropdownMenuItem onSelect={() => setDetailTarget({ title: `Gift Details: ${r.id}`, endpoint: `/api/admin/gifts/${encodeURIComponent(r.id)}/details` })}>
            View details
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => runGiftAction("Mark gift invested", () => patchGiftMutation.mutateAsync({ giftId: r.id, payload: { status: "invested" } }))}>
            Set invested
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => runGiftAction("Mark gift settled", () => patchGiftMutation.mutateAsync({ giftId: r.id, payload: { status: "settled" } }))}>
            Set settled
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            className="text-red-700 focus:text-red-700"
            disabled={!isSuperAdmin}
            onSelect={() => runGiftAction("Mark gift failed", () => patchGiftMutation.mutateAsync({ giftId: r.id, payload: { status: "failed" } }), "Mark this gift as failed?")}
          >
            Mark failed
          </DropdownMenuItem>
        </RowActionsMenu>
      ),
    },
  ];
  const advancedColumns = [
    { key: "event_name", label: "Event", render: (r: any) => r.event_name || <span className="text-muted-foreground text-xs">Direct</span> },
    { key: "processing_fee", label: "Processing", align: "right", render: (r: any) => <span className="text-red-600">{fmt(r.processing_fee)}</span> },
    { key: "kora_fee", label: "Platform Fee", align: "right", render: (r: any) => {
      const fee = parseFloat(r.kora_fee || "0");
      return fee > 0 ? <span className="text-green-600 font-medium">{fmt(fee)}</span> : <span className="text-muted-foreground text-xs">Waived</span>;
    }},
    { key: "execution_model", label: "Model", render: (r: any) => <span className="text-xs">{r.execution_model || "auto_invest"}</span> },
    { key: "has_event_pass", label: "Pass", render: (r: any) => r.has_event_pass ? <StatusBadge status="Pass" map={{ Pass: "bg-amber-100 text-amber-700" }} /> : "" },
  ];
  const columns = showAdvanced ? [...baseColumns, ...advancedColumns] : baseColumns;

  const chargedGifts = safeGifts.filter((g: any) => {
    const status = String(g.status || "").toLowerCase();
    return !["failed", "refunded", "canceled"].includes(status);
  });
  const totalCharged = chargedGifts.reduce((s, g) => {
    const explicit = toNumSafe(g.gross_charged ?? g.transaction_amount ?? NaN);
    if (Number.isFinite(explicit)) return s + explicit;
    const amount = toNumSafe(g.amount);
    const net = toNumSafe(g.net_amount);
    const fees = toNumSafe(g.processing_fee) + toNumSafe(g.kora_fee);
    return s + (net < amount ? amount : amount + fees);
  }, 0);
  const totalKoraFees = chargedGifts.reduce((s, g) => s + toNumSafe(g.kora_fee), 0);
  const totalProcessing = chargedGifts.reduce((s, g) => s + toNumSafe(g.processing_fee), 0);
  const totalNet = chargedGifts.reduce((s, g) => s + toNumSafe(g.net_amount), 0);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="font-heading text-lg font-semibold" data-testid="heading-gifts-tab">All Gifts ({visibleGifts.length}{visibleGifts.length !== safeGifts.length ? ` of ${safeGifts.length}` : ""})</h2>
        <div className="flex items-center gap-3">
          <button
            onClick={handleExportGifts}
            className="text-xs text-primary hover:underline"
            data-testid="button-gifts-export-csv"
          >
            Export CSV
          </button>
          <button
            onClick={() => setShowAdvanced((v) => !v)}
            className="text-xs text-muted-foreground hover:text-foreground"
            data-testid="button-gifts-advanced-toggle"
          >
            {showAdvanced ? "Hide advanced columns" : "Show advanced columns"}
          </button>
        </div>
      </div>
      {parsedGifts.degraded && (
        <div className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-800">
          Gifts tab is in fallback mode. {parsedGifts.queryErrors?.join(" | ")}
        </div>
      )}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard label="Total Charged" value={fmt(totalCharged)} icon={CreditCard} color="primary" sub="What gifters paid" />
        <StatCard label="Processing Fees" value={fmt(totalProcessing)} icon={CreditCard} color="red" sub="Goes to Stripe" />
        <StatCard label="Kiddo Fees" value={fmt(totalKoraFees)} icon={TrendingUp} color="green" sub="Large gift premiums and services" />
        <StatCard label="Net to Recipients" value={fmt(totalNet)} icon={Gift} color="blue" sub="Invested for kids" />
      </div>
      <div className="bg-card rounded-xl border border-border/50 overflow-hidden">
        {showAdvanced && (
          <div className="px-3 py-2 border-b border-border/50 text-[11px] text-muted-foreground">
            Advanced view enabled. Scroll horizontally to see all columns.
          </div>
        )}
        <SortableTable columns={columns} data={visibleGifts} defaultSort="created_at" />
      </div>
      {detailTarget && (
        <AdminDetailModal
          title={detailTarget.title}
          endpoint={detailTarget.endpoint}
          onClose={() => setDetailTarget(null)}
        />
      )}
    </div>
  );
}

function GiftersTab() {
  const [detailTarget, setDetailTarget] = useState<{ title: string; endpoint: string } | null>(null);
  const search = useSearch();
  const params = getSafeSearchParams(search);
  const senderEmailFilter = params.get("senderEmail") || "";
  const senderNameFilter = params.get("senderName") || "";

  const { data: gifters = [], isLoading, isError, error } = useQuery<any[]>({
    queryKey: ["/api/admin/gifters?limit=500"],
    queryFn: async () => fetchAdminJson("/api/admin/gifters?limit=500"),
    refetchInterval: 30000,
    refetchOnWindowFocus: true,
    retry: 1,
  });

  if (isLoading) return <div className="text-center py-12 text-muted-foreground">Loading gifters...</div>;
  if (isError) return <div className="text-center py-12 text-muted-foreground">Could not load gifters. {(error as any)?.message || ""}</div>;

  const safeGifters = asArray<any>(gifters);
  const visibleGifters = safeGifters.filter((g: any) => {
    if (!senderEmailFilter && !senderNameFilter) return true;
    const email = String(g.sender_email || "").toLowerCase();
    const name = String(g.sender_name || "");
    const emailMatch = senderEmailFilter ? email === senderEmailFilter.toLowerCase() : true;
    const nameMatch = senderNameFilter ? name === senderNameFilter : true;
    return emailMatch && nameMatch;
  });

  const totalGross = visibleGifters.reduce((sum, g) => sum + Number(g.gross_amount || 0), 0);
  const totalNet = visibleGifters.reduce((sum, g) => sum + Number(g.net_amount || 0), 0);
  const totalGifts = visibleGifters.reduce((sum, g) => sum + Number(g.gift_count || 0), 0);

  const handleExportGifters = () => {
    const headers = ["sender_name", "sender_email", "gift_count", "distinct_funds", "distinct_events", "gross_amount", "net_amount", "first_gift_at", "last_gift_at"];
    const rows = visibleGifters.map((g: any) => [
      g.sender_name || "",
      g.sender_email || "",
      g.gift_count || 0,
      g.distinct_funds || 0,
      g.distinct_events || 0,
      g.gross_amount || 0,
      g.net_amount || 0,
      g.first_gift_at || "",
      g.last_gift_at || "",
    ]);
    downloadCsv(`admin-gifters-${new Date().toISOString().slice(0, 10)}.csv`, headers, rows);
  };

  const columns = [
    { key: "sender_name", label: "Name", render: (r: any) => <span className="font-medium">{r.sender_name}</span> },
    { key: "sender_email", label: "Email", render: (r: any) => <span className="text-xs text-muted-foreground">{r.sender_email}</span> },
    { key: "gift_count", label: "Gifts", align: "right", render: (r: any) => fmtNum(r.gift_count) },
    { key: "distinct_funds", label: "Funds", align: "right", render: (r: any) => fmtNum(r.distinct_funds) },
    { key: "distinct_events", label: "Events", align: "right", render: (r: any) => fmtNum(r.distinct_events) },
    { key: "gross_amount", label: "Gross", align: "right", render: (r: any) => fmt(r.gross_amount) },
    { key: "net_amount", label: "Net", align: "right", render: (r: any) => fmt(r.net_amount) },
    { key: "last_gift_at", label: "Last Gift", render: (r: any) => fmtDateTime(r.last_gift_at) },
    {
      key: "actions",
      label: "Actions",
      render: (r: any) => (
        <button
          className="text-[11px] px-2 py-1 rounded border border-border hover:bg-muted"
          onClick={() => setDetailTarget({
            title: `Gifter Details: ${r.sender_name || r.sender_email}`,
            endpoint: `/api/admin/gifters/details?senderEmail=${encodeURIComponent(String(r.sender_email || ""))}&senderName=${encodeURIComponent(String(r.sender_name || ""))}`,
          })}
        >
          View details
        </button>
      ),
    },
  ];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="font-heading text-lg font-semibold" data-testid="heading-gifters-tab">
          All Gifters ({visibleGifters.length}{visibleGifters.length !== safeGifters.length ? ` of ${safeGifters.length}` : ""})
        </h2>
        <button onClick={handleExportGifters} className="text-xs text-primary hover:underline" data-testid="button-gifters-export-csv">
          Export CSV
        </button>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard label="Gifters" value={fmtNum(visibleGifters.length)} icon={Users} color="blue" />
        <StatCard label="Gift Count" value={fmtNum(totalGifts)} icon={Gift} color="primary" />
        <StatCard label="Gross" value={fmt(totalGross)} icon={CreditCard} color="amber" />
        <StatCard label="Net" value={fmt(totalNet)} icon={Wallet} color="green" />
      </div>
      <div className="bg-card rounded-xl border border-border/50 overflow-hidden">
        <SortableTable columns={columns} data={visibleGifters} defaultSort="gross_amount" />
      </div>
      {detailTarget && (
        <AdminDetailModal
          title={detailTarget.title}
          endpoint={detailTarget.endpoint}
          onClose={() => setDetailTarget(null)}
        />
      )}
    </div>
  );
}

function TransactionsTab({ isSuperAdmin }: { isSuperAdmin: boolean }) {
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [detailTarget, setDetailTarget] = useState<{ title: string; endpoint: string } | null>(null);
  const queryClient = useQueryClient();
  const search = useSearch();
  const params = getSafeSearchParams(search);
  const typeFilter = (params.get("type") || "").toLowerCase();
  const statusFilter = (params.get("status") || "").toLowerCase();
  const { data: allTx = [], isLoading, isError, error } = useQuery<any[]>({
    queryKey: ["/api/admin/transactions"],
    queryFn: async () => fetchAdminJson("/api/admin/transactions"),
    refetchInterval: 30000,
    refetchOnWindowFocus: true,
    retry: 1,
  });

  const patchTxMutation = useMutation({
    mutationFn: async ({ txId, payload }: { txId: string; payload: Record<string, unknown> }) => {
      const res = await fetch(`/api/admin/transactions/${encodeURIComponent(txId)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Failed to update transaction");
      return data;
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["/api/admin/transactions"] });
      await queryClient.invalidateQueries({ queryKey: ["/api/admin/overview"] });
    },
  });

  const runTxAction = async (label: string, fn: () => Promise<unknown>, confirmText?: string) => {
    if (confirmText && !window.confirm(confirmText)) return;
    try {
      await fn();
      window.alert(`${label} complete.`);
    } catch (err: any) {
      window.alert(`${label} failed: ${getAdminErrorMessage(err, "Unknown error")}`);
    }
  };

  if (isLoading) return <div className="text-center py-12 text-muted-foreground">Loading transactions...</div>;
  if (isError) return <div className="text-center py-12 text-muted-foreground">Could not load transactions. {(error as any)?.message || ""}</div>;

  const safeTx = asArray<any>(allTx);
  const visibleTx = safeTx.filter((t: any) => {
    const matchesType = !typeFilter || String(t.type || "").toLowerCase() === typeFilter;
    const matchesStatus = !statusFilter || String(t.status || "").toLowerCase() === statusFilter;
    return matchesType && matchesStatus;
  });

  const giftTx = visibleTx.filter((t: any) => String(t.type || "").toLowerCase() === "gift");
  const grossCharged = giftTx.reduce((sum: number, t: any) => sum + toNumSafe(t.gross_charged ?? t.amount ?? 0), 0);
  const totalNetToFund = giftTx.reduce((sum: number, t: any) => sum + toNumSafe(t.net_amount), 0);
  const totalStripeFees = giftTx.reduce((sum: number, t: any) => sum + toNumSafe(t.processing_fee), 0);
  const totalKoraFees = giftTx.reduce((sum: number, t: any) => sum + toNumSafe(t.kora_fee), 0);

  const handleExportTransactions = () => {
    const headers = [
      "created_at",
      "type",
      "user_email",
      "gross_charged",
      "amount",
      "currency",
      "status",
      "description",
      "fund_name",
      "event_name",
      "stripe_payment_intent_id",
      "stripe_checkout_session_id",
      "stripe_subscription_id",
      "failure_reason",
    ];
    const rows = allTx.map((t: any) => [
      t.created_at,
      t.type,
      t.user_email || "",
      t.gross_charged ?? t.amount ?? 0,
      t.amount || 0,
      t.currency || "usd",
      t.status,
      t.description || "",
      t.fund_name || "",
      t.event_name || "",
      t.stripe_payment_intent_id || "",
      t.stripe_checkout_session_id || "",
      t.stripe_subscription_id || "",
      t.failure_reason || "",
    ]);
    downloadCsv(`admin-transactions-${new Date().toISOString().slice(0, 10)}.csv`, headers, rows);
  };

  const baseColumns = [
    { key: "type", label: "Type", render: (r: any) => {
      const typeMap: Record<string, string> = {
        gift: "bg-blue-100 text-blue-700",
        family_plan: "bg-purple-100 text-purple-700",
        event_pass: "bg-amber-100 text-amber-700",
        subscription_renewal: "bg-purple-100 text-purple-700",
        sell: "bg-red-100 text-red-700",
        withdrawal: "bg-orange-100 text-orange-700",
      };
      return <StatusBadge status={r.type} map={typeMap} />;
    }},
    { key: "user_email", label: "User", render: (r: any) => <span className="text-xs">{r.user_email || "-"}</span> },
    {
      key: "gross_charged",
      label: "Gross Charged",
      align: "right",
      render: (r: any) => <span className="font-semibold">{fmt(r.gross_charged ?? r.amount ?? 0)}</span>,
    },
    {
      key: "net_amount",
      label: "Net to Fund",
      align: "right",
      render: (r: any) => String(r.type || "").toLowerCase() === "gift"
        ? <span className="text-blue-700 font-medium">{fmt(r.net_amount || 0)}</span>
        : <span className="text-muted-foreground text-xs">-</span>,
    },
    {
      key: "processing_fee",
      label: "Stripe Fee",
      align: "right",
      render: (r: any) => String(r.type || "").toLowerCase() === "gift"
        ? <span className="text-red-700">{fmt(r.processing_fee || 0)}</span>
        : <span className="text-muted-foreground text-xs">-</span>,
    },
    {
      key: "kora_fee",
      label: "Platform Fee",
      align: "right",
      render: (r: any) => String(r.type || "").toLowerCase() === "gift"
        ? <span className="text-green-700">{fmt(r.kora_fee || 0)}</span>
        : <span className="text-muted-foreground text-xs">-</span>,
    },
    { key: "status", label: "Status", render: (r: any) => <StatusBadge status={r.status} /> },
    { key: "created_at", label: "Date", render: (r: any) => fmtDateTime(r.created_at) },
    {
      key: "actions",
      label: "Actions",
      render: (r: any) => (
        <RowActionsMenu label={`Open actions for transaction ${r.id}`}>
          <DropdownMenuItem onSelect={() => setDetailTarget({ title: `Transaction Details: ${r.id}`, endpoint: `/api/admin/transactions/${encodeURIComponent(r.id)}/details` })}>
            View details
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => runTxAction("Set completed", () => patchTxMutation.mutateAsync({ txId: r.id, payload: { status: "completed", failureReason: null } }))}>
            Set completed
          </DropdownMenuItem>
          <DropdownMenuItem
            className="text-red-700 focus:text-red-700"
            disabled={!isSuperAdmin}
            onSelect={() => runTxAction("Set failed", () => patchTxMutation.mutateAsync({ txId: r.id, payload: { status: "failed", failureReason: "Marked failed by admin" } }), "Mark this transaction failed?")}
          >
            Set failed
          </DropdownMenuItem>
          <DropdownMenuItem
            disabled={!isSuperAdmin}
            onSelect={() => runTxAction("Set refunded", () => patchTxMutation.mutateAsync({ txId: r.id, payload: { status: "refunded" } }), "Mark this transaction as refunded?")}
          >
            Set refunded
          </DropdownMenuItem>
        </RowActionsMenu>
      ),
    },
  ];
  const advancedColumns = [
    { key: "currency", label: "Currency", render: (r: any) => <span className="uppercase text-xs">{r.currency}</span> },
    { key: "description", label: "Description", render: (r: any) => <span className="text-xs text-muted-foreground truncate max-w-[200px] block">{r.description || "-"}</span> },
    { key: "fund_name", label: "Fund" },
    { key: "event_name", label: "Event", render: (r: any) => r.event_name || "-" },
    { key: "stripe_payment_intent_id", label: "Stripe PI", render: (r: any) => r.stripe_payment_intent_id ? <span className="text-xs font-mono text-muted-foreground">{String(r.stripe_payment_intent_id).slice(0, 15)}...</span> : "-" },
    { key: "failure_reason", label: "Failure", render: (r: any) => r.failure_reason ? <span className="text-xs text-red-600">{r.failure_reason}</span> : "" },
  ];
  const columns = showAdvanced ? [...baseColumns, ...advancedColumns] : baseColumns;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="font-heading text-lg font-semibold" data-testid="heading-transactions-tab">All Transactions ({visibleTx.length}{visibleTx.length !== safeTx.length ? ` of ${safeTx.length}` : ""})</h2>
        <div className="flex items-center gap-3">
          <button
            onClick={handleExportTransactions}
            className="text-xs text-primary hover:underline"
            data-testid="button-transactions-export-csv"
          >
            Export CSV
          </button>
          <button
            onClick={() => setShowAdvanced((v) => !v)}
            className="text-xs text-muted-foreground hover:text-foreground"
            data-testid="button-transactions-advanced-toggle"
          >
            {showAdvanced ? "Hide advanced columns" : "Show advanced columns"}
          </button>
        </div>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard label="Gross Charged" value={fmt(grossCharged)} icon={CreditCard} color="primary" sub="Gift transactions" />
        <StatCard label="Net to Fund" value={fmt(totalNetToFund)} icon={Wallet} color="blue" sub="Gift amount invested" />
        <StatCard label="Stripe Fees" value={fmt(totalStripeFees)} icon={CreditCard} color="red" sub="Payment processing" />
        <StatCard label="Kiddo Fees" value={fmt(totalKoraFees)} icon={TrendingUp} color="green" sub="Kiddo service fees" />
      </div>
      <div className="text-xs text-muted-foreground bg-card border border-border/50 rounded-lg px-3 py-2">
        Reconciliation: Gross Charged ({fmt(grossCharged)}) = Net to Fund ({fmt(totalNetToFund)}) + Stripe Fees ({fmt(totalStripeFees)}) + Kiddo Fees ({fmt(totalKoraFees)}).
      </div>
      <div className="bg-card rounded-xl border border-border/50 overflow-hidden">
        {showAdvanced && (
          <div className="px-3 py-2 border-b border-border/50 text-[11px] text-muted-foreground">
            Advanced view enabled. Scroll horizontally to see all columns.
          </div>
        )}
        <SortableTable columns={columns} data={visibleTx} defaultSort="created_at" />
      </div>
      {detailTarget && (
        <AdminDetailModal
          title={detailTarget.title}
          endpoint={detailTarget.endpoint}
          onClose={() => setDetailTarget(null)}
        />
      )}
    </div>
  );
}

function AssetsTab() {
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [universeSearch, setUniverseSearch] = useState("");
  const [universeMode, setUniverseMode] = useState<"all" | "held" | "gifted" | "available">("all");
  const queryClient = useQueryClient();
  const { data, isLoading, isError, error } = useQuery<any>({
    queryKey: ["/api/admin/assets"],
    queryFn: async () => {
      const res = await fetch("/api/admin/assets", { credentials: "include" });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) {
        if (res.status === 401 || res.status === 403) {
          throw new Error("Not authorized to view admin assets.");
        }
        throw new Error(payload?.error || "Failed to fetch assets");
      }
      return payload;
    },
    retry: 1,
    refetchInterval: 30000,
    refetchOnWindowFocus: true,
  });

  if (isLoading) return <div className="text-center py-12 text-muted-foreground">Loading assets...</div>;
  if (isError || !data) {
    return (
      <div className="space-y-3">
        <div className="text-center py-8 text-muted-foreground">Asset data is unavailable right now. {(error as any)?.message || ""}</div>
        <div className="flex justify-center">
          <button
            className="text-sm text-primary hover:underline"
            onClick={() => queryClient.invalidateQueries({ queryKey: ["/api/admin/assets"] })}
          >
            Retry loading assets
          </button>
        </div>
      </div>
    );
  }

  const holdings = asArray<any>(data.holdings);
  const giftedTickers = asArray<any>(data.giftedTickers);
  const fundStrategies = asArray<any>(data.fundStrategies);
  const executionModels = asArray<any>(data.executionModels);
  const supportedUniverse = asArray<any>(data.supportedUniverse);
  const reconciliation = data.reconciliation || {};
  const diagnostics = data.diagnostics || {};

  const holdingsColumns = [
    { key: "ticker", label: "Ticker", render: (r: any) => <span className="font-mono font-semibold">{r.ticker}</span> },
    { key: "knownName", label: "Asset", render: (r: any) => <span className="text-sm">{r.knownName || r.name || r.ticker}</span> },
    { key: "assetType", label: "Type", render: (r: any) => <StatusBadge status={r.assetType} map={{ ETF: "bg-blue-100 text-blue-700", Stock: "bg-amber-100 text-amber-700" }} /> },
    { key: "funds", label: "Funds", align: "right", render: (r: any) => fmtNum(r.funds) },
    { key: "positions", label: "Positions", align: "right", render: (r: any) => fmtNum(r.positions) },
    { key: "total_shares", label: "Shares", align: "right", render: (r: any) => Number(r.total_shares || 0).toLocaleString(undefined, { maximumFractionDigits: 4 }) },
    { key: "total_cost_basis", label: "Cost Basis", align: "right", render: (r: any) => fmt(r.total_cost_basis) },
    { key: "total_value", label: "Value", align: "right", render: (r: any) => fmt(r.total_value) },
    { key: "total_gain", label: "Gain", align: "right", render: (r: any) => <span className={Number(r.total_gain || 0) >= 0 ? "text-green-700" : "text-red-700"}>{fmt(r.total_gain)}</span> },
  ];

  const giftedColumns = [
    { key: "ticker", label: "Ticker", render: (r: any) => <span className="font-mono font-semibold">{r.ticker}</span> },
    { key: "knownName", label: "Asset", render: (r: any) => r.knownName || r.ticker },
    { key: "assetType", label: "Type", render: (r: any) => <StatusBadge status={r.assetType} map={{ ETF: "bg-blue-100 text-blue-700", Stock: "bg-amber-100 text-amber-700" }} /> },
    { key: "gift_count", label: "Gift Count", align: "right", render: (r: any) => fmtNum(r.gift_count) },
    { key: "pending_count", label: "Pending", align: "right", render: (r: any) => fmtNum(r.pending_count) },
    { key: "total_net_amount", label: "Net Amount", align: "right", render: (r: any) => fmt(r.total_net_amount) },
  ];

  const universeColumns = [
    { key: "ticker", label: "Ticker", render: (r: any) => <span className="font-mono font-semibold">{r.ticker}</span> },
    { key: "name", label: "Asset Name", render: (r: any) => <span className="inline-block max-w-[220px] truncate" title={String(r.name || "")}>{r.name || "-"}</span> },
    { key: "type", label: "Type", render: (r: any) => <StatusBadge status={r.type} map={{ ETF: "bg-blue-100 text-blue-700", Stock: "bg-amber-100 text-amber-700" }} /> },
    {
      key: "source",
      label: "Availability",
      render: (r: any) => {
        const src = String(r.source || "");
        const label = src === "auto_invest" ? "Auto"
          : src === "stock_pick" ? "Pick"
          : src === "both" ? "Both"
          : src;
        return <StatusBadge status={label || "-"} map={{ Auto: "bg-blue-100 text-blue-700", Pick: "bg-amber-100 text-amber-700", Both: "bg-purple-100 text-purple-700", "-": "bg-gray-100 text-gray-600" }} />;
      },
    },
    { key: "enabled", label: "Enabled", render: (r: any) => <StatusBadge status={r.enabled === false ? "No" : "Yes"} map={{ Yes: "bg-green-100 text-green-700", No: "bg-gray-100 text-gray-600" }} /> },
    { key: "isCurrentlyHeld", label: "Held", render: (r: any) => <StatusBadge status={r.isCurrentlyHeld ? "Yes" : "No"} map={{ Yes: "bg-green-100 text-green-700", No: "bg-gray-100 text-gray-600" }} /> },
    { key: "hasGiftDemand", label: "Gifted", render: (r: any) => <StatusBadge status={r.hasGiftDemand ? "Yes" : "No"} map={{ Yes: "bg-green-100 text-green-700", No: "bg-gray-100 text-gray-600" }} /> },
  ];

  const strategyColumns = [
    { key: "strategy", label: "Fund Strategy" },
    { key: "fund_count", label: "Fund Count", align: "right", render: (r: any) => fmtNum(r.fund_count) },
  ];
  const executionColumns = [
    { key: "execution_model", label: "Gift Execution" },
    { key: "gift_count", label: "Gift Count", align: "right", render: (r: any) => fmtNum(r.gift_count) },
    { key: "total_net_amount", label: "Net Amount", align: "right", render: (r: any) => fmt(r.total_net_amount) },
  ];

  const totalHoldingsValue = holdings.reduce((sum: number, row: any) => sum + Number(row.total_value || 0), 0);
  const totalHeldTickers = holdings.length;
  const totalGiftedTickers = giftedTickers.length;
  const totalSupported = supportedUniverse.length;
  const investedDelta = Number(reconciliation.investedDelta || 0);
  const pendingDelta = Number(reconciliation.pendingDelta || 0);
  const investedMatches = Math.abs(investedDelta) < 0.01;
  const pendingMatches = Math.abs(pendingDelta) < 0.01;
  const filteredUniverse = supportedUniverse.filter((row: any) => {
    const ticker = String(row.ticker || "").toLowerCase();
    const name = String(row.name || "").toLowerCase();
    const q = universeSearch.trim().toLowerCase();
    const matchesSearch = !q || ticker.includes(q) || name.includes(q);
    const matchesMode =
      universeMode === "all"
        ? true
        : universeMode === "held"
          ? Boolean(row.isCurrentlyHeld)
          : universeMode === "gifted"
            ? Boolean(row.hasGiftDemand)
            : !Boolean(row.isCurrentlyHeld) && !Boolean(row.hasGiftDemand);
    return matchesSearch && matchesMode;
  });

  const exportAssets = () => {
    const headers = ["ticker", "name", "type", "funds", "positions", "shares", "cost_basis", "value", "gain"];
    const rows = holdings.map((h: any) => [
      h.ticker,
      h.knownName || h.name || "",
      h.assetType || "",
      h.funds || 0,
      h.positions || 0,
      h.total_shares || 0,
      h.total_cost_basis || 0,
      h.total_value || 0,
      h.total_gain || 0,
    ]);
    downloadCsv(`admin-assets-holdings-${new Date().toISOString().slice(0, 10)}.csv`, headers, rows);
  };

  return (
    <div className="space-y-4">
      {data?.degraded && (
        <div className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-800">
          Asset data is partially unavailable in this environment. Showing available subsets.
          {data?.error ? ` (${data.error})` : ""}
          {Array.isArray(data?.queryErrors) && data.queryErrors.length > 0 ? ` [${data.queryErrors.join(" | ")}]` : ""}
        </div>
      )}
      <div className="flex items-center justify-between">
        <h2 className="font-heading text-lg font-semibold" data-testid="heading-assets-tab">Assets & Universe</h2>
        <div className="flex items-center gap-3">
          <button onClick={exportAssets} className="text-xs text-primary hover:underline" data-testid="button-assets-export-csv">Export Holdings CSV</button>
          <button onClick={() => setShowAdvanced((v) => !v)} className="text-xs text-muted-foreground hover:text-foreground" data-testid="button-assets-advanced-toggle">
            {showAdvanced ? "Hide universe table" : "Show universe table"}
          </button>
        </div>
      </div>

      <div className="bg-card rounded-xl border border-border/50 p-4 space-y-2">
        <p className="text-sm font-semibold">What “Supported Universe” means</p>
        <p className="text-xs text-muted-foreground">
          This is the configured list of tickers Kiddo allows in product flows. It is not every market ticker.
          “Auto-invest basket” assets are used by auto allocations. “Stock pick list” assets are selectable by gifters.
          “Held” means at least one current position exists. “Gifted” means at least one gift targeted that ticker.
        </p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard label="Held Tickers" value={fmtNum(totalHeldTickers)} icon={BarChart3} color="blue" />
        <StatCard label="Gifted Tickers" value={fmtNum(totalGiftedTickers)} icon={Gift} color="amber" />
        <StatCard label="Supported Universe" value={fmtNum(totalSupported)} icon={Shield} color="primary" />
        <StatCard label="Holdings Value" value={fmt(totalHoldingsValue)} icon={Wallet} color="green" />
      </div>

      <div className="bg-card rounded-xl border border-border/50 p-4 space-y-2">
        <div className="text-sm font-semibold">Reconciliation</div>
        <div className="text-xs text-muted-foreground">
          Funds Invested ({fmt(reconciliation.fundsInvested)}) vs Holdings Value ({fmt(reconciliation.holdingsValue)}) = Delta {fmt(investedDelta)} {investedMatches ? "(OK)" : "(Mismatch)"}
        </div>
        <div className="text-xs text-muted-foreground">
          Funds Pending ({fmt(reconciliation.fundsPending)}) vs Pending Gift Net ({fmt(reconciliation.giftsNetPending)}) = Delta {fmt(pendingDelta)} {pendingMatches ? "(OK)" : "(Mismatch)"}
        </div>
        <div className="text-xs text-muted-foreground">
          Raw rows: holdings {fmtNum(diagnostics.rawHoldingsCount)} · gifts {fmtNum(diagnostics.rawGiftsCount)} · funds {fmtNum(diagnostics.rawFundsCount)}
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        <div className="bg-card rounded-xl border border-border/50 overflow-hidden">
          <div className="px-3 py-2 border-b border-border/50 text-sm font-semibold">Fund Strategies</div>
          <SortableTable columns={strategyColumns} data={fundStrategies} defaultSort="fund_count" />
        </div>
        <div className="bg-card rounded-xl border border-border/50 overflow-hidden">
          <div className="px-3 py-2 border-b border-border/50 text-sm font-semibold">Gift Execution Mix</div>
          <SortableTable columns={executionColumns} data={executionModels} defaultSort="gift_count" />
        </div>
      </div>

      <div className="bg-card rounded-xl border border-border/50 overflow-hidden">
        <div className="px-3 py-2 border-b border-border/50 text-sm font-semibold">Holdings by Ticker</div>
        <SortableTable columns={holdingsColumns} data={holdings} defaultSort="total_value" />
      </div>

      <div className="bg-card rounded-xl border border-border/50 overflow-hidden">
        <div className="px-3 py-2 border-b border-border/50 text-sm font-semibold">Stock/ETF Demand from Gift Picks</div>
        <SortableTable columns={giftedColumns} data={giftedTickers} defaultSort="total_net_amount" />
      </div>

      {showAdvanced && (
        <div className="bg-card rounded-xl border border-border/50 overflow-hidden">
          <div className="px-3 py-2 border-b border-border/50 text-sm font-semibold">Configured Supported Universe (Stocks, ETFs, Types)</div>
          <div className="px-3 py-2 border-b border-border/50 text-[11px] text-muted-foreground">
            Scroll horizontally for full details. Use filters to reduce visual clutter.
          </div>
          <div className="px-3 py-2 border-b border-border/50 flex flex-wrap items-center gap-2">
            <input
              value={universeSearch}
              onChange={(e) => setUniverseSearch(e.target.value)}
              placeholder="Search ticker or name"
              className="h-8 px-2 rounded border border-border bg-background text-xs"
              data-testid="input-assets-universe-search"
            />
            <button className={`text-[11px] px-2 py-1 rounded border ${universeMode === "all" ? "border-primary text-primary" : "border-border"}`} onClick={() => setUniverseMode("all")}>All</button>
            <button className={`text-[11px] px-2 py-1 rounded border ${universeMode === "held" ? "border-primary text-primary" : "border-border"}`} onClick={() => setUniverseMode("held")}>Held</button>
            <button className={`text-[11px] px-2 py-1 rounded border ${universeMode === "gifted" ? "border-primary text-primary" : "border-border"}`} onClick={() => setUniverseMode("gifted")}>Gifted</button>
            <button className={`text-[11px] px-2 py-1 rounded border ${universeMode === "available" ? "border-primary text-primary" : "border-border"}`} onClick={() => setUniverseMode("available")}>Unused</button>
            <span className="text-[11px] text-muted-foreground ml-auto">{fmtNum(filteredUniverse.length)} shown</span>
          </div>
          <SortableTable columns={universeColumns} data={filteredUniverse} defaultSort="ticker" />
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────
// AUDIT TAB — every admin keystroke that mutates state lands in audit_logs
// via writeAudit(). This tab makes that history queryable.
// ─────────────────────────────────────────────────────────────────────
function AuditTab() {
  const [actionFilter, setActionFilter] = useState("");
  const [resourceFilter, setResourceFilter] = useState("");
  const [limit, setLimit] = useState(100);
  const params = new URLSearchParams();
  if (actionFilter.trim()) params.set("action", actionFilter.trim());
  if (resourceFilter.trim()) params.set("resource", resourceFilter.trim());
  params.set("limit", String(limit));
  const queryUrl = `/api/admin/audit?${params.toString()}`;
  const { data, isLoading, isError, error } = useQuery<{ rows: any[] }>({
    queryKey: [queryUrl],
    queryFn: async () => fetchAdminJson(queryUrl),
    refetchInterval: 60000,
  });
  const rows = asArray<any>(data?.rows);
  const columns = [
    { key: "created_at", label: "When", render: (r: any) => <span className="text-[11px] text-muted-foreground tabular-nums">{fmtDateTime(r.created_at)}</span> },
    { key: "actor_email", label: "Actor", render: (r: any) => <span className="text-xs">{r.actor_email || r.actor_user_id || "-"}</span> },
    { key: "action", label: "Action", render: (r: any) => <span className="font-mono text-[11px]">{r.action}</span> },
    { key: "resource", label: "Resource", render: (r: any) => <span className="text-[11px] text-muted-foreground">{r.resource}</span> },
    { key: "resource_id", label: "ID", render: (r: any) => r.resource_id ? <span className="font-mono text-[10px] text-muted-foreground">{String(r.resource_id).slice(0, 16)}</span> : <span className="text-[11px] text-muted-foreground/60">-</span> },
    { key: "metadata", label: "Metadata", render: (r: any) => r.metadata ? <details className="text-[10px]"><summary className="cursor-pointer text-muted-foreground">view</summary><pre className="mt-1 max-w-md overflow-auto rounded bg-muted/40 p-2">{typeof r.metadata === "string" ? r.metadata : JSON.stringify(r.metadata, null, 2)}</pre></details> : <span className="text-[11px] text-muted-foreground/60">-</span> },
  ];
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h2 className="font-heading text-lg font-semibold" data-testid="heading-audit-tab">Audit log ({fmtNum(rows.length)} shown)</h2>
        <div className="flex items-center gap-2">
          <input value={actionFilter} onChange={(e) => setActionFilter(e.target.value)} placeholder="filter action…" className="h-8 rounded border border-border bg-background px-2 text-xs w-40" />
          <input value={resourceFilter} onChange={(e) => setResourceFilter(e.target.value)} placeholder="resource…" className="h-8 rounded border border-border bg-background px-2 text-xs w-32" />
          <select value={limit} onChange={(e) => setLimit(parseInt(e.target.value, 10))} className="h-8 rounded border border-border bg-background px-2 text-xs">
            <option value={50}>50</option>
            <option value={100}>100</option>
            <option value={250}>250</option>
            <option value={500}>500</option>
          </select>
        </div>
      </div>
      <p className="text-xs text-muted-foreground">Every admin mutation writes to audit_logs via writeAudit(). Trace who did what, when, and against which resource. Shows newest first.</p>
      {isLoading && <div className="text-center py-12 text-muted-foreground">Loading audit log…</div>}
      {isError && <div className="text-center py-12 text-muted-foreground">Could not load audit log. {(error as any)?.message || ""}</div>}
      {!isLoading && !isError && <SortableTable columns={columns} data={rows} defaultSort="created_at" />}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────
// MODERATION TAB — memory entries + thank-yous. The memory book is permanent
// — a parent's "test" note or a gifter's profanity stays in Emma's record at
// 18 unless an admin removes it. This is the surface for that.
// ─────────────────────────────────────────────────────────────────────
function ModerationTab() {
  const queryClient = useQueryClient();
  // "queue" is the default-selected section — it leads with the
  // highest-attention work (flagged content + open user reports).
  // Memory + thanks are cross-fund browse views. "Blocked" lists
  // gifters who can't contribute to any fund.
  const [section, setSection] = useState<"queue" | "memory" | "thanks" | "blocked">("queue");
  const { data: blockedData, isLoading: blockedLoading } = useQuery<{ rows: any[] }>({
    queryKey: ["/api/admin/blocked-gifters"],
    queryFn: async () => fetchAdminJson("/api/admin/blocked-gifters"),
    enabled: section === "blocked",
  });
  const blockedRows = asArray<any>(blockedData?.rows);

  const blockGifterMutation = useMutation({
    mutationFn: async ({ email, reason, scope, fundId }: { email: string; reason: string; scope: "global" | "fund"; fundId?: string }) => {
      const res = await fetch(`/api/admin/blocked-gifters`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, reason, scope, fundId }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Block failed");
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/blocked-gifters"] });
    },
    onError: (err: any) => window.alert(`Could not block: ${err?.message || "unknown error"}`),
  });

  const unblockGifterMutation = useMutation({
    mutationFn: async (id: string) => {
      const reason = window.prompt("Reason for unblocking (audit-logged):") || "";
      const res = await fetch(`/api/admin/blocked-gifters/${encodeURIComponent(id)}/unblock`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Unblock failed");
      return data;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/admin/blocked-gifters"] }),
  });

  const handleBlockFromQueue = (email: string | null, reason: string) => {
    if (!email) {
      window.alert("This entry has no gifter email. Can't block from here.");
      return;
    }
    const confirmReason = window.prompt(`Block ${email} globally? Type the reason (audit-logged):`, reason || "") || "";
    if (!confirmReason.trim()) return;
    blockGifterMutation.mutate({ email, reason: confirmReason, scope: "global" });
  };
  const [memoryType, setMemoryType] = useState("");
  const memoryUrl = `/api/admin/memory?limit=200${memoryType ? `&type=${encodeURIComponent(memoryType)}` : ""}`;

  // T&S queue. Polls at 30s to keep the queue fresh without hammering
  // the DB. Auto-refetches on any action mutation (approve/hide/remove/
  // escalate) via invalidation below.
  const { data: queueData, isLoading: queueLoading } = useQuery<any>({
    queryKey: ["/api/admin/moderation/queue"],
    queryFn: async () => fetchAdminJson("/api/admin/moderation/queue"),
    enabled: section === "queue",
    refetchInterval: 30_000,
  });
  const { data: memoryData, isLoading: memLoading } = useQuery<{ rows: any[] }>({
    queryKey: [memoryUrl],
    queryFn: async () => fetchAdminJson(memoryUrl),
    enabled: section === "memory",
  });
  const { data: thanksData, isLoading: thanksLoading } = useQuery<{ rows: any[] }>({
    queryKey: ["/api/admin/thank-yous?limit=200"],
    queryFn: async () => fetchAdminJson("/api/admin/thank-yous?limit=200"),
    enabled: section === "thanks",
  });

  // Manually flag a memory entry from the cross-fund browse view. Useful
  // when an admin spots something concerning while exploring — sends it
  // to the queue for a deliberate decision rather than acting on the
  // browse-row's "Delete" button (which is immediate + irreversible).
  const flagMemoryMutation = useMutation({
    mutationFn: async (id: string) => {
      const reason = window.prompt("Why flag this entry? (Visible to other admins)") || "";
      if (!reason.trim()) throw new Error("Reason required");
      const res = await fetch(`/api/admin/moderation/memory/${encodeURIComponent(id)}/flag`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Failed to flag entry");
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [memoryUrl] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/moderation/queue"] });
    },
  });

  // The four queue actions. Confirmation lives inside the handler so the
  // destructive ones (remove, escalate) require explicit notes — both for
  // the audit trail and to slow the click down enough to think.
  const actionMutation = useMutation({
    mutationFn: async ({ id, action }: { id: string; action: "approve" | "hide" | "remove" | "escalate" }) => {
      const needsNotes = action === "remove" || action === "escalate";
      const promptCopy = action === "approve" ? "Optional note (audit-logged):"
        : action === "hide" ? "Why hide? (audit-logged)"
        : action === "remove" ? "Reason for permanent removal (required, audit-logged):"
        : "Escalation reason (required, sent to on-call + audit-logged):";
      const notes = window.prompt(promptCopy, "") ?? "";
      if (needsNotes && !notes.trim()) throw new Error("Notes required for this action");
      const res = await fetch(`/api/admin/moderation/memory/${encodeURIComponent(id)}/action`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, notes }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Action failed");
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/moderation/queue"] });
      queryClient.invalidateQueries({ queryKey: [memoryUrl] });
    },
    onError: (err: any) => window.alert(`Could not complete action: ${err?.message || "unknown error"}`),
  });

  const deleteMemoryMutation = useMutation({
    mutationFn: async (id: string) => {
      const reason = window.prompt("Reason for deletion (logged to audit):");
      // window.prompt returns null on Cancel/Escape; the old `|| ""` swallowed
      // that and deleted anyway. Abort on cancel, and require a real reason since
      // this is an audit-logged destructive delete.
      if (reason === null) return;
      if (!reason.trim()) { window.alert("A reason is required for the audit log."); return; }
      const res = await fetch(`/api/admin/memory/${encodeURIComponent(id)}`, {
        method: "DELETE",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Failed to delete entry");
      return data;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: [memoryUrl] }),
  });
  const memRows = asArray<any>(memoryData?.rows);
  const thanksRows = asArray<any>(thanksData?.rows);
  const queueEntries = asArray<any>(queueData?.entries);
  const queueReports = asArray<any>(queueData?.reports);
  const queueCounts = (queueData?.counts as { flagged?: number; escalated?: number; openReports?: number }) || {};

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h2 className="font-heading text-lg font-semibold" data-testid="heading-moderation-tab">Trust & Safety</h2>
        <div className="flex items-center gap-2">
          <button onClick={() => setSection("queue")} className={`text-xs px-3 py-1 rounded-full border ${section === "queue" ? "border-primary bg-primary/10 text-primary font-semibold" : "border-border text-muted-foreground"}`}>
            Queue ({(queueCounts.flagged ?? 0) + (queueCounts.escalated ?? 0) + (queueCounts.openReports ?? 0)})
          </button>
          <button onClick={() => setSection("memory")} className={`text-xs px-3 py-1 rounded-full border ${section === "memory" ? "border-primary bg-primary/10 text-primary font-semibold" : "border-border text-muted-foreground"}`}>Memory entries ({memRows.length})</button>
          <button onClick={() => setSection("thanks")} className={`text-xs px-3 py-1 rounded-full border ${section === "thanks" ? "border-primary bg-primary/10 text-primary font-semibold" : "border-border text-muted-foreground"}`}>Thank-yous ({thanksRows.length})</button>
          <button onClick={() => setSection("blocked")} className={`text-xs px-3 py-1 rounded-full border ${section === "blocked" ? "border-primary bg-primary/10 text-primary font-semibold" : "border-border text-muted-foreground"}`}>Blocked ({blockedRows.filter((r) => !r.unblocked_at).length})</button>
        </div>
      </div>

      {section === "queue" && (
        <>
          {/* Three-stat header. Escalated is shown in red because it's
              the regulatory-adjacent state — the eye should land there
              first if any are open. Open reports surfaces user-submitted
              reports that haven't been resolved yet. */}
          <div className="grid grid-cols-3 gap-3">
            <div className="rounded border border-border/60 bg-card p-3">
              <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Flagged</p>
              <p className="mt-1 text-2xl font-bold tabular-nums text-foreground">{queueCounts.flagged ?? 0}</p>
            </div>
            <div className={`rounded border p-3 ${(queueCounts.escalated ?? 0) > 0 ? "border-red-300 bg-red-50/60" : "border-border/60 bg-card"}`}>
              <p className={`text-[10px] uppercase tracking-wide ${(queueCounts.escalated ?? 0) > 0 ? "text-red-700" : "text-muted-foreground"}`}>Escalated</p>
              <p className={`mt-1 text-2xl font-bold tabular-nums ${(queueCounts.escalated ?? 0) > 0 ? "text-red-700" : "text-foreground"}`}>{queueCounts.escalated ?? 0}</p>
            </div>
            <div className="rounded border border-border/60 bg-card p-3">
              <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Open reports</p>
              <p className="mt-1 text-2xl font-bold tabular-nums text-foreground">{queueCounts.openReports ?? 0}</p>
            </div>
          </div>

          <p className="text-xs text-muted-foreground">
            Queue refreshes every 30s. <strong>Approve</strong> marks safe and returns to user surfaces. <strong>Hide</strong> is reversible. <strong>Remove</strong> nulls out the content (audit-row preserved). <strong>Escalate</strong> freezes for evidence and fires an ops alert. Use only for child-safety, abuse, or legal concerns.
          </p>

          {queueLoading ? <div className="text-center py-12 text-muted-foreground">Loading queue…</div> : (
            <>
              {queueEntries.length === 0 && queueReports.length === 0 && (
                <div className="rounded border border-border/60 bg-card p-8 text-center">
                  <p className="text-sm font-semibold text-foreground">Nothing in the queue.</p>
                  <p className="mt-1 text-xs text-muted-foreground">Flagged or escalated memory entries and open user reports will show here.</p>
                </div>
              )}

              {queueEntries.length > 0 && (
                <div className="space-y-3">
                  <p className="kiddo-section-label">Flagged memory entries</p>
                  {queueEntries.map((r) => {
                    const isEscalated = r.moderation_status === "escalated";
                    return (
                      <div key={r.id} className={`rounded border p-3 text-sm ${isEscalated ? "border-red-300 bg-red-50/40" : "border-amber-200 bg-amber-50/30"}`}>
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${isEscalated ? "bg-red-100 text-red-800" : "bg-amber-100 text-amber-800"}`}>{r.moderation_status}</span>
                              <span className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">{r.type}</span>
                              <span className="text-[11px] text-muted-foreground">{r.recipient_first_name || r.fund_name || r.fund_id}</span>
                              <span className="text-[11px] text-muted-foreground/60">· owner: {r.fund_owner_email}</span>
                              <span className="text-[11px] text-muted-foreground/60">· created {fmtDateTime(r.created_at)}</span>
                            </div>
                            <p className="mt-1 text-sm font-semibold text-foreground">{r.author_name || "(no name)"}{r.gift_sender_email ? <span className="text-[11px] font-normal text-muted-foreground"> · gift from {r.gift_sender_email}{r.gift_amount ? ` · $${parseFloat(r.gift_amount).toFixed(2)}` : ""}</span> : null}</p>
                            {r.content && <p className="mt-1 text-sm text-foreground/85 italic">"{r.content}"</p>}
                            {r.audio_url && <p className="mt-1 text-[11px] text-muted-foreground">🎙 audio attached</p>}
                            {r.audio_transcript && <p className="mt-1 text-[11px] italic text-muted-foreground">transcript: "{r.audio_transcript}"</p>}
                            {r.photo_url && <p className="mt-1 text-[11px] text-muted-foreground">📷 <a href={r.photo_url} target="_blank" rel="noreferrer" className="underline">photo</a></p>}
                            {r.video_url && <p className="mt-1 text-[11px] text-muted-foreground">🎥 <a href={r.video_url} target="_blank" rel="noreferrer" className="underline">video</a></p>}
                            <p className="mt-2 text-[11px] text-muted-foreground/80">
                              Flagged {r.flagged_at ? fmtDateTime(r.flagged_at) : "recently"}
                              {r.flagged_reason ? <> · "{r.flagged_reason}"</> : null}
                            </p>
                          </div>
                          <div className="shrink-0 flex flex-col gap-1.5">
                            <button onClick={() => actionMutation.mutate({ id: r.id, action: "approve" })} disabled={actionMutation.isPending} className="text-[11px] px-2.5 py-1 rounded border border-green-300 text-green-800 hover:bg-green-50 disabled:opacity-50">Approve</button>
                            <button onClick={() => actionMutation.mutate({ id: r.id, action: "hide" })} disabled={actionMutation.isPending} className="text-[11px] px-2.5 py-1 rounded border border-border text-muted-foreground hover:bg-muted/40 disabled:opacity-50">Hide</button>
                            <button onClick={() => actionMutation.mutate({ id: r.id, action: "remove" })} disabled={actionMutation.isPending || isEscalated} className="text-[11px] px-2.5 py-1 rounded border border-red-200 text-red-700 hover:bg-red-50 disabled:opacity-50">Remove</button>
                            <button onClick={() => actionMutation.mutate({ id: r.id, action: "escalate" })} disabled={actionMutation.isPending || isEscalated} className="text-[11px] px-2.5 py-1 rounded border border-red-400 bg-red-600 text-white hover:bg-red-700 disabled:opacity-50 font-semibold">Escalate</button>
                            {/* Separate block-sender action. Independent of
                                approve/hide/remove because blocking is about
                                the GIFTER, not this specific content — same
                                bad actor could submit elsewhere later, so
                                blocking is preventive across the platform.
                                Only enabled when we have an email to block. */}
                            {r.gift_sender_email && (
                              <button
                                onClick={() => handleBlockFromQueue(r.gift_sender_email, r.flagged_reason || "")}
                                disabled={blockGifterMutation.isPending}
                                className="text-[11px] px-2.5 py-1 rounded border border-amber-400 text-amber-900 bg-amber-50 hover:bg-amber-100 disabled:opacity-50"
                                title="Globally block this gifter from contributing to any fund"
                              >
                                Block sender
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {queueReports.length > 0 && (
                <div className="space-y-3 mt-6">
                  <p className="kiddo-section-label">Open user reports</p>
                  {queueReports.map((r) => (
                    <div key={r.id} className="rounded border border-border/60 bg-card p-3 text-sm">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">{r.target_type}</span>
                        <code className="text-[10px] font-mono text-muted-foreground/70">{r.target_id}</code>
                        <span className="text-[11px] text-muted-foreground">· reported {fmtDateTime(r.created_at)}</span>
                        <span className="text-[11px] text-muted-foreground/60">· by {r.reporter_lookup_email || r.reporter_email || "anonymous"}</span>
                      </div>
                      <p className="mt-2 text-sm text-foreground/85">"{r.reason}"</p>
                      {r.context && <pre className="mt-1 text-[10px] text-muted-foreground/60 whitespace-pre-wrap">{r.context}</pre>}
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </>
      )}

      {section === "memory" && (
        <>
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">Type:</span>
            {["", "gift_message", "parent_note", "parent_letter", "milestone", "photo", "note", "parent_investment_start"].map(t => (
              <button key={t || "all"} onClick={() => setMemoryType(t)} className={`text-[11px] px-2 py-1 rounded border ${memoryType === t ? "border-primary text-primary" : "border-border text-muted-foreground"}`}>{t || "All"}</button>
            ))}
          </div>
          <p className="text-xs text-muted-foreground">Cross-fund view of every memory_entries row. Delete is permanent and audit-logged with a reason. Test-flagged fund owners marked with a TEST pill.</p>
          {memLoading ? <div className="text-center py-12 text-muted-foreground">Loading…</div> : (
            <div className="space-y-2">
              {memRows.map((r) => (
                <div key={r.id} className="rounded border border-border/60 bg-card p-3 text-sm">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">{r.type}</span>
                        {r.fund_owner_is_test && <span className="rounded-full bg-amber-100 px-1.5 py-0.5 text-[9px] font-bold text-amber-800">TEST USER</span>}
                        {r.visibility && r.visibility !== "kid_now" && <span className="rounded-full bg-blue-100 px-1.5 py-0.5 text-[9px] font-bold text-blue-800">{r.visibility}</span>}
                        <span className="text-[11px] text-muted-foreground">{r.recipient_first_name || r.fund_name || r.fund_id}</span>
                        <span className="text-[11px] text-muted-foreground/60">· {r.fund_owner_email}</span>
                        <span className="text-[11px] text-muted-foreground/60">· {fmtDateTime(r.created_at)}</span>
                      </div>
                      <p className="mt-1 text-sm font-semibold text-foreground">{r.author_name || "-"}</p>
                      {r.content && <p className="mt-1 text-sm text-foreground/85 italic">"{r.content}"</p>}
                      {r.audio_url && <p className="mt-1 text-[11px] text-muted-foreground">🎙 audio attached</p>}
                      {r.audio_transcript && <p className="mt-1 text-[11px] italic text-muted-foreground">transcript: "{r.audio_transcript}"</p>}
                      {r.photo_url && <p className="mt-1 text-[11px] text-muted-foreground">📷 photo attached</p>}
                      {r.video_url && <p className="mt-1 text-[11px] text-muted-foreground">🎥 video attached</p>}
                    </div>
                    <div className="shrink-0 flex flex-col gap-1.5">
                      <button onClick={() => flagMemoryMutation.mutate(r.id)} disabled={flagMemoryMutation.isPending} className="text-[11px] px-2 py-1 rounded border border-amber-300 text-amber-800 hover:bg-amber-50 disabled:opacity-50">Flag</button>
                      <button onClick={() => deleteMemoryMutation.mutate(r.id)} className="text-[11px] text-red-700 hover:underline">Delete</button>
                    </div>
                  </div>
                </div>
              ))}
              {memRows.length === 0 && <div className="text-center py-12 text-muted-foreground text-sm">No memory entries match the filter.</div>}
            </div>
          )}
        </>
      )}
      {section === "thanks" && (
        <>
          <p className="text-xs text-muted-foreground">Recent thank-you messages from parents to gifters. Status: draft, sent, anonymous-skipped, etc.</p>
          {thanksLoading ? <div className="text-center py-12 text-muted-foreground">Loading…</div> : (
            <div className="space-y-2">
              {thanksRows.map((r) => (
                <div key={r.id} className="rounded border border-border/60 bg-card p-3 text-sm">
                  <div className="flex items-center gap-2 flex-wrap">
                    <StatusBadge status={r.status || "unknown"} />
                    <span className="text-[11px] text-muted-foreground">to {r.sender_name || r.sender_email || "anon"}</span>
                    <span className="text-[11px] text-muted-foreground">· for {r.recipient_first_name || r.fund_name}</span>
                    <span className="text-[11px] text-muted-foreground/60">· gift {fmt(r.gift_amount)}</span>
                    <span className="text-[11px] text-muted-foreground/60">· {fmtDateTime(r.created_at)}</span>
                    {r.sent_at && <span className="text-[11px] text-green-700">· sent {fmtDateTime(r.sent_at)}</span>}
                  </div>
                  {r.message && <p className="mt-2 text-sm italic text-foreground/85">"{r.message}"</p>}
                </div>
              ))}
              {thanksRows.length === 0 && <div className="text-center py-12 text-muted-foreground text-sm">No thank-yous yet.</div>}
            </div>
          )}
        </>
      )}

      {section === "blocked" && (
        <>
          <p className="text-xs text-muted-foreground">
            Gifters blocked from contributing to any fund. Block enforcement happens at gift checkout. A matching email is refused before payment. <strong>Unblock</strong> doesn't delete the row; the entry stays visible with both the block + unblock audit trail.
          </p>
          {blockedLoading ? <div className="text-center py-12 text-muted-foreground">Loading…</div> : (
            <div className="space-y-2">
              {blockedRows.map((r) => {
                const isActive = !r.unblocked_at;
                return (
                  <div key={r.id} className={`rounded border p-3 text-sm ${isActive ? "border-red-200 bg-red-50/40" : "border-border/60 bg-card opacity-70"}`}>
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${isActive ? "bg-red-100 text-red-800" : "bg-muted text-muted-foreground"}`}>
                            {isActive ? "active" : "unblocked"}
                          </span>
                          <span className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">{r.scope}</span>
                          {r.fund_id && <span className="text-[11px] text-muted-foreground">· {r.recipient_first_name || r.fund_name}</span>}
                          <span className="text-[11px] text-muted-foreground">· {fmtDateTime(r.blocked_at)}</span>
                          {r.blocker_email && <span className="text-[11px] text-muted-foreground/60">· by {r.blocker_email}</span>}
                        </div>
                        <p className="mt-1 text-sm font-semibold text-foreground">{r.email}</p>
                        {r.reason && <p className="mt-1 text-xs italic text-muted-foreground">"{r.reason}"</p>}
                        {!isActive && (
                          <p className="mt-1 text-[11px] text-muted-foreground/80">
                            Unblocked {fmtDateTime(r.unblocked_at)}
                            {r.unblocker_email ? ` by ${r.unblocker_email}` : ""}
                          </p>
                        )}
                      </div>
                      {isActive && (
                        <button
                          onClick={() => unblockGifterMutation.mutate(r.id)}
                          disabled={unblockGifterMutation.isPending}
                          className="shrink-0 text-[11px] px-2.5 py-1 rounded border border-border text-muted-foreground hover:text-foreground hover:bg-muted/40 disabled:opacity-50"
                        >
                          Unblock
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
              {blockedRows.length === 0 && (
                <div className="rounded border border-border/60 bg-card p-8 text-center">
                  <p className="text-sm font-semibold text-foreground">No blocked gifters.</p>
                  <p className="mt-1 text-xs text-muted-foreground">Block a gifter from the queue's "Block sender" button on a flagged entry.</p>
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────
// OPS TAB — background workers + queues + outboxes (the .local/* JSONL files
// that workers write to). When a parent reports "I didn't get the email",
// this is where you check.
// ─────────────────────────────────────────────────────────────────────
function OpsTab() {
  const [tail, setTail] = useState(50);
  const queryUrl = `/api/admin/ops/queues?tail=${tail}`;
  const { data, isLoading, isError, error } = useQuery<any>({
    queryKey: [queryUrl],
    queryFn: async () => fetchAdminJson(queryUrl),
    refetchInterval: 30000,
  });
  const renderQueue = (title: string, items: any[] | null | undefined) => {
    const list = asArray<any>(items);
    return (
      <div className="rounded border border-border/60 bg-card">
        <div className="flex items-center justify-between gap-2 px-3 py-2 border-b border-border/40">
          <p className="text-sm font-semibold">{title}</p>
          <span className="text-[11px] text-muted-foreground tabular-nums">{fmtNum(list.length)} entries</span>
        </div>
        {list.length === 0 ? <p className="text-xs text-muted-foreground p-3">Empty</p> : (
          <div className="max-h-72 overflow-auto p-2 space-y-1">
            {list.slice(-tail).reverse().map((item, i) => (
              <details key={i} className="rounded bg-muted/30 px-2 py-1 text-[11px]">
                <summary className="cursor-pointer truncate">{item.timestamp || item.createdAt || item.queuedAt || item.deliveredAt || "-"} · {item.type || item.kind || item.event || item.subject || "(untyped)"}</summary>
                <pre className="mt-1 overflow-x-auto whitespace-pre-wrap break-all text-[10px]">{JSON.stringify(item, null, 2)}</pre>
              </details>
            ))}
          </div>
        )}
      </div>
    );
  };
  // Worker triggers — safe-only. Recurring contribution worker is intentionally
  // EXCLUDED from manual triggering (would double-charge cards on mis-click).
  // For per-schedule control, use Loops tab → Recurring → Pause/Resume/Cancel.
  const queryClient2 = useQueryClient();
  const { data: workersData } = useQuery<{ workers: Array<{ key: string; description: string; safeToTrigger: boolean }> }>({
    queryKey: ["/api/admin/ops/workers"],
    queryFn: async () => fetchAdminJson("/api/admin/ops/workers"),
  });
  const triggerWorker = useMutation({
    mutationFn: async (key: string) => {
      const res = await fetch(`/api/admin/ops/workers/${encodeURIComponent(key)}/run`, {
        method: "POST", credentials: "include",
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || data.message || "Worker run failed");
      return data;
    },
    onSuccess: (data) => {
      window.alert(`Worker '${data.key}' ran. Started ${data.startedAt}, finished ${data.finishedAt}.`);
      queryClient2.invalidateQueries({ queryKey: [queryUrl] });
    },
    onError: (err: any) => window.alert(`Worker run failed: ${err?.message || "unknown error"}`),
  });
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h2 className="font-heading text-lg font-semibold" data-testid="heading-ops-tab">Operations</h2>
        <select value={tail} onChange={(e) => setTail(parseInt(e.target.value, 10))} className="h-8 rounded border border-border bg-background px-2 text-xs">
          <option value={20}>last 20</option>
          <option value={50}>last 50</option>
          <option value={100}>last 100</option>
          <option value={200}>last 200</option>
        </select>
      </div>

      {/* Realtime channel health. The dashboard count-up + gift-strip
          arrival animation depend on SSE landing within ~1s of a webhook
          firing. If connections is near zero while tabs are open, almost
          always a reverse-proxy buffering the stream (X-Accel-Buffering
          on nginx, response-buffering on Cloudflare). Polls every 10s
          because a sudden drop is exactly the kind of thing this panel
          exists to catch quickly. */}
      <RealtimeStatsCard />

      {/* Worker triggers — manual fire on demand for safe workers */}
      <div className="rounded border border-border/60 bg-card p-3">
        <p className="text-sm font-semibold mb-2">Manual worker triggers</p>
        <p className="text-xs text-muted-foreground mb-3">Fire a single tick on demand. Workers are idempotent: they check queues + delivery state before sending, so a double-tap is safe. The recurring contribution worker is intentionally NOT exposed (would double-charge cards). Use the Loops tab to manage individual recurring schedules.</p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
          {asArray<any>(workersData?.workers).map((w) => (
            <div key={w.key} className={`rounded border p-2.5 ${w.safeToTrigger ? "border-border/60" : "border-amber-200/60 bg-amber-50/30"}`}>
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-xs font-mono font-semibold">{w.key}</p>
                  <p className="text-[11px] text-muted-foreground mt-0.5 leading-relaxed">{w.description}</p>
                </div>
                {w.safeToTrigger ? (
                  <button
                    onClick={() => { if (window.confirm(`Run '${w.key}' now?`)) triggerWorker.mutate(w.key); }}
                    disabled={triggerWorker.isPending}
                    className="shrink-0 text-[11px] px-2.5 py-1 rounded border border-primary text-primary hover:bg-primary/10 disabled:opacity-50"
                  >
                    {triggerWorker.isPending ? "Running…" : "Run now"}
                  </button>
                ) : (
                  <span className="shrink-0 text-[10px] font-bold text-amber-700">DISABLED</span>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      <p className="text-xs text-muted-foreground">Worker queues + outboxes. Refreshes every 30s. Reads from .local/*.jsonl and .json files written by background workers (gifter notifications, parent lifecycle emails, mobile push, email outbox fallback).</p>
      {isLoading && <div className="text-center py-12 text-muted-foreground">Loading queues…</div>}
      {isError && <div className="text-center py-12 text-muted-foreground">Could not load queues. {(error as any)?.message || ""}</div>}
      {data && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {renderQueue("Email outbox (fallback)", data.emailOutbox)}
          {renderQueue("Gifter notifications: queue", data.gifter?.queue)}
          {renderQueue("Gifter notifications: outbox (sent)", data.gifter?.outbox)}
          {renderQueue("Parent lifecycle: queue", data.parentLifecycle?.queue)}
          {renderQueue("Mobile push: queue", data.mobilePush?.queue)}
          {data.gifter?.deliveries && (
            <div className="rounded border border-border/60 bg-card p-3 md:col-span-2">
              <p className="text-sm font-semibold mb-2">Gifter notification deliveries (state)</p>
              <pre className="max-h-60 overflow-auto rounded bg-muted/30 p-2 text-[10px]">{JSON.stringify(data.gifter.deliveries, null, 2).slice(0, 5000)}</pre>
            </div>
          )}
          {data.parentLifecycle?.deliveries && (
            <div className="rounded border border-border/60 bg-card p-3 md:col-span-2">
              <p className="text-sm font-semibold mb-2">Parent lifecycle deliveries (state)</p>
              <pre className="max-h-60 overflow-auto rounded bg-muted/30 p-2 text-[10px]">{JSON.stringify(data.parentLifecycle.deliveries, null, 2).slice(0, 5000)}</pre>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function RealtimeStatsCard() {
  const { data, isLoading } = useQuery<any>({
    queryKey: ["/api/admin/realtime-stats"],
    queryFn: async () => fetchAdminJson("/api/admin/realtime-stats"),
    refetchInterval: 10_000,
  });
  const totalConnections = Number(data?.totalConnections ?? 0);
  const totalUsers = Number(data?.totalUsers ?? 0);
  const pid = data?.pid;
  const uptime = Number(data?.uptimeSeconds ?? 0);
  const uptimeLabel = uptime > 3600 ? `${Math.floor(uptime / 3600)}h ${Math.floor((uptime % 3600) / 60)}m` : `${Math.floor(uptime / 60)}m ${uptime % 60}s`;
  // Health heuristic: if process has been up > 5 min AND no connections,
  // worth raising. Fresh restarts can legitimately read zero for a beat.
  const possiblyUnhealthy = uptime > 300 && totalConnections === 0;
  return (
    <div className="rounded border border-border/60 bg-card p-3">
      <div className="flex items-center justify-between gap-2 mb-2">
        <p className="text-sm font-semibold">Realtime (SSE) channel</p>
        <span className="text-[10px] text-muted-foreground">refreshes 10s</span>
      </div>
      {isLoading ? (
        <p className="text-xs text-muted-foreground">Loading…</p>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Stat label="Connections" value={fmtNum(totalConnections)} accent={possiblyUnhealthy ? "warn" : "default"} />
          <Stat label="Unique users" value={fmtNum(totalUsers)} />
          <Stat label="Process uptime" value={uptimeLabel} />
          <Stat label="PID" value={pid ? String(pid) : "—"} />
        </div>
      )}
      {possiblyUnhealthy && (
        <p className="mt-3 text-[11px] text-amber-700">
          No active SSE connections after 5+ min of uptime. Check: (1) a reverse proxy may be buffering text/event-stream (set X-Accel-Buffering: no for nginx), (2) the /api/me/events endpoint may be 401-ing for signed-in users, (3) the EventSource may be blocked by CSP connect-src on a recent deploy.
        </p>
      )}
    </div>
  );
}

function Stat({ label, value, accent }: { label: string; value: string; accent?: "warn" | "default" }) {
  return (
    <div className={`rounded p-2 ${accent === "warn" ? "bg-amber-50/60 border border-amber-200/50" : "bg-muted/40"}`}>
      <p className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className={`text-base font-bold tabular-nums ${accent === "warn" ? "text-amber-700" : "text-foreground"}`}>{value}</p>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────
// LOOPS TAB — the social/lifecycle loop tables that didn't have admin
// surfaces: referral_events, parent_contributions (recurring), kid view
// share links, fund_collaborators. Quad-section.
// ─────────────────────────────────────────────────────────────────────
function LoopsTab() {
  const queryClient = useQueryClient();
  const [section, setSection] = useState<"recurring" | "referrals" | "kidviews" | "collabs">("recurring");

  const { data: recurringData, isLoading: recLoading } = useQuery<{ rows: any[] }>({
    queryKey: ["/api/admin/recurring?limit=200"],
    queryFn: async () => fetchAdminJson("/api/admin/recurring?limit=200"),
    enabled: section === "recurring",
  });
  const { data: referralsData, isLoading: refLoading } = useQuery<{ rows: any[]; summary: any[] }>({
    queryKey: ["/api/admin/referral-events?limit=200"],
    queryFn: async () => fetchAdminJson("/api/admin/referral-events?limit=200"),
    enabled: section === "referrals",
  });
  const { data: kidViewsData, isLoading: kvLoading } = useQuery<{ rows: any[] }>({
    queryKey: ["/api/admin/kid-views"],
    queryFn: async () => fetchAdminJson("/api/admin/kid-views"),
    enabled: section === "kidviews",
  });
  const { data: collabsData, isLoading: collabsLoading } = useQuery<{ rows: any[] }>({
    queryKey: ["/api/admin/collaborators?limit=200"],
    queryFn: async () => fetchAdminJson("/api/admin/collaborators?limit=200"),
    enabled: section === "collabs",
  });

  const patchRecurring = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const res = await fetch(`/api/admin/recurring/${encodeURIComponent(id)}`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      if (!res.ok) throw new Error("Failed to update");
      return res.json();
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/admin/recurring?limit=200"] }),
  });

  const revokeKidView = useMutation({
    mutationFn: async (fundId: string) => {
      const res = await fetch(`/api/admin/kid-views/${encodeURIComponent(fundId)}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to revoke");
      return res.json();
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/admin/kid-views"] }),
  });

  const recRows = asArray<any>(recurringData?.rows);
  const refRows = asArray<any>(referralsData?.rows);
  const refSummary = asArray<any>(referralsData?.summary);
  const kvRows = asArray<any>(kidViewsData?.rows);
  const collabRows = asArray<any>(collabsData?.rows);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h2 className="font-heading text-lg font-semibold" data-testid="heading-loops-tab">Loops</h2>
        <div className="flex items-center gap-2 flex-wrap">
          {[
            ["recurring", `Recurring (${recRows.length})`],
            ["referrals", `Referral events (${refRows.length})`],
            ["kidviews", `Kid views (${kvRows.length})`],
            ["collabs", `Collaborators (${collabRows.length})`],
          ].map(([key, label]) => (
            <button key={key} onClick={() => setSection(key as any)} className={`text-xs px-3 py-1 rounded-full border ${section === key ? "border-primary bg-primary/10 text-primary font-semibold" : "border-border text-muted-foreground"}`}>{label}</button>
          ))}
        </div>
      </div>

      {section === "recurring" && (
        <>
          <p className="text-xs text-muted-foreground">All parent_contributions (recurring schedules) across all funds. Pause/resume/cancel as admin when a parent reports a stuck schedule.</p>
          {recLoading ? <div className="text-center py-12 text-muted-foreground">Loading…</div> : (
            <SortableTable
              defaultSort="created_at"
              data={recRows}
              columns={[
                { key: "status", label: "Status", render: (r: any) => <StatusBadge status={r.status} /> },
                { key: "user_email", label: "Parent", render: (r: any) => <span className="text-xs">{r.user_email || r.user_first_name || r.user_id}</span> },
                { key: "recipient_first_name", label: "For", render: (r: any) => <span className="text-xs">{r.recipient_first_name || r.fund_name || "-"}</span> },
                { key: "amount", label: "Amount", align: "right", render: (r: any) => <span className="text-xs tabular-nums">${parseFloat(String(r.amount || 0)).toFixed(2)}/{r.frequency || "month"}</span> },
                { key: "selected_ticker", label: "Target", render: (r: any) => <span className="text-xs font-mono">{r.selected_ticker || r.execution_model || "auto"}</span> },
                { key: "total_contributed", label: "Total", align: "right", render: (r: any) => <span className="text-xs tabular-nums">${parseFloat(String(r.total_contributed || 0)).toFixed(2)}</span> },
                { key: "next_run_date", label: "Next run", render: (r: any) => <span className="text-[11px] text-muted-foreground">{fmtDate(r.next_run_date)}</span> },
                { key: "last_run_date", label: "Last run", render: (r: any) => <span className="text-[11px] text-muted-foreground">{fmtDate(r.last_run_date)}</span> },
                { key: "actions", label: "Actions", render: (r: any) => (
                  <div className="flex gap-1">
                    {r.status === "active" && <button onClick={() => patchRecurring.mutate({ id: r.id, status: "paused" })} className="text-[11px] text-amber-700 hover:underline">Pause</button>}
                    {r.status === "paused" && <button onClick={() => patchRecurring.mutate({ id: r.id, status: "active" })} className="text-[11px] text-green-700 hover:underline">Resume</button>}
                    {r.status !== "cancelled" && <button onClick={() => { if (window.confirm("Cancel this recurring schedule?")) patchRecurring.mutate({ id: r.id, status: "cancelled" }); }} className="text-[11px] text-red-700 hover:underline">Cancel</button>}
                  </div>
                ) },
              ]}
            />
          )}
        </>
      )}

      {section === "referrals" && (
        <>
          <p className="text-xs text-muted-foreground">referral_events tracks every loop-flow signal (parent_shared, gift_received, parent_returns_to_shares_again, etc.). Cross-cutting view of where the loop fires and breaks.</p>
          {refLoading ? <div className="text-center py-12 text-muted-foreground">Loading…</div> : (
            <>
              {refSummary.length > 0 && (
                <div className="rounded border border-border/60 bg-muted/20 p-3">
                  <p className="text-xs font-semibold mb-2">Last 30 days, by event:</p>
                  <div className="flex flex-wrap gap-2">
                    {refSummary.map((s: any) => (
                      <span key={s.event_type} className="text-[11px] rounded-full bg-card px-2 py-1 border border-border/60"><span className="font-mono">{s.event_type}</span> · <span className="font-semibold">{fmtNum(s.count)}</span></span>
                    ))}
                  </div>
                </div>
              )}
              <SortableTable
                defaultSort="created_at"
                data={refRows}
                columns={[
                  { key: "created_at", label: "When", render: (r: any) => <span className="text-[11px] text-muted-foreground tabular-nums">{fmtDateTime(r.created_at)}</span> },
                  { key: "action", label: "Event", render: (r: any) => <span className="font-mono text-[11px]">{r.action}</span> },
                  { key: "channel", label: "Channel", render: (r: any) => <span className="text-[11px] text-muted-foreground">{r.channel || "-"}</span> },
                  { key: "ref_code", label: "Ref code", render: (r: any) => <span className="font-mono text-[10px]">{r.ref_code}</span> },
                  { key: "fund_id", label: "Fund", render: (r: any) => r.fund_id ? <span className="font-mono text-[10px] text-muted-foreground">{String(r.fund_id).slice(0, 12)}</span> : "-" },
                  { key: "metadata", label: "Meta", render: (r: any) => r.metadata ? <details className="text-[10px]"><summary className="cursor-pointer text-muted-foreground">view</summary><pre className="mt-1 max-w-md overflow-auto rounded bg-muted/40 p-1">{typeof r.metadata === "string" ? r.metadata : JSON.stringify(r.metadata)}</pre></details> : "-" },
                ]}
              />
            </>
          )}
        </>
      )}

      {section === "kidviews" && (
        <>
          <p className="text-xs text-muted-foreground">Kid view share tokens give a child PIN-gated access to real fund data. Revoke disables the token immediately. State stored in .local/kid-view.json.</p>
          {kvLoading ? <div className="text-center py-12 text-muted-foreground">Loading…</div> : (
            <SortableTable
              defaultSort="updatedAt"
              data={kvRows}
              columns={[
                { key: "enabled", label: "Status", render: (r: any) => r.enabled ? <span className="rounded-full bg-green-100 px-2 py-0.5 text-[10px] font-bold text-green-700">ENABLED</span> : <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-bold text-muted-foreground">OFF</span> },
                { key: "recipientFirstName", label: "Child", render: (r: any) => <span className="text-xs font-semibold">{r.recipientFirstName || "-"}</span> },
                { key: "fundName", label: "Fund", render: (r: any) => <span className="text-xs">{r.fundName}</span> },
                { key: "ownerEmail", label: "Owner", render: (r: any) => <span className="text-xs text-muted-foreground">{r.ownerEmail}</span> },
                { key: "pinHint", label: "PIN hint", render: (r: any) => <span className="text-[11px] text-muted-foreground italic">{r.pinHint || "-"}</span> },
                { key: "allowTeenSuggestions", label: "Teen mode", render: (r: any) => r.allowTeenSuggestions ? "yes" : "no" },
                { key: "suggestionsCount", label: "Suggestions", align: "right", render: (r: any) => fmtNum(r.suggestionsCount) },
                { key: "updatedAt", label: "Updated", render: (r: any) => <span className="text-[11px] text-muted-foreground">{fmtDateTime(r.updatedAt)}</span> },
                { key: "actions", label: "Actions", render: (r: any) => r.enabled ? <button onClick={() => { if (window.confirm(`Revoke kid view for ${r.recipientFirstName || r.fundName}?`)) revokeKidView.mutate(r.fundId); }} className="text-[11px] text-red-700 hover:underline">Revoke</button> : <span className="text-[11px] text-muted-foreground/60">-</span> },
              ]}
            />
          )}
        </>
      )}

      {section === "collabs" && (
        <>
          <p className="text-xs text-muted-foreground">fund_collaborators: co-parent / family invites to manage a fund. Status: pending invite, accepted, declined.</p>
          {collabsLoading ? <div className="text-center py-12 text-muted-foreground">Loading…</div> : (
            <SortableTable
              defaultSort="invited_at"
              data={collabRows}
              columns={[
                { key: "status", label: "Status", render: (r: any) => <StatusBadge status={r.status || "pending"} /> },
                { key: "invited_email", label: "Invited", render: (r: any) => <span className="text-xs">{r.invited_email}</span> },
                { key: "invitee_email_resolved", label: "Resolved user", render: (r: any) => <span className="text-[11px] text-muted-foreground">{r.invitee_email_resolved || "-"}</span> },
                { key: "role", label: "Role", render: (r: any) => <span className="text-[11px]">{r.role}</span> },
                { key: "recipient_first_name", label: "For", render: (r: any) => <span className="text-xs">{r.recipient_first_name || r.fund_name}</span> },
                { key: "invited_at", label: "Invited", render: (r: any) => <span className="text-[11px] text-muted-foreground">{fmtDateTime(r.invited_at)}</span> },
                { key: "accepted_at", label: "Accepted", render: (r: any) => <span className="text-[11px] text-muted-foreground">{r.accepted_at ? fmtDateTime(r.accepted_at) : "-"}</span> },
              ]}
            />
          )}
        </>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────
// INTEGRATIONS TAB — central panel for every external service Kora talks to.
// Per service: env-var presence (masked, never the value), live health
// where feasible (ping Stripe, ping DB, probe OpenAI package), docs link,
// and notes about activation steps. The single screen that answers
// "which integrations are wired right now and which ones are dormant?"
// ─────────────────────────────────────────────────────────────────────
function IntegrationsTab() {
  const { data, isLoading, isError, error, refetch, isFetching } = useQuery<{ integrations: any[] }>({
    queryKey: ["/api/admin/integrations"],
    queryFn: async () => fetchAdminJson("/api/admin/integrations"),
    // No refetchInterval: this endpoint makes a LIVE Stripe balance.retrieve() +
    // DB ping per call. A 60s loop while the tab sits open burned Stripe rate
    // limit on a health probe. Fetches on mount; use the manual refresh button.
    staleTime: 60000,
  });
  const integrations = asArray<any>(data?.integrations);
  const grouped = integrations.reduce((acc, integ) => {
    const cat = integ.category || "Other";
    (acc[cat] ||= []).push(integ);
    return acc;
  }, {} as Record<string, any[]>);
  const categoryOrder = ["Payments", "Email", "Banking", "AI", "Brokerage", "Market data", "Auth", "Mobile", "Observability", "Database", "Runtime", "Other"];
  const orderedCategories = categoryOrder.filter(c => grouped[c]).concat(Object.keys(grouped).filter(c => !categoryOrder.includes(c)));

  const renderHealth = (h: any) => {
    if (!h) return <span className="text-[11px] text-muted-foreground">-</span>;
    const styles: Record<string, string> = {
      ok: "bg-green-100 text-green-700",
      degraded: "bg-amber-100 text-amber-800",
      error: "bg-red-100 text-red-700",
      unknown: "bg-muted text-muted-foreground",
    };
    const label = { ok: "OK", degraded: "DEGRADED", error: "ERROR", unknown: "DORMANT" }[h.status as string] || String(h.status || "?").toUpperCase();
    return (
      <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold ${styles[h.status] || styles.unknown}`}>
        {label}
      </span>
    );
  };

  // Quick counts so an admin can see the system's external-service health
  // at a glance without scanning every card.
  const counts = integrations.reduce((acc: any, i: any) => {
    const s = i.health?.status || "unknown";
    acc[s] = (acc[s] || 0) + 1;
    return acc;
  }, {});

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="font-heading text-lg font-semibold" data-testid="heading-integrations-tab">Integrations</h2>
          <p className="text-xs text-muted-foreground mt-1">Every external service Kiddo connects to. Live env-var presence (just yes/no, values never exposed). Health probes Stripe + Database live; other services are validated by env-var presence + dynamic-import checks. Refreshes every 60s.</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => refetch()} disabled={isFetching} className="text-xs text-primary hover:underline inline-flex items-center gap-1 disabled:opacity-50">
            <RefreshCw size={12} />
            {isFetching ? "Refreshing…" : "Re-probe"}
          </button>
        </div>
      </div>

      {!isLoading && !isError && integrations.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 text-[11px]">
          <span className="text-muted-foreground">Status:</span>
          {counts.ok > 0 && <span className="rounded-full bg-green-100 px-2 py-0.5 font-bold text-green-700">{counts.ok} OK</span>}
          {counts.degraded > 0 && <span className="rounded-full bg-amber-100 px-2 py-0.5 font-bold text-amber-800">{counts.degraded} degraded</span>}
          {counts.error > 0 && <span className="rounded-full bg-red-100 px-2 py-0.5 font-bold text-red-700">{counts.error} error</span>}
          {counts.unknown > 0 && <span className="rounded-full bg-muted px-2 py-0.5 font-bold text-muted-foreground">{counts.unknown} dormant</span>}
        </div>
      )}

      {(isLoading || isFetching) && integrations.length === 0 && <div className="text-center py-12 text-muted-foreground">Probing integrations…</div>}
      {isError && <div className="text-center py-12 text-red-700 bg-red-50 border border-red-200 rounded-xl p-4">
        <p className="font-semibold">Could not load integrations.</p>
        <p className="text-xs mt-1">{(error as any)?.message || "Unknown error"}</p>
        <p className="text-[11px] mt-2 text-muted-foreground">Status code: {(error as any)?.status || "unknown"}. If the server has been restarted recently, the new endpoint may not be live yet. Give it 5s and try again.</p>
      </div>}

      {!isLoading && !isError && integrations.length === 0 && !isFetching && (
        <div className="text-center py-12 rounded-xl border border-amber-200 bg-amber-50/40 text-amber-900">
          <p className="font-semibold">No integrations returned.</p>
          <p className="text-xs mt-2 text-amber-900/80">The endpoint replied successfully but with an empty array. This usually means the server hasn't been restarted since the integrations endpoint was added. Restart the dev server, then click Re-probe.</p>
        </div>
      )}

      {!isLoading && !isError && integrations.length > 0 && (
        <div className="space-y-6">
          {orderedCategories.map((category) => (
            <div key={category}>
              <h3 className="text-[11px] font-bold uppercase tracking-[0.10em] text-muted-foreground mb-2">{category}</h3>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                {grouped[category].map((integ: any) => (
                  <div key={integ.id} className={`rounded-2xl border p-4 ${integ.health?.status === "error" ? "border-red-200 bg-red-50/30" : integ.health?.status === "degraded" ? "border-amber-200/60 bg-amber-50/20" : integ.health?.status === "ok" ? "border-green-200/60 bg-card" : "border-border/60 bg-card"}`}>
                    <div className="flex items-start justify-between gap-3 mb-2">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="text-sm font-semibold">{integ.label}</p>
                          {renderHealth(integ.health)}
                        </div>
                        <p className="text-[11px] text-muted-foreground mt-1 leading-relaxed">{integ.purpose}</p>
                      </div>
                      {integ.docsUrl && (
                        <a href={integ.docsUrl} target="_blank" rel="noopener noreferrer" className="shrink-0 text-[11px] text-primary hover:underline">Docs ↗</a>
                      )}
                    </div>
                    {integ.health?.message && (
                      <div className={`text-[11px] rounded-lg px-2.5 py-1.5 mb-2 ${integ.health.status === "error" ? "bg-red-100/60 text-red-800" : integ.health.status === "degraded" ? "bg-amber-100/60 text-amber-900" : integ.health.status === "ok" ? "bg-green-100/40 text-green-900" : "bg-muted/40 text-muted-foreground"}`}>
                        {integ.health.message}
                      </div>
                    )}
                    {integ.envVars && integ.envVars.length > 0 && (
                      <div className="space-y-0.5">
                        <p className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground/70 mt-2 mb-1">Env vars</p>
                        <div className="grid grid-cols-1 gap-0.5">
                          {integ.envVars.map((v: any) => (
                            <div key={v.name} className="flex items-center justify-between gap-2 text-[11px] tabular-nums">
                              <code className="font-mono text-[10.5px] truncate flex-1">{v.name}{v.required && <span className="text-red-500/60 ml-0.5">*</span>}</code>
                              <span className={`shrink-0 inline-flex items-center rounded-full px-1.5 py-0.5 text-[9px] font-bold ${v.set ? "bg-green-100 text-green-700" : v.required ? "bg-red-100 text-red-700" : "bg-muted text-muted-foreground"}`}>
                                {v.set ? "SET" : v.required ? "MISSING" : "unset"}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                    {integ.notes && (
                      <p className="text-[10.5px] italic text-muted-foreground/85 mt-2 leading-relaxed">{integ.notes}</p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="rounded border border-border/60 bg-muted/20 p-3 text-[11px] text-muted-foreground">
        <p className="font-semibold mb-1">Security note</p>
        <p>Env var values are NEVER returned to the client. Only their presence (set / missing / unset). To actually change a value, edit the environment configuration of the running deployment (Replit Secrets, .env, etc.) and restart the server.</p>
      </div>
    </div>
  );
}
