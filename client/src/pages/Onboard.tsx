import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Leaf, ArrowRight, ArrowLeft, Check, Lock, Shield } from "lucide-react";
import { Link, useLocation, useSearch } from "wouter";
import { motion, AnimatePresence } from "framer-motion";

export default function Onboard() {
  const search = useSearch();
  const [, setLocation] = useLocation();
  const params = new URLSearchParams(search);
  
  // Redirect to get-started if no valid params (user landed here directly)
  const hasValidParams = params.get("email") && params.get("name");
  
  useEffect(() => {
    if (!hasValidParams) {
      setLocation("/get-started");
    }
  }, [hasValidParams, setLocation]);
  
  const accountType = params.get("type") || "child";
  const profileName = params.get("name") || "";
  const email = params.get("email") || "";
  const childrenParam = params.get("children") || "";
  const isPersonal = accountType === "personal";

  const totalSteps = isPersonal ? 2 : 3;
  const [step, setStep] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleNext = () => {
    if (step === totalSteps - 1) {
      setIsSubmitting(true);
      setTimeout(() => {
        const childrenQuery = childrenParam ? `&children=${encodeURIComponent(childrenParam)}` : "";
        setLocation(`/dashboard?type=${accountType}&name=${encodeURIComponent(profileName)}${childrenQuery}`);
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
              <span className="font-semibold tracking-tight">Everleaf</span>
            </a>
          </Link>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Lock className="h-3 w-3" />
              <span>Secure</span>
            </div>
            <span className="text-sm text-muted-foreground">
              Step {step + 1} of {totalSteps}
            </span>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-10 max-w-md">
        {/* Progress bar */}
        <div className="mb-10">
          <div className="flex gap-2">
            {Array.from({ length: totalSteps }).map((_, i) => (
              <motion.div
                key={i}
                className={`h-1 flex-1 rounded-full ${i <= step ? "bg-foreground" : "bg-foreground/10"}`}
                initial={{ scaleX: 0 }}
                animate={{ scaleX: i <= step ? 1 : 0.3 }}
                transition={{ duration: 0.3 }}
              />
            ))}
          </div>
        </div>

        <AnimatePresence mode="wait">
          {/* Child details */}
          {!isPersonal && step === 0 && (
            <motion.div 
              key="child" 
              initial={{ opacity: 0, x: 20 }} 
              animate={{ opacity: 1, x: 0 }} 
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.3 }}
            >
              <h1 className="text-xl font-semibold tracking-tight mb-2">Details for {profileName}</h1>
              <p className="text-muted-foreground text-sm mb-8">Required to open a custodial account.</p>
              
              <Card className="border">
                <CardContent className="p-6 space-y-5">
                  <motion.div 
                    className="space-y-2"
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.1 }}
                  >
                    <Label className="text-sm">Date of birth</Label>
                    <Input type="date" className="h-12 transition-all focus:ring-2 focus:ring-foreground/10" data-testid="input-child-dob" />
                  </motion.div>
                  <motion.div 
                    className="space-y-2"
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.15 }}
                  >
                    <Label className="text-sm">Social Security Number</Label>
                    <Input placeholder="XXX-XX-XXXX" className="h-12 transition-all focus:ring-2 focus:ring-foreground/10" data-testid="input-child-ssn" />
                    <p className="text-xs text-muted-foreground flex items-center gap-1.5">
                      <Lock className="h-3 w-3" /> Encrypted. Required by law.
                    </p>
                  </motion.div>
                  <motion.div 
                    className="space-y-2"
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.2 }}
                  >
                    <Label className="text-sm">Your relationship</Label>
                    <select className="w-full h-12 px-3 rounded-md border bg-background text-sm transition-all focus:ring-2 focus:ring-foreground/10" data-testid="select-relationship">
                      <option>Parent</option>
                      <option>Legal guardian</option>
                      <option>Grandparent</option>
                    </select>
                  </motion.div>
                </CardContent>
              </Card>
            </motion.div>
          )}

          {/* Identity */}
          {((isPersonal && step === 0) || (!isPersonal && step === 1)) && (
            <motion.div 
              key="identity" 
              initial={{ opacity: 0, x: 20 }} 
              animate={{ opacity: 1, x: 0 }} 
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.3 }}
            >
              <h1 className="text-xl font-semibold tracking-tight mb-2">Your identity</h1>
              <p className="text-muted-foreground text-sm mb-8">Required by SEC regulations.</p>
              
              <Card className="border">
                <CardContent className="p-6 space-y-5">
                  <motion.div 
                    className="p-3 rounded-md bg-foreground/[0.03] border text-sm"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.1 }}
                  >
                    <p className="text-muted-foreground text-xs">Email</p>
                    <p className="font-medium">{email}</p>
                  </motion.div>
                  <motion.div 
                    className="space-y-2"
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.15 }}
                  >
                    <Label className="text-sm">Legal name</Label>
                    <div className="grid grid-cols-2 gap-3">
                      <Input placeholder="First" className="h-12 transition-all focus:ring-2 focus:ring-foreground/10" data-testid="input-first-name" />
                      <Input placeholder="Last" className="h-12 transition-all focus:ring-2 focus:ring-foreground/10" data-testid="input-last-name" />
                    </div>
                  </motion.div>
                  <motion.div 
                    className="space-y-2"
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.2 }}
                  >
                    <Label className="text-sm">Date of birth</Label>
                    <Input type="date" className="h-12 transition-all focus:ring-2 focus:ring-foreground/10" data-testid="input-dob" />
                  </motion.div>
                  <motion.div 
                    className="space-y-2"
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.25 }}
                  >
                    <Label className="text-sm">Social Security Number</Label>
                    <Input placeholder="XXX-XX-XXXX" className="h-12 transition-all focus:ring-2 focus:ring-foreground/10" data-testid="input-ssn" />
                  </motion.div>
                  <motion.div 
                    className="space-y-2"
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.3 }}
                  >
                    <Label className="text-sm">Address</Label>
                    <Input placeholder="Street" className="h-12 transition-all focus:ring-2 focus:ring-foreground/10" data-testid="input-address" />
                    <div className="grid grid-cols-3 gap-2">
                      <Input placeholder="City" className="h-12 transition-all focus:ring-2 focus:ring-foreground/10" data-testid="input-city" />
                      <Input placeholder="State" className="h-12 transition-all focus:ring-2 focus:ring-foreground/10" data-testid="input-state" />
                      <Input placeholder="ZIP" className="h-12 transition-all focus:ring-2 focus:ring-foreground/10" data-testid="input-zip" />
                    </div>
                  </motion.div>
                </CardContent>
              </Card>
            </motion.div>
          )}

          {/* Review */}
          {step === totalSteps - 1 && (
            <motion.div 
              key="review" 
              initial={{ opacity: 0, x: 20 }} 
              animate={{ opacity: 1, x: 0 }} 
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.3 }}
            >
              <h1 className="text-xl font-semibold tracking-tight mb-2">Ready to open</h1>
              <p className="text-muted-foreground text-sm mb-8">Review and confirm.</p>
              
              <Card className="border">
                <CardContent className="p-6 space-y-4">
                  {[
                    { label: "Account type", value: isPersonal ? "Personal brokerage" : "Custodial (UTMA)" },
                    ...(!isPersonal ? [{ label: "Beneficiary", value: profileName }] : []),
                    { label: "Clearing & custody", value: "Apex Clearing Corporation", sub: "SIPC protected up to $500,000" },
                  ].map((item, i) => (
                    <motion.div 
                      key={i}
                      className="p-4 rounded-md bg-foreground/[0.03] border"
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: i * 0.1 }}
                    >
                      <p className="text-xs text-muted-foreground">{item.label}</p>
                      <p className="font-medium">{item.value}</p>
                      {item.sub && <p className="text-xs text-muted-foreground mt-0.5">{item.sub}</p>}
                    </motion.div>
                  ))}
                </CardContent>
              </Card>

              <motion.p 
                className="text-xs text-muted-foreground mt-6"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.3 }}
              >
                By continuing, you agree to the Apex Brokerage Agreement{!isPersonal && ", UTMA Custodial Disclosure"}, and Everleaf Terms of Service.
              </motion.p>
            </motion.div>
          )}
        </AnimatePresence>

        <motion.div 
          className="flex gap-3 mt-8"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
        >
          {step > 0 && (
            <motion.div whileHover={{ scale: 1.01 }} whileTap={{ scale: 0.99 }} className="flex-1">
              <Button variant="outline" onClick={() => setStep(step - 1)} className="w-full h-12" data-testid="button-back">
                <ArrowLeft className="mr-2 h-4 w-4" /> Back
              </Button>
            </motion.div>
          )}
          <motion.div whileHover={{ scale: 1.01 }} whileTap={{ scale: 0.99 }} className="flex-1">
            <Button onClick={handleNext} className="w-full h-12" disabled={isSubmitting} data-testid="button-next">
              {isSubmitting ? (
                <motion.div 
                  className="flex items-center gap-2"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                >
                  <motion.div 
                    animate={{ rotate: 360 }}
                    transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                    className="h-4 w-4 border-2 border-background/30 border-t-background rounded-full"
                  />
                  Opening...
                </motion.div>
              ) : step === totalSteps - 1 ? (
                <>Open account <Check className="ml-2 h-4 w-4" /></>
              ) : (
                <>Continue <ArrowRight className="ml-2 h-4 w-4" /></>
              )}
            </Button>
          </motion.div>
        </motion.div>

        <motion.div 
          className="flex items-center justify-center gap-4 text-xs text-muted-foreground mt-8"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.4 }}
        >
          <span className="flex items-center gap-1.5"><Shield className="h-3.5 w-3.5" /> SIPC insured</span>
          <span>•</span>
          <span className="flex items-center gap-1.5"><Lock className="h-3.5 w-3.5" /> 256-bit encryption</span>
        </motion.div>
      </main>
    </div>
  );
}
