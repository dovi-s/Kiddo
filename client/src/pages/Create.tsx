import { Nav } from "@/components/layout/Nav";
import { Footer } from "@/components/layout/Footer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useLocation } from "wouter";
import { Loader2 } from "lucide-react";
import { useState } from "react";

const formSchema = z.object({
  childName: z.string().min(2, "Child's name is required"),
  eventName: z.string().min(2, "Event name is required (e.g. Leo's Bar Mitzvah)"),
  eventDate: z.string().min(1, "Date is required"),
  parentEmail: z.string().email("Invalid email address"),
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
    },
  });

  function onSubmit(values: z.infer<typeof formSchema>) {
    setIsLoading(true);
    // Simulate API call
    setTimeout(() => {
      setIsLoading(false);
      setLocation("/registry"); // Redirect to the mock registry
    }, 1500);
  }

  return (
    <div className="min-h-screen bg-muted/10 font-sans">
      <Nav />
      
      <main className="container mx-auto px-4 py-16 flex justify-center">
        <Card className="w-full max-w-lg shadow-xl border-none">
          <CardHeader className="text-center space-y-4 pb-8">
            <CardTitle className="font-serif text-3xl font-bold text-primary">Start a Gift Fund</CardTitle>
            <CardDescription className="text-lg">
              Create a registry for your child's future in minutes.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                <FormField
                  control={form.control}
                  name="childName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Who is this for?</FormLabel>
                      <FormControl>
                        <Input placeholder="Child's First Name" {...field} className="h-11" />
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

                <Button type="submit" className="w-full h-12 text-lg mt-4" disabled={isLoading}>
                  {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                  {isLoading ? "Creating Registry..." : "Create Registry"}
                </Button>
                
                <p className="text-xs text-center text-muted-foreground mt-4">
                  By creating a registry, you agree to our Terms of Service. No funds are collected until you verify your identity.
                </p>
              </form>
            </Form>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
