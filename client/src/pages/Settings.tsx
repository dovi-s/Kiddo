import { useState } from "react";
import { Link } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "@/hooks/use-toast";
import { Logo } from "@/components/ui/logo";
import { Switch } from "@/components/ui/switch";
import { 
  User, Shield, Bell, CreditCard, FileText, Search, 
  ChevronRight, Check, LogOut, HelpCircle, ArrowLeft,
  Smartphone, Mail, Eye, EyeOff, Lock, Globe, Users, Sparkles
} from "lucide-react";

type SettingsTab = "account" | "security" | "notifications" | "billing" | "documents";

const tabs: { id: SettingsTab; label: string; icon: React.ReactNode }[] = [
  { id: "account", label: "Account", icon: <User size={18} /> },
  { id: "security", label: "Security", icon: <Shield size={18} /> },
  { id: "notifications", label: "Notifications", icon: <Bell size={18} /> },
  { id: "billing", label: "Billing", icon: <CreditCard size={18} /> },
  { id: "documents", label: "Documents", icon: <FileText size={18} /> },
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
      <label className="text-sm font-medium text-stone-700">{label}</label>
      <div className="relative">
        <input
          type={type}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onBlur={handleBlur}
          placeholder={placeholder}
          disabled={disabled}
          className={`w-full px-3 py-2.5 border border-stone-200 rounded-lg text-stone-900 placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-stone-900/10 focus:border-stone-300 transition-all ${disabled ? 'bg-stone-50 text-stone-500' : 'bg-white'}`}
        />
        {saving && (
          <div className="absolute right-3 top-1/2 -translate-y-1/2">
            <div className="w-4 h-4 border-2 border-stone-300 border-t-stone-600 rounded-full animate-spin" />
          </div>
        )}
      </div>
      {hint && <p className="text-xs text-stone-400">{hint}</p>}
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
      <label className="text-sm font-medium text-stone-700">{label}</label>
      <div className="relative">
        <select 
          value={value}
          onChange={(e) => handleChange(e.target.value)}
          className="w-full px-3 py-2.5 border border-stone-200 rounded-lg text-stone-900 bg-white focus:outline-none focus:ring-2 focus:ring-stone-900/10 appearance-none pr-10"
        >
          {options.map(opt => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </select>
        <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none">
          {saving ? (
            <div className="w-4 h-4 border-2 border-stone-300 border-t-stone-600 rounded-full animate-spin" />
          ) : (
            <ChevronRight size={16} className="text-stone-400 rotate-90" />
          )}
        </div>
      </div>
      {hint && <p className="text-xs text-stone-400">{hint}</p>}
    </div>
  );
}

function SettingsSection({ title, description, children }: { title: string; description?: string; children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-xl border border-stone-200 overflow-hidden">
      <div className="px-5 py-4 border-b border-stone-100">
        <h3 className="font-medium text-stone-900">{title}</h3>
        {description && <p className="text-sm text-stone-500 mt-0.5">{description}</p>}
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
        <p className="text-sm font-medium text-stone-900">{label}</p>
        {description && <p className="text-xs text-stone-500 mt-0.5">{description}</p>}
      </div>
      <Switch checked={checked} onCheckedChange={handleChange} />
    </div>
  );
}

function LinkRow({ label, description, href, onClick }: { label: string; description?: string; href?: string; onClick?: () => void }) {
  const content = (
    <div className="flex items-center justify-between py-2 cursor-pointer hover:bg-stone-50 -mx-2 px-2 rounded-lg transition-colors">
      <div>
        <p className="text-sm font-medium text-stone-900">{label}</p>
        {description && <p className="text-xs text-stone-500 mt-0.5">{description}</p>}
      </div>
      <ChevronRight size={16} className="text-stone-400" />
    </div>
  );

  if (href) {
    return <Link href={href}>{content}</Link>;
  }
  return <div onClick={onClick}>{content}</div>;
}

function AccountTab() {
  return (
    <div className="space-y-6">
      <SettingsSection title="Profile" description="Your personal information">
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
        <AutoSaveSelect 
          label="Your role" 
          value="parent" 
          options={[
            { value: "parent", label: "Parent / Guardian" },
            { value: "adult", label: "Adult recipient" },
            { value: "contributor", label: "Contributor only" },
          ]}
        />
        <LinkRow label="Manage children" description="Add or edit children in your household" href="/dashboard" />
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
          className="px-4 py-2 bg-stone-900 text-white text-sm font-medium rounded-lg hover:bg-stone-800 transition-colors"
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
            <div className="w-8 h-8 rounded-lg bg-stone-100 flex items-center justify-center">
              <Globe size={16} className="text-stone-600" />
            </div>
            <div>
              <p className="text-sm font-medium text-stone-900">Chrome on MacOS</p>
              <p className="text-xs text-stone-500">San Francisco, CA · Active now</p>
            </div>
          </div>
          <span className="text-xs text-emerald-600 bg-emerald-50 px-2 py-1 rounded">Current</span>
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

      <div className="p-4 bg-stone-50 rounded-xl border border-stone-100">
        <div className="flex items-start gap-3">
          <Shield size={18} className="text-stone-500 mt-0.5" />
          <div>
            <p className="text-sm font-medium text-stone-700">Brokerage custody & SIPC protection</p>
            <p className="text-xs text-stone-500 mt-1">Your investments are held by Alpaca Securities LLC, member FINRA/SIPC. Assets are protected up to $500,000.</p>
            <button className="text-xs text-stone-600 underline mt-2 hover:no-underline">Learn more</button>
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
      <div className="bg-white rounded-xl border border-stone-200 overflow-hidden">
        <div className="px-5 py-4 border-b border-stone-100">
          <h3 className="font-medium text-stone-900">Notification preferences</h3>
          <p className="text-sm text-stone-500 mt-0.5">Choose how you want to be notified</p>
        </div>
        
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-stone-100">
                <th className="text-left text-xs font-medium text-stone-400 uppercase tracking-wider px-5 py-3">Type</th>
                <th className="text-center text-xs font-medium text-stone-400 uppercase tracking-wider px-3 py-3 w-20">
                  <div className="flex items-center justify-center gap-1">
                    <Mail size={14} />
                    <span>Email</span>
                  </div>
                </th>
                <th className="text-center text-xs font-medium text-stone-400 uppercase tracking-wider px-3 py-3 w-20">
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
                  <tr key={category.id} className="bg-stone-50">
                    <td colSpan={3} className="px-5 py-2 text-xs font-medium text-stone-500 uppercase tracking-wider">
                      {category.label}
                    </td>
                  </tr>
                  {notificationTypes.filter(n => n.category === category.id).map(notification => (
                    <tr key={notification.id} className="border-b border-stone-50 hover:bg-stone-50/50 transition-colors">
                      <td className="px-5 py-3 text-sm text-stone-900">{notification.label}</td>
                      <td className="px-3 py-3 text-center">
                        <button
                          onClick={() => toggle(notification.id, "email")}
                          className={`w-6 h-6 rounded-md flex items-center justify-center transition-colors ${preferences[notification.id]?.email ? 'bg-stone-900 text-white' : 'bg-stone-100 text-stone-400 hover:bg-stone-200'}`}
                        >
                          {preferences[notification.id]?.email && <Check size={14} />}
                        </button>
                      </td>
                      <td className="px-3 py-3 text-center">
                        <button
                          onClick={() => toggle(notification.id, "sms")}
                          className={`w-6 h-6 rounded-md flex items-center justify-center transition-colors ${preferences[notification.id]?.sms ? 'bg-stone-900 text-white' : 'bg-stone-100 text-stone-400 hover:bg-stone-200'}`}
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
        <div className="p-5 bg-white rounded-xl border border-stone-200">
          <div className="flex items-center justify-between mb-4">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <p className="text-lg font-semibold text-stone-900">Free</p>
                <span className="text-xs font-medium text-stone-500 bg-stone-100 px-2 py-0.5 rounded-full">Current</span>
              </div>
              <p className="text-sm text-stone-500">Guests pay all fees at checkout</p>
            </div>
          </div>
          
          <div className="p-4 rounded-lg bg-gradient-to-br from-stone-900 to-stone-800 text-white">
            <div className="flex items-start justify-between mb-3">
              <div>
                <p className="font-semibold mb-0.5">Upgrade to Family</p>
                <p className="text-sm text-stone-300">$199/year</p>
              </div>
              <Sparkles size={20} className="text-amber-400" />
            </div>
            <ul className="text-sm text-stone-300 space-y-1.5 mb-4">
              <li className="flex items-center gap-2">
                <Check size={14} className="text-emerald-400" />
                Platform fees waived up to $15,000/year
              </li>
              <li className="flex items-center gap-2">
                <Check size={14} className="text-emerald-400" />
                Household dashboard for all your kids
              </li>
              <li className="flex items-center gap-2">
                <Check size={14} className="text-emerald-400" />
                Recurring gift management
              </li>
              <li className="flex items-center gap-2">
                <Check size={14} className="text-emerald-400" />
                Priority support
              </li>
            </ul>
            <button 
              onClick={() => toast({ title: "Upgrade to Family", description: "Family plan coming soon" })}
              className="w-full py-2.5 bg-white text-stone-900 font-medium rounded-lg hover:bg-stone-100 transition-colors text-sm"
            >
              Upgrade to Family
            </button>
          </div>
        </div>
      </SettingsSection>

      <SettingsSection title="Event Passes" description="One-time upgrades for individual events">
        <div className="p-4 bg-stone-50 rounded-lg border border-stone-100">
          <p className="text-sm text-stone-500 mb-3">
            Event Passes ($99 each) unlock premium features and waive platform fees for a single event. 
            Purchase when creating or editing an event.
          </p>
          <div className="text-xs text-stone-400">
            No Event Passes purchased yet.
          </div>
        </div>
      </SettingsSection>

      <SettingsSection title="How fees work" description="Two components shown at checkout">
        <div className="space-y-3">
          <div className="p-3 rounded-lg bg-stone-50 border border-stone-100">
            <div className="flex items-center justify-between mb-1">
              <p className="text-sm font-medium text-stone-700">Processing (pass-through)</p>
              <p className="text-sm text-stone-500">~2.9% + $0.30</p>
            </div>
            <p className="text-xs text-stone-400">Card network fees. Lower for ACH (~$0.75).</p>
          </div>
          <div className="p-3 rounded-lg bg-stone-50 border border-stone-100">
            <div className="flex items-center justify-between mb-1">
              <p className="text-sm font-medium text-stone-700">Kora platform fee</p>
              <p className="text-sm text-stone-500">1.5% ($1–$10)</p>
            </div>
            <p className="text-xs text-stone-400">Covers brokerage, KYC, support, and thank-you automation. 1.0% for ACH.</p>
          </div>
        </div>
        <p className="text-xs text-stone-400 pt-2">Example: $100 gift = $3.20 processing + $1.50 Kora fee = $4.70 total</p>
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
        <p className="text-xs text-stone-400">Guests always pay processing. You can cover that too per-event.</p>
      </SettingsSection>

      <SettingsSection title="Payment method">
        <div className="flex items-center justify-between py-2">
          <div className="flex items-center gap-3">
            <div className="w-10 h-6 rounded bg-gradient-to-r from-blue-600 to-blue-800 flex items-center justify-center text-white text-[8px] font-bold">VISA</div>
            <div>
              <p className="text-sm font-medium text-stone-900">•••• 4242</p>
              <p className="text-xs text-stone-500">Expires 12/26</p>
            </div>
          </div>
          <button 
            onClick={() => toast({ title: "Update payment method", description: "Contact support to update your card" })}
            className="text-sm text-stone-600 hover:text-stone-900"
          >Update</button>
        </div>
      </SettingsSection>

      <SettingsSection title="Invoices">
        <p className="text-sm text-stone-500">No invoices yet. Invoices will appear here after you upgrade or cover fees.</p>
      </SettingsSection>
    </div>
  );
}

function DocumentsTab() {
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
            <div key={i} className="flex items-center justify-between py-3 border-b border-stone-50 last:border-0">
              <div>
                <p className="text-sm font-medium text-stone-900">{doc.title}</p>
                <p className="text-xs text-stone-500">{doc.date} · {doc.fund}</p>
              </div>
              <button 
                onClick={() => toast({ title: "Download started", description: "Your document is being prepared" })}
                className="text-sm text-stone-600 hover:text-stone-900 font-medium"
              >Download</button>
            </div>
          ))}
        </div>
      </SettingsSection>

      <SettingsSection title="Gift Confirmations" description="Receipts for gifts received">
        <div className="space-y-2">
          {documents.filter(d => d.type === "confirmation").map((doc, i) => (
            <div key={i} className="flex items-center justify-between py-3 border-b border-stone-50 last:border-0">
              <div>
                <p className="text-sm font-medium text-stone-900">{doc.title}</p>
                <p className="text-xs text-stone-500">{doc.date} · {doc.fund}</p>
              </div>
              <button 
                onClick={() => toast({ title: "Download started", description: "Your document is being prepared" })}
                className="text-sm text-stone-600 hover:text-stone-900 font-medium"
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

      <SettingsSection title="Support">
        <LinkRow label="Help Center" description="FAQs and guides" />
        <LinkRow label="Contact Support" description="support@kora.com" onClick={() => window.open('mailto:support@kora.com')} />
      </SettingsSection>
    </div>
  );
}

export default function Settings() {
  const [activeTab, setActiveTab] = useState<SettingsTab>("account");
  const [searchQuery, setSearchQuery] = useState("");

  const renderTabContent = () => {
    switch (activeTab) {
      case "account": return <AccountTab />;
      case "security": return <SecurityTab />;
      case "notifications": return <NotificationsTab />;
      case "billing": return <BillingTab />;
      case "documents": return <DocumentsTab />;
    }
  };

  return (
    <div className="min-h-screen bg-stone-50">
      <header className="sticky top-0 z-40 bg-white border-b border-stone-200">
        <div className="max-w-6xl mx-auto px-4 h-14 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/dashboard">
              <button className="flex items-center gap-1.5 text-sm text-stone-500 hover:text-stone-700">
                <ArrowLeft size={16} />
                <span className="hidden sm:inline">Back</span>
              </button>
            </Link>
            <Logo size="md" className="text-stone-900" />
          </div>
          <Link href="/dashboard">
            <button className="text-sm text-stone-500 hover:text-stone-700">Dashboard</button>
          </Link>
        </div>
      </header>

      <div className="max-w-6xl mx-auto px-4 py-8">
        <div className="mb-8">
          <h1 className="text-2xl font-semibold text-stone-900">Settings</h1>
          <p className="text-stone-500 mt-1">Manage your account and preferences</p>
        </div>

        <div className="relative mb-6">
          <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" />
          <input
            type="text"
            placeholder="Search settings..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 bg-white border border-stone-200 rounded-xl text-stone-900 placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-stone-900/10 focus:border-stone-300"
          />
        </div>

        <div className="flex flex-col lg:flex-row gap-8">
          <nav className="lg:w-56 shrink-0">
            <div className="flex lg:flex-col gap-1 overflow-x-auto lg:overflow-visible pb-2 lg:pb-0 -mx-4 px-4 lg:mx-0 lg:px-0">
              {tabs.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  data-testid={`settings-tab-${tab.id}`}
                  className={`flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${
                    activeTab === tab.id
                      ? "bg-stone-900 text-white"
                      : "text-stone-600 hover:bg-stone-100"
                  }`}
                >
                  {tab.icon}
                  {tab.label}
                </button>
              ))}
            </div>

            <div className="hidden lg:block mt-6 pt-6 border-t border-stone-200 space-y-1">
              <button className="flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm text-stone-500 hover:bg-stone-100 hover:text-stone-700 w-full transition-colors">
                <HelpCircle size={18} />
                Help & Support
              </button>
              <Link href="/login">
                <button className="flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm text-stone-500 hover:bg-stone-100 hover:text-stone-700 w-full transition-colors">
                  <LogOut size={18} />
                  Sign out
                </button>
              </Link>
            </div>
          </nav>

          <main className="flex-1 min-w-0">
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
          </main>
        </div>
      </div>

      <footer className="border-t border-stone-200 bg-white mt-12">
        <div className="max-w-6xl mx-auto px-4 py-6 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-stone-400">
          <div className="flex items-center gap-4">
            <span>Brokerage by Alpaca Securities LLC</span>
            <span>Member FINRA/SIPC</span>
          </div>
          <div className="flex items-center gap-4">
            <Lock size={12} />
            <span>256-bit encryption</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
