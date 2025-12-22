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
import { Loader2, ShieldCheck, Landmark, Clock, CheckCircle2 } from "lucide-react";
import { useState } from "react";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Badge } from "@/components/ui/badge";

const formSchema = z.object({
  childName: z.string().min(2, "Child's name is required"),
  eventName: z.string().min(2, "Event name is required (e.g. Leo's Bar Mitzvah)"),
  eventDate: z.string().min(1, "Date is required"),
  parentEmail: z.string().email("Invalid email address"),
  accountType: z.enum(["new", "existing", "later"]),
});

export default function Create() {
  const [, setLocation] = useLocation();
  const [isLoading, setIsLoading] = useState(false);

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      childName: "",
      eventName: "",
      eventDate: "",
      parentEmail: "",
      accountType: "new",
    },
  });

  function onSubmit(values: z.infer<typeof formSchema>) {
    setIsLoading(true);
    setTimeout(() => {
      setIsLoading(false);
      setLocation("/registry");
    }, 1500);
  }

  return (
    <div className="min-h-screen bg-muted/10 font-sans">
      <Nav />
      
      <main className="container mx-auto px-4 py-16 flex justify-center">
        <Card className="w-full max-w-2xl shadow-xl border-none">
          <CardHeader className="text-center space-y-4 pb-8">
            <CardTitle className="font-serif text-3xl font-bold text-primary">Start a Gift Fund</CardTitle>
            <CardDescription className="text-lg">
              Set up a registry for your child's future milestones.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
                <div className="grid gap-6 md:grid-cols-2">
                  <FormField
                    control={form.control}
                    name="childName"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Who is this for?</FormLabel>
                        <FormControl>
                          <Input placeholder="Child's Name" {...field} className="h-11" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="eventName"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Event Name</FormLabel>
                        <FormControl>
                          <Input placeholder="e.g. Leo's Bar Mitzvah" {...field} className="h-11" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="eventDate"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Event Date</FormLabel>
                        <FormControl>
                          <Input type="date" {...field} className="h-11" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="parentEmail"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Parent's Email</FormLabel>
                        <FormControl>
                          <Input type="email" placeholder="you@example.com" {...field} className="h-11" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <div className="space-y-4 pt-4 border-t">
                  <Label className="text-base font-bold">Where should gifts be invested?</Label>
                  <FormField
                    control={form.control}
                    name="accountType"
                    render={({ field }) => (
                      <FormItem className="space-y-3">
                        <FormControl>
                          <RadioGroup
                            onValueChange={field.onChange}
                            defaultValue={field.value}
                            className="grid gap-4"
                          >
                            <FormItem className="flex items-start space-x-3 space-y-0 rounded-xl border p-4 hover:bg-muted/50 cursor-pointer transition-colors relative">
                              <FormControl>
                                <RadioGroupItem value="new" className="mt-1" />
                              </FormControl>
                              <div className="space-y-1">
                                <FormLabel className="font-bold flex items-center gap-2">
                                  Create a new Grow Account (Recommended)
                                  <Badge variant="secondary" className="text-[10px] bg-secondary/20 text-secondary-foreground border-none">Fastest</Badge>
                                </FormLabel>
                                <FormDescription>
                                  We'll open a custodial UGMA/UTMA account for {form.watch("childName") || 'your child'}. Irrevocable gifts, predictable, and instant.
                                </FormDescription>
                              </div>
                              <CheckCircle2 className="absolute top-4 right-4 h-5 w-5 text-secondary opacity-0 group-data-[state=checked]:opacity-100" />
                            </FormItem>

                            <FormItem className="flex items-start space-x-3 space-y-0 rounded-xl border p-4 hover:bg-muted/50 cursor-pointer transition-colors">
                              <FormControl>
                                <RadioGroupItem value="existing" className="mt-1" />
                              </FormControl>
                              <div className="space-y-1">
                                <FormLabel className="font-bold">Connect existing brokerage</FormLabel>
                                <FormDescription>
                                  Already have an account? Connect it via ACATS transfer or direct instructions. Advanced option.
                                </FormDescription>
                              </div>
                            </FormItem>

                            <FormItem className="flex items-start space-x-3 space-y-0 rounded-xl border p-4 hover:bg-muted/50 cursor-pointer transition-colors">
                              <FormControl>
                                <RadioGroupItem value="later" className="mt-1" />
                              </FormControl>
                              <div className="space-y-1">
                                <FormLabel className="font-bold">Decide later</FormLabel>
                                <FormDescription>
                                  Gifts accrue as Seed Capital. You can choose where to invest once the event is over.
                                </FormDescription>
                              </div>
                            </FormItem>
                          </RadioGroup>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <div className="grid grid-cols-3 gap-4 py-4 px-2 bg-primary/5 rounded-xl border border-primary/10">
                  <div className="flex flex-col items-center text-center gap-2">
                    <ShieldCheck className="h-5 w-5 text-primary" />
                    <span className="text-[10px] font-bold uppercase text-muted-foreground">SIPC Insured</span>
                  </div>
                  <div className="flex flex-col items-center text-center gap-2">
                    <Landmark className="h-5 w-5 text-primary" />
                    <span className="text-[10px] font-bold uppercase text-muted-foreground">Bank Grade Security</span>
                  </div>
                  <div className="flex flex-col items-center text-center gap-2">
                    <Clock className="h-5 w-5 text-primary" />
                    <span className="text-[10px] font-bold uppercase text-muted-foreground">Instant Setup</span>
                  </div>
                </div>

                <Button type="submit" className="w-full h-12 text-lg font-bold shadow-lg shadow-primary/10" disabled={isLoading}>
                  {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                  {isLoading ? "Finalizing Registry..." : "Start Building Wealth"}
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
