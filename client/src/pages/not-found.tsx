import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Compass, HelpCircle, Home } from "lucide-react";

export default function NotFound() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4 font-sans">
      <div className="max-w-md space-y-6 text-center">
        <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-primary/10">
          <Compass className="h-10 w-10 text-primary" />
        </div>
        <div>
          <h1 className="mb-2 font-heading text-4xl font-semibold text-foreground">Hmm. That page does not exist.</h1>
          <p className="text-xl text-muted-foreground">But your child&apos;s future does.</p>
        </div>
        <p className="text-muted-foreground">
          If you were looking for something specific, we can still get you where you need to go.
        </p>
        <div className="flex flex-col justify-center gap-3 pt-4 sm:flex-row">
          <Link href="/">
            <Button className="w-full sm:w-auto">
              <Home className="mr-2 h-4 w-4" /> Go to homepage
            </Button>
          </Link>
          <Link href="/get-started">
            <Button variant="outline" className="w-full sm:w-auto">Start your child&apos;s fund</Button>
          </Link>
          <Link href="/faq">
            <Button variant="ghost" className="w-full sm:w-auto">
              <HelpCircle className="mr-2 h-4 w-4" /> Read our FAQ
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
}
