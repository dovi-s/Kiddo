import { Nav } from "@/components/layout/Nav";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { LogOut, Shield, Lock } from "lucide-react";
import { useSearch } from "wouter";
import { motion } from "framer-motion";

function FadeIn({ children, delay = 0 }: { children: React.ReactNode; delay?: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.4 }}
    >
      {children}
    </motion.div>
  );
}

export default function Settings() {
  const search = useSearch();
  const params = new URLSearchParams(search);
  const accountType = params.get("type") || "child";
  const profileName = decodeURIComponent(params.get("name") || "Ari");
  const isPersonal = accountType === "personal";

  return (
    <div className="min-h-screen bg-background">
      <Nav />
      
      <main className="container mx-auto px-4 py-10 max-w-lg">
        <motion.h1 
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-2xl font-semibold text-foreground tracking-tight mb-10"
        >
          Settings
        </motion.h1>

        <div className="space-y-8">
          {/* Brokerage */}
          <FadeIn delay={0.1}>
            <section>
              <h2 className="font-semibold mb-4 tracking-tight">Investment account</h2>
              <Card className="border overflow-hidden">
                <CardContent className="p-5 space-y-4">
                  <motion.div 
                    className="flex items-center justify-between"
                    whileHover={{ x: 2 }}
                    transition={{ duration: 0.2 }}
                  >
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 rounded-lg bg-foreground/5 flex items-center justify-center">
                        <Shield className="h-5 w-5 text-muted-foreground" />
                      </div>
                      <div>
                        <p className="text-sm font-medium">Account active</p>
                        <p className="text-xs text-muted-foreground">Apex Clearing · SIPC protected</p>
                      </div>
                    </div>
                    <span className="text-xs border px-2 py-1 rounded">Active</span>
                  </motion.div>
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    {[
                      { label: "Type", value: isPersonal ? "Individual" : "Custodial" },
                      { label: "Account", value: "••••4827" },
                    ].map((item, i) => (
                      <motion.div 
                        key={i}
                        className="p-3 rounded-md bg-foreground/[0.03] border"
                        whileHover={{ scale: 1.02 }}
                        transition={{ duration: 0.2 }}
                      >
                        <p className="text-xs text-muted-foreground">{item.label}</p>
                        <p className="font-medium">{item.value}</p>
                      </motion.div>
                    ))}
                  </div>
                  <div className="flex gap-2">
                    <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }} className="flex-1">
                      <Button variant="outline" size="sm" className="w-full">Statements</Button>
                    </motion.div>
                    <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }} className="flex-1">
                      <Button variant="outline" size="sm" className="w-full">Tax docs</Button>
                    </motion.div>
                  </div>
                </CardContent>
              </Card>
            </section>
          </FadeIn>

          {/* Account */}
          <FadeIn delay={0.2}>
            <section>
              <h2 className="font-semibold mb-4 tracking-tight">Account</h2>
              <Card className="border">
                <CardContent className="p-5 space-y-4">
                  <div className="space-y-2">
                    <Label className="text-sm">Email</Label>
                    <Input value="you@example.com" disabled className="bg-foreground/[0.02]" />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-sm">Name</Label>
                    <Input defaultValue="Sarah Miller" className="transition-all focus:ring-2 focus:ring-foreground/10" />
                  </div>
                  <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
                    <Button variant="outline" size="sm">Update</Button>
                  </motion.div>
                </CardContent>
              </Card>
            </section>
          </FadeIn>

          {/* Notifications */}
          <FadeIn delay={0.3}>
            <section>
              <h2 className="font-semibold mb-4 tracking-tight">Notifications</h2>
              <Card className="border">
                <CardContent className="p-5 space-y-4">
                  {[
                    { label: "New contributions", defaultChecked: true },
                    { label: "Weekly summary", defaultChecked: true },
                  ].map((item, i) => (
                    <motion.div 
                      key={i}
                      className="flex items-center justify-between py-1"
                      whileHover={{ x: 2 }}
                      transition={{ duration: 0.2 }}
                    >
                      <p className="text-sm">{item.label}</p>
                      <Switch defaultChecked={item.defaultChecked} />
                    </motion.div>
                  ))}
                </CardContent>
              </Card>
            </section>
          </FadeIn>

          {/* Plan */}
          <FadeIn delay={0.4}>
            <section>
              <h2 className="font-semibold mb-4 tracking-tight">Plan</h2>
              <Card className="border">
                <CardContent className="p-5 space-y-4">
                  <motion.div 
                    className="flex items-center justify-between"
                    whileHover={{ x: 2 }}
                    transition={{ duration: 0.2 }}
                  >
                    <div>
                      <p className="text-sm font-medium">Free</p>
                      <p className="text-xs text-muted-foreground">Guests pay ~3% at checkout</p>
                    </div>
                    <span className="text-xs border px-2 py-1 rounded">Current</span>
                  </motion.div>
                  {[
                    { name: "Plus", price: "$99/event", desc: "Guests pay $0. You cover processing." },
                    { name: "Family", price: "$199/year", desc: "Up to 10 events. Household dashboard." },
                  ].map((plan, i) => (
                    <motion.div 
                      key={i}
                      className="p-4 rounded-md border hover:border-foreground/30 transition-colors cursor-pointer"
                      whileHover={{ x: 4, backgroundColor: "hsl(var(--foreground) / 0.02)" }}
                      transition={{ duration: 0.2 }}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <p className="text-sm font-medium">{plan.name}</p>
                        <p className="text-sm font-medium">{plan.price}</p>
                      </div>
                      <p className="text-xs text-muted-foreground">{plan.desc}</p>
                    </motion.div>
                  ))}
                  <motion.div whileHover={{ scale: 1.01 }} whileTap={{ scale: 0.99 }}>
                    <Button className="w-full">Upgrade</Button>
                  </motion.div>
                </CardContent>
              </Card>
            </section>
          </FadeIn>

          {/* Sign out */}
          <FadeIn delay={0.5}>
            <Card className="border">
              <CardContent className="p-5">
                <motion.div whileHover={{ scale: 1.01 }} whileTap={{ scale: 0.99 }}>
                  <Button variant="outline" className="w-full justify-start">
                    <LogOut className="mr-2 h-4 w-4" /> Sign out
                  </Button>
                </motion.div>
              </CardContent>
            </Card>
          </FadeIn>

          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.6 }}
            className="flex items-center justify-center gap-4 text-xs text-muted-foreground pt-4"
          >
            <span className="flex items-center gap-1.5"><Shield className="h-3.5 w-3.5" /> SIPC insured</span>
            <span>•</span>
            <span className="flex items-center gap-1.5"><Lock className="h-3.5 w-3.5" /> 256-bit encryption</span>
          </motion.div>
        </div>
      </main>
    </div>
  );
}
