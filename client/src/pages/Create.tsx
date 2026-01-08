import { Nav } from "@/components/layout/Nav";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useLocation } from "wouter";
import { Loader2, ArrowRight } from "lucide-react";
import { useState } from "react";

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
    <div className="min-h-screen bg-background">
      <Nav />
      
      <main className="container mx-auto px-4 py-12 max-w-md">
        <div className="text-center mb-10">
          <h1 className="text-2xl font-semibold text-foreground mb-2">Create a fund</h1>
          <p className="text-muted-foreground">Two minutes. Free to start.</p>
        </div>

        <Card className="border">
          <CardContent className="p-6">
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                
                <div className="space-y-3">
                  <p className="text-sm text-muted-foreground">Who is this for?</p>
                  <div className="grid grid-cols-2 gap-3">
                    {[
                      { value: "child", label: "A child" },
                      { value: "personal", label: "Myself" },
                    ].map((opt) => (
                      <button
                        key={opt.value}
                        type="button"
                        onClick={() => form.setValue("profileType", opt.value as any)}
                        className={`p-4 rounded-md border-2 text-center transition-colors ${
                          profileType === opt.value 
                            ? "border-foreground" 
                            : "border-border hover:border-foreground/30"
                        }`}
                        data-testid={`button-profile-${opt.value}`}
                      >
                        <span className="font-medium text-sm">{opt.label}</span>
                      </button>
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
                        <Input placeholder="First name" {...field} className="h-11" data-testid="input-name" />
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
                        <Input type="email" placeholder="you@example.com" {...field} className="h-11" data-testid="input-email" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <Button type="submit" className="w-full h-12" disabled={isLoading} data-testid="button-create">
                  {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                  {isLoading ? "Creating..." : "Create fund"} 
                  {!isLoading && <ArrowRight className="ml-2 h-4 w-4" />}
                </Button>
              </form>
            </Form>
          </CardContent>
        </Card>

        <p className="text-xs text-muted-foreground text-center mt-8">
          SIPC protected. Free to create.
        </p>
      </main>
    </div>
  );
}
