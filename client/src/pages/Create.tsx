import { Nav } from "@/components/layout/Nav";
import { Footer } from "@/components/layout/Footer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from "@/components/ui/form";
import { useLocation } from "wouter";
import { Loader2, User, Baby, TrendingUp, Sprout, ArrowRight, ShieldCheck } from "lucide-react";
import { useState } from "react";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";

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
                      <FormControl>
                        <RadioGroup onValueChange={field.onChange} defaultValue={field.value} className="grid grid-cols-2 gap-4">
                          <FormItem className="flex items-center space-x-3 space-y-0">
                            <FormControl><RadioGroupItem value="child" className="sr-only peer" /></FormControl>
                            <Label className="flex flex-col items-center justify-center w-full p-6 rounded-xl border-2 cursor-pointer peer-data-[state=checked]:border-primary peer-data-[state=checked]:bg-primary/5 hover:border-primary/40 transition-all">
                              <Baby className="h-8 w-8 mb-2 text-primary" />
                              <span className="font-semibold">A Child</span>
                              <span className="text-xs text-muted-foreground">Custodial account</span>
                            </Label>
                          </FormItem>
                          <FormItem className="flex items-center space-x-3 space-y-0">
                            <FormControl><RadioGroupItem value="personal" className="sr-only peer" /></FormControl>
                            <Label className="flex flex-col items-center justify-center w-full p-6 rounded-xl border-2 cursor-pointer peer-data-[state=checked]:border-primary peer-data-[state=checked]:bg-primary/5 hover:border-primary/40 transition-all">
                              <User className="h-8 w-8 mb-2 text-primary" />
                              <span className="font-semibold">Myself</span>
                              <span className="text-xs text-muted-foreground">Personal account</span>
                            </Label>
                          </FormItem>
                        </RadioGroup>
                      </FormControl>
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="profileName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{form.watch("profileType") === "child" ? "Child's Name" : "Your Name"}</FormLabel>
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
                      <FormLabel>{form.watch("profileType") === "child" ? "Guardian Email" : "Your Email"}</FormLabel>
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
                      <FormControl>
                        <RadioGroup onValueChange={field.onChange} defaultValue={field.value} className="space-y-3">
                          <FormItem className="flex items-start space-x-4 space-y-0 rounded-xl border-2 p-4 cursor-pointer data-[state=checked]:border-primary data-[state=checked]:bg-primary/5 hover:border-primary/40 transition-all">
                            <FormControl><RadioGroupItem value="future" className="mt-1" /></FormControl>
                            <div className="space-y-1 flex-grow">
                              <FormLabel className="font-semibold flex items-center gap-2">
                                <TrendingUp className="h-4 w-4 text-primary" /> Future Fund
                                <span className="text-[10px] font-bold uppercase text-primary bg-primary/10 px-2 py-0.5 rounded-full ml-2">Recommended</span>
                              </FormLabel>
                              <FormDescription>Gifts auto-invest into a diversified basket.</FormDescription>
                            </div>
                          </FormItem>
                          <FormItem className="flex items-start space-x-4 space-y-0 rounded-xl border-2 p-4 cursor-pointer data-[state=checked]:border-primary data-[state=checked]:bg-primary/5 hover:border-primary/40 transition-all">
                            <FormControl><RadioGroupItem value="seed" className="mt-1" /></FormControl>
                            <div className="space-y-1 flex-grow">
                              <FormLabel className="font-semibold flex items-center gap-2"><Sprout className="h-4 w-4 text-secondary" /> Seed</FormLabel>
                              <FormDescription>Gifts are held. You decide where to invest later.</FormDescription>
                            </div>
                          </FormItem>
                        </RadioGroup>
                      </FormControl>
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
