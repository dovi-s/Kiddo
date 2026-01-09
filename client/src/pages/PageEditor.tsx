import { useState, useMemo, useEffect } from "react";
import { Link, useParams } from "wouter";
import { motion } from "framer-motion";
import { toast } from "@/hooks/use-toast";
import { ArrowLeft, Image, Type, Palette, Eye, Save, Trash2, Plus, Check, Pencil } from "lucide-react";

// Helper to get/set from localStorage
const getStoredPageData = (key: string) => {
  try {
    const stored = localStorage.getItem(`everleaf_page_${key}`);
    return stored ? JSON.parse(stored) : null;
  } catch { return null; }
};

const setStoredPageData = (key: string, data: any) => {
  try {
    localStorage.setItem(`everleaf_page_${key}`, JSON.stringify(data));
  } catch {}
};

const themes = [
  { id: "minimal", name: "Minimal", bg: "bg-stone-50", text: "text-stone-900", accent: "bg-stone-900" },
  { id: "warm", name: "Warm", bg: "bg-amber-50", text: "text-amber-900", accent: "bg-amber-700" },
  { id: "ocean", name: "Ocean", bg: "bg-slate-50", text: "text-slate-900", accent: "bg-slate-700" },
  { id: "forest", name: "Forest", bg: "bg-emerald-50", text: "text-emerald-900", accent: "bg-emerald-700" },
  { id: "rose", name: "Rose", bg: "bg-rose-50", text: "text-rose-900", accent: "bg-rose-600" },
  { id: "dark", name: "Dark", bg: "bg-stone-900", text: "text-stone-50", accent: "bg-white" },
];

const layouts = [
  { id: "centered", name: "Centered", icon: "⬛" },
  { id: "left", name: "Left aligned", icon: "◧" },
  { id: "hero", name: "Full hero", icon: "▣" },
];

// Mock data for different events
const eventDataMap: Record<string, { title: string; headline: string; description: string; currentAmount: number; goalAmount: number }> = {
  "anytime": {
    title: "Open anytime",
    headline: "Give to their future, anytime",
    description: "No special occasion needed. Every gift grows over time into something meaningful.",
    currentAmount: 2180,
    goalAmount: 5000,
  },
  "5th-birthday": {
    title: "5th Birthday",
    headline: "Help celebrate Mila's 5th birthday",
    description: "Instead of toys that get forgotten, give Mila the gift of a financial head start.",
    currentAmount: 1420,
    goalAmount: 500,
  },
  "kindergarten-graduation": {
    title: "Kindergarten Graduation",
    headline: "Celebrate this milestone",
    description: "A proud moment deserves a gift that keeps growing. Contribute to their future.",
    currentAmount: 650,
    goalAmount: 1000,
  },
};

export default function PageEditor() {
  const params = useParams<{ fund: string; event: string }>();
  const fundSlug = params.fund || "mila";
  const eventSlug = params.event || "anytime";
  
  // Storage key for this page
  const storageKey = `${fundSlug}_${eventSlug}`;
  
  // Get initial data based on the event slug
  const initialData = useMemo(() => {
    const data = eventDataMap[eventSlug] || eventDataMap["anytime"];
    return data;
  }, [eventSlug]);

  // Convert fund slug to display name
  const fundName = fundSlug
    .split("-")
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
  
  const [activeTab, setActiveTab] = useState<"content" | "style" | "photo">("content");
  const [isSaving, setIsSaving] = useState(false);
  const [previewStep, setPreviewStep] = useState(0);
  
  // Interactive preview state
  const [previewAmount, setPreviewAmount] = useState(50);
  const [previewName, setPreviewName] = useState("");
  const [previewNote, setPreviewNote] = useState("");
  const [previewProcessing, setPreviewProcessing] = useState(false);
  
  const previewProjection = Math.round(previewAmount * 4.6);
  const previewFee = Math.round(previewAmount * 0.029 * 100) / 100 + 0.30;
  const previewTotal = (previewAmount + previewFee).toFixed(2);
  
  // Initialize with stored data or defaults
  const [pageData, setPageData] = useState(() => {
    const stored = getStoredPageData(storageKey);
    if (stored) return stored;
    return {
      title: initialData.title,
      slug: eventSlug,
      headline: initialData.headline,
      description: initialData.description,
      buttonText: "Give a gift",
      theme: "minimal",
      layout: "centered",
      photo: null as string | null,
      showAmount: true,
      goalAmount: initialData.goalAmount,
      currentAmount: initialData.currentAmount,
    };
  });

  const currentTheme = themes.find(t => t.id === pageData.theme) || themes[0];

  const handleSave = () => {
    setIsSaving(true);
    setStoredPageData(storageKey, pageData);
    setTimeout(() => {
      setIsSaving(false);
      toast({ title: "Changes saved" });
    }, 500);
  };

  const handlePhotoUpload = () => {
    setPageData(prev => ({
      ...prev,
      photo: "https://images.unsplash.com/photo-1502086223501-7ea6ecd79368?w=800&h=600&fit=crop"
    }));
    toast({ title: "Photo added" });
  };

  return (
    <div className="min-h-screen bg-stone-100 flex">
      
      {/* Left Panel - Controls */}
      <div className="w-80 bg-white border-r border-stone-200 flex flex-col">
        
        {/* Header */}
        <div className="p-4 border-b border-stone-200">
          <div className="flex items-center justify-between mb-3">
            <button 
              onClick={() => window.history.back()}
              className="flex items-center gap-2 text-sm text-stone-500 hover:text-stone-900"
            >
              <ArrowLeft size={16} />
              <span>Back</span>
            </button>
            <button
              onClick={handleSave}
              disabled={isSaving}
              className="flex items-center gap-2 px-4 py-2 bg-stone-900 text-white text-sm rounded-lg hover:bg-stone-800 disabled:opacity-50"
            >
              {isSaving ? (
                <span>Saving...</span>
              ) : (
                <>
                  <Save size={14} />
                  <span>Save</span>
                </>
              )}
            </button>
          </div>

          {/* Breadcrumb */}
          <div className="text-xs flex items-center gap-1.5 mb-4">
            <Link href="/dashboard">
              <span className="text-stone-400 hover:text-stone-600">Dashboard</span>
            </Link>
            <span className="text-stone-300">/</span>
            <Link href={`/${fundSlug}`}>
              <span className="text-stone-400 hover:text-stone-600">{fundName}</span>
            </Link>
            <span className="text-stone-300">/</span>
            <span className="text-stone-600">{pageData.title}</span>
          </div>
          
          {/* Page URL - Editable */}
          <div className="space-y-2">
            <p className="text-xs text-stone-400">Event URL</p>
            <div className="flex items-center gap-0 border border-stone-200 rounded-lg overflow-hidden bg-white">
              <span className="text-xs text-stone-400 bg-stone-50 px-3 py-2.5 border-r border-stone-200 whitespace-nowrap">
                everleaf.com/{fundSlug}/
              </span>
              <input
                type="text"
                value={pageData.slug}
                onChange={(e) => setPageData(prev => ({ ...prev, slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "-") }))}
                className="flex-1 text-sm text-stone-900 px-3 py-2 focus:outline-none min-w-0"
                placeholder="event-name"
              />
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-stone-200">
          {[
            { id: "content", label: "Content", icon: Type },
            { id: "style", label: "Style", icon: Palette },
            { id: "photo", label: "Photo", icon: Image },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`flex-1 py-3 text-sm font-medium flex items-center justify-center gap-2 border-b-2 transition-colors ${
                activeTab === tab.id
                  ? "text-stone-900 border-stone-900"
                  : "text-stone-400 border-transparent hover:text-stone-600"
              }`}
            >
              <tab.icon size={14} />
              {tab.label}
            </button>
          ))}
        </div>

        {/* Tab Content */}
        <div className="flex-1 overflow-auto p-4">
          
          {activeTab === "content" && (
            <div className="space-y-6">
              
              {/* Title */}
              <div>
                <label className="block text-xs font-medium text-stone-500 uppercase tracking-wider mb-2">
                  Event Name
                </label>
                <input
                  type="text"
                  value={pageData.title}
                  onChange={(e) => setPageData(prev => ({ ...prev, title: e.target.value }))}
                  className="w-full px-3 py-2.5 border border-stone-200 rounded-lg text-stone-900 focus:outline-none focus:border-stone-400"
                />
              </div>

              {/* Headline */}
              <div>
                <label className="block text-xs font-medium text-stone-500 uppercase tracking-wider mb-2">
                  Headline
                </label>
                <textarea
                  value={pageData.headline}
                  onChange={(e) => setPageData(prev => ({ ...prev, headline: e.target.value }))}
                  rows={2}
                  className="w-full px-3 py-2.5 border border-stone-200 rounded-lg text-stone-900 focus:outline-none focus:border-stone-400 resize-none"
                />
              </div>

              {/* Description */}
              <div>
                <label className="block text-xs font-medium text-stone-500 uppercase tracking-wider mb-2">
                  Description
                </label>
                <textarea
                  value={pageData.description}
                  onChange={(e) => setPageData(prev => ({ ...prev, description: e.target.value }))}
                  rows={4}
                  className="w-full px-3 py-2.5 border border-stone-200 rounded-lg text-stone-900 focus:outline-none focus:border-stone-400 resize-none"
                />
              </div>

              {/* Button Text */}
              <div>
                <label className="block text-xs font-medium text-stone-500 uppercase tracking-wider mb-2">
                  Button Text
                </label>
                <input
                  type="text"
                  value={pageData.buttonText}
                  onChange={(e) => setPageData(prev => ({ ...prev, buttonText: e.target.value }))}
                  className="w-full px-3 py-2.5 border border-stone-200 rounded-lg text-stone-900 focus:outline-none focus:border-stone-400"
                />
              </div>

              {/* Goal */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-xs font-medium text-stone-500 uppercase tracking-wider">
                    Show Goal Progress
                  </label>
                  <button
                    onClick={() => setPageData(prev => ({ ...prev, showAmount: !prev.showAmount }))}
                    className={`w-10 h-6 rounded-full transition-colors ${pageData.showAmount ? 'bg-stone-900' : 'bg-stone-200'}`}
                  >
                    <div className={`w-4 h-4 bg-white rounded-full transition-transform mx-1 ${pageData.showAmount ? 'translate-x-4' : ''}`} />
                  </button>
                </div>
                {pageData.showAmount && (
                  <div className="flex gap-2">
                    <div className="flex-1">
                      <p className="text-xs text-stone-400 mb-1">Goal</p>
                      <input
                        type="number"
                        value={pageData.goalAmount}
                        onChange={(e) => setPageData(prev => ({ ...prev, goalAmount: Number(e.target.value) }))}
                        className="w-full px-3 py-2 border border-stone-200 rounded-lg text-stone-900 focus:outline-none focus:border-stone-400"
                      />
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {activeTab === "style" && (
            <div className="space-y-6">
              
              {/* Theme */}
              <div>
                <label className="block text-xs font-medium text-stone-500 uppercase tracking-wider mb-3">
                  Theme
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {themes.map((theme) => (
                    <button
                      key={theme.id}
                      onClick={() => setPageData(prev => ({ ...prev, theme: theme.id }))}
                      className={`p-3 rounded-lg border-2 transition-all ${
                        pageData.theme === theme.id
                          ? "border-stone-900"
                          : "border-stone-200 hover:border-stone-300"
                      }`}
                    >
                      <div className={`h-8 rounded ${theme.bg} mb-2 flex items-center justify-center`}>
                        <div className={`w-6 h-1 rounded ${theme.accent}`} />
                      </div>
                      <p className="text-xs text-stone-600">{theme.name}</p>
                    </button>
                  ))}
                </div>
              </div>

              {/* Layout */}
              <div>
                <label className="block text-xs font-medium text-stone-500 uppercase tracking-wider mb-3">
                  Layout
                </label>
                <div className="space-y-2">
                  {layouts.map((layout) => (
                    <button
                      key={layout.id}
                      onClick={() => setPageData(prev => ({ ...prev, layout: layout.id }))}
                      className={`w-full p-3 rounded-lg border-2 flex items-center gap-3 transition-all ${
                        pageData.layout === layout.id
                          ? "border-stone-900 bg-stone-50"
                          : "border-stone-200 hover:border-stone-300"
                      }`}
                    >
                      <span className="text-xl">{layout.icon}</span>
                      <span className="text-sm text-stone-700">{layout.name}</span>
                      {pageData.layout === layout.id && (
                        <Check size={14} className="ml-auto text-stone-900" />
                      )}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {activeTab === "photo" && (
            <div className="space-y-4">
              
              {pageData.photo ? (
                <div className="relative">
                  <img
                    src={pageData.photo}
                    alt="Event"
                    className="w-full aspect-video object-cover rounded-lg"
                  />
                  <button
                    onClick={() => setPageData(prev => ({ ...prev, photo: null }))}
                    className="absolute top-2 right-2 p-2 bg-white/90 rounded-lg hover:bg-white"
                  >
                    <Trash2 size={14} className="text-stone-600" />
                  </button>
                </div>
              ) : (
                <button
                  onClick={handlePhotoUpload}
                  className="w-full aspect-video border-2 border-dashed border-stone-300 rounded-lg flex flex-col items-center justify-center gap-2 hover:border-stone-400 transition-colors"
                >
                  <Plus size={24} className="text-stone-400" />
                  <span className="text-sm text-stone-500">Add photo</span>
                </button>
              )}

              <p className="text-xs text-stone-400 text-center">
                Photos help tell your story and increase contributions by 40%
              </p>

              {pageData.photo && (
                <button
                  onClick={handlePhotoUpload}
                  className="w-full py-2.5 border border-stone-200 rounded-lg text-sm text-stone-600 hover:bg-stone-50"
                >
                  Replace photo
                </button>
              )}
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="p-4 border-t border-stone-200">
          <div className="flex gap-2">
            <Link href={`/${fundSlug}/${pageData.slug}`} className="flex-1">
              <button className="w-full py-2.5 border border-stone-200 rounded-lg text-sm text-stone-600 hover:bg-stone-50 flex items-center justify-center gap-2">
                <Eye size={14} />
                Preview
              </button>
            </Link>
          </div>
        </div>
      </div>

      {/* Right Panel - Live Preview */}
      <div className="flex-1 p-8 overflow-auto">
        <div className="max-w-md mx-auto">
          
          {/* Preview Header */}
          <div className="flex items-center justify-between mb-4">
            <p className="text-xs font-medium text-stone-400 uppercase tracking-wider">Live Preview</p>
            <div className="flex items-center gap-3">
              <div className="flex text-xs">
                <button 
                  onClick={() => setPreviewStep(0)}
                  className={`px-3 py-1.5 rounded-l border ${previewStep === 0 ? 'bg-stone-900 text-white border-stone-900' : 'bg-white text-stone-500 border-stone-200'}`}
                >
                  Give
                </button>
                <button 
                  onClick={() => setPreviewStep(1)}
                  className={`px-3 py-1.5 border-t border-b ${previewStep === 1 ? 'bg-stone-900 text-white border-stone-900' : 'bg-white text-stone-500 border-stone-200'}`}
                >
                  Details
                </button>
                <button 
                  onClick={() => setPreviewStep(2)}
                  className={`px-3 py-1.5 rounded-r border ${previewStep === 2 ? 'bg-stone-900 text-white border-stone-900' : 'bg-white text-stone-500 border-stone-200'}`}
                >
                  Done
                </button>
              </div>
            </div>
          </div>

          {/* Phone Frame */}
          <div className="bg-stone-900 rounded-[2.5rem] p-3 shadow-2xl">
            <div className={`rounded-[2rem] overflow-hidden ${currentTheme.bg}`}>
              
              {/* Preview Content */}
              <motion.div className={`min-h-[600px] ${currentTheme.text}`} layout>
                
                {/* Step 0: Landing + Amount */}
                {previewStep === 0 && (
                  <div className={pageData.layout === "centered" ? "text-center" : ""}>
                    
                    {/* Hero photo layout */}
                    {pageData.photo && pageData.layout === "hero" && (
                      <div className="h-40 relative">
                        <img src={pageData.photo} alt="" className="w-full h-full object-cover" />
                        <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
                      </div>
                    )}

                    <div className="p-6">
                      {/* Standard photo layout */}
                      {pageData.photo && pageData.layout !== "hero" && (
                        <img 
                          src={pageData.photo} 
                          alt="" 
                          className="w-full aspect-video object-cover rounded-xl mb-5"
                        />
                      )}

                      {/* Avatar (only if no photo) */}
                      {!pageData.photo && (
                        <div className={`w-14 h-14 rounded-full flex items-center justify-center text-lg font-light mb-4 ${currentTheme.accent} ${pageData.theme === "dark" ? "text-stone-900" : "text-white"} ${pageData.layout === "centered" ? "mx-auto" : ""}`}>
                          {fundName.charAt(0)}
                        </div>
                      )}
                      
                      {/* Headline */}
                      <h1 className="text-xl font-medium mb-2 leading-tight">
                        {pageData.headline || `Give to ${fundName}`}
                      </h1>
                      
                      {/* Description */}
                      {pageData.description && (
                        <p className="text-sm opacity-60 mb-4 leading-relaxed">
                          {pageData.description}
                        </p>
                      )}
                      
                      {/* Event title badge */}
                      <p className="text-xs opacity-50 mb-5">{pageData.title}</p>

                      {/* Progress bar */}
                      {pageData.showAmount && (
                        <div className="mb-5">
                          <div className="flex justify-between text-xs mb-1.5">
                            <span className="font-medium">${pageData.currentAmount.toLocaleString()}</span>
                            <span className="opacity-50">of ${pageData.goalAmount.toLocaleString()}</span>
                          </div>
                          <div className={`h-1.5 rounded-full overflow-hidden ${pageData.theme === "dark" ? "bg-white/20" : "bg-stone-200"}`}>
                            <motion.div 
                              initial={{ width: 0 }}
                              animate={{ width: `${Math.min((pageData.currentAmount / pageData.goalAmount) * 100, 100)}%` }}
                              className={currentTheme.accent}
                              style={{ height: "100%" }}
                            />
                          </div>
                        </div>
                      )}

                      {/* Amount buttons - Interactive */}
                      <div className="grid grid-cols-4 gap-1.5 mb-3">
                        {[25, 50, 100, 250].map((a) => (
                          <button
                            key={a}
                            onClick={() => setPreviewAmount(a)}
                            className={`py-2.5 rounded text-xs font-medium transition-all ${
                              previewAmount === a
                                ? `${currentTheme.accent} ${pageData.theme === "dark" ? "text-stone-900" : "text-white"}`
                                : `${pageData.theme === "dark" ? "bg-white/10 text-white hover:bg-white/20" : "bg-white border border-stone-200 hover:border-stone-300"}`
                            }`}
                          >
                            ${a}
                          </button>
                        ))}
                      </div>

                      {/* Custom amount - Interactive */}
                      <div className={`mb-5 px-3 py-2 rounded text-xs text-left flex items-center ${pageData.theme === "dark" ? "bg-white/10" : "bg-white border border-stone-200"}`}>
                        <span className={`mr-1 ${pageData.theme === "dark" ? "text-white/40" : "text-stone-400"}`}>$</span>
                        <input
                          type="text"
                          inputMode="numeric"
                          placeholder="Other"
                          value={![25, 50, 100, 250].includes(previewAmount) ? previewAmount : ""}
                          onChange={(e) => {
                            const val = parseInt(e.target.value) || 0;
                            if (val > 0) setPreviewAmount(val);
                          }}
                          className={`flex-1 bg-transparent focus:outline-none text-xs ${pageData.theme === "dark" ? "text-white placeholder:text-white/40" : "text-stone-900 placeholder:text-stone-400"}`}
                        />
                      </div>

                      {/* Projection - Dynamic */}
                      {previewAmount > 0 && (
                        <div className={`p-4 rounded mb-5 text-left ${pageData.theme === "dark" ? "bg-white/10" : "bg-stone-900 text-white"}`}>
                          <p className={`text-xs mb-1 ${pageData.theme === "dark" ? "text-white/50" : "text-stone-400"}`}>Your ${previewAmount} could become</p>
                          <p className="text-2xl font-light">${previewProjection.toLocaleString()}</p>
                          <p className={`text-xs mt-1 ${pageData.theme === "dark" ? "text-white/40" : "text-stone-500"}`}>in 18 years</p>
                        </div>
                      )}

                      {/* CTA - Advances to next step */}
                      <button 
                        onClick={() => previewAmount >= 5 && setPreviewStep(1)}
                        disabled={previewAmount < 5}
                        className={`w-full py-3 rounded text-sm font-medium transition-all disabled:opacity-40 ${
                          pageData.theme === "dark" 
                            ? "bg-white text-stone-900 hover:bg-stone-100" 
                            : `${currentTheme.accent} text-white hover:opacity-90`
                        }`}
                      >
                        {pageData.buttonText || "Continue"}
                      </button>
                    </div>
                  </div>
                )}

                {/* Step 1: Details - Interactive */}
                {previewStep === 1 && (
                  <div className="p-6">
                    <button 
                      onClick={() => setPreviewStep(0)}
                      className={`text-xs mb-4 ${pageData.theme === "dark" ? "text-white/50 hover:text-white" : "text-stone-400 hover:text-stone-600"}`}
                    >
                      ← Back
                    </button>
                    <p className="text-xs opacity-50 mb-1">Giving ${previewAmount} to {fundName}</p>
                    <h1 className="text-xl font-medium mb-6">Add your details</h1>

                    <div className="space-y-3 mb-5">
                      <div>
                        <p className="text-xs opacity-60 mb-1.5">Your name</p>
                        <input
                          type="text"
                          placeholder="How they'll see you"
                          value={previewName}
                          onChange={(e) => setPreviewName(e.target.value)}
                          className={`w-full px-3 py-2.5 rounded text-xs focus:outline-none ${pageData.theme === "dark" ? "bg-white/10 text-white placeholder:text-white/40" : "bg-white border border-stone-200 text-stone-900 placeholder:text-stone-400"}`}
                        />
                      </div>
                      <div>
                        <p className="text-xs opacity-60 mb-1.5">Add a note (optional)</p>
                        <textarea
                          placeholder="Say something nice..."
                          value={previewNote}
                          onChange={(e) => setPreviewNote(e.target.value)}
                          rows={2}
                          className={`w-full px-3 py-2.5 rounded text-xs resize-none focus:outline-none ${pageData.theme === "dark" ? "bg-white/10 text-white placeholder:text-white/40" : "bg-white border border-stone-200 text-stone-900 placeholder:text-stone-400"}`}
                        />
                      </div>
                    </div>

                    <div className={`p-3 rounded mb-5 ${pageData.theme === "dark" ? "bg-white/10" : "bg-white border border-stone-200"}`}>
                      <div className="flex justify-between text-xs mb-1.5">
                        <span className="opacity-60">Gift amount</span>
                        <span>${previewAmount.toFixed(2)}</span>
                      </div>
                      <div className={`flex justify-between text-xs mb-1.5 pb-2 border-b ${pageData.theme === "dark" ? "border-white/10" : "border-stone-100"}`}>
                        <span className="opacity-60">Platform fee (0%)</span>
                        <span>$0.00</span>
                      </div>
                      <div className="flex justify-between text-xs mb-1">
                        <span className="opacity-60">Payment processing</span>
                        <span>${previewFee.toFixed(2)}</span>
                      </div>
                      <p className={`text-[10px] mb-3 ${pageData.theme === "dark" ? "text-white/30" : "text-stone-400"}`}>
                        2.9% + $0.30 · Paid by contributor
                      </p>
                      <div className={`flex justify-between text-xs font-medium pt-2 border-t ${pageData.theme === "dark" ? "border-white/10" : "border-stone-100"}`}>
                        <span>Total</span>
                        <span>${previewTotal}</span>
                      </div>
                    </div>

                    <button 
                      onClick={() => {
                        setPreviewProcessing(true);
                        setTimeout(() => {
                          setPreviewProcessing(false);
                          setPreviewStep(2);
                        }, 1000);
                      }}
                      disabled={previewProcessing}
                      className={`w-full py-3 rounded text-sm font-medium transition-all ${
                        pageData.theme === "dark" 
                          ? "bg-white text-stone-900 hover:bg-stone-100" 
                          : `${currentTheme.accent} text-white hover:opacity-90`
                      } ${previewProcessing ? "opacity-70" : ""}`}
                    >
                      {previewProcessing ? "Processing..." : `Give $${previewTotal}`}
                    </button>
                  </div>
                )}

                {/* Step 2: Confirmation - Interactive */}
                {previewStep === 2 && (
                  <div className="p-6 text-center flex flex-col items-center justify-center min-h-[500px]">
                    <motion.div
                      initial={{ scale: 0.9, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      className="w-16 h-16 rounded-full bg-emerald-500/20 text-emerald-500 flex items-center justify-center mb-5"
                    >
                      <Check size={28} />
                    </motion.div>
                    <h1 className="text-xl font-medium mb-2">Gift sent!</h1>
                    <p className="text-sm opacity-60 mb-6">
                      Your ${previewAmount} gift to {fundName} is on its way
                    </p>
                    
                    {previewName && (
                      <p className={`text-xs mb-4 ${pageData.theme === "dark" ? "text-white/50" : "text-stone-500"}`}>
                        From: {previewName}
                      </p>
                    )}
                    {previewNote && (
                      <p className={`text-xs italic mb-4 ${pageData.theme === "dark" ? "text-white/40" : "text-stone-400"}`}>
                        "{previewNote}"
                      </p>
                    )}
                    
                    <div className={`w-full p-4 rounded-lg text-left ${pageData.theme === "dark" ? "bg-white/10" : "bg-stone-100"}`}>
                      <p className="text-xs opacity-50 mb-1">Projected value in 18 years</p>
                      <p className="text-2xl font-light">${previewProjection.toLocaleString()}</p>
                    </div>
                    
                    <button 
                      onClick={() => {
                        setPreviewStep(0);
                        setPreviewAmount(50);
                        setPreviewName("");
                        setPreviewNote("");
                      }}
                      className={`mt-6 text-xs ${pageData.theme === "dark" ? "text-white/50 hover:text-white" : "text-stone-400 hover:text-stone-600"}`}
                    >
                      Start over
                    </button>
                  </div>
                )}

              </motion.div>
            </div>
          </div>

          {/* Step indicator */}
          <div className="mt-4 flex justify-center gap-2">
            {[0, 1, 2].map((s) => (
              <div 
                key={s} 
                className={`w-2 h-2 rounded-full transition-colors ${previewStep === s ? 'bg-stone-900' : 'bg-stone-300'}`}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
