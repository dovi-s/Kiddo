import { useEffect } from "react";
import { useLocation, useSearch } from "wouter";
import { motion } from "framer-motion";
import { Loader2, Check } from "lucide-react";
import { Logo } from "@/components/ui/logo";
import { SetupProgressNudge, TrustMicroStrip } from "@/components/ui/ux-foundations";
const MOTION_DUR = 0.2;
const PAGE_MAX = "max-w-lg md:max-w-2xl mx-auto px-4";

export default function Onboard() {
  const search = useSearch();
  const [, setLocation] = useLocation();
  const params = new URLSearchParams(search);
  
  const hasValidParams = params.get("email") && params.get("name");
  
  useEffect(() => {
    if (!hasValidParams) {
      setLocation("/get-started");
      return;
    }
    
    const accountType = params.get("type") || "child";
    const childrenParam = params.get("children") || params.get("name") || "";
    const firstName = childrenParam.split(",")[0] || "Fund";
    
    const timer = setTimeout(() => {
      setLocation(`/dashboard?type=${accountType}&name=${encodeURIComponent(firstName)}&children=${encodeURIComponent(childrenParam)}&new=true`);
    }, 2000);
    
    return () => clearTimeout(timer);
  }, [hasValidParams, setLocation, params]);

  if (!hasValidParams) {
    return null;
  }

  const childrenParam = params.get("children") || params.get("name") || "";
  const childNames = childrenParam.split(",").map(n => n.trim()).filter(Boolean);
  const isPersonal = params.get("type") === "personal";

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <header className="sticky top-0 z-40 gemini-glass-nav">
        <div className={`${PAGE_MAX} h-14 flex items-center justify-center`}>
          <Logo size="md" className="text-primary" />
        </div>
      </header>

      <main className="flex-1 flex items-center justify-center px-4">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: MOTION_DUR }}
          className="text-center max-w-sm"
        >
          <motion.div
            initial={{ scale: 0.8 }}
            animate={{ scale: 1 }}
            transition={{ duration: MOTION_DUR }}
            className="w-20 h-20 rounded-full bg-success/10 flex items-center justify-center mx-auto mb-8 shadow-premium"
          >
            <Check size={36} className="text-success" />
          </motion.div>
          
          <h1 className="text-2xl font-semibold text-foreground mb-3 tracking-tight">
            {isPersonal ? "Your fund is ready" : childNames.length > 1 ? `${childNames.length} funds created` : `${childNames[0]}'s fund is ready`}
          </h1>
          
          <p className="text-muted-foreground mb-10 leading-relaxed">
            Setting up your dashboard...
          </p>

          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
            className="mx-auto w-6 h-6"
          >
            <Loader2 size={24} className="text-primary" />
          </motion.div>

          <div className="mt-10 p-5 rounded-2xl bg-card border border-border/50 shadow-premium-sm text-left">
            <p className="text-sm text-muted-foreground leading-relaxed">
              <span className="font-semibold text-foreground">Next step:</span> Activate investing to start receiving gifts that become real investments.
            </p>
          </div>

          <div className="mt-4 text-left">
            <SetupProgressNudge
              title="Account created"
              subtitle="One more quick step to unlock automatic investing on incoming gifts."
              percent={85}
              items={[
                "Fund setup complete",
                "Dashboard ready",
                "Identity verification remaining",
              ]}
            />
          </div>

          <div className="mt-4">
            <TrustMicroStrip />
          </div>
        </motion.div>
      </main>
    </div>
  );
}
