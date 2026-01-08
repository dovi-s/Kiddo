import { Nav } from "@/components/layout/Nav";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Heart, TrendingUp, Users, Sparkles, Gift, MessageSquare } from "lucide-react";
import { motion } from "framer-motion";

const RECIPIENT = {
  name: "Ari",
  photo: "https://images.unsplash.com/photo-1488521787991-ed7bbaae773c?q=80&w=300&auto=format&fit=crop",
  totalValue: 4250,
  totalGain: 12.5,
  contributors: 18,
};

const TIMELINE = [
  { type: "gift", from: "Uncle Dave", amount: 180, message: "Mazel Tov, Ari! Watching you grow has been amazing.", date: "2 days ago" },
  { type: "milestone", title: "First $4,000!", date: "1 week ago" },
  { type: "gift", from: "Grandma Ruth", amount: 500, message: "For your future, with all my love.", date: "1 week ago" },
  { type: "gift", from: "The Cohens", amount: 100, message: "Here's to many more milestones!", date: "2 weeks ago" },
  { type: "milestone", title: "10 Contributors!", date: "3 weeks ago" },
  { type: "gift", from: "Aunt Lisa", amount: 54, message: "Happy Bar Mitzvah! So proud of you.", date: "3 weeks ago" },
];

const MILESTONES = [
  { title: "First $1,000", completed: true },
  { title: "10 Contributors", completed: true },
  { title: "First $5,000", completed: false },
  { title: "25 Contributors", completed: false },
];

export default function Recipient() {
  return (
    <div className="min-h-screen bg-muted/10 font-sans">
      <Nav />
      
      <main className="container mx-auto px-4 py-10">
        {/* Header */}
        <div className="text-center mb-10">
          <motion.div 
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="mx-auto mb-4 h-28 w-28 overflow-hidden rounded-full border-4 border-card shadow-xl"
          >
            <img src={RECIPIENT.photo} alt={RECIPIENT.name} className="h-full w-full object-cover" />
          </motion.div>
          <h1 className="font-serif text-4xl font-semibold text-foreground">{RECIPIENT.name}'s Future</h1>
          <p className="text-muted-foreground mt-2">Your community is investing in you</p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-4 max-w-2xl mx-auto mb-10">
          <Card className="border-none shadow-sm text-center py-6">
            <CardContent className="p-0">
              <p className="text-3xl font-bold text-primary">${RECIPIENT.totalValue.toLocaleString()}</p>
              <p className="text-sm text-muted-foreground">Total Value</p>
            </CardContent>
          </Card>
          <Card className="border-none shadow-sm text-center py-6">
            <CardContent className="p-0">
              <p className="text-3xl font-bold text-foreground flex items-center justify-center gap-1">
                <TrendingUp className="h-5 w-5 text-green-500" />
                {RECIPIENT.totalGain}%
              </p>
              <p className="text-sm text-muted-foreground">Growth</p>
            </CardContent>
          </Card>
          <Card className="border-none shadow-sm text-center py-6">
            <CardContent className="p-0">
              <p className="text-3xl font-bold text-foreground">{RECIPIENT.contributors}</p>
              <p className="text-sm text-muted-foreground">In Your Corner</p>
            </CardContent>
          </Card>
        </div>

        {/* Tabs */}
        <Tabs defaultValue="timeline" className="max-w-2xl mx-auto">
          <TabsList className="w-full grid grid-cols-3 mb-6">
            <TabsTrigger value="timeline"><Heart className="mr-2 h-4 w-4" /> Timeline</TabsTrigger>
            <TabsTrigger value="milestones"><Sparkles className="mr-2 h-4 w-4" /> Milestones</TabsTrigger>
            <TabsTrigger value="people"><Users className="mr-2 h-4 w-4" /> People</TabsTrigger>
          </TabsList>

          <TabsContent value="timeline" className="space-y-4">
            {TIMELINE.map((item, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.1 }}
              >
                {item.type === "gift" ? (
                  <Card className="border-none shadow-sm">
                    <CardContent className="p-5 flex gap-4">
                      <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                        <Gift className="h-6 w-6 text-primary" />
                      </div>
                      <div className="flex-grow">
                        <div className="flex justify-between items-start mb-1">
                          <p className="font-semibold">{item.from}</p>
                          <span className="text-sm text-muted-foreground">{item.date}</span>
                        </div>
                        <p className="text-muted-foreground text-sm mb-2">{item.message}</p>
                        <p className="text-sm font-bold text-primary">+${item.amount}</p>
                      </div>
                    </CardContent>
                  </Card>
                ) : (
                  <Card className="border-none shadow-sm bg-secondary/10 border-l-4 border-l-secondary">
                    <CardContent className="p-5 flex gap-4 items-center">
                      <div className="h-10 w-10 rounded-full bg-secondary/20 flex items-center justify-center">
                        <Sparkles className="h-5 w-5 text-secondary" />
                      </div>
                      <div className="flex-grow">
                        <p className="font-semibold text-foreground">{item.title}</p>
                        <p className="text-sm text-muted-foreground">{item.date}</p>
                      </div>
                    </CardContent>
                  </Card>
                )}
              </motion.div>
            ))}
          </TabsContent>

          <TabsContent value="milestones">
            <Card className="border-none shadow-sm">
              <CardHeader><CardTitle className="font-serif">Your Milestones</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                {MILESTONES.map((m, i) => (
                  <div key={i} className="flex items-center gap-4">
                    <div className={`h-10 w-10 rounded-full flex items-center justify-center ${m.completed ? "bg-primary text-primary-foreground" : "bg-muted"}`}>
                      {m.completed ? <Sparkles className="h-5 w-5" /> : <span className="text-muted-foreground font-bold">{i + 1}</span>}
                    </div>
                    <p className={`font-medium ${m.completed ? "text-foreground" : "text-muted-foreground"}`}>{m.title}</p>
                    {m.completed && <span className="ml-auto text-xs font-bold text-primary bg-primary/10 px-2 py-1 rounded-full">Completed</span>}
                  </div>
                ))}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="people">
            <Card className="border-none shadow-sm">
              <CardHeader><CardTitle className="font-serif">People in Your Corner</CardTitle></CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-4">
                  {["Uncle Dave", "Grandma Ruth", "The Cohens", "Aunt Lisa", "The Goldbergs", "Cousin Jake", "Mrs. Schwartz", "The Levines"].map((name, i) => (
                    <div key={i} className="flex items-center gap-3 p-3 rounded-xl bg-muted/50">
                      <div className="h-10 w-10 rounded-full bg-primary/20 flex items-center justify-center text-sm font-bold text-primary">
                        {name.charAt(0)}
                      </div>
                      <span className="font-medium text-sm">{name}</span>
                    </div>
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
