import { Nav } from "@/components/layout/Nav";
import { Footer } from "@/components/layout/Footer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useLocation } from "wouter";
import { Loader2, User, Baby, TrendingUp, Sprout, ArrowRight, Shield, Check } from "lucide-react";
import { useState } from "react";

const formSchema = z.object({
  profileName: z.string().min(2, "Name is required"),
  profileType: z.enum(["child", "personal"]),
  fundType: z.enum(["future", "seed"]),
  email: z.string().email("Valid email required"),
});

export default function Create() {
  const [, setLocation] = useLocation();
  const [isLoading, setIsLoading] = useState(false);

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: { profileName: "", profileType: "child", fundType: "future", email: "" },
  });

  function onSubmit() {
    setIsLoading(true);
    const type = form.getValues("profileType");
    const name = encodeURIComponent(form.getValues("profileName"));
    const email = encodeURIComponent(form.getValues("email"));
    setTimeout(() => { setIsLoading(false); setLocation(`/dashboard?type=${type}&name=${name}&email=${email}`); }, 1500);
  }

  const profileType = form.watch("profileType");
  const fundType = form.watch("fundType");

  return (
    <div className="min-h-screen bg-background font-sans">
      <Nav />
      
      <main className="container mx-auto px-4 py-12 max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-semibold text-foreground mb-2">Create a fund</h1>
          <p className="text-muted-foreground">Set up in 2 minutes. Free to create.</p>
        </div>

        <Card className="border-none shadow-sm">
          <CardContent className="p-6">
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                
                {/* Profile type */}
                <div className="space-y-3">
                  <p className="text-sm font-medium text-muted-foreground">Who is this for?</p>
                  <div className="grid grid-cols-2 gap-3">
                    {[
                      { value: "child", label: "A child", desc: "Custodial", icon: Baby },
                      { value: "personal", label: "Myself", desc: "Personal", icon: User },
                    ].map((opt) => (
                      <button
                        key={opt.value}
                        type="button"
                        onClick={() => form.setValue("profileType", opt.value as any)}
                        className={`flex flex-col items-center p-5 rounded-xl border-2 transition-all ${
                          profileType === opt.value 
                            ? "border-primary bg-primary/5" 
                            : "border-border hover:border-primary/40"
                        }`}
                        data-testid={`button-profile-${opt.value}`}
                      >
                        <opt.icon className={`h-6 w-6 mb-2 ${profileType === opt.value ? "text-primary" : "text-muted-foreground"}`} />
                        <span className="font-medium text-foreground text-sm">{opt.label}</span>
                        <span className="text-xs text-muted-foreground">{opt.desc}</span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Name */}
                <FormField
                  control={form.control}
                  name="profileName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-sm font-medium">{profileType === "child" ? "Child's name" : "Your name"}</FormLabel>
                      <FormControl><Input placeholder="First name" {...field} className="h-11" data-testid="input-name" /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* Email */}
                <FormField
                  control={form.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-sm font-medium">{profileType === "child" ? "Your email" : "Email"}</FormLabel>
                      <FormControl><Input type="email" placeholder="you@example.com" {...field} className="h-11" data-testid="input-email" /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* Fund type */}
                <div className="space-y-3">
                  <p className="text-sm font-medium text-muted-foreground">How should contributions be handled?</p>
                  <div className="space-y-2">
                    {[
                      { value: "future", label: "Future Fund", desc: "Auto-invest into a diversified basket", icon: TrendingUp, recommended: true },
                      { value: "seed", label: "Seed", desc: "Hold until you decide where to invest", icon: Sprout },
                    ].map((opt) => (
                      <button
                        key={opt.value}
                        type="button"
                        onClick={() => form.setValue("fundType", opt.value as any)}
                        className={`w-full flex items-center gap-4 p-4 rounded-xl border-2 transition-all text-left ${
                          fundType === opt.value 
                            ? "border-primary bg-primary/5" 
                            : "border-border hover:border-primary/40"
                        }`}
                        data-testid={`button-fund-${opt.value}`}
                      >
                        <div className={`h-10 w-10 rounded-lg flex items-center justify-center shrink-0 ${
                          fundType === opt.value ? "bg-primary text-primary-foreground" : "bg-muted"
                        }`}>
                          <opt.icon className="h-5 w-5" />
                        </div>
                        <div className="flex-grow">
                          <p className="font-medium text-foreground text-sm flex items-center gap-2">
                            {opt.label}
                            {opt.recommended && <span className="text-[10px] font-medium text-primary bg-primary/10 px-2 py-0.5 rounded-full">Recommended</span>}
                          </p>
                          <p className="text-xs text-muted-foreground">{opt.desc}</p>
                        </div>
                        {fundType === opt.value && <Check className="h-4 w-4 text-primary shrink-0" />}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Trust */}
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Shield className="h-4 w-4" />
                  <span>SIPC-insured accounts. Bank-grade security.</span>
                </div>

                <Button type="submit" className="w-full h-12 font-medium" disabled={isLoading} data-testid="button-create">
                  {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                  {isLoading ? "Setting up..." : "Create fund"} {!isLoading && <ArrowRight className="ml-2 h-4 w-4" />}
                </Button>
              </form>
            </Form>
          </CardContent>
        </Card>
      </main>
      <Footer />
    </div>
  );
}
