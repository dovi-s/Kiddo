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
  X
} from "lucide-react";

import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";

const canShare = typeof navigator !== "undefined" && "share" in navigator;

interface ShareKitProps {
  fundName: string;
  fundSlug: string;
  eventTitle?: string;
  eventSlug?: string;
  recipientName: string;
  isOpen: boolean;
  onClose: () => void;
}

export function ShareKit({ 
  fundName, 
  fundSlug, 
  eventTitle, 
  eventSlug, 
  recipientName,
  isOpen,
  onClose
}: ShareKitProps) {
  const [copied, setCopied] = useState(false);
  const [activeTab, setActiveTab] = useState<"link" | "qr" | "card">("link");
  
  const shareUrl = useMemo(() => {
    if (typeof window === "undefined") return `/${fundSlug}`;
    return eventSlug 
      ? `${window.location.origin}/${fundSlug}/${eventSlug}`
      : `${window.location.origin}/${fundSlug}`;
  }, [fundSlug, eventSlug]);
  
  const shareTitle = eventTitle 
    ? `Gift to ${recipientName}'s ${eventTitle}`
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
      `Thank you for being part of ${recipientName}'s journey!`
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
      <DialogContent className="max-w-md bg-white p-0 gap-0 overflow-hidden">
        <div className="p-5 border-b border-stone-100">
          <div className="flex items-center justify-between">
            <div>
              <DialogTitle className="font-semibold text-stone-900">Share {recipientName}'s Fund</DialogTitle>
              <p className="text-sm text-stone-500 mt-0.5">Invite friends and family to contribute</p>
            </div>
            <button 
              onClick={onClose}
              className="p-2 -mr-2 text-stone-400 hover:text-stone-600 transition-colors"
            >
              <X size={20} />
            </button>
          </div>
        </div>

        <div className="flex border-b border-stone-100">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              data-testid={`tab-share-${tab.id}`}
              className={`flex-1 py-3 px-4 text-sm font-medium flex items-center justify-center gap-2 transition-colors ${
                activeTab === tab.id 
                  ? "text-stone-900 border-b-2 border-stone-900" 
                  : "text-stone-500 hover:text-stone-700"
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
              <div className="flex items-center gap-2 p-3 bg-stone-50 rounded-lg border border-stone-200">
                <input
                  type="text"
                  value={shareUrl}
                  readOnly
                  className="flex-1 bg-transparent text-sm text-stone-700 focus:outline-none truncate"
                />
                <button
                  onClick={handleCopy}
                  data-testid="button-copy-link"
                  className={`p-2 rounded-lg transition-colors ${
                    copied 
                      ? "bg-emerald-100 text-emerald-600" 
                      : "bg-white text-stone-600 hover:bg-stone-100 border border-stone-200"
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
                    className="flex items-center justify-center gap-2 py-3 bg-stone-900 text-white rounded-xl font-medium hover:bg-stone-800 transition-colors col-span-2"
                  >
                    <Share2 size={18} />
                    Share
                  </button>
                )}
                <button
                  onClick={handleTextShare}
                  data-testid="button-text-share"
                  className="flex items-center justify-center gap-2 py-3 border border-stone-200 text-stone-700 rounded-xl font-medium hover:bg-stone-50 transition-colors"
                >
                  <MessageCircle size={18} />
                  Text
                </button>
                <button
                  onClick={handleEmailShare}
                  data-testid="button-email-share"
                  className="flex items-center justify-center gap-2 py-3 border border-stone-200 text-stone-700 rounded-xl font-medium hover:bg-stone-50 transition-colors"
                >
                  <Mail size={18} />
                  Email
                </button>
              </div>

              <div className="pt-4 border-t border-stone-100">
                <p className="text-xs text-stone-400 text-center">
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
                <div className="p-4 bg-white rounded-2xl border-2 border-stone-200 shadow-sm">
                  <QRCodeSVG 
                    value={shareUrl}
                    size={180}
                    level="H"
                    includeMargin={false}
                    fgColor="#1c1917"
                  />
                </div>
              </div>

              <div className="text-center">
                <p className="text-sm font-medium text-stone-900 mb-1">
                  Scan to gift
                </p>
                <p className="text-xs text-stone-500">
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
                className="w-full flex items-center justify-center gap-2 py-3 bg-stone-900 text-white rounded-xl font-medium hover:bg-stone-800 transition-colors"
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
              <div className="relative aspect-[1.6/1] bg-gradient-to-br from-stone-800 via-stone-900 to-stone-950 rounded-2xl p-5 overflow-hidden shadow-xl">
                <div className="absolute inset-0 opacity-10">
                  <div className="absolute top-0 right-0 w-64 h-64 bg-white rounded-full blur-3xl transform translate-x-1/2 -translate-y-1/2" />
                  <div className="absolute bottom-0 left-0 w-48 h-48 bg-amber-500 rounded-full blur-3xl transform -translate-x-1/2 translate-y-1/2" />
                </div>
                
                <div className="relative h-full flex flex-col justify-between">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="text-stone-400 text-xs uppercase tracking-wider mb-1">Gift to</p>
                      <p className="text-white text-lg font-semibold">{recipientName}'s Fund</p>
                    </div>
                    <Sparkles className="w-6 h-6 text-amber-400" />
                  </div>
                  
                  <div className="flex items-end justify-between">
                    <div>
                      {eventTitle && (
                        <p className="text-stone-400 text-xs mb-1">{eventTitle}</p>
                      )}
                      <p className="text-white text-sm font-mono tracking-tight">{fundSlug}.kora.com</p>
                    </div>
                    <div className="bg-white/10 backdrop-blur rounded-lg p-2">
                      <QRCodeSVG 
                        value={shareUrl}
                        size={48}
                        level="L"
                        bgColor="transparent"
                        fgColor="white"
                      />
                    </div>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <button
                  data-testid="button-add-wallet"
                  className="flex items-center justify-center gap-2 py-3 bg-stone-900 text-white rounded-xl font-medium hover:bg-stone-800 transition-colors"
                >
                  <Smartphone size={18} />
                  Add to Wallet
                </button>
                <button
                  data-testid="button-print-card"
                  className="flex items-center justify-center gap-2 py-3 border border-stone-200 text-stone-700 rounded-xl font-medium hover:bg-stone-50 transition-colors"
                >
                  <Download size={18} />
                  Print
                </button>
              </div>

              <p className="text-xs text-stone-400 text-center">
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
          ? "bg-stone-900 text-white hover:bg-stone-800"
          : "border border-stone-200 text-stone-700 hover:bg-stone-50"
      } ${
        size === "sm" ? "py-2 px-3 text-sm rounded-lg" : "py-3 px-4 rounded-xl"
      }`}
    >
      <Share2 size={size === "sm" ? 16 : 18} />
      Share
    </button>
  );
}
