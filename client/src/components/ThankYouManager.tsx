import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import { Heart, Check, CheckCheck, Edit3, Send, RefreshCw, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { haptic } from "@/lib/haptics";
import { toast } from "@/hooks/use-toast";
import { demoBlocked } from "@/lib/demo-block";
import type { ThankYou } from "@shared/schema";

interface ThankYouManagerProps {
  fundId: string;
  fundName: string;
}

export function ThankYouManager({ fundId, fundName }: ThankYouManagerProps) {
  const queryClient = useQueryClient();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editMessage, setEditMessage] = useState("");

  const { data: thankYous = [], isLoading } = useQuery<ThankYou[]>({
    queryKey: ["/api/funds", fundId, "thank-yous"],
    queryFn: async () => {
      const res = await fetch(`/api/funds/${fundId}/thank-yous`, { credentials: "include" });
      if (!res.ok) return [];
      return res.json();
    },
    enabled: !!fundId,
  });

  const generateMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/funds/${fundId}/thank-yous/generate`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
      });
      if (!res.ok) throw new Error("Failed to generate");
      return res.json();
    },
    onSuccess: (data) => {
      if (demoBlocked(data, toast)) return;
      queryClient.invalidateQueries({ queryKey: ["/api/funds", fundId, "thank-yous"] });
      haptic("success");
      toast({ title: "Thank-yous generated", description: `${data.generated} new draft${data.generated !== 1 ? "s" : ""} created` });
    },
    onError: () => {
      toast({ title: "Error", description: "Could not generate thank-yous", variant: "destructive" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: Record<string, any> }) => {
      const res = await fetch(`/api/funds/${fundId}/thank-yous/${id}`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updates),
      });
      if (!res.ok) throw new Error("Failed to update");
      return res.json();
    },
    onSuccess: (data) => {
      if (demoBlocked(data, toast)) return;
      queryClient.invalidateQueries({ queryKey: ["/api/funds", fundId, "thank-yous"] });
    },
    onError: () => {
      toast({ title: "Error", description: "Could not update thank-you", variant: "destructive" });
    },
  });

  const sendMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/funds/${fundId}/thank-yous/${id}/send`, {
        method: "POST",
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to send");
      return res.json();
    },
    onSuccess: async (data) => {
      if (demoBlocked(data, toast)) return;
      queryClient.invalidateQueries({ queryKey: ["/api/funds", fundId, "thank-yous"] });
      if (data.deliveryMethod === "email" && data.deliveryUrl) {
        window.location.href = data.deliveryUrl;
        toast({ title: "Email draft opened", description: "Your email app opened with a pre-filled thank-you." });
      } else if (data.deliveryMethod === "copy" && data.copiedText) {
        await navigator.clipboard.writeText(data.copiedText);
        toast({ title: "Message copied", description: "Sender email missing, so we copied the thank-you text." });
      }
    },
    onError: () => {
      toast({ title: "Error", description: "Could not send thank-you", variant: "destructive" });
    },
  });

  const handleMarkSent = (id: string) => {
    haptic("success");
    sendMutation.mutate(id);
  };

  const handleSaveEdit = (id: string) => {
    if (!editMessage.trim()) return;
    updateMutation.mutate({ id, updates: { message: editMessage.trim() } });
    setEditingId(null);
    setEditMessage("");
    haptic("selection");
    toast({ title: "Message updated" });
  };

  const handleMarkAllSent = () => {
    const drafts = thankYous.filter((ty) => ty.status === "draft");
    drafts.forEach((ty) => {
      updateMutation.mutate({ id: ty.id, updates: { status: "sent" } });
    });
    haptic("success");
    toast({ title: "All marked as sent", description: `${drafts.length} thank-you${drafts.length !== 1 ? "s" : ""} marked as sent` });
  };

  const drafts = thankYous.filter((ty) => ty.status === "draft");
  const sent = thankYous.filter((ty) => ty.status === "sent");

  if (isLoading) {
    return (
      <div className="bg-card rounded-2xl border border-border/50 shadow-premium-sm p-5">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
            <Heart size={18} className="text-primary" />
          </div>
          <div>
            <h3 className="font-heading text-base font-semibold">Thank Yous</h3>
            <p className="text-sm text-muted-foreground">Loading...</p>
          </div>
        </div>
        <div className="space-y-2">
          <div className="h-16 bg-muted rounded-lg animate-pulse" />
          <div className="h-16 bg-muted rounded-lg animate-pulse" />
        </div>
      </div>
    );
  }

  return (
    <div className="bg-card rounded-2xl border border-border/50 shadow-premium-sm p-5" data-testid="section-thank-yous">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
            <Heart size={18} className="text-primary" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-heading text-base font-semibold" data-testid="text-thank-yous-title">Thank Yous</h3>
              {drafts.length > 0 && (
                <span
                  className="inline-flex items-center justify-center w-5 h-5 text-3xs font-bold rounded-full bg-primary text-primary-foreground"
                  data-testid="badge-unsent-count"
                >
                  {drafts.length}
                </span>
              )}
            </div>
            <p className="text-sm text-muted-foreground" data-testid="text-thank-yous-summary">
              {drafts.length > 0
                ? `${drafts.length} unsent draft${drafts.length !== 1 ? "s" : ""}`
                : sent.length > 0
                ? `${sent.length} sent`
                : "No thank-yous yet"}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            className="text-xs h-8 gap-1.5"
            onClick={() => generateMutation.mutate()}
            disabled={generateMutation.isPending}
            data-testid="button-generate-thank-yous"
          >
            <RefreshCw size={13} className={generateMutation.isPending ? "animate-spin" : ""} />
            Generate
          </Button>
          {drafts.length > 1 && (
            <Button
              variant="outline"
              size="sm"
              className="text-xs h-8 gap-1.5 rounded-full"
              onClick={handleMarkAllSent}
              data-testid="button-send-all"
            >
              <CheckCheck size={13} />
              Mark All Sent
            </Button>
          )}
        </div>
      </div>

      {thankYous.length === 0 ? (
        <div className="text-center py-6">
          <Heart size={24} className="mx-auto text-muted-foreground/50 mb-2" />
          <p className="text-sm text-muted-foreground" data-testid="text-no-thank-yous">
            No thank-you notes yet. Click "Generate" to create drafts for recent gifts.
          </p>
        </div>
      ) : (
        <div className="space-y-2 max-h-[400px] overflow-y-auto">
          <AnimatePresence mode="popLayout">
            {thankYous.map((ty) => (
              <motion.div
                key={ty.id}
                layout
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className={`rounded-xl border p-3 transition-colors ${
                  ty.status === "sent"
                    ? "border-green-200 bg-green-50/50 dark:border-green-900/30 dark:bg-green-950/20"
                    : "border-border/50 bg-background"
                }`}
                data-testid={`card-thank-you-${ty.id}`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <p className="text-sm font-semibold truncate" data-testid={`text-thank-you-sender-${ty.id}`}>
                        {ty.senderName}
                      </p>
                      {ty.status === "sent" && (
                        <span className="inline-flex items-center gap-1 text-3xs font-medium text-green-600 dark:text-green-400 bg-green-100 dark:bg-green-900/30 px-1.5 py-0.5 rounded-full">
                          <Check size={10} />
                          Sent
                        </span>
                      )}
                    </div>
                    {editingId === ty.id ? (
                      <div className="space-y-2">
                        <textarea
                          value={editMessage}
                          onChange={(e) => setEditMessage(e.target.value)}
                          className="w-full rounded-lg border border-border/50 bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 resize-none"
                          rows={3}
                          data-testid={`input-edit-message-${ty.id}`}
                        />
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            className="text-xs h-7 rounded-full gap-1"
                            onClick={() => handleSaveEdit(ty.id)}
                            disabled={updateMutation.isPending}
                            data-testid={`button-save-edit-${ty.id}`}
                          >
                            <Check size={12} />
                            Save
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-xs h-7"
                            onClick={() => { setEditingId(null); setEditMessage(""); }}
                            data-testid={`button-cancel-edit-${ty.id}`}
                          >
                            <X size={12} />
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <p className="text-xs text-muted-foreground leading-relaxed" data-testid={`text-thank-you-message-${ty.id}`}>
                        {ty.message}
                      </p>
                    )}
                  </div>
                  {ty.status === "draft" && editingId !== ty.id && (
                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        className="p-1.5 rounded-lg hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
                        onClick={() => { setEditingId(ty.id); setEditMessage(ty.message); }}
                        data-testid={`button-edit-${ty.id}`}
                      >
                        <Edit3 size={14} />
                      </button>
                      <button
                        className="p-1.5 rounded-lg hover:bg-green-100 dark:hover:bg-green-900/30 transition-colors text-muted-foreground hover:text-green-600"
                        onClick={() => handleMarkSent(ty.id)}
                        disabled={sendMutation.isPending}
                        data-testid={`button-mark-sent-${ty.id}`}
                      >
                        <Send size={14} />
                      </button>
                    </div>
                  )}
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
}
