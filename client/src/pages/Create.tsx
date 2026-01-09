import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useLocation, Link } from "wouter";
import { Loader2, ArrowRight, Shield, Lock } from "lucide-react";
import { useState } from "react";
import { motion } from "framer-motion";

const formSchema = z.object({
  profileName: z.string().min(2, "Name is required"),
  profileType: z.enum(["child", "personal"]),
  email: z.string().email("Valid email required"),
});

export default function Create() {
  const [, setLocation] = useLocation();
  const [isLoading, setIsLoading] = useState(false);

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: { profileName: "", profileType: "child", email: "" },
  });

  function onSubmit() {
    setIsLoading(true);
    const type = form.getValues("profileType");
    const name = encodeURIComponent(form.getValues("profileName"));
    const email = encodeURIComponent(form.getValues("email"));
    setTimeout(() => { 
      setIsLoading(false); 
      setLocation(`/dashboard?type=${type}&name=${name}&email=${email}`); 
    }, 1200);
  }

  const profileType = form.watch("profileType");

  return (
    <div className="min-h-screen bg-stone-50">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-stone-50/95 backdrop-blur-sm border-b border-stone-200">
        <div className="max-w-lg mx-auto px-6 h-14 flex items-center justify-between">
          <Link href="/">
            <span className="text-sm text-stone-500 hover:text-stone-900">← Back</span>
          </Link>
          <span className="text-sm font-medium tracking-tight text-stone-900">Create a fund</span>
          <span className="w-12"></span>
        </div>
      </header>
      
      <main className="container mx-auto px-4 py-12 max-w-md">
        <motion.div 
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="text-center mb-10"
        >
          <h1 className="text-3xl font-semibold text-foreground tracking-tight mb-3">Create a fund</h1>
          <p className="text-muted-foreground text-lg">Free to start. Takes two minutes.</p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1, duration: 0.4 }}
        >
          <Card className="border overflow-hidden">
            <CardContent className="p-6">
              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                  
                  <div className="space-y-3">
                    <p className="text-sm text-muted-foreground">Who is this for?</p>
                    <div className="grid grid-cols-2 gap-3">
                      {[
                        { value: "child", label: "For a child", desc: "UGMA/UTMA custodial" },
                        { value: "personal", label: "For myself", desc: "Individual brokerage" },
                      ].map((opt) => (
                        <motion.button
                          key={opt.value}
                          type="button"
                          whileHover={{ scale: 1.02 }}
                          whileTap={{ scale: 0.98 }}
                          onClick={() => form.setValue("profileType", opt.value as any)}
                          className={`p-5 rounded-lg border-2 text-center transition-all ${
                            profileType === opt.value 
                              ? "border-foreground bg-foreground/[0.03]" 
                              : "border-border hover:border-foreground/30"
                          }`}
                          data-testid={`button-profile-${opt.value}`}
                        >
                          <span className="font-medium text-sm block">{opt.label}</span>
                          <span className="text-xs text-muted-foreground mt-1 block">{opt.desc}</span>
                        </motion.button>
                      ))}
                    </div>
                  </div>

                  <FormField
                    control={form.control}
                    name="profileName"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-sm">{profileType === "child" ? "Child's name" : "Your name"}</FormLabel>
                        <FormControl>
                          <Input 
                            placeholder="First name" 
                            {...field} 
                            className="h-12 transition-all focus:ring-2 focus:ring-foreground/10" 
                            data-testid="input-name" 
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="email"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-sm">{profileType === "child" ? "Your email" : "Email"}</FormLabel>
                        <FormControl>
                          <Input 
                            type="email" 
                            placeholder="you@example.com" 
                            {...field} 
                            className="h-12 transition-all focus:ring-2 focus:ring-foreground/10" 
                            data-testid="input-email" 
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <motion.div whileHover={{ scale: 1.01 }} whileTap={{ scale: 0.99 }}>
                    <Button type="submit" className="w-full h-12 font-medium" disabled={isLoading} data-testid="button-create">
                      {isLoading ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Creating...
                        </>
                      ) : (
                        <>
                          Create fund
                          <ArrowRight className="ml-2 h-4 w-4" />
                        </>
                      )}
                    </Button>
                  </motion.div>
                </form>
              </Form>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3 }}
          className="mt-8 space-y-3"
        >
          <div className="flex items-center justify-center gap-6 text-xs text-muted-foreground">
            <span className="flex items-center gap-1.5">
              <Shield className="h-3.5 w-3.5" />
              SIPC protected
            </span>
            <span className="flex items-center gap-1.5">
              <Lock className="h-3.5 w-3.5" />
              Bank-grade security
            </span>
          </div>
        </motion.div>
      </main>
    </div>
  );
}
