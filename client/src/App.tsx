import { useEffect, useLayoutEffect, useRef, useState, lazy, Suspense, type ReactNode } from "react";
import { Switch, Route, useLocation, useSearch } from "wouter";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { MOTION } from "@/lib/motion";
import { hasActiveDeepLink } from "@/lib/deep-link-highlight";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { RealtimeProvider } from "@/lib/realtime-context";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { KoraProvider } from "./lib/KoraContext";
import { MobileNav } from "@/components/layout/MobileNav";
import { DesktopSidebar } from "@/components/layout/DesktopSidebar";
import { GlobalShareModal } from "@/components/GlobalShareModal";
import { DemoBanner } from "@/components/DemoBanner";
import { Mascot } from "@/components/ui/mascot";
import { GradientText } from "@/components/ui/gemini";
import { useAuth } from "@/hooks/use-auth";
import Home from "@/pages/Home";

const NotFound = lazy(() => import("@/pages/not-found"));
const Dashboard = lazy(() => import("@/pages/Dashboard"));
const Settings = lazy(() => import("@/pages/Settings"));
const Account = lazy(() => import("@/pages/Account"));
const Activity = lazy(() => import("@/pages/Activity"));
const ActivityDetail = lazy(() => import("@/pages/ActivityDetail"));
const Onboard = lazy(() => import("@/pages/Onboard"));
// /send route was removed 2026-05-14. Send.tsx was a UI-only
// prototype with a "Coming soon" banner and no real API. Public
// route to a non-functional feature is worse than no route. The
// component file is preserved in git as design reference; if the
// feature ships later, restore the import + the Route below + the
// page-title mapping + the hidden-paths entries in MobileNav /
// DesktopSidebar / AppHeader title map.
const Claim = lazy(() => import("@/pages/Claim"));
const ClaimFund = lazy(() => import("@/pages/ClaimFund"));
const InvitationAccept = lazy(() => import("@/pages/InvitationAccept"));
const FundsOverview = lazy(() => import("@/pages/FundsOverview"));
const GiftLookup = lazy(() => import("@/pages/GiftLookup"));
const GetStarted = lazy(() => import("@/pages/GetStarted"));
const ActivateInvesting = lazy(() => import("@/pages/ActivateInvesting"));
const GiftCheckout = lazy(() => import("@/pages/GiftCheckout"));
const Login = lazy(() => import("@/pages/Login"));
const ResetPassword = lazy(() => import("@/pages/ResetPassword"));
const VerifyEmail = lazy(() => import("@/pages/VerifyEmail"));
const ConfirmEmailChange = lazy(() => import("@/pages/ConfirmEmailChange"));
const CancelEmailChange = lazy(() => import("@/pages/CancelEmailChange"));
const EventCreate = lazy(() => import("@/pages/EventCreate"));
const FAQ = lazy(() => import("@/pages/FAQ"));
const HowItWorks = lazy(() => import("@/pages/HowItWorks"));
const CalculatorAt18 = lazy(() => import("@/pages/CalculatorAt18"));
const RobuxVsUtma = lazy(() => import("@/pages/RobuxVsUtma"));
const UtmaByStateIndex = lazy(() => import("@/pages/UtmaByStateIndex"));
const UtmaByState = lazy(() => import("@/pages/UtmaByState"));
const Pricing = lazy(() => import("@/pages/Pricing"));
const FoundingMembers = lazy(() => import("@/pages/FoundingMembers"));
const SponsorSuccess = lazy(() => import("@/pages/SponsorSuccess"));
const Blog = lazy(() => import("@/pages/Blog"));
const BlogPost = lazy(() => import("@/pages/BlogPost"));
const Stories = lazy(() => import("@/pages/Stories"));
const StoryPage = lazy(() => import("@/pages/StoryPage"));
const Compare = lazy(() => import("@/pages/Compare"));
const Demo = lazy(() => import("@/pages/Demo"));
const Security = lazy(() => import("@/pages/Security"));
const Age18 = lazy(() => import("@/pages/Age18"));
const Age18Plan = lazy(() => import("@/pages/Age18Plan"));
const TaxDocuments = lazy(() => import("@/pages/TaxDocuments"));
const TaxDocsExplainer = lazy(() => import("@/pages/TaxDocsExplainer"));
const Projection = lazy(() => import("@/pages/Projection"));
const FundSnapshot = lazy(() => import("@/pages/FundSnapshot"));
const MemoryBook = lazy(() => import("@/pages/MemoryBook"));
const MemoryRedirect = lazy(() => import("@/pages/MemoryRedirect"));
const GiftSuccess = lazy(() => import("@/pages/GiftSuccess"));
const KidView = lazy(() => import("@/pages/KidView"));
const AgeTransitionManager = lazy(() => import("@/pages/AgeTransitionManager"));
const AgeTransitionInvite = lazy(() => import("@/pages/AgeTransitionInvite"));
const AgeTransitionVerify = lazy(() => import("@/pages/AgeTransitionVerify"));
const Age18Welcome = lazy(() => import("@/pages/Age18Welcome"));
const GiveAGift = lazy(() => import("@/pages/GiveAGift"));
const YourStory = lazy(() => import("@/pages/YourStory"));
const GifterShare = lazy(() => import("@/pages/GifterShare"));
const GifterUnsubscribe = lazy(() => import("@/pages/GifterUnsubscribe"));
const GifterDashboard = lazy(() => import("@/pages/GifterDashboard"));
const About = lazy(() => import("@/pages/About"));
const Contact = lazy(() => import("@/pages/Contact"));
const PersonalFunds = lazy(() => import("@/pages/PersonalFunds"));
const Legal = lazy(() => import("@/pages/Legal"));
const Admin = lazy(() => import("@/pages/Admin"));

type SeoConfig = {
  title: string;
  description: string;
  robots: string;
  ogType?: "website" | "article";
};

const appLoadingMessages = [
  "Checking on your child's future.",
  "Every gift is still there.",
  "Building something real.",
  "Opening the story behind the fund.",
];

function normalizePath(path: string): string {
  const cleaned = path.split("?")[0].split("#")[0] || "/";
  if (cleaned !== "/" && cleaned.endsWith("/")) return cleaned.slice(0, -1);
  return cleaned;
}

function isPublicGiftRoute(path: string): boolean {
  const pathname = normalizePath(path);
  const segments = pathname.split("/").filter(Boolean);
  const reserved = new Set([
    "login",
    "get-started",
    "onboard",
    "activate",
    "dashboard",
    "account",
    "settings",
    "activity",
    "events",
    "event",
    "send",
    "claim",
    "faq",
    "how-it-works",
    "about",
    "legal",
    "pricing",
    "compare",
    "blog",
    "stories",
    "security",
    "admin",
    "memory",
    "gift",
    "kid",
    "transition",
    "updates",
    "gifter",
    "personal-funds",
    "contact",
    "age-18",
    "age-18-plan",
    "projection",
    "tax-documents",
    // Routes added later. Originally this carve-out was framed as
    // "authenticated routes added later," but the rule is broader:
    // ANY new top-level path (public or authenticated) needs to be
    // reserved here, or the fund-slug catch-all `/:fund` for gift
    // checkout silently eats it. The page still renders correctly
    // (Wouter's Switch picks the right route by exact match), but
    // App.tsx's isGiftPage check returns true and fires a stale
    // public-gift prefetch for the wrong slug, surfacing as a 404
    // in the browser console. Audit + sweep 2026-05-14: seven
    // additions had drifted out of sync; all caught and added below.
    "funds",
    "invitations",
    "take-over",
    "fund-snapshot",
    "demo",
    "profile",
    "tools",
    "fund",
    "welcome-at-18",
    "give-a-gift",
    "your-story",
  ]);

  if (segments.length === 0) return false;
  if (reserved.has(segments[0])) return false;
  return segments.length === 1 || segments.length === 2;
}

function isMarketingRoute(path: string): boolean {
  const pathname = normalizePath(path);

  if (
    pathname === "/" ||
    pathname === "/faq" ||
    pathname === "/how-it-works" ||
    pathname === "/pricing" ||
    pathname === "/founding-members" ||
    pathname === "/blog" ||
    pathname === "/stories" ||
    pathname === "/compare" ||
    pathname === "/security" ||
    pathname === "/age-18" ||
    pathname === "/about" ||
    pathname === "/personal-funds" ||
    pathname === "/contact" ||
    pathname === "/legal" ||
    pathname === "/tools/at-18-calculator" ||
    pathname === "/tools/robux-vs-utma" ||
    pathname === "/robux-vs-utma" ||
    pathname === "/tools/utma-by-state"
  ) {
    return true;
  }

  return (
    pathname.startsWith("/blog/") ||
    pathname.startsWith("/stories/") ||
    pathname.startsWith("/compare/") ||
    pathname.startsWith("/tools/utma-by-state/")
  );
}

function getSeoForPath(path: string): SeoConfig {
  const pathname = normalizePath(path);
  const genericPrivate: SeoConfig = {
    title: "Kiddo",
    description: "Kiddo dashboard and account experience.",
    robots: "noindex, nofollow, noarchive",
    ogType: "website",
  };

  if (pathname === "/") {
    return {
      title: "Kiddo | Gifts that grow. Starting with their next birthday.",
      description: "Share a link. Family and friends gift. The money buys real stocks. No account needed. Free to start.",
      robots: "index, follow",
      ogType: "website",
    };
  }
  if (pathname === "/get-started") {
    return {
      title: "Get Started | Kiddo",
      description: "Create your Kiddo fund, personalize your page, and start receiving gifts that can compound for the future.",
      robots: "index, follow",
      ogType: "website",
    };
  }
  if (pathname === "/faq") {
    return {
      title: "Kiddo FAQ | Every question answered. Plain language. No jargon.",
      description: "Get answers about gifting, investment basics, fees, account setup, safety, and how Kiddo works.",
      robots: "index, follow",
      ogType: "article",
    };
  }
  if (pathname === "/pricing") {
    return {
      title: "Kiddo Pricing | Simple, transparent pricing for every family",
      description: "Free to start. Kiddo+ is $3.99/mo for one child. Kiddo Family is $6.99/mo for every child fund you manage. Gifters pay transparent processing before checkout.",
      robots: "index, follow",
      ogType: "website",
    };
  }
  if (pathname === "/founding-members") {
    return {
      title: "Kiddo Founding Members | First 1,000 families shape the platform",
      description: "Lifetime $19/year Plus price lock, Founding Member badge, early access to every future Kiddo product, $25 starter gift credit. Cap 1,000.",
      robots: "index, follow",
      ogType: "website",
    };
  }
  if (pathname === "/compare") {
    return {
      title: "How Kiddo Compares | The best EarlyBird alternative and more",
      description: "See how Kiddo compares to EarlyBird, Greenlight, Stockpile, 529 plans, and savings accounts. Honest comparisons. Real differences.",
      robots: "index, follow",
      ogType: "website",
    };
  }
  if (pathname.startsWith("/compare/")) {
    return {
      title: "Kiddo Comparisons",
      description: "Honest comparisons showing where Kiddo fits relative to the alternatives parents evaluate most often.",
      robots: "index, follow",
      ogType: "article",
    };
  }
  if (pathname === "/blog") {
    return {
      title: "Kiddo Guides | Gifts that last.",
      description: "Plain-language guides for birthdays, family gifting, child funds, and turning cash gifts into a head start.",
      robots: "index, follow",
      ogType: "website",
    };
  }
  if (pathname.startsWith("/blog/")) {
    return {
      title: "Kiddo Guides",
      description: "Practical guides for gifts that last.",
      robots: "index, follow",
      ogType: "article",
    };
  }
  if (pathname === "/stories") {
    return {
      title: "Kiddo Stories | Real families. Real funds. Real growth.",
      description: "See how real families are using Kiddo to turn birthdays, baby showers, and holidays into real investments for their children.",
      robots: "index, follow",
      ogType: "website",
    };
  }
  if (pathname.startsWith("/stories/")) {
    return {
      title: "Kiddo Stories",
      description: "A curated Kiddo family story.",
      robots: "index, follow",
      ogType: "article",
    };
  }
  if (pathname === "/security") {
    return {
      title: "Kiddo Security | Your child's money is protected.",
      description: "Investments held by DriveWealth, a FINRA-registered broker-dealer with SIPC coverage. Here is exactly how Kiddo protects your child's investments.",
      robots: "index, follow",
      ogType: "article",
    };
  }
  if (pathname === "/age-18") {
    return {
      title: "What happens when your child turns 18 | Kiddo",
      description: "At 18, your child's Kiddo fund legally becomes theirs. Here is exactly what happens, what they inherit, and how Kiddo guides the transition.",
      robots: "index, follow",
      ogType: "article",
    };
  }
  if (pathname === "/about") {
    return {
      title: "About | Kiddo",
      description: "Learn Kiddo's mission: helping families turn life-moment gifts into long-term financial momentum.",
      robots: "index, follow",
      ogType: "article",
    };
  }
  if (pathname === "/contact") {
    return {
      title: "Contact Kiddo | We respond to every message.",
      description: "Questions about Kiddo? Email us. We respond to every message. For transfers, support, security, and press inquiries.",
      robots: "index, follow",
      ogType: "website",
    };
  }
  if (pathname === "/personal-funds") {
    return {
      title: "Personal Investment Funds | Kiddo",
      description: "Want to receive stock as gifts for your own occasions? Personal Kiddo funds are coming. Join the waitlist and be first to know.",
      robots: "index, follow",
      ogType: "website",
    };
  }
  if (pathname === "/legal") {
    return {
      title: "Legal | Kiddo",
      description: "Read Kiddo's terms, privacy policy, and key disclosures.",
      robots: "index, follow",
      ogType: "article",
    };
  }
  if (pathname === "/how-it-works") {
    return {
      title: "How Kiddo Works | Real gifts. Real stocks. 60 seconds to give.",
      description: "See exactly how Kiddo works for parents and gifters. Create a fund, share a link, watch gifts get invested automatically. Takes 2 minutes to set up.",
      robots: "index, follow",
      ogType: "website",
    };
  }
  if (pathname === "/tools/at-18-calculator") {
    return {
      title: "UTMA Calculator: What investing for a kid becomes by 18 | Kiddo",
      description: "Honest math for parents and grandparents investing for a child. See how consistent monthly investing through a UTMA grows over the years to age 18. Kiddo's annual fee ($1/yr per $1,000 invested) already netted from the projection.",
      robots: "index, follow",
      ogType: "website",
    };
  }
  if (pathname === "/tools/robux-vs-utma" || pathname === "/robux-vs-utma") {
    return {
      title: "Robux vs UTMA: What your kid's monthly Roblox spend could become by 18 | Kiddo",
      description: "Real math: the same monthly dollars going into Robux versus going into a custodial UTMA investment account. Adjust monthly spend and your kid's age to see the difference at 18. Honest 7% projection net of Kiddo's annual fee ($1/yr per $1,000 invested).",
      robots: "index, follow",
      ogType: "website",
    };
  }
  if (pathname === "/tools/utma-by-state") {
    return {
      title: "UTMA Age of Majority by State | Kiddo",
      description: "State-by-state UTMA age of majority lookup. See when a custodial fund transfers to the child in each US state. Most states transfer at 18, some at 21.",
      robots: "index, follow",
      ogType: "website",
    };
  }
  if (pathname.startsWith("/tools/utma-by-state/")) {
    // Per-state document.title is set inside the page component for SEO. The
    // generic meta here covers og-tags and the initial title before the page
    // loads.
    return {
      title: "UTMA Age of Majority by State | Kiddo",
      description: "Find the UTMA age of majority for your US state. When does a custodial fund transfer to the child? Pick a state to see the rule.",
      robots: "index, follow",
      ogType: "website",
    };
  }
  if (pathname === "/login") return { ...genericPrivate, title: "Log In | Kiddo", description: "Access your Kiddo account." };
  if (pathname === "/dashboard") return { ...genericPrivate, title: "Fund Dashboard | Kiddo", description: "Track balances, gifts, and progress for your fund." };
  if (pathname === "/settings") return { ...genericPrivate, title: "Settings | Kiddo", description: "Manage fund, billing, privacy, and account settings." };
  if (pathname === "/activity") return { ...genericPrivate, title: "Activity | Kiddo", description: "Review recent gifts, updates, and account activity." };
  if (pathname.startsWith("/activity/")) return { ...genericPrivate, title: "Activity Detail | Kiddo", description: "Detailed activity record." };
  if (pathname === "/events") return { ...genericPrivate, title: "Events | Kiddo", description: "Create and manage gifting events for your fund." };
  if (pathname === "/event/create") return { ...genericPrivate, title: "Create Event | Kiddo", description: "Set up a new gifting event in Kiddo." };
  if (pathname.startsWith("/claim/")) return { ...genericPrivate, title: "Claim Gift | Kiddo", description: "Claim and verify your gift." };
  if (pathname === "/onboard") return { ...genericPrivate, title: "Onboarding | Kiddo", description: "Finish account setup and fund preferences." };
  if (pathname === "/activate") return { ...genericPrivate, title: "Activate Investing | Kiddo", description: "Complete investing activation for your fund." };
  if (pathname === "/gift/success") return { ...genericPrivate, title: "Gift Complete | Kiddo", description: "Gift checkout confirmation." };
  if (pathname === "/gift") {
    return {
      title: "Find a Fund | Kiddo",
      description: "Enter a child's Kiddo gift code to open their private gift page. No public search. No account required to give.",
      robots: "index, follow",
      ogType: "website",
    };
  }
  if (pathname.startsWith("/memory/")) return { ...genericPrivate, title: "Memory Book | Kiddo", description: "View your fund's shared memories and notes." };
  if (pathname === "/tax-documents") return { ...genericPrivate, title: "Tax Documents | Kiddo", description: "Cost basis, unrealized gains, and the tax forms DriveWealth issues for your funds." };
  if (pathname.startsWith("/fund/") && pathname.endsWith("/snapshot")) return { ...genericPrivate, title: "Fund snapshot | Kiddo", description: "Print-ready summary of your child's investment fund." };
  if (pathname === "/age-18-plan") return { ...genericPrivate, title: "At-18 Plan | Kiddo", description: "The handoff checklist for when your child turns 18." };
  // Default tab title before KidView page-level effect personalizes it to
  // "{Child}'s View | Kiddo" once the API returns the recipient's name.
  if (pathname.startsWith("/kid/")) return { ...genericPrivate, title: "Their view | Kiddo", description: "A personal view of fund progress for the recipient." };
  if (pathname.startsWith("/take-over/")) return { ...genericPrivate, title: "Claim your fund | Kiddo", description: "Claim your fund. Set your own login and take over from your custodian." };
  if (pathname.startsWith("/transition/")) return { ...genericPrivate, title: "Age-18 Transition | Kiddo", description: "Preview, invite, and handoff flow for the age-18 milestone." };
  if (pathname.startsWith("/updates/share/")) return { title: "Shared Update | Kiddo", description: "A shared Memory Book update from a Kiddo family.", robots: "noindex, nofollow", ogType: "article" };
  if (pathname.startsWith("/updates/unsubscribe/")) return { title: "Unsubscribe | Kiddo", description: "Manage gifter update preferences.", robots: "noindex, nofollow", ogType: "website" };
  if (pathname === "/gifter") return { ...genericPrivate, title: "Your Gifts | Kiddo", description: "Saved funds and gifting history for repeat gifters." };
  if (pathname === "/admin") return { ...genericPrivate, title: "Admin | Kiddo", description: "Kiddo internal admin experience." };

  const segments = pathname.split("/").filter(Boolean);
  if (segments.length === 1 || segments.length === 2) {
    return {
      ...genericPrivate,
      title: "Gift a Fund | Kiddo",
      description: "Add to a Kiddo fund with a gift that can grow over time.",
    };
  }

  return {
    title: "Kiddo",
    description: "Turn every birthday and baby shower into real stock investments for your child.",
    robots: "noindex, nofollow, noarchive",
    ogType: "website",
  };
}

function upsertMeta(selector: "name" | "property", key: string, content: string) {
  let tag = document.head.querySelector(`meta[${selector}="${key}"]`) as HTMLMetaElement | null;
  if (!tag) {
    tag = document.createElement("meta");
    tag.setAttribute(selector, key);
    document.head.appendChild(tag);
  }
  tag.setAttribute("content", content);
}

function upsertCanonical(href: string) {
  let tag = document.head.querySelector('link[rel="canonical"]') as HTMLLinkElement | null;
  if (!tag) {
    tag = document.createElement("link");
    tag.setAttribute("rel", "canonical");
    document.head.appendChild(tag);
  }
  tag.setAttribute("href", href);
}

function SeoManager() {
  const [location] = useLocation();

  useEffect(() => {
    const pathname = normalizePath(location);
    const seo = getSeoForPath(pathname);
    const baseUrl = window.location.origin;
    const canonical = `${baseUrl}${pathname}`;
    const existingOgImage =
      (document.head.querySelector('meta[property="og:image"]') as HTMLMetaElement | null)?.content ||
      "/kiddo-og-image.png";
    const imageUrl = existingOgImage.startsWith("http")
      ? existingOgImage
      : `${baseUrl}${existingOgImage.startsWith("/") ? existingOgImage : `/${existingOgImage}`}`;

    document.title = seo.title;
    upsertCanonical(canonical);

    upsertMeta("name", "description", seo.description);
    upsertMeta("name", "robots", seo.robots);

    upsertMeta("property", "og:title", seo.title);
    upsertMeta("property", "og:description", seo.description);
    upsertMeta("property", "og:type", seo.ogType || "website");
    upsertMeta("property", "og:url", canonical);
    upsertMeta("property", "og:site_name", "Kiddo");
    upsertMeta("property", "og:image", imageUrl);

    upsertMeta("name", "twitter:card", "summary_large_image");
    upsertMeta("name", "twitter:title", seo.title);
    upsertMeta("name", "twitter:description", seo.description);
    upsertMeta("name", "twitter:image", imageUrl);
  }, [location]);

  return null;
}

// Reset scroll on route change — but never when the URL carries a deep-link
// target (?gift=, ?gifter=, ?highlight=, #anchor). Those navigations have a
// page-level effect that polls for the target row and smooth-scrolls it into
// view; firing scrollTo(0,0) here would race that and snap the user back to
// the top. The deep-link query params are the contract: their presence means
// "the destination is responsible for positioning, leave the scroll alone."
function ScrollToTop() {
  const [location] = useLocation();
  // Take ownership of scroll positioning away from the browser. Default
  // 'auto' restoration races our scrollTo(0,0) on back/forward and after
  // RouteFader's mode="wait" swap (the new page mounts ~100ms after the
  // location change, by which time our reset already fired against the
  // OUTGOING page). 'manual' lets the resets below be authoritative.
  useLayoutEffect(() => {
    if (typeof window === "undefined") return;
    try {
      if ("scrollRestoration" in window.history) {
        window.history.scrollRestoration = "manual";
      }
    } catch {
      // older browsers — fall through; the resets below still fire.
    }
  }, []);
  useLayoutEffect(() => {
    try {
      if (hasActiveDeepLink()) return;
      if (window.location.hash && window.location.hash !== "#") return;
    } catch {
      // best-effort — if URL parsing fails, fall through to default behavior
    }
    // Three-phase reset to defeat both the AnimatePresence wait-mode delay
    // and any post-mount layout shift on the new page:
    //   1) layout-effect tick → resets while old page is still mounted
    //   2) rAF → resets right after browser paints
    //   3) post-transition timeout → catches the moment the new page
    //      actually swaps in (RouteFader exit is ~100ms)
    const reset = () => {
      window.scrollTo(0, 0);
      // Some Safari versions need both — html and body each track scrollTop
      // independently when the layout viewport disagrees with the visual one.
      if (document.documentElement) document.documentElement.scrollTop = 0;
      if (document.body) document.body.scrollTop = 0;
    };
    reset();
    const raf = requestAnimationFrame(reset);
    const t = window.setTimeout(reset, 140);
    return () => {
      cancelAnimationFrame(raf);
      window.clearTimeout(t);
    };
  }, [location]);
  return null;
}

function MarketingLoadingFallback() {
  return <div className="min-h-screen bg-background" aria-hidden="true" />;
}

function RouteSkeletonFallback() {
  return (
    <div className="min-h-[60vh] px-4 py-8 animate-pulse" aria-hidden="true">
      <div className="mx-auto max-w-2xl space-y-4">
        <div className="h-8 w-48 rounded-lg bg-muted/60" />
        <div className="h-4 w-72 rounded bg-muted/40" />
        <div className="mt-6 h-40 rounded-2xl bg-muted/50" />
        <div className="h-32 rounded-2xl bg-muted/40" />
        <div className="h-32 rounded-2xl bg-muted/30" />
      </div>
    </div>
  );
}

function AppLoadingScreen() {
  const [tipIndex, setTipIndex] = useState(0);

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      setTipIndex((current: number) => (current + 1) % appLoadingMessages.length);
    }, 1800);

    return () => {
      window.clearInterval(intervalId);
    };
  }, []);

  const activeMessage = appLoadingMessages[tipIndex];

  return (
    <div className="min-h-screen bg-background px-6">
      <div className="mx-auto flex min-h-screen w-full max-w-md flex-col items-center justify-center text-center">
        <div className="rounded-[32px] border border-border/60 bg-card/85 px-8 py-10 shadow-premium">
          <Mascot size="lg" context="app-loading" className="mx-auto drop-shadow-sm" />
          <p className="mt-5 text-xs font-semibold uppercase tracking-[0.18em] text-primary/80">
            Opening Kiddo
          </p>
          <p className="mt-3 font-heading text-2xl font-semibold text-foreground">
            The fund is set up. Now share it.
          </p>
          <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
            {activeMessage}
          </p>
        </div>
        <div className="mt-4 flex items-center gap-1.5">
          {appLoadingMessages.map((message, index) => (
            <span
              key={message}
              className={`h-1.5 rounded-full transition-all ${
                index === tipIndex ? "w-5 bg-primary" : "w-1.5 bg-muted-foreground/25"
              }`}
              aria-hidden="true"
            />
          ))}
        </div>
      </div>
    </div>
  );
}

// Eagerly preload the most-visited routes so chunks are warm before user navigates
let _prefetchDone = false;
function prefetchCriticalRoutes() {
  if (_prefetchDone) return;
  _prefetchDone = true;
  const run = typeof requestIdleCallback !== "undefined" ? requestIdleCallback : (fn: () => void) => setTimeout(fn, 120);
  run(() => {
    import("@/pages/Dashboard");
    import("@/pages/Settings");
    import("@/pages/Account");
    import("@/pages/Activity");
    import("@/pages/MemoryBook");
    import("@/pages/MemoryRedirect");
    import("@/pages/EventCreate");
    import("@/pages/ActivateInvesting");
    import("@/pages/Login");
    import("@/pages/GetStarted");
    import("@/pages/GiftCheckout");
    import("@/pages/GiftSuccess");
  });
}

function RouteLoadingFallback() {
  const [location] = useLocation();
  const pathname = normalizePath(location);
  const isPublicExperience =
    isMarketingRoute(pathname) ||
    pathname === "/gift" ||
    pathname === "/get-started" ||
    isPublicGiftRoute(pathname);

  if (isPublicExperience) {
    return <MarketingLoadingFallback />;
  }

  return <RouteSkeletonFallback />;
}

function getRedirectTarget() {
  if (typeof window === "undefined") return "/";
  return `${window.location.pathname}${window.location.search}${window.location.hash}`;
}

function ProtectedRoute({ children }: { children: ReactNode }) {
  const { isAuthenticated, isLoading } = useAuth();
  const [, setLocation] = useLocation();

  useEffect(() => {
    if (isLoading || isAuthenticated) return;
    const redirect = getRedirectTarget();
    setLocation(`/login?redirect=${encodeURIComponent(redirect)}`, { replace: true });
  }, [isAuthenticated, isLoading, setLocation]);

  if (isLoading || !isAuthenticated) {
    return <AppLoadingScreen />;
  }

  return <>{children}</>;
}

function RouteFader({ children }: { children: React.ReactNode }) {
  // Subtle route-level cross-fade. Premium-app register (Linear / Apple
  // Settings) — explicitly NOT the heavy slide-and-bounce mid-tier apps
  // overuse. Trade-offs the implementation makes:
  //
  //   • Asymmetric timing: 100ms fade-out, 180ms fade-in. Faster exit gets
  //     the old page out of the way; slower entry makes the new page feel
  //     deliberate. Total perceived transition ~280ms — under the 300ms
  //     threshold where users start feeling lag.
  //
  //   • mode="wait" so the outgoing fade completes before the incoming
  //     mounts. Prevents (a) two pages running their data queries at once,
  //     (b) two ScrollToTop fires racing, and (c) the visual flash of two
  //     stacked pages mid-fade.
  //
  //   • initial={false} so the first render (cold load, hot reload, deep
  //     link) appears without a fade-in — only ROUTE CHANGES animate, not
  //     the initial paint.
  //
  //   • Key = pathname only (location from useLocation), so query-string
  //     and hash changes don't trigger a re-fade. Critical: prevents fade
  //     when ?gift=X / ?highlight=Y are stripped after consumption, when
  //     ?fund=X switches active fund, or when ?tab=foo flips activity tab.
  //
  //   • useReducedMotion is reactive — if the user changes their OS
  //     preference mid-session, this re-runs and skips the animation
  //     immediately. (Manual matchMedia check would NOT update.)
  //
  //   • 100dvh fallback to 100vh — dvh is the dynamic viewport height
  //     (correct on mobile Safari with the URL bar), vh is the fallback
  //     for browsers that don't support dvh. Prevents the 1-2px scroll
  //     introduced by 100vh on iOS.
  //
  //   • Ease curve [0.16, 1, 0.3, 1] is the standard "ease-out-quart"
  //     curve Apple uses for system transitions — fast start, gentle
  //     settle. Matches the brand's "restraint ages" register.
  const [location] = useLocation();
  const prefersReducedMotion = useReducedMotion();
  // Skip the cross-fade when the navigation is a bottom-nav TAB SWITCH
  // (one of Home / Memory / Activity / Account → another). Native iOS
  // tab bars don't animate between tabs — they snap instantly. That's
  // the "feels fast" pattern users on phones expect from a tab-bar
  // app. The cross-fade stays in place for deeper navigation
  // (link → sub-page) where there's a sense of "moving into" something.
  // We track the previous path via ref so each render can compare.
  // Capturing prev via ref + the *current* location keeps this stable
  // across renders without StrictMode double-fires.
  const prevLocationRef = useRef(location);
  const TAB_PATHS = ["/dashboard", "/activity", "/memory", "/settings"];
  const isTabPath = (p: string) => TAB_PATHS.some((t) => p.startsWith(t));
  const skipAnimation =
    prevLocationRef.current !== location &&
    isTabPath(prevLocationRef.current) &&
    isTabPath(location);
  useEffect(() => {
    prevLocationRef.current = location;
  }, [location]);
  if (prefersReducedMotion || skipAnimation) return <>{children}</>;
  return (
    <AnimatePresence mode="wait" initial={false}>
      <motion.div
        key={location}
        initial={{ opacity: 0 }}
        // Per-state transitions: framer reads the `transition` field
        // attached to each variant. Asymmetric — fast exit, slower entry.
        // Values reference the shared MOTION map so a future tuning pass
        // moves every surface together, not just this one.
        animate={{ opacity: 1, transition: MOTION.enter }}
        exit={{ opacity: 0, transition: MOTION.exit }}
        style={{ minHeight: "100dvh" }}
      >
        {children}
      </motion.div>
    </AnimatePresence>
  );
}

function Router() {
  return (
    <>
      <ScrollToTop />
      <DemoBanner />
      <Suspense fallback={<RouteLoadingFallback />}>
        <RouteFader>
        <Switch>
          <Route path="/"><Home /></Route>
          <Route path="/login"><Login /></Route>
          <Route path="/reset-password"><ResetPassword /></Route>
          <Route path="/verify-email"><VerifyEmail /></Route>
          <Route path="/confirm-email-change"><ConfirmEmailChange /></Route>
          <Route path="/cancel-email-change"><CancelEmailChange /></Route>
          <Route path="/demo"><Demo /></Route>
          <Route path="/get-started"><GetStarted /></Route>
          <Route path="/onboard"><Onboard /></Route>
          <Route path="/activate"><ProtectedRoute><ActivateInvesting /></ProtectedRoute></Route>
          <Route path="/dashboard"><ProtectedRoute><Dashboard /></ProtectedRoute></Route>
          <Route path="/profile"><ProtectedRoute><Account /></ProtectedRoute></Route>
          <Route path="/activity"><ProtectedRoute><Activity /></ProtectedRoute></Route>
          <Route path="/activity/:id"><ProtectedRoute><ActivityDetail /></ProtectedRoute></Route>
          <Route path="/events">{() => { window.location.replace("/dashboard"); return null; }}</Route>
          <Route path="/event/create"><ProtectedRoute><EventCreate /></ProtectedRoute></Route>
          <Route path="/claim/:token"><Claim /></Route>
          <Route path="/take-over/:token"><ClaimFund /></Route>
          <Route path="/invitations/:token"><InvitationAccept /></Route>
          <Route path="/gift"><GiftLookup /></Route>
          <Route path="/settings"><ProtectedRoute><Settings /></ProtectedRoute></Route>
          <Route path="/funds"><ProtectedRoute><FundsOverview /></ProtectedRoute></Route>
          <Route path="/account"><ProtectedRoute><Account /></ProtectedRoute></Route>
          <Route path="/faq"><FAQ /></Route>
          <Route path="/how-it-works"><HowItWorks /></Route>
          <Route path="/tools/at-18-calculator"><CalculatorAt18 /></Route>
          <Route path="/tools/robux-vs-utma"><RobuxVsUtma /></Route>
          {/* /robux-vs-utma alias — satellite SEO destinations sometimes
              get linked without the /tools/ prefix. Both paths resolve
              to the same calculator. */}
          <Route path="/robux-vs-utma"><RobuxVsUtma /></Route>
          <Route path="/tools/utma-by-state"><UtmaByStateIndex /></Route>
          <Route path="/tools/utma-by-state/:stateCode"><UtmaByState /></Route>
          <Route path="/pricing"><Pricing /></Route>
          <Route path="/founding-members"><FoundingMembers /></Route>
          <Route path="/sponsor-success"><SponsorSuccess /></Route>
          <Route path="/blog"><Blog /></Route>
          <Route path="/blog/:slug"><BlogPost /></Route>
          <Route path="/stories"><Stories /></Route>
          <Route path="/stories/:slug"><StoryPage /></Route>
          <Route path="/compare"><Compare /></Route>
          <Route path="/compare/:slug"><Compare /></Route>
          <Route path="/security"><Security /></Route>
          <Route path="/age-18"><Age18 /></Route>
          <Route path="/about"><About /></Route>
          <Route path="/personal-funds"><PersonalFunds /></Route>
          <Route path="/contact"><Contact /></Route>
          <Route path="/legal"><Legal /></Route>
          <Route path="/admin"><ProtectedRoute><Admin /></ProtectedRoute></Route>
          <Route path="/age-18-plan"><ProtectedRoute><Age18Plan /></ProtectedRoute></Route>
          <Route path="/tax-documents"><ProtectedRoute><TaxDocuments /></ProtectedRoute></Route>
          <Route path="/tax-documents/explainer"><ProtectedRoute><TaxDocsExplainer /></ProtectedRoute></Route>
          <Route path="/projection/:fundId"><ProtectedRoute><Projection /></ProtectedRoute></Route>
          <Route path="/fund/:fundId/snapshot"><ProtectedRoute><FundSnapshot /></ProtectedRoute></Route>
          <Route path="/memory"><ProtectedRoute><MemoryRedirect /></ProtectedRoute></Route>
          <Route path="/memory/:fundId"><ProtectedRoute><MemoryBook /></ProtectedRoute></Route>
          <Route path="/gift/success"><GiftSuccess /></Route>
          <Route path="/gifter"><GifterDashboard /></Route>
          <Route path="/kid/:fundId"><KidView /></Route>
          <Route path="/transition/fund/:fundId"><ProtectedRoute><AgeTransitionManager /></ProtectedRoute></Route>
          <Route path="/transition/verify/:token"><AgeTransitionVerify /></Route>
          <Route path="/transition/:token"><AgeTransitionInvite /></Route>
          <Route path="/welcome-at-18"><ProtectedRoute><Age18Welcome /></ProtectedRoute></Route>
          <Route path="/give-a-gift"><GiveAGift /></Route>
          <Route path="/your-story/:fundId"><ProtectedRoute><YourStory /></ProtectedRoute></Route>
          <Route path="/updates/share/:token"><GifterShare /></Route>
          <Route path="/updates/unsubscribe/:token"><GifterUnsubscribe /></Route>
          <Route path="/:fund"><GiftCheckout /></Route>
          <Route path="/:fund/:event"><GiftCheckout /></Route>
          <Route><NotFound /></Route>
        </Switch>
        </RouteFader>
      </Suspense>
    </>
  );
}


function App() {
  const [location] = useLocation();
  const search = useSearch();

  useEffect(() => {
    prefetchCriticalRoutes();
  }, []);
  const isPreview = new URLSearchParams(search).has("preview");
  const isGiftPage = isPublicGiftRoute(location);
  const isMarketingPage = isMarketingRoute(location);

  // Public gift page (/:fund or /:fund/:event) — fire the
  // /api/public/funds/:slug or /api/public/events/:slug prefetch the moment
  // we know we're on a gift route. Runs in PARALLEL with the lazy chunk
  // load for GiftCheckout, so by the time the component mounts and calls
  // its useQuery for the same key, the data is in flight or already cached.
  // Highest-leverage prefetch in the app — public gift pages are the
  // conversion-funnel and a cold visit from email/SMS otherwise gates first
  // paint on this one network round-trip.
  useEffect(() => {
    if (!isGiftPage) return;
    const segments = location.split("/").filter(Boolean);
    const fundSlug = segments[0];
    const eventSlug = segments[1];
    if (!fundSlug) return;
    void import("@/lib/prefetch").then(({ prefetchPublicGiftPage }) => {
      prefetchPublicGiftPage(queryClient, fundSlug, eventSlug ?? null);
    });
  }, [isGiftPage, location]);
  const hideGlobalNav =
    location === "/admin" ||
    location === "/gifter" ||
    location === "/gift/success" ||
    // /get-started is a focused onboarding journey with its own
    // Shell chrome (back button, progress dots, logo). Rendering
    // the DesktopSidebar alongside it produced two competing brand
    // wordmarks on the same screen ("Kiddo Kiddo" flagged
    // 2026-05-15) AND left the Shell content visually behind the
    // 264px-wide fixed sidebar (the page lacks the md:ml-[264px]
    // offset every other authenticated page uses). Hiding global
    // nav during onboarding fixes both. Returning users adding a
    // 2nd fund still have the Shell's own back button + browser
    // back as escapes; the sidebar's nav links aren't urgent during
    // the 2-5 minute flow.
    location === "/get-started" ||
    location.startsWith("/kid/") ||
    location.startsWith("/updates/share/") ||
    location.startsWith("/updates/unsubscribe/") ||
    (location.startsWith("/transition/") && !location.startsWith("/transition/fund/")) ||
    isMarketingPage ||
    isPreview ||
    isGiftPage;

  return (
    <QueryClientProvider client={queryClient}>
      <KoraProvider>
        {/* RealtimeProvider sits inside KoraProvider (which gives us
            useAuth) so it can gate its EventSource on the signed-in
            user. One SSE connection per tab, fanned out to whichever
            surfaces subscribe via useRealtimeEvents. Public pages
            still render fine because the provider closes its stream
            when there's no authenticated user. */}
        <RealtimeProvider>
          <TooltipProvider>
            <div className={`mobile-app-shell ${!hideGlobalNav ? "mobile-app-shell--with-nav" : ""}`}>
              <SeoManager />
              <Toaster />
              {!hideGlobalNav && <DesktopSidebar />}
              <Router />
              {!hideGlobalNav && <MobileNav />}
              {/* Global share modal — listens for `kiddo:open-share-modal`
                  events from any surface (e.g., the sidebar's Share quick
                  link). Mounted at the App level so it opens inline on the
                  current page instead of forcing a navigation to Dashboard
                  first. Self-fetches the active fund's data on open. */}
              {!hideGlobalNav && <GlobalShareModal />}
            </div>
          </TooltipProvider>
        </RealtimeProvider>
      </KoraProvider>
    </QueryClientProvider>
  );
}

export default App;
