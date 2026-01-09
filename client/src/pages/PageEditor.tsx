import { useState, useMemo } from "react";
import { Link, useParams } from "wouter";
import { motion } from "framer-motion";
import { toast } from "@/hooks/use-toast";
import { ArrowLeft, Image, Type, Palette, Eye, Save, Trash2, Plus, Check } from "lucide-react";

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
  
  const [pageData, setPageData] = useState({
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
  });

  const currentTheme = themes.find(t => t.id === pageData.theme) || themes[0];

  const handleSave = () => {
    setIsSaving(true);
    setTimeout(() => {
      setIsSaving(false);
      toast({ title: "Changes saved" });
    }, 800);
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
          
          {/* Page URL */}
          <div className="p-3 bg-stone-50 rounded-lg">
            <p className="text-xs text-stone-400 mb-1">Page URL</p>
            <div className="flex items-center gap-1">
              <span className="text-sm text-stone-500">everleaf.com/{fundSlug}/</span>
              <input
                type="text"
                value={pageData.slug}
                onChange={(e) => setPageData(prev => ({ ...prev, slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "-") }))}
                className="flex-1 text-sm text-stone-900 bg-transparent focus:outline-none font-medium"
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
            <div className="flex gap-2">
              <button className="p-1.5 rounded bg-stone-200 text-stone-600">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <rect x="5" y="2" width="14" height="20" rx="2" />
                </svg>
              </button>
              <button className="p-1.5 rounded text-stone-400 hover:bg-stone-200">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <rect x="2" y="5" width="20" height="14" rx="2" />
                </svg>
              </button>
            </div>
          </div>

          {/* Phone Frame */}
          <div className="bg-stone-900 rounded-[2.5rem] p-3 shadow-2xl">
            <div className="bg-white rounded-[2rem] overflow-hidden">
              
              {/* Preview Content */}
              <motion.div 
                className={`min-h-[600px] ${currentTheme.bg} ${currentTheme.text}`}
                layout
              >
                
                {/* Photo Hero */}
                {pageData.photo && pageData.layout === "hero" && (
                  <div className="h-48 relative">
                    <img src={pageData.photo} alt="" className="w-full h-full object-cover" />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
                  </div>
                )}

                <div className={`p-6 ${pageData.layout === "centered" ? "text-center" : ""}`}>
                  
                  {/* Photo (non-hero) */}
                  {pageData.photo && pageData.layout !== "hero" && (
                    <img 
                      src={pageData.photo} 
                      alt="" 
                      className="w-full aspect-video object-cover rounded-xl mb-6"
                    />
                  )}

                  {/* Fund badge */}
                  <p className="text-xs text-stone-400 uppercase tracking-wider mb-2">
                    {fundName}'s fund
                  </p>

                  {/* Headline */}
                  <h1 className="text-2xl font-medium mb-4 leading-tight">
                    {pageData.headline || "Your headline here"}
                  </h1>

                  {/* Description */}
                  <p className="text-sm opacity-70 mb-6 leading-relaxed">
                    {pageData.description || "Add a description to tell your story"}
                  </p>

                  {/* Progress */}
                  {pageData.showAmount && (
                    <div className="mb-6">
                      <div className="flex justify-between text-sm mb-2">
                        <span className="font-medium">${pageData.currentAmount.toLocaleString()}</span>
                        <span className="opacity-50">of ${pageData.goalAmount.toLocaleString()}</span>
                      </div>
                      <div className="h-2 bg-stone-200 rounded-full overflow-hidden">
                        <motion.div 
                          initial={{ width: 0 }}
                          animate={{ width: `${Math.min((pageData.currentAmount / pageData.goalAmount) * 100, 100)}%` }}
                          className={`h-full ${currentTheme.accent}`}
                        />
                      </div>
                    </div>
                  )}

                  {/* CTA Button */}
                  <button className={`w-full py-3.5 rounded-xl text-sm font-medium ${
                    pageData.theme === "dark" 
                      ? "bg-white text-stone-900" 
                      : "bg-stone-900 text-white"
                  }`}>
                    {pageData.buttonText || "Give a gift"}
                  </button>

                  {/* Footer */}
                  <p className="text-xs opacity-40 mt-6 text-center">
                    Powered by Everleaf
                  </p>
                </div>
              </motion.div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
