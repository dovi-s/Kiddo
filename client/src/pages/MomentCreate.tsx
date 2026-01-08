import { useState } from "react";
import { Nav } from "@/components/layout/Nav";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { Link, useLocation, useSearch } from "wouter";
import { ArrowLeft, ArrowRight, Check, Cake, GraduationCap, Heart, Baby, Star, Sparkles, QrCode, Copy, Share2, ExternalLink, Loader2 } from "lucide-react";
import { motion } from "framer-motion";

const TEMPLATES = [
  { id: "birthday", name: "Birthday", icon: Cake, amounts: ["25", "50", "100", "150"] },
  { id: "graduation", name: "Graduation", icon: GraduationCap, amounts: ["50", "100", "200", "500"] },
  { id: "barmitzvah", name: "Bar/Bat Mitzvah", icon: Star, amounts: ["54", "100", "180", "360"] },
  { id: "wedding", name: "Wedding", icon: Heart, amounts: ["100", "150", "250", "500"] },
  { id: "baby", name: "Baby / Newborn", icon: Baby, amounts: ["25", "50", "100", "250"] },
  { id: "general", name: "Just Because", icon: Sparkles, amounts: ["25", "50", "100", "200"] },
];

const THEMES = [
  { id: "classic", name: "Classic", bg: "bg-background", accent: "bg-primary" },
  { id: "warm", name: "Warm", bg: "bg-orange-50", accent: "bg-orange-500" },
  { id: "ocean", name: "Ocean", bg: "bg-blue-50", accent: "bg-blue-500" },
  { id: "forest", name: "Forest", bg: "bg-green-50", accent: "bg-green-600" },
];

export default function MomentCreate() {
  const [, setLocation] = useLocation();
  const search = useSearch();
  const params = new URLSearchParams(search);
  const profileName = decodeURIComponent(params.get("name") || "Ari");
  const accountType = params.get("type") || "child";

  const [step, setStep] = useState(0);
  const [template, setTemplate] = useState("birthday");
  const [theme, setTheme] = useState("classic");
  const [title, setTitle] = useState(`${profileName}'s Birthday`);
  const [story, setStory] = useState("");
  const [goal, setGoal] = useState("1000");
  const [isCreating, setIsCreating] = useState(false);
  const [created, setCreated] = useState(false);

  const selectedTemplate = TEMPLATES.find(t => t.id === template);
  const progress = ((step + 1) / 4) * 100;

  const handleCreate = () => {
    setIsCreating(true);
    setTimeout(() => {
      setIsCreating(false);
      setCreated(true);
    }, 1500);
  };

  if (created) {
    return (
      <div className="min-h-screen bg-background font-sans">
        <Nav />
        <main className="container mx-auto px-4 py-12 max-w-md">
          <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}>
            <Card className="border-none shadow-lg text-center">
              <CardContent className="p-8 space-y-6">
                <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto">
                  <Check className="h-8 w-8 text-primary" />
                </div>
                <div>
                  <h2 className="text-xl font-semibold mb-1">Your Moment is live!</h2>
                  <p className="text-muted-foreground">{title}</p>
                </div>

                <div className="p-4 rounded-xl bg-muted/50 text-left space-y-2">
                  <p className="text-xs text-muted-foreground">Share link</p>
                  <div className="flex gap-2">
                    <Input value={`everleaf.com/m/${profileName.toLowerCase()}`} readOnly className="text-sm" />
                    <Button variant="outline" size="icon"><Copy className="h-4 w-4" /></Button>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-2">
                  <Button variant="outline" className="flex-col h-auto py-3">
                    <QrCode className="h-5 w-5 mb-1" />
                    <span className="text-xs">QR Code</span>
                  </Button>
                  <Button variant="outline" className="flex-col h-auto py-3">
                    <Share2 className="h-5 w-5 mb-1" />
                    <span className="text-xs">Share</span>
                  </Button>
                  <Link href={`/moment?name=${encodeURIComponent(profileName)}&title=${encodeURIComponent(title)}&template=${template}`}>
                    <Button variant="outline" className="flex-col h-auto py-3 w-full">
                      <ExternalLink className="h-5 w-5 mb-1" />
                      <span className="text-xs">Preview</span>
                    </Button>
                  </Link>
                </div>

                <Link href={`/dashboard?type=${accountType}&name=${encodeURIComponent(profileName)}`}>
                  <Button className="w-full">Go to Dashboard</Button>
                </Link>
              </CardContent>
            </Card>
          </motion.div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background font-sans">
      <Nav />
      
      <main className="container mx-auto px-4 py-8 max-w-lg">
        <Link href={`/dashboard?type=${accountType}&name=${encodeURIComponent(profileName)}`} className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-6">
          <ArrowLeft className="h-4 w-4" /> Back to dashboard
        </Link>

        <div className="mb-8">
          <h1 className="text-2xl font-semibold mb-2">Create a Moment</h1>
          <p className="text-muted-foreground text-sm">Design a shareable page for {profileName}'s event</p>
          <Progress value={progress} className="h-1.5 mt-4" />
        </div>

        {step === 0 && (
          <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }}>
            <Card className="border-none shadow-sm">
              <CardHeader>
                <CardTitle className="text-lg">Choose a template</CardTitle>
              </CardHeader>
              <CardContent className="grid grid-cols-2 gap-3">
                {TEMPLATES.map((t) => (
                  <button
                    key={t.id}
                    onClick={() => { setTemplate(t.id); setTitle(`${profileName}'s ${t.name}`); }}
                    className={`p-4 rounded-xl border-2 text-left transition-all ${
                      template === t.id ? "border-primary bg-primary/5" : "border-border hover:border-primary/40"
                    }`}
                    data-testid={`template-${t.id}`}
                  >
                    <t.icon className={`h-6 w-6 mb-2 ${template === t.id ? "text-primary" : "text-muted-foreground"}`} />
                    <p className="font-medium text-sm">{t.name}</p>
                  </button>
                ))}
              </CardContent>
            </Card>
          </motion.div>
        )}

        {step === 1 && (
          <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }}>
            <Card className="border-none shadow-sm">
              <CardHeader>
                <CardTitle className="text-lg">Details</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>Title</Label>
                  <Input value={title} onChange={(e) => setTitle(e.target.value)} className="h-11" data-testid="input-title" />
                </div>
                <div className="space-y-2">
                  <Label>Story (optional)</Label>
                  <Textarea 
                    placeholder="Share a little about this moment..."
                    value={story}
                    onChange={(e) => setStory(e.target.value)}
                    rows={4}
                    data-testid="input-story"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Goal amount</Label>
                  <div className="flex gap-2">
                    {["500", "1000", "2500", "5000"].map((amt) => (
                      <Button
                        key={amt}
                        variant={goal === amt ? "default" : "outline"}
                        size="sm"
                        onClick={() => setGoal(amt)}
                      >
                        ${Number(amt).toLocaleString()}
                      </Button>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        )}

        {step === 2 && (
          <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }}>
            <Card className="border-none shadow-sm">
              <CardHeader>
                <CardTitle className="text-lg">Choose a theme</CardTitle>
              </CardHeader>
              <CardContent className="grid grid-cols-2 gap-3">
                {THEMES.map((t) => (
                  <button
                    key={t.id}
                    onClick={() => setTheme(t.id)}
                    className={`p-4 rounded-xl border-2 transition-all ${
                      theme === t.id ? "border-primary" : "border-border hover:border-primary/40"
                    }`}
                  >
                    <div className={`h-12 rounded-lg ${t.bg} mb-2 flex items-end p-2`}>
                      <div className={`h-2 w-8 rounded ${t.accent}`} />
                    </div>
                    <p className="font-medium text-sm">{t.name}</p>
                  </button>
                ))}
              </CardContent>
            </Card>
          </motion.div>
        )}

        {step === 3 && (
          <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }}>
            <Card className="border-none shadow-sm">
              <CardHeader>
                <CardTitle className="text-lg">Review</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="p-4 rounded-xl bg-muted/50 space-y-3">
                  <div>
                    <p className="text-xs text-muted-foreground">Title</p>
                    <p className="font-medium">{title}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Template</p>
                    <p className="font-medium">{selectedTemplate?.name}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Goal</p>
                    <p className="font-medium">${Number(goal).toLocaleString()}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Preset amounts</p>
                    <p className="font-medium">{selectedTemplate?.amounts.map(a => `$${a}`).join(", ")}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        )}

        <div className="flex gap-3 mt-6">
          {step > 0 && (
            <Button variant="outline" onClick={() => setStep(step - 1)} className="flex-1">
              <ArrowLeft className="mr-2 h-4 w-4" /> Back
            </Button>
          )}
          {step < 3 ? (
            <Button onClick={() => setStep(step + 1)} className="flex-1">
              Continue <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          ) : (
            <Button onClick={handleCreate} className="flex-1" disabled={isCreating}>
              {isCreating ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Creating...</> : <>Create Moment <Check className="ml-2 h-4 w-4" /></>}
            </Button>
          )}
        </div>
      </main>
    </div>
  );
}
