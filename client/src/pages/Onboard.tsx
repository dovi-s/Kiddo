import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Leaf, ArrowRight, ArrowLeft, Check, Shield, FileText, Loader2, CheckCircle2, Baby, Landmark } from "lucide-react";
import { Link, useLocation, useSearch } from "wouter";
import { motion, AnimatePresence } from "framer-motion";

export default function Onboard() {
  const search = useSearch();
  const params = new URLSearchParams(search);
  const accountType = params.get("type") || "child";
  const profileName = params.get("name") || "Ari";
  const email = params.get("email") || "sarah@example.com";
  const isPersonal = accountType === "personal";

  const STEPS = isPersonal
    ? [
        { id: "identity", label: "Identity" },
        { id: "review", label: "Review" },
      ]
    : [
        { id: "child", label: "Child details" },
        { id: "identity", label: "Your identity" },
        { id: "review", label: "Review" },
      ];

  const [step, setStep] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [, setLocation] = useLocation();

  const handleNext = () => {
    if (step === STEPS.length - 1) {
      setIsSubmitting(true);
      setTimeout(() => {
        setIsSubmitting(false);
        setLocation("/dashboard");
      }, 2000);
    } else {
      setStep(step + 1);
    }
  };

  const progress = ((step + 1) / STEPS.length) * 100;
  const currentStepId = STEPS[step]?.id;

  return (
    <div className="min-h-screen bg-background font-sans">
      <header className="p-4 border-b">
        <div className="container mx-auto flex items-center justify-between">
          <Link href="/">
            <a className="flex items-center gap-2">
              <Leaf className="h-5 w-5 text-primary" />
              <span className="font-semibold">Everleaf</span>
            </a>
          </Link>
          <p className="text-sm text-muted-foreground">
            Open brokerage account
          </p>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8 max-w-md">
        {/* Intro card */}
        {step === 0 && (
          <Card className="border-none shadow-sm bg-primary/5 mb-6">
            <CardContent className="p-4 flex items-center gap-3">
              <Landmark className="h-5 w-5 text-primary shrink-0" />
              <div>
                <p className="text-sm font-medium text-foreground">We'll open your brokerage account</p>
                <p className="text-xs text-muted-foreground">
                  Everleaf partners with Apex Clearing to hold your funds. This requires some legal info to comply with SEC regulations.
                </p>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Progress */}
        <div className="mb-8">
          <div className="flex justify-between text-xs text-muted-foreground mb-2">
            {STEPS.map((s, i) => (
              <span key={s.id} className={i <= step ? "text-primary font-medium" : ""}>{s.label}</span>
            ))}
          </div>
          <Progress value={progress} className="h-1.5" />
        </div>

        <AnimatePresence mode="wait">
          {/* Child Info - only for custodial */}
          {currentStepId === "child" && (
            <motion.div key="child" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
              <Card className="border-none shadow-sm">
                <CardContent className="p-6 space-y-5">
                  <div className="text-center mb-6">
                    <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-3">
                      <Baby className="h-6 w-6 text-primary" />
                    </div>
                    <h2 className="text-xl font-semibold">Legal details for {profileName}</h2>
                    <p className="text-sm text-muted-foreground">Required to open a custodial account in their name</p>
                  </div>

                  <div className="p-3 rounded-lg bg-muted/50 text-sm">
                    <p className="text-muted-foreground">Profile</p>
                    <p className="font-medium">{profileName}</p>
                  </div>

                  <div className="space-y-2">
                    <Label className="text-sm">Child's date of birth</Label>
                    <Input type="date" className="h-11" data-testid="input-child-dob" />
                  </div>

                  <div className="space-y-2">
                    <Label className="text-sm">Child's Social Security Number</Label>
                    <Input placeholder="XXX-XX-XXXX" className="h-11" data-testid="input-child-ssn" />
                    <p className="text-xs text-muted-foreground">Required by law for custodial accounts. Encrypted and never shared.</p>
                  </div>

                  <div className="space-y-2">
                    <Label className="text-sm">Your relationship to {profileName}</Label>
                    <select className="w-full h-11 px-3 rounded-lg border bg-background text-sm" data-testid="select-relationship">
                      <option>Parent</option>
                      <option>Legal guardian</option>
                      <option>Grandparent</option>
                    </select>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          )}

          {/* Identity Verification */}
          {currentStepId === "identity" && (
            <motion.div key="identity" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
              <Card className="border-none shadow-sm">
                <CardContent className="p-6 space-y-5">
                  <div className="text-center mb-6">
                    <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-3">
                      <FileText className="h-6 w-6 text-primary" />
                    </div>
                    <h2 className="text-xl font-semibold">Verify your identity</h2>
                    <p className="text-sm text-muted-foreground">Required by SEC regulations to open a brokerage</p>
                  </div>

                  <div className="p-3 rounded-lg bg-muted/50 text-sm">
                    <p className="text-muted-foreground">Account holder</p>
                    <p className="font-medium">{email}</p>
                  </div>

                  <div className="space-y-2">
                    <Label className="text-sm">Your legal name</Label>
                    <div className="grid grid-cols-2 gap-3">
                      <Input placeholder="First name" className="h-11" data-testid="input-first-name" />
                      <Input placeholder="Last name" className="h-11" data-testid="input-last-name" />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label className="text-sm">Date of birth</Label>
                    <Input type="date" className="h-11" data-testid="input-dob" />
                  </div>

                  <div className="space-y-2">
                    <Label className="text-sm">Social Security Number</Label>
                    <Input placeholder="XXX-XX-XXXX" className="h-11" data-testid="input-ssn" />
                  </div>

                  <div className="space-y-2">
                    <Label className="text-sm">Legal address</Label>
                    <Input placeholder="Street address" className="h-11" data-testid="input-address" />
                    <div className="grid grid-cols-3 gap-2">
                      <Input placeholder="City" className="h-11" data-testid="input-city" />
                      <Input placeholder="State" className="h-11" data-testid="input-state" />
                      <Input placeholder="ZIP" className="h-11" data-testid="input-zip" />
                    </div>
                  </div>

                  <div className="p-4 rounded-xl bg-muted/50 text-sm text-muted-foreground">
                    <p className="flex items-start gap-2">
                      <Shield className="h-4 w-4 mt-0.5 shrink-0" />
                      Your SSN and address are encrypted and only used to verify your identity. We never sell your data.
                    </p>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          )}

          {/* Review */}
          {currentStepId === "review" && (
            <motion.div key="review" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
              <Card className="border-none shadow-sm">
                <CardContent className="p-6 space-y-5">
                  <div className="text-center mb-6">
                    <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-3">
                      <CheckCircle2 className="h-6 w-6 text-primary" />
                    </div>
                    <h2 className="text-xl font-semibold">Ready to open</h2>
                    <p className="text-sm text-muted-foreground">
                      {isPersonal ? "Personal brokerage account" : "Custodial brokerage account (UTMA)"}
                    </p>
                  </div>

                  <div className="space-y-3">
                    <div className="p-4 rounded-xl bg-muted/50">
                      <p className="text-xs text-muted-foreground mb-1">Account holder</p>
                      <p className="font-medium">Sarah Miller</p>
                      <p className="text-sm text-muted-foreground">{email}</p>
                    </div>

                    {!isPersonal && (
                      <div className="p-4 rounded-xl bg-muted/50">
                        <p className="text-xs text-muted-foreground mb-1">Beneficiary</p>
                        <p className="font-medium">{profileName}</p>
                        <p className="text-sm text-muted-foreground">Minor custodial (UTMA)</p>
                      </div>
                    )}

                    <div className="p-4 rounded-xl bg-primary/5 border border-primary/10">
                      <p className="text-xs text-muted-foreground mb-1">Brokerage partner</p>
                      <p className="font-medium">Apex Clearing Corporation</p>
                      <p className="text-sm text-muted-foreground">SIPC insured up to $500,000</p>
                    </div>
                  </div>

                  <div className="text-xs text-muted-foreground space-y-2">
                    <p>By opening this account, you agree to:</p>
                    <ul className="space-y-1 ml-4 list-disc">
                      <li><a href="#" className="text-primary hover:underline">Apex Brokerage Agreement</a></li>
                      {!isPersonal && <li><a href="#" className="text-primary hover:underline">UTMA Custodial Disclosure</a></li>}
                      <li><a href="#" className="text-primary hover:underline">Everleaf Terms of Service</a></li>
                    </ul>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Navigation */}
        <div className="flex gap-3 mt-6">
          {step > 0 && (
            <Button variant="outline" onClick={() => setStep(step - 1)} className="flex-1" data-testid="button-back">
              <ArrowLeft className="mr-2 h-4 w-4" /> Back
            </Button>
          )}
          <Button onClick={handleNext} className="flex-1" disabled={isSubmitting} data-testid="button-next">
            {isSubmitting ? (
              <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Opening account...</>
            ) : step === STEPS.length - 1 ? (
              <>Open account <Check className="ml-2 h-4 w-4" /></>
            ) : (
              <>Continue <ArrowRight className="ml-2 h-4 w-4" /></>
            )}
          </Button>
        </div>

        <div className="flex items-center justify-center gap-4 text-xs text-muted-foreground mt-8">
          <span className="flex items-center gap-1"><Shield className="h-3 w-3" /> 256-bit encryption</span>
          <span>•</span>
          <span>SIPC insured</span>
        </div>
      </main>
    </div>
  );
}
