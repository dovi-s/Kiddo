import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  X, ChevronRight, Loader2, ImagePlus, Trash2, Copy, Check, Share2, User, Lock,
  Calendar as CalendarIcon,
} from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { useCreateEvent, useUpdateEvent } from "@/hooks/use-events";
import { haptic } from "@/lib/haptics";
import { toast } from "@/hooks/use-toast";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

export interface EditEventData {
  id?: string;
  name: string;
  slug?: string | null;
  eventType?: string | null;
  eventCategory?: string | null;
  eventDate?: string | Date | null;
  goalAmount?: string | number | null;
  description?: string | null;
  imageUrl?: string | null;
  // Saved focal point (0..1 normalized). When the parent edits an event,
  // these need to round-trip from the database back into the editor so the
  // photo doesn't snap back to centered crop on every save. Was missing
  // before this landed.
  imageFocalX?: number | string | null;
  imageFocalY?: number | string | null;
  isArchived?: boolean;
}

interface InvestPrefs {
  defaultMode?: "managed" | "stock" | "cash";
  defaultTicker?: string;
  managedStrategy?: string;
}

interface CreateEventSheetProps {
  open: boolean;
  onClose: () => void;
  fundId: string;
  fundName?: string;
  fundSlug?: string;
  childPhotoUrl?: string;
  investPrefs?: InvestPrefs;
  editEvent?: EditEventData | null;
  // True when the viewer OWNS this fund post-handoff (the adult owner). Flips
  // "for {child}" / "into {child}'s fund" instructional copy to second person.
  isOwnerMode?: boolean;
}

const GIFTING_TYPES = [
  // One cohesive warm treatment for every tile (applied at render) instead of a
  // per-type pastel rainbow (peach / mint / lavender / blue) that read as an
  // inconsistent, default-y mix against the warm brand. The emoji carries the
  // identity; the tile chrome stays consistent (matches the card placeholders).
  { id: "birthday",     label: "Birthday",     emoji: "🎂" },
  { id: "holiday",      label: "Holiday",       emoji: "🎉" },
  { id: "graduation",   label: "Graduation",    emoji: "🎓" },
  { id: "baby_shower",  label: "Baby Shower",   emoji: "🍼" },
  { id: "just_because", label: "Just Because",  emoji: "💚" },
  { id: "custom",       label: "Custom",        emoji: "🎁" },
];

const GOAL_TYPES = [
  { id: "college",   label: "College",        emoji: "🎓", desc: "Tuition, housing, and everything in between." },
  { id: "car",       label: "First car",      emoji: "🚗", desc: "The freedom to go anywhere." },
  { id: "home",      label: "First home",     emoji: "🏡", desc: "A down payment starts here." },
  { id: "travel",    label: "Gap year",       emoji: "✈️", desc: "A trip. A year. A memory." },
  { id: "business",  label: "Business",       emoji: "💼", desc: "Seed capital for something real." },
  { id: "emergency", label: "Emergency fund", emoji: "🛡️", desc: "The safety net that changes everything." },
  { id: "custom",    label: "Custom goal",    emoji: "🎁", desc: "Something specific to them." },
];

const GIFTING_GOAL_PRESETS = [
  { label: "$100",   value: "100" },
  { label: "$250",   value: "250" },
  { label: "$500",   value: "500" },
  { label: "$1,000", value: "1000" },
];

const SAVINGS_GOAL_PRESETS = [
  { label: "$10k",  value: "10000" },
  { label: "$25k",  value: "25000" },
  { label: "$50k",  value: "50000" },
  { label: "$100k", value: "100000" },
];

type Step = "category" | "type" | "goal-type" | "details" | "goal-details" | "preview" | "done";

// Force-refresh the dashboard-summary cache. Plain TanStack invalidate isn't
// enough because the endpoint sets HTTP `Cache-Control: max-age=20`, so a
// follow-up fetch within 20 seconds would re-serve the stale browser-cached
// response (without the just-uploaded event photo). Same race-condition fix
// we use for the parent-contribution return path. The fresh fetch uses
// `cache: "no-store"` to bypass the browser HTTP cache, then patches the
// query data directly so the UI re-renders the moment the new bytes land.
async function invalidateAndRefreshDashboardSummary(
  queryClient: ReturnType<typeof useQueryClient>,
  fundId: string,
): Promise<void> {
  if (!fundId) return;
  const summaryKey = ["/api/funds", fundId, "dashboard-summary"];
  queryClient.invalidateQueries({ queryKey: summaryKey });
  try {
    const res = await fetch(`/api/funds/${fundId}/dashboard-summary`, {
      credentials: "include",
      cache: "no-store",
    });
    if (res.ok) {
      const data = await res.json();
      queryClient.setQueryData(summaryKey, data);
    }
  } catch {
    // best-effort; the invalidate above will trigger a refetch on next render
  }
}

async function uploadEventImage(
  eventId: string,
  file: File,
  focalX?: number,
  focalY?: number,
): Promise<string | null> {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = async () => {
      try {
        const body: Record<string, unknown> = { dataUrl: reader.result };
        // Pass focal point alongside the upload so the new photo lands
        // with the parent's drag-to-reposition framing intent already
        // applied. Server clamps to [0,1] defensively.
        if (Number.isFinite(focalX) && focalX !== undefined) body.focalX = focalX;
        if (Number.isFinite(focalY) && focalY !== undefined) body.focalY = focalY;
        const res = await fetch(`/api/events/${eventId}/upload-image`, {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        const data = await res.json().catch(() => ({}));
        resolve(res.ok && data?.url ? data.url : null);
      } catch {
        resolve(null);
      }
    };
    reader.onerror = () => resolve(null);
    reader.readAsDataURL(file);
  });
}

function slugifyPreview(text: string): string {
  return text.toLowerCase()
    .replace(/['']/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
}

function formatGoalAmount(val: string): string {
  const n = parseFloat(val);
  if (!n) return "";
  if (n >= 1000) return `$${(n / 1000).toFixed(n % 1000 === 0 ? 0 : 1)}k`;
  return `$${n.toLocaleString()}`;
}

// Kiddo design tokens
const G = "rgb(26,61,43)";           // forest green
const GOLD = "rgb(184,121,26)";       // kiddo gold
const CREAM = "rgb(249,248,246)";     // warm cream (modal bg)
const INK = "rgb(26,23,16)";          // near-black
const MUTED = "rgba(26,23,16,0.5)";   // warm gray
const BORDER = "rgba(26,23,16,0.12)"; // subtle border
const INPUT_BG = "rgb(245,244,240)";  // input background

const S = {
  input: (focused?: boolean): React.CSSProperties => ({
    width: "100%", padding: "12px 14px", borderRadius: 14,
    border: `1.5px solid ${focused ? G : "rgba(26,23,16,0.15)"}`,
    background: INPUT_BG, fontSize: 15, fontWeight: 500,
    color: INK, outline: "none", boxSizing: "border-box",
  }),
  textarea: (focused?: boolean): React.CSSProperties => ({
    width: "100%", padding: "12px 14px", borderRadius: 14,
    border: `1.5px solid ${focused ? G : "rgba(26,23,16,0.15)"}`,
    background: INPUT_BG, fontSize: 14, fontWeight: 400,
    color: INK, outline: "none", resize: "none",
    boxSizing: "border-box", lineHeight: 1.55, fontFamily: "inherit",
  }),
  label: (): React.CSSProperties => ({
    fontSize: 10.5, fontWeight: 700, color: "rgba(26,23,16,0.38)",
    textTransform: "uppercase", letterSpacing: "0.08em",
    display: "block", marginBottom: 8,
  }),
  pill: (active: boolean): React.CSSProperties => ({
    padding: "8px 14px", borderRadius: 100, border: "1.5px solid",
    borderColor: active ? G : "rgba(26,23,16,0.15)",
    background: active ? G : "transparent",
    color: active ? "white" : INK,
    fontSize: 13, fontWeight: 600, cursor: "pointer", transition: "all 0.15s",
  }),
  primaryBtn: (enabled: boolean): React.CSSProperties => ({
    width: "100%", padding: "15px", borderRadius: 100, border: "none",
    background: enabled ? GOLD : "rgba(26,23,16,0.1)",
    color: enabled ? "white" : "rgba(26,23,16,0.3)",
    fontSize: 15, fontWeight: 700, cursor: enabled ? "pointer" : "not-allowed",
    transition: "opacity 0.15s", display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
  }),
  ghostBtn: (): React.CSSProperties => ({
    width: "100%", padding: "13px", borderRadius: 100,
    border: `1.5px solid ${BORDER}`,
    background: "transparent", color: INK,
    fontSize: 15, fontWeight: 600, cursor: "pointer",
  }),
  tile: (): React.CSSProperties => ({
    width: "100%", background: "white", border: `1.5px solid ${BORDER}`,
    borderRadius: 20, padding: "18px 20px", cursor: "pointer", textAlign: "left",
    display: "flex", alignItems: "flex-start", gap: 16, transition: "border-color 0.15s",
  }),
};

export function CreateEventSheet({
  open, onClose, fundId, fundName, fundSlug, childPhotoUrl, investPrefs, editEvent, isOwnerMode = false,
}: CreateEventSheetProps) {
  const isEditing = !!(editEvent?.id);
  const isCreatingFromArchived = isEditing && !!editEvent?.isArchived;
  const isSavingsEdit = editEvent?.eventCategory === "savings_goal";

  const [step, setStep] = useState<Step>(() => {
    // New occasions open straight on the type picker. The old "category" chooser
    // had two options (occasion / savings goal); with goals retired it collapsed
    // to ONE option ("What are you creating? → An occasion"), which reads as an
    // unfinished one-choice modal. Skip it and go right to "What's the occasion?".
    if (!editEvent) return "type";
    return isSavingsEdit ? "goal-details" : "details";
  });
  const [category, setCategory] = useState<"gifting_occasion" | "savings_goal" | null>(
    editEvent ? (isSavingsEdit ? "savings_goal" : "gifting_occasion") : "gifting_occasion",
  );

  const [eventType, setEventType] = useState(editEvent?.eventType || "");
  const [name, setName] = useState(editEvent?.name || "");
  const [description, setDescription] = useState(editEvent?.description || "");
  const [date, setDate] = useState(() => {
    if (!editEvent?.eventDate) return "";
    const d = new Date(editEvent.eventDate as string);
    return isNaN(d.getTime()) ? "" : d.toISOString().slice(0, 10);
  });
  const [goalPreset, setGoalPreset] = useState(() => {
    const g = editEvent?.goalAmount ? String(editEvent.goalAmount) : "";
    return GIFTING_GOAL_PRESETS.some(p => p.value === g) ? g : (g ? "custom" : "");
  });
  const [customGoal, setCustomGoal] = useState(() => {
    const g = editEvent?.goalAmount ? String(editEvent.goalAmount) : "";
    return GIFTING_GOAL_PRESETS.some(p => p.value === g) ? "" : g;
  });
  const [useChildPhoto, setUseChildPhoto] = useState(false);
  const [coverFile, setCoverFile] = useState<File | null>(null);
  const [coverPreview, setCoverPreview] = useState<string>(editEvent?.imageUrl || "");
  // Focal-point for the cover photo. Drag-to-reposition writes here, the
  // image renders with object-position from these values, and on save they
  // round-trip to the events table (imageFocalX / imageFocalY columns) so
  // every destination surface — Memory Book strip, gifter occasion hero,
  // gifter main hero, dashboard event card — gets the same framing intent.
  const [coverFocalX, setCoverFocalX] = useState<number>(() => {
    const v = Number(editEvent?.imageFocalX);
    return Number.isFinite(v) && v >= 0 && v <= 1 ? v : 0.5;
  });
  const [coverFocalY, setCoverFocalY] = useState<number>(() => {
    const v = Number(editEvent?.imageFocalY);
    return Number.isFinite(v) && v >= 0 && v <= 1 ? v : 0.5;
  });
  const [isDraggingCover, setIsDraggingCover] = useState(false);
  const coverDragStartRef = useRef<{ clientX: number; clientY: number; focalX: number; focalY: number; rectW: number; rectH: number } | null>(null);

  const [goalType, setGoalType] = useState(editEvent?.eventType || "");
  const [goalName, setGoalName] = useState(editEvent?.name || "");
  const [goalDescription, setGoalDescription] = useState(editEvent?.description || "");
  const [savingsPreset, setSavingsPreset] = useState(() => {
    const g = editEvent?.goalAmount ? String(editEvent.goalAmount) : "";
    return SAVINGS_GOAL_PRESETS.some(p => p.value === g) ? g : (g ? "custom" : "");
  });
  const [savingsCustomGoal, setSavingsCustomGoal] = useState(() => {
    const g = editEvent?.goalAmount ? String(editEvent.goalAmount) : "";
    return SAVINGS_GOAL_PRESETS.some(p => p.value === g) ? "" : g;
  });

  const [uploadingImage, setUploadingImage] = useState(false);
  const [createdEventSlug, setCreatedEventSlug] = useState<string | null>(null);
  const [copiedLink, setCopiedLink] = useState(false);
  const coverInputRef = useRef<HTMLInputElement>(null);

  const queryClient = useQueryClient();
  const createEvent = useCreateEvent();
  const updateEvent = useUpdateEvent();
  const isPending = createEvent.isPending || updateEvent.isPending || uploadingImage;

  useEffect(() => {
    if (!open) return;
    if (editEvent) {
      setStep(isSavingsEdit ? "goal-details" : "details");
      setEventType(editEvent.eventType || "");
      setName(editEvent.name || "");
      setDescription(editEvent.description || "");
      setGoalName(editEvent.name || "");
      setGoalDescription(editEvent.description || "");
      setGoalType(editEvent.eventType || "");
      const d = editEvent.eventDate ? new Date(editEvent.eventDate as string) : null;
      setDate(d && !isNaN(d.getTime()) ? d.toISOString().slice(0, 10) : "");
      const g = editEvent.goalAmount ? String(editEvent.goalAmount) : "";
      setGoalPreset(GIFTING_GOAL_PRESETS.some(p => p.value === g) ? g : (g ? "custom" : ""));
      setCustomGoal(GIFTING_GOAL_PRESETS.some(p => p.value === g) ? "" : g);
      setSavingsPreset(SAVINGS_GOAL_PRESETS.some(p => p.value === g) ? g : (g ? "custom" : ""));
      setSavingsCustomGoal(SAVINGS_GOAL_PRESETS.some(p => p.value === g) ? "" : g);
      setCoverFile(null); setCoverPreview(editEvent.imageUrl || "");
      const efx = Number(editEvent.imageFocalX);
      const efy = Number(editEvent.imageFocalY);
      setCoverFocalX(Number.isFinite(efx) && efx >= 0 && efx <= 1 ? efx : 0.5);
      setCoverFocalY(Number.isFinite(efy) && efy >= 0 && efy <= 1 ? efy : 0.5);
      setUseChildPhoto(false);
    } else {
      resetAll();
    }
  }, [open, editEvent?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  function resetAll() {
    setStep("type"); setCategory("gifting_occasion"); // skip the one-option chooser
    setEventType(""); setName(""); setDescription(""); setDate("");
    setGoalPreset(""); setCustomGoal("");
    setGoalType(""); setGoalName(""); setGoalDescription(""); setSavingsPreset(""); setSavingsCustomGoal("");
    setCoverFile(null); setCoverPreview(""); setUseChildPhoto(false);
    setCoverFocalX(0.5); setCoverFocalY(0.5);
    setCreatedEventSlug(null); setCopiedLink(false);
  }

  function handleClose() { onClose(); setTimeout(resetAll, 300); }

  function handleSelectCategory(cat: "gifting_occasion" | "savings_goal") {
    haptic("selection"); setCategory(cat);
    setStep(cat === "gifting_occasion" ? "type" : "goal-type");
  }

  function handleSelectGiftingType(typeId: string) {
    haptic("selection"); setEventType(typeId);
    // In edit mode, keep the user's customized name — only the type is changing.
    // In create mode, seed a sensible default the user can override.
    if (!isEditing) {
      const defaults: Record<string, string> = {
        birthday: fundName ? `${fundName}'s Birthday` : "Birthday",
        holiday: "Holiday Gifting",
        graduation: fundName ? `${fundName}'s Graduation` : "Graduation",
        baby_shower: "Baby Shower",
        just_because: "Just Because",
        custom: "",
      };
      setName(defaults[typeId] || "");
    }
    setStep("details");
  }

  function handleSelectGoalType(typeId: string) {
    haptic("selection"); setGoalType(typeId);
    if (!isEditing) {
      const defaults: Record<string, string> = {
        college: fundName ? `${fundName}'s College Fund` : "College Fund",
        car: fundName ? `${fundName}'s First Car` : "First Car",
        home: fundName ? `${fundName}'s First Home` : "First Home",
        travel: fundName ? `${fundName}'s Gap Year` : "Gap Year Fund",
        business: fundName ? `${fundName}'s Business Fund` : "Business Fund",
        emergency: "Emergency Fund",
        custom: "",
      };
      setGoalName(defaults[typeId] || "");
    }
    setStep("goal-details");
  }

  function handleCoverPick(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) { toast({ title: "Please choose an image file", variant: "destructive" }); return; }
    if (file.size > 5 * 1024 * 1024) { toast({ title: "Image too large", description: "Max 5MB.", variant: "destructive" }); return; }
    const reader = new FileReader();
    reader.onload = () => {
      setCoverPreview(String(reader.result || ""));
      setCoverFile(file);
      setUseChildPhoto(false);
      // New photo, fresh framing intent — reset focal to centered. The
      // parent can drag immediately to reposition.
      setCoverFocalX(0.5); setCoverFocalY(0.5);
    };
    reader.readAsDataURL(file);
    e.currentTarget.value = "";
  }

  async function handleSubmit() {
    const isGifting = category === "gifting_occasion" || (isEditing && !isSavingsEdit);
    haptic("medium");
    const goal = goalPreset === "custom" ? customGoal : goalPreset;
    const savingsGoal = savingsPreset === "custom" ? savingsCustomGoal : savingsPreset;
    try {
      if (isEditing && editEvent && !isCreatingFromArchived) {
        if (isGifting) {
          // Include focal coords on every PATCH when the event has a cover
          // photo. Covers two cases: (1) parent uploads a new photo —
          // focal coords come from coverFocalX/Y as 0.5/0.5 default; the
          // upload-image POST below ALSO writes them, but the PATCH gets
          // there first; (2) parent ONLY drags an existing photo without
          // re-uploading — this PATCH is the only path that persists the
          // new framing. Without this branch, repositioning an existing
          // photo silently lost on save.
          const hasCover = !!coverPreview || useChildPhoto;
          await updateEvent.mutateAsync({
            id: editEvent.id!,
            data: {
              name: name.trim(),
              eventType: eventType as any,
              eventDate: date ? new Date(date) : undefined,
              goalAmount: goal || undefined,
              description: description.trim() || undefined,
              ...(hasCover && !useChildPhoto ? { imageFocalX: String(coverFocalX), imageFocalY: String(coverFocalY) } : {}),
            } as any,
          });
          if (coverFile) {
            setUploadingImage(true);
            await uploadEventImage(editEvent.id!, coverFile, coverFocalX, coverFocalY);
            setUploadingImage(false);
          }
        } else {
          await updateEvent.mutateAsync({
            id: editEvent.id!,
            data: { name: goalName.trim(), eventType: goalType as any, goalAmount: savingsGoal || undefined, description: goalDescription.trim() || undefined },
          });
        }
        // ALWAYS force-refresh the dashboard-summary after any successful
        // event edit. Plain TanStack invalidate isn't enough because the
        // endpoint sets HTTP `Cache-Control: max-age=20`, so the browser
        // serves the stale response for up to 20s. The helper does
        // `cache: "no-store"` and patches query data directly, so a goal
        // amount or name change shows up immediately. Was previously
        // gated to only the cover-file branch; goal-only edits had to
        // wait 20s to reflect.
        await invalidateAndRefreshDashboardSummary(queryClient, fundId);
        queryClient.invalidateQueries({ queryKey: ["/api/events"] });
        queryClient.invalidateQueries({ queryKey: ["/api/funds"] });
        toast({ title: isGifting ? "Occasion updated" : "Goal updated" });
        handleClose();
      } else {
        if (isGifting) {
          const coverSrc = useChildPhoto && childPhotoUrl ? childPhotoUrl : undefined;
          const newEvent = await createEvent.mutateAsync({
            fundId, name: name.trim(), eventType: eventType as any,
            eventDate: date ? new Date(date) : undefined,
            goalAmount: goal || undefined, description: description.trim() || undefined,
            eventCategory: "gifting_occasion", status: "active",
            ...(coverSrc ? { imageUrl: coverSrc } : {}),
          });
          if (coverFile && newEvent?.id && !useChildPhoto) {
            setUploadingImage(true);
            await uploadEventImage(newEvent.id, coverFile, coverFocalX, coverFocalY);
            setUploadingImage(false);
            // Same dashboard-summary refresh as the edit path so the new
            // event's photo appears in the Dashboard tile immediately.
            await invalidateAndRefreshDashboardSummary(queryClient, fundId);
            queryClient.invalidateQueries({ queryKey: ["/api/events"] });
          }
          setCreatedEventSlug((newEvent as any)?.slug || null);
        } else {
          const newEvent = await createEvent.mutateAsync({
            fundId, name: goalName.trim(), eventType: goalType as any,
            goalAmount: savingsGoal || undefined, description: goalDescription.trim() || undefined,
            eventCategory: "savings_goal", status: "active",
          });
          setCreatedEventSlug((newEvent as any)?.slug || null);
        }
        setStep("done");
      }
    } catch (err: any) {
      setUploadingImage(false);
      toast({ title: "Couldn't save", description: err.message, variant: "destructive" });
    }
  }

  function handleCopyLink() {
    if (!shareUrl) return;
    navigator.clipboard.writeText(shareUrl).then(() => {
      setCopiedLink(true); haptic("success"); setTimeout(() => setCopiedLink(false), 2000);
    });
  }

  function goBack() {
    haptic("light");
    // In edit mode there's no category/type chain to walk back through — the
    // sheet opens straight on details. So back from the type picker should
    // return to details (the user opted in via "Change type"), not bounce to
    // a category picker that doesn't apply to an existing event.
    if (step === "type") setStep(isEditing ? "details" : "category");
    else if (step === "goal-type") setStep(isEditing ? "goal-details" : "category");
    else if (step === "details") setStep("type");
    else if (step === "goal-details") setStep("goal-type");
    else if (step === "preview") setStep(category === "savings_goal" || isSavingsEdit ? "goal-details" : "details");
  }

  const selectedGiftingType = GIFTING_TYPES.find(t => t.id === eventType);
  const selectedGoalTypeDef = GOAL_TYPES.find(t => t.id === goalType);
  const effectiveGoal = goalPreset === "custom" ? customGoal : goalPreset;
  const effectiveSavingsGoal = savingsPreset === "custom" ? savingsCustomGoal : savingsPreset;
  const previewCover = useChildPhoto ? childPhotoUrl : coverPreview;
  const previewName = category === "savings_goal" ? goalName : name;
  // `date` from <input type="date"> parses as UTC midnight; render in UTC so the
  // preview shows the day the user actually picked.
  const previewDateLabel = date ? new Date(date).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric", timeZone: "UTC" }) : "";
  const predictedSlug = fundSlug && previewName ? `${window.location.origin}/${fundSlug}/${slugifyPreview(previewName)}` : "";
  const shareUrl = fundSlug && createdEventSlug
    ? `${window.location.origin}/${fundSlug}/${createdEventSlug}`
    : fundSlug ? `${window.location.origin}/${fundSlug}` : "";

  const investLabel = (() => {
    if (!investPrefs) return "Managed growth mix";
    if (investPrefs.defaultMode === "stock" && investPrefs.defaultTicker) return investPrefs.defaultTicker;
    if (investPrefs.defaultMode === "cash") return "Held as cash";
    if (investPrefs.managedStrategy === "balanced") return "Balanced portfolio";
    if (investPrefs.managedStrategy === "conservative") return "Conservative portfolio";
    return "Growth index portfolio";
  })();

  // In edit mode the sheet opens directly on details/goal-details — back from
  // those would land on the wrong screen, so we hide the back arrow there.
  // BUT preview is always reachable from a details step, and the type / goal-type
  // pickers are reachable from edit mode via the new "Change type" affordance —
  // the back arrow should let the user bail out of either without changing it.
  const showBack =
    step === "preview" ||
    (isEditing && (step === "type" || step === "goal-type")) ||
    (!isEditing && step !== "category" && step !== "type" && step !== "done");

  const headerContent = () => {
    if (step === "category") return { title: "New occasion", sub: (fundName && !isOwnerMode) ? `A moment for ${fundName} that people can gift around.` : "A moment people can gift around." };
    if (step === "type") return { title: "What's the occasion?", sub: (fundName && !isOwnerMode) ? `For ${fundName}` : "Pick one" };
    if (step === "goal-type") return { title: "Savings goal", sub: isOwnerMode ? "What are you saving for?" : fundName ? `What is ${fundName} saving for?` : "What are they saving for?" };
    if (step === "details") return { title: isEditing && !isCreatingFromArchived ? "Edit occasion" : selectedGiftingType?.label ?? "Occasion", sub: isEditing && !isCreatingFromArchived ? "Update the details" : "Tell people what it's about" };
    if (step === "goal-details") return { title: isEditing && !isCreatingFromArchived ? "Edit goal" : selectedGoalTypeDef?.label ?? "Savings goal", sub: "Set the details" };
    if (step === "preview") return { title: "Preview", sub: "How people will see it" };
    if (step === "done") return { title: category === "savings_goal" ? "Goal created" : "Occasion is live", sub: null };
    return { title: "", sub: null };
  };
  const hdr = headerContent();

  // Cover photo block - reused in both details steps
  const CoverPhotoBlock = (
    <div style={{ marginBottom: 18 }}>
      <label style={S.label()}>Cover photo <span style={{ fontWeight: 400, textTransform: "none", letterSpacing: 0 }}>(optional)</span></label>
      <input ref={coverInputRef} type="file" accept="image/*" onChange={handleCoverPick} style={{ display: "none" }} />
      {(coverPreview || useChildPhoto) ? (
        <div
          style={{
            position: "relative",
            borderRadius: 16,
            overflow: "hidden",
            height: 150,
            // Drag-to-reposition. No icons, no tooltip — the cursor +
            // direct response IS the affordance. Disabled when using the
            // child's profile photo (that's a fixed-position avatar, not
            // a free-frame cover).
            cursor: useChildPhoto ? "default" : (isDraggingCover ? "grabbing" : "grab"),
            // Prevent native scroll/zoom mid-drag on touch devices.
            touchAction: useChildPhoto ? "auto" : "none",
            userSelect: "none",
          }}
          onPointerDown={(e) => {
            if (useChildPhoto) return;
            // Don't initiate a drag on the action buttons (Trash, Change photo).
            if ((e.target as HTMLElement).closest("button")) return;
            const rect = e.currentTarget.getBoundingClientRect();
            e.currentTarget.setPointerCapture(e.pointerId);
            coverDragStartRef.current = {
              clientX: e.clientX,
              clientY: e.clientY,
              focalX: coverFocalX,
              focalY: coverFocalY,
              rectW: rect.width,
              rectH: rect.height,
            };
            setIsDraggingCover(true);
          }}
          onPointerMove={(e) => {
            const start = coverDragStartRef.current;
            if (!start) return;
            // Direct manipulation: dragging the photo right reveals more
            // of the LEFT side, which means object-position X moves DOWN
            // (lower percentage). Sign-flipped from the cursor delta.
            const dxFrac = (e.clientX - start.clientX) / start.rectW;
            const dyFrac = (e.clientY - start.clientY) / start.rectH;
            const nx = Math.max(0, Math.min(1, start.focalX - dxFrac));
            const ny = Math.max(0, Math.min(1, start.focalY - dyFrac));
            setCoverFocalX(nx);
            setCoverFocalY(ny);
          }}
          onPointerUp={(e) => {
            if (coverDragStartRef.current) {
              try { e.currentTarget.releasePointerCapture(e.pointerId); } catch { /* already released */ }
              coverDragStartRef.current = null;
              setIsDraggingCover(false);
            }
          }}
          onPointerCancel={(e) => {
            if (coverDragStartRef.current) {
              try { e.currentTarget.releasePointerCapture(e.pointerId); } catch { /* already released */ }
              coverDragStartRef.current = null;
              setIsDraggingCover(false);
            }
          }}
        >
          <img src={useChildPhoto ? childPhotoUrl : coverPreview} alt="Cover"
            draggable={false}
            style={{
              width: "100%",
              height: "100%",
              objectFit: "cover",
              // Live-positioned via state. Same primitive every destination
              // surface uses (Memory Book strip, gifter occasion hero,
              // dashboard event card), so what the parent sees here is
              // pixel-accurate to where it lands.
              objectPosition: useChildPhoto ? "center" : `${coverFocalX * 100}% ${coverFocalY * 100}%`,
              userSelect: "none",
              pointerEvents: "none",
            }} />
          <div style={{ position: "absolute", inset: 0, background: "linear-gradient(to top, rgba(26,23,16,0.45) 0%, transparent 55%)", pointerEvents: "none" }} />
          <button type="button"
            onClick={() => { setCoverFile(null); setCoverPreview(""); setUseChildPhoto(false); setCoverFocalX(0.5); setCoverFocalY(0.5); }}
            style={{ position: "absolute", top: 8, right: 8, background: "rgba(26,23,16,0.55)", border: "none", borderRadius: "50%", width: 30, height: 30, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <Trash2 size={13} color="white" />
          </button>
          {!useChildPhoto && (
            <button type="button" onClick={() => coverInputRef.current?.click()}
              style={{ position: "absolute", bottom: 10, right: 10, background: "rgba(255,255,255,0.92)", border: "none", borderRadius: 8, padding: "5px 10px", fontSize: 11.5, fontWeight: 700, color: INK, cursor: "pointer" }}>
              Change photo
            </button>
          )}
        </div>
      ) : (
        <div style={{ display: "flex", gap: 8 }}>
          <button type="button" onClick={() => coverInputRef.current?.click()}
            style={{ flex: 1, height: 90, borderRadius: 14, border: "1.5px dashed rgba(26,23,16,0.18)", background: "white", cursor: "pointer", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 5 }}>
            <ImagePlus size={18} color="rgba(26,23,16,0.3)" />
            <span style={{ fontSize: 11.5, fontWeight: 600, color: "rgba(26,23,16,0.45)" }}>Upload photo</span>
          </button>
          {childPhotoUrl && (
            <button type="button"
              onClick={() => { setUseChildPhoto(true); setCoverFile(null); setCoverPreview(""); haptic("selection"); }}
              style={{ width: 90, height: 90, borderRadius: 14, border: "1.5px dashed rgba(26,23,16,0.18)", background: "white", cursor: "pointer", padding: 0, overflow: "hidden", position: "relative" }}>
              <img src={childPhotoUrl} alt={fundName || "Child"} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
              <div style={{ position: "absolute", inset: 0, background: "rgba(26,23,16,0.38)", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
                <User size={14} color="white" />
                <span style={{ fontSize: 10, fontWeight: 700, color: "white", marginTop: 3 }}>{fundName?.split(" ")[0] || "Photo"}</span>
              </div>
            </button>
          )}
        </div>
      )}
    </div>
  );

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.45)", backdropFilter: "blur(2px)" }}
      onClick={(e) => { if (e.target === e.currentTarget) handleClose(); }}
    >
      <motion.div
        initial={{ y: 44, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: 44, opacity: 0 }}
        transition={{ type: "spring", damping: 28, stiffness: 320 }}
        style={{
          background: CREAM,
          borderRadius: 24,
          width: "100%", maxWidth: 480,
          maxHeight: "88dvh", display: "flex", flexDirection: "column", overflow: "hidden",
        }}
        className=""
      >
        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "16px 20px 14px", flexShrink: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
            {showBack && (
              <button type="button" onClick={goBack}
                style={{ fontSize: 13, color: G, fontWeight: 600, background: "none", border: "none", cursor: "pointer", padding: "4px 0", flexShrink: 0 }}>
                ← Back
              </button>
            )}
            <div style={{ minWidth: 0 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                {step === "details" && selectedGiftingType && (
                  <span style={{ fontSize: 18, lineHeight: 1, flexShrink: 0 }}>{selectedGiftingType.emoji}</span>
                )}
                {step === "goal-details" && selectedGoalTypeDef && (
                  <span style={{ fontSize: 18, lineHeight: 1, flexShrink: 0 }}>{selectedGoalTypeDef.emoji}</span>
                )}
                <p className="font-heading" style={{ fontSize: 18, fontWeight: 700, color: G, lineHeight: 1.2 }}>{hdr.title}</p>
              </div>
              {hdr.sub && <p style={{ fontSize: 12.5, color: MUTED, marginTop: 2 }}>{hdr.sub}</p>}
            </div>
          </div>
          <button type="button" onClick={handleClose} aria-label="Close event editor"
            style={{ width: 30, height: 30, borderRadius: "50%", background: "rgba(26,23,16,0.08)", border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
            <X size={14} color="rgba(26,23,16,0.5)" />
          </button>
        </div>

        <AnimatePresence mode="wait">

          {/* ─── CATEGORY ─────────────────────────────────── */}
          {step === "category" && (
            <motion.div key="category" initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -8 }} transition={{ duration: 0.16 }}
              style={{ padding: "4px 20px 32px", overflowY: "auto", flex: 1 }}>
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>

                <button type="button" onClick={() => handleSelectCategory("gifting_occasion")}
                  style={S.tile()}
                  onMouseEnter={(e) => (e.currentTarget.style.borderColor = G)}
                  onMouseLeave={(e) => (e.currentTarget.style.borderColor = BORDER)}
                  onMouseDown={(e) => (e.currentTarget.style.transform = "scale(0.985)")}
                  onMouseUp={(e) => (e.currentTarget.style.transform = "scale(1)")}
                >
                  <div style={{ fontSize: 40, lineHeight: 1, flexShrink: 0, marginTop: 1 }}>🎁</div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ fontSize: 16, fontWeight: 700, color: INK, lineHeight: 1.2, marginBottom: 5 }}>An occasion</p>
                    <p style={{ fontSize: 13, color: MUTED, lineHeight: 1.6 }}>Birthday, holiday, milestone. Share a link. Anyone gifts.</p>
                  </div>
                  <ChevronRight size={16} color="rgba(26,23,16,0.3)" style={{ flexShrink: 0, marginTop: 5 }} />
                </button>

                {/* "A savings goal" option removed — fund-level dollar goals are
                    retired (they don't compose on a fungible pot and imply an
                    earmark a UTMA can't keep; see Dashboard suggestion removal).
                    Occasions are now the only thing you create here. The
                    savings_goal step machinery below stays in place but
                    unreachable, ready to be repurposed as an occasion-level
                    drive if that ever proves out against funded-k. TODO(ux):
                    with one category, skip this chooser step and open straight
                    to occasion creation. */}
              </div>
            </motion.div>
          )}

          {/* ─── OCCASION TYPE PICKER ─────────────────────── */}
          {step === "type" && (
            <motion.div key="type" initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 10 }} transition={{ duration: 0.16 }}
              style={{ padding: "4px 20px 32px", overflowY: "auto", flex: 1 }}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                {GIFTING_TYPES.map((type) => (
                  <button key={type.id} type="button" onClick={() => handleSelectGiftingType(type.id)}
                    style={{
                      background: "rgba(184,121,26,0.07)", // one warm gold wash (kiddo gold @ 7%) for every tile
                      border: "1.5px solid transparent",
                      borderRadius: 20, padding: "22px 14px 18px",
                      cursor: "pointer", textAlign: "center",
                      display: "flex", flexDirection: "column", alignItems: "center", gap: 10,
                      transition: "all 0.13s",
                    }}
                    onMouseEnter={(e) => { e.currentTarget.style.borderColor = G; }}
                    onMouseLeave={(e) => { e.currentTarget.style.borderColor = "transparent"; }}
                    onMouseDown={(e) => (e.currentTarget.style.transform = "scale(0.96)")}
                    onMouseUp={(e) => (e.currentTarget.style.transform = "scale(1)")}
                  >
                    <span style={{ fontSize: 38, lineHeight: 1 }}>{type.emoji}</span>
                    <p style={{ fontSize: 13.5, fontWeight: 700, color: INK, lineHeight: 1.2 }}>{type.label}</p>
                  </button>
                ))}
              </div>
            </motion.div>
          )}

          {/* ─── SAVINGS GOAL TYPE PICKER ─────────────────── */}
          {step === "goal-type" && (
            <motion.div key="goal-type" initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 10 }} transition={{ duration: 0.16 }}
              style={{ padding: "4px 20px 32px", overflowY: "auto", flex: 1 }}>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {GOAL_TYPES.map((type) => (
                  <button key={type.id} type="button" onClick={() => handleSelectGoalType(type.id)}
                    style={S.tile()}
                    onMouseEnter={(e) => (e.currentTarget.style.borderColor = G)}
                    onMouseLeave={(e) => (e.currentTarget.style.borderColor = BORDER)}
                    onMouseDown={(e) => (e.currentTarget.style.transform = "scale(0.985)")}
                    onMouseUp={(e) => (e.currentTarget.style.transform = "scale(1)")}
                  >
                    <span style={{ fontSize: 26, lineHeight: 1, flexShrink: 0, marginTop: 1 }}>{type.emoji}</span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ fontSize: 14, fontWeight: 700, color: INK, lineHeight: 1.2 }}>{type.label}</p>
                      <p style={{ fontSize: 12, color: MUTED, marginTop: 3 }}>{type.desc}</p>
                    </div>
                    <ChevronRight size={14} color="rgba(26,23,16,0.3)" style={{ flexShrink: 0, marginTop: 2 }} />
                  </button>
                ))}
              </div>
            </motion.div>
          )}

          {/* ─── OCCASION DETAILS ─────────────────────────── */}
          {step === "details" && (
            <motion.div key="details" initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 10 }} transition={{ duration: 0.16 }}
              style={{ padding: "4px 20px 32px", overflowY: "auto", flex: 1 }}>

              {isEditing && !isCreatingFromArchived && selectedGiftingType && (
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, marginBottom: 14, padding: "10px 12px", borderRadius: 14, background: "rgba(26,23,16,0.04)", border: `1px solid ${BORDER}` }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
                    <span style={{ fontSize: 20, lineHeight: 1, flexShrink: 0 }}>{selectedGiftingType.emoji}</span>
                    <div style={{ minWidth: 0 }}>
                      <p style={{ fontSize: 10.5, fontWeight: 700, color: "rgba(26,23,16,0.4)", textTransform: "uppercase", letterSpacing: "0.07em", lineHeight: 1 }}>Type</p>
                      <p style={{ fontSize: 13, fontWeight: 600, color: INK, marginTop: 3, lineHeight: 1.1 }}>{selectedGiftingType.label}</p>
                    </div>
                  </div>
                  <button type="button"
                    onClick={() => { haptic("selection"); setStep("type"); }}
                    style={{ background: "transparent", border: "none", color: G, fontSize: 12.5, fontWeight: 700, cursor: "pointer", padding: "6px 8px", flexShrink: 0 }}
                    data-testid="button-change-event-type"
                  >
                    Change type
                  </button>
                </div>
              )}

              {CoverPhotoBlock}

              <div style={{ marginBottom: 14 }}>
                <label style={S.label()}>Occasion name</label>
                <input type="text" value={name} onChange={(e) => setName(e.target.value)}
                  placeholder={fundName ? `e.g. ${fundName}'s 3rd Birthday` : "e.g. Emma's Birthday"}
                  autoFocus style={S.input()} />
              </div>

              <div style={{ marginBottom: 14 }}>
                <label style={S.label()}>Tell people what this is for <span style={{ fontWeight: 400, textTransform: "none", letterSpacing: 0 }}>(optional)</span></label>
                <textarea value={description} onChange={(e) => setDescription(e.target.value)}
                  placeholder={`What makes this occasion special${fundName ? ` for ${fundName}` : ""}?`}
                  rows={3} style={S.textarea()} />
              </div>

              <div style={{ marginBottom: 14 }}>
                <label style={S.label()}>Date <span style={{ fontWeight: 400, textTransform: "none", letterSpacing: 0 }}>(optional)</span></label>
                {/* Modern shadcn calendar in a popover. Replaces the
                    native <input type="date"> for cross-browser
                    consistency + design-system alignment. Events are
                    forward-looking (birthdays / holidays /
                    graduation) so the date range is today through
                    ~10 years out. Default month is today's month so
                    the picker doesn't open too far in the future. */}
                {(() => {
                  const today = new Date();
                  const farFuture = new Date(today.getFullYear() + 10, 11, 31);
                  const dateValue = date ? new Date(date + "T12:00:00") : undefined;
                  return (
                    <Popover>
                      <PopoverTrigger asChild>
                        <button
                          type="button"
                          style={{ ...S.input(), color: date ? INK : "rgba(26,23,16,0.4)", display: "flex", alignItems: "center", justifyContent: "space-between", textAlign: "left" }}
                        >
                          <span>
                            {dateValue
                              ? dateValue.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })
                              : "Pick a date"}
                          </span>
                          <CalendarIcon size={14} style={{ flexShrink: 0, opacity: 0.55 }} />
                        </button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar
                          mode="single"
                          captionLayout="dropdown"
                          selected={dateValue}
                          onSelect={(d) => {
                            if (!d) return;
                            const y = d.getFullYear();
                            const m = String(d.getMonth() + 1).padStart(2, "0");
                            const day = String(d.getDate()).padStart(2, "0");
                            setDate(`${y}-${m}-${day}`);
                          }}
                          fromYear={today.getFullYear()}
                          toYear={farFuture.getFullYear()}
                          defaultMonth={dateValue || today}
                          disabled={{ before: today }}
                        />
                      </PopoverContent>
                    </Popover>
                  );
                })()}
                <p style={{ marginTop: 6, fontSize: 11.5, color: "rgba(26,23,16,0.38)", lineHeight: 1.5 }}>
                  People are reminded 7 days before the occasion.
                </p>
              </div>

              {/* Occasion "Gift goal" field removed. It set a goal that tracked
                  the WHOLE fund (a "$500" occasion goal rendered "$22,540 of $500"
                  — already met, absurd, same bug as the fund goals), and the
                  "raise 3x more" line was an unsubstantiated pre-launch conversion
                  stat. Goals are retired everywhere; occasions are pure moments.
                  An honest occasion-level drive (a slice of gifts via THIS
                  occasion toward a target) can return later if it proves out
                  against funded-k. goalPreset/customGoal state stays (preview +
                  submit read it) and simply resolves to "no goal". */}

              {isEditing && !isCreatingFromArchived && editEvent?.slug && fundSlug && (
                <div style={{ marginBottom: 20, padding: "12px 14px", borderRadius: 14, background: "white", border: `1.5px solid ${BORDER}` }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
                    <Lock size={11} color="rgba(26,23,16,0.35)" />
                    <span style={{ fontSize: 10.5, fontWeight: 700, color: "rgba(26,23,16,0.35)", textTransform: "uppercase", letterSpacing: "0.07em" }}>Gift link</span>
                  </div>
                  <p style={{ fontSize: 12.5, color: MUTED, wordBreak: "break-all", lineHeight: 1.4 }}>
                    {window.location.origin}/{fundSlug}/{editEvent.slug}
                  </p>
                  <p style={{ fontSize: 11, color: "rgba(26,23,16,0.32)", marginTop: 5 }}>
                    This link never changes. Anyone who has it can always gift.
                  </p>
                </div>
              )}

              <button type="button"
                onClick={() => { if (name.trim()) { haptic("selection"); setStep("preview"); } }}
                disabled={!name.trim()}
                style={S.primaryBtn(!!name.trim())}>
                Preview occasion →
              </button>
            </motion.div>
          )}

          {/* ─── SAVINGS GOAL DETAILS ─────────────────────── */}
          {step === "goal-details" && (
            <motion.div key="goal-details" initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 10 }} transition={{ duration: 0.16 }}
              style={{ padding: "4px 20px 32px", overflowY: "auto", flex: 1 }}>

              {isEditing && !isCreatingFromArchived && selectedGoalTypeDef && (
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, marginBottom: 14, padding: "10px 12px", borderRadius: 14, background: "rgba(26,23,16,0.04)", border: `1px solid ${BORDER}` }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
                    <span style={{ fontSize: 20, lineHeight: 1, flexShrink: 0 }}>{selectedGoalTypeDef.emoji}</span>
                    <div style={{ minWidth: 0 }}>
                      <p style={{ fontSize: 10.5, fontWeight: 700, color: "rgba(26,23,16,0.4)", textTransform: "uppercase", letterSpacing: "0.07em", lineHeight: 1 }}>Goal type</p>
                      <p style={{ fontSize: 13, fontWeight: 600, color: INK, marginTop: 3, lineHeight: 1.1 }}>{selectedGoalTypeDef.label}</p>
                    </div>
                  </div>
                  <button type="button"
                    onClick={() => { haptic("selection"); setStep("goal-type"); }}
                    style={{ background: "transparent", border: "none", color: G, fontSize: 12.5, fontWeight: 700, cursor: "pointer", padding: "6px 8px", flexShrink: 0 }}
                    data-testid="button-change-goal-type"
                  >
                    Change type
                  </button>
                </div>
              )}

              {CoverPhotoBlock}

              <div style={{ marginBottom: 14 }}>
                <label style={S.label()}>Goal name</label>
                <input type="text" value={goalName} onChange={(e) => setGoalName(e.target.value)}
                  placeholder={fundName ? `e.g. ${fundName}'s College Fund` : "e.g. College Fund"}
                  autoFocus style={S.input()} />
              </div>

              <div style={{ marginBottom: 14 }}>
                <label style={S.label()}>Description <span style={{ fontWeight: 400, textTransform: "none", letterSpacing: 0 }}>(optional)</span></label>
                <textarea value={goalDescription} onChange={(e) => setGoalDescription(e.target.value)}
                  placeholder={`What is this goal for? How will it help ${isOwnerMode ? "you" : fundName || "them"}?`}
                  rows={3} style={S.textarea()} />
              </div>

              <div style={{ marginBottom: 24 }}>
                <label style={S.label()}>Target amount <span style={{ fontWeight: 400, textTransform: "none", letterSpacing: 0 }}>(optional)</span></label>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  {SAVINGS_GOAL_PRESETS.map((p) => (
                    <button key={p.value} type="button"
                      onClick={() => { haptic("light"); setSavingsPreset(p.value === savingsPreset ? "" : p.value); setSavingsCustomGoal(""); }}
                      style={S.pill(savingsPreset === p.value)}>
                      {p.label}
                    </button>
                  ))}
                  <button type="button" onClick={() => { haptic("light"); setSavingsPreset("custom"); setSavingsCustomGoal(""); }}
                    style={S.pill(savingsPreset === "custom")}>
                    Custom
                  </button>
                </div>
                {savingsPreset === "custom" && (
                  <input type="number" value={savingsCustomGoal} onChange={(e) => setSavingsCustomGoal(e.target.value)}
                    placeholder="Enter target" min="100" max="1000000"
                    style={{ marginTop: 10, ...S.input(true) }} autoFocus />
                )}
                <p style={{ marginTop: 8, fontSize: 12, color: "rgba(26,23,16,0.38)", lineHeight: 1.5 }}>
                  A target gives people something to gift toward. You can update it anytime.
                </p>
              </div>

              <button type="button"
                onClick={() => { if (goalName.trim()) { haptic("selection"); setStep("preview"); } }}
                disabled={!goalName.trim()}
                style={S.primaryBtn(!!goalName.trim())}>
                Preview →
              </button>
            </motion.div>
          )}

          {/* ─── PREVIEW ──────────────────────────────────── */}
          {step === "preview" && (
            <motion.div key="preview" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }}
              style={{ padding: "4px 20px 32px", overflowY: "auto", flex: 1 }}>

              {/* Label */}
              <p style={{ fontSize: 10, fontWeight: 700, color: "rgba(26,23,16,0.38)", textTransform: "uppercase", letterSpacing: "0.09em", marginBottom: 10 }}>
                What people see
              </p>

              {/* Gifter-facing card */}
              <div style={{ borderRadius: 20, overflow: "hidden", border: `1px solid ${BORDER}`, background: "white", boxShadow: "0 4px 24px rgba(26,23,16,0.08)", marginBottom: 16 }}>
                {/* Hero */}
                {(() => {
                  const childFirstName = fundName ? fundName.split("'")[0].trim() : "";
                  const heroHeadline = previewName
                    ? (childFirstName ? `Gift ${childFirstName} for ${previewName}` : `Gift for ${previewName}`)
                    : (childFirstName ? `${childFirstName}'s future is growing. Add to it.` : "A gift that grows.");
                  const typeBadge = selectedGiftingType ?? selectedGoalTypeDef;
                  return (
                    <div style={{ position: "relative", minHeight: 200, background: previewCover ? undefined : `linear-gradient(135deg, ${G} 0%, rgb(43,88,64) 100%)`, overflow: "hidden" }}>
                      {previewCover && <img src={previewCover} alt="" style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }} />}
                      <div style={{ position: "absolute", inset: 0, background: "linear-gradient(to top, rgba(26,23,16,0.72) 0%, rgba(26,23,16,0.2) 60%, transparent 100%)" }} />
                      <div style={{ position: "relative", zIndex: 1, display: "flex", flexDirection: "column", padding: 16, minHeight: 200 }}>
                        <div style={{ flex: 1 }} />
                        <div>
                          {previewName && (
                            <p style={{ fontSize: 11, fontWeight: 600, color: "rgba(255,255,255,0.8)", marginBottom: 4, letterSpacing: "0.02em" }}>
                              {typeBadge ? `${typeBadge.emoji} ${typeBadge.label}` : previewName}
                            </p>
                          )}
                          <p style={{ fontSize: 19, fontWeight: 800, color: "white", lineHeight: 1.25, textShadow: "0 1px 6px rgba(0,0,0,0.35)" }}>
                            {heroHeadline}
                          </p>
                          <p style={{ fontSize: 11, fontWeight: 600, color: "rgba(255,255,255,0.8)", marginTop: 4 }}>
                            No account needed. Takes 60 seconds.
                          </p>
                          {/* Trust badges */}
                          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 6, marginTop: 10 }}>
                            {[["🌱","Invested"],["🔒","Protected"],["⚡","60 seconds"]].map(([icon, label]) => (
                              <div key={label} style={{ background: "rgba(255,255,255,0.15)", backdropFilter: "blur(4px)", borderRadius: 10, padding: "6px 4px", textAlign: "center" }}>
                                <div style={{ fontSize: 14, lineHeight: 1 }}>{icon}</div>
                                <div style={{ fontSize: 9.5, fontWeight: 700, color: "white", marginTop: 3 }}>{label}</div>
                              </div>
                            ))}
                          </div>
                          {previewDateLabel && (
                            <div style={{ display: "inline-flex", alignItems: "center", gap: 5, marginTop: 8, background: "rgba(255,255,255,0.15)", backdropFilter: "blur(4px)", borderRadius: 100, padding: "3px 10px" }}>
                              <span style={{ fontSize: 10.5, color: "rgba(255,255,255,0.9)", fontWeight: 500 }}>📅 {previewDateLabel}</span>
                            </div>
                          )}
                          {/* Gift CTA */}
                          <div style={{ marginTop: 14, background: "rgb(184,121,26)", borderRadius: 12, padding: "11px 16px", textAlign: "center" }}>
                            <span style={{ fontSize: 14, fontWeight: 700, color: "white" }}>
                              🎁 {childFirstName ? `Gift ${childFirstName}` : "Gift now"}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })()}

                {/* Below-hero content (description + goal) */}
                {((description || goalDescription) || (effectiveGoal && parseFloat(effectiveGoal) > 0) || (effectiveSavingsGoal && parseFloat(effectiveSavingsGoal) > 0)) && (
                  <div style={{ padding: "14px 16px 16px", borderTop: `1px solid ${BORDER}` }}>
                    {(description || goalDescription) && (
                      <p style={{ fontSize: 13, color: "rgba(26,23,16,0.65)", lineHeight: 1.55, marginBottom: 12 }}>
                        {description || goalDescription}
                      </p>
                    )}
                    {category !== "savings_goal" && effectiveGoal && parseFloat(effectiveGoal) > 0 && (
                      <div>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                          <span style={{ fontSize: 12, fontWeight: 600, color: MUTED }}>Gift goal</span>
                          <span style={{ fontSize: 13, fontWeight: 700, color: G }}>{formatGoalAmount(effectiveGoal)}</span>
                        </div>
                        <div style={{ height: 5, borderRadius: 3, background: "rgba(26,23,16,0.08)" }}>
                          <div style={{ height: "100%", width: "0%", borderRadius: 3, background: G }} />
                        </div>
                        <p style={{ fontSize: 11, color: "rgba(26,23,16,0.4)", marginTop: 4 }}>$0 raised so far</p>
                      </div>
                    )}
                    {category === "savings_goal" && effectiveSavingsGoal && parseFloat(effectiveSavingsGoal) > 0 && (
                      <div>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                          <span style={{ fontSize: 12, fontWeight: 600, color: MUTED }}>Target</span>
                          <span style={{ fontSize: 13, fontWeight: 700, color: G }}>{formatGoalAmount(effectiveSavingsGoal)}</span>
                        </div>
                        <div style={{ height: 5, borderRadius: 3, background: "rgba(26,23,16,0.08)" }}>
                          <div style={{ height: "100%", width: "0%", borderRadius: 3, background: G }} />
                        </div>
                        <p style={{ fontSize: 11, color: "rgba(26,23,16,0.4)", marginTop: 4 }}>$0 raised so far</p>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* For-you info - investment + link */}
              <div style={{ borderRadius: 14, border: `1px solid ${BORDER}`, background: "rgba(26,23,16,0.03)", padding: "12px 14px", marginBottom: 16 }}>
                <p style={{ fontSize: 10, fontWeight: 700, color: "rgba(26,23,16,0.38)", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 8 }}>For you only</p>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: category !== "savings_goal" && predictedSlug ? 10 : 0 }}>
                  <span style={{ fontSize: 14 }}>📈</span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ fontSize: 11, color: MUTED, marginBottom: 1 }}>Gifts invested as</p>
                    <p style={{ fontSize: 13, fontWeight: 600, color: INK }}>{investLabel}</p>
                  </div>
                  <a
                    href={`/settings?tab=gifts${fundId ? `&fundId=${fundId}` : ""}`}
                    onClick={(e) => { e.stopPropagation(); }}
                    style={{ fontSize: 11.5, fontWeight: 600, color: G, textDecoration: "none", flexShrink: 0, padding: "4px 10px", borderRadius: 100, border: `1px solid rgba(26,61,43,0.25)`, background: "rgba(26,61,43,0.06)", whiteSpace: "nowrap" }}
                  >
                    Change →
                  </a>
                </div>
                {category !== "savings_goal" && predictedSlug && (
                  <div style={{ paddingTop: 10, borderTop: `1px solid ${BORDER}` }}>
                    <p style={{ fontSize: 11, color: MUTED, marginBottom: 4 }}>Gift link (estimated)</p>
                    <p style={{ fontSize: 12, color: G, wordBreak: "break-all", fontWeight: 500 }}>{predictedSlug}</p>
                    <p style={{ fontSize: 10.5, color: "rgba(26,23,16,0.3)", marginTop: 3 }}>Exact link generated on creation.</p>
                  </div>
                )}
              </div>

              <button type="button" onClick={handleSubmit} disabled={isPending} style={S.primaryBtn(!isPending)}>
                {isPending
                  ? <><Loader2 size={16} style={{ animation: "spin 1s linear infinite" }} /> {uploadingImage ? "Uploading photo..." : isEditing ? "Saving..." : category === "savings_goal" ? "Creating goal..." : "Creating occasion..."}</>
                  : isEditing && !isCreatingFromArchived
                    ? "Save changes"
                    : category === "savings_goal" ? "Create goal" : "Create occasion"}
              </button>
            </motion.div>
          )}

          {/* ─── DONE ─────────────────────────────────────── */}
          {step === "done" && (
            <motion.div key="done" initial={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }}
              style={{ padding: "16px 20px 32px", overflowY: "auto", flex: 1 }}>

              <div style={{ textAlign: "center", marginBottom: 28, paddingTop: 8 }}>
                <div style={{ fontSize: 60, lineHeight: 1, marginBottom: 16 }}>
                  {category === "savings_goal" ? "🎯" : "🎉"}
                </div>
                <p className="font-heading" style={{ fontSize: 22, fontWeight: 700, color: G, marginBottom: 8 }}>
                  {category === "savings_goal" ? `${goalName || "Goal"} is set.` : `${name || "Occasion"} is live.`}
                </p>
                <p style={{ fontSize: 14, color: MUTED, lineHeight: 1.6 }}>
                  {category === "savings_goal"
                    ? "It appears on your homepage. People can gift toward it."
                    : "Share the link and watch gifts come in."}
                </p>
              </div>

              {category !== "savings_goal" && (
                <div style={{ marginBottom: 20, padding: "13px 16px", borderRadius: 16, background: "hsl(143,28%,96%)", border: "1.5px solid hsl(143,28%,88%)", display: "flex", alignItems: "flex-start", gap: 10 }}>
                  <span style={{ fontSize: 16, lineHeight: 1, marginTop: 1, flexShrink: 0 }}>🌱</span>
                  <p style={{ fontSize: 13, color: "hsl(143,40%,28%)", lineHeight: 1.6, margin: 0 }}>
                    Gifts to this occasion go directly into {isOwnerMode ? "your fund" : fundName ? `${fundName}'s fund` : "the fund"}. Same place. Just beautifully tagged.
                  </p>
                </div>
              )}

              {category !== "savings_goal" && shareUrl && (
                <div style={{ marginBottom: 14 }}>
                  <label style={S.label()}>Gift link</label>
                  <div style={{ display: "flex", gap: 8 }}>
                    <div style={{ flex: 1, padding: "11px 14px", borderRadius: 14, border: `1.5px solid ${BORDER}`, background: "white", fontSize: 12.5, color: MUTED, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {shareUrl}
                    </div>
                    <button type="button" onClick={handleCopyLink}
                      style={{ flexShrink: 0, padding: "11px 16px", borderRadius: 14, border: "none", background: copiedLink ? G : "rgba(26,23,16,0.08)", color: copiedLink ? "white" : INK, fontSize: 13, fontWeight: 600, cursor: "pointer", display: "flex", alignItems: "center", gap: 6, transition: "all 0.15s" }}>
                      {copiedLink ? <Check size={14} /> : <Copy size={14} />}
                      {copiedLink ? "Copied" : "Copy"}
                    </button>
                  </div>
                </div>
              )}

              {category !== "savings_goal" && shareUrl && (
                <button type="button"
                  onClick={() => { navigator.share ? navigator.share({ url: shareUrl, title: name }).catch(() => {}) : handleCopyLink(); }}
                  style={{ ...S.primaryBtn(true), marginBottom: 10 }}>
                  <Share2 size={16} />
                  Share
                </button>
              )}

              <button type="button" onClick={handleClose} style={S.ghostBtn()}>Done</button>
            </motion.div>
          )}

        </AnimatePresence>
      </motion.div>
    </div>
  );
}
