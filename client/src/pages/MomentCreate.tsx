import { useState } from "react";
import { Nav } from "@/components/layout/Nav";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Switch } from "@/components/ui/switch";
import { Link, useLocation, useSearch } from "wouter";
import { ArrowLeft, ArrowRight, Check, Cake, GraduationCap, Heart, Baby, Star, Sparkles, QrCode, Copy, Share2, ExternalLink, Loader2, Upload, Image, Palette, MessageSquare, Pencil, Plus, X } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

const TEMPLATES = [
  { 
    id: "custom", 
    name: "Start Fresh", 
    desc: "Build your own from scratch",
    icon: Plus, 
    amounts: ["25", "50", "100", "200"],
    preview: "bg-gradient-to-br from-slate-50 to-slate-100",
    accent: "border-dashed border-2 border-slate-300"
  },
  { 
    id: "minimal", 
    name: "Minimal", 
    desc: "Clean & modern",
    icon: Sparkles, 
    amounts: ["25", "50", "100", "200"],
    preview: "bg-white",
    accent: "border-l-4 border-l-slate-900"
  },
  { 
    id: "celebration", 
    name: "Celebration", 
    desc: "Bold & joyful",
    icon: Cake, 
    amounts: ["25", "50", "100", "150"],
    preview: "bg-gradient-to-br from-amber-50 to-orange-50",
    accent: "border-l-4 border-l-amber-500"
  },
  { 
    id: "milestone", 
    name: "Milestone", 
    desc: "For big achievements",
    icon: GraduationCap, 
    amounts: ["50", "100", "200", "500"],
    preview: "bg-gradient-to-br from-blue-50 to-indigo-50",
    accent: "border-l-4 border-l-blue-600"
  },
  { 
    id: "tradition", 
    name: "Tradition", 
    desc: "Timeless & elegant",
    icon: Star, 
    amounts: ["54", "100", "180", "360"],
    preview: "bg-gradient-to-br from-stone-50 to-stone-100",
    accent: "border-l-4 border-l-stone-600"
  },
  { 
    id: "newlife", 
    name: "New Life", 
    desc: "Soft & nurturing",
    icon: Baby, 
    amounts: ["25", "50", "100", "250"],
    preview: "bg-gradient-to-br from-green-50 to-emerald-50",
    accent: "border-l-4 border-l-emerald-500"
  },
  { 
    id: "love", 
    name: "Love", 
    desc: "Warm & romantic",
    icon: Heart, 
    amounts: ["100", "150", "250", "500"],
    preview: "bg-gradient-to-br from-rose-50 to-pink-50",
    accent: "border-l-4 border-l-rose-500"
  },
];

const THANK_YOU_STYLES = [
  { id: "match", name: "Match moment", desc: "Same style as your page" },
  { id: "photo", name: "Photo card", desc: "Feature your own image" },
  { id: "minimal", name: "Simple text", desc: "Clean & personal" },
];

export default function MomentCreate() {
  const [, setLocation] = useLocation();
  const search = useSearch();
  const params = new URLSearchParams(search);
  const profileName = decodeURIComponent(params.get("name") || "Ari");
  const accountType = params.get("type") || "child";

  const [step, setStep] = useState(0);
  const [template, setTemplate] = useState("minimal");
  const [title, setTitle] = useState(`${profileName}'s Celebration`);
  const [story, setStory] = useState("");
  const [goal, setGoal] = useState("1000");
  const [customGoal, setCustomGoal] = useState("");
  const [coverImage, setCoverImage] = useState<string | null>(null);
  const [customAmounts, setCustomAmounts] = useState<string[]>([]);
  const [thankYouStyle, setThankYouStyle] = useState("match");
  const [thankYouMessage, setThankYouMessage] = useState(`Thank you so much for contributing to ${profileName}'s future. Your generosity means the world to us.`);
  const [setupThankYou, setSetupThankYou] = useState(true);
  const [isCreating, setIsCreating] = useState(false);
  const [created, setCreated] = useState(false);

  const selectedTemplate = TEMPLATES.find(t => t.id === template);
  const steps = ["Template", "Details", "Design", "Thank You", "Review"];
  const progress = ((step + 1) / steps.length) * 100;
  const amounts = customAmounts.length > 0 ? customAmounts : (selectedTemplate?.amounts || ["25", "50", "100", "200"]);

  const handleImageUpload = () => {
    setCoverImage("https://images.unsplash.com/photo-1530103862676-de8c9debad1d?w=600&h=400&fit=crop");
  };

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
                    <Input value={`everleaf.com/m/${profileName.toLowerCase().replace(/\s/g, "")}`} readOnly className="text-sm" />
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

                {setupThankYou && (
                  <div className="p-3 rounded-lg bg-primary/5 border border-primary/10 text-left">
                    <div className="flex items-center gap-2 mb-1">
                      <MessageSquare className="h-4 w-4 text-primary" />
                      <p className="text-sm font-medium">Thank-you card ready</p>
                    </div>
                    <p className="text-xs text-muted-foreground">Auto-sends when contributions come in. Edit anytime in settings.</p>
                  </div>
                )}

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
          <p className="text-muted-foreground text-sm">Design a page people will actually want to visit</p>
          
          {/* Step indicator */}
          <div className="flex items-center gap-2 mt-5">
            {steps.map((s, i) => (
              <div key={s} className="flex items-center">
                <div className={`h-2 w-2 rounded-full transition-colors ${i <= step ? "bg-primary" : "bg-muted"}`} />
                {i < steps.length - 1 && <div className={`h-0.5 w-8 transition-colors ${i < step ? "bg-primary" : "bg-muted"}`} />}
              </div>
            ))}
          </div>
          <p className="text-xs text-muted-foreground mt-2">{steps[step]}</p>
        </div>

        <AnimatePresence mode="wait">
          {/* Step 0: Template */}
          {step === 0 && (
            <motion.div key="template" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
              <div className="space-y-3">
                {TEMPLATES.map((t) => (
                  <button
                    key={t.id}
                    onClick={() => { setTemplate(t.id); setTitle(`${profileName}'s ${t.id === "custom" ? "Celebration" : t.name}`); }}
                    className={`w-full p-4 rounded-xl border-2 text-left transition-all flex items-center gap-4 ${
                      template === t.id ? "border-primary bg-primary/5" : "border-border hover:border-primary/40"
                    }`}
                    data-testid={`template-${t.id}`}
                  >
                    <div className={`h-14 w-14 rounded-lg ${t.preview} ${t.accent} flex items-center justify-center shrink-0`}>
                      <t.icon className={`h-6 w-6 ${template === t.id ? "text-primary" : "text-muted-foreground"}`} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm">{t.name}</p>
                      <p className="text-xs text-muted-foreground">{t.desc}</p>
                    </div>
                    {template === t.id && <Check className="h-5 w-5 text-primary shrink-0" />}
                  </button>
                ))}
              </div>
            </motion.div>
          )}

          {/* Step 1: Details */}
          {step === 1 && (
            <motion.div key="details" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
              <Card className="border-none shadow-sm">
                <CardContent className="p-6 space-y-5">
                  <div className="space-y-2">
                    <Label className="text-sm font-medium">Title</Label>
                    <Input value={title} onChange={(e) => setTitle(e.target.value)} className="h-12 text-base" placeholder="Ari's 13th Birthday" data-testid="input-title" />
                  </div>
                  
                  <div className="space-y-2">
                    <Label className="text-sm font-medium">Story <span className="text-muted-foreground font-normal">(optional)</span></Label>
                    <Textarea 
                      placeholder="Share what makes this moment special..."
                      value={story}
                      onChange={(e) => setStory(e.target.value)}
                      rows={3}
                      className="resize-none"
                      data-testid="input-story"
                    />
                  </div>

                  <div className="space-y-3">
                    <Label className="text-sm font-medium">Goal</Label>
                    <div className="flex flex-wrap gap-2">
                      {["500", "1000", "2500", "5000"].map((amt) => (
                        <Button
                          key={amt}
                          variant={goal === amt && !customGoal ? "default" : "outline"}
                          size="sm"
                          onClick={() => { setGoal(amt); setCustomGoal(""); }}
                          className="h-9"
                        >
                          ${Number(amt).toLocaleString()}
                        </Button>
                      ))}
                      <div className="flex-1 min-w-[100px]">
                        <Input 
                          placeholder="Custom" 
                          value={customGoal} 
                          onChange={(e) => { setCustomGoal(e.target.value.replace(/[^0-9]/g, "")); setGoal("custom"); }}
                          className="h-9"
                        />
                      </div>
                    </div>
                  </div>

                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <Label className="text-sm font-medium">Suggested amounts</Label>
                      <Button variant="ghost" size="sm" className="text-xs h-7" onClick={() => setCustomAmounts(amounts)}>
                        <Pencil className="h-3 w-3 mr-1" /> Customize
                      </Button>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {amounts.map((amt, i) => (
                        <div key={i} className="relative">
                          <div className="px-3 py-1.5 rounded-full bg-muted text-sm font-medium">
                            ${amt}
                          </div>
                          {customAmounts.length > 0 && (
                            <button 
                              onClick={() => setCustomAmounts(customAmounts.filter((_, idx) => idx !== i))}
                              className="absolute -top-1 -right-1 h-4 w-4 rounded-full bg-foreground text-background flex items-center justify-center"
                            >
                              <X className="h-2.5 w-2.5" />
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          )}

          {/* Step 2: Design */}
          {step === 2 && (
            <motion.div key="design" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
              <Card className="border-none shadow-sm">
                <CardContent className="p-6 space-y-5">
                  <div className="space-y-3">
                    <Label className="text-sm font-medium">Cover image <span className="text-muted-foreground font-normal">(optional)</span></Label>
                    {coverImage ? (
                      <div className="relative rounded-xl overflow-hidden">
                        <img src={coverImage} alt="Cover" className="w-full h-40 object-cover" />
                        <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent" />
                        <div className="absolute bottom-3 left-3 right-3 flex gap-2">
                          <Button size="sm" variant="secondary" className="flex-1" onClick={handleImageUpload}>
                            <Image className="h-3 w-3 mr-1" /> Change
                          </Button>
                          <Button size="sm" variant="secondary" onClick={() => setCoverImage(null)}>
                            <X className="h-3 w-3" />
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <button 
                        onClick={handleImageUpload}
                        className="w-full h-32 rounded-xl border-2 border-dashed border-muted-foreground/30 hover:border-primary/50 transition-colors flex flex-col items-center justify-center gap-2 text-muted-foreground hover:text-foreground"
                      >
                        <Upload className="h-6 w-6" />
                        <span className="text-sm">Upload a photo</span>
                      </button>
                    )}
                  </div>

                  {/* Live preview */}
                  <div className="space-y-3">
                    <Label className="text-sm font-medium">Preview</Label>
                    <div className={`rounded-xl overflow-hidden ${selectedTemplate?.preview} ${selectedTemplate?.accent} p-5`}>
                      {coverImage && (
                        <div className="h-24 -mx-5 -mt-5 mb-4 bg-cover bg-center" style={{ backgroundImage: `url(${coverImage})` }}>
                          <div className="h-full w-full bg-gradient-to-t from-white/90 to-transparent" />
                        </div>
                      )}
                      <div className="flex items-center gap-3 mb-3">
                        <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center text-sm font-semibold text-primary">
                          {profileName.charAt(0)}
                        </div>
                        <div>
                          <p className="font-semibold text-sm">{title || "Your Title"}</p>
                          <p className="text-xs text-muted-foreground">{story ? story.slice(0, 50) + "..." : "Your story here"}</p>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        {amounts.slice(0, 3).map((amt) => (
                          <div key={amt} className="flex-1 py-2 rounded-lg bg-white/80 text-center text-sm font-medium border">
                            ${amt}
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          )}

          {/* Step 3: Thank You Card */}
          {step === 3 && (
            <motion.div key="thankyou" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
              <Card className="border-none shadow-sm">
                <CardContent className="p-6 space-y-5">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium text-sm">Set up thank-you card</p>
                      <p className="text-xs text-muted-foreground">Auto-send after each contribution</p>
                    </div>
                    <Switch checked={setupThankYou} onCheckedChange={setSetupThankYou} />
                  </div>

                  {setupThankYou && (
                    <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} className="space-y-4">
                      <div className="space-y-3">
                        <Label className="text-sm font-medium">Style</Label>
                        <div className="grid grid-cols-3 gap-2">
                          {THANK_YOU_STYLES.map((s) => (
                            <button
                              key={s.id}
                              onClick={() => setThankYouStyle(s.id)}
                              className={`p-3 rounded-xl border-2 text-center transition-all ${
                                thankYouStyle === s.id ? "border-primary bg-primary/5" : "border-border hover:border-primary/40"
                              }`}
                            >
                              <p className="font-medium text-xs">{s.name}</p>
                              <p className="text-[10px] text-muted-foreground mt-0.5">{s.desc}</p>
                            </button>
                          ))}
                        </div>
                      </div>

                      <div className="space-y-2">
                        <Label className="text-sm font-medium">Message</Label>
                        <Textarea 
                          value={thankYouMessage}
                          onChange={(e) => setThankYouMessage(e.target.value)}
                          rows={3}
                          className="resize-none text-sm"
                        />
                      </div>

                      {/* Thank you preview */}
                      <div className={`rounded-xl p-4 ${selectedTemplate?.preview} border`}>
                        <p className="text-xs text-muted-foreground mb-2">Preview</p>
                        <div className="bg-white rounded-lg p-4 shadow-sm">
                          <p className="font-medium text-sm mb-1">Thank you, [Name]!</p>
                          <p className="text-xs text-muted-foreground">{thankYouMessage.slice(0, 100)}...</p>
                          <p className="text-xs text-primary mt-2 font-medium">— The {profileName.split(" ")[0]} Family</p>
                        </div>
                      </div>
                    </motion.div>
                  )}

                  {!setupThankYou && (
                    <p className="text-xs text-muted-foreground text-center py-4">
                      You can set this up later in Settings → Thank You Cards
                    </p>
                  )}
                </CardContent>
              </Card>
            </motion.div>
          )}

          {/* Step 4: Review */}
          {step === 4 && (
            <motion.div key="review" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
              <Card className="border-none shadow-sm">
                <CardHeader className="pb-2">
                  <CardTitle className="text-lg">Review</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* Full preview */}
                  <div className={`rounded-xl overflow-hidden ${selectedTemplate?.preview} ${selectedTemplate?.accent}`}>
                    {coverImage && (
                      <div className="h-28 bg-cover bg-center" style={{ backgroundImage: `url(${coverImage})` }}>
                        <div className="h-full w-full bg-gradient-to-t from-white/90 to-transparent" />
                      </div>
                    )}
                    <div className="p-5">
                      <div className="flex items-center gap-3 mb-3">
                        <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center text-lg font-semibold text-primary">
                          {profileName.charAt(0)}
                        </div>
                        <div>
                          <p className="font-semibold">{title}</p>
                          <p className="text-sm text-muted-foreground">Goal: ${Number(customGoal || goal).toLocaleString()}</p>
                        </div>
                      </div>
                      {story && <p className="text-sm text-muted-foreground mb-4">{story}</p>}
                      <div className="flex gap-2">
                        {amounts.map((amt) => (
                          <div key={amt} className="flex-1 py-2.5 rounded-lg bg-white text-center text-sm font-medium border shadow-sm">
                            ${amt}
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Summary */}
                  <div className="p-4 rounded-xl bg-muted/50 space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Template</span>
                      <span className="font-medium">{selectedTemplate?.name}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Thank-you card</span>
                      <span className="font-medium">{setupThankYou ? "Enabled" : "Skipped"}</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Navigation */}
        <div className="flex gap-3 mt-6">
          {step > 0 && (
            <Button variant="outline" onClick={() => setStep(step - 1)} className="flex-1">
              <ArrowLeft className="mr-2 h-4 w-4" /> Back
            </Button>
          )}
          {step < steps.length - 1 ? (
            <Button onClick={() => setStep(step + 1)} className="flex-1">
              Continue <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          ) : (
            <Button onClick={handleCreate} className="flex-1" disabled={isCreating}>
              {isCreating ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Creating...</> : <>Create Moment <Check className="ml-2 h-4 w-4" /></>}
            </Button>
          )}
        </div>

        {/* Skip thank you */}
        {step === 3 && setupThankYou && (
          <button 
            onClick={() => setStep(step + 1)} 
            className="w-full text-center text-sm text-muted-foreground hover:text-foreground mt-3 underline"
          >
            Skip for now
          </button>
        )}
      </main>
    </div>
  );
}
