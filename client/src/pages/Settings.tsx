import { useState, useRef } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocation, Link } from "wouter";
import { motion } from "framer-motion";
import { useAuth } from "@/hooks/use-auth";
import { useSubscription } from "@/hooks/use-subscription";
import { haptic } from "@/lib/haptics";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { AddFundSheet } from "@/components/AddFundSheet";
import { toast } from "@/hooks/use-toast";
import {
  User, CreditCard, Shield, Eye, EyeOff, LogOut, Check,
  ChevronRight, Star, Lock, Crown, ArrowUpRight, Wallet, ChevronLeft, Plus, Loader2, Camera
} from "lucide-react";
import { Logo } from "@/components/ui/logo";

function SectionCard({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`bg-card rounded-2xl border border-border/50 shadow-premium-sm ${className}`}>
      {children}
    </div>
  );
}

export default function Settings() {
  const { user, isLoading: authLoading, logout } = useAuth();
  const [, navigate] = useLocation();
  const [editingName, setEditingName] = useState(false);
  const [nameValue, setNameValue] = useState("");
  const [discoverable, setDiscoverable] = useState(false);
  const [addFundOpen, setAddFundOpen] = useState(false);

  const { data: funds = [] } = useQuery<any[]>({
    queryKey: ["/api/funds"],
    queryFn: async () => {
      const res = await fetch("/api/funds", { credentials: "include" });
      if (!res.ok) return [];
      return res.json();
    },
    enabled: !!user,
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

  const queryClient = useQueryClient();
  const { data: subscription } = useSubscription();
  const [upgrading, setUpgrading] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const displayName = `${user.firstName || ""} ${user.lastName || ""}`.trim() || "User";
  const userEmail = user.email || "";
  const userPlan = (subscription?.plan === "family" && subscription?.status === "active") ? "family" : "free";
  const kycCompleted = false;

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

  const handleSignOut = () => {
    haptic("medium");
    logout();
  };

  return (
    <div className="md:ml-[220px] lg:ml-[260px] min-h-screen bg-background">
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
                  <motion.div
                    key={fund.id}
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
                </div>
                <div className="bg-gradient-to-br from-primary/5 to-primary/10 rounded-xl border border-primary/20 p-4 space-y-3">
                  <div className="flex items-center gap-2">
                    <Crown size={16} className="text-primary" />
                    <p className="text-sm font-semibold text-foreground">Family Plan</p>
                    <span className="text-xs font-medium text-primary bg-primary/10 px-2 py-0.5 rounded-full">$149/year</span>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    One price for your whole family. Platform fee waived on up to $15,000 in gifts per year.
                  </p>
                  <ul className="space-y-1.5 text-sm text-muted-foreground">
                    <li className="flex items-center gap-2">
                      <Check size={14} className="text-primary" />
                      Unlimited premium event pages
                    </li>
                    <li className="flex items-center gap-2">
                      <Check size={14} className="text-primary" />
                      Household dashboard
                    </li>
                    <li className="flex items-center gap-2">
                      <Check size={14} className="text-primary" />
                      Recurring gift management
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
            ) : (
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Check size={16} className="text-green-600" />
                  <span className="text-sm font-medium text-foreground" data-testid="text-current-plan">Family Plan</span>
                  <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full">Active</span>
                </div>
                <p className="text-sm text-muted-foreground" data-testid="text-renewal-date">Renews on your next billing date</p>
              </div>
            )}
          </div>
        </SectionCard>

        {/* Event Passes */}
        <SectionCard>
          <div className="p-5 space-y-4">
            <div className="flex items-center gap-3 mb-2">
              <CreditCard size={18} className="text-muted-foreground" />
              <h2 className="font-heading text-lg font-semibold text-foreground" data-testid="heading-event-passes">Event Passes</h2>
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
                      <p className="text-xs text-green-600">Event Pass active</p>
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
                  Premium event pages, goal cards, and thank-you automation are all included. No Event Pass needed.
                </p>
              </div>
            ) : (
              <div className="bg-muted/30 rounded-xl border border-border/50 p-4 space-y-3">
                <div className="flex items-center gap-2">
                  <CreditCard size={16} className="text-muted-foreground" />
                  <p className="text-sm font-semibold text-foreground">Event Pass</p>
                  <span className="text-xs font-medium text-muted-foreground bg-muted px-2 py-0.5 rounded-full">$99 one-time</span>
                </div>
                <p className="text-sm text-muted-foreground">
                  Waives the platform fee up to $7,500 for one event. Includes premium themes, goal cards, and thank-you automation.
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
              <div className="flex items-center gap-3 p-3 rounded-xl bg-green-50 border border-green-200">
                <Check size={20} className="text-green-600" />
                <p className="text-sm font-medium text-green-700" data-testid="text-investing-active">Investing is active</p>
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

        {/* Privacy */}
        <SectionCard>
          <div className="p-5 space-y-4">
            <div className="flex items-center gap-3 mb-2">
              {discoverable ? <Eye size={18} className="text-muted-foreground" /> : <EyeOff size={18} className="text-muted-foreground" />}
              <h2 className="font-heading text-lg font-semibold text-foreground" data-testid="heading-privacy">Privacy</h2>
            </div>

            <div className="flex items-center justify-between">
              <div className="flex-1 mr-4">
                <p className="text-sm font-medium text-foreground">Make my funds discoverable</p>
              </div>
              <Switch
                checked={discoverable}
                onCheckedChange={(val) => {
                  setDiscoverable(val);
                  haptic("selection");
                }}
                data-testid="toggle-discoverable"
              />
            </div>

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
    </div>
  );
}