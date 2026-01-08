import { Nav } from "@/components/layout/Nav";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Heart, Users, Sparkles, Gift, TrendingUp } from "lucide-react";
import { motion } from "framer-motion";
import { useSearch } from "wouter";

export default function Recipient() {
  const search = useSearch();
  const params = new URLSearchParams(search);
  const recipientName = decodeURIComponent(params.get("name") || "Ari");
  const totalValue = Number(params.get("value")) || 4250;
  const contributorCount = Number(params.get("contributors")) || 18;

  const messages = [
    { from: "Uncle Dave", amount: 180, message: "Congrats! So proud of you." },
    { from: "Grandma Ruth", amount: 500, message: "For your future, with all my love." },
    { from: "The Cohens", amount: 100, message: "Here's to many more milestones!" },
    { from: "Aunt Lisa", amount: 200, message: "Can't wait to see all you accomplish!" },
  ];

  const milestones = [
    { title: "First $1,000", done: true },
    { title: "10 Contributors", done: true },
    { title: "First $5,000", done: false },
    { title: "25 Contributors", done: false },
  ];

  const people = ["Uncle Dave", "Grandma Ruth", "The Cohens", "Aunt Lisa", "The Goldbergs", "Cousin Jake", "Mom & Dad"];

  return (
    <div className="min-h-screen bg-background font-sans">
      <Nav />
      
      <main className="container mx-auto px-4 py-10 max-w-md">
        {/* Header */}
        <div className="text-center mb-10">
          <div className="mx-auto mb-4 h-20 w-20 rounded-full bg-primary/10 flex items-center justify-center text-3xl font-semibold text-primary">
            {recipientName.charAt(0)}
          </div>
          <h1 className="text-2xl font-semibold text-foreground">{recipientName}'s Future</h1>
          <p className="text-muted-foreground text-sm mt-1">{contributorCount} people in your corner</p>
        </div>

        {/* Stats */}
        <Card className="border-none shadow-sm mb-8">
          <CardContent className="p-5 text-center">
            <p className="text-3xl font-semibold text-foreground">${totalValue.toLocaleString()}</p>
            <p className="text-sm text-muted-foreground flex items-center justify-center gap-1 mt-1">
              <TrendingUp className="h-3 w-3 text-primary" /> Growing over time
            </p>
          </CardContent>
        </Card>

        {/* Tabs */}
        <Tabs defaultValue="messages" className="space-y-4">
          <TabsList className="w-full grid grid-cols-3">
            <TabsTrigger value="messages"><Heart className="mr-1 h-4 w-4" /> Messages</TabsTrigger>
            <TabsTrigger value="milestones"><Sparkles className="mr-1 h-4 w-4" /> Milestones</TabsTrigger>
            <TabsTrigger value="people"><Users className="mr-1 h-4 w-4" /> People</TabsTrigger>
          </TabsList>

          <TabsContent value="messages" className="space-y-3">
            {messages.map((item, i) => (
              <motion.div key={i} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.1 }}>
                <Card className="border-none shadow-sm">
                  <CardContent className="p-4">
                    <div className="flex items-start gap-3">
                      <div className="h-9 w-9 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                        <Gift className="h-4 w-4 text-primary" />
                      </div>
                      <div>
                        <p className="font-medium text-foreground text-sm">{item.from}</p>
                        <p className="text-sm text-muted-foreground mt-0.5">{item.message}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </TabsContent>

          <TabsContent value="milestones" className="space-y-3">
            {milestones.map((m, i) => (
              <Card key={i} className="border-none shadow-sm">
                <CardContent className="p-4 flex items-center gap-3">
                  <div className={`h-9 w-9 rounded-full flex items-center justify-center ${m.done ? "bg-primary text-primary-foreground" : "bg-muted"}`}>
                    {m.done ? <Sparkles className="h-4 w-4" /> : <span className="text-sm font-medium text-muted-foreground">{i + 1}</span>}
                  </div>
                  <p className={`font-medium text-sm ${m.done ? "text-foreground" : "text-muted-foreground"}`}>{m.title}</p>
                </CardContent>
              </Card>
            ))}
          </TabsContent>

          <TabsContent value="people">
            <Card className="border-none shadow-sm">
              <CardContent className="p-4">
                <div className="flex flex-wrap gap-2">
                  {people.map((name) => (
                    <span key={name} className="inline-flex items-center gap-2 bg-muted rounded-full px-3 py-1.5 text-sm">
                      <span className="h-5 w-5 rounded-full bg-primary/20 flex items-center justify-center text-xs font-medium text-primary">
                        {name.charAt(0)}
                      </span>
                      {name}
                    </span>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}
