import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { QRCodeSVG } from "qrcode.react";
import { Copy, Check, Printer, Download, Link, Mail, ArrowLeft, Share2, Hash } from "lucide-react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { ModalCloseButton } from "@/components/ui/modal-close-button";
import { haptic } from "@/lib/haptics";
import { toast } from "@/hooks/use-toast";

export interface SharePage {
  label: string;
  description?: string;
  url: string;
  giftCode?: string;
  themeId?: string;
  isPermanent?: boolean;
}

interface ShareModalProps {
  open: boolean;
  onClose: () => void;
  pages: SharePage[];
  recipientName: string;
  giftCode?: { code: string; lookupUrl: string };
  // Optional fund-snapshot deep-link. When passed, renders a small footer
  // action that opens the print-ready single-page summary in a new tab —
  // for sharing OUTSIDE the gift loop (spouse, advisor, grandparent who
  // hasn't installed). Auth-required at the destination; the parent
  // prints/PDFs and shares the file rather than the URL.
  snapshotHref?: string;
  // True once the fund has transferred to the recipient at majority
  // (fund.transferredAt set). Post-handoff the fund is the now-adult's own
  // account, so the "for kids" brand line on the exported share assets is
  // wrong; everything else here is already name-personalized + age-neutral.
  // Defaults false → the kid framing is preserved for the overwhelming
  // (still-a-minor) case. Per the kid-2.0 retention thesis the fund stays
  // share-able after handoff; only the copy adapts.
  recipientIsOwner?: boolean;
}

const themeGradients: Record<string, string> = {
  midnight: "linear-gradient(135deg, #0f172a 0%, #1e293b 50%, #0f172a 100%)",
  warm: "linear-gradient(135deg, #92400e 0%, #c2410c 50%, #9f1239 100%)",
  ocean: "linear-gradient(135deg, #075985 0%, #0e7490 50%, #0f766e 100%)",
  sunset: "linear-gradient(135deg, #9f1239 0%, #c2410c 50%, #b45309 100%)",
  forest: "linear-gradient(135deg, #065f46 0%, #166534 50%, #0f766e 100%)",
  classic: "linear-gradient(135deg, #1a4a3a 0%, #2d7a5f 100%)",
};

function svgElementToDataUrl(svgEl: SVGSVGElement): Promise<string> {
  return new Promise((resolve) => {
    const svgData = new XMLSerializer().serializeToString(svgEl);
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");
    const img = new Image();
    img.onload = () => {
      canvas.width = img.width;
      canvas.height = img.height;
      ctx?.drawImage(img, 0, 0);
      resolve(canvas.toDataURL("image/png"));
    };
    img.src = "data:image/svg+xml;base64," + btoa(unescape(encodeURIComponent(svgData)));
  });
}

function roundedRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.arcTo(x + w, y, x + w, y + r, r);
  ctx.lineTo(x + w, y + h - r);
  ctx.arcTo(x + w, y + h, x + w - r, y + h, r);
  ctx.lineTo(x + r, y + h);
  ctx.arcTo(x, y + h, x, y + h - r, r);
  ctx.lineTo(x, y + r);
  ctx.arcTo(x, y, x + r, y, r);
  ctx.closePath();
}

// Single source of truth for which event type a label maps to. Lookup order
// matters: more-specific matches (hanukkah, eid, diwali, etc.) MUST resolve
// before the generic "holiday" / "christmas" branch — otherwise a Jewish
// family's "Emma's Hanukkah" event would send a Christmas tree emoji and
// "This holiday season..." copy. That's not a bug, it's an embarrassment.
type EventTone = {
  emoji: string;
  shareLine: string;          // single-line text used by SMS/WhatsApp/X share
  emailSubject: string;       // email subject line
  emailOpening: string;       // first sentence of email body
};
function getEventTone(recipientName: string, page: SharePage): EventTone {
  const first = recipientName.split(" ")[0];
  const label = (page.label || "").toLowerCase();
  // Tradition-specific (most specific first)
  if (label.includes("hanukkah") || label.includes("chanukah")) return {
    emoji: "🕎",
    shareLine: `${first}'s Hanukkah is coming up 🕎 Instead of a gift card, give something that lasts.`,
    emailSubject: `Give ${first} something that lasts this Hanukkah 🕎`,
    emailOpening: `Hanukkah's coming up, and this year our family is collecting investment gifts for ${first} instead of traditional presents.`,
  };
  if (label.includes("passover") || label.includes("seder")) return {
    emoji: "🍷",
    shareLine: `Mark Passover for ${first} with a gift that lasts 🍷`,
    emailSubject: `A Passover gift for ${first} 🍷`,
    emailOpening: `Passover's coming up, and we wanted to invite you to add to ${first}'s investment fund instead of bringing a traditional gift.`,
  };
  if (label.includes("rosh hashanah") || label.includes("rosh")) return {
    emoji: "🍯",
    shareLine: `A sweet new year for ${first} 🍯 Help them grow.`,
    emailSubject: `A sweet new year for ${first} 🍯`,
    emailOpening: `Rosh Hashanah is coming up, and we'd love for you to mark the new year with an investment gift for ${first}.`,
  };
  if (label.includes("bar mitzvah") || label.includes("bat mitzvah") || label.includes("mitzvah")) return {
    emoji: "✡️",
    shareLine: `${first}'s mitzvah is coming up ✡️ Instead of a check, give something that compounds for life.`,
    emailSubject: `${first}'s mitzvah ✡️`,
    emailOpening: `${first}'s mitzvah is coming up. Instead of a check, we're collecting investment gifts that will grow with them.`,
  };
  if (label.includes("diwali")) return {
    emoji: "🪔",
    shareLine: `Light up ${first}'s future this Diwali 🪔`,
    emailSubject: `A Diwali gift that grows for ${first} 🪔`,
    emailOpening: `Diwali is coming up, and we'd love for you to add to ${first}'s investment fund. A gift that keeps lighting the way.`,
  };
  if (label.includes("eid")) return {
    emoji: "🌙",
    shareLine: `Mark Eid with a gift that lasts for ${first} 🌙`,
    emailSubject: `An Eid gift for ${first} 🌙`,
    emailOpening: `Eid Mubarak. We're collecting investment gifts for ${first} this year instead of the usual presents.`,
  };
  if (label.includes("ramadan")) return {
    emoji: "🕌",
    shareLine: `A Ramadan gift that grows for ${first} 🕌`,
    emailSubject: `A Ramadan gift for ${first} 🕌`,
    emailOpening: `Ramadan Mubarak. We'd love for you to mark this season with an investment gift for ${first}.`,
  };
  if (label.includes("holi")) return {
    emoji: "🎨",
    shareLine: `Color ${first}'s future this Holi 🎨`,
    emailSubject: `A Holi gift for ${first} 🎨`,
    emailOpening: `Holi is coming up, and we'd love for you to color ${first}'s future with an investment gift.`,
  };
  if (label.includes("juneteenth")) return {
    emoji: "🕯️",
    shareLine: `Mark Juneteenth with a gift that builds ${first}'s future 🕯️`,
    emailSubject: `A Juneteenth gift for ${first} 🕯️`,
    emailOpening: `Juneteenth is coming up, and we'd love for you to mark it with an investment in ${first}'s future.`,
  };
  if (label.includes("kwanzaa")) return {
    emoji: "🕯️",
    shareLine: `A Kwanzaa gift that grows for ${first} 🕯️`,
    emailSubject: `A Kwanzaa gift for ${first} 🕯️`,
    emailOpening: `Kwanzaa is coming up, and we're collecting investment gifts for ${first} that honor the principles of the holiday.`,
  };
  if (label.includes("lunar new year") || label.includes("chinese new year")) return {
    emoji: "🏮",
    shareLine: `Lucky red envelopes that compound for ${first} 🏮`,
    emailSubject: `A Lunar New Year gift for ${first} 🏮`,
    emailOpening: `Lunar New Year is coming up. Instead of a paper red envelope, we're collecting investment gifts that grow with ${first} for life.`,
  };
  if (label.includes("quinceañera") || label.includes("quinceanera") || label.includes("quince")) return {
    emoji: "👑",
    shareLine: `${first}'s quinceañera is coming up 👑 Give something that lasts a lifetime.`,
    emailSubject: `${first}'s quinceañera 👑`,
    emailOpening: `${first}'s quinceañera is coming up. Instead of a traditional gift, we're collecting investments that will grow with her.`,
  };
  // Christian-specific (after the broader tradition checks)
  if (label.includes("baptism") || label.includes("christening")) return {
    emoji: "🕊️",
    shareLine: `Mark ${first}'s baptism with a gift that lasts 🕊️`,
    emailSubject: `A baptism gift for ${first} 🕊️`,
    emailOpening: `${first}'s baptism is coming up, and we're collecting investment gifts that will grow with them through life.`,
  };
  if (label.includes("first communion") || label.includes("communion")) return {
    emoji: "✝️",
    shareLine: `Mark ${first}'s First Communion with a gift that grows ✝️`,
    emailSubject: `A First Communion gift for ${first} ✝️`,
    emailOpening: `${first}'s First Communion is coming up, and we'd love for you to mark it with an investment gift.`,
  };
  if (label.includes("confirmation")) return {
    emoji: "✝️",
    shareLine: `Mark ${first}'s confirmation with a gift that lasts ✝️`,
    emailSubject: `A confirmation gift for ${first} ✝️`,
    emailOpening: `${first}'s confirmation is coming up, and we're collecting investment gifts that will keep growing for years.`,
  };
  if (label.includes("christmas")) return {
    emoji: "🎄",
    shareLine: `This Christmas, give ${first} something that lasts 🎄`,
    emailSubject: `A Christmas gift for ${first} that lasts 🎄`,
    emailOpening: `This Christmas, our family is collecting investment gifts for ${first} instead of traditional presents.`,
  };
  if (label.includes("easter")) return {
    emoji: "🐣",
    shareLine: `An Easter gift that grows for ${first} 🐣`,
    emailSubject: `An Easter gift for ${first} 🐣`,
    emailOpening: `Easter's coming up, and instead of chocolate or a basket, we'd love for you to add to ${first}'s investment fund.`,
  };
  // Generic event types
  if (label.includes("birthday")) return {
    emoji: "🎂",
    shareLine: `${first}'s birthday is coming up 🎂 Instead of a gift card, give something that lasts.`,
    emailSubject: `${first}'s birthday is coming up 🎂`,
    emailOpening: `${first}'s birthday is coming up! This year, our family is collecting investment gifts instead of traditional presents.`,
  };
  if (label.includes("graduation") || label.includes("grad")) return {
    emoji: "🎓",
    shareLine: `${first} is graduating 🎓 Mark it with a gift that compounds for years.`,
    emailSubject: `${first}'s graduation 🎓`,
    emailOpening: `${first} is graduating, and we're collecting investment gifts to mark the moment instead of a traditional present.`,
  };
  if (label.includes("baby shower") || label.includes("shower") || label.includes("welcome baby")) return {
    emoji: "🍼",
    shareLine: `Welcome ${first} into the world with a gift that grows 🍼`,
    emailSubject: `A welcome gift for ${first} 🍼`,
    emailOpening: `We're welcoming ${first} into the world, and we'd love for you to mark the moment with an investment that grows alongside them.`,
  };
  if (label.includes("wedding")) return {
    emoji: "💍",
    shareLine: `Mark ${first}'s wedding with an investment that lasts 💍`,
    emailSubject: `A wedding gift for ${first} 💍`,
    emailOpening: `${first}'s wedding is coming up, and we're collecting investment gifts to mark the new chapter.`,
  };
  if (label.includes("car")) return {
    emoji: "🚗",
    shareLine: `${first} is saving for a first car 🚗 Help get them there.`,
    emailSubject: `Help ${first} get a first car 🚗`,
    emailOpening: `${first} is saving for a first car, and we'd love your help getting them there.`,
  };
  if (label.includes("college") || label.includes("university") || label.includes("school")) return {
    emoji: "🎓",
    shareLine: `${first} is saving for college 🎓 Every dollar helps.`,
    emailSubject: `${first}'s college fund 🎓`,
    emailOpening: `${first} is saving for college, and every dollar makes a real difference.`,
  };
  if (label.includes("home") || label.includes("house")) return {
    emoji: "🏡",
    shareLine: `${first} is saving for a first home 🏡 A real down payment starts here.`,
    emailSubject: `Help ${first} save for a first home 🏡`,
    emailOpening: `${first} is saving for a first home down the road, and every dollar invested today compounds into something real.`,
  };
  if (label.includes("travel") || label.includes("gap year") || label.includes("trip")) return {
    emoji: "✈️",
    shareLine: `${first} is saving for a gap year ✈️ Send them on their way.`,
    emailSubject: `Help ${first} save for travel ✈️`,
    emailOpening: `${first} is saving for travel: a gap year, a trip, a memory. Every dollar helps.`,
  };
  if (label.includes("business")) return {
    emoji: "💼",
    shareLine: `${first} is building seed capital for something real 💼`,
    emailSubject: `Help ${first} build something real 💼`,
    emailOpening: `${first} is saving seed capital for something they want to build. Every dollar is a vote of confidence.`,
  };
  if (label.includes("emergency")) return {
    emoji: "🛡️",
    shareLine: `Help build ${first}'s emergency fund, the safety net that changes everything 🛡️`,
    emailSubject: `Help build ${first}'s emergency fund 🛡️`,
    emailOpening: `We're building an emergency fund for ${first}, the kind of safety net that changes everything when you need it.`,
  };
  if (page.isPermanent) return {
    emoji: "🌱",
    shareLine: `Give ${first} something that lasts 🌱`,
    emailSubject: `Help ${first} build their future`,
    emailOpening: `We wanted to share ${first}'s gift page with you.`,
  };
  return {
    emoji: "🌱",
    shareLine: `${first} is saving for something special. Instead of a traditional gift, give something that grows.`,
    emailSubject: `Help ${first} build their future`,
    emailOpening: `${first} is saving for something special, and we'd love your support.`,
  };
}

function getShareText(recipientName: string, page: SharePage): string {
  const tone = getEventTone(recipientName, page);
  return `${tone.shareLine} Takes 60 seconds. No account needed.\n\n${page.url}`;
}

function getEmailSubject(recipientName: string, page: SharePage): string {
  return getEventTone(recipientName, page).emailSubject;
}

function getEmailBody(recipientName: string, page: SharePage): string {
  const first = recipientName.split(" ")[0];
  const tone = getEventTone(recipientName, page);
  return `Hi there,\n\n${tone.emailOpening}\n\nInstead of a traditional gift, you can invest directly in ${first}'s future through Kiddo. It takes 60 seconds and no account is needed. Every dollar becomes a real investment.\n\n👉 ${page.url}\n\n${first} will see your name in their Memory Book, a permanent record of everyone who showed up for them.\n\nWith love 💚`;
}

// ─── Inline SVG icons for platforms ────────────────────────────────────────

// Exported 2026-05-21 so GiftSuccess's share-Kiddo-with-other-families
// card can reuse the same canonical glyphs as the fund share modal.
// Keeping the source of truth in this file so any visual update to the
// channel iconography propagates everywhere automatically.
export function WhatsAppIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="white">
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
    </svg>
  );
}

function FacebookIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="white">
      <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
    </svg>
  );
}

function XIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="white">
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.744l7.73-8.835L1.254 2.25H8.08l4.213 5.567zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
    </svg>
  );
}

function StoryCardIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="3" width="20" height="18" rx="3" />
      <circle cx="12" cy="12" r="4" />
      <circle cx="17.5" cy="6.5" r="1" fill="white" stroke="none" />
    </svg>
  );
}

export function MessageIcon() {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
    </svg>
  );
}

// ─── Sub-components ─────────────────────────────────────────────────────────

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p style={{
      fontSize: 9.5, fontWeight: 700, letterSpacing: "0.1em",
      // Was rgb(160,150,140) (~2.9:1 on white — failed WCAG AA). Darkened to
      // rgb(112,103,95) (~5.5:1) so the section labels are legible for the
      // older-gifter cohort; hierarchy now carried by size/weight/uppercase,
      // not lightness. (a11y contrast sweep 2026-05-29.)
      textTransform: "uppercase" as const, color: "rgb(112,103,95)", marginBottom: 8,
    }}>
      {children}
    </p>
  );
}

function ShareRow({
  iconBg, icon, label, subtitle, onClick,
}: {
  iconBg: string;
  icon: React.ReactNode;
  label: string;
  subtitle: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        display: "flex", alignItems: "center", gap: 12,
        width: "100%", padding: "10px 12px",
        background: "rgb(248,246,243)", borderRadius: 12, border: "none",
        cursor: "pointer", textAlign: "left" as const,
        transition: "background 0.12s", marginBottom: 6,
      }}
      onMouseEnter={e => (e.currentTarget.style.background = "rgb(240,238,234)")}
      onMouseLeave={e => (e.currentTarget.style.background = "rgb(248,246,243)")}
    >
      <div style={{
        width: 34, height: 34, borderRadius: 9, flexShrink: 0,
        background: iconBg,
        display: "flex", alignItems: "center", justifyContent: "center",
      }}>
        {icon}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ fontSize: 13.5, fontWeight: 600, color: "rgb(26,23,16)", lineHeight: 1.2 }}>{label}</p>
        <p style={{ fontSize: 11, color: "rgb(112,103,95)", marginTop: 1 }}>{subtitle}</p>
      </div>
      <svg width="14" height="14" viewBox="0 0 14 14" fill="none" style={{ color: "rgb(200,190,182)", flexShrink: 0 }}>
        <path d="M5 3l4 4-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </button>
  );
}

function SocialBtn({
  label, bg, icon, onClick, loading,
}: {
  label: string;
  bg: string;
  icon: React.ReactNode;
  onClick: () => void;
  loading?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={loading}
      style={{
        display: "flex", flexDirection: "column" as const, alignItems: "center", gap: 5,
        padding: "10px 6px", background: "rgb(248,246,243)", borderRadius: 12,
        border: "none", cursor: loading ? "wait" : "pointer", flex: 1,
        transition: "background 0.12s", opacity: loading ? 0.6 : 1,
      }}
      onMouseEnter={e => !loading && (e.currentTarget.style.background = "rgb(240,238,234)")}
      onMouseLeave={e => (e.currentTarget.style.background = "rgb(248,246,243)")}
    >
      <div style={{ width: 32, height: 32, borderRadius: 9, background: bg, display: "flex", alignItems: "center", justifyContent: "center" }}>
        {icon}
      </div>
      <span style={{ fontSize: 10, fontWeight: 600, color: "rgb(100,92,86)", whiteSpace: "nowrap" as const }}>
        {loading ? "..." : label}
      </span>
    </button>
  );
}

// ─── Main component ──────────────────────────────────────────────────────────

export function ShareModal({ open, onClose, pages, recipientName, giftCode, snapshotHref, recipientIsOwner }: ShareModalProps) {
  // Brand line for the exported assets (story card + print flyer). Drops
  // "for kids" once the fund is the recipient's own post-handoff account,
  // where that claim is no longer true; keeps the emotional "from the people
  // who love them" core in both cases.
  const brandTagline = recipientIsOwner
    ? "Real investments, from the people who love them."
    : "Real investments for kids, from people who love them.";
  const [selectedIdx, setSelectedIdx] = useState(0);
  const [view, setView] = useState<"main" | "email">("main");
  const [copied, setCopied] = useState(false);
  const [codeCopied, setCodeCopied] = useState(false);
  const [printing, setPrinting] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [generatingCard, setGeneratingCard] = useState(false);
  const [emailTo, setEmailTo] = useState("");
  const [emailSubject, setEmailSubject] = useState("");
  const [emailBody, setEmailBody] = useState("");
  const qrRef = useRef<SVGSVGElement | null>(null);

  useEffect(() => {
    if (open) { setSelectedIdx(0); setView("main"); setCopied(false); setCodeCopied(false); }
  }, [open]);

  useEffect(() => {
    setCodeCopied(false);
  }, [selectedIdx]);

  const selected = pages[selectedIdx] ?? pages[0];

  useEffect(() => {
    if (!selected) return;
    setEmailSubject(getEmailSubject(recipientName, selected));
    setEmailBody(getEmailBody(recipientName, selected));
  }, [selectedIdx, recipientName, selected?.url]);

  if (!selected) return null;

  const gradient = themeGradients[selected.themeId ?? "classic"] ?? themeGradients.classic;
  const canNativeShare = typeof navigator !== "undefined" && !!navigator.share;
  const isMobile = typeof navigator !== "undefined" && /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
  const shareText = getShareText(recipientName, selected);
  const displayUrl = selected.url.replace(/^https?:\/\//, "");
  const firstName = recipientName.split(" ")[0];

  // The code-entry rescue path for the OFFLINE artifacts (print flyer +
  // story card). Those are exactly the moments a gifter can't tap a link —
  // a printed flyer at a party, a Story screenshotted off someone else's
  // phone — and if the QR won't scan there's otherwise no recovery. The
  // on-screen modal already shows this (the "Enter at …/gift" block); these
  // exports must carry it through so the artifact is self-rescuing. Mirrors
  // the same resolution the on-screen block uses: per-page code first, then
  // the fund-level code; lookup URL from the server, else the /gift route.
  const exportGiftCode = selected.giftCode ?? giftCode?.code ?? null;
  const codeLookupDisplay = (
    giftCode?.lookupUrl ??
    (typeof window !== "undefined" ? `${window.location.origin}/gift` : "kiddofund.com/gift")
  ).replace(/^https?:\/\//, "");

  const getQrDataUrl = async (): Promise<string | null> => {
    if (!qrRef.current) return null;
    return svgElementToDataUrl(qrRef.current);
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(selected.url);
      setCopied(true);
      haptic("success");
      toast({ title: "Link copied", variant: "saved" });
      setTimeout(() => setCopied(false), 2200);
    } catch {
      window.prompt("Copy this link:", selected.url);
    }
  };

  const handleNativeShare = async () => {
    haptic("light");
    try {
      await navigator.share({
        title: `Gift ${firstName} a real investment`,
        text: shareText,
        url: selected.url,
      });
    } catch { /* dismissed */ }
  };

  const handleWhatsApp = () => {
    haptic("light");
    const encoded = encodeURIComponent(shareText);
    window.open(`https://wa.me/?text=${encoded}`, "_blank", "noopener,noreferrer");
  };

  const handleSMS = () => {
    haptic("light");
    const encoded = encodeURIComponent(shareText);
    window.location.href = `sms:?&body=${encoded}`;
  };

  const handleFacebook = () => {
    haptic("light");
    window.open(`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(selected.url)}`, "_blank", "noopener,noreferrer,width=600,height=500");
  };

  const handleX = () => {
    haptic("light");
    const text = encodeURIComponent(shareText.split("\n")[0]);
    window.open(`https://x.com/intent/tweet?text=${text}&url=${encodeURIComponent(selected.url)}`, "_blank", "noopener,noreferrer,width=600,height=500");
  };

  const handleEmailSend = () => {
    haptic("light");
    const to = encodeURIComponent(emailTo.trim());
    const subject = encodeURIComponent(emailSubject);
    const body = encodeURIComponent(emailBody);
    window.location.href = `mailto:${to}?subject=${subject}&body=${body}`;
  };

  const handleStoryCard = async () => {
    setGeneratingCard(true);
    haptic("light");
    try {
      const qrDataUrl = await getQrDataUrl();

      const canvas = document.createElement("canvas");
      canvas.width = 1080;
      canvas.height = 1920;
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("no ctx");

      // Background
      const grad = ctx.createLinearGradient(0, 0, 1080, 1920);
      grad.addColorStop(0, "rgb(26,61,43)");
      grad.addColorStop(1, "rgb(12,32,20)");
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, 1080, 1920);

      // Decorative orbs
      ctx.beginPath();
      ctx.arc(1180, -80, 500, 0, Math.PI * 2);
      ctx.fillStyle = "rgba(255,255,255,0.04)";
      ctx.fill();
      ctx.beginPath();
      ctx.arc(-80, 1900, 600, 0, Math.PI * 2);
      ctx.fillStyle = "rgba(184,121,26,0.08)";
      ctx.fill();

      const font = "-apple-system, BlinkMacSystemFont, 'Helvetica Neue', sans-serif";

      // Kiddo wordmark
      ctx.font = `600 52px ${font}`;
      ctx.fillStyle = "rgba(255,255,255,0.45)";
      ctx.textAlign = "center";
      ctx.fillText("Kiddo", 540, 180);

      // Child name
      ctx.font = `bold 130px ${font}`;
      ctx.fillStyle = "white";
      ctx.textAlign = "center";
      ctx.fillText(firstName, 540, 480);

      // Tagline / occasion
      const tagline = selected.isPermanent ? "Gift them a real investment" : selected.label;
      ctx.font = `500 58px ${font}`;
      ctx.fillStyle = "rgba(255,255,255,0.70)";
      ctx.fillText(tagline, 540, 580);

      // QR white card
      if (qrDataUrl) {
        const qrImg = new Image();
        await new Promise<void>((res) => { qrImg.onload = () => res(); qrImg.src = qrDataUrl; });
        const qrSize = 440;
        const qrX = (1080 - qrSize) / 2;
        const qrY = 720;
        ctx.fillStyle = "white";
        roundedRect(ctx, qrX - 36, qrY - 36, qrSize + 72, qrSize + 72, 36);
        ctx.fill();
        ctx.drawImage(qrImg, qrX, qrY, qrSize, qrSize);
      }

      // CTA
      ctx.font = `bold 60px ${font}`;
      ctx.fillStyle = "white";
      ctx.textAlign = "center";
      ctx.fillText("Scan to give a gift that grows", 540, 1390);

      // URL
      ctx.font = `500 44px ${font}`;
      ctx.fillStyle = "rgba(255,255,255,0.55)";
      ctx.fillText(displayUrl, 540, 1480);

      // Code-entry rescue — for the viewer who can't scan a Story (it's a
      // screenshot, the camera won't focus, it's not their phone). A short
      // typed code at /gift beats a long URL every time.
      if (exportGiftCode) {
        ctx.font = `500 36px ${font}`;
        ctx.fillStyle = "rgba(255,255,255,0.42)";
        ctx.fillText(`Can't scan? Enter ${exportGiftCode} at ${codeLookupDisplay}`, 540, 1555);
      }

      // Bottom line
      ctx.font = `400 34px ${font}`;
      ctx.fillStyle = "rgba(255,255,255,0.30)";
      ctx.fillText(brandTagline, 540, 1790);

      const dataUrl = canvas.toDataURL("image/png");

      // On mobile, try native share with file (opens Instagram etc directly)
      if (isMobile && navigator.canShare) {
        try {
          const blob = await (await fetch(dataUrl)).blob();
          const file = new File([blob], `${firstName.toLowerCase()}-kiddo-story.png`, { type: "image/png" });
          if (navigator.canShare({ files: [file] })) {
            await navigator.share({ files: [file], title: `Gift ${firstName}` });
            setGeneratingCard(false);
            return;
          }
        } catch { /* fall through to download */ }
      }

      // Fallback: download
      const a = document.createElement("a");
      a.download = `${firstName.toLowerCase().replace(/[^a-z0-9]/g, "-")}-kiddo-story.png`;
      a.href = dataUrl;
      a.click();
      haptic("success");
      toast({ title: "Story card saved!", description: isMobile ? "Share it to your Instagram story." : "Open Instagram on your phone and share to your story." });
    } catch {
      toast({ title: "Couldn't generate card", variant: "destructive" });
    }
    setGeneratingCard(false);
  };

  const handleDownloadQR = async () => {
    setDownloading(true);
    haptic("light");
    const dataUrl = await getQrDataUrl();
    if (!dataUrl) { toast({ title: "QR not ready", variant: "destructive" }); setDownloading(false); return; }
    const link = document.createElement("a");
    link.download = `${firstName.toLowerCase().replace(/[^a-z0-9]/g, "-")}-gift-qr.png`;
    link.href = dataUrl;
    link.click();
    haptic("success");
    setDownloading(false);
  };

  const handlePrintFlyer = async () => {
    setPrinting(true);
    haptic("light");
    const dataUrl = await getQrDataUrl();
    if (!dataUrl) { toast({ title: "QR not ready", variant: "destructive" }); setPrinting(false); return; }
    const pageLabel = selected.isPermanent ? "Gift anytime" : selected.label;
    const win = window.open("", "_blank", "width=800,height=1100");
    if (!win) { toast({ title: "Pop-up blocked", description: "Allow pop-ups to print the flyer.", variant: "destructive" }); setPrinting(false); return; }
    win.document.write(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <title>Gift ${recipientName}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap');
    body { font-family: 'Inter', sans-serif; background: #fff; }
    .page { width: 210mm; min-height: 297mm; margin: 0 auto; display: flex; flex-direction: column; }
    .hero { background: ${gradient}; padding: 48px 40px 40px; display: flex; flex-direction: column; align-items: center; gap: 10px; }
    .hero-eyebrow { font-size: 11px; font-weight: 600; letter-spacing: 0.14em; text-transform: uppercase; color: rgba(255,255,255,0.65); }
    .hero-name { font-size: 36px; font-weight: 800; color: #fff; letter-spacing: -0.02em; text-align: center; }
    .hero-sub { font-size: 14px; color: rgba(255,255,255,0.75); text-align: center; max-width: 340px; margin-top: 4px; }
    .body { flex: 1; padding: 48px 40px; display: flex; flex-direction: column; align-items: center; gap: 32px; }
    .event-label { font-size: 13px; font-weight: 600; letter-spacing: 0.06em; text-transform: uppercase; color: #6b7280; text-align: center; }
    .qr-wrap { background: #fff; border-radius: 20px; padding: 20px; box-shadow: 0 4px 24px rgba(0,0,0,0.10), 0 0 0 1px rgba(0,0,0,0.05); display: inline-block; }
    .qr-wrap img { display: block; width: 200px; height: 200px; }
    .scan-cta { font-size: 22px; font-weight: 700; color: #111827; text-align: center; letter-spacing: -0.01em; }
    .scan-sub { font-size: 13px; color: #6b7280; text-align: center; max-width: 320px; line-height: 1.6; }
    .url-chip { background: #f3f4f6; border-radius: 100px; padding: 8px 18px; font-size: 12px; color: #374151; font-weight: 500; word-break: break-all; text-align: center; }
    .code-line { font-size: 12.5px; color: #6b7280; text-align: center; line-height: 1.6; max-width: 340px; }
    .code-line strong { color: #111827; font-weight: 700; letter-spacing: 0.08em; }
    .divider { width: 48px; height: 2px; background: #e5e7eb; border-radius: 2px; }
    .footer { padding: 24px 40px; border-top: 1px solid #f3f4f6; display: flex; align-items: center; justify-content: center; gap: 8px; }
    .footer-logo { font-size: 15px; font-weight: 700; color: #1a3d2b; }
    .footer-tag { font-size: 11px; color: #9ca3af; }
    @media print { body { -webkit-print-color-adjust: exact; print-color-adjust: exact; } .page { width: 100%; min-height: 100vh; } }
  </style>
</head>
<body>
  <div class="page">
    <div class="hero">
      <p class="hero-eyebrow">Investment gift</p>
      <p class="hero-name">${recipientName}</p>
      <p class="hero-sub">Give a gift that grows. Every dollar becomes a real investment.</p>
    </div>
    <div class="body">
      ${pageLabel && !selected.isPermanent ? `<p class="event-label">${pageLabel}</p>` : ""}
      <div class="qr-wrap"><img src="${dataUrl}" alt="QR code" /></div>
      <p class="scan-cta">Scan to give a gift that grows</p>
      <p class="scan-sub">Scan the QR code or visit the link below to send ${recipientName} a real stock investment. No account needed.</p>
      <div class="divider"></div>
      <p class="url-chip">${selected.url}</p>
      ${exportGiftCode ? `<p class="code-line">No camera handy? Enter code <strong>${exportGiftCode}</strong> at ${codeLookupDisplay}</p>` : ""}
    </div>
    <div class="footer">
      <span class="footer-logo">Kiddo</span>
      <span class="footer-tag">${brandTagline}</span>
    </div>
  </div>
  <script>window.onload = () => { window.print(); };<\/script>
</body>
</html>`);
    win.document.close();
    haptic("success");
    setPrinting(false);
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      {/* Width audit 2026-05-25: was max-w-sm (384px) for all viewports —
          mobile-correct but cramped on desktop where 384px next to 1000+
          available px reads as "default tablet width" not "intentional
          mobile width". md:max-w-md bumps to 448px on tablet/desktop
          where there's room; mobile keeps the tighter 384 footprint. */}
      <DialogContent sheet className="p-0 gap-0 overflow-hidden sm:max-w-md" aria-describedby={undefined}>
        <DialogTitle className="sr-only">{recipientIsOwner ? "Share your gift link" : recipientName ? `Share ${recipientName}'s gift link` : "Share gift link"}</DialogTitle>
        {/* Mobile grab-handle — the native bottom-sheet affordance. Hidden on
            desktop (centered modal). Decorative; flex-shrink-0 so it stays put. */}
        <div aria-hidden className="sm:hidden" style={{ flexShrink: 0, margin: "8px auto 2px", width: 36, height: 4, borderRadius: 999, background: "rgba(26,23,16,0.15)" }} />

        {/* Header */}
        <div style={{
          display: "flex", alignItems: "center", justifyContent: "space-between",
          padding: "18px 20px 16px", borderBottom: "1px solid rgba(26,23,16,0.08)",
          flexShrink: 0,
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, flex: 1, minWidth: 0 }}>
            {view === "email" && (
              <button
                type="button"
                onClick={() => { setView("main"); haptic("selection"); }}
                style={{ padding: 4, borderRadius: 8, border: "none", background: "transparent", cursor: "pointer", color: "rgb(26,23,16)", display: "flex", alignItems: "center", flexShrink: 0 }}
              >
                <ArrowLeft size={16} />
              </button>
            )}
            <div>
              <p style={{ fontSize: 14, fontWeight: 700, color: "rgb(26,23,16)", lineHeight: 1.2 }}>
                {view === "email"
                  ? `Email invite`
                  : recipientIsOwner
                    ? `Share your gift link`
                    : recipientName
                      ? `Share ${recipientName}'s gift link`
                      : `Share gift link`}
              </p>
              <p style={{ fontSize: 11, color: "rgb(112,103,95)", marginTop: 2 }}>
                {view === "email" ? "Pre-written. Warm. Edit anything." : "Choose how you'd like to share"}
              </p>
            </div>
          </div>
          <ModalCloseButton onClick={onClose} label="Close" />
        </div>

        {/* Scrollable body — flex-1 + minHeight:0 so it fills the flex-col sheet
            and scrolls (instead of a fixed maxHeight, which broke scroll reach to
            the bottom section under the bottom-sheet anchor). */}
        <div style={{ overflowY: "auto", flex: 1, minHeight: 0 }}>
          <AnimatePresence mode="wait">
            {view === "main" ? (
              <motion.div
                key="main"
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -8 }}
                transition={{ duration: 0.15 }}
              >
                {/* Page selector */}
                {pages.length > 1 && (
                  <div style={{ padding: "14px 20px 0" }}>
                    <SectionLabel>Gift page</SectionLabel>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 2 }}>
                      {pages.map((page, idx) => (
                        <button
                          key={idx}
                          type="button"
                          onClick={() => { setSelectedIdx(idx); haptic("selection"); }}
                          style={{
                            padding: "6px 14px", borderRadius: 999, fontSize: 12, fontWeight: 500,
                            border: "none", cursor: "pointer", transition: "all 0.12s",
                            background: selectedIdx === idx ? "rgb(26,61,43)" : "rgb(243,240,236)",
                            color: selectedIdx === idx ? "white" : "rgb(100,92,86)",
                            fontFamily: "inherit",
                          }}
                        >
                          {page.isPermanent ? "Gift anytime" : page.label}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* QR + URL */}
                <div style={{ padding: "20px", display: "flex", flexDirection: "column", alignItems: "center", gap: 12 }}>
                  <AnimatePresence mode="wait">
                    <motion.div
                      key={selected.url}
                      initial={{ opacity: 0, scale: 0.95 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.95 }}
                      transition={{ duration: 0.15 }}
                      style={{ background: "white", borderRadius: 20, padding: 16, boxShadow: "0 2px 12px rgba(26,23,16,0.08), 0 0 0 1px rgba(26,23,16,0.05)", display: "flex", alignItems: "center", justifyContent: "center" }}
                    >
                      <QRCodeSVG
                        ref={(el) => { qrRef.current = el as SVGSVGElement | null; }}
                        value={selected.url}
                        size={156}
                        level="M"
                        role="img"
                        aria-label={`QR code linking to ${firstName}'s gift page`}
                      />
                    </motion.div>
                  </AnimatePresence>
                  <button
                    type="button"
                    onClick={handleCopy}
                    style={{
                      display: "flex", alignItems: "center", gap: 6,
                      background: "rgb(243,240,236)", borderRadius: 999,
                      padding: "6px 14px", border: "none", cursor: "pointer",
                      fontSize: 11.5, color: "rgb(100,92,86)", fontFamily: "inherit",
                      maxWidth: "100%", overflow: "hidden",
                    }}
                  >
                    <Link size={11} style={{ flexShrink: 0 }} />
                    <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{displayUrl}</span>
                  </button>
                </div>

                <div style={{ padding: "0 16px 6px" }}>

                  {/* Gift code — per-page when available, falls back to fund-level code */}
                  {(selected.giftCode ?? giftCode?.code) && (
                    <div style={{ marginBottom: 18 }}>
                      <SectionLabel>Gift code</SectionLabel>
                      <button
                        type="button"
                        onClick={async () => {
                          const activeCode = selected.giftCode ?? giftCode!.code;
                          try {
                            await navigator.clipboard.writeText(activeCode);
                            setCodeCopied(true);
                            haptic("success");
                            toast({ title: "Gift code copied", variant: "saved" });
                            setTimeout(() => setCodeCopied(false), 2200);
                          } catch {
                            window.prompt("Your gift code:", activeCode);
                          }
                        }}
                        style={{
                          width: "100%", display: "flex", alignItems: "center", gap: 12,
                          padding: "12px 16px", borderRadius: 14,
                          background: "rgb(26,61,43)", border: "none",
                          cursor: "pointer", textAlign: "left" as const,
                          transition: "opacity 0.12s",
                        }}
                        onMouseEnter={e => (e.currentTarget.style.opacity = "0.88")}
                        onMouseLeave={e => (e.currentTarget.style.opacity = "1")}
                      >
                        <div style={{ width: 36, height: 36, borderRadius: 10, background: "rgba(255,255,255,0.12)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                          <Hash size={16} color="rgba(255,255,255,0.85)" />
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <p style={{ fontSize: 11, color: "rgba(255,255,255,0.75)", fontWeight: 600, letterSpacing: "0.06em", textTransform: "uppercase" as const, marginBottom: 2 }}>
                            {selected.isPermanent ? "Fund code" : "Event code"}
                          </p>
                          <p style={{ fontSize: 20, fontWeight: 800, color: "white", letterSpacing: "0.12em", lineHeight: 1 }}>
                            {selected.giftCode ?? giftCode!.code}
                          </p>
                          <p style={{ fontSize: 10.5, color: "rgba(255,255,255,0.72)", marginTop: 3 }}>
                            Enter at {(giftCode?.lookupUrl ?? `${window.location.origin}/gift`).replace(/^https?:\/\//, "")}
                          </p>
                        </div>
                        <div style={{ flexShrink: 0 }}>
                          {codeCopied
                            ? <Check size={16} color="rgba(255,255,255,0.85)" />
                            : <Copy size={14} color="rgba(255,255,255,0.5)" />}
                        </div>
                      </button>
                      <p style={{ fontSize: 10.5, color: "rgb(112,103,95)", marginTop: 7, lineHeight: 1.5 }}>
                        {selected.isPermanent
                          ? "People can type this code at the link above. No URL needed."
                          : "This code goes to this specific occasion. Expired events redirect warmly to the main fund."}
                      </p>
                    </div>
                  )}

                  {/* Quick share */}
                  {/* Row order + label rework 2026-05-20. Previously:
                      Share-with-message / WhatsApp / Send-a-message
                      with all three subtitles saying "pre-written"
                      and rows 1 and 3 reading as duplicates ("Share
                      with message" vs "Send a message" — both have
                      "message" + "pre-written note" — user-reported:
                      "why are there two of the same?").

                      Each row actually does something distinct:
                        - WhatsApp: deep link to a specific named app
                        - Messages: sms: scheme to iMessage / SMS
                        - native share: navigator.share, OS-level
                          picker showing ALL installed apps (the
                          generic catch-all)

                      Three changes:
                        1. App names as labels — modern share-sheet
                           convention (Instagram / X / iMessage's
                           own). Drop "Send on X" verb prefix.
                        2. Differentiating subtitles — drop the
                           "pre-written" filler from all three
                           (was repeated in every row). Each
                           subtitle now carries the row's
                           distinguishing info: WhatsApp keeps
                           the "ready" promise, Messages
                           clarifies platform, More apps…
                           describes the picker's contents.
                        3. Reorder named apps first (single-tap,
                           recognizable), generic picker last as
                           the catch-all exit. */}
                  <div style={{ marginBottom: 18 }}>
                    <SectionLabel>Quick share</SectionLabel>
                    <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
                      <ShareRow
                        iconBg="rgb(37,211,102)"
                        icon={<WhatsAppIcon />}
                        label="WhatsApp"
                        subtitle="Pre-written, ready to send"
                        onClick={handleWhatsApp}
                      />
                      <ShareRow
                        iconBg="rgb(50,150,250)"
                        icon={<MessageIcon />}
                        label="Messages"
                        subtitle="iMessage or SMS"
                        onClick={handleSMS}
                      />
                      {/* Third row's job: "share to whatever channel you
                          want that isn't already a named row above." On
                          devices that support navigator.share (iOS,
                          Android, Edge, modern Safari/Chrome desktop) this
                          opens the OS share sheet listing every installed
                          app. On devices without navigator.share (Firefox
                          on any platform, very old browsers) we swap to a
                          prominent Copy link row, because clipboard +
                          paste-into-your-channel is the desktop-equivalent
                          of the share sheet.

                          User-reported 2026-05-20: some devices showed
                          three Quick share rows, others showed two,
                          producing visible inconsistency. The original
                          code hid the More apps… row entirely on no-
                          native-share devices, which left Firefox /
                          older-browser users with one fewer entry point
                          than mobile users. The brilliance fix: both
                          devices now see three Quick share rows; the
                          third row's label and action vary by capability
                          but the slot is always filled. Copy link also
                          remains as a small button in the Physical
                          section (alongside Print flyer / Save QR),
                          because that grouping is "tangible deliverables"
                          and Copy link belongs there too. Two slightly
                          different contexts for the same action; the
                          Quick share placement is the prominent
                          person-to-person share, the Physical placement
                          is the "produce a thing I can pass on" share. */}
                      <ShareRow
                        iconBg="rgb(184,121,26)"
                        icon={<Mail size={16} color="white" />}
                        label="Email invite"
                        subtitle="Pre-written, fully editable"
                        onClick={() => { setView("email"); haptic("selection"); }}
                      />
                      {canNativeShare ? (
                        <ShareRow
                          iconBg="rgb(26,61,43)"
                          icon={<Share2 size={16} color="white" />}
                          label="More apps…"
                          subtitle="Telegram, Mail, and more"
                          onClick={handleNativeShare}
                        />
                      ) : (
                        <ShareRow
                          iconBg="rgb(26,61,43)"
                          icon={<Link size={16} color="white" />}
                          label="Copy link"
                          subtitle="Paste it anywhere"
                          onClick={handleCopy}
                        />
                      )}
                    </div>
                  </div>

                  {/* Social */}
                  <div style={{ marginBottom: 18 }}>
                    <SectionLabel>Share on social</SectionLabel>
                    <div style={{ display: "flex", gap: 6 }}>
                      <SocialBtn label="Facebook" bg="rgb(24,119,242)" icon={<FacebookIcon />} onClick={handleFacebook} />
                      <SocialBtn label="X" bg="rgb(0,0,0)" icon={<XIcon />} onClick={handleX} />
                      <SocialBtn label="Story card" bg="linear-gradient(135deg, #833ab4, #fd1d1d, #fcb045)" icon={<StoryCardIcon />} onClick={handleStoryCard} loading={generatingCard} />
                    </div>
                    <p style={{ fontSize: 10, color: "rgb(112,103,95)", marginTop: 7, lineHeight: 1.5 }}>
                      Story card generates a 9:16 image for Stories or Shorts (Instagram, TikTok, Snap, YouTube Shorts).
                    </p>
                  </div>

                  {/* Physical */}
                  <div style={{ marginBottom: 18 }}>
                    <SectionLabel>Physical</SectionLabel>
                    <div style={{ display: "flex", gap: 8 }}>
                      <button
                        type="button"
                        onClick={handlePrintFlyer}
                        disabled={printing}
                        style={{
                          flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 7,
                          padding: "11px 14px", borderRadius: 12, border: "1.5px solid rgba(26,23,16,0.12)",
                          background: "white", cursor: printing ? "wait" : "pointer", opacity: printing ? 0.6 : 1,
                          fontSize: 12.5, fontWeight: 600, color: "rgb(26,23,16)", fontFamily: "inherit",
                          transition: "all 0.12s",
                        }}
                      >
                        <Printer size={14} />
                        {printing ? "Preparing..." : "Print flyer"}
                      </button>
                      <button
                        type="button"
                        onClick={handleDownloadQR}
                        disabled={downloading}
                        style={{
                          flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 7,
                          padding: "11px 14px", borderRadius: 12, border: "1.5px solid rgba(26,23,16,0.12)",
                          background: "white", cursor: downloading ? "wait" : "pointer", opacity: downloading ? 0.6 : 1,
                          fontSize: 12.5, fontWeight: 600, color: "rgb(26,23,16)", fontFamily: "inherit",
                          transition: "all 0.12s",
                        }}
                      >
                        <Download size={14} />
                        {downloading ? "Saving..." : "Save QR"}
                      </button>
                    </div>
                  </div>

                  {/* Redundancy audit 2026-05-25: the full-width "Copy link"
                      button that used to live here has been removed. The
                      same affordance already lives in TWO better-placed
                      spots: (1) the URL chip directly under the QR (always
                      visible at the top of the modal) and (2) the Quick
                      share "Copy link" row that renders when navigator.share
                      is unavailable. A third copy at the bottom was clutter
                      with no incremental utility. The Physical section
                      above (Print flyer / Save QR) ends the modal cleanly. */}
                </div>

                <div style={{ height: 8 }} />
              </motion.div>
            ) : (
              <motion.div
                key="email"
                initial={{ opacity: 0, x: 16 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 16 }}
                transition={{ duration: 0.15 }}
              >
                <div style={{ padding: "20px 20px 24px", display: "flex", flexDirection: "column", gap: 16 }}>

                  {/* Occasion context */}
                  <div style={{
                    background: "rgb(237,244,238)", borderRadius: 12,
                    padding: "10px 14px", display: "flex", alignItems: "center", gap: 10,
                  }}>
                    <div style={{ width: 8, height: 8, borderRadius: 999, background: "rgb(26,61,43)", flexShrink: 0 }} />
                    <p style={{ fontSize: 12, fontWeight: 600, color: "rgb(26,61,43)" }}>
                      {selected.isPermanent ? `${firstName}'s fund` : selected.label}
                    </p>
                    <p style={{ fontSize: 11, color: "rgb(60,100,80)", marginLeft: "auto" }}>{displayUrl}</p>
                  </div>

                  {/* TO */}
                  <div>
                    <label style={{ display: "block", fontSize: 10, fontWeight: 700, letterSpacing: "0.09em", textTransform: "uppercase" as const, color: "rgb(112,103,95)", marginBottom: 6 }}>
                      To
                    </label>
                    <input
                      type="text"
                      value={emailTo}
                      onChange={e => setEmailTo(e.target.value)}
                      placeholder="email@example.com, another@example.com"
                      style={{
                        width: "100%", padding: "10px 12px", borderRadius: 10,
                        border: "1.5px solid rgba(26,23,16,0.12)", fontSize: 13,
                        color: "rgb(26,23,16)", background: "white", outline: "none",
                        fontFamily: "inherit", boxSizing: "border-box" as const,
                      }}
                      onFocus={e => (e.target.style.borderColor = "rgb(26,61,43)")}
                      onBlur={e => (e.target.style.borderColor = "rgba(26,23,16,0.12)")}
                    />
                  </div>

                  {/* SUBJECT */}
                  <div>
                    <label style={{ display: "block", fontSize: 10, fontWeight: 700, letterSpacing: "0.09em", textTransform: "uppercase" as const, color: "rgb(112,103,95)", marginBottom: 6 }}>
                      Subject
                    </label>
                    <input
                      type="text"
                      value={emailSubject}
                      onChange={e => setEmailSubject(e.target.value)}
                      style={{
                        width: "100%", padding: "10px 12px", borderRadius: 10,
                        border: "1.5px solid rgba(26,23,16,0.12)", fontSize: 13,
                        color: "rgb(26,23,16)", background: "white", outline: "none",
                        fontFamily: "inherit", boxSizing: "border-box" as const,
                      }}
                      onFocus={e => (e.target.style.borderColor = "rgb(26,61,43)")}
                      onBlur={e => (e.target.style.borderColor = "rgba(26,23,16,0.12)")}
                    />
                  </div>

                  {/* MESSAGE */}
                  <div>
                    <label style={{ display: "block", fontSize: 10, fontWeight: 700, letterSpacing: "0.09em", textTransform: "uppercase" as const, color: "rgb(112,103,95)", marginBottom: 6 }}>
                      Message
                    </label>
                    <textarea
                      value={emailBody}
                      onChange={e => setEmailBody(e.target.value)}
                      rows={10}
                      style={{
                        width: "100%", padding: "10px 12px", borderRadius: 10,
                        border: "1.5px solid rgba(26,23,16,0.12)", fontSize: 13,
                        color: "rgb(26,23,16)", background: "white", outline: "none",
                        fontFamily: "inherit", resize: "vertical" as const, lineHeight: 1.6,
                        boxSizing: "border-box" as const,
                      }}
                      onFocus={e => (e.target.style.borderColor = "rgb(26,61,43)")}
                      onBlur={e => (e.target.style.borderColor = "rgba(26,23,16,0.12)")}
                    />
                    <p style={{ fontSize: 10.5, color: "rgb(112,103,95)", marginTop: 5, lineHeight: 1.5 }}>
                      Pre-written and warm. Edit anything. The link is already in the message.
                    </p>
                  </div>

                  {/* Send button */}
                  <button
                    type="button"
                    onClick={handleEmailSend}
                    style={{
                      width: "100%", padding: "14px 20px",
                      borderRadius: 14, border: "none", cursor: "pointer",
                      background: "rgb(184,121,26)", color: "white",
                      fontSize: 14, fontWeight: 700, fontFamily: "inherit",
                      display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                      letterSpacing: "-0.01em",
                    }}
                  >
                    <Mail size={15} />
                    Send invite
                  </button>

                  <p style={{ fontSize: 10.5, color: "rgb(112,103,95)", textAlign: "center" as const, lineHeight: 1.5 }}>
                    Opens your email app with this message ready to send.
                  </p>

                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
        {/* Snapshot footer — opens the print-ready single-page summary in
            a new tab. Only renders when the parent dropped this affordance
            in (Dashboard's rich modal + AppHeader's local one). Sized as
            a tertiary action so it doesn't compete with the main share
            options above. The destination view handles auth + privacy
            toggles. */}
        {snapshotHref && view === "main" && (
          <div
            style={{
              borderTop: "1px solid rgba(26,23,16,0.08)",
              padding: "10px 20px 14px 20px",
              background: "rgba(26,23,16,0.015)",
            }}
          >
            {/* Mini-header — calls out the AUDIENCE difference for
                this affordance. Previously "Fund snapshot" sat as a
                quiet footer next to the louder "Print flyer" / "Save
                QR" buttons in the Physical section, which read as if
                it was a third physical-deliverable variant. Adding
                the audience-naming eyebrow ("For your advisor or
                spouse") makes it legible at a glance that this is a
                DIFFERENT audience entirely — not for grandparents
                gifting, but for the people reviewing the fund's
                structure. Audit-flagged 2026-05-26. */}
            <p style={{ fontSize: 9.5, fontWeight: 700, color: "rgb(112,103,95)", textTransform: "uppercase" as const, letterSpacing: "0.08em", marginBottom: 8 }}>
              For your advisor or spouse
            </p>
            <div style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 10,
            }}>
            <div style={{ minWidth: 0 }}>
              {/* Copy retoned 2026-05-25 — previously read "Print a one-
                  page summary" which collided with the "Print flyer"
                  button in the Physical section above. Two competing
                  "print" affordances confused parents into asking which
                  one prints what. The Physical/Print flyer creates the
                  RECIPIENT-facing artifact (big QR, "scan to give a
                  gift"). The snapshot below is the AUDIT-facing one-
                  pager — fund holdings, strategy, balance — for a
                  spouse, advisor, or grandparent who needs to review
                  the fund's structure, not gift to it. Renaming to
                  "Fund snapshot" makes the difference legible. */}
              <p style={{ fontSize: 12.5, fontWeight: 600, color: "rgb(26,23,16)" }}>
                Fund snapshot
              </p>
              <p style={{ fontSize: 11, color: "rgb(112,103,95)", marginTop: 1, lineHeight: 1.4 }}>
                Holdings + strategy on one page. For a spouse, advisor, or grandparent reviewing the fund.
              </p>
            </div>
            <a
              href={snapshotHref}
              target="_blank"
              rel="noopener noreferrer"
              data-testid="link-share-snapshot"
              style={{
                fontSize: 12,
                fontWeight: 700,
                color: "hsl(143,47%,22%)",
                textDecoration: "none",
                whiteSpace: "nowrap",
                padding: "6px 10px",
                borderRadius: 999,
                border: "1px solid hsl(143,47%,22%)",
                flexShrink: 0,
              }}
              onClick={() => haptic("selection")}
            >
              Open →
            </a>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
