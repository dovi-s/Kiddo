import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { useLocation } from "wouter";
import {
  Users, Wallet, Gift, CreditCard, TrendingUp, Shield, Calendar,
  Building2, ArrowUpRight, ArrowDownToLine, ChevronDown, ChevronUp, Eye
} from "lucide-react";
import { Logo } from "@/components/ui/logo";

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

function StatCard({ label, value, sub, icon: Icon, color = "primary" }: {
  label: string; value: string; sub?: string; icon: any; color?: string;
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
    <div className="bg-card rounded-xl border border-border/50 p-4" data-testid={`stat-${label.toLowerCase().replace(/\s/g, "-")}`}>
      <div className="flex items-start justify-between mb-2">
        <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{label}</span>
        <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${colorMap[color] || colorMap.primary}`}>
          <Icon size={16} />
        </div>
      </div>
      <p className="text-2xl font-bold text-foreground">{value}</p>
      {sub && <p className="text-xs text-muted-foreground mt-1">{sub}</p>}
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
    const cmp = typeof aVal === "number"
      ? aVal - bVal
      : String(aVal).localeCompare(String(bVal));
    return sortDir === "asc" ? cmp : -cmp;
  });

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border/50">
            {columns.map((col) => (
              <th
                key={col.key}
                className={`py-2 px-3 text-xs font-medium text-muted-foreground uppercase tracking-wide cursor-pointer hover:text-foreground select-none ${col.align === "right" ? "text-right" : "text-left"}`}
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
                <td key={col.key} className={`py-2.5 px-3 ${col.align === "right" ? "text-right" : ""}`}>
                  {col.render ? col.render(row) : (row[col.key] ?? "-")}
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

type Tab = "overview" | "users" | "gifts" | "transactions" | "funds";

export default function Admin() {
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const [, setLocation] = useLocation();
  const [activeTab, setActiveTab] = useState<Tab>("overview");

  if (authLoading) return <div className="flex items-center justify-center min-h-screen"><p>Loading...</p></div>;
  if (!isAuthenticated) { setLocation("/login"); return null; }

  const tabs: { id: Tab; label: string; icon: any }[] = [
    { id: "overview", label: "Overview", icon: TrendingUp },
    { id: "users", label: "Users", icon: Users },
    { id: "funds", label: "Funds", icon: Wallet },
    { id: "gifts", label: "Gifts", icon: Gift },
    { id: "transactions", label: "Transactions", icon: CreditCard },
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
            <button onClick={() => setLocation("/dashboard")} className="text-sm text-muted-foreground hover:text-foreground" data-testid="link-back-dashboard">Back to app</button>
          </div>
          <div className="flex gap-1 -mb-px overflow-x-auto">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
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
        {activeTab === "overview" && <OverviewTab />}
        {activeTab === "users" && <UsersTab />}
        {activeTab === "funds" && <FundsTab />}
        {activeTab === "gifts" && <GiftsTab />}
        {activeTab === "transactions" && <TransactionsTab />}
      </main>
    </div>
  );
}

function OverviewTab() {
  const { data, isLoading } = useQuery<any>({
    queryKey: ["/api/admin/overview"],
    queryFn: async () => {
      const res = await fetch("/api/admin/overview", { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch");
      return res.json();
    },
  });

  if (isLoading || !data) return <div className="text-center py-12 text-muted-foreground">Loading dashboard...</div>;

  const r = data.revenue;
  const u = data.users;
  const f = data.funds;
  const g = data.gifts;
  const s = data.subscriptions;
  const e = data.events;
  const tx = data.transactions;

  return (
    <div className="space-y-8">
      <section>
        <h2 className="font-heading text-lg font-semibold mb-4 flex items-center gap-2" data-testid="heading-kora-revenue">
          <TrendingUp size={18} className="text-green-600" />
          Kora Revenue
        </h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatCard label="Total Revenue" value={fmt(r.totalKoraRevenue)} icon={TrendingUp} color="green" sub="All-time Kora earnings" />
          <StatCard label="Gift Platform Fees" value={fmt(r.giftPlatformFees)} icon={Gift} color="primary" sub={`${fmtNum(g.total_gifts)} gifts, 1.5% fee`} />
          <StatCard label="Family Plan Revenue" value={fmt(r.familyPlanRevenue)} icon={CreditCard} color="purple" sub={`${fmtNum(s.active_family_plans)} active plans`} />
          <StatCard label="Event Pass Revenue" value={fmt(r.eventPassRevenue)} icon={Calendar} color="amber" sub={`${fmtNum(e.events_with_pass)} passes sold`} />
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
              <p className="text-xl font-bold">{fmt(parseFloat(String(g.total_gift_volume || 0)) + parseFloat(String(g.total_processing_fees || 0)) + parseFloat(String(g.total_kora_fees || 0)))}</p>
              <p className="text-xs text-muted-foreground">to givers</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground mb-1">Gift Amounts</p>
              <p className="text-xl font-bold">{fmt(g.total_gift_volume)}</p>
              <p className="text-xs text-muted-foreground">{fmtNum(g.total_gifts)} gifts</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground mb-1">Processing Fees</p>
              <p className="text-xl font-bold text-red-600">{fmt(g.total_processing_fees)}</p>
              <p className="text-xs text-muted-foreground">to Stripe</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground mb-1">Kora Platform Fees</p>
              <p className="text-xl font-bold text-green-600">{fmt(g.total_kora_fees)}</p>
              <p className="text-xs text-muted-foreground">Kora keeps</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground mb-1">Net to Recipients</p>
              <p className="text-xl font-bold text-blue-600">{fmt(g.total_net_to_recipients)}</p>
              <p className="text-xs text-muted-foreground">invested for kids</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground mb-1">Avg Gift Size</p>
              <p className="text-xl font-bold">{fmt(g.avg_gift_size)}</p>
              <p className="text-xs text-muted-foreground">{fmtNum(g.unique_givers)} unique givers</p>
            </div>
          </div>
        </div>
      </section>

      <div className="grid md:grid-cols-2 gap-6">
        <section>
          <h2 className="font-heading text-lg font-semibold mb-4 flex items-center gap-2" data-testid="heading-users-overview">
            <Users size={18} />
            Users
          </h2>
          <div className="grid grid-cols-2 gap-3">
            <StatCard label="Total Users" value={fmtNum(u.total_users)} icon={Users} color="blue" />
            <StatCard label="KYC Verified" value={fmtNum(u.kyc_approved)} icon={Shield} color="green" sub={`${u.kyc_pending} pending, ${u.kyc_none} not started`} />
          </div>
        </section>

        <section>
          <h2 className="font-heading text-lg font-semibold mb-4 flex items-center gap-2" data-testid="heading-plans-overview">
            <CreditCard size={18} />
            Plans
          </h2>
          <div className="grid grid-cols-2 gap-3">
            <StatCard label="Free Users" value={fmtNum(s.free_plans)} icon={Users} color="primary" />
            <StatCard label="Family Plans" value={fmtNum(s.active_family_plans)} icon={CreditCard} color="purple" sub={`${s.canceled_family_plans} canceled`} />
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
            <StatCard label="Total AUM" value={fmt(f.total_aum)} icon={Wallet} color="green" sub={`${fmtNum(f.total_funds)} funds`} />
            <StatCard label="Invested" value={fmt(f.total_invested)} icon={TrendingUp} color="blue" sub={`Pending: ${fmt(f.total_pending)}`} />
            <StatCard label="UTMA (Kids)" value={fmtNum(f.utma_funds)} icon={Users} color="amber" sub="Custodial accounts" />
            <StatCard label="Personal" value={fmtNum(f.personal_funds)} icon={Wallet} color="primary" sub="Adult accounts" />
          </div>
        </section>

        <section>
          <h2 className="font-heading text-lg font-semibold mb-4 flex items-center gap-2" data-testid="heading-events-overview">
            <Calendar size={18} />
            Events
          </h2>
          <div className="grid grid-cols-2 gap-3">
            <StatCard label="Total Events" value={fmtNum(e.total_events)} icon={Calendar} color="primary" sub={`${e.active_events} active`} />
            <StatCard label="Event Passes" value={fmtNum(e.events_with_pass)} icon={CreditCard} color="amber" sub={`$99/pass revenue`} />
          </div>
        </section>
      </div>

      <section>
        <h2 className="font-heading text-lg font-semibold mb-4 flex items-center gap-2" data-testid="heading-gift-pipeline">
          <Gift size={18} />
          Gift Pipeline
        </h2>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          <StatCard label="Pending" value={fmtNum(g.pending_gifts)} icon={Gift} color="amber" />
          <StatCard label="Processing" value={fmtNum(g.processing_gifts)} icon={Gift} color="blue" />
          <StatCard label="Invested" value={fmtNum(g.invested_gifts)} icon={TrendingUp} color="green" />
          <StatCard label="Settled" value={fmtNum(g.settled_gifts)} icon={Shield} color="primary" />
          <StatCard label="Failed" value={fmtNum(g.failed_gifts)} icon={Gift} color="red" />
        </div>
      </section>

      <section>
        <h2 className="font-heading text-lg font-semibold mb-4 flex items-center gap-2" data-testid="heading-operations">
          <ArrowUpRight size={18} />
          Operations
        </h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <StatCard label="Sell Volume" value={fmt(tx.sell_volume)} icon={ArrowUpRight} color="red" />
          <StatCard label="Withdrawals" value={fmt(tx.withdrawal_volume)} icon={ArrowDownToLine} color="amber" />
          <StatCard label="Bank Accounts" value={fmtNum(data.bankAccounts?.total_bank_accounts)} icon={Building2} color="blue" />
          <StatCard label="Failed Tx" value={fmtNum(tx.failed_transactions)} icon={CreditCard} color="red" />
        </div>
      </section>
    </div>
  );
}

function UsersTab() {
  const { data: users = [], isLoading } = useQuery<any[]>({
    queryKey: ["/api/admin/users"],
    queryFn: async () => {
      const res = await fetch("/api/admin/users", { credentials: "include" });
      if (!res.ok) return [];
      return res.json();
    },
  });

  if (isLoading) return <div className="text-center py-12 text-muted-foreground">Loading users...</div>;

  const columns = [
    { key: "email", label: "Email", render: (r: any) => <span className="font-medium text-xs">{r.email || "-"}</span> },
    { key: "first_name", label: "Name", render: (r: any) => `${r.first_name || ""} ${r.last_name || ""}`.trim() || "-" },
    { key: "sub_plan", label: "Plan", render: (r: any) => <StatusBadge status={r.sub_plan || "free"} /> },
    { key: "sub_status", label: "Plan Status", render: (r: any) => r.sub_plan === "family" ? <StatusBadge status={r.sub_status || "active"} /> : <span className="text-xs text-muted-foreground">-</span> },
    { key: "kyc_status", label: "KYC", render: (r: any) => <StatusBadge status={r.kyc_status || "none"} /> },
    { key: "fund_count", label: "Funds", align: "right", render: (r: any) => fmtNum(r.fund_count) },
    { key: "utma_count", label: "Kids", align: "right", render: (r: any) => fmtNum(r.utma_count) },
    { key: "total_value", label: "Total Value", align: "right", render: (r: any) => fmt(r.total_value) },
    { key: "gifts_received", label: "Gifts", align: "right", render: (r: any) => fmtNum(r.gifts_received) },
    { key: "bank_accounts", label: "Banks", align: "right", render: (r: any) => fmtNum(r.bank_accounts) },
    { key: "created_at", label: "Joined", render: (r: any) => fmtDate(r.created_at) },
  ];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="font-heading text-lg font-semibold" data-testid="heading-users-tab">All Users ({users.length})</h2>
      </div>
      <div className="bg-card rounded-xl border border-border/50 overflow-hidden">
        <SortableTable columns={columns} data={users} defaultSort="created_at" />
      </div>
    </div>
  );
}

function FundsTab() {
  const { data: allFunds = [], isLoading } = useQuery<any[]>({
    queryKey: ["/api/admin/funds"],
    queryFn: async () => {
      const res = await fetch("/api/admin/funds", { credentials: "include" });
      if (!res.ok) return [];
      return res.json();
    },
  });

  if (isLoading) return <div className="text-center py-12 text-muted-foreground">Loading funds...</div>;

  const columns = [
    { key: "name", label: "Fund Name", render: (r: any) => <span className="font-medium">{r.name}</span> },
    { key: "owner_email", label: "Owner", render: (r: any) => <span className="text-xs">{r.owner_email}</span> },
    { key: "account_type", label: "Type", render: (r: any) => <StatusBadge status={r.account_type === "UTMA" ? "UTMA" : "Personal"} map={{ UTMA: "bg-amber-100 text-amber-700", Personal: "bg-blue-100 text-blue-700" }} /> },
    { key: "status", label: "Status", render: (r: any) => <StatusBadge status={r.status} /> },
    { key: "owner_kyc_status", label: "Owner KYC", render: (r: any) => <StatusBadge status={r.owner_kyc_status || "none"} /> },
    { key: "balance", label: "Invested", align: "right", render: (r: any) => fmt(r.balance) },
    { key: "pending_balance", label: "Pending", align: "right", render: (r: any) => fmt(r.pending_balance) },
    { key: "holding_count", label: "Holdings", align: "right" },
    { key: "gift_count", label: "Gifts", align: "right" },
    { key: "event_count", label: "Events", align: "right" },
    { key: "is_discoverable", label: "Public", render: (r: any) => r.is_discoverable ? <Eye size={14} className="text-green-600" /> : <span className="text-xs text-muted-foreground">Private</span> },
    { key: "recipient_first_name", label: "Recipient" },
    { key: "created_at", label: "Created", render: (r: any) => fmtDate(r.created_at) },
  ];

  return (
    <div className="space-y-4">
      <h2 className="font-heading text-lg font-semibold" data-testid="heading-funds-tab">All Funds ({allFunds.length})</h2>
      <div className="bg-card rounded-xl border border-border/50 overflow-hidden">
        <SortableTable columns={columns} data={allFunds} defaultSort="created_at" />
      </div>
    </div>
  );
}

function GiftsTab() {
  const { data: allGifts = [], isLoading } = useQuery<any[]>({
    queryKey: ["/api/admin/gifts"],
    queryFn: async () => {
      const res = await fetch("/api/admin/gifts", { credentials: "include" });
      if (!res.ok) return [];
      return res.json();
    },
  });

  if (isLoading) return <div className="text-center py-12 text-muted-foreground">Loading gifts...</div>;

  const columns = [
    { key: "sender_name", label: "Giver", render: (r: any) => (
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
    { key: "event_name", label: "Event", render: (r: any) => r.event_name || <span className="text-muted-foreground text-xs">Direct</span> },
    { key: "amount", label: "Gift Amount", align: "right", render: (r: any) => <span className="font-semibold">{fmt(r.amount)}</span> },
    { key: "processing_fee", label: "Processing", align: "right", render: (r: any) => <span className="text-red-600">{fmt(r.processing_fee)}</span> },
    { key: "kora_fee", label: "Kora Fee", align: "right", render: (r: any) => {
      const fee = parseFloat(r.kora_fee || "0");
      return fee > 0 ? <span className="text-green-600 font-medium">{fmt(fee)}</span> : <span className="text-muted-foreground text-xs">Waived</span>;
    }},
    { key: "net_amount", label: "Recipient Gets", align: "right", render: (r: any) => <span className="text-blue-600 font-medium">{fmt(r.net_amount)}</span> },
    { key: "execution_model", label: "Model", render: (r: any) => <span className="text-xs">{r.execution_model || "auto_invest"}</span> },
    { key: "status", label: "Status", render: (r: any) => <StatusBadge status={r.status} /> },
    { key: "has_event_pass", label: "Pass", render: (r: any) => r.has_event_pass ? <StatusBadge status="Pass" map={{ Pass: "bg-amber-100 text-amber-700" }} /> : "" },
    { key: "created_at", label: "Date", render: (r: any) => fmtDateTime(r.created_at) },
  ];

  const totalCharged = allGifts.reduce((s, g) => s + parseFloat(g.amount || 0) + parseFloat(g.processing_fee || 0) + parseFloat(g.kora_fee || 0), 0);
  const totalKoraFees = allGifts.reduce((s, g) => s + parseFloat(g.kora_fee || 0), 0);
  const totalProcessing = allGifts.reduce((s, g) => s + parseFloat(g.processing_fee || 0), 0);
  const totalNet = allGifts.reduce((s, g) => s + parseFloat(g.net_amount || 0), 0);

  return (
    <div className="space-y-4">
      <h2 className="font-heading text-lg font-semibold" data-testid="heading-gifts-tab">All Gifts ({allGifts.length})</h2>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard label="Total Charged" value={fmt(totalCharged)} icon={CreditCard} color="primary" sub="What givers paid" />
        <StatCard label="Processing Fees" value={fmt(totalProcessing)} icon={CreditCard} color="red" sub="Goes to Stripe" />
        <StatCard label="Kora Fees" value={fmt(totalKoraFees)} icon={TrendingUp} color="green" sub="Kora keeps this" />
        <StatCard label="Net to Recipients" value={fmt(totalNet)} icon={Gift} color="blue" sub="Invested for kids" />
      </div>
      <div className="bg-card rounded-xl border border-border/50 overflow-hidden">
        <SortableTable columns={columns} data={allGifts} defaultSort="created_at" />
      </div>
    </div>
  );
}

function TransactionsTab() {
  const { data: allTx = [], isLoading } = useQuery<any[]>({
    queryKey: ["/api/admin/transactions"],
    queryFn: async () => {
      const res = await fetch("/api/admin/transactions", { credentials: "include" });
      if (!res.ok) return [];
      return res.json();
    },
  });

  if (isLoading) return <div className="text-center py-12 text-muted-foreground">Loading transactions...</div>;

  const columns = [
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
    { key: "amount", label: "Amount", align: "right", render: (r: any) => <span className="font-semibold">{fmt(r.amount)}</span> },
    { key: "currency", label: "Currency", render: (r: any) => <span className="uppercase text-xs">{r.currency}</span> },
    { key: "status", label: "Status", render: (r: any) => <StatusBadge status={r.status} /> },
    { key: "description", label: "Description", render: (r: any) => <span className="text-xs text-muted-foreground truncate max-w-[200px] block">{r.description || "-"}</span> },
    { key: "fund_name", label: "Fund" },
    { key: "event_name", label: "Event", render: (r: any) => r.event_name || "-" },
    { key: "stripe_payment_intent_id", label: "Stripe PI", render: (r: any) => r.stripe_payment_intent_id ? <span className="text-xs font-mono text-muted-foreground">{String(r.stripe_payment_intent_id).slice(0, 15)}...</span> : "-" },
    { key: "failure_reason", label: "Failure", render: (r: any) => r.failure_reason ? <span className="text-xs text-red-600">{r.failure_reason}</span> : "" },
    { key: "created_at", label: "Date", render: (r: any) => fmtDateTime(r.created_at) },
  ];

  return (
    <div className="space-y-4">
      <h2 className="font-heading text-lg font-semibold" data-testid="heading-transactions-tab">All Transactions ({allTx.length})</h2>
      <div className="bg-card rounded-xl border border-border/50 overflow-hidden">
        <SortableTable columns={columns} data={allTx} defaultSort="created_at" />
      </div>
    </div>
  );
}
