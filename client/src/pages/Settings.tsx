import { useState, useEffect } from "react";
import { Link, useLocation } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "@/hooks/use-toast";
import { Logo } from "@/components/ui/logo";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PageTransition } from "@/components/layout/PageTransition";
import { springSnappy, easeOutExpo, cardTactile } from "@/lib/animations";
import { haptic } from "@/lib/haptics";
import { 
  User, Shield, Bell, CreditCard, FileText, Search, 
  ChevronRight, Check, LogOut, HelpCircle,
  Smartphone, Mail, Eye, EyeOff, Lock, Globe, Users, Sparkles,
  MessageCircle, BookOpen, ExternalLink, Calendar, Gift,
  DollarSign, Heart, Loader2
} from "lucide-react";

type SettingsTab = "profile" | "security" | "notifications" | "billing" | "legal" | "help";

const tabs: { id: SettingsTab; label: string; icon: React.ReactNode }[] = [
  { id: "profile", label: "Profile", icon: <User size={18} /> },
  { id: "security", label: "Security", icon: <Shield size={18} /> },
  { id: "notifications", label: "Notifications", icon: <Bell size={18} /> },
  { id: "billing", label: "Plans and billing", icon: <CreditCard size={18} /> },
  { id: "legal", label: "Legal and documents", icon: <FileText size={18} /> },
  { id: "help", label: "Help", icon: <HelpCircle size={18} /> },
];

function AutoSaveInput({ 
  label, 
  value: initialValue, 
  type = "text",
  placeholder,
  disabled,
  hint
}: { 
  label: string; 
  value: string; 
  type?: string;
  placeholder?: string;
  disabled?: boolean;
  hint?: string;
}) {
  const [value, setValue] = useState(initialValue);
  const [saving, setSaving] = useState(false);

  const handleBlur = () => {
    if (value !== initialValue && !disabled) {
      setSaving(true);
      setTimeout(() => {
        setSaving(false);
        toast({ title: "Saved", variant: "saved" });
      }, 500);
    }
  };

  const handleFocus = () => {
    haptic('light');
  };

  return (
    <div className="space-y-1.5">
      <label className="text-sm font-medium text-foreground">{label}</label>
      <div className="relative">
        <input
          type={type}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onBlur={handleBlur}
          onFocus={handleFocus}
          placeholder={placeholder}
          disabled={disabled}
          className={`w-full h-12 px-4 border-2 border-border/50 rounded-xl text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/50 shadow-premium-sm transition-all duration-150 ${disabled ? 'bg-muted text-muted-foreground' : 'bg-card'}`}
        />
        {saving && (
          <div className="absolute right-4 top-1/2 -translate-y-1/2">
            <div className="w-4 h-4 border-2 border-muted border-t-primary rounded-full animate-spin" />
          </div>
        )}
      </div>
      {hint && <p className="text-xs text-muted-foreground mt-1">{hint}</p>}
    </div>
  );
}

function AutoSaveSelect({ 
  label, 
  value: initialValue, 
  options,
  hint
}: { 
  label: string; 
  value: string; 
  options: { value: string; label: string }[];
  hint?: string;
}) {
  const [value, setValue] = useState(initialValue);
  const [saving, setSaving] = useState(false);

  const handleChange = (newValue: string) => {
    haptic('selection');
    setValue(newValue);
    setSaving(true);
    setTimeout(() => {
      setSaving(false);
      toast({ title: "Saved", variant: "saved" });
    }, 500);
  };

  const selectedLabel = options.find(opt => opt.value === value)?.label;

  return (
    <div className="space-y-1.5">
      <label className="text-sm font-medium text-foreground">{label}</label>
      <Select value={value} onValueChange={handleChange}>
        <SelectTrigger className="w-full h-12 px-4 border border-border rounded-xl bg-card text-foreground focus:ring-2 focus:ring-primary/20 focus:border-primary/50 transition-all duration-150">
          <div className="flex items-center gap-2">
            {saving && <div className="w-3 h-3 border-2 border-muted border-t-primary rounded-full animate-spin" />}
            <SelectValue placeholder="Select...">{selectedLabel}</SelectValue>
          </div>
        </SelectTrigger>
        <SelectContent className="rounded-xl border border-border shadow-lg bg-card">
          {options.map(opt => (
            <SelectItem 
              key={opt.value} 
              value={opt.value}
              className="rounded-lg cursor-pointer py-3 px-4 focus:bg-primary/10 data-[highlighted]:bg-primary/10"
            >
              {opt.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {hint && <p className="text-xs text-muted-foreground mt-1">{hint}</p>}
    </div>
  );
}

function SettingsSection({ title, description, children }: { title: string; description?: string; children: React.ReactNode }) {
  return (
    <div className="bg-card rounded-2xl border border-border/50 shadow-premium-sm overflow-hidden">
      <div className="px-5 py-4 border-b border-muted/50">
        <h3 className="font-semibold text-foreground">{title}</h3>
        {description && <p className="text-sm text-muted-foreground mt-0.5 leading-relaxed">{description}</p>}
      </div>
      <div className="p-5 space-y-4">
        {children}
      </div>
    </div>
  );
}

function ToggleRow({ label, description, defaultChecked, onChange }: { label: string; description?: string; defaultChecked?: boolean; onChange?: (checked: boolean) => void }) {
  const [checked, setChecked] = useState(defaultChecked ?? false);
  
  const handleChange = (value: boolean) => {
    setChecked(value);
    onChange?.(value);
    toast({ title: "Saved", variant: "saved" });
  };

  return (
    <div className="flex items-start justify-between gap-4 py-3">
      <div>
        <p className="text-sm font-medium text-foreground">{label}</p>
        {description && <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">{description}</p>}
      </div>
      <Switch checked={checked} onCheckedChange={handleChange} />
    </div>
  );
}

function LinkRow({ label, description, href, onClick }: { label: string; description?: string; href?: string; onClick?: () => void }) {
  const handleTap = () => {
    haptic('selection');
    onClick?.();
  };
  
  const content = (
    <div className="flex items-center justify-between py-3 cursor-pointer hover:bg-muted/50 -mx-2 px-2 rounded-xl transition-all duration-150 active:scale-[0.99]">
      <div>
        <p className="text-sm font-medium text-foreground">{label}</p>
        {description && <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">{description}</p>}
      </div>
      <ChevronRight size={16} className="text-muted-foreground" />
    </div>
  );

  if (href) {
    return <Link href={href} onClick={handleTap}>{content}</Link>;
  }
  return <div onClick={handleTap}>{content}</div>;
}

function ProfileTab() {
  return (
    <div className="space-y-6">
      <SettingsSection title="Personal information" description="Your account details">
        <AutoSaveInput label="Name" value="Sarah Miller" />
        <AutoSaveInput label="Email" value="sarah@example.com" type="email" disabled hint="Contact support to change your email" />
        <AutoSaveInput label="Phone" value="" placeholder="+1 (555) 000-0000" hint="Optional. For SMS receipts and security alerts" />
      </SettingsSection>

      <SettingsSection title="Preferences">
        <AutoSaveSelect 
          label="Timezone" 
          value="eastern" 
          options={[
            { value: "eastern", label: "America/New_York (Eastern)" },
            { value: "central", label: "America/Chicago (Central)" },
            { value: "mountain", label: "America/Denver (Mountain)" },
            { value: "pacific", label: "America/Los_Angeles (Pacific)" },
          ]}
        />
        <AutoSaveSelect 
          label="Language" 
          value="en" 
          options={[
            { value: "en", label: "English" },
            { value: "es", label: "Spanish" },
          ]}
        />
      </SettingsSection>

      <SettingsSection title="Household">
        <div className="flex items-center justify-between py-2">
          <div>
            <p className="text-sm font-medium text-foreground">Your role</p>
            <p className="text-xs text-muted-foreground mt-0.5">Based on your account setup</p>
          </div>
          <div className="flex items-center gap-2">
            <Users size={14} className="text-muted-foreground" />
            <span className="text-sm font-medium text-foreground">Parent / Guardian</span>
          </div>
        </div>
        <div className="flex items-center justify-between py-2 border-t border-muted">
          <div>
            <p className="text-sm font-medium text-foreground">Children</p>
            <p className="text-xs text-muted-foreground mt-0.5">Mila (fund active)</p>
          </div>
          <Link href="/dashboard">
            <button className="text-sm text-muted-foreground hover:text-foreground font-medium">Manage</button>
          </Link>
        </div>
      </SettingsSection>

      <SettingsSection title="Account">
        <LinkRow 
          label="Close account" 
          description="Contact support to close your account"
          onClick={() => toast({ title: "Contact support", description: "Email support@kora.com to close your account" })}
        />
      </SettingsSection>
    </div>
  );
}

function SecurityTab() {
  return (
    <div className="space-y-6">
      <SettingsSection title="Password">
        <AutoSaveInput label="Current password" value="" type="password" placeholder="Enter current password" />
        <AutoSaveInput label="New password" value="" type="password" placeholder="Enter new password" hint="At least 8 characters" />
        <button 
          onClick={() => toast({ title: "Password updated", description: "Your password has been changed successfully" })}
          className="px-4 py-2 bg-primary text-primary-foreground text-sm font-medium rounded-lg hover:bg-primary/90 transition-colors"
        >
          Update password
        </button>
      </SettingsSection>

      <SettingsSection title="Two-factor authentication" description="Add an extra layer of security">
        <ToggleRow label="SMS verification" description="Receive codes via text message" defaultChecked={false} />
        <ToggleRow label="Authenticator app" description="Use Google Authenticator or similar" defaultChecked={false} />
      </SettingsSection>

      <SettingsSection title="Active sessions">
        <div className="flex items-center justify-between py-2">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-muted flex items-center justify-center">
              <Globe size={16} className="text-muted-foreground" />
            </div>
            <div>
              <p className="text-sm font-medium text-foreground">Chrome on MacOS</p>
              <p className="text-xs text-muted-foreground">San Francisco, CA · Active now</p>
            </div>
          </div>
          <span className="text-xs text-success bg-success/10 px-2 py-1 rounded">Current</span>
        </div>
      </SettingsSection>

      <SettingsSection title="Privacy defaults" description="Control who can see your information">
        <ToggleRow label="Pages are unlisted by default" description="Only people with the link can view" defaultChecked={true} />
        <ToggleRow label="Allow search by name" description="Let others find you by searching" defaultChecked={false} />
        <ToggleRow label="Require passcode for event pages" description="Add extra protection to event pages" defaultChecked={false} />
      </SettingsSection>

      <SettingsSection title="Data visibility" description="Control what contributors and guests can see">
        <AutoSaveSelect 
          label="Who can see contributor names" 
          value="host" 
          options={[
            { value: "host", label: "Host only" },
            { value: "contributors", label: "Contributors" },
            { value: "public", label: "Public" },
          ]}
        />
        <AutoSaveSelect 
          label="Who can see gift amounts" 
          value="host" 
          options={[
            { value: "host", label: "Host only" },
            { value: "contributors", label: "Contributors" },
            { value: "public", label: "Public" },
          ]}
        />
      </SettingsSection>

      <div className="p-4 bg-muted rounded-xl border border-border">
        <div className="flex items-start gap-3">
          <Shield size={18} className="text-muted-foreground mt-0.5" />
          <div>
            <p className="text-sm font-medium text-foreground">Brokerage custody & SIPC protection</p>
            <p className="text-xs text-muted-foreground mt-1">Your investments are held by Alpaca Securities LLC, member FINRA/SIPC. Assets are protected up to $500,000.</p>
            <button className="text-xs text-muted-foreground underline mt-2 hover:no-underline">Learn more</button>
          </div>
        </div>
      </div>
    </div>
  );
}

function NotificationsTab() {
  const notificationTypes = [
    { id: "gift_received", label: "Gift received", category: "money" },
    { id: "gift_pending", label: "Gift pending / failed", category: "money" },
    { id: "recurring_upcoming", label: "Recurring gift upcoming", category: "money" },
    { id: "transfer_initiated", label: "Transfer initiated", category: "money" },
    { id: "security_alert", label: "Security alerts", category: "security" },
    { id: "event_reminder", label: "Event reminders", category: "events" },
    { id: "goal_reached", label: "Goal reached", category: "events" },
    { id: "thank_you_nudge", label: "Time to send thank-yous", category: "gratitude" },
    { id: "thank_you_sent", label: "Thank-you sent confirmation", category: "gratitude" },
  ];

  const [preferences, setPreferences] = useState<Record<string, { email: boolean; sms: boolean }>>(() => {
    const defaults: Record<string, { email: boolean; sms: boolean }> = {};
    notificationTypes.forEach(n => {
      defaults[n.id] = { 
        email: true, 
        sms: n.category === "security" 
      };
    });
    return defaults;
  });

  const toggle = (id: string, channel: "email" | "sms") => {
    setPreferences(prev => ({
      ...prev,
      [id]: { ...prev[id], [channel]: !prev[id][channel] }
    }));
    toast({ title: "Saved", variant: "saved" });
  };

  const categories = [
    { id: "money", label: "Money movement" },
    { id: "security", label: "Security" },
    { id: "events", label: "Events" },
    { id: "gratitude", label: "Gratitude" },
  ];

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-xl border border-border overflow-hidden">
        <div className="px-5 py-4 border-b border-muted">
          <h3 className="font-medium text-foreground">Notification preferences</h3>
          <p className="text-sm text-muted-foreground mt-0.5">Choose how you want to be notified</p>
        </div>
        
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-muted">
                <th className="text-left text-xs font-medium text-muted-foreground uppercase tracking-wider px-5 py-3">Type</th>
                <th className="text-center text-xs font-medium text-muted-foreground uppercase tracking-wider px-3 py-3 w-20">
                  <div className="flex items-center justify-center gap-1">
                    <Mail size={14} />
                    <span>Email</span>
                  </div>
                </th>
                <th className="text-center text-xs font-medium text-muted-foreground uppercase tracking-wider px-3 py-3 w-20">
                  <div className="flex items-center justify-center gap-1">
                    <Smartphone size={14} />
                    <span>SMS</span>
                  </div>
                </th>
              </tr>
            </thead>
            <tbody>
              {categories.map(category => (
                <>
                  <tr key={category.id} className="bg-muted">
                    <td colSpan={3} className="px-5 py-2 text-xs font-medium text-muted-foreground uppercase tracking-wider">
                      {category.label}
                    </td>
                  </tr>
                  {notificationTypes.filter(n => n.category === category.id).map(notification => (
                    <tr key={notification.id} className="border-b border-muted hover:bg-muted/50 transition-colors">
                      <td className="px-5 py-3 text-sm text-foreground">{notification.label}</td>
                      <td className="px-3 py-3 text-center">
                        <button
                          onClick={() => toggle(notification.id, "email")}
                          className={`w-6 h-6 rounded-md flex items-center justify-center transition-colors ${preferences[notification.id]?.email ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground hover:bg-border'}`}
                        >
                          {preferences[notification.id]?.email && <Check size={14} />}
                        </button>
                      </td>
                      <td className="px-3 py-3 text-center">
                        <button
                          onClick={() => toggle(notification.id, "sms")}
                          className={`w-6 h-6 rounded-md flex items-center justify-center transition-colors ${preferences[notification.id]?.sms ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground hover:bg-border'}`}
                        >
                          {preferences[notification.id]?.sms && <Check size={14} />}
                        </button>
                      </td>
                    </tr>
                  ))}
                </>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <SettingsSection title="Education" description="Optional learning content">
        <ToggleRow label="Weekly money lessons" description="Short investing concepts for kid view" defaultChecked={false} />
        <ToggleRow label="Monthly recap" description="Summary of fund activity and growth" defaultChecked={true} />
      </SettingsSection>
    </div>
  );
}

function BillingTab() {
  const [whoPays, setWhoPays] = useState<"guests" | "host">("guests");
  const [goalBehavior, setGoalBehavior] = useState("continue");
  const [isLoadingFamily, setIsLoadingFamily] = useState(false);

  const giverPays = whoPays === "guests";

  const handleFamilyPlanCheckout = async () => {
    setIsLoadingFamily(true);
    haptic('medium');
    try {
      const response = await fetch('/api/stripe/checkout/family-plan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      const data = await response.json();
      if (data.url) {
        window.location.href = data.url;
      } else {
        toast({ title: "Error", description: data.error || "Failed to start checkout", variant: "destructive" });
      }
    } catch (error) {
      toast({ title: "Error", description: "Failed to connect to payment service", variant: "destructive" });
    } finally {
      setIsLoadingFamily(false);
    }
  };

  return (
    <div className="space-y-8">
      {/* Who pays toggle with integrated breakdown */}
      <div>
        <div className="mb-4">
          <h3 className="font-semibold text-foreground text-lg">Who covers the platform fee?</h3>
          <p className="text-sm text-muted-foreground">This applies to all gifts you receive</p>
        </div>
        
        <div className="grid grid-cols-2 gap-3 mb-5">
          <motion.button
            whileTap={{ scale: 0.98 }}
            onClick={() => { setWhoPays("guests"); haptic('selection'); toast({ title: "Saved", variant: "saved" }); }}
            className={`relative p-4 rounded-2xl border-2 text-left transition-all overflow-hidden ${
              whoPays === "guests" 
                ? "border-primary bg-primary/5" 
                : "border-border hover:border-primary/30 bg-card"
            }`}
          >
            {whoPays === "guests" && (
              <motion.div 
                layoutId="who-pays-indicator"
                className="absolute top-3 right-3 w-5 h-5 rounded-full bg-primary flex items-center justify-center"
              >
                <Check size={12} className="text-primary-foreground" />
              </motion.div>
            )}
            <p className="font-semibold text-foreground mb-1">They cover it</p>
            <p className="text-xs text-muted-foreground">Most common choice</p>
          </motion.button>
          
          <motion.button
            whileTap={{ scale: 0.98 }}
            onClick={() => { setWhoPays("host"); haptic('selection'); toast({ title: "Saved", variant: "saved" }); }}
            className={`relative p-4 rounded-2xl border-2 text-left transition-all overflow-hidden ${
              whoPays === "host" 
                ? "border-primary bg-primary/5" 
                : "border-border hover:border-primary/30 bg-card"
            }`}
          >
            {whoPays === "host" && (
              <motion.div 
                layoutId="who-pays-indicator"
                className="absolute top-3 right-3 w-5 h-5 rounded-full bg-primary flex items-center justify-center"
              >
                <Check size={12} className="text-primary-foreground" />
              </motion.div>
            )}
            <p className="font-semibold text-foreground mb-1">I'll cover it</p>
            <p className="text-xs text-muted-foreground">Lower cost for givers</p>
          </motion.button>
        </div>

        {/* Dynamic breakdown based on selection */}
        <motion.div 
          key={whoPays}
          initial={{ opacity: 0, y: 5 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-muted/50 rounded-2xl p-4 border border-border"
        >
          <p className="text-xs text-muted-foreground mb-3">Example: $100 gift by card</p>
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Gift giver pays</span>
              <span className="text-sm font-semibold text-foreground">
                {giverPays ? "$104.70" : "$103.20"}
              </span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Card processing</span>
              <span className="text-muted-foreground">-$3.20</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Kora fee</span>
              <span className="text-muted-foreground">
                {giverPays ? "-$1.50" : "You pay $1.50"}
              </span>
            </div>
            <div className="pt-3 border-t border-border flex items-center justify-between">
              <span className="font-medium text-foreground">Fund receives</span>
              <span className="text-lg font-bold text-primary">
                {giverPays ? "$100.00" : "$98.50"}
              </span>
            </div>
          </div>
        </motion.div>
      </div>

      {/* Upgrade plans - premium cards */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-semibold text-foreground">Waive the Kora fee</h3>
        </div>
        
        <div className="space-y-3">
          {/* Family Plan - Premium */}
          <motion.div 
            whileTap={{ scale: 0.98 }}
            onClick={handleFamilyPlanCheckout}
            className={`relative p-5 rounded-2xl bg-gradient-to-br from-[hsl(var(--kora-gold))]/20 via-[hsl(var(--kora-gold))]/10 to-transparent border border-[hsl(var(--kora-gold))]/30 cursor-pointer group overflow-hidden ${isLoadingFamily ? 'opacity-70 pointer-events-none' : ''}`}
          >
            <div className="absolute top-0 right-0 px-3 py-1 bg-[hsl(var(--kora-gold))] text-[10px] font-bold uppercase tracking-wider rounded-bl-lg text-background">
              Best Value
            </div>
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-2xl bg-[hsl(var(--kora-gold))]/20 flex items-center justify-center flex-shrink-0">
                <Sparkles size={24} className="text-[hsl(var(--kora-gold))]" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-baseline gap-2 mb-1">
                  <span className="text-xl font-bold text-foreground">$199</span>
                  <span className="text-sm text-muted-foreground">/year</span>
                </div>
                <p className="font-semibold text-foreground mb-1">Family Plan</p>
                <p className="text-sm text-muted-foreground">
                  {giverPays 
                    ? "Gift givers only pay card processing. No Kora fee on gifts up to $15k/year."
                    : "We cover the Kora fee for you. No more $1.50 per gift up to $15k/year."}
                </p>
                <div className="flex items-center gap-4 mt-3 text-xs">
                  <span className="flex items-center gap-1 text-[hsl(var(--kora-gold))]">
                    <Check size={12} /> All children
                  </span>
                  <span className="flex items-center gap-1 text-[hsl(var(--kora-gold))]">
                    <Check size={12} /> All events
                  </span>
                </div>
              </div>
              {isLoadingFamily ? (
                <Loader2 size={20} className="animate-spin text-[hsl(var(--kora-gold))] flex-shrink-0 mt-1" />
              ) : (
                <ChevronRight size={20} className="text-muted-foreground group-hover:text-foreground transition-colors flex-shrink-0 mt-1" />
              )}
            </div>
          </motion.div>

          {/* Event Pass */}
          <Link href="/event/create">
            <motion.div 
              whileTap={{ scale: 0.98 }}
              className="p-5 rounded-2xl border border-border bg-card cursor-pointer group hover:border-primary/30 transition-colors"
            >
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 rounded-2xl bg-muted flex items-center justify-center flex-shrink-0">
                  <Calendar size={24} className="text-muted-foreground" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-baseline gap-2 mb-1">
                    <span className="text-xl font-bold text-foreground">$99</span>
                    <span className="text-sm text-muted-foreground">one-time</span>
                  </div>
                  <p className="font-semibold text-foreground mb-1">Event Pass</p>
                  <p className="text-sm text-muted-foreground">
                    {giverPays
                      ? "No Kora fee for one event, up to $7.5k in gifts."
                      : "We cover the Kora fee for one event, up to $7.5k in gifts."}
                  </p>
                </div>
                <ChevronRight size={20} className="text-muted-foreground group-hover:text-foreground transition-colors flex-shrink-0 mt-1" />
              </div>
            </motion.div>
          </Link>
        </div>
      </div>

      {/* Event Settings - Cleaner */}
      <SettingsSection title="Event defaults">
        <div className="space-y-1.5">
          <label className="text-sm text-muted-foreground">When a goal is reached</label>
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => { setGoalBehavior("continue"); haptic('selection'); toast({ title: "Saved", variant: "saved" }); }}
              className={`p-3 rounded-xl border-2 text-center transition-all ${
                goalBehavior === "continue" 
                  ? "border-primary bg-primary/5" 
                  : "border-border hover:border-primary/30"
              }`}
            >
              <p className="text-sm font-medium text-foreground">Keep accepting</p>
            </button>
            <button
              onClick={() => { setGoalBehavior("stop"); haptic('selection'); toast({ title: "Saved", variant: "saved" }); }}
              className={`p-3 rounded-xl border-2 text-center transition-all ${
                goalBehavior === "stop" 
                  ? "border-primary bg-primary/5" 
                  : "border-border hover:border-primary/30"
              }`}
            >
              <p className="text-sm font-medium text-foreground">Stop at goal</p>
            </button>
          </div>
        </div>
      </SettingsSection>

      {/* Payment Method - Cleaner */}
      <SettingsSection title="Payment method">
        <motion.div 
          whileTap={{ scale: 0.98 }}
          className="flex items-center justify-between p-4 rounded-xl bg-muted/50 cursor-pointer"
          onClick={() => toast({ title: "Update card", description: "Contact support to update" })}
        >
          <div className="flex items-center gap-3">
            <div className="w-12 h-8 rounded-lg bg-gradient-to-br from-blue-500 to-blue-700 flex items-center justify-center text-white text-[9px] font-bold shadow-md">
              VISA
            </div>
            <div>
              <p className="text-sm font-medium text-foreground">•••• 4242</p>
              <p className="text-xs text-muted-foreground">Expires 12/26</p>
            </div>
          </div>
          <ChevronRight size={16} className="text-muted-foreground" />
        </motion.div>
      </SettingsSection>

      {/* Billing history */}
      <SettingsSection title="Billing history">
        <div className="py-6 text-center">
          <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center mx-auto mb-3">
            <FileText size={20} className="text-muted-foreground" />
          </div>
          <p className="text-sm text-muted-foreground">No charges yet</p>
          <p className="text-xs text-muted-foreground/70">Your billing history will appear here</p>
        </div>
      </SettingsSection>
    </div>
  );
}

function LegalTab() {
  const documents = [
    { type: "statement", title: "Q4 2025 Statement", date: "Jan 2026", fund: "Mila's Fund" },
    { type: "statement", title: "Q3 2025 Statement", date: "Oct 2025", fund: "Mila's Fund" },
    { type: "tax", title: "2024 Tax Summary (1099)", date: "Feb 2025", fund: "All Funds" },
    { type: "confirmation", title: "Gift Confirmation #4827", date: "Dec 2025", fund: "Mila's Fund" },
  ];

  return (
    <div className="space-y-6">
      <SettingsSection title="Statements & Tax Documents" description="Provided by Alpaca Securities">
        <div className="space-y-2">
          {documents.filter(d => d.type === "statement" || d.type === "tax").map((doc, i) => (
            <div key={i} className="flex items-center justify-between py-3 border-b border-muted last:border-0">
              <div>
                <p className="text-sm font-medium text-foreground">{doc.title}</p>
                <p className="text-xs text-muted-foreground">{doc.date} · {doc.fund}</p>
              </div>
              <button 
                onClick={() => toast({ title: "Download started", description: "Your document is being prepared" })}
                className="text-sm text-muted-foreground hover:text-foreground font-medium"
              >Download</button>
            </div>
          ))}
        </div>
      </SettingsSection>

      <SettingsSection title="Gift Confirmations" description="Receipts for gifts received">
        <div className="space-y-2">
          {documents.filter(d => d.type === "confirmation").map((doc, i) => (
            <div key={i} className="flex items-center justify-between py-3 border-b border-muted last:border-0">
              <div>
                <p className="text-sm font-medium text-foreground">{doc.title}</p>
                <p className="text-xs text-muted-foreground">{doc.date} · {doc.fund}</p>
              </div>
              <button 
                onClick={() => toast({ title: "Download started", description: "Your document is being prepared" })}
                className="text-sm text-muted-foreground hover:text-foreground font-medium"
              >Download</button>
            </div>
          ))}
        </div>
      </SettingsSection>

      <SettingsSection title="Agreements & Disclosures">
        <LinkRow label="Customer Agreement" description="Alpaca Securities LLC" />
        <LinkRow label="Privacy Policy" description="Kora, Inc." />
        <LinkRow label="Terms of Service" description="Kora, Inc." />
        <LinkRow label="UTMA Custodial Agreement" description="If applicable" />
      </SettingsSection>
    </div>
  );
}

function HelpTab() {
  return (
    <div className="space-y-6">
      <SettingsSection title="Get help" description="We're here to help you succeed">
        <div className="space-y-3">
          <div 
            onClick={() => window.open('mailto:support@kora.com')}
            className="flex items-center gap-4 p-4 bg-muted rounded-lg border border-border cursor-pointer hover:bg-muted/80 transition-colors"
          >
            <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
              <MessageCircle size={20} className="text-primary" />
            </div>
            <div className="flex-1">
              <p className="text-sm font-medium text-foreground">Contact Support</p>
              <p className="text-xs text-muted-foreground">Email support@kora.com</p>
            </div>
            <ExternalLink size={16} className="text-muted-foreground" />
          </div>
          
          <div 
            onClick={() => toast({ title: "Help Center", description: "Opening help center..." })}
            className="flex items-center gap-4 p-4 bg-muted rounded-lg border border-border cursor-pointer hover:bg-muted/80 transition-colors"
          >
            <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
              <BookOpen size={20} className="text-primary" />
            </div>
            <div className="flex-1">
              <p className="text-sm font-medium text-foreground">Help Center</p>
              <p className="text-xs text-muted-foreground">FAQs, guides, and tutorials</p>
            </div>
            <ChevronRight size={16} className="text-muted-foreground" />
          </div>
        </div>
      </SettingsSection>

      <SettingsSection title="Common questions">
        <div className="space-y-4">
          <div>
            <p className="text-sm font-medium text-foreground">How do I add a child to my account?</p>
            <p className="text-xs text-muted-foreground mt-1">Go to your Dashboard and click "Add child" to create a new fund for another child in your household.</p>
          </div>
          <div className="border-t border-muted pt-4">
            <p className="text-sm font-medium text-foreground">How do I withdraw funds?</p>
            <p className="text-xs text-muted-foreground mt-1">Navigate to the child's fund page and click "Withdraw". Funds are transferred to your linked bank account within 3-5 business days.</p>
          </div>
          <div className="border-t border-muted pt-4">
            <p className="text-sm font-medium text-foreground">What happens when my child turns 18?</p>
            <p className="text-xs text-muted-foreground mt-1">The UTMA account transfers to your child's control. They'll receive instructions to set up their own brokerage account.</p>
          </div>
          <div className="border-t border-muted pt-4">
            <p className="text-sm font-medium text-foreground">Are my investments safe?</p>
            <p className="text-xs text-muted-foreground mt-1">Yes. Investments are held by Alpaca Securities LLC, member FINRA/SIPC. Assets are protected up to $500,000.</p>
          </div>
        </div>
      </SettingsSection>

      <SettingsSection title="About Kora">
        <div className="space-y-2">
          <div className="flex items-center justify-between py-2">
            <p className="text-sm text-muted-foreground">Version</p>
            <p className="text-sm font-medium text-foreground">1.0.0</p>
          </div>
          <div className="flex items-center justify-between py-2 border-t border-muted">
            <p className="text-sm text-muted-foreground">Brokerage partner</p>
            <p className="text-sm font-medium text-foreground">Alpaca Securities LLC</p>
          </div>
        </div>
      </SettingsSection>
    </div>
  );
}

export default function Settings() {
  const [location] = useLocation();
  const [activeTab, setActiveTab] = useState<SettingsTab>(() => {
    const params = new URLSearchParams(window.location.search);
    const tab = params.get("tab") as SettingsTab;
    return tabs.find(t => t.id === tab) ? tab : "profile";
  });
  
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const tab = params.get("tab") as SettingsTab;
    if (tab && tabs.find(t => t.id === tab)) {
      setActiveTab(tab);
    }
  }, [location]);

  const renderTabContent = () => {
    switch (activeTab) {
      case "profile": return <ProfileTab />;
      case "security": return <SecurityTab />;
      case "notifications": return <NotificationsTab />;
      case "billing": return <BillingTab />;
      case "legal": return <LegalTab />;
      case "help": return <HelpTab />;
    }
  };

  return (
    <PageTransition>
      <div className="min-h-screen bg-background pb-28">
        <motion.header 
          className="sticky top-0 z-50 bg-background/95 backdrop-blur-xl border-b border-border/50"
          initial={{ y: -20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ duration: 0.2, ease: easeOutExpo }}
        >
          <div className="max-w-lg mx-auto px-4 h-14 flex items-center">
            <Logo size="sm" className="text-primary" />
          </div>
        </motion.header>

        <main className="max-w-lg mx-auto px-4 py-6">
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.2 }}
            className="mb-6"
          >
            <h1 className="text-2xl font-bold text-foreground mb-1">Settings</h1>
            <p className="text-sm text-muted-foreground">Manage your account and preferences</p>
          </motion.div>

          <div className="overflow-x-auto -mx-4 px-4 mb-6">
            <div className="flex gap-2 min-w-max pb-2">
              {tabs.map((tab, index) => (
                <motion.button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  data-testid={`settings-tab-${tab.id}`}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.03, duration: 0.2 }}
                  whileTap={{ scale: 0.95 }}
                  className={`flex items-center gap-2 px-4 py-2.5 rounded-full text-sm font-medium whitespace-nowrap transition-all ${
                    activeTab === tab.id
                      ? "bg-primary text-primary-foreground shadow-md"
                      : "bg-muted text-muted-foreground"
                  }`}
                >
                  {tab.icon}
                  <span className="hidden sm:inline">{tab.label}</span>
                </motion.button>
              ))}
            </div>
          </div>

          <AnimatePresence mode="wait">
            <motion.div
              key={activeTab}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
            >
              {renderTabContent()}
            </motion.div>
          </AnimatePresence>

          <div className="mt-10 pt-6 border-t border-border">
            <Link href="/login">
              <motion.button
                whileTap={{ scale: 0.98 }}
                className="w-full p-4 rounded-xl bg-muted text-muted-foreground flex items-center justify-center gap-3 font-medium"
              >
                <LogOut size={18} />
                Sign out
              </motion.button>
            </Link>
          </div>

          <div className="mt-8 text-center text-xs text-muted-foreground space-y-1">
            <p>Brokerage by Alpaca Securities LLC · Member FINRA/SIPC</p>
            <p className="flex items-center justify-center gap-1.5">
              <Lock size={10} />
              256-bit encryption
            </p>
          </div>
        </main>
      </div>
    </PageTransition>
  );
}
