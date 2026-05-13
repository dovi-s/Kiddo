import { useRef, useState } from "react";
import { useLocation, Link } from "wouter";
import { useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { useAuth } from "@/hooks/use-auth";
import { useSubscription } from "@/hooks/use-subscription";
import { haptic } from "@/lib/haptics";
import { toast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Logo } from "@/components/ui/logo";
import { User, Camera, ChevronLeft, Settings, LogOut, Crown } from "lucide-react";

const PROFILE_IMAGE_MAX_BYTES = 5 * 1024 * 1024;

function SectionCard({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`bg-card rounded-2xl border border-border/50 shadow-premium-sm ${className}`}>
      {children}
    </div>
  );
}

export default function Profile() {
  const { user, isLoading: authLoading, logout } = useAuth();
  const { data: subscription } = useSubscription();
  const [, navigate] = useLocation();
  const queryClient = useQueryClient();
  const [editingName, setEditingName] = useState(false);
  const [nameValue, setNameValue] = useState("");
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (authLoading) {
    return (
      <div className="md:ml-[264px] flex items-center justify-center min-h-screen">
        <div className="animate-pulse text-muted-foreground">Loading...</div>
      </div>
    );
  }

  if (!user) {
    navigate("/login");
    return null;
  }

  const displayName = `${user.firstName || ""} ${user.lastName || ""}`.trim() || "User";
  const userEmail = user.email || "";
  const userPlan = subscription?.status === "active" ? subscription.plan : "free";
  const profileNeedsName = !`${user.firstName || ""} ${user.lastName || ""}`.trim();
  const profileNeedsPhoto = !user.profileImageUrl;
  const profileNeedsCompletion = profileNeedsName || profileNeedsPhoto;

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast({ title: "Invalid file type", description: "Please choose an image file.", variant: "destructive" });
      return;
    }
    if (file.size > PROFILE_IMAGE_MAX_BYTES) {
      toast({ title: "Photo too large", description: "Please choose an image under 5MB", variant: "destructive" });
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
          const updatedUser = payload;
          queryClient.setQueryData(["/api/auth/user"], updatedUser);
          haptic("success");
          toast({ title: "Photo updated" });
        } else {
          toast({
            title: "Could not update photo",
            description: payload?.error || "Please try a smaller image",
            variant: "destructive",
          });
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

  return (
    <div className="md:ml-[264px] min-h-screen bg-background pb-24 md:pb-8">
      <div className="mobile-topbar md:hidden sticky top-0 z-40 h-14 flex items-center px-4">
        <Link href="/dashboard">
          <button className="flex items-center gap-1 text-muted-foreground hover:text-foreground transition-colors" data-testid="button-back-dashboard-profile">
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
          data-testid="heading-profile-page"
        >
          Profile
        </motion.h1>

        {profileNeedsCompletion && (
          <SectionCard className="border-primary/20 bg-primary/5">
            <div className="p-5">
              <p className="text-sm font-semibold text-foreground">Make your child&apos;s fund feel personal</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Add your {profileNeedsName && profileNeedsPhoto ? "name and photo" : profileNeedsName ? "name" : "photo"} so the Memory Book shows who started this story.
              </p>
              <div className="mt-3 flex flex-wrap gap-2 text-xs text-muted-foreground">
                {profileNeedsName && <span className="rounded-full bg-background px-3 py-1 border border-border/50">Add your name</span>}
                {profileNeedsPhoto && <span className="rounded-full bg-background px-3 py-1 border border-border/50">Add a profile photo</span>}
              </div>
            </div>
          </SectionCard>
        )}

        <SectionCard>
          <div className="p-5 space-y-4">
            <div className="flex items-center gap-3 mb-2">
              <User size={18} className="text-muted-foreground" />
              <h2 className="font-heading text-lg font-semibold text-foreground">Personal Info</h2>
            </div>

            <div className="flex items-center gap-4">
              <div className="relative">
                <button
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploadingPhoto}
                  className="relative w-16 h-16 rounded-full overflow-hidden bg-primary/10 flex items-center justify-center group"
                  data-testid="button-change-profile-photo"
                >
                  {user.profileImageUrl ? (
                    <img src={user.profileImageUrl} alt="Profile" className="w-full h-full object-cover" />
                  ) : (
                    <span className="text-xl font-semibold text-primary">{displayName.charAt(0).toUpperCase()}</span>
                  )}
                  <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                    {uploadingPhoto ? (
                      <div className="w-4 h-4 border-2 border-white/60 border-t-white rounded-full animate-spin" />
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
                />
              </div>
              <div className="flex-1">
                <p className="text-sm font-medium text-foreground">{displayName}</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {profileNeedsPhoto ? "Add a photo so your child's Memory Book has a real parent face behind it." : "Tap photo to change."}
                </p>
              </div>
            </div>

            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground">Name</p>
                {editingName ? (
                  <div className="flex items-center gap-2 mt-1">
                    <input
                      type="text"
                      value={nameValue}
                      onChange={(e) => setNameValue(e.target.value)}
                      className="h-9 px-3 border border-border rounded-lg text-sm text-foreground bg-background focus:outline-none focus:ring-2 focus:ring-primary/20"
                      autoFocus
                      data-testid="input-profile-name"
                    />
                    <Button size="sm" onClick={handleSaveName} data-testid="button-save-profile-name">
                      Save
                    </Button>
                  </div>
                ) : (
                  <div>
                    <p className="text-sm font-medium text-foreground" data-testid="text-profile-name">{displayName}</p>
                    {profileNeedsName && (
                      <p className="mt-1 text-xs text-muted-foreground">Add your real name so your child&apos;s Memory Book doesn&apos;t show a generic placeholder.</p>
                    )}
                  </div>
                )}
              </div>
              {!editingName && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setNameValue(displayName);
                    setEditingName(true);
                    haptic("light");
                  }}
                  data-testid="button-edit-profile-name"
                >
                  Edit
                </Button>
              )}
            </div>

            <div>
              <p className="text-xs text-muted-foreground">Email</p>
              <p className="text-sm font-medium text-foreground" data-testid="text-profile-email">{userEmail}</p>
            </div>
          </div>
        </SectionCard>

        <SectionCard>
          <div className="p-5 space-y-4">
            <div className="flex items-center gap-3 mb-1">
              <Crown size={18} className="text-muted-foreground" />
              <h2 className="font-heading text-lg font-semibold text-foreground">Account</h2>
            </div>

            <div className="flex items-center justify-between p-3 rounded-xl border border-border/50">
              <div>
                <p className="text-sm font-medium text-foreground">Current plan</p>
                <p className="text-xs text-muted-foreground capitalize">{userPlan || "free"}</p>
              </div>
              <Link href="/settings">
                <Button variant="outline" size="sm" className="gap-1" data-testid="button-profile-go-settings">
                  <Settings size={14} />
                  Manage
                </Button>
              </Link>
            </div>
          </div>
        </SectionCard>

        <SectionCard className="border-red-200/50">
          <div className="p-5">
            <Button
              variant="destructive"
              className="w-full"
              onClick={() => {
                haptic("medium");
                logout();
              }}
              data-testid="button-profile-sign-out"
            >
              <LogOut size={16} />
              Sign Out
            </Button>
          </div>
        </SectionCard>
      </div>
    </div>
  );
}
