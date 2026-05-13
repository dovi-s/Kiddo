import { useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { QRCodeSVG } from "qrcode.react";
import { 
  Share2, 
  Copy, 
  Check, 
  Download, 
  MessageCircle, 
  Mail, 
  Smartphone,
  CreditCard,
  QrCode,
  Sparkles,
  X,
  ChevronDown,
  Calendar,
  Gift
} from "lucide-react";

import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";

const canShare = typeof navigator !== "undefined" && "share" in navigator;

interface ShareOption {
  id: string;
  title: string;
  slug: string;
  isDefault?: boolean;
  date?: string;
}

interface ShareKitProps {
  fundName: string;
  fundSlug: string;
  eventTitle?: string;
  eventSlug?: string;
  recipientName: string;
  isOpen: boolean;
  onClose: () => void;
  shareOptions?: ShareOption[];
  defaultShareId?: string;
}

export function ShareKit({ 
  fundName, 
  fundSlug, 
  eventTitle, 
  eventSlug, 
  recipientName,
  isOpen,
  onClose,
  shareOptions,
  defaultShareId
}: ShareKitProps) {
  const [copied, setCopied] = useState(false);
  const [activeTab, setActiveTab] = useState<"link" | "qr" | "card">("link");
  const [selectedShareId, setSelectedShareId] = useState<string>(defaultShareId || "fund");
  const [showOptions, setShowOptions] = useState(false);
  
  const selectedOption = shareOptions?.find(o => o.id === selectedShareId);
  const currentEventSlug = selectedOption?.slug || eventSlug;
  const currentEventTitle = selectedOption?.title || eventTitle;
  
  const shareUrl = useMemo(() => {
    if (typeof window === "undefined") return `/${fundSlug}`;
    return currentEventSlug 
      ? `${window.location.origin}/${fundSlug}/${currentEventSlug}`
      : `${window.location.origin}/${fundSlug}`;
  }, [fundSlug, currentEventSlug]);
  
  const shareTitle = currentEventTitle 
    ? `Gift to ${recipientName}'s ${currentEventTitle}`
    : `Gift to ${recipientName}'s Future Fund`;

  const handleCopy = () => {
    if (typeof navigator === "undefined") return;
    navigator.clipboard?.writeText(shareUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleNativeShare = () => {
    if (typeof navigator === "undefined") return;
    navigator.share?.({
      title: shareTitle,
      text: `Help grow ${recipientName}'s future with a gift that grows over time.`,
      url: shareUrl
    }).catch(() => {});
  };

  const handleTextShare = () => {
    if (typeof window === "undefined") return;
    const message = encodeURIComponent(`Gift to ${recipientName}'s future: ${shareUrl}`);
    window.open(`sms:?&body=${message}`, "_blank");
  };

  const handleEmailShare = () => {
    if (typeof window === "undefined") return;
    const subject = encodeURIComponent(shareTitle);
    const body = encodeURIComponent(
      `I'm collecting gifts for ${recipientName}'s investment fund - a gift that grows over time!\n\n` +
      `Instead of toys or gift cards, you can contribute to their future. Every gift is invested and grows alongside ${recipientName}.\n\n` +
      `Contribute here: ${shareUrl}\n\n` +
      `Thank you for helping ${recipientName}'s fund grow.`
    );
    window.open(`mailto:?subject=${subject}&body=${body}`, "_blank");
  };

  const tabs = [
    { id: "link" as const, label: "Share Link", icon: Share2 },
    { id: "qr" as const, label: "QR Code", icon: QrCode },
    { id: "card" as const, label: "Gift Card", icon: CreditCard },
  ];

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-md bg-card p-0 gap-0 overflow-hidden">
        <div className="p-5 border-b border-border">
          <div className="flex items-center justify-between">
            <div>
              <DialogTitle className="font-semibold text-foreground">Share {recipientName}'s Fund</DialogTitle>
              <p className="text-sm text-muted-foreground mt-0.5">Invite friends and family to contribute</p>
            </div>
            <button 
              onClick={onClose}
              className="p-2 -mr-2 text-muted-foreground hover:text-foreground transition-colors"
            >
              <X size={20} />
            </button>
          </div>
        </div>

        {shareOptions && shareOptions.length > 1 && (
          <div className="px-5 py-3 border-b border-border bg-muted/30">
            <p className="text-[11px] text-muted-foreground mb-2 uppercase tracking-wide font-medium">Sharing</p>
            <div className="relative">
              <button
                onClick={() => setShowOptions(!showOptions)}
                className="w-full flex items-center justify-between gap-3 px-4 py-3 bg-card border border-border rounded-xl text-left hover:border-primary/30 transition-colors"
              >
                <div className="flex items-center gap-3">
                  {selectedOption?.isDefault ? (
                    <div className="w-8 h-8 rounded-lg bg-[hsl(var(--kora-evergreen)/0.1)] flex items-center justify-center">
                      <Gift size={16} className="text-[hsl(var(--kora-evergreen))]" />
                    </div>
                  ) : (
                    <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
                      <Calendar size={16} className="text-primary" />
                    </div>
                  )}
                  <div>
                    <p className="text-sm font-medium text-foreground">{selectedOption?.title || "Gift anytime"}</p>
                    <p className="text-xs text-muted-foreground">
                      {selectedOption?.isDefault ? "Always open" : selectedOption?.date || "Event"}
                    </p>
                  </div>
                </div>
                <ChevronDown size={16} className={`text-muted-foreground transition-transform ${showOptions ? "rotate-180" : ""}`} />
              </button>
              
              <AnimatePresence>
                {showOptions && (
                  <motion.div
                    initial={{ opacity: 0, y: -8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -8 }}
                    transition={{ duration: 0.15 }}
                    className="absolute top-full left-0 right-0 mt-2 bg-card border border-border rounded-xl shadow-lg overflow-hidden z-10"
                  >
                    {shareOptions.map((option) => (
                      <button
                        key={option.id}
                        onClick={() => { setSelectedShareId(option.id); setShowOptions(false); }}
                        className={`w-full flex items-center gap-3 px-4 py-3 text-left transition-colors ${
                          selectedShareId === option.id
                            ? "bg-[hsl(var(--kora-evergreen)/0.1)]"
                            : "hover:bg-muted"
                        }`}
                      >
                        {option.isDefault ? (
                          <div className="w-8 h-8 rounded-lg bg-[hsl(var(--kora-evergreen)/0.1)] flex items-center justify-center">
                            <Gift size={16} className="text-[hsl(var(--kora-evergreen))]" />
                          </div>
                        ) : (
                          <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
                            <Calendar size={16} className="text-primary" />
                          </div>
                        )}
                        <div className="flex-1">
                          <p className="text-sm font-medium text-foreground">{option.title}</p>
                          <p className="text-xs text-muted-foreground">
                            {option.isDefault ? "Always open" : option.date || "Event"}
                          </p>
                        </div>
                        {selectedShareId === option.id && (
                          <Check size={16} className="text-[hsl(var(--kora-evergreen))]" />
                        )}
                      </button>
                    ))}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
        )}

        <div className="flex border-b border-border">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              data-testid={`tab-share-${tab.id}`}
              className={`flex-1 py-3 px-4 text-sm font-medium flex items-center justify-center gap-2 transition-colors ${
                activeTab === tab.id 
                  ? "text-foreground border-b-2 border-primary" 
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <tab.icon size={16} />
              {tab.label}
            </button>
          ))}
        </div>

        <AnimatePresence mode="wait">
          {activeTab === "link" && (
            <motion.div
              key="link"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="p-5 space-y-4"
            >
              <div className="flex items-center gap-2 p-3 bg-muted rounded-lg border border-border">
                <input
                  type="text"
                  value={shareUrl}
                  readOnly
                  className="flex-1 bg-transparent text-sm text-foreground focus:outline-none truncate"
                />
                <button
                  onClick={handleCopy}
                  data-testid="button-copy-link"
                  className={`p-2 rounded-lg transition-colors ${
                    copied 
                      ? "bg-success/10 text-success" 
                      : "bg-card text-muted-foreground hover:bg-secondary border border-border"
                  }`}
                >
                  {copied ? <Check size={16} /> : <Copy size={16} />}
                </button>
              </div>

              <div className="grid grid-cols-2 gap-3">
                {"share" in navigator && (
                  <button
                    onClick={handleNativeShare}
                    data-testid="button-native-share"
                    className="flex items-center justify-center gap-2 py-3 bg-primary text-primary-foreground rounded-xl font-medium hover:bg-primary/90 transition-colors col-span-2"
                  >
                    <Share2 size={18} />
                    Share
                  </button>
                )}
                <button
                  onClick={handleTextShare}
                  data-testid="button-text-share"
                  className="flex items-center justify-center gap-2 py-3 border border-border text-foreground rounded-xl font-medium hover:bg-muted transition-colors"
                >
                  <MessageCircle size={18} />
                  Text
                </button>
                <button
                  onClick={handleEmailShare}
                  data-testid="button-email-share"
                  className="flex items-center justify-center gap-2 py-3 border border-border text-foreground rounded-xl font-medium hover:bg-muted transition-colors"
                >
                  <Mail size={18} />
                  Email
                </button>
              </div>

              <div className="pt-4 border-t border-border">
                <p className="text-xs text-muted-foreground text-center">
                  Anyone with the link can contribute to {recipientName}'s fund
                </p>
              </div>
            </motion.div>
          )}

          {activeTab === "qr" && (
            <motion.div
              key="qr"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="p-5 space-y-4"
            >
              <div className="flex justify-center">
                <div className="p-4 bg-card rounded-2xl border-2 border-border shadow-sm">
                  <QRCodeSVG 
                    value={shareUrl}
                    size={180}
                    level="H"
                    includeMargin={false}
                    fgColor="hsl(var(--foreground))"
                  />
                </div>
              </div>

              <div className="text-center">
                <p className="text-sm font-medium text-foreground mb-1">
                  Scan to gift
                </p>
                <p className="text-xs text-muted-foreground">
                  Perfect for party displays and invitations
                </p>
              </div>

              <button
                onClick={() => {
                  const svg = document.querySelector('.qr-code-container svg');
                  if (svg) {
                    const svgData = new XMLSerializer().serializeToString(svg);
                    const canvas = document.createElement("canvas");
                    const ctx = canvas.getContext("2d");
                    const img = new Image();
                    img.onload = () => {
                      canvas.width = img.width;
                      canvas.height = img.height;
                      ctx?.drawImage(img, 0, 0);
                      const pngFile = canvas.toDataURL("image/png");
                      const downloadLink = document.createElement("a");
                      downloadLink.download = `${fundSlug}-qr.png`;
                      downloadLink.href = pngFile;
                      downloadLink.click();
                    };
                    img.src = "data:image/svg+xml;base64," + btoa(svgData);
                  }
                }}
                data-testid="button-download-qr"
                className="w-full flex items-center justify-center gap-2 py-3 bg-primary text-primary-foreground rounded-xl font-medium hover:bg-primary/90 transition-colors"
              >
                <Download size={18} />
                Download QR Code
              </button>
            </motion.div>
          )}

          {activeTab === "card" && (
            <motion.div
              key="card"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="p-5 space-y-4"
            >
              <div className="relative aspect-[1.6/1] bg-primary rounded-2xl p-5 overflow-hidden shadow-xl">
                <div className="relative h-full flex flex-col justify-between">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="text-primary-foreground/60 text-xs uppercase tracking-wider mb-1">Gift to</p>
                      <p className="text-primary-foreground text-lg font-semibold">{recipientName}'s Fund</p>
                    </div>
                    <Sparkles className="w-6 h-6 text-[hsl(var(--kora-gold))]" />
                  </div>
                  
                  <div className="flex items-end justify-between">
                    <div>
                      {eventTitle && (
                        <p className="text-primary-foreground/60 text-xs mb-1">{eventTitle}</p>
                      )}
                      <p className="text-primary-foreground text-sm font-mono tracking-tight">{fundSlug}.kiddofund.com</p>
                    </div>
                    <div className="bg-primary-foreground/10 rounded-lg p-2">
                      <QRCodeSVG 
                        value={shareUrl}
                        size={48}
                        level="L"
                        bgColor="transparent"
                        fgColor="hsl(var(--primary-foreground))"
                      />
                    </div>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <button
                  data-testid="button-add-wallet"
                  className="flex items-center justify-center gap-2 py-3 bg-primary text-primary-foreground rounded-xl font-medium hover:bg-primary/90 transition-colors"
                >
                  <Smartphone size={18} />
                  Add to Wallet
                </button>
                <button
                  data-testid="button-print-card"
                  className="flex items-center justify-center gap-2 py-3 border border-border text-foreground rounded-xl font-medium hover:bg-muted transition-colors"
                >
                  <Download size={18} />
                  Print
                </button>
              </div>

              <p className="text-xs text-muted-foreground text-center">
                Beautiful cards for invitations and party displays
              </p>
            </motion.div>
          )}
        </AnimatePresence>
      </DialogContent>
    </Dialog>
  );
}

export function ShareButton({ 
  onClick,
  variant = "primary",
  size = "md"
}: { 
  onClick: () => void;
  variant?: "primary" | "secondary";
  size?: "sm" | "md";
}) {
  return (
    <button
      onClick={onClick}
      data-testid="button-open-share-kit"
      className={`flex items-center justify-center gap-2 font-medium transition-colors ${
        variant === "primary"
          ? "bg-primary text-primary-foreground hover:bg-primary/90"
          : "border border-border text-foreground hover:bg-muted"
      } ${
        size === "sm" ? "py-2 px-3 text-sm rounded-lg" : "py-3 px-4 rounded-xl"
      }`}
    >
      <Share2 size={size === "sm" ? 16 : 18} />
      Share
    </button>
  );
}
