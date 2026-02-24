import { useState, useRef, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useLocation, Link } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import { useAuth } from "@/hooks/use-auth";
import { useSubscription } from "@/hooks/use-subscription";
import { haptic } from "@/lib/haptics";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { AddFundSheet } from "@/components/AddFundSheet";
import { toast } from "@/hooks/use-toast";
import {
  User, CreditCard, Shield, Eye, EyeOff, LogOut, Check,
  ChevronRight, Star, Lock, Crown, ArrowUpRight, Wallet, ChevronLeft, Plus, Loader2, Camera,
  Building2, Trash2, TrendingDown, ArrowDownToLine, X
} from "lucide-react";
import { Logo } from "@/components/ui/logo";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";

function SectionCard({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`bg-card rounded-2xl border border-border/50 shadow-premium-sm ${className}`}>
      {children}
    </div>
  );
}

function SellHoldingSheet({ open, onClose, holding, fund, onSuccess }: {
  open: boolean;
  onClose: () => void;
  holding: any;
  fund: any;
  onSuccess: () => void;
}) {
  const [selling, setSelling] = useState(false);
  const [sellAll, setSellAll] = useState(true);
  const [customShares, setCustomShares] = useState("");

  const handleSell = async () => {
    setSelling(true);
    haptic("medium");
    try {
      const res = await fetch("/api/holdings/sell", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          holdingId: holding.id,
          fundId: fund.id,
          shares: sellAll ? undefined : customShares,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        haptic("success");
        toast({ title: `Sold ${holding.ticker}`, description: `$${data.saleValue} will settle in 1-2 business days` });
        onSuccess();
        onClose();
      } else {
        toast({ title: "Could not sell", description: data.error || "Please try again", variant: "destructive" });
      }
    } catch {
      toast({ title: "Could not sell", description: "Please try again", variant: "destructive" });
    } finally {
      setSelling(false);
    }
  };

  if (!holding) return null;

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-w-md w-[95vw] p-0 gap-0 overflow-hidden rounded-2xl" aria-describedby={undefined}>
        <DialogTitle className="sr-only">Sell {holding.ticker}</DialogTitle>
        <div className="p-6 space-y-5">
          <div className="text-center space-y-2">
            <div className="w-12 h-12 rounded-xl bg-red-100 flex items-center justify-center mx-auto">
              <TrendingDown size={24} className="text-red-600" />
            </div>
            <h2 className="font-heading text-xl font-semibold text-foreground">Sell {holding.ticker}</h2>
            <p className="text-sm text-muted-foreground">{holding.name}</p>
          </div>

          <div className="bg-muted/30 rounded-xl p-4 space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Shares owned</span>
              <span className="font-medium">{parseFloat(holding.shares).toFixed(4)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Current value</span>
              <span className="font-medium">${parseFloat(holding.currentValue).toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Gain/Loss</span>
              <span className={`font-medium ${parseFloat(holding.gain) >= 0 ? "text-green-600" : "text-red-600"}`}>
                {parseFloat(holding.gain) >= 0 ? "+" : ""}${parseFloat(holding.gain).toFixed(2)}
              </span>
            </div>
          </div>

          <div className="space-y-3">
            <button
              onClick={() => { setSellAll(true); haptic("selection"); }}
              className={`w-full p-3 rounded-xl border-2 text-left transition-all ${sellAll ? "border-primary bg-primary/5" : "border-border"}`}
              data-testid="option-sell-all"
            >
              <p className="text-sm font-medium">Sell all shares</p>
              <p className="text-xs text-muted-foreground mt-0.5">Sell {parseFloat(holding.shares).toFixed(4)} shares for ~${parseFloat(holding.currentValue).toFixed(2)}</p>
            </button>
            <button
              onClick={() => { setSellAll(false); haptic("selection"); }}
              className={`w-full p-3 rounded-xl border-2 text-left transition-all ${!sellAll ? "border-primary bg-primary/5" : "border-border"}`}
              data-testid="option-sell-partial"
            >
              <p className="text-sm font-medium">Sell specific amount</p>
              {!sellAll && (
                <input
                  type="number"
                  step="0.0001"
                  max={holding.shares}
                  value={customShares}
                  onChange={(e) => setCustomShares(e.target.value)}
                  placeholder="Number of shares"
                  className="mt-2 w-full px-3 py-2 bg-background border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
                  data-testid="input-sell-shares"
                  autoFocus
                />
              )}
            </button>
          </div>

          <div className="bg-amber-50 rounded-xl border border-amber-200/50 p-3">
            <p className="text-xs text-amber-800">
              {fund.accountType === "UTMA"
                ? "For custodial accounts, sale proceeds must be used for the child's benefit."
                : "Proceeds will be available as cash in your fund after settlement (1-2 business days)."}
            </p>
          </div>

          <div className="bg-blue-50 rounded-xl border border-blue-200/50 p-3">
            <p className="text-xs font-medium text-blue-900 mb-1">Tax note: cost basis</p>
            <p className="text-xs text-blue-800">
              Capital gains are calculated from the original purchase price, not the value when the gift was received. Long-term holdings (over 1 year) are taxed at a lower rate.
            </p>
          </div>

          <div className="flex gap-3">
            <Button variant="outline" className="flex-1" onClick={onClose} data-testid="button-cancel-sell">
              Cancel
            </Button>
            <Button
              className="flex-1 bg-red-600 hover:bg-red-700"
              disabled={selling || (!sellAll && (!customShares || parseFloat(customShares) <= 0))}
              onClick={handleSell}
              data-testid="button-confirm-sell"
            >
              {selling && <Loader2 size={16} className="mr-2 animate-spin" />}
              Sell
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function WithdrawSheet({ open, onClose, fund, bankAccounts, onSuccess }: {
  open: boolean;
  onClose: () => void;
  fund: any;
  bankAccounts: any[];
  onSuccess: () => void;
}) {
  const [withdrawing, setWithdrawing] = useState(false);
  const [amount, setAmount] = useState("");
  const [selectedBank, setSelectedBank] = useState(bankAccounts[0]?.id || "");

  useEffect(() => {
    if (bankAccounts.length > 0 && !selectedBank) {
      setSelectedBank(bankAccounts[0].id);
    }
  }, [bankAccounts]);

  const availableCash = fund ? parseFloat(fund.pendingBalance) : 0;

  const handleWithdraw = async () => {
    setWithdrawing(true);
    haptic("medium");
    try {
      const res = await fetch("/api/withdrawals", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fundId: fund.id,
          amount: amount,
          bankAccountId: selectedBank,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        haptic("success");
        toast({ title: "Withdrawal initiated", description: `$${data.amount} will arrive in 1-3 business days` });
        onSuccess();
        onClose();
      } else {
        toast({ title: "Could not withdraw", description: data.error || "Please try again", variant: "destructive" });
      }
    } catch {
      toast({ title: "Could not withdraw", description: "Please try again", variant: "destructive" });
    } finally {
      setWithdrawing(false);
    }
  };

  if (!fund) return null;

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-w-md w-[95vw] p-0 gap-0 overflow-hidden rounded-2xl" aria-describedby={undefined}>
        <DialogTitle className="sr-only">Withdraw Cash</DialogTitle>
        <div className="p-6 space-y-5">
          <div className="text-center space-y-2">
            <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center mx-auto">
              <ArrowDownToLine size={24} className="text-primary" />
            </div>
            <h2 className="font-heading text-xl font-semibold text-foreground">Withdraw Cash</h2>
            <p className="text-sm text-muted-foreground">Available: ${availableCash.toFixed(2)}</p>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-foreground mb-1.5">Amount</label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">$</span>
                <input
                  type="number"
                  step="0.01"
                  max={availableCash}
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="0.00"
                  className="w-full pl-7 pr-4 py-3 bg-background border border-border rounded-xl text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20"
                  data-testid="input-withdraw-amount"
                />
              </div>
              <button
                onClick={() => setAmount(availableCash.toFixed(2))}
                className="text-xs text-primary mt-1 hover:underline"
                data-testid="button-withdraw-max"
              >
                Withdraw all
              </button>
            </div>

            <div>
              <label className="block text-sm font-medium text-foreground mb-1.5">To bank account</label>
              {bankAccounts.length === 0 ? (
                <p className="text-sm text-muted-foreground">No bank accounts linked. Add one below.</p>
              ) : (
                <div className="space-y-2">
                  {bankAccounts.map((ba) => (
                    <button
                      key={ba.id}
                      onClick={() => { setSelectedBank(ba.id); haptic("selection"); }}
                      className={`w-full flex items-center gap-3 p-3 rounded-xl border-2 text-left transition-all ${selectedBank === ba.id ? "border-primary bg-primary/5" : "border-border"}`}
                      data-testid={`option-bank-${ba.id}`}
                    >
                      <Building2 size={16} className="text-muted-foreground" />
                      <div className="flex-1">
                        <p className="text-sm font-medium">{ba.bankName}</p>
                        <p className="text-xs text-muted-foreground">{ba.accountType} ****{ba.accountLast4}</p>
                      </div>
                      {selectedBank === ba.id && <Check size={16} className="text-primary" />}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="flex gap-3">
            <Button variant="outline" className="flex-1" onClick={onClose} data-testid="button-cancel-withdraw">
              Cancel
            </Button>
            <Button
              className="flex-1"
              disabled={withdrawing || !amount || parseFloat(amount) <= 0 || parseFloat(amount) > availableCash || !selectedBank}
              onClick={handleWithdraw}
              data-testid="button-confirm-withdraw"
            >
              {withdrawing && <Loader2 size={16} className="mr-2 animate-spin" />}
              Withdraw
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function LinkBankSheet({ open, onClose, onSuccess }: {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [linking, setLinking] = useState(false);
  const [bankName, setBankName] = useState("");
  const [accountLast4, setAccountLast4] = useState("");
  const [routingLast4, setRoutingLast4] = useState("");
  const [accountType, setAccountType] = useState("checking");

  const handleLink = async () => {
    setLinking(true);
    haptic("medium");
    try {
      const res = await fetch("/api/bank-accounts", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bankName, accountLast4, routingLast4, accountType }),
      });
      if (res.ok) {
        haptic("success");
        toast({ title: "Bank account linked" });
        setBankName("");
        setAccountLast4("");
        setRoutingLast4("");
        onSuccess();
        onClose();
      } else {
        const data = await res.json();
        toast({ title: "Could not link account", description: data.error || "Please try again", variant: "destructive" });
      }
    } catch {
      toast({ title: "Could not link account", description: "Please try again", variant: "destructive" });
    } finally {
      setLinking(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-w-md w-[95vw] p-0 gap-0 overflow-hidden rounded-2xl" aria-describedby={undefined}>
        <DialogTitle className="sr-only">Link Bank Account</DialogTitle>
        <div className="p-6 space-y-5">
          <div className="text-center space-y-2">
            <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center mx-auto">
              <Building2 size={24} className="text-primary" />
            </div>
            <h2 className="font-heading text-xl font-semibold text-foreground">Link Bank Account</h2>
            <p className="text-sm text-muted-foreground">Add your bank account for withdrawals</p>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-foreground mb-1.5">Bank name</label>
              <input
                type="text"
                value={bankName}
                onChange={(e) => setBankName(e.target.value)}
                placeholder="Chase, Wells Fargo, etc."
                className="w-full px-4 py-3 bg-background border border-border rounded-xl text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20"
                data-testid="input-bank-name"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-foreground mb-1.5">Account last 4</label>
                <input
                  type="text"
                  value={accountLast4}
                  onChange={(e) => setAccountLast4(e.target.value.replace(/\D/g, "").slice(0, 4))}
                  placeholder="1234"
                  maxLength={4}
                  className="w-full px-4 py-3 bg-background border border-border rounded-xl text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20"
                  data-testid="input-account-last4"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-1.5">Routing last 4</label>
                <input
                  type="text"
                  value={routingLast4}
                  onChange={(e) => setRoutingLast4(e.target.value.replace(/\D/g, "").slice(0, 4))}
                  placeholder="5678"
                  maxLength={4}
                  className="w-full px-4 py-3 bg-background border border-border rounded-xl text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20"
                  data-testid="input-routing-last4"
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-foreground mb-1.5">Account type</label>
              <select
                value={accountType}
                onChange={(e) => setAccountType(e.target.value)}
                className="w-full px-4 py-3 bg-background border border-border rounded-xl text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20"
                data-testid="select-account-type"
              >
                <option value="checking">Checking</option>
                <option value="savings">Savings</option>
              </select>
            </div>
          </div>

          <div className="bg-muted/30 rounded-xl border border-border/50 p-3">
            <div className="flex items-start gap-2">
              <Lock size={14} className="text-muted-foreground mt-0.5 flex-shrink-0" />
              <p className="text-xs text-muted-foreground">
                Your bank information is encrypted and secure. We use this only to process your withdrawal requests.
              </p>
            </div>
          </div>

          <div className="flex gap-3">
            <Button variant="outline" className="flex-1" onClick={onClose} data-testid="button-cancel-link-bank">
              Cancel
            </Button>
            <Button
              className="flex-1"
              disabled={linking || !bankName || accountLast4.length !== 4}
              onClick={handleLink}
              data-testid="button-confirm-link-bank"
            >
              {linking && <Loader2 size={16} className="mr-2 animate-spin" />}
              Link Account
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default function Settings() {
  const { user, isLoading: authLoading, logout } = useAuth();
  const [, navigate] = useLocation();
  const [editingName, setEditingName] = useState(false);
  const [nameValue, setNameValue] = useState("");
  const [addFundOpen, setAddFundOpen] = useState(false);
  const [sellHoldingOpen, setSellHoldingOpen] = useState(false);
  const [selectedHolding, setSelectedHolding] = useState<any>(null);
  const [selectedFundForAction, setSelectedFundForAction] = useState<any>(null);
  const [withdrawOpen, setWithdrawOpen] = useState(false);
  const [linkBankOpen, setLinkBankOpen] = useState(false);

  const queryClient = useQueryClient();

  const { data: funds = [] } = useQuery<any[]>({
    queryKey: ["/api/funds"],
    queryFn: async () => {
      const res = await fetch("/api/funds", { credentials: "include" });
      if (!res.ok) return [];
      return res.json();
    },
    enabled: !!user,
  });

  const { data: kycData } = useQuery<any>({
    queryKey: ["/api/user/kyc-status"],
    queryFn: async () => {
      const res = await fetch("/api/user/kyc-status", { credentials: "include" });
      if (!res.ok) return { kycStatus: "none" };
      return res.json();
    },
    enabled: !!user,
  });

  const { data: bankAccounts = [] } = useQuery<any[]>({
    queryKey: ["/api/bank-accounts"],
    queryFn: async () => {
      const res = await fetch("/api/bank-accounts", { credentials: "include" });
      if (!res.ok) return [];
      return res.json();
    },
    enabled: !!user,
  });

  const primaryFund = funds[0];

  const { data: holdingsData = [] } = useQuery<any[]>({
    queryKey: ["/api/funds", primaryFund?.id, "holdings"],
    queryFn: async () => {
      const res = await fetch(`/api/funds/${primaryFund.id}/holdings`, { credentials: "include" });
      if (!res.ok) return [];
      return res.json();
    },
    enabled: !!primaryFund,
  });

  if (authLoading) {
    return (
      <div className="md:ml-[220px] lg:ml-[260px] flex items-center justify-center min-h-screen">
        <div className="animate-pulse text-muted-foreground">Loading...</div>
      </div>
    );
  }

  if (!user) {
    navigate("/login");
    return null;
  }

  const { data: subscription } = useSubscription();
  const [upgrading, setUpgrading] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const displayName = `${user.firstName || ""} ${user.lastName || ""}`.trim() || "User";
  const userEmail = user.email || "";
  const userPlan: "free" | "starter" | "family" = (subscription?.status === "active" && subscription?.plan === "family") ? "family" : (subscription?.status === "active" && subscription?.plan === "starter") ? "starter" : "free";
  const kycCompleted = kycData?.kycStatus === "approved";

  const handleUpgradeFamily = async () => {
    setUpgrading(true);
    haptic("medium");
    try {
      const res = await fetch("/api/stripe/checkout/family-plan", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
      });
      const data = await res.json();
      if (data.url) {
        window.location.href = data.url;
      } else {
        toast({ title: "Something went wrong", description: data.error || "Could not start checkout", variant: "destructive" });
      }
    } catch {
      toast({ title: "Something went wrong", description: "Please try again", variant: "destructive" });
    } finally {
      setUpgrading(false);
    }
  };

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) {
      toast({ title: "Photo too large", description: "Please choose an image under 2MB", variant: "destructive" });
      return;
    }
    setUploadingPhoto(true);
    try {
      const reader = new FileReader();
      reader.onload = async () => {
        const dataUrl = reader.result as string;
        const res = await fetch("/api/user/profile", {
          method: "PATCH",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ profileImageUrl: dataUrl }),
        });
        if (res.ok) {
          const updatedUser = await res.json();
          haptic("success");
          queryClient.setQueryData(["/api/auth/user"], updatedUser);
          toast({ title: "Photo updated" });
        } else {
          toast({ title: "Could not update photo", variant: "destructive" });
        }
        setUploadingPhoto(false);
      };
      reader.readAsDataURL(file);
    } catch {
      toast({ title: "Could not update photo", variant: "destructive" });
      setUploadingPhoto(false);
    }
  };

  const eventsWithPasses = funds.flatMap((f: any) =>
    (f.events || []).filter((e: any) => e.hasEventPass)
  );

  const handleStartEdit = () => {
    setNameValue(displayName);
    setEditingName(true);
    haptic("light");
  };

  const handleSaveName = async () => {
    const parts = nameValue.trim().split(/\s+/);
    const firstName = parts[0] || "";
    const lastName = parts.slice(1).join(" ") || "";
    try {
      const res = await fetch("/api/user/profile", {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ firstName, lastName }),
      });
      if (res.ok) {
        const updatedUser = await res.json();
        queryClient.setQueryData(["/api/auth/user"], updatedUser);
        haptic("success");
        toast({ title: "Name updated" });
      } else {
        toast({ title: "Could not update name", variant: "destructive" });
      }
    } catch {
      toast({ title: "Could not update name", variant: "destructive" });
    }
    setEditingName(false);
  };

  const handleToggleDiscoverable = async (fundId: string, newValue: boolean) => {
    haptic("selection");
    try {
      const res = await fetch(`/api/funds/${fundId}/privacy`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isDiscoverable: newValue }),
      });
      if (res.ok) {
        queryClient.invalidateQueries({ queryKey: ["/api/funds"] });
        toast({ title: newValue ? "Fund is now discoverable" : "Fund is now private" });
      }
    } catch {
      toast({ title: "Could not update privacy", variant: "destructive" });
    }
  };

  const handleDeleteBankAccount = async (id: string) => {
    haptic("medium");
    try {
      const res = await fetch(`/api/bank-accounts/${id}`, { method: "DELETE", credentials: "include" });
      if (res.ok) {
        queryClient.invalidateQueries({ queryKey: ["/api/bank-accounts"] });
        toast({ title: "Bank account removed" });
      }
    } catch {
      toast({ title: "Could not remove account", variant: "destructive" });
    }
  };

  const handleSignOut = () => {
    haptic("medium");
    logout();
  };

  const refreshAll = () => {
    queryClient.invalidateQueries({ queryKey: ["/api/funds"] });
    queryClient.invalidateQueries({ queryKey: ["/api/bank-accounts"] });
    if (primaryFund) {
      queryClient.invalidateQueries({ queryKey: ["/api/funds", primaryFund.id, "holdings"] });
    }
  };

  const isAnyFundDiscoverable = funds.some((f: any) => f.isDiscoverable);

  return (
    <div className="md:ml-[220px] lg:ml-[260px] min-h-screen bg-background pb-24 md:pb-8">
      <div className="md:hidden sticky top-0 z-40 h-14 flex items-center px-4 bg-background/80 backdrop-blur-lg border-b border-border/40">
        <Link href="/dashboard">
          <button className="flex items-center gap-1 text-muted-foreground hover:text-foreground transition-colors" data-testid="button-back-dashboard">
            <ChevronLeft size={20} />
            <span className="text-sm">Fund</span>
          </button>
        </Link>
        <div className="flex-1" />
        <Logo size="sm" className="text-foreground" linkTo="/dashboard" />
      </div>
      <div className="max-w-lg md:max-w-2xl mx-auto px-4 py-6 space-y-6">

        <motion.h1
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="font-heading text-2xl md:text-3xl font-bold text-foreground"
          data-testid="heading-settings"
        >
          Settings
        </motion.h1>

        {/* Profile Section */}
        <SectionCard>
          <div className="p-5 space-y-4">
            <div className="flex items-center gap-3 mb-2">
              <User size={18} className="text-muted-foreground" />
              <h2 className="font-heading text-lg font-semibold text-foreground" data-testid="heading-profile">Profile</h2>
            </div>

            <div className="flex items-center gap-4">
              <div className="relative">
                <button
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploadingPhoto}
                  className="relative w-16 h-16 rounded-full overflow-hidden bg-primary/10 flex items-center justify-center group"
                  data-testid="button-change-photo"
                >
                  {user.profileImageUrl ? (
                    <img src={user.profileImageUrl} alt="Profile" className="w-full h-full object-cover" />
                  ) : (
                    <span className="text-xl font-semibold text-primary">{displayName.charAt(0).toUpperCase()}</span>
                  )}
                  <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                    {uploadingPhoto ? (
                      <Loader2 size={18} className="text-white animate-spin" />
                    ) : (
                      <Camera size={18} className="text-white" />
                    )}
                  </div>
                </button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handlePhotoUpload}
                  className="hidden"
                  data-testid="input-photo-upload"
                />
              </div>
              <div className="flex-1">
                <p className="text-sm font-medium text-foreground">{displayName}</p>
                <p className="text-xs text-muted-foreground mt-0.5">Tap photo to change. This shows on your event pages.</p>
              </div>
            </div>

            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground">Name</p>
                {editingName ? (
                  <div className="flex items-center gap-2 mt-1">
                    <input
                      data-testid="input-edit-name"
                      type="text"
                      value={nameValue}
                      onChange={(e) => setNameValue(e.target.value)}
                      className="h-9 px-3 border border-border rounded-lg text-sm text-foreground bg-background focus:outline-none focus:ring-2 focus:ring-primary/20"
                      autoFocus
                    />
                    <Button
                      size="sm"
                      onClick={handleSaveName}
                      data-testid="button-save-name"
                    >
                      Save
                    </Button>
                  </div>
                ) : (
                  <p className="text-sm font-medium text-foreground" data-testid="text-display-name">{displayName}</p>
                )}
              </div>
              {!editingName && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleStartEdit}
                  data-testid="button-edit-name"
                >
                  Edit
                </Button>
              )}
            </div>

            <div>
              <p className="text-xs text-muted-foreground">Email</p>
              <p className="text-sm font-medium text-foreground" data-testid="text-email">{userEmail}</p>
            </div>
          </div>
        </SectionCard>

        {/* Your Funds */}
        <SectionCard>
          <div className="p-5 space-y-4">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-3">
                <Star size={18} className="text-muted-foreground" />
                <h2 className="font-heading text-lg font-semibold text-foreground" data-testid="heading-funds">Your Funds</h2>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => { setAddFundOpen(true); haptic("selection"); }}
                className="text-xs gap-1"
                data-testid="button-add-fund-settings"
              >
                <Plus size={14} />
                Add fund
              </Button>
            </div>

            {funds.length === 0 ? (
              <div className="text-center py-4">
                <p className="text-sm text-muted-foreground mb-3" data-testid="text-no-funds">You have not created any funds yet.</p>
                <Button
                  variant="outline"
                  onClick={() => { setAddFundOpen(true); haptic("selection"); }}
                  className="gap-2"
                  data-testid="button-create-first-fund"
                >
                  <Plus size={16} />
                  Create your first fund
                </Button>
              </div>
            ) : (
              <div className="space-y-3">
                {funds.map((fund: any) => (
                  <div key={fund.id} className="space-y-2">
                    <motion.div
                      whileTap={{ scale: 0.99 }}
                      className="flex items-center justify-between p-3 rounded-xl border border-border/50 hover:bg-muted/30 transition-colors cursor-pointer"
                      onClick={() => {
                        haptic("selection");
                        navigate(`/dashboard`);
                      }}
                      data-testid={`card-fund-${fund.id}`}
                    >
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-foreground truncate" data-testid={`text-fund-name-${fund.id}`}>{fund.name}</p>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className="text-xs text-muted-foreground">{fund.accountType || "UTMA"}</span>
                          <span className="text-xs text-muted-foreground">·</span>
                          <span className={`text-xs ${fund.status === "active" ? "text-green-600" : "text-muted-foreground"}`} data-testid={`text-fund-status-${fund.id}`}>
                            {fund.status === "active" ? "Active" : "Draft"}
                          </span>
                          {fund.recipientFirstName && (
                            <>
                              <span className="text-xs text-muted-foreground">·</span>
                              <span className="text-xs text-muted-foreground" data-testid={`text-fund-recipient-${fund.id}`}>{fund.recipientFirstName}</span>
                            </>
                          )}
                        </div>
                      </div>
                      <ChevronRight size={16} className="text-muted-foreground flex-shrink-0" />
                    </motion.div>
                    {(fund.accountType === "UTMA" || !fund.accountType) && (
                      <p className="text-[11px] text-muted-foreground/70 px-1" data-testid={`tip-utma-transfer-${fund.id}`}>
                        This UTMA account transfers to {fund.recipientFirstName || "your child"} at age 18-21 (varies by state). All gifts are irrevocable.
                      </p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </SectionCard>

        {/* Membership */}
        <SectionCard>
          <div className="p-5 space-y-4">
            <div className="flex items-center gap-3 mb-2">
              <Crown size={18} className="text-muted-foreground" />
              <h2 className="font-heading text-lg font-semibold text-foreground" data-testid="heading-membership">Membership</h2>
            </div>

            {userPlan === "free" ? (
              <>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-foreground" data-testid="text-current-plan">Free Plan</span>
                  <span className="text-xs text-muted-foreground">$2 platform fee per gift</span>
                </div>

                <div className="bg-gradient-to-br from-primary/5 to-primary/10 rounded-xl border border-primary/20 p-4 space-y-3">
                  <div className="flex items-center gap-2">
                    <Crown size={16} className="text-primary" />
                    <p className="text-sm font-semibold text-foreground">Starter Plan</p>
                    <span className="text-xs font-medium text-primary bg-primary/10 px-2 py-0.5 rounded-full">$5/mo per fund</span>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Remove the $2 platform fee on every gift. Includes 2 event pages per fund, Memory Book, and auto-invest.
                  </p>
                  <ul className="space-y-1.5 text-sm text-muted-foreground">
                    <li className="flex items-center gap-2">
                      <Check size={14} className="text-primary" />
                      No platform fee on gifts
                    </li>
                    <li className="flex items-center gap-2">
                      <Check size={14} className="text-primary" />
                      2 event pages per fund
                    </li>
                    <li className="flex items-center gap-2">
                      <Check size={14} className="text-primary" />
                      Memory Book and auto-invest
                    </li>
                  </ul>
                  <Button
                    className="w-full"
                    variant="outline"
                    data-testid="button-upgrade-starter"
                    disabled={upgrading}
                    onClick={handleUpgradeFamily}
                  >
                    {upgrading && <Loader2 size={16} className="mr-2 animate-spin" />}
                    Upgrade to Starter
                  </Button>
                </div>

                <div className="bg-gradient-to-br from-primary/5 to-primary/10 rounded-xl border border-primary/20 p-4 space-y-3">
                  <div className="flex items-center gap-2">
                    <Crown size={16} className="text-primary" />
                    <p className="text-sm font-semibold text-foreground">Family Plan</p>
                    <span className="text-xs font-medium text-primary bg-primary/10 px-2 py-0.5 rounded-full">$12/mo or $119/yr</span>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Everything unlimited. No platform fees, unlimited funds and event pages, household dashboard, and priority support.
                  </p>
                  <ul className="space-y-1.5 text-sm text-muted-foreground">
                    <li className="flex items-center gap-2">
                      <Check size={14} className="text-primary" />
                      No platform fee on gifts
                    </li>
                    <li className="flex items-center gap-2">
                      <Check size={14} className="text-primary" />
                      Unlimited funds and premium event pages
                    </li>
                    <li className="flex items-center gap-2">
                      <Check size={14} className="text-primary" />
                      Household dashboard and recurring gift management
                    </li>
                    <li className="flex items-center gap-2">
                      <Check size={14} className="text-primary" />
                      Priority support
                    </li>
                  </ul>
                  <Button
                    className="w-full"
                    data-testid="button-upgrade-family"
                    disabled={upgrading}
                    onClick={handleUpgradeFamily}
                  >
                    {upgrading && <Loader2 size={16} className="mr-2 animate-spin" />}
                    Upgrade to Family Plan
                  </Button>
                </div>
              </>
            ) : userPlan === "starter" ? (
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <Check size={16} className="text-green-600" />
                  <span className="text-sm font-medium text-foreground" data-testid="text-current-plan">Starter Plan</span>
                  <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full">Active</span>
                </div>
                <div className="bg-muted/30 rounded-xl p-3 space-y-1.5 text-xs text-muted-foreground">
                  <div className="flex justify-between">
                    <span>Plan</span>
                    <span className="font-medium text-foreground">Starter ($5/mo per fund)</span>
                  </div>
                  {subscription?.currentPeriodEnd && (
                    <div className="flex justify-between">
                      <span>Renews</span>
                      <span className="font-medium text-foreground">{new Date(subscription.currentPeriodEnd).toLocaleDateString()}</span>
                    </div>
                  )}
                  <div className="flex justify-between">
                    <span>Platform fee</span>
                    <span className="font-medium text-green-600">Waived</span>
                  </div>
                </div>
                <div className="bg-gradient-to-br from-primary/5 to-primary/10 rounded-xl border border-primary/20 p-4 space-y-3 mt-3">
                  <div className="flex items-center gap-2">
                    <Crown size={16} className="text-primary" />
                    <p className="text-sm font-semibold text-foreground">Upgrade to Family</p>
                    <span className="text-xs font-medium text-primary bg-primary/10 px-2 py-0.5 rounded-full">$12/mo or $119/yr</span>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Unlimited funds, unlimited event pages, household dashboard, and priority support.
                  </p>
                  <Button
                    className="w-full"
                    data-testid="button-upgrade-family"
                    disabled={upgrading}
                    onClick={handleUpgradeFamily}
                  >
                    {upgrading && <Loader2 size={16} className="mr-2 animate-spin" />}
                    Upgrade to Family Plan
                  </Button>
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <Check size={16} className="text-green-600" />
                  <span className="text-sm font-medium text-foreground" data-testid="text-current-plan">Family Plan</span>
                  <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full">Active</span>
                </div>
                <div className="bg-muted/30 rounded-xl p-3 space-y-1.5 text-xs text-muted-foreground">
                  <div className="flex justify-between">
                    <span>Plan</span>
                    <span className="font-medium text-foreground">Family ({subscription?.billingInterval === "yearly" ? "$119/year" : "$12/month"})</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Billing</span>
                    <span className="font-medium text-foreground">{subscription?.billingInterval === "yearly" ? "Annual" : "Monthly"}</span>
                  </div>
                  {subscription?.currentPeriodEnd && (
                    <div className="flex justify-between">
                      <span>Renews</span>
                      <span className="font-medium text-foreground">{new Date(subscription.currentPeriodEnd).toLocaleDateString()}</span>
                    </div>
                  )}
                  <div className="flex justify-between">
                    <span>Platform fee</span>
                    <span className="font-medium text-green-600">Waived</span>
                  </div>
                </div>
              </div>
            )}
          </div>
        </SectionCard>

        {/* Event Passes */}
        <SectionCard>
          <div className="p-5 space-y-4">
            <div className="flex items-center gap-3 mb-2">
              <CreditCard size={18} className="text-muted-foreground" />
              <h2 className="font-heading text-lg font-semibold text-foreground" data-testid="heading-event-passes">Event Boosts</h2>
            </div>

            {eventsWithPasses.length > 0 && (
              <div className="space-y-2 mb-3">
                {eventsWithPasses.map((event: any) => (
                  <div
                    key={event.id}
                    className="flex items-center justify-between p-3 rounded-xl border border-border/50"
                    data-testid={`card-event-pass-${event.id}`}
                  >
                    <div>
                      <p className="text-sm font-medium text-foreground">{event.name}</p>
                      <p className="text-xs text-green-600">Event Boost active</p>
                    </div>
                    <Check size={16} className="text-green-600" />
                  </div>
                ))}
              </div>
            )}

            {userPlan === "family" ? (
              <div className="bg-primary/5 rounded-xl border border-primary/20 p-4 space-y-2">
                <div className="flex items-center gap-2">
                  <Check size={16} className="text-primary" />
                  <p className="text-sm font-semibold text-foreground">Included with Family Plan</p>
                </div>
                <p className="text-sm text-muted-foreground">
                  Premium event pages, goal cards, and thank-you automation are all included. No Event Boost needed.
                </p>
              </div>
            ) : (
              <div className="bg-muted/30 rounded-xl border border-border/50 p-4 space-y-3">
                <div className="flex items-center gap-2">
                  <CreditCard size={16} className="text-muted-foreground" />
                  <p className="text-sm font-semibold text-foreground">Event Boost</p>
                  <span className="text-xs font-medium text-muted-foreground bg-muted px-2 py-0.5 rounded-full">$29 one-time</span>
                </div>
                <p className="text-sm text-muted-foreground">
                  Waives the $2 platform fee on gifts for one event. Includes premium themes, goal cards, and thank-you automation. Processing fees (Stripe) still apply.
                </p>
                <Link href="/events">
                  <Button
                    variant="outline"
                    className="w-full"
                    data-testid="button-buy-event-pass"
                    onClick={() => haptic("medium")}
                  >
                    View Events
                  </Button>
                </Link>
              </div>
            )}
          </div>
        </SectionCard>

        {/* Activate Investing */}
        <SectionCard>
          <div className="p-5 space-y-4">
            <div className="flex items-center gap-3 mb-2">
              <Shield size={18} className="text-muted-foreground" />
              <h2 className="font-heading text-lg font-semibold text-foreground" data-testid="heading-activate-investing">Activate Investing</h2>
            </div>

            {kycCompleted ? (
              <div className="space-y-3">
                <div className="flex items-center gap-3 p-3 rounded-xl bg-green-50 border border-green-200">
                  <Check size={20} className="text-green-600" />
                  <div>
                    <p className="text-sm font-medium text-green-700" data-testid="text-investing-active">Investing is active</p>
                    <p className="text-xs text-green-600">Identity verified. Your funds are investing automatically.</p>
                  </div>
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                <p className="text-sm text-muted-foreground" data-testid="text-activate-description">
                  Until we verify your identity, gifts collect as cash. Once verified, that cash starts investing automatically.
                </p>
                <Button
                  className="w-full"
                  data-testid="button-activate-investing"
                  onClick={() => {
                    haptic("medium");
                    navigate("/activate");
                  }}
                >
                  Activate
                </Button>
              </div>
            )}
          </div>
        </SectionCard>

        {/* Withdrawals & Selling */}
        <SectionCard>
          <div className="p-5 space-y-4">
            <div className="flex items-center gap-3 mb-2">
              <Wallet size={18} className="text-muted-foreground" />
              <h2 className="font-heading text-lg font-semibold text-foreground" data-testid="heading-withdrawals">Withdrawals & Selling</h2>
            </div>

            {holdingsData.length > 0 && (
              <div className="space-y-2 mb-3">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Your Holdings</p>
                {holdingsData.map((holding: any) => (
                  <div
                    key={holding.id}
                    className="flex items-center justify-between p-3 rounded-xl border border-border/50"
                    data-testid={`card-holding-${holding.id}`}
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-semibold text-foreground">{holding.ticker}</p>
                        <span className={`text-xs ${parseFloat(holding.gain) >= 0 ? "text-green-600" : "text-red-600"}`}>
                          {parseFloat(holding.gain) >= 0 ? "+" : ""}${parseFloat(holding.gain).toFixed(2)}
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground">{parseFloat(holding.shares).toFixed(4)} shares · ${parseFloat(holding.currentValue).toFixed(2)}</p>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      className="text-xs text-red-600 border-red-200 hover:bg-red-50"
                      onClick={() => {
                        setSelectedHolding(holding);
                        setSelectedFundForAction(primaryFund);
                        setSellHoldingOpen(true);
                        haptic("medium");
                      }}
                      data-testid={`button-sell-${holding.id}`}
                    >
                      Sell
                    </Button>
                  </div>
                ))}
              </div>
            )}

            {primaryFund && parseFloat(primaryFund.pendingBalance) > 0 && (
              <div className="bg-primary/5 rounded-xl border border-primary/20 p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-foreground">Available cash</p>
                    <p className="text-lg font-semibold text-foreground">${parseFloat(primaryFund.pendingBalance).toFixed(2)}</p>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setSelectedFundForAction(primaryFund);
                      setWithdrawOpen(true);
                      haptic("medium");
                    }}
                    data-testid="button-withdraw-cash"
                  >
                    <ArrowDownToLine size={14} className="mr-1" />
                    Withdraw
                  </Button>
                </div>
              </div>
            )}

            <div className="space-y-3">
              <div className="flex items-start gap-3 p-3 rounded-xl bg-muted/30">
                <ArrowUpRight size={14} className="text-primary mt-0.5 flex-shrink-0" />
                <div>
                  <p className="text-sm font-medium text-foreground mb-1">Selling investments</p>
                  <p className="text-xs text-muted-foreground" data-testid="text-sell-policy">
                    You can sell investments at any time, subject to standard settlement periods (typically 1 to 2 business days). For custodial (UTMA) accounts, proceeds must be used for the child's benefit. For personal accounts, you have full control.
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-3 p-3 rounded-xl bg-muted/30">
                <Wallet size={14} className="text-primary mt-0.5 flex-shrink-0" />
                <div>
                  <p className="text-sm font-medium text-foreground mb-1">Withdrawing cash</p>
                  <p className="text-xs text-muted-foreground" data-testid="text-withdraw-policy">
                    Cash from sold investments can be withdrawn to your linked bank account after trade settlement (typically T+1). Transfers typically arrive in 1 to 3 business days. Kora does not charge withdrawal fees. Standard brokerage and regulatory fees may apply.
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-3 p-3 rounded-xl bg-amber-50 border border-amber-200/50">
                <Lock size={14} className="text-amber-600 mt-0.5 flex-shrink-0" />
                <p className="text-xs text-amber-800" data-testid="text-irrevocable-note">
                  Gifts are irrevocable once received. They belong to the recipient and cannot be taken back by the giver.
                </p>
              </div>
            </div>
          </div>
        </SectionCard>

        {/* Bank Accounts */}
        <SectionCard>
          <div className="p-5 space-y-4">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-3">
                <Building2 size={18} className="text-muted-foreground" />
                <h2 className="font-heading text-lg font-semibold text-foreground" data-testid="heading-bank-accounts">Bank Accounts</h2>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => { setLinkBankOpen(true); haptic("selection"); }}
                className="text-xs gap-1"
                data-testid="button-link-bank"
              >
                <Plus size={14} />
                Link account
              </Button>
            </div>

            {bankAccounts.length === 0 ? (
              <div className="text-center py-4">
                <p className="text-sm text-muted-foreground mb-3" data-testid="text-no-bank-accounts">No bank accounts linked yet.</p>
                <Button
                  variant="outline"
                  onClick={() => { setLinkBankOpen(true); haptic("selection"); }}
                  className="gap-2"
                  data-testid="button-link-first-bank"
                >
                  <Building2 size={16} />
                  Link a bank account
                </Button>
              </div>
            ) : (
              <div className="space-y-2">
                {bankAccounts.map((ba: any) => (
                  <div
                    key={ba.id}
                    className="flex items-center justify-between p-3 rounded-xl border border-border/50"
                    data-testid={`card-bank-${ba.id}`}
                  >
                    <div className="flex items-center gap-3">
                      <Building2 size={16} className="text-muted-foreground" />
                      <div>
                        <p className="text-sm font-medium text-foreground">{ba.bankName}</p>
                        <p className="text-xs text-muted-foreground">{ba.accountType} ****{ba.accountLast4}</p>
                      </div>
                    </div>
                    <button
                      onClick={() => handleDeleteBankAccount(ba.id)}
                      className="text-muted-foreground hover:text-red-600 transition-colors p-1"
                      data-testid={`button-remove-bank-${ba.id}`}
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </SectionCard>

        {/* Privacy */}
        <SectionCard>
          <div className="p-5 space-y-4">
            <div className="flex items-center gap-3 mb-2">
              {isAnyFundDiscoverable ? <Eye size={18} className="text-muted-foreground" /> : <EyeOff size={18} className="text-muted-foreground" />}
              <h2 className="font-heading text-lg font-semibold text-foreground" data-testid="heading-privacy">Privacy</h2>
            </div>

            {funds.map((fund: any) => (
              <div key={fund.id} className="flex items-center justify-between">
                <div className="flex-1 mr-4">
                  <p className="text-sm font-medium text-foreground">{fund.name}</p>
                  <p className="text-xs text-muted-foreground">{fund.isDiscoverable ? "Discoverable" : "Private (link only)"}</p>
                </div>
                <Switch
                  checked={fund.isDiscoverable || false}
                  onCheckedChange={(val) => handleToggleDiscoverable(fund.id, val)}
                  data-testid={`toggle-discoverable-${fund.id}`}
                />
              </div>
            ))}

            <div className="flex items-start gap-2 p-3 rounded-xl bg-muted/30">
              <Lock size={14} className="text-muted-foreground mt-0.5 flex-shrink-0" />
              <p className="text-xs text-muted-foreground" data-testid="text-privacy-note">
                Children's funds are always private and accessible only by link
              </p>
            </div>
          </div>
        </SectionCard>

        {/* Danger Zone */}
        <SectionCard className="border-red-200/50">
          <div className="p-5">
            <Button
              variant="destructive"
              className="w-full"
              data-testid="button-sign-out"
              onClick={handleSignOut}
            >
              <LogOut size={16} />
              Sign Out
            </Button>
          </div>
        </SectionCard>

      </div>

      <AddFundSheet
        open={addFundOpen}
        onClose={() => setAddFundOpen(false)}
        onSuccess={() => {
          navigate("/dashboard");
        }}
      />

      <SellHoldingSheet
        open={sellHoldingOpen}
        onClose={() => { setSellHoldingOpen(false); setSelectedHolding(null); }}
        holding={selectedHolding}
        fund={selectedFundForAction}
        onSuccess={refreshAll}
      />

      <WithdrawSheet
        open={withdrawOpen}
        onClose={() => setWithdrawOpen(false)}
        fund={selectedFundForAction || primaryFund}
        bankAccounts={bankAccounts}
        onSuccess={refreshAll}
      />

      <LinkBankSheet
        open={linkBankOpen}
        onClose={() => setLinkBankOpen(false)}
        onSuccess={() => queryClient.invalidateQueries({ queryKey: ["/api/bank-accounts"] })}
      />
    </div>
  );
}
