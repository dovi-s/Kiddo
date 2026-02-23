import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Users, User, Heart, Check, Plus, Trash2, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useCreateFund } from "@/hooks/use-funds";
import { haptic } from "@/lib/haptics";

type FundType = "child" | "personal" | null;
type Step = "choose" | "details" | "creating";

interface ChildEntry {
  id: string;
  name: string;
  relationship: string;
}

interface AddFundSheetProps {
  open: boolean;
  onClose: () => void;
  onSuccess?: (fundId?: string) => void;
}

export function AddFundSheet({ open, onClose, onSuccess }: AddFundSheetProps) {
  const createFundMutation = useCreateFund();
  const [step, setStep] = useState<Step>("choose");
  const [fundType, setFundType] = useState<FundType>(null);
  const [personalName, setPersonalName] = useState("");
  const [children, setChildren] = useState<ChildEntry[]>([
    { id: "1", name: "", relationship: "Parent" }
  ]);
  const [error, setError] = useState("");

  const reset = () => {
    setStep("choose");
    setFundType(null);
    setPersonalName("");
    setChildren([{ id: "1", name: "", relationship: "Parent" }]);
    setError("");
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  const addChild = () => {
    setChildren([...children, {
      id: Date.now().toString(),
      name: "",
      relationship: "Parent"
    }]);
  };

  const removeChild = (id: string) => {
    if (children.length > 1) {
      setChildren(children.filter(c => c.id !== id));
    }
  };

  const updateChild = (id: string, field: keyof ChildEntry, value: string) => {
    setChildren(children.map(c => c.id === id ? { ...c, [field]: value } : c));
  };

  const canProceed = () => {
    if (step === "choose") return fundType !== null;
    if (step === "details") {
      if (fundType === "personal") return personalName.trim().length > 0;
      if (fundType === "child") return children.every(c => c.name.trim().length > 0);
    }
    return false;
  };

  const handleCreate = async () => {
    setStep("creating");
    setError("");
    haptic("medium");

    try {
      let lastFundId: string | undefined;

      if (fundType === "child") {
        const validChildren = children.filter(c => c.name.trim());
        for (let i = 0; i < validChildren.length; i++) {
          const child = validChildren[i];
          const uniqueSuffix = Math.random().toString(36).slice(2, 8);
          const fund = await createFundMutation.mutateAsync({
            name: `${child.name.trim()}'s Future`,
            slug: child.name.trim().toLowerCase().replace(/\s+/g, '-') + '-fund-' + uniqueSuffix,
            accountType: "UTMA",
            status: "draft",
            recipientFirstName: child.name.trim(),
            recipientRelation: child.relationship || "Parent",
          });
          lastFundId = fund.id;
        }
      } else {
        const uniqueSuffix = Math.random().toString(36).slice(2, 8);
        const fund = await createFundMutation.mutateAsync({
          name: personalName.trim() ? `${personalName.trim()}'s Fund` : "My Fund",
          slug: (personalName.trim() || "my-fund").toLowerCase().replace(/\s+/g, '-') + '-fund-' + uniqueSuffix,
          accountType: "Individual",
          status: "draft",
        });
        lastFundId = fund.id;
      }

      haptic("success");
      reset();
      onClose();
      onSuccess?.(lastFundId);
    } catch (err: any) {
      setError(err.message || "Something went wrong. Please try again.");
      setStep("details");
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
            transition={{ duration: 0.15 }}
            className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50"
            onClick={handleClose}
          />
          <motion.div
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 40 }}
            transition={{ type: "spring", damping: 25, stiffness: 300 }}
            className="fixed inset-x-0 bottom-0 z-50 max-h-[90vh] overflow-y-auto bg-background rounded-t-3xl shadow-2xl md:inset-auto md:top-1/2 md:left-1/2 md:-translate-x-1/2 md:-translate-y-1/2 md:rounded-3xl md:max-w-lg md:w-full"
          >
            <div className="sticky top-0 bg-background/80 backdrop-blur-lg rounded-t-3xl z-10">
              <div className="flex items-center justify-between p-5 pb-3">
                <h2 className="text-lg font-semibold text-foreground">
                  {step === "choose" ? "Add a new fund" : step === "creating" ? "Creating..." : fundType === "child" ? "Add a child's fund" : "Add a personal fund"}
                </h2>
                <button
                  onClick={handleClose}
                  className="w-8 h-8 rounded-full bg-muted flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors"
                  data-testid="button-close-add-fund"
                >
                  <X size={16} />
                </button>
              </div>
              <div className="h-px bg-border/50 mx-5" />
            </div>

            <div className="p-5 pb-24 md:pb-5 space-y-5">
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

                    <button
                      onClick={() => { setFundType("child"); haptic("selection"); }}
                      className={`w-full p-4 rounded-2xl border-2 text-left transition-all duration-150 ${
                        fundType === "child"
                          ? "border-primary bg-card shadow-md ring-4 ring-primary/5"
                          : "border-border bg-card hover:border-muted-foreground/30"
                      }`}
                      data-testid="option-add-child-fund"
                    >
                      <div className="flex items-center gap-3">
                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all ${
                          fundType === "child" ? "bg-primary shadow-lg" : "bg-muted"
                        }`}>
                          <Users size={18} className={fundType === "child" ? "text-primary-foreground" : "text-muted-foreground"} />
                        </div>
                        <div className="flex-1">
                          <p className="font-semibold text-foreground">For my child</p>
                          <p className="text-xs text-muted-foreground mt-0.5">Custodial investment account (UTMA)</p>
                        </div>
                        {fundType === "child" && (
                          <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} className="w-5 h-5 bg-primary rounded-full flex items-center justify-center">
                            <Check size={12} className="text-primary-foreground" />
                          </motion.div>
                        )}
                      </div>
                    </button>

                    <button
                      onClick={() => { setFundType("personal"); haptic("selection"); }}
                      className={`w-full p-4 rounded-2xl border-2 text-left transition-all duration-150 ${
                        fundType === "personal"
                          ? "border-primary bg-card shadow-md ring-4 ring-primary/5"
                          : "border-border bg-card hover:border-muted-foreground/30"
                      }`}
                      data-testid="option-add-personal-fund"
                    >
                      <div className="flex items-center gap-3">
                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all ${
                          fundType === "personal" ? "bg-primary shadow-lg" : "bg-muted"
                        }`}>
                          <User size={18} className={fundType === "personal" ? "text-primary-foreground" : "text-muted-foreground"} />
                        </div>
                        <div className="flex-1">
                          <p className="font-semibold text-foreground">For myself</p>
                          <p className="text-xs text-muted-foreground mt-0.5">Personal investment fund</p>
                        </div>
                        {fundType === "personal" && (
                          <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} className="w-5 h-5 bg-primary rounded-full flex items-center justify-center">
                            <Check size={12} className="text-primary-foreground" />
                          </motion.div>
                        )}
                      </div>
                    </button>

                    <Button
                      onClick={() => { setStep("details"); haptic("selection"); }}
                      disabled={!canProceed()}
                      className="w-full h-12 rounded-2xl mt-2"
                      data-testid="button-continue-fund-type"
                    >
                      Continue
                      <ArrowRight className="ml-2 w-4 h-4" />
                    </Button>
                  </motion.div>
                )}

                {step === "details" && fundType === "personal" && (
                  <motion.div
                    key="personal-details"
                    initial={{ opacity: 0, x: 10 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -10 }}
                    transition={{ duration: 0.12 }}
                    className="space-y-4"
                  >
                    <div>
                      <label className="block text-sm font-medium text-foreground mb-2">Your first name</label>
                      <input
                        type="text"
                        value={personalName}
                        onChange={(e) => setPersonalName(e.target.value)}
                        placeholder="e.g., Sarah"
                        autoFocus
                        data-testid="input-personal-fund-name"
                        className="w-full h-12 px-4 border-2 border-border rounded-xl text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:border-primary focus:ring-4 focus:ring-primary/10 bg-card transition-all"
                      />
                    </div>

                    {personalName.trim() && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: "auto" }}
                        className="p-3 rounded-xl bg-success/10 border border-success/20"
                      >
                        <p className="text-sm text-[hsl(var(--kora-evergreen))]">
                          <span className="font-semibold">{personalName.trim()}'s Fund</span>, your personal investment account
                        </p>
                      </motion.div>
                    )}

                    {error && (
                      <div className="p-3 rounded-xl bg-destructive/10 border border-destructive/20 text-sm text-destructive">{error}</div>
                    )}

                    <div className="flex gap-3 pt-2">
                      <Button
                        variant="outline"
                        onClick={() => { setStep("choose"); haptic("light"); }}
                        className="flex-1 h-12 rounded-2xl"
                        data-testid="button-back-fund-type"
                      >
                        Back
                      </Button>
                      <Button
                        onClick={handleCreate}
                        disabled={!canProceed()}
                        className="flex-1 h-12 rounded-2xl"
                        data-testid="button-create-personal-fund"
                      >
                        Create fund
                        <Check className="ml-2 w-4 h-4" />
                      </Button>
                    </div>
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
                        <div>
                          <label className="block text-xs text-muted-foreground mb-1.5">First name</label>
                          <input
                            type="text"
                            value={child.name}
                            onChange={(e) => updateChild(child.id, "name", e.target.value)}
                            placeholder="e.g., Mila"
                            autoFocus={index === 0}
                            data-testid={`input-add-child-name-${index}`}
                            className="w-full h-11 px-3 border-2 border-border rounded-xl text-foreground text-sm placeholder:text-muted-foreground/50 focus:outline-none focus:border-primary focus:ring-4 focus:ring-primary/10 bg-card transition-all"
                          />
                        </div>
                        <div>
                          <label className="block text-xs text-muted-foreground mb-1.5">Your relationship</label>
                          <select
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
                        onClick={handleCreate}
                        disabled={!canProceed()}
                        className="flex-1 h-12 rounded-2xl"
                        data-testid="button-create-child-fund"
                      >
                        {children.filter(c => c.name.trim()).length > 1
                          ? `Create ${children.filter(c => c.name.trim()).length} funds`
                          : `Create ${children[0]?.name.trim() || "the"}'s fund`}
                        <Check className="ml-2 w-4 h-4" />
                      </Button>
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
                    />
                    <p className="text-sm text-muted-foreground mt-4">Setting up your fund...</p>
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
