import { useState } from "react";
import { useLocation, useParams } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Plus, Heart, Gift, Camera, Star, MessageCircle, X, Calendar } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Logo } from "@/components/ui/logo";
import { GeminiSparkle, GradientText, EnlighteningReveal } from "@/components/ui/gemini";
import { haptic } from "@/lib/haptics";
import { useAuth } from "@/hooks/use-auth";

interface MemoryEntry {
  id: string;
  fundId: string;
  giftId: string | null;
  type: string;
  content: string | null;
  authorName: string | null;
  photoUrl: string | null;
  createdAt: string;
  gift?: {
    senderName: string;
    amount: string;
    message: string | null;
    photoUrl: string | null;
    createdAt: string;
  } | null;
}

const typeConfig: Record<string, { icon: typeof Gift; color: string; dotColor: string; label: string }> = {
  gift_message: { icon: Gift, color: "text-[hsl(var(--kora-evergreen))]", dotColor: "bg-[hsl(var(--kora-evergreen))]", label: "Gift" },
  milestone: { icon: Star, color: "text-blue-500", dotColor: "bg-blue-500", label: "Milestone" },
  photo: { icon: Camera, color: "text-purple-500", dotColor: "bg-purple-500", label: "Photo" },
  note: { icon: MessageCircle, color: "text-gray-400", dotColor: "bg-gray-400", label: "Note" },
};

function formatDate(dateStr: string) {
  const d = new Date(dateStr);
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function growthPercent(giftDate: string) {
  const then = new Date(giftDate).getTime();
  const now = Date.now();
  const years = (now - then) / (365.25 * 24 * 60 * 60 * 1000);
  if (years < 0.01) return null;
  const growth = ((1 + 0.08) ** years - 1) * 100;
  return Math.round(growth * 10) / 10;
}

export default function MemoryBook() {
  const { fundId } = useParams<{ fundId: string }>();
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const { user } = useAuth();

  const [showModal, setShowModal] = useState(false);
  const [entryType, setEntryType] = useState<"milestone" | "photo" | "note">("milestone");
  const [content, setContent] = useState("");
  const [authorName, setAuthorName] = useState(user?.firstName || "");
  const [photoUrl, setPhotoUrl] = useState("");

  const { data: entries = [], isLoading } = useQuery<MemoryEntry[]>({
    queryKey: ["memory", fundId],
    queryFn: async () => {
      const res = await fetch(`/api/funds/${fundId}/memory`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch memories");
      return res.json();
    },
    enabled: !!fundId,
  });

  const { data: fundData } = useQuery<{ name: string }>({
    queryKey: ["fund", fundId],
    queryFn: async () => {
      const res = await fetch(`/api/funds`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch funds");
      const funds = await res.json();
      return funds.find((f: any) => f.id === fundId) || { name: "Fund" };
    },
    enabled: !!fundId,
  });

  const createMutation = useMutation({
    mutationFn: async (body: { type: string; content: string; authorName: string; photoUrl?: string }) => {
      const res = await fetch(`/api/funds/${fundId}/memory`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error("Failed to create entry");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["memory", fundId] });
      setShowModal(false);
      setContent("");
      setPhotoUrl("");
      setEntryType("milestone");
      haptic("success");
    },
  });

  const handleSubmit = () => {
    if (!content.trim()) return;
    createMutation.mutate({
      type: entryType,
      content: content.trim(),
      authorName: authorName.trim() || "Parent",
      photoUrl: photoUrl.trim() || undefined,
    });
  };

  const sortedEntries = [...entries].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );

  const fundName = fundData?.name || "Fund";

  return (
    <div className="min-h-screen bg-background gemini-warm-section md:ml-[220px] lg:ml-[260px] pb-24 md:pb-8" data-testid="page-memory-book">
      <motion.header
        className="sticky top-0 z-50 gemini-glass-nav"
        initial={{ y: -20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.2 }}
      >
        <div className="max-w-lg md:max-w-3xl mx-auto px-4 h-14 flex items-center gap-3">
          <button
            onClick={() => { haptic("selection"); setLocation("/dashboard"); }}
            className="p-2 -ml-2 rounded-xl hover:bg-muted transition-colors"
            data-testid="button-back-dashboard"
          >
            <ArrowLeft size={20} className="text-foreground" />
          </button>
          <div className="flex-1 min-w-0">
            <p className="text-xs text-muted-foreground truncate" data-testid="text-fund-name">{fundName}'s Fund</p>
            <h1 className="text-base font-bold font-heading text-foreground" data-testid="text-page-title">Memory Book</h1>
          </div>
          <Logo size="sm" className="text-primary md:hidden" />
        </div>
      </motion.header>

      <main className="max-w-lg md:max-w-3xl mx-auto px-4 py-6">
        <EnlighteningReveal>
          <div className="flex items-center justify-between mb-8">
            <div>
              <h2 className="text-2xl font-heading font-bold text-foreground" data-testid="text-memory-heading">
                <GradientText>Memories</GradientText>
              </h2>
              <p className="text-sm text-muted-foreground mt-1">Every gift tells a story</p>
            </div>
            <Button
              onClick={() => { haptic("selection"); setShowModal(true); }}
              size="sm"
              className="gap-1.5 rounded-xl"
              data-testid="button-add-entry"
            >
              <Plus size={16} />
              Add Entry
            </Button>
          </div>
        </EnlighteningReveal>

        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-16 gap-4">
            <motion.div
              className="w-8 h-8 border-2 border-primary/30 border-t-primary rounded-full"
              animate={{ rotate: 360 }}
              transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
            />
            <p className="text-sm text-muted-foreground">Loading memories...</p>
          </div>
        ) : sortedEntries.length === 0 ? (
          <EnlighteningReveal delay={0.1}>
            <div className="text-center py-16 px-6" data-testid="empty-state-memory">
              <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-muted flex items-center justify-center">
                <Heart size={28} className="text-muted-foreground" />
              </div>
              <h3 className="text-lg font-heading font-semibold text-foreground mb-2">No memories yet</h3>
              <p className="text-sm text-muted-foreground max-w-sm mx-auto">
                Share your fund link to start collecting gifts, or add a milestone to begin your story.
              </p>
              <Button
                onClick={() => { haptic("selection"); setShowModal(true); }}
                variant="outline"
                className="mt-6 gap-1.5 rounded-xl"
                data-testid="button-add-first-entry"
              >
                <Plus size={16} />
                Add your first memory
              </Button>
            </div>
          </EnlighteningReveal>
        ) : (
          <div className="relative" data-testid="timeline-container">
            <div className="absolute left-[19px] top-0 bottom-0 w-[2px] bg-border/60" />

            {sortedEntries.map((entry, index) => {
              const config = typeConfig[entry.type] || typeConfig.note;
              const IconComp = config.icon;
              const growth = entry.type === "gift_message" && entry.gift?.createdAt
                ? growthPercent(entry.gift.createdAt)
                : null;

              return (
                <EnlighteningReveal key={entry.id} delay={index * 0.05}>
                  <div className="relative pl-12 pb-8" data-testid={`memory-entry-${entry.id}`}>
                    <div className={`absolute left-[12px] top-1 w-[16px] h-[16px] rounded-full ${config.dotColor} border-2 border-background z-10 flex items-center justify-center`}>
                      <div className="w-[6px] h-[6px] rounded-full bg-white/80" />
                    </div>

                    <motion.div
                      className="bg-card rounded-2xl border border-border/50 shadow-premium-sm overflow-hidden"
                      whileHover={{ y: -1 }}
                      transition={{ duration: 0.15 }}
                    >
                      {entry.type === "gift_message" && entry.gift && (
                        <div className="p-5">
                          <div className="flex items-center gap-2 mb-3">
                            <div className="w-8 h-8 rounded-full bg-[hsl(var(--kora-evergreen)/0.1)] flex items-center justify-center">
                              <Gift size={14} className="text-[hsl(var(--kora-evergreen))]" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-semibold text-foreground" data-testid={`text-sender-${entry.id}`}>
                                {entry.gift.senderName}
                              </p>
                              <p className="text-xs text-muted-foreground">{formatDate(entry.createdAt)}</p>
                            </div>
                            <span className="text-sm font-bold text-[hsl(var(--kora-evergreen))]" data-testid={`text-amount-${entry.id}`}>
                              ${parseFloat(entry.gift.amount).toLocaleString()}
                            </span>
                          </div>
                          {entry.gift.message && (
                            <p className="text-sm text-foreground/80 mb-3 italic" data-testid={`text-message-${entry.id}`}>
                              "{entry.gift.message}"
                            </p>
                          )}
                          {(entry.gift.photoUrl || entry.photoUrl) && (
                            <div className="rounded-xl overflow-hidden mb-3">
                              <img
                                src={entry.gift.photoUrl || entry.photoUrl || ""}
                                alt="Gift photo"
                                className="w-full h-48 object-cover"
                                data-testid={`img-photo-${entry.id}`}
                              />
                            </div>
                          )}
                          {growth !== null && growth > 0 && (
                            <div className="flex items-center gap-1.5 text-xs text-[hsl(var(--kora-evergreen))] bg-[hsl(var(--kora-evergreen)/0.08)] rounded-lg px-3 py-1.5 w-fit">
                              <GeminiSparkle size={12} />
                              <span data-testid={`text-growth-${entry.id}`}>This gift has grown {growth}% since then</span>
                            </div>
                          )}
                        </div>
                      )}

                      {entry.type === "milestone" && (
                        <div className="p-5">
                          <div className="flex items-center gap-2 mb-2">
                            <div className="w-8 h-8 rounded-full bg-blue-500/10 flex items-center justify-center">
                              <Star size={14} className="text-blue-500" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-xs text-muted-foreground">{formatDate(entry.createdAt)}</p>
                            </div>
                          </div>
                          <h3 className="text-base font-heading font-semibold text-foreground mb-1" data-testid={`text-milestone-${entry.id}`}>
                            {entry.content}
                          </h3>
                          {entry.authorName && (
                            <p className="text-xs text-muted-foreground" data-testid={`text-author-${entry.id}`}>
                              Added by {entry.authorName}
                            </p>
                          )}
                          {entry.photoUrl && (
                            <div className="rounded-xl overflow-hidden mt-3">
                              <img
                                src={entry.photoUrl}
                                alt="Milestone photo"
                                className="w-full h-48 object-cover"
                                data-testid={`img-milestone-${entry.id}`}
                              />
                            </div>
                          )}
                        </div>
                      )}

                      {entry.type === "photo" && (
                        <div>
                          {entry.photoUrl && (
                            <img
                              src={entry.photoUrl}
                              alt={entry.content || "Photo"}
                              className="w-full h-56 object-cover"
                              data-testid={`img-photo-entry-${entry.id}`}
                            />
                          )}
                          <div className="p-4">
                            {entry.content && (
                              <p className="text-sm text-foreground/80" data-testid={`text-caption-${entry.id}`}>{entry.content}</p>
                            )}
                            <p className="text-xs text-muted-foreground mt-1">{formatDate(entry.createdAt)}</p>
                          </div>
                        </div>
                      )}

                      {entry.type === "note" && (
                        <div className="p-5">
                          <div className="flex items-center gap-2 mb-2">
                            <div className="w-8 h-8 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center">
                              <MessageCircle size={14} className="text-gray-400" />
                            </div>
                            <p className="text-xs text-muted-foreground">{formatDate(entry.createdAt)}</p>
                          </div>
                          <p className="text-sm text-foreground/80" data-testid={`text-note-${entry.id}`}>{entry.content}</p>
                          {entry.authorName && (
                            <p className="text-xs text-muted-foreground mt-2" data-testid={`text-note-author-${entry.id}`}>
                              {entry.authorName}
                            </p>
                          )}
                        </div>
                      )}
                    </motion.div>
                  </div>
                </EnlighteningReveal>
              );
            })}
          </div>
        )}
      </main>

      <AnimatePresence>
        {showModal && (
          <motion.div
            className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <motion.div
              className="absolute inset-0 bg-black/40 backdrop-blur-sm"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowModal(false)}
              data-testid="modal-overlay"
            />
            <motion.div
              className="relative w-full max-w-md bg-card rounded-t-3xl sm:rounded-2xl border border-border/50 shadow-premium-lg overflow-hidden"
              initial={{ y: 100, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 100, opacity: 0 }}
              transition={{ type: "spring", damping: 25, stiffness: 300 }}
            >
              <div className="flex items-center justify-between p-5 border-b border-border/50">
                <h2 className="text-lg font-heading font-bold text-foreground" data-testid="text-modal-title">Add Memory</h2>
                <button
                  onClick={() => setShowModal(false)}
                  className="p-1.5 rounded-lg hover:bg-muted transition-colors"
                  data-testid="button-close-modal"
                >
                  <X size={18} className="text-muted-foreground" />
                </button>
              </div>

              <div className="p-5 space-y-5">
                <div>
                  <label className="text-sm font-medium text-foreground mb-2 block">Type</label>
                  <div className="flex gap-2">
                    {(["milestone", "photo", "note"] as const).map((t) => {
                      const cfg = typeConfig[t];
                      const Icon = cfg.icon;
                      const isActive = entryType === t;
                      return (
                        <button
                          key={t}
                          onClick={() => { haptic("selection"); setEntryType(t); }}
                          className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-sm font-medium transition-all ${
                            isActive
                              ? "bg-primary text-primary-foreground shadow-sm"
                              : "bg-muted text-muted-foreground hover:bg-muted/80"
                          }`}
                          data-testid={`button-type-${t}`}
                        >
                          <Icon size={14} />
                          {cfg.label}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div>
                  <label className="text-sm font-medium text-foreground mb-2 block">
                    {entryType === "milestone" ? "Title" : entryType === "photo" ? "Caption" : "Note"}
                  </label>
                  <textarea
                    value={content}
                    onChange={(e) => setContent(e.target.value)}
                    placeholder={
                      entryType === "milestone"
                        ? "First steps!"
                        : entryType === "photo"
                        ? "A special moment..."
                        : "A note for the future..."
                    }
                    rows={3}
                    className="w-full rounded-xl border border-border bg-background px-4 py-3 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
                    data-testid="input-content"
                  />
                </div>

                <div>
                  <label className="text-sm font-medium text-foreground mb-2 block">Your name</label>
                  <input
                    type="text"
                    value={authorName}
                    onChange={(e) => setAuthorName(e.target.value)}
                    placeholder="Your name"
                    className="w-full rounded-xl border border-border bg-background px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
                    data-testid="input-author-name"
                  />
                </div>

                {(entryType === "photo" || entryType === "milestone") && (
                  <div>
                    <label className="text-sm font-medium text-foreground mb-2 block">Photo URL (optional)</label>
                    <input
                      type="url"
                      value={photoUrl}
                      onChange={(e) => setPhotoUrl(e.target.value)}
                      placeholder="https://..."
                      className="w-full rounded-xl border border-border bg-background px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
                      data-testid="input-photo-url"
                    />
                  </div>
                )}

                <Button
                  onClick={handleSubmit}
                  disabled={!content.trim() || createMutation.isPending}
                  className="w-full h-12 rounded-xl font-semibold text-base"
                  data-testid="button-submit-entry"
                >
                  {createMutation.isPending ? "Adding..." : "Add to Memory Book"}
                </Button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
