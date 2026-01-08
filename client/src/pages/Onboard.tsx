import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Leaf, ArrowRight, ArrowLeft, Check, Loader2 } from "lucide-react";
import { Link, useLocation, useSearch } from "wouter";
import { motion, AnimatePresence } from "framer-motion";

export default function Onboard() {
  const search = useSearch();
  const params = new URLSearchParams(search);
  const accountType = params.get("type") || "child";
  const profileName = params.get("name") || "Ari";
  const email = params.get("email") || "you@example.com";
  const isPersonal = accountType === "personal";

  const totalSteps = isPersonal ? 2 : 3;
  const [step, setStep] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [, setLocation] = useLocation();

  const handleNext = () => {
    if (step === totalSteps - 1) {
      setIsSubmitting(true);
      setTimeout(() => {
        setLocation(`/dashboard?type=${accountType}&name=${encodeURIComponent(profileName)}`);
      }, 1500);
    } else {
      setStep(step + 1);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="p-4 border-b">
        <div className="container mx-auto flex items-center justify-between">
          <Link href="/">
            <a className="flex items-center gap-2">
              <Leaf className="h-5 w-5 text-primary" />
              <span className="font-semibold">Everleaf</span>
            </a>
          </Link>
          <p className="text-sm text-muted-foreground">
            Step {step + 1} of {totalSteps}
          </p>
        </div>
      </header>

      <main className="container mx-auto px-4 py-10 max-w-md">
        <AnimatePresence mode="wait">
          {/* Child details - only for custodial */}
          {!isPersonal && step === 0 && (
            <motion.div key="child" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
              <h1 className="text-xl font-semibold mb-2">Details for {profileName}</h1>
              <p className="text-muted-foreground text-sm mb-8">Required to open a custodial account.</p>
              
              <Card className="border">
                <CardContent className="p-6 space-y-5">
                  <div className="space-y-2">
                    <Label className="text-sm">Date of birth</Label>
                    <Input type="date" className="h-11" data-testid="input-child-dob" />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-sm">Social Security Number</Label>
                    <Input placeholder="XXX-XX-XXXX" className="h-11" data-testid="input-child-ssn" />
                    <p className="text-xs text-muted-foreground">Required by law. Encrypted and never shared.</p>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-sm">Your relationship</Label>
                    <select className="w-full h-11 px-3 rounded-md border bg-background text-sm" data-testid="select-relationship">
                      <option>Parent</option>
                      <option>Legal guardian</option>
                      <option>Grandparent</option>
                    </select>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          )}

          {/* Identity */}
          {((isPersonal && step === 0) || (!isPersonal && step === 1)) && (
            <motion.div key="identity" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
              <h1 className="text-xl font-semibold mb-2">Your identity</h1>
              <p className="text-muted-foreground text-sm mb-8">Required by SEC regulations.</p>
              
              <Card className="border">
                <CardContent className="p-6 space-y-5">
                  <div className="p-3 rounded-md bg-muted/50 text-sm">
                    <p className="text-muted-foreground text-xs">Email</p>
                    <p className="font-medium">{email}</p>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-sm">Legal name</Label>
                    <div className="grid grid-cols-2 gap-3">
                      <Input placeholder="First" className="h-11" data-testid="input-first-name" />
                      <Input placeholder="Last" className="h-11" data-testid="input-last-name" />
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
                    <Label className="text-sm">Address</Label>
                    <Input placeholder="Street" className="h-11" data-testid="input-address" />
                    <div className="grid grid-cols-3 gap-2">
                      <Input placeholder="City" className="h-11" data-testid="input-city" />
                      <Input placeholder="State" className="h-11" data-testid="input-state" />
                      <Input placeholder="ZIP" className="h-11" data-testid="input-zip" />
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          )}

          {/* Review */}
          {step === totalSteps - 1 && (
            <motion.div key="review" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
              <h1 className="text-xl font-semibold mb-2">Ready to open</h1>
              <p className="text-muted-foreground text-sm mb-8">Review and confirm.</p>
              
              <Card className="border">
                <CardContent className="p-6 space-y-4">
                  <div className="p-4 rounded-md bg-muted/50">
                    <p className="text-xs text-muted-foreground">Account type</p>
                    <p className="font-medium">{isPersonal ? "Personal brokerage" : "Custodial (UTMA)"}</p>
                  </div>
                  {!isPersonal && (
                    <div className="p-4 rounded-md bg-muted/50">
                      <p className="text-xs text-muted-foreground">Beneficiary</p>
                      <p className="font-medium">{profileName}</p>
                    </div>
                  )}
                  <div className="p-4 rounded-md bg-muted/50">
                    <p className="text-xs text-muted-foreground">Clearing & custody</p>
                    <p className="font-medium">Apex Clearing Corporation</p>
                    <p className="text-xs text-muted-foreground">SIPC protected up to $500,000</p>
                  </div>
                </CardContent>
              </Card>

              <p className="text-xs text-muted-foreground mt-6">
                By continuing, you agree to the Apex Brokerage Agreement{!isPersonal && ", UTMA Custodial Disclosure"}, and Everleaf Terms of Service.
              </p>
            </motion.div>
          )}
        </AnimatePresence>

        <div className="flex gap-3 mt-8">
          {step > 0 && (
            <Button variant="outline" onClick={() => setStep(step - 1)} className="flex-1" data-testid="button-back">
              <ArrowLeft className="mr-2 h-4 w-4" /> Back
            </Button>
          )}
          <Button onClick={handleNext} className="flex-1" disabled={isSubmitting} data-testid="button-next">
            {isSubmitting ? (
              <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Opening...</>
            ) : step === totalSteps - 1 ? (
              <>Open account <Check className="ml-2 h-4 w-4" /></>
            ) : (
              <>Continue <ArrowRight className="ml-2 h-4 w-4" /></>
            )}
          </Button>
        </div>
      </main>
    </div>
  );
}
