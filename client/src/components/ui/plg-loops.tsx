import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { 
  Users, 
  Calendar, 
  Gift, 
  Heart, 
  Share2, 
  ChevronRight, 
  X, 
  Bell,
  Repeat,
  UserPlus,
  Sparkles,
  Check
} from "lucide-react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";

interface ReferralPromptProps {
  recipientName: string;
  onShare: () => void;
  onDismiss: () => void;
}

export function ReferralPrompt({ recipientName, onShare, onDismiss }: ReferralPromptProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      className="bg-gradient-to-r from-rose-50 to-pink-50 rounded-xl p-4 border border-rose-100"
    >
      <div className="flex items-start gap-3">
        <div className="w-10 h-10 rounded-full bg-rose-100 flex items-center justify-center shrink-0">
          <Heart className="w-5 h-5 text-rose-500" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-stone-900 mb-1">
            Know someone who'd love to give?
          </p>
          <p className="text-xs text-stone-500 mb-3">
            Share {recipientName}'s fund with friends and family who might want to contribute
          </p>
          <div className="flex gap-2">
            <button
              onClick={onShare}
              data-testid="button-referral-share"
              className="flex items-center gap-1.5 px-3 py-1.5 bg-rose-500 text-white text-sm font-medium rounded-lg hover:bg-rose-600 transition-colors"
            >
              <Share2 size={14} />
              Share fund
            </button>
            <button
              onClick={onDismiss}
              data-testid="button-referral-dismiss"
              className="px-3 py-1.5 text-stone-500 text-sm hover:text-stone-700 transition-colors"
            >
              Maybe later
            </button>
          </div>
        </div>
        <button 
          onClick={onDismiss}
          className="text-stone-300 hover:text-stone-500 transition-colors"
        >
          <X size={16} />
        </button>
      </div>
    </motion.div>
  );
}

interface RecurringGiftNudgeProps {
  lastGiftDate: string;
  recipientName: string;
  onSetupRecurring: () => void;
  onDismiss: () => void;
}

export function RecurringGiftNudge({ 
  lastGiftDate, 
  recipientName, 
  onSetupRecurring, 
  onDismiss 
}: RecurringGiftNudgeProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-xl p-4 border border-blue-100"
    >
      <div className="flex items-start gap-3">
        <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center shrink-0">
          <Repeat className="w-5 h-5 text-blue-500" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-stone-900 mb-1">
            Make your gift go further
          </p>
          <p className="text-xs text-stone-500 mb-3">
            Set up a recurring gift to {recipientName} — small amounts grow big over time
          </p>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={onSetupRecurring}
              data-testid="button-setup-recurring"
              className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-500 text-white text-sm font-medium rounded-lg hover:bg-blue-600 transition-colors"
            >
              <Calendar size={14} />
              Set up recurring
            </button>
            <button
              onClick={onDismiss}
              data-testid="button-recurring-dismiss"
              className="px-3 py-1.5 text-stone-500 text-sm hover:text-stone-700 transition-colors"
            >
              Not now
            </button>
          </div>
        </div>
        <button 
          onClick={onDismiss}
          className="text-stone-300 hover:text-stone-500 transition-colors"
        >
          <X size={16} />
        </button>
      </div>
    </motion.div>
  );
}

interface RecurringSetupModalProps {
  isOpen: boolean;
  onClose: () => void;
  recipientName: string;
  onConfirm: (amount: number, frequency: string) => void;
}

export function RecurringSetupModal({ 
  isOpen, 
  onClose, 
  recipientName,
  onConfirm 
}: RecurringSetupModalProps) {
  const [amount, setAmount] = useState(25);
  const [frequency, setFrequency] = useState("monthly");
  
  const amounts = [10, 25, 50, 100];
  const frequencies = [
    { id: "weekly", label: "Weekly", description: "Every week" },
    { id: "monthly", label: "Monthly", description: "Every month" },
    { id: "yearly", label: "Yearly", description: "Every year (great for birthdays)" },
  ];

  const projections: Record<string, { years: number; total: number; growth: number }> = {
    weekly: { years: 18, total: 23400, growth: 38200 },
    monthly: { years: 18, total: 5400, growth: 8800 },
    yearly: { years: 18, total: 450, growth: 734 },
  };

  const currentProjection = projections[frequency];
  const adjustedTotal = (currentProjection.total * amount) / 25;
  const adjustedGrowth = (currentProjection.growth * amount) / 25;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-md bg-white p-0 gap-0">
        <div className="p-5 border-b border-stone-100">
          <DialogTitle className="font-semibold text-stone-900">Set up recurring gift</DialogTitle>
          <p className="text-sm text-stone-500 mt-0.5">
            Consistency beats timing — small gifts compound over time
          </p>
        </div>

        <div className="p-5 space-y-6">
          <div>
            <label className="block text-sm font-medium text-stone-700 mb-3">
              Amount per gift
            </label>
            <div className="grid grid-cols-4 gap-2">
              {amounts.map((a) => (
                <button
                  key={a}
                  onClick={() => setAmount(a)}
                  data-testid={`button-amount-${a}`}
                  className={`py-3 rounded-xl font-medium transition-all ${
                    amount === a
                      ? "bg-stone-900 text-white"
                      : "bg-stone-50 text-stone-700 hover:bg-stone-100"
                  }`}
                >
                  ${a}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-stone-700 mb-3">
              Frequency
            </label>
            <div className="space-y-2">
              {frequencies.map((f) => (
                <button
                  key={f.id}
                  onClick={() => setFrequency(f.id)}
                  data-testid={`button-frequency-${f.id}`}
                  className={`w-full p-4 rounded-xl text-left transition-all flex items-center justify-between ${
                    frequency === f.id
                      ? "bg-stone-900 text-white"
                      : "bg-stone-50 text-stone-700 hover:bg-stone-100"
                  }`}
                >
                  <div>
                    <p className="font-medium">{f.label}</p>
                    <p className={`text-sm ${frequency === f.id ? "text-stone-300" : "text-stone-500"}`}>
                      {f.description}
                    </p>
                  </div>
                  {frequency === f.id && <Check size={20} />}
                </button>
              ))}
            </div>
          </div>

          <div className="bg-gradient-to-r from-emerald-50 to-teal-50 rounded-xl p-4 border border-emerald-100">
            <div className="flex items-start gap-3">
              <Sparkles className="w-5 h-5 text-emerald-500 shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-stone-900 mb-1">
                  In {currentProjection.years} years...
                </p>
                <p className="text-xs text-stone-600">
                  Your ${amount}/{frequency === "weekly" ? "week" : frequency === "monthly" ? "month" : "year"} could grow from{" "}
                  <span className="font-medium">${adjustedTotal.toLocaleString()}</span> to{" "}
                  <span className="font-medium text-emerald-600">${adjustedGrowth.toLocaleString()}</span>
                </p>
              </div>
            </div>
          </div>
        </div>

        <div className="p-5 border-t border-stone-100 space-y-3">
          <button
            onClick={() => onConfirm(amount, frequency)}
            data-testid="button-confirm-recurring"
            className="w-full py-3 bg-stone-900 text-white font-medium rounded-xl hover:bg-stone-800 transition-colors"
          >
            Start ${amount}/{frequency === "weekly" ? "week" : frequency === "monthly" ? "month" : "year"} recurring gift
          </button>
          <p className="text-xs text-stone-400 text-center">
            Cancel anytime from your dashboard
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}

interface CollaboratorInviteProps {
  fundName: string;
  onInvite: () => void;
  onDismiss: () => void;
}

export function CollaboratorInvite({ fundName, onInvite, onDismiss }: CollaboratorInviteProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      className="bg-gradient-to-r from-violet-50 to-purple-50 rounded-xl p-4 border border-violet-100"
    >
      <div className="flex items-start gap-3">
        <div className="w-10 h-10 rounded-full bg-violet-100 flex items-center justify-center shrink-0">
          <Users className="w-5 h-5 text-violet-500" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-stone-900 mb-1">
            Invite a co-parent or family admin
          </p>
          <p className="text-xs text-stone-500 mb-3">
            Give a partner access to manage {fundName} together
          </p>
          <div className="flex gap-2">
            <button
              onClick={onInvite}
              data-testid="button-invite-collaborator"
              className="flex items-center gap-1.5 px-3 py-1.5 bg-violet-500 text-white text-sm font-medium rounded-lg hover:bg-violet-600 transition-colors"
            >
              <UserPlus size={14} />
              Invite someone
            </button>
            <button
              onClick={onDismiss}
              data-testid="button-collaborator-dismiss"
              className="px-3 py-1.5 text-stone-500 text-sm hover:text-stone-700 transition-colors"
            >
              Later
            </button>
          </div>
        </div>
        <button 
          onClick={onDismiss}
          className="text-stone-300 hover:text-stone-500 transition-colors"
        >
          <X size={16} />
        </button>
      </div>
    </motion.div>
  );
}

interface CollaboratorInviteModalProps {
  isOpen: boolean;
  onClose: () => void;
  fundName: string;
  onSendInvite: (email: string, role: string) => void;
}

export function CollaboratorInviteModal({ 
  isOpen, 
  onClose, 
  fundName,
  onSendInvite 
}: CollaboratorInviteModalProps) {
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("view");
  const [isSending, setIsSending] = useState(false);

  const roles = [
    { 
      id: "view", 
      label: "Viewer", 
      description: "Can view fund activity and growth",
      permissions: ["View balance", "See contributors", "View activity"]
    },
    { 
      id: "admin", 
      label: "Co-Admin", 
      description: "Can manage events and settings",
      permissions: ["All viewer permissions", "Create events", "Edit fund settings", "Send thank-yous"]
    },
  ];

  const handleSend = () => {
    setIsSending(true);
    setTimeout(() => {
      onSendInvite(email, role);
      setIsSending(false);
      setEmail("");
      onClose();
    }, 1000);
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-md bg-white p-0 gap-0">
        <div className="p-5 border-b border-stone-100">
          <DialogTitle className="font-semibold text-stone-900">Invite to {fundName}</DialogTitle>
          <p className="text-sm text-stone-500 mt-0.5">
            Add a family member to help manage this fund
          </p>
        </div>

        <div className="p-5 space-y-6">
          <div>
            <label className="block text-sm font-medium text-stone-700 mb-2">
              Email address
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="partner@example.com"
              data-testid="input-collaborator-email"
              className="w-full px-4 py-3 border border-stone-200 rounded-xl text-stone-900 placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-stone-900/10 focus:border-stone-300"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-stone-700 mb-3">
              Role
            </label>
            <div className="space-y-2">
              {roles.map((r) => (
                <button
                  key={r.id}
                  onClick={() => setRole(r.id)}
                  data-testid={`button-role-${r.id}`}
                  className={`w-full p-4 rounded-xl text-left transition-all ${
                    role === r.id
                      ? "bg-violet-50 border-2 border-violet-500"
                      : "bg-stone-50 border-2 border-transparent hover:bg-stone-100"
                  }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <p className="font-medium text-stone-900">{r.label}</p>
                    {role === r.id && <Check size={18} className="text-violet-500" />}
                  </div>
                  <p className="text-sm text-stone-500 mb-2">{r.description}</p>
                  <div className="flex flex-wrap gap-1">
                    {r.permissions.map((p) => (
                      <span key={p} className="text-[10px] bg-stone-100 text-stone-600 px-2 py-0.5 rounded-full">
                        {p}
                      </span>
                    ))}
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="p-5 border-t border-stone-100">
          <button
            onClick={handleSend}
            disabled={!email || isSending}
            data-testid="button-send-invite"
            className="w-full py-3 bg-violet-500 text-white font-medium rounded-xl hover:bg-violet-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {isSending ? (
              <>
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Sending...
              </>
            ) : (
              <>
                <UserPlus size={18} />
                Send invite
              </>
            )}
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

interface GiftReceivedToastProps {
  giverName: string;
  amount: number;
  recipientName: string;
  onViewActivity: () => void;
  onDismiss: () => void;
}

export function GiftReceivedToast({ 
  giverName, 
  amount, 
  recipientName,
  onViewActivity, 
  onDismiss 
}: GiftReceivedToastProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 50, scale: 0.9 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 20, scale: 0.9 }}
      className="fixed bottom-20 left-4 right-4 md:left-auto md:right-6 md:w-96 bg-white rounded-2xl shadow-2xl border border-stone-200 p-4 z-50"
    >
      <div className="flex items-start gap-3">
        <motion.div 
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ delay: 0.2, type: "spring", stiffness: 200 }}
          className="w-12 h-12 rounded-full bg-gradient-to-br from-emerald-400 to-teal-500 flex items-center justify-center shrink-0"
        >
          <Gift className="w-6 h-6 text-white" />
        </motion.div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-stone-900">
            {giverName} just gifted ${amount}!
          </p>
          <p className="text-xs text-stone-500 mt-0.5">
            {recipientName}'s fund is growing
          </p>
          <button
            onClick={onViewActivity}
            data-testid="button-view-gift-activity"
            className="mt-2 text-xs text-emerald-600 font-medium hover:text-emerald-700 transition-colors flex items-center gap-1"
          >
            View activity
            <ChevronRight size={12} />
          </button>
        </div>
        <button 
          onClick={onDismiss}
          className="text-stone-300 hover:text-stone-500 transition-colors"
        >
          <X size={16} />
        </button>
      </div>
    </motion.div>
  );
}
