import { useRef, useState } from "react";
import { useLocation, Link } from "wouter";
import { useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { useSubscription } from "@/hooks/use-subscription";
import { haptic } from "@/lib/haptics";
import { toast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Check, ChevronRight, LogOut, Shield, Camera, Eye, EyeOff, UserPlus } from "lucide-react";
import { TrustMicroStrip } from "@/components/ui/ux-foundations";
import { AppHeader } from "@/components/layout/AppHeader";
import { DeleteAccountModal } from "@/components/DeleteAccountModal";
import { PasskeyManager } from "@/components/PasskeyManager";

const PROFILE_IMAGE_MAX_BYTES = 5 * 1024 * 1024;

type AccountTab = "personal" | "plan" | "security";

function SectionCard({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`kiddo-card ${className}`}>
      {children}
    </div>
  );
}

export default function Account() {
  const [, navigate] = useLocation();
  const { user, logout } = useAuth();
  const { data: subscription, isLoading: subLoading } = useSubscription();
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [accountTab, setAccountTab] = useState<AccountTab>("personal");

  // Name editing
  const [editingName, setEditingName] = useState(false);
  const [nameValue, setNameValue] = useState("");

  // Preferred name
  const [preferredName, setPreferredName] = useState<string>(() => (user as any)?.preferredName || "");
  const [savingPreferredName, setSavingPreferredName] = useState(false);

  // Photo upload
  const [uploadingPhoto, setUploadingPhoto] = useState(false);

  // Password change
  const [changingPassword, setChangingPassword] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showCurrentPw, setShowCurrentPw] = useState(false);
  const [showNewPw, setShowNewPw] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);

  // Trusted contact (FINRA Rule 4512). Lives on the security tab
  // because semantically it IS a security/safety net for the account,
  // not a money-management surface. Locally tracked so the parent can
  // edit without an "edit mode" toggle round-trip; we save via PATCH
  // /api/user/profile when they hit Save. Empty strings clear fields.
  const trustedContactSaved = {
    name: ((user as any)?.trustedContactName as string) || "",
    email: ((user as any)?.trustedContactEmail as string) || "",
    phone: ((user as any)?.trustedContactPhone as string) || "",
    relation: ((user as any)?.trustedContactRelation as string) || "",
  };
  const [trustedContactName, setTrustedContactName] = useState(trustedContactSaved.name);
  const [trustedContactEmail, setTrustedContactEmail] = useState(trustedContactSaved.email);
  const [trustedContactPhone, setTrustedContactPhone] = useState(trustedContactSaved.phone);
  const [trustedContactRelation, setTrustedContactRelation] = useState(trustedContactSaved.relation);
  const [savingTrustedContact, setSavingTrustedContact] = useState(false);
  const trustedContactDirty =
    trustedContactName.trim() !== trustedContactSaved.name.trim() ||
    trustedContactEmail.trim() !== trustedContactSaved.email.trim() ||
    trustedContactPhone.trim() !== trustedContactSaved.phone.trim() ||
    trustedContactRelation.trim() !== trustedContactSaved.relation.trim();
  const trustedContactHasAny = Boolean(
    trustedContactSaved.name ||
    trustedContactSaved.email ||
    trustedContactSaved.phone ||
    trustedContactSaved.relation,
  );

  const userPlan = subLoading ? null : (subscription?.effectivePlan ?? "free");
  const planLabel =
    userPlan === "legacy"
      ? "Kiddo Legacy"
      : userPlan === "family"
        ? "Kiddo Family"
        : userPlan === "starter"
          ? "Kiddo+"
          : userPlan === "free"
            ? "Free"
            : "-";

  const displayName = `${user?.firstName || ""} ${user?.lastName || ""}`.trim() || "";
  const initial = (user?.firstName || user?.email || "U").slice(0, 1).toUpperCase();
  // Account-deletion modal state. Modal handles the multi-step flow
  // (review → confirm → submit → done) + the blocked-for-balance state.
  const [deleteAccountModalOpen, setDeleteAccountModalOpen] = useState(false);
  const profileNeedsName = !displayName;
  const profileNeedsPhoto = !user?.profileImageUrl;
  const profileNeedsCompletion = profileNeedsName || profileNeedsPhoto;

  const selectTab = (tab: AccountTab) => {
    setAccountTab(tab);
    haptic("selection");
  };

  const handleLogout = () => {
    haptic("medium");
    logout();
  };

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast({ title: "Invalid file type", description: "Please choose an image file.", variant: "destructive" });
      return;
    }
    if (file.size > PROFILE_IMAGE_MAX_BYTES) {
      toast({ title: "Photo too large", description: "Please choose an image under 5MB.", variant: "destructive" });
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
        const payload = await res.json().catch(() => ({}));
        if (res.ok) {
          queryClient.setQueryData(["/api/auth/user"], payload);
          haptic("success");
          toast({ title: "Photo updated" });
        } else {
          toast({ title: "Could not update photo", description: payload?.error || "Please try a smaller image.", variant: "destructive" });
        }
        setUploadingPhoto(false);
      };
      reader.readAsDataURL(file);
    } catch {
      toast({ title: "Could not update photo", variant: "destructive" });
      setUploadingPhoto(false);
    }
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
        const updated = await res.json();
        queryClient.setQueryData(["/api/auth/user"], updated);
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

  const handleSavePreferredName = async () => {
    setSavingPreferredName(true);
    haptic("medium");
    try {
      const res = await fetch("/api/user/profile", {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ preferredName: preferredName.trim() }),
      });
      if (res.ok) {
        const updated = await res.json();
        queryClient.setQueryData(["/api/auth/user"], updated);
        haptic("success");
        toast({ title: "Saved" });
      } else {
        let msg = `Status ${res.status}`;
        try { const d = await res.json(); msg = d.error || d.message || msg; } catch {}
        toast({ title: "Could not save", description: msg, variant: "destructive" });
      }
    } catch (err: any) {
      toast({ title: "Could not save", description: err?.message || "Network error", variant: "destructive" });
    }
    setSavingPreferredName(false);
  };

  const handleSaveTrustedContact = async () => {
    setSavingTrustedContact(true);
    haptic("medium");
    try {
      const res = await fetch("/api/user/profile", {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          trustedContactName: trustedContactName.trim(),
          trustedContactEmail: trustedContactEmail.trim(),
          trustedContactPhone: trustedContactPhone.trim(),
          trustedContactRelation: trustedContactRelation.trim(),
        }),
      });
      if (res.ok) {
        const updated = await res.json();
        queryClient.setQueryData(["/api/auth/user"], updated);
        haptic("success");
        toast({ title: "Trusted contact saved" });
      } else {
        let msg = `Status ${res.status}`;
        try { const d = await res.json(); msg = d.error || d.message || msg; } catch {}
        toast({ title: "Could not save", description: msg, variant: "destructive" });
      }
    } catch (err: any) {
      toast({ title: "Could not save", description: err?.message || "Network error", variant: "destructive" });
    }
    setSavingTrustedContact(false);
  };

  const handleClearTrustedContact = async () => {
    setSavingTrustedContact(true);
    haptic("medium");
    try {
      const res = await fetch("/api/user/profile", {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          trustedContactName: "",
          trustedContactEmail: "",
          trustedContactPhone: "",
          trustedContactRelation: "",
        }),
      });
      if (res.ok) {
        const updated = await res.json();
        queryClient.setQueryData(["/api/auth/user"], updated);
        setTrustedContactName("");
        setTrustedContactEmail("");
        setTrustedContactPhone("");
        setTrustedContactRelation("");
        haptic("success");
        toast({ title: "Trusted contact removed" });
      } else {
        toast({ title: "Could not remove", variant: "destructive" });
      }
    } catch (err: any) {
      toast({ title: "Could not remove", description: err?.message || "Network error", variant: "destructive" });
    }
    setSavingTrustedContact(false);
  };

  const handleChangePassword = async () => {
    if (newPassword !== confirmPassword) {
      toast({ title: "Passwords don't match", variant: "destructive" });
      return;
    }
    if (newPassword.length < 8) {
      toast({ title: "New password must be at least 8 characters", variant: "destructive" });
      return;
    }
    setSavingPassword(true);
    try {
      const res = await fetch("/api/user/change-password", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      const payload = await res.json().catch(() => ({}));
      if (res.ok) {
        haptic("success");
        toast({ title: "Password updated" });
        setChangingPassword(false);
        setCurrentPassword("");
        setNewPassword("");
        setConfirmPassword("");
      } else {
        toast({ title: "Could not update password", description: payload?.error || "Please try again.", variant: "destructive" });
      }
    } catch {
      toast({ title: "Could not update password", variant: "destructive" });
    }
    setSavingPassword(false);
  };

  return (
    <div className="kiddo-app-page md:ml-[264px] pb-24 md:pb-8" data-testid="page-account">
      <AppHeader />

      <main className="kiddo-canvas px-4 py-6 space-y-6">
        <div className="kiddo-tab-row max-w-full overflow-x-auto" data-testid="account-tabs">
          {[
            { id: "personal", label: "Personal info" },
            { id: "plan", label: "Plan & billing" },
            { id: "security", label: "Security" },
          ].map((tab) => (
            <button
              key={tab.id}
              type="button"
              className="kiddo-tab-item whitespace-nowrap"
              data-active={accountTab === tab.id ? "true" : "false"}
              onClick={() => selectTab(tab.id as AccountTab)}
              data-testid={`account-tab-${tab.id}`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* ── Personal Info ── */}
        {accountTab === "personal" && (
          <div className="space-y-4">
            {profileNeedsCompletion && (
              <SectionCard className="border-primary/20 bg-primary/5">
                <div className="p-4">
                  <p className="text-sm font-semibold text-foreground">Make your child's fund feel personal</p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Add your {profileNeedsName && profileNeedsPhoto ? "name and photo" : profileNeedsName ? "name" : "photo"} so the Memory Book shows who started this story.
                  </p>
                </div>
              </SectionCard>
            )}

            {/* Avatar + name + email */}
            <SectionCard>
              <div className="p-5 space-y-5">
                {/* Avatar */}
                <div className="flex items-center gap-4">
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={uploadingPhoto}
                    className="relative h-16 w-16 shrink-0 rounded-full overflow-hidden border border-[hsl(var(--kiddo-border))] bg-[hsl(var(--kiddo-cream-dark))] group"
                    data-testid="button-change-profile-photo"
                  >
                    {user?.profileImageUrl ? (
                      <img src={user.profileImageUrl} alt="" className="h-full w-full object-cover" />
                    ) : (
                      <span className="flex h-full w-full items-center justify-center text-xl font-bold text-foreground">{initial}</span>
                    )}
                    <div className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 transition-opacity group-hover:opacity-100">
                      {uploadingPhoto
                        ? <div className="h-4 w-4 animate-spin rounded-full border-2 border-white/60 border-t-white" />
                        : <Camera size={18} className="text-white" />}
                    </div>
                  </button>
                  <input
                    ref={fileInputRef}
                    id="account-profile-photo"
                    name="profilePhoto"
                    type="file"
                    accept="image/*"
                    onChange={handlePhotoUpload}
                    aria-label="Upload profile photo"
                    className="hidden"
                  />
                  <p className="text-xs text-muted-foreground">
                    {profileNeedsPhoto ? "Add a photo so your child's Memory Book has a real face behind it." : "Tap to change photo."}
                  </p>
                </div>

                {/* Name row */}
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    {/* `<p>` → `<label>` so the form-field gets a real
                        association. htmlFor matches the input's id
                        below — fixes Lighthouse "No label associated
                        with form field". */}
                    <label htmlFor="account-profile-name" className="block text-xs text-muted-foreground mb-1">Name</label>
                    {editingName ? (
                      <div className="flex items-center gap-2">
                        <input
                          id="account-profile-name"
                          name="firstName"
                          type="text"
                          autoComplete="given-name"
                          value={nameValue}
                          onChange={e => setNameValue(e.target.value)}
                          onKeyDown={e => { if (e.key === "Enter") handleSaveName(); if (e.key === "Escape") setEditingName(false); }}
                          className="h-9 flex-1 rounded-lg border border-border bg-background px-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20"
                          autoFocus
                          data-testid="input-profile-name"
                        />
                        <Button size="sm" onClick={handleSaveName} data-testid="button-save-profile-name">Save</Button>
                        <Button size="sm" variant="ghost" onClick={() => setEditingName(false)}>Cancel</Button>
                      </div>
                    ) : (
                      <p className="text-sm font-semibold text-foreground" data-testid="text-profile-name">
                        {displayName || <span className="italic text-muted-foreground">Not set</span>}
                      </p>
                    )}
                  </div>
                  {!editingName && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="shrink-0 text-[hsl(var(--kiddo-evergreen))] hover:text-[hsl(var(--kiddo-evergreen))]"
                      onClick={() => { setNameValue(displayName); setEditingName(true); haptic("light"); }}
                      data-testid="button-edit-profile-name"
                    >
                      Edit
                    </Button>
                  )}
                </div>

                {/* Email row */}
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Email</p>
                  <p className="text-sm font-semibold text-foreground" data-testid="text-profile-email">{user?.email}</p>
                </div>

                {/* Preferred name */}
                <div>
                  <label htmlFor="account-preferred-name" className="block text-xs font-semibold text-foreground mb-1.5">
                    What do your kids call you?
                  </label>
                  <input
                    id="account-preferred-name"
                    name="preferredName"
                    type="text"
                    autoComplete="nickname"
                    value={preferredName}
                    onChange={(e) => setPreferredName(e.target.value.slice(0, 50))}
                    placeholder="Dad, Mom, Papa, Mama…"
                    className="h-10 w-full rounded-xl border border-border bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
                    data-testid="input-preferred-name"
                  />
                  <p className="mt-1.5 text-[11px] text-muted-foreground">
                    Shows up in the Memory Book and Kid's View. Optional.
                  </p>
                  <Button
                    size="sm"
                    className="mt-3 rounded-xl"
                    disabled={savingPreferredName || preferredName === ((user as any)?.preferredName || "")}
                    onClick={handleSavePreferredName}
                    data-testid="button-save-preferred-name"
                  >
                    {savingPreferredName ? "Saving…" : "Save"}
                  </Button>
                </div>
              </div>
            </SectionCard>

            {/* Plan + legal */}
            <SectionCard>
              <div className="divide-y divide-[hsl(var(--kiddo-border))]">
                <div className="flex items-center justify-between gap-4 p-4">
                  <span className="text-sm text-muted-foreground">Current plan</span>
                  <span className="text-sm font-semibold text-foreground">{planLabel}</span>
                </div>
                <a href="/legal" target="_blank" rel="noopener noreferrer" className="flex items-center justify-between gap-4 p-4 transition-colors hover:bg-muted/30">
                  <span className="text-sm text-muted-foreground">Legal disclosures</span>
                  <ChevronRight size={16} className="text-muted-foreground" />
                </a>
              </div>
            </SectionCard>

            <button
              type="button"
              onClick={handleLogout}
              className="flex w-full items-center justify-center gap-2 rounded-2xl border border-border px-4 py-3 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted/30 hover:text-foreground"
            >
              <LogOut size={15} />
              Log out
            </button>
          </div>
        )}

        {/* ── Plan & Billing ── */}
        {accountTab === "plan" && (
          <div className="space-y-4">
            {subLoading ? (
              <div className="kiddo-card h-24 animate-pulse" />
            ) : (
              <SectionCard className="bg-[hsl(var(--kiddo-evergreen)/0.06)] border-[hsl(var(--kiddo-evergreen)/0.18)]">
                <div className="flex items-start gap-3 p-5">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[hsl(var(--kiddo-evergreen))] text-white">
                    <Check size={17} />
                  </div>
                  <div>
                    <p className="text-sm font-bold text-[hsl(var(--kiddo-evergreen))]">{planLabel} · Active</p>
                    <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                      {userPlan === "starter"
                        ? "Recurring investments, photo and video Memory Book entries, custom fund mix, and co-parent access."
                        : userPlan === "family"
                          // "Family-wide occasions" → honest rename per
                          // 2026-05-12 pricing-page cleanup. The actual
                          // Family-plan event differential is unlimited
                          // events with premium features bundled, not
                          // cross-fund occasion tools.
                          ? "Unlimited funds, unlimited occasions, and Kid View across every child."
                          : userPlan === "legacy"
                            ? "Everything in Family, plus 2 Occasion credits per year."
                            : "One child fund, a gift link, the Memory Book basics, no platform fee on normal gifts."}
                    </p>
                  </div>
                </div>
              </SectionCard>
            )}

            <SectionCard>
              <button
                type="button"
                className="flex w-full items-center justify-between gap-4 p-5 text-left transition-colors hover:bg-muted/20"
                onClick={() => navigate("/settings?tab=membership&from=account")}
                data-testid="button-manage-membership"
              >
                <div>
                  <p className="text-sm font-bold text-foreground">Manage membership</p>
                  <p className="mt-0.5 text-sm text-muted-foreground">
                    {userPlan === "free"
                      ? "See plans and upgrade options for your funds."
                      : "View your plan details, billing, and upgrade options."}
                  </p>
                </div>
                <ChevronRight size={18} className="shrink-0 text-muted-foreground" />
              </button>
            </SectionCard>

          </div>
        )}

        {/* ── Security ── */}
        {accountTab === "security" && (
          <div className="space-y-4">
            <SectionCard>
              <div className="divide-y divide-[hsl(var(--kiddo-border))]">
                {/* Password row */}
                <div className="p-4">
                  {!changingPassword ? (
                    <div className="flex items-center justify-between gap-4">
                      <div>
                        <p className="text-sm font-semibold text-foreground">Password</p>
                        <p className="mt-0.5 text-xs text-muted-foreground">Change your login password</p>
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        className="shrink-0 rounded-xl"
                        onClick={() => { setChangingPassword(true); haptic("light"); }}
                        data-testid="button-change-password"
                      >
                        Change
                      </Button>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      <p className="text-sm font-semibold text-foreground">Change password</p>
                      {/* sr-only labels on each password field — visible
                          placeholder reads as the field hint, screen
                          readers get the proper label association. The
                          autoComplete hints (current-password vs
                          new-password) help password managers pick the
                          right values + pass WCAG. */}
                      <div className="relative">
                        <label htmlFor="account-current-password" className="sr-only">Current password</label>
                        <input
                          id="account-current-password"
                          name="currentPassword"
                          type={showCurrentPw ? "text" : "password"}
                          autoComplete="current-password"
                          value={currentPassword}
                          onChange={e => setCurrentPassword(e.target.value)}
                          placeholder="Current password"
                          className="w-full rounded-xl border border-border bg-background px-3 py-2.5 pr-10 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/20"
                          data-testid="input-current-password"
                        />
                        <button type="button" onClick={() => setShowCurrentPw(v => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground" aria-label={showCurrentPw ? "Hide current password" : "Show current password"}>
                          {showCurrentPw ? <EyeOff size={15} /> : <Eye size={15} />}
                        </button>
                      </div>
                      <div className="relative">
                        <label htmlFor="account-new-password" className="sr-only">New password</label>
                        <input
                          id="account-new-password"
                          name="newPassword"
                          type={showNewPw ? "text" : "password"}
                          autoComplete="new-password"
                          value={newPassword}
                          onChange={e => setNewPassword(e.target.value)}
                          placeholder="New password (min 8 chars)"
                          className="w-full rounded-xl border border-border bg-background px-3 py-2.5 pr-10 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/20"
                          data-testid="input-new-password"
                        />
                        <button type="button" onClick={() => setShowNewPw(v => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground" aria-label={showNewPw ? "Hide new password" : "Show new password"}>
                          {showNewPw ? <EyeOff size={15} /> : <Eye size={15} />}
                        </button>
                      </div>
                      <label htmlFor="account-confirm-password" className="sr-only">Confirm new password</label>
                      <input
                        id="account-confirm-password"
                        name="confirmPassword"
                        type="password"
                        autoComplete="new-password"
                        value={confirmPassword}
                        onChange={e => setConfirmPassword(e.target.value)}
                        placeholder="Confirm new password"
                        className="w-full rounded-xl border border-border bg-background px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/20"
                        data-testid="input-confirm-password"
                      />
                      <div className="flex gap-2 pt-1">
                        <Button
                          size="sm"
                          onClick={handleChangePassword}
                          disabled={savingPassword || !currentPassword || !newPassword || !confirmPassword}
                          className="rounded-xl"
                          data-testid="button-save-password"
                        >
                          {savingPassword ? "Saving..." : "Update password"}
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => { setChangingPassword(false); setCurrentPassword(""); setNewPassword(""); setConfirmPassword(""); }}
                        >
                          Cancel
                        </Button>
                      </div>
                    </div>
                  )}
                </div>

                <div className="flex items-center justify-between gap-4 p-4">
                  <div>
                    <p className="text-sm font-semibold text-foreground">Two-factor authentication</p>
                    <p className="mt-0.5 text-xs text-muted-foreground">Coming soon</p>
                  </div>
                  <span className="rounded-full bg-muted px-2.5 py-1 text-xs text-muted-foreground">Soon</span>
                </div>
              </div>
            </SectionCard>

            {/* Trusted contact (FINRA Rule 4512). Required-ish field for
                the brokerage relationship via DriveWealth: someone we
                can reach if we can't reach the parent, if we suspect
                financial exploitation, or to confirm a legal-guardian
                identity. Doubles as the right safety net for the kid-
                at-18 handoff failure path (parent unreachable at the
                exact moment a transfer needs to land). Optional in
                practice today; if/when DriveWealth enforces it the
                gate can be promoted to a setup-progress step. */}
            <SectionCard>
              <div className="p-5">
                <div className="flex items-start gap-3">
                  <UserPlus size={18} className="mt-0.5 shrink-0 text-[hsl(var(--kiddo-evergreen))]" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-foreground">Trusted contact</p>
                    <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                      Someone we can reach if we can't reach you. Used only for account
                      safety, identity confirmation, or suspected financial exploitation.
                      Required for FINRA-regulated accounts via our broker DriveWealth.
                    </p>
                  </div>
                </div>

                <div className="mt-4 space-y-3">
                  <div>
                    <label htmlFor="account-trusted-name" className="block text-xs font-medium text-muted-foreground mb-1.5">
                      Name
                    </label>
                    <input
                      id="account-trusted-name"
                      name="trustedContactName"
                      type="text"
                      autoComplete="name"
                      value={trustedContactName}
                      onChange={(e) => setTrustedContactName(e.target.value)}
                      placeholder="Full name"
                      maxLength={200}
                      className="w-full rounded-xl border border-border bg-background px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:ring-2 focus:ring-primary/20"
                      data-testid="input-trusted-contact-name"
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label htmlFor="account-trusted-email" className="block text-xs font-medium text-muted-foreground mb-1.5">
                        Email
                      </label>
                      <input
                        id="account-trusted-email"
                        name="trustedContactEmail"
                        type="email"
                        autoComplete="email"
                        value={trustedContactEmail}
                        onChange={(e) => setTrustedContactEmail(e.target.value)}
                        placeholder="name@example.com"
                        maxLength={254}
                        className="w-full rounded-xl border border-border bg-background px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:ring-2 focus:ring-primary/20"
                        data-testid="input-trusted-contact-email"
                      />
                    </div>
                    <div>
                      <label htmlFor="account-trusted-phone" className="block text-xs font-medium text-muted-foreground mb-1.5">
                        Phone
                      </label>
                      <input
                        id="account-trusted-phone"
                        name="trustedContactPhone"
                        type="tel"
                        autoComplete="tel"
                        value={trustedContactPhone}
                        onChange={(e) => setTrustedContactPhone(e.target.value)}
                        placeholder="(555) 123-4567"
                        maxLength={32}
                        className="w-full rounded-xl border border-border bg-background px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:ring-2 focus:ring-primary/20"
                        data-testid="input-trusted-contact-phone"
                      />
                    </div>
                  </div>

                  <div>
                    <label htmlFor="account-trusted-relation" className="block text-xs font-medium text-muted-foreground mb-1.5">
                      Relationship
                    </label>
                    <input
                      id="account-trusted-relation"
                      name="trustedContactRelation"
                      type="text"
                      autoComplete="off"
                      value={trustedContactRelation}
                      onChange={(e) => setTrustedContactRelation(e.target.value)}
                      placeholder="e.g. Spouse, Parent, Sibling, Adult child"
                      maxLength={50}
                      className="w-full rounded-xl border border-border bg-background px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:ring-2 focus:ring-primary/20"
                      data-testid="input-trusted-contact-relation"
                    />
                  </div>

                  <div className="flex flex-wrap gap-2 pt-1">
                    <Button
                      size="sm"
                      onClick={handleSaveTrustedContact}
                      disabled={savingTrustedContact || !trustedContactDirty}
                      className="rounded-xl"
                      data-testid="button-save-trusted-contact"
                    >
                      {savingTrustedContact ? "Saving..." : trustedContactHasAny ? "Update" : "Save"}
                    </Button>
                    {trustedContactHasAny && (
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={handleClearTrustedContact}
                        disabled={savingTrustedContact}
                        className="rounded-xl"
                        data-testid="button-clear-trusted-contact"
                      >
                        Remove contact
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            </SectionCard>

            <SectionCard>
              <div className="flex items-start gap-3 p-5">
                <Shield size={18} className="mt-0.5 shrink-0 text-[hsl(var(--kiddo-evergreen))]" />
                <div>
                  <p className="text-sm font-bold text-foreground">SIPC protection</p>
                  <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                    DriveWealth, LLC is a registered broker-dealer and member of FINRA/SIPC. Securities in your account are protected up to $500,000 against brokerage failure. This does not protect against market losses.
                  </p>
                  <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1">
                    <a href="https://www.sipc.org" target="_blank" rel="noopener noreferrer" className="text-xs font-semibold text-[hsl(var(--kiddo-evergreen))] hover:underline">sipc.org</a>
                    <a href="https://brokercheck.finra.org" target="_blank" rel="noopener noreferrer" className="text-xs font-semibold text-[hsl(var(--kiddo-evergreen))] hover:underline">FINRA BrokerCheck</a>
                    <Link href="/security" className="text-xs font-semibold text-[hsl(var(--kiddo-evergreen))] hover:underline">Kiddo security</Link>
                  </div>
                </div>
              </div>
            </SectionCard>

            {/* Passkey manager. Per FACE_ID_SPEC.md WebAuthn item.
                Self-contained — fetches its own list, runs the
                add/remove ceremonies, falls through silently when
                no passkeys are registered. */}
            <PasskeyManager />

            <button
              type="button"
              onClick={handleLogout}
              className="flex w-full items-center justify-center gap-2 rounded-2xl border border-border px-4 py-3 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted/30 hover:text-foreground"
            >
              <LogOut size={15} />
              Log out
            </button>

            {/* Account deletion — App Store 5.1.1(v) compliance. Quiet but
                findable at the bottom of Account settings, below logout.
                Apple-Settings register per project_cancellation_dark_pattern_avoidance.md:
                no "please stay" upsell, no guilt phrasing, no hidden cancel
                button. Confirmation modal is rendered separately so the
                destructive action requires a deliberate second step. */}
            <button
              type="button"
              onClick={() => setDeleteAccountModalOpen(true)}
              className="mt-3 flex w-full items-center justify-center gap-2 rounded-2xl px-4 py-2.5 text-xs font-medium text-muted-foreground/70 transition-colors hover:text-red-600"
              data-testid="button-delete-account"
            >
              Delete my account
            </button>
          </div>
        )}

        <TrustMicroStrip />

        {/* Account deletion confirmation dialog. Renders the multi-step
            flow described in project_account_deletion_spec.md:
              1. Explain what gets deleted vs preserved (especially: kid's
                 Memory Book, tax records, and active funds are NOT deleted
                 by this action — UTMA legal mechanics)
              2. If funds need attention: surface guidance + close-fund link
              3. Type-to-confirm with the user's email
              4. POST /api/account/delete, show success state, log out
        */}
        <DeleteAccountModal
          open={deleteAccountModalOpen}
          onClose={() => setDeleteAccountModalOpen(false)}
          userEmail={user?.email ?? null}
          onDeleted={() => {
            setDeleteAccountModalOpen(false);
            logout();
          }}
        />
      </main>
    </div>
  );
}
