import { Nav } from "@/components/layout/Nav";
import { Footer } from "@/components/layout/Footer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from "@/components/ui/form";
import { useLocation } from "wouter";
import { Loader2, User, Baby, TrendingUp, Sprout, ArrowRight, ShieldCheck, Check } from "lucide-react";
import { useState } from "react";

const formSchema = z.object({
  profileName: z.string().min(2, "Name is required"),
  profileType: z.enum(["child", "personal"]),
  fundType: z.enum(["future", "seed"]),
  guardianEmail: z.string().email("Valid email required"),
});

export default function Create() {
  const [, setLocation] = useLocation();
  const [isLoading, setIsLoading] = useState(false);

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: { profileName: "", profileType: "child", fundType: "future", guardianEmail: "" },
  });

  function onSubmit(values: z.infer<typeof formSchema>) {
    setIsLoading(true);
    setTimeout(() => { setIsLoading(false); setLocation("/dashboard"); }, 1500);
  }

  const profileType = form.watch("profileType");
  const fundType = form.watch("fundType");

  return (
    <div className="min-h-screen bg-muted/20 font-sans">
      <Nav />
      
      <main className="container mx-auto px-4 py-16 flex justify-center">
        <Card className="w-full max-w-lg shadow-xl border-none">
          <CardHeader className="text-center pb-8 pt-10">
            <CardTitle className="font-serif text-3xl font-semibold text-foreground">Create a Profile</CardTitle>
            <CardDescription className="text-base mt-2">Set up a fund for yourself or a child. Takes 2 minutes.</CardDescription>
          </CardHeader>
          <CardContent>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
                <FormField
                  control={form.control}
                  name="profileType"
                  render={({ field }) => (
                    <FormItem className="space-y-3">
                      <FormLabel className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Who is this for?</FormLabel>
                      <div className="grid grid-cols-2 gap-4">
                        <button
                          type="button"
                          onClick={() => field.onChange("child")}
                          className={`flex flex-col items-center justify-center p-6 rounded-xl border-2 cursor-pointer transition-all ${
                            profileType === "child" 
                              ? "border-primary bg-primary/5" 
                              : "border-border hover:border-primary/40"
                          }`}
                          data-testid="button-profile-child"
                        >
                          <Baby className="h-8 w-8 mb-2 text-primary" />
                          <span className="font-semibold text-foreground">A Child</span>
                          <span className="text-xs text-muted-foreground">Custodial account</span>
                          {profileType === "child" && <Check className="h-4 w-4 text-primary mt-2" />}
                        </button>
                        <button
                          type="button"
                          onClick={() => field.onChange("personal")}
                          className={`flex flex-col items-center justify-center p-6 rounded-xl border-2 cursor-pointer transition-all ${
                            profileType === "personal" 
                              ? "border-primary bg-primary/5" 
                              : "border-border hover:border-primary/40"
                          }`}
                          data-testid="button-profile-personal"
                        >
                          <User className="h-8 w-8 mb-2 text-primary" />
                          <span className="font-semibold text-foreground">Myself</span>
                          <span className="text-xs text-muted-foreground">Personal account</span>
                          {profileType === "personal" && <Check className="h-4 w-4 text-primary mt-2" />}
                        </button>
                      </div>
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="profileName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{profileType === "child" ? "Child's Name" : "Your Name"}</FormLabel>
                      <FormControl><Input placeholder="First name" {...field} className="h-12" data-testid="input-profile-name" /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="guardianEmail"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{profileType === "child" ? "Guardian Email" : "Your Email"}</FormLabel>
                      <FormControl><Input type="email" placeholder="you@example.com" {...field} className="h-12" data-testid="input-email" /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="fundType"
                  render={({ field }) => (
                    <FormItem className="space-y-3">
                      <FormLabel className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Default Fund</FormLabel>
                      <div className="space-y-3">
                        <button
                          type="button"
                          onClick={() => field.onChange("future")}
                          className={`w-full flex items-start gap-4 p-4 rounded-xl border-2 cursor-pointer transition-all text-left ${
                            fundType === "future" 
                              ? "border-primary bg-primary/5" 
                              : "border-border hover:border-primary/40"
                          }`}
                          data-testid="button-fund-future"
                        >
                          <div className={`h-10 w-10 rounded-xl flex items-center justify-center shrink-0 ${
                            fundType === "future" ? "bg-primary text-primary-foreground" : "bg-muted"
                          }`}>
                            <TrendingUp className="h-5 w-5" />
                          </div>
                          <div className="space-y-1 flex-grow">
                            <p className="font-semibold flex items-center gap-2 text-foreground">
                              Future Fund
                              <span className="text-[10px] font-bold uppercase text-primary bg-primary/10 px-2 py-0.5 rounded-full">Recommended</span>
                            </p>
                            <p className="text-sm text-muted-foreground">Gifts auto-invest into a diversified basket.</p>
                          </div>
                          {fundType === "future" && <Check className="h-5 w-5 text-primary shrink-0" />}
                        </button>
                        <button
                          type="button"
                          onClick={() => field.onChange("seed")}
                          className={`w-full flex items-start gap-4 p-4 rounded-xl border-2 cursor-pointer transition-all text-left ${
                            fundType === "seed" 
                              ? "border-primary bg-primary/5" 
                              : "border-border hover:border-primary/40"
                          }`}
                          data-testid="button-fund-seed"
                        >
                          <div className={`h-10 w-10 rounded-xl flex items-center justify-center shrink-0 ${
                            fundType === "seed" ? "bg-primary text-primary-foreground" : "bg-muted"
                          }`}>
                            <Sprout className="h-5 w-5" />
                          </div>
                          <div className="space-y-1 flex-grow">
                            <p className="font-semibold text-foreground">Seed</p>
                            <p className="text-sm text-muted-foreground">Gifts are held. You decide where to invest later.</p>
                          </div>
                          {fundType === "seed" && <Check className="h-5 w-5 text-primary shrink-0" />}
                        </button>
                      </div>
                    </FormItem>
                  )}
                />

                <div className="flex items-center gap-3 p-4 rounded-xl bg-primary/5 border border-primary/10">
                  <ShieldCheck className="h-5 w-5 text-primary shrink-0" />
                  <p className="text-xs text-muted-foreground">Accounts are SIPC-insured and held by our brokerage partner. Your data is encrypted.</p>
                </div>

                <Button type="submit" className="w-full h-14 text-lg font-semibold" disabled={isLoading} data-testid="button-create-profile">
                  {isLoading ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : null}
                  {isLoading ? "Setting up..." : "Create Profile"} {!isLoading && <ArrowRight className="ml-2 h-5 w-5" />}
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
