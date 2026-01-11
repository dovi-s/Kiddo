import { useState, useMemo, useEffect } from "react";
import { Link, useParams } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "@/hooks/use-toast";
import { ArrowLeft, Image, Type, Palette, Eye, Save, Trash2, Plus, Check, Pencil, X, ChevronUp, ChevronDown } from "lucide-react";

interface PageData {
  title: string;
  slug: string;
  headline: string;
  description: string;
  buttonText: string;
  theme: string;
  layout: string;
  photo: string | null;
  showAmount: boolean;
  goalAmount: number;
  currentAmount: number;
}

const getStoredPageData = (key: string): PageData | null => {
  try {
    const stored = localStorage.getItem(`kora_page_${key}`);
    return stored ? JSON.parse(stored) : null;
  } catch { return null; }
};

const setStoredPageData = (key: string, data: PageData) => {
  try {
    localStorage.setItem(`kora_page_${key}`, JSON.stringify(data));
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
  
  const storageKey = `${fundSlug}_${eventSlug}`;
  
  const initialData = useMemo(() => {
    const data = eventDataMap[eventSlug] || eventDataMap["anytime"];
    return data;
  }, [eventSlug]);

  const fundName = fundSlug
    .split("-")
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
  
  const [activeTab, setActiveTab] = useState<"content" | "style" | "photo">("content");
  const [isSaving, setIsSaving] = useState(false);
  const [previewStep, setPreviewStep] = useState(0);
  const [mobileControlsOpen, setMobileControlsOpen] = useState(false);
  
  const [previewAmount, setPreviewAmount] = useState(50);
  const [previewName, setPreviewName] = useState("");
  const [previewNote, setPreviewNote] = useState("");
  const [previewProcessing, setPreviewProcessing] = useState(false);
  
  const previewProjection = Math.round(previewAmount * 4.6);
  const previewFee = Math.round(previewAmount * 0.029 * 100) / 100 + 0.30;
  const previewTotal = (previewAmount + previewFee).toFixed(2);
  
  const [pageData, setPageData] = useState<PageData>(() => {
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
      photo: null,
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

  const ControlPanel = () => (
    <div className="flex flex-col h-full">
      <div className="flex border-b border-stone-200">
        {[
          { id: "content", label: "Content", icon: Type },
          { id: "style", label: "Style", icon: Palette },
          { id: "photo", label: "Photo", icon: Image },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as any)}
            data-testid={`tab-${tab.id}`}
            className={`flex-1 py-3 text-sm font-medium flex items-center justify-center gap-2 border-b-2 transition-colors ${
              activeTab === tab.id
                ? "text-stone-900 border-stone-900"
                : "text-stone-400 border-transparent hover:text-stone-600"
            }`}
          >
            <tab.icon size={14} />
            <span className="hidden sm:inline">{tab.label}</span>
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-auto p-4">
        {activeTab === "content" && (
          <div className="space-y-5">
            <div>
              <label className="block text-xs font-medium text-stone-500 uppercase tracking-wider mb-2">
                Event Name
              </label>
              <input
                type="text"
                value={pageData.title}
                onChange={(e) => setPageData(prev => ({ ...prev, title: e.target.value }))}
                data-testid="input-event-name"
                className="w-full px-3 py-2.5 border border-stone-200 rounded-lg text-stone-900 focus:outline-none focus:border-stone-400"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-stone-500 uppercase tracking-wider mb-2">
                Headline
              </label>
              <textarea
                value={pageData.headline}
                onChange={(e) => setPageData(prev => ({ ...prev, headline: e.target.value }))}
                rows={2}
                data-testid="input-headline"
                className="w-full px-3 py-2.5 border border-stone-200 rounded-lg text-stone-900 focus:outline-none focus:border-stone-400 resize-none"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-stone-500 uppercase tracking-wider mb-2">
                Description
              </label>
              <textarea
                value={pageData.description}
                onChange={(e) => setPageData(prev => ({ ...prev, description: e.target.value }))}
                rows={3}
                data-testid="input-description"
                className="w-full px-3 py-2.5 border border-stone-200 rounded-lg text-stone-900 focus:outline-none focus:border-stone-400 resize-none"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-stone-500 uppercase tracking-wider mb-2">
                Button Text
              </label>
              <input
                type="text"
                value={pageData.buttonText}
                onChange={(e) => setPageData(prev => ({ ...prev, buttonText: e.target.value }))}
                data-testid="input-button-text"
                className="w-full px-3 py-2.5 border border-stone-200 rounded-lg text-stone-900 focus:outline-none focus:border-stone-400"
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-xs font-medium text-stone-500 uppercase tracking-wider">
                  Show Goal Progress
                </label>
                <button
                  onClick={() => setPageData(prev => ({ ...prev, showAmount: !prev.showAmount }))}
                  data-testid="toggle-show-goal"
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
                      data-testid="input-goal-amount"
                      className="w-full px-3 py-2 border border-stone-200 rounded-lg text-stone-900 focus:outline-none focus:border-stone-400"
                    />
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === "style" && (
          <div className="space-y-5">
            <div>
              <label className="block text-xs font-medium text-stone-500 uppercase tracking-wider mb-3">
                Theme
              </label>
              <div className="grid grid-cols-3 gap-2">
                {themes.map((theme) => (
                  <button
                    key={theme.id}
                    onClick={() => setPageData(prev => ({ ...prev, theme: theme.id }))}
                    data-testid={`theme-${theme.id}`}
                    className={`p-2.5 rounded-lg border-2 transition-all ${
                      pageData.theme === theme.id
                        ? "border-stone-900"
                        : "border-stone-200 hover:border-stone-300"
                    }`}
                  >
                    <div className={`h-6 rounded ${theme.bg} mb-1.5 flex items-center justify-center`}>
                      <div className={`w-5 h-0.5 rounded ${theme.accent}`} />
                    </div>
                    <p className="text-[10px] text-stone-600">{theme.name}</p>
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-stone-500 uppercase tracking-wider mb-3">
                Layout
              </label>
              <div className="space-y-2">
                {layouts.map((layout) => (
                  <button
                    key={layout.id}
                    onClick={() => setPageData(prev => ({ ...prev, layout: layout.id }))}
                    data-testid={`layout-${layout.id}`}
                    className={`w-full p-2.5 rounded-lg border-2 flex items-center gap-3 transition-all ${
                      pageData.layout === layout.id
                        ? "border-stone-900 bg-stone-50"
                        : "border-stone-200 hover:border-stone-300"
                    }`}
                  >
                    <span className="text-lg">{layout.icon}</span>
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
                  data-testid="button-remove-photo"
                  className="absolute top-2 right-2 p-2 bg-white/90 rounded-lg hover:bg-white"
                >
                  <Trash2 size={14} className="text-stone-600" />
                </button>
              </div>
            ) : (
              <button
                onClick={handlePhotoUpload}
                data-testid="button-add-photo"
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
                data-testid="button-replace-photo"
                className="w-full py-2.5 border border-stone-200 rounded-lg text-sm text-stone-600 hover:bg-stone-50"
              >
                Replace photo
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );

  const Preview = () => (
    <div className={`min-h-[500px] lg:min-h-[600px] ${currentTheme.text}`}>
      {previewStep === 0 && (
        <div className={pageData.layout === "centered" ? "text-center" : ""}>
          {pageData.photo && pageData.layout === "hero" && (
            <div className="h-32 lg:h-40 relative">
              <img src={pageData.photo} alt="" className="w-full h-full object-cover" />
              <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
            </div>
          )}

          <div className="p-5 lg:p-6">
            {pageData.photo && pageData.layout !== "hero" && (
              <img 
                src={pageData.photo} 
                alt="" 
                className="w-full aspect-video object-cover rounded-xl mb-4"
              />
            )}

            {!pageData.photo && (
              <div className={`w-12 h-12 lg:w-14 lg:h-14 rounded-full flex items-center justify-center text-base lg:text-lg font-light mb-3 lg:mb-4 ${currentTheme.accent} ${pageData.theme === "dark" ? "text-stone-900" : "text-white"} ${pageData.layout === "centered" ? "mx-auto" : ""}`}>
                {fundName.charAt(0)}
              </div>
            )}
            
            <h1 className="text-lg lg:text-xl font-medium mb-2 leading-tight">
              {pageData.headline || `Give to ${fundName}`}
            </h1>
            
            {pageData.description && (
              <p className="text-xs lg:text-sm opacity-60 mb-3 lg:mb-4 leading-relaxed">
                {pageData.description}
              </p>
            )}
            
            <p className="text-[10px] lg:text-xs opacity-50 mb-4 lg:mb-5">{pageData.title}</p>

            {pageData.showAmount && (
              <div className="mb-4 lg:mb-5">
                <div className="flex justify-between text-[10px] lg:text-xs mb-1">
                  <span className="font-medium">${pageData.currentAmount.toLocaleString()}</span>
                  <span className="opacity-50">of ${pageData.goalAmount.toLocaleString()}</span>
                </div>
                <div className={`h-1 lg:h-1.5 rounded-full overflow-hidden ${pageData.theme === "dark" ? "bg-white/20" : "bg-stone-200"}`}>
                  <motion.div 
                    initial={{ width: 0 }}
                    animate={{ width: `${Math.min((pageData.currentAmount / pageData.goalAmount) * 100, 100)}%` }}
                    className={currentTheme.accent}
                    style={{ height: "100%" }}
                  />
                </div>
              </div>
            )}

            <div className="grid grid-cols-4 gap-1 lg:gap-1.5 mb-2 lg:mb-3">
              {[25, 50, 100, 250].map((a) => (
                <button
                  key={a}
                  onClick={() => setPreviewAmount(a)}
                  data-testid={`preview-amount-${a}`}
                  className={`py-2 lg:py-2.5 rounded text-[10px] lg:text-xs font-medium transition-all ${
                    previewAmount === a
                      ? `${currentTheme.accent} ${pageData.theme === "dark" ? "text-stone-900" : "text-white"}`
                      : `${pageData.theme === "dark" ? "bg-white/10 text-white hover:bg-white/20" : "bg-white border border-stone-200 hover:border-stone-300"}`
                  }`}
                >
                  ${a}
                </button>
              ))}
            </div>

            <div className={`mb-4 lg:mb-5 px-3 py-2 rounded text-xs text-left flex items-center ${pageData.theme === "dark" ? "bg-white/10" : "bg-white border border-stone-200"}`}>
              <span className={`mr-1 ${pageData.theme === "dark" ? "text-white/40" : "text-stone-400"}`}>$</span>
              <input
                type="text"
                inputMode="numeric"
                value={previewAmount}
                onChange={(e) => {
                  const val = parseInt(e.target.value) || 0;
                  if (val > 0) setPreviewAmount(val);
                }}
                data-testid="preview-custom-amount"
                className={`bg-transparent outline-none flex-1 ${pageData.theme === "dark" ? "text-white" : "text-stone-900"}`}
              />
            </div>

            {previewAmount > 0 && (
              <div className={`p-3 lg:p-4 rounded mb-4 lg:mb-5 ${pageData.theme === "dark" ? "bg-white/10" : "bg-stone-100"}`}>
                <p className={`text-[10px] lg:text-xs ${pageData.theme === "dark" ? "text-white/60" : "text-stone-500"}`}>
                  Your ${previewAmount} could become
                </p>
                <p className="text-xl lg:text-2xl font-light">${previewProjection.toLocaleString()}</p>
                <p className={`text-[10px] lg:text-xs ${pageData.theme === "dark" ? "text-white/40" : "text-stone-400"}`}>
                  in 18 years at 7% return
                </p>
              </div>
            )}

            <button
              onClick={() => setPreviewStep(1)}
              data-testid="preview-continue"
              className={`w-full py-2.5 lg:py-3 rounded text-xs lg:text-sm font-medium transition-colors ${currentTheme.accent} ${pageData.theme === "dark" ? "text-stone-900" : "text-white"}`}
            >
              {pageData.buttonText}
            </button>
          </div>
        </div>
      )}

      {previewStep === 1 && (
        <div className="p-5 lg:p-6">
          <button 
            onClick={() => setPreviewStep(0)}
            data-testid="preview-back-step1"
            className={`text-[10px] lg:text-xs mb-4 lg:mb-6 ${pageData.theme === "dark" ? "text-white/60" : "text-stone-500"}`}
          >
            ← Back
          </button>

          <p className={`text-[10px] lg:text-xs ${pageData.theme === "dark" ? "text-white/60" : "text-stone-500"}`}>
            Giving ${previewAmount} to {fundName}
          </p>
          <h2 className="text-base lg:text-lg font-medium mb-4 lg:mb-6">Add your details</h2>

          <div className="space-y-3 lg:space-y-4 mb-4 lg:mb-6">
            <div>
              <label className={`block text-[10px] lg:text-xs mb-1.5 ${pageData.theme === "dark" ? "text-white/60" : "text-stone-500"}`}>
                Your name
              </label>
              <input
                type="text"
                placeholder="How they'll see you"
                value={previewName}
                onChange={(e) => setPreviewName(e.target.value)}
                data-testid="preview-input-name"
                className={`w-full px-3 py-2 lg:py-2.5 rounded text-xs lg:text-sm ${
                  pageData.theme === "dark" 
                    ? "bg-white/10 text-white placeholder:text-white/30 border-0" 
                    : "bg-white border border-stone-200 text-stone-900"
                } focus:outline-none`}
              />
            </div>
            <div>
              <label className={`block text-[10px] lg:text-xs mb-1.5 ${pageData.theme === "dark" ? "text-white/60" : "text-stone-500"}`}>
                Add a note (optional)
              </label>
              <textarea
                placeholder="A message for them..."
                value={previewNote}
                onChange={(e) => setPreviewNote(e.target.value)}
                rows={2}
                data-testid="preview-input-note"
                className={`w-full px-3 py-2 lg:py-2.5 rounded text-xs lg:text-sm resize-none ${
                  pageData.theme === "dark" 
                    ? "bg-white/10 text-white placeholder:text-white/30 border-0" 
                    : "bg-white border border-stone-200 text-stone-900"
                } focus:outline-none`}
              />
            </div>
          </div>

          <div className={`p-3 rounded mb-4 lg:mb-5 space-y-1.5 ${pageData.theme === "dark" ? "bg-white/5" : "bg-white border border-stone-200"}`}>
            <div className="flex justify-between text-[10px] lg:text-xs">
              <span className={pageData.theme === "dark" ? "text-white/60" : "text-stone-500"}>Gift amount</span>
              <span>${previewAmount.toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-[10px] lg:text-xs">
              <span className={pageData.theme === "dark" ? "text-white/60" : "text-stone-500"}>Processing</span>
              <span>${previewFee.toFixed(2)}</span>
            </div>
            <div className={`flex justify-between text-xs lg:text-sm font-medium pt-1.5 ${pageData.theme === "dark" ? "border-t border-white/10" : "border-t border-stone-100"}`}>
              <span>Total</span>
              <span>${previewTotal}</span>
            </div>
          </div>

          <button
            onClick={() => {
              if (!previewName) return;
              setPreviewProcessing(true);
              setTimeout(() => {
                setPreviewProcessing(false);
                setPreviewStep(2);
              }, 1000);
            }}
            disabled={!previewName || previewProcessing}
            data-testid="preview-pay"
            className={`w-full py-2.5 lg:py-3 rounded text-xs lg:text-sm font-medium transition-all ${
              !previewName || previewProcessing ? "opacity-50" : ""
            } ${currentTheme.accent} ${pageData.theme === "dark" ? "text-stone-900" : "text-white"}`}
          >
            {previewProcessing ? "Processing..." : `Pay $${previewTotal}`}
          </button>
        </div>
      )}

      {previewStep === 2 && (
        <div className="p-5 lg:p-6 text-center pt-10 lg:pt-16">
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
          >
            <div className={`w-12 h-12 lg:w-14 lg:h-14 rounded-full mx-auto mb-4 lg:mb-5 flex items-center justify-center ${
              pageData.theme === "dark" ? "bg-emerald-900" : "bg-emerald-100"
            }`}>
              <svg className={`w-5 h-5 lg:w-6 lg:h-6 ${pageData.theme === "dark" ? "text-emerald-400" : "text-emerald-700"}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h2 className="text-base lg:text-lg font-medium mb-1.5 lg:mb-2">Gift sent</h2>
            <p className={`text-xs lg:text-sm ${pageData.theme === "dark" ? "text-white/60" : "text-stone-500"}`}>
              You gave ${previewAmount} to {fundName}'s future
            </p>
          </motion.div>

          <button
            onClick={() => {
              setPreviewStep(0);
              setPreviewName("");
              setPreviewNote("");
              setPreviewAmount(50);
            }}
            data-testid="preview-start-over"
            className={`mt-6 lg:mt-8 text-[10px] lg:text-xs ${pageData.theme === "dark" ? "text-white/40 hover:text-white/60" : "text-stone-400 hover:text-stone-600"}`}
          >
            Start over
          </button>
        </div>
      )}
    </div>
  );

  return (
    <div className="min-h-screen bg-stone-100 flex flex-col lg:flex-row">
      
      {/* Desktop: Left Panel - Controls */}
      <div className="hidden lg:flex w-80 bg-white border-r border-stone-200 flex-col">
        <div className="p-4 border-b border-stone-200">
          <div className="flex items-center justify-between mb-3">
            <button 
              onClick={() => window.history.back()}
              data-testid="button-back-desktop"
              className="flex items-center gap-2 text-sm text-stone-500 hover:text-stone-900 transition-colors"
            >
              <ArrowLeft size={16} />
              <span>Back</span>
            </button>
            <button
              onClick={handleSave}
              disabled={isSaving}
              data-testid="button-save-desktop"
              className="flex items-center gap-2 px-4 py-2 bg-stone-900 text-white text-sm rounded-lg hover:bg-stone-800 disabled:opacity-50 transition-colors"
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
          
          <div className="space-y-2">
            <p className="text-xs text-stone-400">Event URL</p>
            <div className="flex items-center gap-0 border border-stone-200 rounded-lg overflow-hidden bg-white">
              <span className="text-xs text-stone-400 bg-stone-50 px-3 py-2.5 border-r border-stone-200 whitespace-nowrap">
                kora.com/{fundSlug}/
              </span>
              <input
                type="text"
                value={pageData.slug}
                onChange={(e) => setPageData(prev => ({ ...prev, slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "-") }))}
                data-testid="input-event-slug"
                className="flex-1 text-sm text-stone-900 px-3 py-2 focus:outline-none min-w-0"
                placeholder="event-name"
              />
            </div>
          </div>
        </div>

        <ControlPanel />

        <div className="p-4 border-t border-stone-200">
          <Link href={`/${fundSlug}/${pageData.slug}`} className="block">
            <button 
              data-testid="button-preview-desktop"
              className="w-full py-2.5 border border-stone-200 rounded-lg text-sm text-stone-600 hover:bg-stone-50 flex items-center justify-center gap-2 transition-colors"
            >
              <Eye size={14} />
              Full Preview
            </button>
          </Link>
        </div>
      </div>

      {/* Mobile Header */}
      <header className="lg:hidden sticky top-0 z-50 bg-white border-b border-stone-200">
        <div className="px-4 h-14 flex items-center justify-between">
          <button 
            onClick={() => window.history.back()}
            data-testid="button-back-mobile"
            className="flex items-center gap-1.5 text-sm text-stone-500"
          >
            <ArrowLeft size={16} />
            <span>Back</span>
          </button>
          <span className="text-sm font-medium text-stone-900 truncate max-w-32">{pageData.title}</span>
          <button
            onClick={handleSave}
            disabled={isSaving}
            data-testid="button-save-mobile"
            className="px-3 py-1.5 bg-stone-900 text-white text-sm rounded-lg disabled:opacity-50"
          >
            {isSaving ? "..." : "Save"}
          </button>
        </div>
      </header>

      {/* Preview Area */}
      <div className="flex-1 lg:p-8 overflow-auto pb-24 lg:pb-0">
        <div className="lg:max-w-md lg:mx-auto">
          
          {/* Desktop Preview Header */}
          <div className="hidden lg:flex items-center justify-between mb-4">
            <p className="text-xs font-medium text-stone-400 uppercase tracking-wider">Live Preview</p>
            <div className="flex items-center gap-3">
              <div className="flex text-xs">
                <button 
                  onClick={() => setPreviewStep(0)}
                  data-testid="preview-tab-give"
                  className={`px-3 py-1.5 rounded-l border transition-colors ${previewStep === 0 ? 'bg-stone-900 text-white border-stone-900' : 'bg-white text-stone-500 border-stone-200 hover:bg-stone-50'}`}
                >
                  Give
                </button>
                <button 
                  onClick={() => setPreviewStep(1)}
                  data-testid="preview-tab-details"
                  className={`px-3 py-1.5 border-t border-b transition-colors ${previewStep === 1 ? 'bg-stone-900 text-white border-stone-900' : 'bg-white text-stone-500 border-stone-200 hover:bg-stone-50'}`}
                >
                  Details
                </button>
                <button 
                  onClick={() => setPreviewStep(2)}
                  data-testid="preview-tab-done"
                  className={`px-3 py-1.5 rounded-r border transition-colors ${previewStep === 2 ? 'bg-stone-900 text-white border-stone-900' : 'bg-white text-stone-500 border-stone-200 hover:bg-stone-50'}`}
                >
                  Done
                </button>
              </div>
            </div>
          </div>

          {/* Phone Frame - Desktop */}
          <div className="hidden lg:block bg-stone-900 rounded-[2.5rem] p-3 shadow-2xl">
            <div className={`rounded-[2rem] overflow-hidden ${currentTheme.bg}`}>
              <Preview />
            </div>
          </div>

          {/* Mobile Preview - No frame, full width */}
          <div className={`lg:hidden ${currentTheme.bg} min-h-[calc(100vh-56px-80px)]`}>
            <Preview />
          </div>
        </div>
      </div>

      {/* Mobile Bottom Controls */}
      <div className="lg:hidden fixed bottom-0 left-0 right-0 z-50">
        <AnimatePresence>
          {mobileControlsOpen && (
            <motion.div
              initial={{ height: 0 }}
              animate={{ height: "60vh" }}
              exit={{ height: 0 }}
              className="bg-white border-t border-stone-200 overflow-hidden"
            >
              <div className="h-full overflow-auto">
                <ControlPanel />
              </div>
            </motion.div>
          )}
        </AnimatePresence>
        
        <div className="bg-white border-t border-stone-200 px-4 py-3 flex items-center justify-between gap-3">
          <button
            onClick={() => setMobileControlsOpen(!mobileControlsOpen)}
            data-testid="button-toggle-controls"
            className="flex-1 py-2.5 border border-stone-200 rounded-lg text-sm text-stone-600 flex items-center justify-center gap-2"
          >
            {mobileControlsOpen ? <ChevronDown size={16} /> : <ChevronUp size={16} />}
            <span>{mobileControlsOpen ? "Close" : "Edit"}</span>
          </button>
          <Link href={`/${fundSlug}/${pageData.slug}`} className="flex-1">
            <button 
              data-testid="button-preview-mobile"
              className="w-full py-2.5 bg-stone-900 text-white rounded-lg text-sm flex items-center justify-center gap-2"
            >
              <Eye size={14} />
              <span>Preview</span>
            </button>
          </Link>
        </div>
      </div>
    </div>
  );
}
