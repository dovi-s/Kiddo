import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Users, Heart, Check, Plus, Trash2, ArrowRight, Zap, Calendar as CalendarIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ModalCloseButton } from "@/components/ui/modal-close-button";
import { USOnlyOffRamp } from "@/components/USOnlyOffRamp";
import { Input } from "@/components/ui/input";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useCreateFund, useFunds } from "@/hooks/use-funds";
import { MOTION_DURATION } from "@/lib/motion";
import { useSubscription } from "@/hooks/use-subscription";
import { useAuth } from "@/hooks/use-auth";
import { getPronouns } from "@/lib/pronouns";
import { haptic } from "@/lib/haptics";
import { KORA_FAMILY_MONTHLY, KORA_FAMILY_YEARLY } from "@shared/monetization";
import { US_STATES, getMajorityAgeForState } from "@shared/utma";
import { TRADITION_LABELS, TRADITION_ICONS, type CulturalTradition } from "@/lib/cultural-calendar";
import { PRONOUN_OPTIONS, type PronounKey } from "@/lib/pronouns";

type FundType = "child" | null;
type Step = "choose" | "details" | "culture" | "creating" | "success" | "upgrade-family";

const SUCCESS_HOLD_MS = 1400;

interface ChildEntry {
  id: string;
  name: string;
  lastName: string;
  relationship: string;
  birthdate: string;
  ssnLast4: string;
  pronoun: PronounKey;
  // Country gate. "US" → continues to the state picker + UTMA flow.
  // "OTHER" → swaps the state picker for the international off-ramp,
  // blocks proceeding, and lets the parent join the waitlist. Default
  // empty so the user makes an explicit choice rather than silently
  // proceeding under a US assumption.
  country: string;
  state: string;
  utmaAcknowledged: boolean;
  successorName: string;
  successorEmail: string;
  successorRelation: string;
  successorOpen: boolean;
}

const emptyChild = (id: string): ChildEntry => ({
  id, name: "", lastName: "", relationship: "Parent", birthdate: "", ssnLast4: "",
  pronoun: "they", country: "", state: "", utmaAcknowledged: false,
  successorName: "", successorEmail: "", successorRelation: "",
  successorOpen: false,
});

interface AddFundSheetProps {
  open: boolean;
  onClose: () => void;
  onSuccess?: (fundId?: string) => void;
}

export function AddFundSheet({ open, onClose, onSuccess }: AddFundSheetProps) {
  const createFundMutation = useCreateFund();
  const { data: subscription } = useSubscription();
  const { data: funds } = useFunds();
  const { user } = useAuth();
  // Custodian display name for the UTMA title preview. Parent's full name
  // appears as the legal custodian on the account title at DriveWealth, e.g.
  // "Sammy Mitchell UTMA Sara Mitchell". Falls back to "[Custodian]" when
  // we don't have a name yet so the preview is still informative.
  const custodianFullName = [user?.firstName, user?.lastName]
    .filter((s): s is string => typeof s === "string" && s.trim().length > 0)
    .map((s) => s.trim())
    .join(" ");
  const [step, setStep] = useState<Step>("choose");
  const [fundType, setFundType] = useState<FundType>(null);
  const [children, setChildren] = useState<ChildEntry[]>([emptyChild("1")]);
  const [selectedTraditions, setSelectedTraditions] = useState<CulturalTradition[]>([]);
  const [error, setError] = useState("");
  const [createdNames, setCreatedNames] = useState<string[]>([]);
  const [createdLastFundId, setCreatedLastFundId] = useState<string | undefined>(undefined);

  const reset = () => {
    setStep("choose");
    setFundType(null);
    setChildren([emptyChild("1")]);
    setSelectedTraditions([]);
    setError("");
    setCreatedNames([]);
    setCreatedLastFundId(undefined);
  };

  const effectivePlan = subscription?.effectivePlan ?? "free";
  // Count only CHILD (custodial) funds toward the limit — NOT the user's own
  // account. A graduated owner (post-handoff: transferredAt set / accountType
  // "personal" / recipientRelation "self") holds their OWN fund; it must not
  // consume the free child-fund slot or force Family when they add their FIRST
  // kid. Family is for multiple CHILDREN, not "my own account + one kid". So a
  // brand-new parent and a graduated-owner-turned-parent both get the same
  // first-kid experience: free, with Family only at the 2nd child.
  const existingChildFundCount = (funds ?? []).filter((f) => {
    const ff = f as any;
    // OWNED funds only (2026-06-04): the funds list includes collaborated
    // funds (accessRole co-admin/viewer/previous_owner). Someone else's
    // child fund must not consume the viewer's own free child-fund slot —
    // a co-parent creating her FIRST own fund was being pushed straight
    // to the Family upsell. Missing accessRole (older cached rows) counts
    // as owner, matching the Dashboard's fallback direction.
    const role = String(ff.accessRole || "owner");
    if (role !== "owner") return false;
    const isOwnHeld =
      Boolean(ff.transferredAt) ||
      String(ff.accountType || "").toLowerCase() === "personal" ||
      ff.recipientRelation === "self";
    return !isOwnHeld;
  }).length;
  const childFundLimit = effectivePlan === "family" || effectivePlan === "legacy" ? Infinity : 1;
  const isAtChildFundLimit = existingChildFundCount >= childFundLimit;

  const handleClose = () => {
    // Don't let a stray backdrop tap interrupt the success ceremony or
    // the in-flight create — let the timer hand off cleanly.
    if (step === "creating" || step === "success") return;
    reset();
    onClose();
  };

  const addChild = () => {
    setChildren([...children, emptyChild(Date.now().toString())]);
  };

  const removeChild = (id: string) => {
    if (children.length > 1) {
      setChildren(children.filter(c => c.id !== id));
    }
  };

  const updateChild = (id: string, field: keyof ChildEntry, value: string | PronounKey | boolean) => {
    setChildren(children.map(c => c.id === id ? { ...c, [field]: value } as ChildEntry : c));
  };

  // Birthdate bounds: child must be born today or earlier, and must still be under 18
  const todayStr = new Date().toISOString().split("T")[0];
  const minBirthdate = (() => {
    const d = new Date();
    d.setFullYear(d.getFullYear() - 18);
    d.setDate(d.getDate() + 1); // day after 18-years-ago = must still be under 18
    return d.toISOString().split("T")[0];
  })();

  const validateBirthdate = (dateStr: string): string | null => {
    if (!dateStr.trim()) return "Date of birth is required.";
    if (dateStr > todayStr) return "Date of birth cannot be in the future.";
    if (dateStr < minBirthdate) return "Child funds are for children under 18. This date would make the child 18 or older.";
    return null;
  };

  const canProceed = () => {
    if (step === "choose") return true;
    if (step === "details") return children.every(c =>
      c.name.trim().length > 0 &&
      c.lastName.trim().length > 0 &&
      c.birthdate.trim().length > 0 &&
      validateBirthdate(c.birthdate) === null &&
      /^\d{4}$/.test(c.ssnLast4) &&
      // Country must be explicitly US — non-US visitors get the
      // off-ramp panel below and cannot proceed.
      c.country === "US" &&
      c.state.trim().length === 2 &&
      c.utmaAcknowledged
    );
    if (step === "culture") return true; // optional step, always can proceed
    return false;
  };

  const toggleTradition = (t: CulturalTradition) => {
    haptic("selection");
    setSelectedTraditions(prev =>
      prev.includes(t) ? prev.filter(x => x !== t) : [...prev, t]
    );
  };

  const handleProceedFromDetails = () => {
    for (const child of children.filter(c => c.name.trim())) {
      const err = validateBirthdate(child.birthdate);
      if (err) {
        setError(`${child.name.trim()}: ${err}`);
        return;
      }
    }
    setError("");
    haptic("selection");
    setStep("culture");
  };

  const handleCreate = async () => {
    setStep("creating");
    setError("");
    haptic("medium");
    const startedAt = Date.now();

    try {
      const culturalBackground = selectedTraditions.length > 0 ? { traditions: selectedTraditions } : undefined;
      const validChildren = children.filter(c => c.name.trim());
      const isFirstFund = (funds?.length ?? 0) === 0;

      // Parallel create. For one child this is identical to a single await; for
      // 2+ children it removes the serial round-trip stack.
      const createdFunds = await Promise.all(
        validChildren.map((child) => {
          const uniqueSuffix = Date.now().toString(36) + Math.random().toString(36).slice(2, 5);
          const majorityAge = getMajorityAgeForState(child.state);
          const successorPresent = child.successorName.trim().length > 0;
          return createFundMutation.mutateAsync({
            name: `${child.name.trim()}'s Future`,
            slug: child.name.trim().toLowerCase().replace(/\s+/g, '-') + '-fund-' + uniqueSuffix,
            accountType: "UTMA",
            status: "draft",
            recipientFirstName: child.name.trim(),
            recipientLastName: child.lastName.trim() || undefined,
            recipientRelation: child.relationship || "Parent",
            recipientBirthdate: new Date(`${child.birthdate}T12:00:00.000Z`),
            recipientSsnLast4: child.ssnLast4.trim() || undefined,
            recipientState: child.state.trim().toUpperCase(),
            majorityAge,
            utmaAcknowledgedAt: new Date(),
            successorCustodianName: successorPresent ? child.successorName.trim() : undefined,
            successorCustodianEmail: successorPresent ? child.successorEmail.trim() || undefined : undefined,
            successorCustodianRelation: successorPresent ? child.successorRelation.trim() || undefined : undefined,
            successorCustodianAddedAt: successorPresent ? new Date() : undefined,
            culturalBackground: culturalBackground as any,
            pronoun: child.pronoun,
          } as any);
        }),
      );

      const lastFundId = createdFunds[createdFunds.length - 1]?.id;
      const namesCreated = validChildren.map((c) => c.name.trim()).filter(Boolean);
      const elapsedMs = Date.now() - startedAt;

      // Lifecycle signal so we can monitor real-world create latency. Fire-and-forget.
      void fetch("/api/referrals/events", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          refCode: lastFundId || "fund_create",
          fundId: lastFundId || null,
          eventId: null,
          action: "fund_created",
          channel: "add_fund_sheet",
          metadata: {
            time_to_create_ms: elapsedMs,
            child_count: createdFunds.length,
            is_first_fund: isFirstFund,
            cultural_traditions: selectedTraditions.length,
          },
        }),
      }).catch(() => {});

      haptic("success");
      setCreatedNames(namesCreated);
      setCreatedLastFundId(lastFundId);
      setStep("success");

      // Brief ceremony, then hand off to the dashboard. Switching the active
      // fund is what triggers the dashboard-summary load, so do it on close
      // (not earlier) — that way the success moment isn't competing with a
      // background dashboard re-render.
      window.setTimeout(() => {
        const finalId = lastFundId;
        reset();
        onClose();
        onSuccess?.(finalId);
      }, SUCCESS_HOLD_MS);
    } catch (err: any) {
      setError(err.message || "Something went wrong. Please try again.");
      setStep("culture");
      haptic("error");
    }
  };

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: MOTION_DURATION.fast }}
            className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50"
            onClick={handleClose}
          />
          <motion.div
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 40 }}
            transition={{ type: "spring", damping: 25, stiffness: 300 }}
            className="fixed inset-x-0 bottom-0 z-50 max-h-[90vh] max-h-[90dvh] overflow-y-auto bg-background rounded-t-3xl shadow-2xl md:inset-auto md:top-1/2 md:left-1/2 md:-translate-x-1/2 md:-translate-y-1/2 md:rounded-3xl md:max-w-lg md:w-full"
          >
            <div className="sticky top-0 bg-background/80 backdrop-blur-lg rounded-t-3xl z-10">
              <div className="flex items-center justify-between p-5 pb-3">
                <h2 className="text-lg font-semibold text-foreground">
                  {step === "choose" ? "Add a new fund" : step === "creating" ? "Creating..." : step === "success" ? "All set" : step === "upgrade-family" ? "Upgrade to add more" : step === "culture" ? "Cultural milestones" : "Add a child's fund"}
                </h2>
                <ModalCloseButton onClick={handleClose} label="Close add fund dialog" testId="button-close-add-fund" />
              </div>
              <div className="h-px bg-border/50 mx-5" />
            </div>

            <div className="p-5 pb-[calc(120px+env(safe-area-inset-bottom,0px))] md:pb-5 space-y-5">
              <AnimatePresence mode="wait">
                {step === "choose" && (
                  <motion.div
                    key="choose"
                    initial={{ opacity: 0, x: 10 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -10 }}
                    transition={{ duration: 0.12 }}
                    className="space-y-3"
                  >
                    <p className="text-sm text-muted-foreground">What kind of fund do you want to add?</p>
                    <div className="rounded-2xl border border-border bg-muted/40 p-4 text-sm text-muted-foreground">
                      This quick-add sheet is for children&apos;s funds. A fund for yourself is coming soon. You can see the idea from <span className="font-medium text-foreground">Get started &rarr; For myself</span>.
                    </div>

                    <button
                      onClick={() => {
                        haptic("selection");
                        if (isAtChildFundLimit) {
                          setStep("upgrade-family");
                        } else {
                          setFundType("child");
                          setStep("details");
                        }
                      }}
                      className="w-full p-4 rounded-2xl border-2 text-left transition-all duration-150 border-primary bg-card shadow-md ring-4 ring-primary/5"
                      data-testid="option-add-child-fund"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl flex items-center justify-center transition-all bg-primary shadow-lg">
                          <Users size={18} className="text-primary-foreground" />
                        </div>
                        <div className="flex-1">
                          <p className="font-semibold text-foreground">For my child</p>
                          <p className="text-xs text-muted-foreground mt-0.5">A fund for a child under 18</p>
                        </div>
                        <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} className="w-5 h-5 bg-primary rounded-full flex items-center justify-center">
                          <Check size={12} className="text-primary-foreground" />
                        </motion.div>
                      </div>
                    </button>
                  </motion.div>
                )}

                {step === "details" && fundType === "child" && (
                  <motion.div
                    key="child-details"
                    initial={{ opacity: 0, x: 10 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -10 }}
                    transition={{ duration: 0.12 }}
                    className="space-y-4"
                  >
                    {children.map((child, index) => (
                      <div key={child.id} className="bg-card rounded-xl border border-border p-4 space-y-3">
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-medium text-foreground">Child {index + 1}</span>
                          {children.length > 1 && (
                            <button onClick={() => removeChild(child.id)} className="text-muted-foreground hover:text-foreground p-1" data-testid={`button-remove-child-${index}`}>
                              <Trash2 size={14} />
                            </button>
                          )}
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <label className="block text-xs text-muted-foreground mb-1.5">First name</label>
                            <Input
                              type="text"
                              value={child.name}
                              onChange={(e) => updateChild(child.id, "name", e.target.value)}
                              placeholder="e.g., Mila"
                              autoFocus={index === 0}
                              data-testid={`input-add-child-name-${index}`}
                            />
                          </div>
                          <div>
                            <label className="block text-xs text-muted-foreground mb-1.5">Last name</label>
                            <Input
                              type="text"
                              value={child.lastName}
                              onChange={(e) => updateChild(child.id, "lastName", e.target.value)}
                              placeholder="e.g., Smith"
                              data-testid={`input-add-child-lastname-${index}`}
                            />
                          </div>
                        </div>
                        <p className="text-[11px] text-muted-foreground -mt-1">Legal name required for the UTMA account title.</p>
                        {/* Live UTMA-title preview — appears as the parent
                            types. Reduces "what gets recorded?" anxiety
                            (DriveWealth registers this string verbatim) and
                            makes the legal weight of the moment tangible. */}
                        {(child.name.trim() || child.lastName.trim()) && (
                          <div
                            className="rounded-lg border border-border/50 bg-muted/40 px-3 py-2 -mt-1"
                            data-testid={`utma-title-preview-${index}`}
                          >
                            <p className="text-[10.5px] font-bold uppercase tracking-wide text-muted-foreground">
                              Account will be titled
                            </p>
                            <p className="mt-1 text-[12px] font-mono leading-snug text-foreground break-words">
                              {[child.name.trim(), child.lastName.trim()].filter(Boolean).join(" ") || "[Child name]"}
                              {" UTMA "}
                              {custodianFullName || "[Your name]"}
                            </p>
                          </div>
                        )}
                        <div>
                          <label className="block text-xs text-muted-foreground mb-1.5">Date of birth</label>
                          <Popover>
                            <PopoverTrigger asChild>
                              <button
                                type="button"
                                data-testid={`input-add-child-birthdate-${index}`}
                                className="w-full h-11 px-3 border-2 border-border rounded-xl text-sm bg-card focus:outline-none focus:border-primary focus:ring-4 focus:ring-primary/10 transition-all flex items-center justify-between text-left"
                              >
                                <span className={child.birthdate ? "text-foreground" : "text-muted-foreground/50"}>
                                  {child.birthdate
                                    ? new Date(child.birthdate + "T12:00:00").toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })
                                    : "mm/dd/yyyy"}
                                </span>
                                <CalendarIcon size={16} className="shrink-0 text-muted-foreground" />
                              </button>
                            </PopoverTrigger>
                            <PopoverContent className="w-auto p-0" align="start">
                              <Calendar
                                mode="single"
                                captionLayout="dropdown"
                                selected={child.birthdate ? new Date(child.birthdate + "T12:00:00") : undefined}
                                onSelect={(date) => {
                                  if (!date) return;
                                  const y = date.getFullYear();
                                  const m = String(date.getMonth() + 1).padStart(2, "0");
                                  const d = String(date.getDate()).padStart(2, "0");
                                  updateChild(child.id, "birthdate", `${y}-${m}-${d}`);
                                }}
                                fromYear={new Date().getFullYear() - 18}
                                toYear={new Date().getFullYear()}
                                defaultMonth={child.birthdate ? new Date(child.birthdate + "T12:00:00") : new Date(new Date().getFullYear() - 5, 0)}
                                disabled={{ after: new Date(), before: new Date(minBirthdate + "T12:00:00") }}
                              />
                            </PopoverContent>
                          </Popover>
                          {child.birthdate && validateBirthdate(child.birthdate) && (
                            <p className="mt-1 text-[11px] text-destructive">{validateBirthdate(child.birthdate)}</p>
                          )}
                          {(!child.birthdate || !validateBirthdate(child.birthdate)) && (
                            <p className="mt-1 text-[11px] text-muted-foreground">Child funds are for children under 18.</p>
                          )}
                        </div>
                        <div>
                          <label htmlFor={`add-fund-relationship-${child.id}`} className="block text-xs text-muted-foreground mb-1.5">Your relationship</label>
                          <select
                            id={`add-fund-relationship-${child.id}`}
                            name="relationship"
                            value={child.relationship}
                            onChange={(e) => updateChild(child.id, "relationship", e.target.value)}
                            data-testid={`select-add-relationship-${index}`}
                            className="w-full h-11 px-3 border-2 border-border rounded-xl text-foreground text-sm bg-card focus:outline-none focus:border-primary focus:ring-4 focus:ring-primary/10 transition-all"
                          >
                            <option value="Parent">Parent</option>
                            <option value="Legal guardian">Legal guardian</option>
                            <option value="Grandparent">Grandparent</option>
                          </select>
                        </div>
                        <div>
                          <label className="block text-xs text-muted-foreground mb-1.5">Pronouns</label>
                          <div className="flex gap-2">
                            {PRONOUN_OPTIONS.map((opt) => (
                              <button
                                key={opt.value}
                                type="button"
                                onClick={() => updateChild(child.id, "pronoun", opt.value)}
                                className={`flex-1 h-10 rounded-xl border-2 text-sm font-medium transition-all ${
                                  child.pronoun === opt.value
                                    ? "border-primary bg-primary/5 text-foreground"
                                    : "border-border bg-card text-muted-foreground hover:border-muted-foreground/40"
                                }`}
                              >
                                {opt.label}
                              </button>
                            ))}
                          </div>
                          {/* Memory Book voice preview — shows the parent
                              that pronouns aren't just stored, they're used.
                              Reads in the same voice the kid will hear at
                              age 18 when they open the Memory Book. Connects
                              the moment of pronoun choice to the long-arc
                              brand promise. */}
                          {child.name.trim() && (() => {
                            const pronouns = getPronouns(child.pronoun);
                            const subj = pronouns.subject;
                            const obj = pronouns.object;
                            return (
                              <p className="mt-2 text-[11.5px] italic text-muted-foreground/80 leading-relaxed">
                                Memory Book voice: <span className="text-foreground/85">"People wrote things for {obj} long before {subj} could read."</span>
                              </p>
                            );
                          })()}
                        </div>
                        <div>
                          <label className="block text-xs text-muted-foreground mb-1.5">Child's SSN (last 4 digits)</label>
                          <Input
                            type="text"
                            inputMode="numeric"
                            maxLength={4}
                            value={child.ssnLast4}
                            onChange={(e) => updateChild(child.id, "ssnLast4", e.target.value.replace(/\D/g, "").slice(0, 4))}
                            placeholder="e.g., 1234"
                            data-testid={`input-add-child-ssn-${index}`}
                          />
                          <p className="mt-1 text-[11px] text-muted-foreground">Last 4 now. We'll ask for the full 9 before the first investment, encrypted at rest.</p>
                        </div>

                        <div>
                          {/* Country gate. Kora is structurally US-only at
                              launch — UTMA is a US legal construct,
                              DriveWealth serves US residents only, 1099s
                              assume US filers. Asking country first catches
                              the silent-break failure mode where a non-US
                              parent would pick a state that isn't theirs
                              just to proceed, then bounce at KYC. */}
                          <label htmlFor={`add-fund-country-${child.id}`} className="block text-xs text-muted-foreground mb-1.5">Country</label>
                          <select
                            id={`add-fund-country-${child.id}`}
                            name="country"
                            value={child.country}
                            onChange={(e) => updateChild(child.id, "country", e.target.value)}
                            data-testid={`select-add-child-country-${index}`}
                            className="w-full h-11 px-3 border-2 border-border rounded-xl text-foreground text-sm bg-card focus:outline-none focus:border-primary focus:ring-4 focus:ring-primary/10 transition-all"
                          >
                            <option value="">Pick a country…</option>
                            <option value="US">United States</option>
                            <option value="OTHER">Outside the United States</option>
                          </select>
                        </div>

                        {child.country === "OTHER" && (
                          <USOnlyOffRamp sourceSurface="add-fund-sheet" compact />
                        )}

                        {child.country === "US" && (
                        <div>
                          <label htmlFor={`add-fund-state-${child.id}`} className="block text-xs text-muted-foreground mb-1.5">Child's state of residence</label>
                          <select
                            id={`add-fund-state-${child.id}`}
                            name="state"
                            value={child.state}
                            onChange={(e) => updateChild(child.id, "state", e.target.value)}
                            data-testid={`select-add-child-state-${index}`}
                            className="w-full h-11 px-3 border-2 border-border rounded-xl text-foreground text-sm bg-card focus:outline-none focus:border-primary focus:ring-4 focus:ring-primary/10 transition-all"
                          >
                            <option value="">Pick a state…</option>
                            {US_STATES.map((s) => (
                              <option key={s.code} value={s.code}>{s.name}</option>
                            ))}
                          </select>
                          <p className="mt-1 text-[11px] text-muted-foreground">
                            UTMA age of majority is set by state law. Most states are 18, a few are 19 or 21.
                          </p>
                          {/* Live "what this means" — turns the state pick
                              from an abstract dropdown into a concrete date.
                              Uses pronouns + name interchangeably ("Emma gets
                              full control... that's June 12, 2042"). The
                              calendar date is what makes parents understand
                              the timeline viscerally. */}
                          {child.state && child.birthdate && validateBirthdate(child.birthdate) === null && (() => {
                            const stateName = US_STATES.find((s) => s.code === child.state)?.name || child.state;
                            const majAge = getMajorityAgeForState(child.state);
                            const dob = new Date(`${child.birthdate}T12:00:00.000Z`);
                            const dom = new Date(dob);
                            dom.setFullYear(dob.getFullYear() + majAge);
                            const domLabel = dom.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
                            const childFirst = child.name.trim() || "they";
                            const pronouns = getPronouns(child.pronoun);
                            const subj = pronouns.singular ? "gets" : "get";
                            return (
                              <div
                                className="mt-2.5 rounded-xl border border-[hsl(var(--kiddo-evergreen)/0.18)] bg-[hsl(var(--kiddo-evergreen)/0.04)] px-3.5 py-2.5"
                                data-testid={`majority-explainer-${index}`}
                              >
                                <p className="text-[10.5px] font-bold uppercase tracking-wide text-[hsl(var(--kiddo-evergreen))]">
                                  What this means
                                </p>
                                <p className="mt-1 text-[12.5px] leading-relaxed text-foreground">
                                  In <span className="font-semibold">{stateName}</span>, {childFirst} {subj} full control of this fund at <span className="font-semibold">{majAge}</span>. That's <span className="font-semibold">{domLabel}</span>.
                                </p>
                              </div>
                            );
                          })()}
                        </div>
                        )}

                        {child.name.trim() && child.state && (() => {
                          const ageOfMajority = getMajorityAgeForState(child.state);
                          const childFirst = child.name.trim();
                          return (
                            <label
                              className={`flex items-start gap-3 p-3 rounded-xl border-2 transition-all cursor-pointer ${
                                child.utmaAcknowledged
                                  ? "border-primary bg-primary/5"
                                  : "border-border bg-card hover:border-border/70"
                              }`}
                              data-testid={`label-utma-acknowledge-${index}`}
                            >
                              <input
                                type="checkbox"
                                checked={child.utmaAcknowledged}
                                onChange={(e) => updateChild(child.id, "utmaAcknowledged", e.target.checked)}
                                className="mt-0.5 w-4 h-4 accent-primary flex-shrink-0"
                                data-testid={`checkbox-utma-acknowledge-${index}`}
                              />
                              <div className="min-w-0">
                                <p className="text-xs font-bold text-foreground leading-snug">
                                  I understand {childFirst}'s fund is irrevocable.
                                </p>
                                <p className="mt-1 text-[11px] text-muted-foreground leading-relaxed">
                                  Once invested, the money belongs to {childFirst}. I manage it as custodian until {childFirst} turns {ageOfMajority} (your state's UTMA age of majority). That's the whole point.
                                </p>
                              </div>
                            </label>
                          );
                        })()}

                        <div className="rounded-xl border border-border/60 bg-card overflow-hidden">
                          <button
                            type="button"
                            onClick={() => updateChild(child.id, "successorOpen", !child.successorOpen)}
                            className="w-full flex items-center justify-between gap-2 px-3 py-2.5 text-left hover:bg-muted/30 transition-colors"
                            data-testid={`button-successor-toggle-${index}`}
                          >
                            <div className="min-w-0">
                              <p className="text-xs font-bold text-foreground">Successor custodian (optional)</p>
                              <p className="mt-0.5 text-[11px] text-muted-foreground leading-snug">
                                {child.successorName.trim()
                                  ? `${child.successorName.trim()} will step in if anything happens to you.`
                                  : `Who manages ${child.name.trim() || "the fund"} if something happens to you?`}
                              </p>
                            </div>
                            <span className="text-xs text-muted-foreground flex-shrink-0">{child.successorOpen ? "−" : "+"}</span>
                          </button>
                          {child.successorOpen && (
                            <div className="px-3 pb-3 space-y-2 border-t border-border/40 pt-3">
                              <input
                                type="text"
                                value={child.successorName}
                                onChange={(e) => updateChild(child.id, "successorName", e.target.value)}
                                placeholder="Full name"
                                data-testid={`input-successor-name-${index}`}
                                className="w-full h-10 px-3 border border-border rounded-lg text-foreground text-sm placeholder:text-muted-foreground/50 focus:outline-none focus:border-primary bg-background"
                              />
                              <input
                                type="email"
                                value={child.successorEmail}
                                onChange={(e) => updateChild(child.id, "successorEmail", e.target.value)}
                                placeholder="Email (so we can notify them if needed)"
                                data-testid={`input-successor-email-${index}`}
                                className="w-full h-10 px-3 border border-border rounded-lg text-foreground text-sm placeholder:text-muted-foreground/50 focus:outline-none focus:border-primary bg-background"
                              />
                              <input
                                type="text"
                                value={child.successorRelation}
                                onChange={(e) => updateChild(child.id, "successorRelation", e.target.value)}
                                placeholder="Their relationship to the child (e.g. Aunt, Grandfather)"
                                data-testid={`input-successor-relation-${index}`}
                                className="w-full h-10 px-3 border border-border rounded-lg text-foreground text-sm placeholder:text-muted-foreground/50 focus:outline-none focus:border-primary bg-background"
                              />
                              <p className="text-[11px] text-muted-foreground/80 leading-relaxed">
                                We won't contact them yet. This is just here so {child.name.trim() || "the fund"} doesn't end up with a court-appointed stranger.
                              </p>
                            </div>
                          )}
                        </div>
                      </div>
                    ))}

                    <button
                      onClick={() => { addChild(); haptic("light"); }}
                      className="w-full py-3 border-2 border-dashed border-border rounded-xl text-muted-foreground hover:border-muted-foreground hover:text-foreground transition-all flex items-center justify-center gap-2 text-sm"
                      data-testid="button-add-another-child"
                    >
                      <Plus size={16} />
                      Add another child
                    </button>

                    {error && (
                      <div className="p-3 rounded-xl bg-destructive/10 border border-destructive/20 text-sm text-destructive">{error}</div>
                    )}

                    <div className="rounded-xl border border-border/50 bg-muted/20 p-3">
                      <p className="text-xs leading-relaxed text-muted-foreground">
                        New funds keep it simple: gifts follow your family default, and anyone can also pick a specific stock. Cash gifts stay off until you allow them. You can change any of this in Settings.
                      </p>
                    </div>

                    <div className="flex gap-3 pt-2">
                      <Button
                        variant="outline"
                        onClick={() => { setStep("choose"); haptic("light"); }}
                        className="flex-1 h-12 rounded-2xl"
                        data-testid="button-back-fund-type-child"
                      >
                        Back
                      </Button>
                      <Button
                        onClick={handleProceedFromDetails}
                        disabled={!canProceed()}
                        className="flex-1 h-12 rounded-2xl"
                        data-testid="button-next-to-culture"
                      >
                        Next
                        <ArrowRight className="ml-2 w-4 h-4" />
                      </Button>
                    </div>
                  </motion.div>
                )}

                {step === "culture" && (
                  <motion.div
                    key="culture"
                    initial={{ opacity: 0, x: 10 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -10 }}
                    transition={{ duration: 0.12 }}
                    className="space-y-4"
                  >
                    <p className="text-sm text-muted-foreground leading-relaxed">
                      Kiddo can suggest milestone events based on your family's traditions. Select any that apply, or skip.
                    </p>

                    <div className="grid grid-cols-2 gap-2">
                      {(Object.keys(TRADITION_LABELS) as CulturalTradition[]).map(t => {
                        const selected = selectedTraditions.includes(t);
                        return (
                          <button
                            key={t}
                            type="button"
                            onClick={() => toggleTradition(t)}
                            className={`flex items-center gap-3 p-3 rounded-2xl border-2 text-left transition-all ${
                              selected
                                ? "border-primary bg-primary/5"
                                : "border-border bg-card hover:border-muted-foreground/40"
                            }`}
                          >
                            <span className="text-xl leading-none">{TRADITION_ICONS[t]}</span>
                            <span className="text-sm font-medium text-foreground leading-tight">{TRADITION_LABELS[t]}</span>
                            {selected && (
                              <div className="ml-auto w-4 h-4 rounded-full bg-primary flex items-center justify-center flex-shrink-0">
                                <Check size={10} className="text-primary-foreground" />
                              </div>
                            )}
                          </button>
                        );
                      })}
                    </div>

                    {error && (
                      <div className="p-3 rounded-xl bg-destructive/10 border border-destructive/20 text-sm text-destructive">{error}</div>
                    )}

                    <div className="flex gap-3 pt-1">
                      <Button
                        variant="outline"
                        onClick={() => { setStep("details"); haptic("light"); }}
                        className="flex-1 h-12 rounded-2xl"
                      >
                        Back
                      </Button>
                      <Button
                        onClick={handleCreate}
                        className="flex-1 h-12 rounded-2xl"
                        data-testid="button-create-child-fund"
                      >
                        {children.filter(c => c.name.trim()).length > 1
                          ? `Create ${children.filter(c => c.name.trim()).length} funds`
                          : `Create ${children[0]?.name.trim() || "the"}'s fund`}
                        <Check className="ml-2 w-4 h-4" />
                      </Button>
                    </div>

                    <button
                      type="button"
                      onClick={() => { setSelectedTraditions([]); handleCreate(); }}
                      className="w-full text-center text-xs text-muted-foreground hover:text-foreground transition-colors py-1"
                    >
                      Skip for now
                    </button>
                  </motion.div>
                )}

                {step === "upgrade-family" && (
                  <motion.div
                    key="upgrade-family"
                    initial={{ opacity: 0, x: 10 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -10 }}
                    transition={{ duration: 0.12 }}
                    className="space-y-5"
                  >
                    <div className="flex flex-col items-center text-center pt-4 pb-2">
                      <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center mb-4">
                        <Zap size={26} className="text-primary" />
                      </div>
                      <h3 className="text-xl font-bold text-foreground leading-tight">
                        Kiddo Family gives you unlimited funds for unlimited kids.
                      </h3>
                      <p className="mt-2 text-sm text-muted-foreground">
                        {effectivePlan === "starter"
                          ? "You're on Kiddo+, which covers one child. Kiddo Family covers every child."
                          : "One price covers every child. No per-fund counting."}
                        {" "}{`$${KORA_FAMILY_MONTHLY.toFixed(2)}/mo or $${KORA_FAMILY_YEARLY.toFixed(2)}/yr.`}
                      </p>
                    </div>

                    <div className="rounded-2xl border border-border bg-muted/30 p-4 space-y-2.5">
                      {[
                        "Unlimited child funds",
                        "Unlimited active events",
                        "One dashboard for every child",
                        "Recurring investments across all funds",
                      ].map((feat) => (
                        <div key={feat} className="flex items-center gap-3">
                          <div className="w-5 h-5 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                            <Check size={12} className="text-primary" />
                          </div>
                          <p className="text-sm text-foreground">{feat}</p>
                        </div>
                      ))}
                    </div>

                    <div className="flex flex-col gap-3 pt-1">
                      <Button
                        onClick={() => {
                          haptic("medium");
                          // Route to Account "Plan & billing" tab per the
                          // WHO/HOW IA Phase 1c: Account is the primary
                          // home of plan management. The Account
                          // auto-trigger useEffect fires Stripe Family
                          // checkout when ?upgrade=family is present.
                          window.location.href = "/account?tab=plan&upgrade=family";
                        }}
                        className="w-full h-12 rounded-2xl text-base font-semibold"
                        data-testid="button-upgrade-to-family"
                      >
                        Upgrade to Family
                        <ArrowRight className="ml-2 w-4 h-4" />
                      </Button>
                      <button
                        onClick={() => { setStep("choose"); haptic("light"); }}
                        className="text-sm text-muted-foreground hover:text-foreground transition-colors py-1"
                        data-testid="button-upgrade-family-dismiss"
                      >
                        Skip for now
                      </button>
                    </div>
                  </motion.div>
                )}

                {step === "creating" && (
                  <motion.div
                    key="creating"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="flex flex-col items-center justify-center py-12"
                  >
                    <motion.div
                      className="w-10 h-10 border-3 border-primary/20 border-t-primary rounded-full"
                      animate={{ rotate: 360 }}
                      transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                      data-testid="add-fund-creating-spinner"
                    />
                    <p className="text-sm text-muted-foreground mt-4">
                      {children.filter((c) => c.name.trim()).length > 1
                        ? "Setting up the funds..."
                        : `Setting up ${children.find((c) => c.name.trim())?.name?.trim() || "your child"}'s fund...`}
                    </p>
                  </motion.div>
                )}

                {step === "success" && (
                  <motion.div
                    key="success"
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.22 }}
                    className="flex flex-col items-center justify-center py-10 text-center"
                    data-testid="add-fund-success"
                  >
                    <motion.div
                      initial={{ scale: 0.6, rotate: -10 }}
                      animate={{ scale: 1, rotate: 0 }}
                      transition={{ type: "spring", damping: 14, stiffness: 220 }}
                      className="text-5xl leading-none mb-3"
                      aria-hidden="true"
                    >
                      🌱
                    </motion.div>
                    <p className="text-base font-semibold text-foreground">
                      {createdNames.length === 0
                        ? "Your fund is ready."
                        : createdNames.length === 1
                          ? `${createdNames[0]}'s fund is ready.`
                          : createdNames.length === 2
                            ? `${createdNames[0]} & ${createdNames[1]}'s funds are ready.`
                            : `${createdNames.length} funds are ready.`}
                    </p>
                    {/* Second line retoned 2026-05-21. Was 'Powered by Kiddo
                        · gifts that actually last 🌱' — marketing-tagline
                        rhythm on a product moment, the canonical
                        anti-pattern this codebase has been auditing out.
                        Replaced with an action-oriented state line that
                        points the parent at the next step (sharing the
                        gift link) which the Dashboard empty state will
                        also surface when they land there in 1.4s. */}
                    <p className="text-xs text-muted-foreground mt-1.5 px-2 leading-relaxed">
                      {createdNames.length <= 1
                        ? "Share the gift link to start the story."
                        : "Each one has its own gift link. Share to start the story."}
                    </p>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
