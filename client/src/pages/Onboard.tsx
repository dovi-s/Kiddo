import { useEffect } from "react";
import { useLocation, useSearch } from "wouter";
import { motion } from "framer-motion";
import { Loader2, Check } from "lucide-react";
import { Logo } from "@/components/ui/logo";

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
      <header className="sticky top-0 z-40 bg-background/80 backdrop-blur-sm border-b border-border">
        <div className="max-w-lg mx-auto px-4 h-14 flex items-center justify-center">
          <Logo size="md" className="text-primary" />
        </div>
      </header>

      <main className="flex-1 flex items-center justify-center px-4">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center max-w-sm"
        >
          <motion.div
            initial={{ scale: 0.8 }}
            animate={{ scale: 1 }}
            transition={{ duration: 0.2 }}
            className="w-16 h-16 rounded-full bg-success/10 flex items-center justify-center mx-auto mb-6"
          >
            <Check size={32} className="text-success" />
          </motion.div>
          
          <h1 className="text-2xl font-semibold text-foreground mb-2">
            {isPersonal ? "Your fund is ready" : childNames.length > 1 ? `${childNames.length} funds created` : `${childNames[0]}'s fund is ready`}
          </h1>
          
          <p className="text-muted-foreground mb-8">
            Setting up your dashboard...
          </p>

          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
            className="mx-auto w-6 h-6"
          >
            <Loader2 size={24} className="text-muted-foreground" />
          </motion.div>

          <div className="mt-8 p-4 rounded-xl bg-muted text-left">
            <p className="text-sm text-muted-foreground">
              <span className="font-medium text-foreground">Next step:</span> Activate investing to start receiving gifts that become real investments.
            </p>
          </div>
        </motion.div>
      </main>
    </div>
  );
}
