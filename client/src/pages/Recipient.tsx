import { Nav } from "@/components/layout/Nav";
import { Card, CardContent } from "@/components/ui/card";
import { motion } from "framer-motion";
import { useSearch } from "wouter";

export default function Recipient() {
  const search = useSearch();
  const params = new URLSearchParams(search);
  const recipientName = decodeURIComponent(params.get("name") || "Ari");
  const totalValue = Number(params.get("value")) || 4250;
  const contributorCount = Number(params.get("contributors")) || 18;

  const messages = [
    { from: "Uncle Dave", message: "Congrats! So proud of you." },
    { from: "Grandma Ruth", message: "For your future, with all my love." },
    { from: "The Cohens", message: "Here's to many more milestones!" },
    { from: "Aunt Lisa", message: "Can't wait to see all you accomplish!" },
    { from: "The Goldbergs", message: "Wishing you the best!" },
  ];

  const people = ["Uncle Dave", "Grandma Ruth", "The Cohens", "Aunt Lisa", "The Goldbergs", "Cousin Jake", "Mom & Dad"];

  return (
    <div className="min-h-screen bg-background">
      <Nav />
      
      <main className="container mx-auto px-4 py-12 max-w-md">
        {/* Header */}
        <div className="text-center mb-12">
          <div className="mx-auto mb-5 h-16 w-16 rounded-full bg-foreground/5 flex items-center justify-center text-2xl font-semibold text-foreground">
            {recipientName.charAt(0)}
          </div>
          <h1 className="text-2xl font-semibold text-foreground">{recipientName}'s Fund</h1>
          <p className="text-muted-foreground text-sm mt-2">{contributorCount} people contributed</p>
        </div>

        {/* Value */}
        <div className="text-center mb-12">
          <p className="text-4xl font-semibold text-foreground">${totalValue.toLocaleString()}</p>
          <p className="text-muted-foreground text-sm mt-2">Growing for your future</p>
        </div>

        {/* Messages */}
        <div className="mb-10">
          <h2 className="font-semibold mb-4">Messages</h2>
          <div className="space-y-3">
            {messages.map((item, i) => (
              <motion.div 
                key={i} 
                initial={{ opacity: 0, y: 8 }} 
                animate={{ opacity: 1, y: 0 }} 
                transition={{ delay: i * 0.05 }}
              >
                <Card className="border">
                  <CardContent className="p-4">
                    <p className="font-medium text-sm">{item.from}</p>
                    <p className="text-sm text-muted-foreground mt-1">{item.message}</p>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>
        </div>

        {/* People */}
        <div>
          <h2 className="font-semibold mb-4">Your supporters</h2>
          <div className="flex flex-wrap gap-2">
            {people.map((name) => (
              <span 
                key={name} 
                className="inline-flex items-center gap-2 border rounded-full px-3 py-1.5 text-sm"
              >
                <span className="h-5 w-5 rounded-full bg-foreground/5 flex items-center justify-center text-xs font-medium">
                  {name.charAt(0)}
                </span>
                {name}
              </span>
            ))}
          </div>
        </div>
      </main>
    </div>
  );
}
