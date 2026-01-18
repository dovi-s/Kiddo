import { useState } from "react";
import { Link } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "@/hooks/use-toast";
import { Logo } from "@/components/ui/logo";
import { Switch } from "@/components/ui/switch";
import { PageTransition } from "@/components/layout/PageTransition";
import { springSnappy, easeOutExpo, cardTactile } from "@/lib/animations";
import { 
  User, Shield, Bell, CreditCard, FileText, Search, 
  ChevronRight, Check, LogOut, HelpCircle, ArrowLeft,
  Smartphone, Mail, Eye, EyeOff, Lock, Globe, Users, Sparkles,
  MessageCircle, BookOpen, ExternalLink
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
        toast({ title: "Saved" });
      }, 500);
    }
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
          placeholder={placeholder}
          disabled={disabled}
          className={`w-full px-3 py-2.5 border border-border rounded-lg text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/10 focus:border-muted transition-all ${disabled ? 'bg-muted text-muted-foreground' : 'bg-white'}`}
        />
        {saving && (
          <div className="absolute right-3 top-1/2 -translate-y-1/2">
            <div className="w-4 h-4 border-2 border-muted border-t-muted-foreground rounded-full animate-spin" />
          </div>
        )}
      </div>
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
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
    setValue(newValue);
    setSaving(true);
    setTimeout(() => {
      setSaving(false);
      toast({ title: "Saved" });
    }, 500);
  };

  return (
    <div className="space-y-1.5">
      <label className="text-sm font-medium text-foreground">{label}</label>
      <div className="relative">
        <select 
          value={value}
          onChange={(e) => handleChange(e.target.value)}
          className="w-full px-3 py-2.5 border border-border rounded-lg text-foreground bg-white focus:outline-none focus:ring-2 focus:ring-primary/10 appearance-none pr-10"
        >
          {options.map(opt => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </select>
        <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none">
          {saving ? (
            <div className="w-4 h-4 border-2 border-muted border-t-muted-foreground rounded-full animate-spin" />
          ) : (
            <ChevronRight size={16} className="text-muted-foreground rotate-90" />
          )}
        </div>
      </div>
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

function SettingsSection({ title, description, children }: { title: string; description?: string; children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-xl border border-border overflow-hidden">
      <div className="px-5 py-4 border-b border-muted">
        <h3 className="font-medium text-foreground">{title}</h3>
        {description && <p className="text-sm text-muted-foreground mt-0.5">{description}</p>}
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
    toast({ title: "Saved" });
  };

  return (
    <div className="flex items-start justify-between gap-4 py-2">
      <div>
        <p className="text-sm font-medium text-foreground">{label}</p>
        {description && <p className="text-xs text-muted-foreground mt-0.5">{description}</p>}
      </div>
      <Switch checked={checked} onCheckedChange={handleChange} />
    </div>
  );
}

function LinkRow({ label, description, href, onClick }: { label: string; description?: string; href?: string; onClick?: () => void }) {
  const content = (
    <div className="flex items-center justify-between py-2 cursor-pointer hover:bg-muted -mx-2 px-2 rounded-lg transition-colors">
      <div>
        <p className="text-sm font-medium text-foreground">{label}</p>
        {description && <p className="text-xs text-muted-foreground mt-0.5">{description}</p>}
      </div>
      <ChevronRight size={16} className="text-muted-foreground" />
    </div>
  );

  if (href) {
    return <Link href={href}>{content}</Link>;
  }
  return <div onClick={onClick}>{content}</div>;
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
    toast({ title: "Saved" });
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
  return (
    <div className="space-y-6">
      <SettingsSection title="Membership" description="Your household's account status">
        <div className="p-5 bg-white rounded-xl border border-border">
          <div className="flex items-center justify-between mb-4">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <p className="text-lg font-semibold text-foreground">Free</p>
                <span className="text-xs font-medium text-muted-foreground bg-muted px-2 py-0.5 rounded-full">Current</span>
              </div>
              <p className="text-sm text-muted-foreground">Guests pay all fees at checkout</p>
            </div>
          </div>
          
          <div className="p-4 rounded-lg bg-gradient-to-br from-primary to-primary/80 text-primary-foreground">
            <div className="flex items-start justify-between mb-3">
              <div>
                <p className="font-semibold mb-0.5">Upgrade to Family</p>
                <p className="text-sm text-primary-foreground/70">$199/year</p>
              </div>
              <Sparkles size={20} className="text-[hsl(var(--kora-gold))]" />
            </div>
            <ul className="text-sm text-primary-foreground/80 space-y-1.5 mb-4">
              <li className="flex items-center gap-2">
                <Check size={14} className="text-[hsl(var(--kora-evergreen-light))]" />
                Platform fees waived up to $15,000/year
              </li>
              <li className="flex items-center gap-2">
                <Check size={14} className="text-[hsl(var(--kora-evergreen-light))]" />
                Household dashboard for all your kids
              </li>
              <li className="flex items-center gap-2">
                <Check size={14} className="text-[hsl(var(--kora-evergreen-light))]" />
                Recurring gift management
              </li>
              <li className="flex items-center gap-2">
                <Check size={14} className="text-[hsl(var(--kora-evergreen-light))]" />
                Priority support
              </li>
            </ul>
            <button 
              onClick={() => toast({ title: "Upgrade to Family", description: "Family plan coming soon" })}
              className="w-full py-2.5 bg-white text-foreground font-medium rounded-lg hover:bg-muted transition-colors text-sm"
            >
              Upgrade to Family
            </button>
          </div>
        </div>
      </SettingsSection>

      <SettingsSection title="Event Passes" description="One-time upgrades for individual events">
        <div className="p-4 bg-muted rounded-lg border border-border">
          <p className="text-sm text-muted-foreground mb-3">
            Event Passes ($99 each) unlock premium features and waive platform fees for a single event. 
            Purchase when creating or editing an event.
          </p>
          <div className="text-xs text-muted-foreground">
            No Event Passes purchased yet.
          </div>
        </div>
      </SettingsSection>

      <SettingsSection title="How fees work" description="Two components shown at checkout">
        <div className="space-y-3">
          <div className="p-3 rounded-lg bg-muted border border-border">
            <div className="flex items-center justify-between mb-1">
              <p className="text-sm font-medium text-foreground">Processing (pass-through)</p>
              <p className="text-sm text-muted-foreground">~2.9% + $0.30</p>
            </div>
            <p className="text-xs text-muted-foreground">Card network fees. Lower for ACH (~$0.75).</p>
          </div>
          <div className="p-3 rounded-lg bg-muted border border-border">
            <div className="flex items-center justify-between mb-1">
              <p className="text-sm font-medium text-foreground">Kora platform fee</p>
              <p className="text-sm text-muted-foreground">1.5% ($1–$10)</p>
            </div>
            <p className="text-xs text-muted-foreground">Covers brokerage, KYC, support, and thank-you automation. 1.0% for ACH.</p>
          </div>
        </div>
        <p className="text-xs text-muted-foreground pt-2">Example: $100 gift = $3.20 processing + $1.50 Kora fee = $4.70 total</p>
      </SettingsSection>

      <SettingsSection title="Fee preferences" description="Default behavior for new events">
        <AutoSaveSelect 
          label="Who pays Kora platform fee" 
          value="guests" 
          options={[
            { value: "guests", label: "Guests pay platform fee (default)" },
            { value: "host", label: "I cover platform fee (billed 1.5% per gift)" },
          ]}
        />
        <AutoSaveSelect 
          label="When goal is reached" 
          value="continue" 
          options={[
            { value: "continue", label: "Continue accepting gifts" },
            { value: "stop", label: "Stop accepting gifts at goal" },
          ]}
        />
        <p className="text-xs text-muted-foreground">Guests always pay processing. You can cover that too per-event.</p>
      </SettingsSection>

      <SettingsSection title="Payment method">
        <div className="flex items-center justify-between py-2">
          <div className="flex items-center gap-3">
            <div className="w-10 h-6 rounded bg-gradient-to-r from-blue-600 to-blue-800 flex items-center justify-center text-white text-[8px] font-bold">VISA</div>
            <div>
              <p className="text-sm font-medium text-foreground">•••• 4242</p>
              <p className="text-xs text-muted-foreground">Expires 12/26</p>
            </div>
          </div>
          <button 
            onClick={() => toast({ title: "Update payment method", description: "Contact support to update your card" })}
            className="text-sm text-muted-foreground hover:text-foreground"
          >Update</button>
        </div>
      </SettingsSection>

      <SettingsSection title="Invoices">
        <p className="text-sm text-muted-foreground">No invoices yet. Invoices will appear here after you upgrade or cover fees.</p>
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
  const [activeTab, setActiveTab] = useState<SettingsTab>("profile");

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
          <div className="max-w-lg mx-auto px-4 h-14 flex items-center justify-between">
            <Link href="/dashboard">
              <motion.button 
                whileTap={{ scale: 0.95 }}
                className="flex items-center gap-2 text-muted-foreground"
              >
                <ArrowLeft size={20} />
                <span className="text-sm">Back</span>
              </motion.button>
            </Link>
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
