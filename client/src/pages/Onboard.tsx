import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Leaf, ArrowRight, ArrowLeft, Check, Shield, User, Calendar, MapPin, FileText, Loader2, CheckCircle2 } from "lucide-react";
import { Link, useLocation } from "wouter";
import { motion, AnimatePresence } from "framer-motion";

const STEPS = [
  { id: "guardian", label: "Your info" },
  { id: "child", label: "Child info" },
  { id: "identity", label: "Verify identity" },
  { id: "review", label: "Review" },
];

export default function Onboard() {
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
          <p className="text-sm text-muted-foreground">Open custodial account</p>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8 max-w-md">
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
          {step === 0 && (
            <motion.div key="guardian" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
              <Card className="border-none shadow-sm">
                <CardContent className="p-6 space-y-5">
                  <div className="text-center mb-6">
                    <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-3">
                      <User className="h-6 w-6 text-primary" />
                    </div>
                    <h2 className="text-xl font-semibold">Guardian information</h2>
                    <p className="text-sm text-muted-foreground">Required to open a custodial account</p>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-2">
                      <Label className="text-sm">First name</Label>
                      <Input placeholder="Sarah" className="h-11" data-testid="input-first-name" />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-sm">Last name</Label>
                      <Input placeholder="Miller" className="h-11" data-testid="input-last-name" />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label className="text-sm">Email</Label>
                    <Input type="email" placeholder="sarah@example.com" className="h-11" data-testid="input-email" />
                  </div>

                  <div className="space-y-2">
                    <Label className="text-sm">Phone</Label>
                    <Input type="tel" placeholder="(555) 123-4567" className="h-11" data-testid="input-phone" />
                  </div>

                  <div className="space-y-2">
                    <Label className="text-sm">Date of birth</Label>
                    <Input type="date" className="h-11" data-testid="input-dob" />
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          )}

          {step === 1 && (
            <motion.div key="child" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
              <Card className="border-none shadow-sm">
                <CardContent className="p-6 space-y-5">
                  <div className="text-center mb-6">
                    <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-3">
                      <Calendar className="h-6 w-6 text-primary" />
                    </div>
                    <h2 className="text-xl font-semibold">Child information</h2>
                    <p className="text-sm text-muted-foreground">The beneficiary of the custodial account</p>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-2">
                      <Label className="text-sm">First name</Label>
                      <Input placeholder="Ari" className="h-11" data-testid="input-child-first" />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-sm">Last name</Label>
                      <Input placeholder="Miller" className="h-11" data-testid="input-child-last" />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label className="text-sm">Date of birth</Label>
                    <Input type="date" className="h-11" data-testid="input-child-dob" />
                  </div>

                  <div className="space-y-2">
                    <Label className="text-sm">Social Security Number</Label>
                    <Input placeholder="XXX-XX-XXXX" className="h-11" data-testid="input-child-ssn" />
                    <p className="text-xs text-muted-foreground">Required by law for custodial accounts. Encrypted and secure.</p>
                  </div>

                  <div className="space-y-2">
                    <Label className="text-sm">Your relationship</Label>
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

          {step === 2 && (
            <motion.div key="identity" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
              <Card className="border-none shadow-sm">
                <CardContent className="p-6 space-y-5">
                  <div className="text-center mb-6">
                    <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-3">
                      <FileText className="h-6 w-6 text-primary" />
                    </div>
                    <h2 className="text-xl font-semibold">Verify your identity</h2>
                    <p className="text-sm text-muted-foreground">Required by SEC regulations (KYC)</p>
                  </div>

                  <div className="space-y-2">
                    <Label className="text-sm">Social Security Number</Label>
                    <Input placeholder="XXX-XX-XXXX" className="h-11" data-testid="input-ssn" />
                  </div>

                  <div className="space-y-2">
                    <Label className="text-sm">Street address</Label>
                    <Input placeholder="123 Main St" className="h-11" data-testid="input-address" />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-2">
                      <Label className="text-sm">City</Label>
                      <Input placeholder="New York" className="h-11" data-testid="input-city" />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-sm">State</Label>
                      <Input placeholder="NY" className="h-11" data-testid="input-state" />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label className="text-sm">ZIP code</Label>
                    <Input placeholder="10001" className="h-11" data-testid="input-zip" />
                  </div>

                  <div className="p-4 rounded-xl bg-muted/50 text-sm text-muted-foreground">
                    <p className="flex items-start gap-2">
                      <Shield className="h-4 w-4 mt-0.5 shrink-0" />
                      Your information is encrypted and only used for regulatory compliance. We never sell your data.
                    </p>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          )}

          {step === 3 && (
            <motion.div key="review" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
              <Card className="border-none shadow-sm">
                <CardContent className="p-6 space-y-5">
                  <div className="text-center mb-6">
                    <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-3">
                      <CheckCircle2 className="h-6 w-6 text-primary" />
                    </div>
                    <h2 className="text-xl font-semibold">Review & confirm</h2>
                    <p className="text-sm text-muted-foreground">You're opening a UTMA custodial account</p>
                  </div>

                  <div className="space-y-4">
                    <div className="p-4 rounded-xl bg-muted/50">
                      <p className="text-xs text-muted-foreground mb-1">Guardian</p>
                      <p className="font-medium">Sarah Miller</p>
                      <p className="text-sm text-muted-foreground">sarah@example.com</p>
                    </div>

                    <div className="p-4 rounded-xl bg-muted/50">
                      <p className="text-xs text-muted-foreground mb-1">Beneficiary</p>
                      <p className="font-medium">Ari Miller</p>
                      <p className="text-sm text-muted-foreground">Minor (UTMA)</p>
                    </div>

                    <div className="p-4 rounded-xl bg-muted/50">
                      <p className="text-xs text-muted-foreground mb-1">Account type</p>
                      <p className="font-medium">Custodial brokerage (UTMA)</p>
                      <p className="text-sm text-muted-foreground">Cleared by Apex • SIPC insured</p>
                    </div>
                  </div>

                  <div className="text-xs text-muted-foreground space-y-2">
                    <p>By continuing, you agree to:</p>
                    <ul className="space-y-1 ml-4 list-disc">
                      <li><a href="#" className="text-primary hover:underline">Account Agreement</a></li>
                      <li><a href="#" className="text-primary hover:underline">UTMA Disclosure</a></li>
                      <li><a href="#" className="text-primary hover:underline">Privacy Policy</a></li>
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
