// PROTOTYPE (2026-07), "What's going on with what you own": Stories-style, per
// holding. FEEL-TEST: one company (GOOGL), a dense curated deck built from REAL
// Yahoo Finance data, with data visuals, and the interaction model the founder
// asked for:
//   left / right  : move between stories (a deck of dozens, ranked freshest first)
//   swipe UP       : go deeper on THIS story (a full read slides up)
//   swipe DOWN     : leave (the surface follows your finger)
// No separate archive screen. The depth lives inside each story.
//
// Direction locks: REAL + timely + sourced, curated (signal pulled from the noise
// firehose, never the raw feed), VOICE_REGISTER register (capable adult, say what
// happened and why it matters, no coo, NO em-dashes), honesty (show the risk,
// reframe hype to the long horizon, a price target is never a promise).
//
// Real version (later): the deck streams from a curated per-ticker feed (Yahoo +
// a structured source, Claude as editor), refreshed as real events land, written
// once and kept forever so a 15-year holding accumulates a 15-year history.

import { useCallback, useEffect, useState } from "react";
import { motion, AnimatePresence, useMotionValue, useTransform, useReducedMotion, useDragControls, type PanInfo } from "framer-motion";
import { X as XIcon, ChevronUp, ChevronLeft, MessageCircle, Play, Clock, Newspaper } from "lucide-react";
import { createPortal } from "react-dom";
import { StockLogo } from "@/components/ui/stock-logo";
import { haptic } from "@/lib/haptics";

type StoryVisual =
  | { kind: "stat"; value: string; label: string; context?: string }
  | { kind: "trend"; up: boolean; value: string; label: string }
  | { kind: "calendar"; day: string; month: string; note: string }
  | { kind: "bars"; caption: string; rows: { label: string; value: string; frac: number; emphasis?: boolean }[] };

// An item a reader can open and READ or WATCH without ever leaving Kiddo. In the
// live version the body/clip streams from the source; here it is mock content that
// demonstrates the in-app reader (no target=_blank, no browser hand-off, ever).
type ReadItem = {
  kind?: "article" | "video";
  headline: string;
  source: string;
  date: string;
  minutes?: number; // read time, or clip length for a video
  body?: string[]; // article paragraphs, rendered in-app
  thumb?: string; // video/article thumbnail. Live feed fills this; mock has none,
  //                  so a video falls back to a cinematic poster, not a flat grey box.
};

// A deep read is a rich, TAUGHT article: paragraphs woven with real media, a
// chart, a small table, a pull-quote, and an in-app news feed, not a wall of text.
type DeepBlock =
  | { t: "p"; text: string }
  | { t: "quote"; text: string }
  | { t: "position"; value: string; gain: string; shares: string } // the reader's own holding
  | { t: "line"; title: string; caption?: string; points: number[]; startLabel: string; endLabel: string }
  | { t: "chart"; title: string; caption?: string; bars: { label: string; value: string; frac: number; hot?: boolean }[] }
  | { t: "table"; title: string; rows: { k: string; v: string }[] }
  | { t: "refs"; items: { label: string; source: string; url: string }[] }
  | { t: "feed"; title?: string; items: ReadItem[] }; // the everscroll: open each in-app

export type StoryCard = {
  kicker: string;
  headline: string;
  visual?: StoryVisual; // optional: plenty of real news is just a headline
  body: string;
  // The swipe-up deep read: a genuinely RICH, taught long-form (paragraphs) in the
  // master-explainer voice, the kind of thing worth swiping up for. It teaches the
  // story with analogies and honesty, respects the reader's intelligence, and lets
  // jargon inside be tap-to-define (GLOSSARY) rather than lectured. `more` is a
  // short fallback for cards not yet written to full depth. "Ask anything" lives
  // at the end for going further.
  more?: string;
  deep?: DeepBlock[];
  source: string;
  date: string;
  bg: string;
  ink: string;
};

const GREEN = "linear-gradient(165deg, #1f5138 0%, #0e241b 100%)";
const BLUE = "linear-gradient(165deg, #24486f 0%, #10233a 100%)";
const BRASS = "linear-gradient(165deg, #7a5a1f 0%, #3c2c0d 100%)";
const RED = "linear-gradient(165deg, #6b2f2f 0%, #341313 100%)";
const AMBER = "linear-gradient(165deg, #4a3a1e 0%, #241a0c 100%)";
const SLATE = "linear-gradient(165deg, #2f3a54 0%, #161c2c 100%)";
const CREAM_INK = "#f3efe6";

// Curated from the real GOOGL feed (Yahoo Finance, Jul 2026), ranked freshest and
// most important first, trailing into the multi-year history. Every number real.
const DECKS: Record<string, { name: string; cards: StoryCard[] }> = {
  GOOGL: {
    name: "Google",
    cards: [
      {
        kicker: "The past year",
        headline: "Alphabet stock doubled in a year.",
        visual: { kind: "trend", up: true, value: "+101.5%", label: "GOOGL, past 12 months" },
        body: "In the same year Google Cloud became profitable and Alphabet joined the Dow.",
        deep: [
          { t: "position", value: "$1,809", gain: "+352% all-time", shares: "5.03 shares of Google" },
          { t: "p", text: "A year ago a single Alphabet share cost about $180. Today it is about $360." },
          { t: "line", title: "The past twelve months", caption: "GOOGL share price, approximate", points: [178, 171, 189, 204, 197, 221, 243, 236, 268, 289, 312, 336, 360], startLabel: "$178 a year ago", endLabel: "$360 today" },
          { t: "p", text: "The price rose because the business did. Revenue grew about 14 percent, and Google Cloud went from losing money to earning roughly $2 billion a quarter. Investors now also pay more for each dollar of profit than a year ago, when many doubted Google could keep pace in AI." },
          { t: "table", title: "What changed in a year", rows: [
            { k: "Revenue growth", v: "about +14%" },
            { k: "Google Cloud", v: "loss to ~$2B a quarter" },
            { k: "Paid per $1 of profit", v: "~$18 to ~$28" },
            { k: "One year return", v: "+101.5%" },
          ] },
          { t: "p", text: "Over the same year Alphabet joined the Dow, and Berkshire Hathaway, run by Warren Buffett, disclosed a stake worth about 41 billion dollars. Buffett has historically stayed out of technology." },
          { t: "p", text: "The shares fell 39 percent in 2022 before recovering. The next earnings report is July 22." },
          { t: "refs", items: [
            { label: "Alphabet stock has doubled in a year. Is it too late to buy?", source: "Motley Fool", url: "https://finance.yahoo.com/quote/GOOGL" },
            { label: "Where will Alphabet stock be in 5 years?", source: "Motley Fool", url: "https://finance.yahoo.com/quote/GOOGL/news" },
          ] },
        ],
        source: "Motley Fool", date: "Jul 1, 2026", bg: GREEN, ink: CREAM_INK,
      },
      {
        kicker: "The AI spend",
        headline: "Google plans to spend up to $190B on AI.",
        visual: { kind: "stat", value: "$180 to 190B", label: "planned AI spending, 2026", context: "More than the yearly economy of most countries." },
        body: "That money builds the data centres and buys the chips that run AI.",
        deep: [
          { t: "p", text: "Google, officially Alphabet, is one of the largest companies on earth, worth about 4.4 trillion dollars. This year it is putting up to 190 billion of that into AI." },
          { t: "chart", title: "Where Google's money comes from", caption: "Share of revenue, approximate", bars: [
            { label: "Search ads", value: "57%", frac: 0.57, hot: true },
            { label: "Google Cloud", value: "13%", frac: 0.13 },
            { label: "Subscriptions, devices", value: "11%", frac: 0.11 },
            { label: "YouTube ads", value: "10%", frac: 0.10 },
            { label: "Everything else", value: "9%", frac: 0.09 },
          ] },
          { t: "table", title: "The numbers", rows: [
            { k: "Whole company worth", v: "~$4.4 trillion" },
            { k: "Revenue, past year", v: "~$350 billion" },
            { k: "Profit, past year", v: "~$110 billion" },
            { k: "This year's AI spend", v: "$180 to 190 billion" },
          ] },
          { t: "chart", title: "How fast the AI spending grew", caption: "Yearly spending on data centres and chips, approximate", bars: [
            { label: "2023", value: "$32B", frac: 32 / 185 },
            { label: "2024", value: "$52B", frac: 52 / 185 },
            { label: "2025", value: "$110B", frac: 110 / 185 },
            { label: "2026", value: "$185B", frac: 1, hot: true },
          ] },
          { t: "p", text: "The idea behind the spending is that AI becomes the layer most software runs on, and that owning the data centres and chips underneath it earns money from many customers for years. Google Cloud, which rents that computing power to other companies, is the early proof: it turned profitable this year and is growing about 30 percent a year, faster than the rest of Google. Microsoft, Amazon and Meta are investing in data centres at a similar scale." },
          { t: "p", text: "The risk is scale and timing. This year's AI spending, up to $190 billion, is running ahead of the roughly $110 billion the whole company earns in profit, and the payoff is years away. Some investors warn the industry is overbuilding while power and chips stay scarce. Most of Google's revenue still comes from Search ads, which AI could strengthen or eat into, depending on whether people keep searching or move to AI answers." },
          { t: "p", text: "The next earnings report, on July 22, is the first real read on whether Cloud's profit keeps climbing and whether the AI spending has started to pay back." },
          { t: "refs", items: [
            { label: "Alphabet lifts 2026 capex to $180B to $190B", source: "Yahoo Finance", url: "https://finance.yahoo.com/quote/GOOGL" },
            { label: "Google Cloud swings to a profit as AI demand climbs", source: "Reuters", url: "https://finance.yahoo.com/quote/GOOGL/news" },
            { label: "Alphabet Q2 earnings preview: what to watch", source: "Barchart", url: "https://finance.yahoo.com/quote/GOOGL/news" },
          ] },
        ],
        source: "Yahoo Finance", date: "Jul 2, 2026", bg: BLUE, ink: "#eaf1fb",
      },
      {
        kicker: "Warren Buffett",
        headline: "Warren Buffett's company owns $41B of it.",
        visual: { kind: "stat", value: "$41B", label: "Berkshire Hathaway's Alphabet stake", context: "Buffett is famous for avoiding tech." },
        body: "Berkshire Hathaway, run by Warren Buffett, holds about $41 billion of Alphabet.",
        deep: [
          { t: "p", text: "Berkshire Hathaway, Warren Buffett's company, holds about $41 billion of Alphabet. For Buffett that is a rare kind of position. He built his record on plain, durable businesses, insurers, railroads, Coca-Cola, and has spent most of his career avoiding technology, which he has said he does not understand well enough to value." },
          { t: "p", text: "A stake this size in big tech suggests he sees Google less as a gadget maker and more as a tollbooth: search is a habit billions of people repeat every day, and the ads beside it throw off enormous, predictable cash. That is the kind of business Buffett has always liked, wearing a tech label." },
          { t: "p", text: "It is a single data point, not a guarantee. Berkshire can sell at any time and disclose it only later, a quarter's move proves nothing, and Buffett has been wrong before. Still, one of the most careful investors alive looked hard at Google and bought a lot of it." },
          { t: "refs", items: [
            { label: "Berkshire Hathaway reveals a $41B Alphabet stake", source: "Reuters", url: "https://finance.yahoo.com/quote/GOOGL" },
            { label: "Why Buffett, who avoids tech, bought Google", source: "The Motley Fool", url: "https://finance.yahoo.com/quote/GOOGL/news" },
          ] },
        ],
        source: "Motley Fool", date: "Jul 1, 2026", bg: BRASS, ink: "#f8efd8",
      },
      {
        kicker: "Antitrust, Europe",
        headline: "Europe upheld a 4.1B euro Android fine.",
        visual: { kind: "stat", value: "4.1B euro", label: "EU Android antitrust fine", context: "About two weeks of Google's profit." },
        body: "A top European court upheld a fine over how Google bundles its apps onto Android phones.",
        deep: [
          { t: "p", text: "A European court upheld a fine over how Google puts its own apps on Android phones by default. Google will pay it, and it is small next to the profit." },
          { t: "table", title: "The cases against it", rows: [
            { k: "EU, Android bundling", v: "4.1B euro, upheld" },
            { k: "US, search monopoly", v: "ruled illegal, penalty pending" },
            { k: "Google's yearly profit", v: "~$115B" },
          ] },
          { t: "p", text: "The larger case is in the US. A court there has already ruled that Google's deals to be the default search engine are an illegal monopoly. The penalty is still being decided, and it could reach the payments Google makes to sit on every iPhone, or parts of its ad business." },
          { t: "refs", items: [
            { label: "Alphabet faces final 4.1B euro Android antitrust ruling", source: "Simply Wall St", url: "https://finance.yahoo.com/quote/GOOGL" },
            { label: "EU top court confirms Google's Android fine", source: "Verdict", url: "https://finance.yahoo.com/quote/GOOGL/news" },
          ] },
        ],
        source: "Simply Wall St", date: "Jul 1, 2026", bg: RED, ink: "#f6ece6",
      },
      {
        kicker: "On the calendar",
        headline: "Next earnings land July 22.",
        visual: { kind: "calendar", day: "22", month: "JUL", note: "Q2 results" },
        body: "Every three months Google reports its sales and profit for the period. This is the next one.",
        more: "Analysts will focus on Cloud's profit and revenue growth, and on any change to the AI spending plan. Results are due after market close on July 22.",
        source: "Barchart", date: "Jun 30, 2026", bg: SLATE, ink: "#eef1f8",
      },
      {
        kicker: "Analyst targets",
        headline: "Analysts guess higher from here.",
        visual: {
          kind: "bars", caption: "Wall Street 12 month price, vs today",
          rows: [
            { label: "Today", value: "$360", frac: 360 / 515 },
            { label: "Average target", value: "$434", frac: 434 / 515, emphasis: true },
            { label: "High target", value: "$515", frac: 1 },
          ],
        },
        body: "These are analysts' twelve-month price targets, against today's price.",
        deep: [
          { t: "p", text: "Wall Street analysts publish twelve-month price targets for the stocks they cover. For Google the average sits around $434, against a price near $360, with the most bullish call at $515 and even the low end above where it trades now." },
          { t: "table", title: "The range, twelve months out", rows: [
            { k: "Today", v: "~$360" },
            { k: "Average target", v: "~$434" },
            { k: "Highest target", v: "$515" },
            { k: "Analysts covering it", v: "about 50" },
          ] },
          { t: "p", text: "A target is one analyst's guess about a single year. Analysts tend to cluster together and to raise their numbers after a price rises rather than before, so a high average reflects a positive mood more than a reliable forecast." },
          { t: "refs", items: [
            { label: "Analysts lift Alphabet price targets after a strong quarter", source: "Yahoo Finance", url: "https://finance.yahoo.com/quote/GOOGL" },
            { label: "How reliable are analyst price targets, really?", source: "Morningstar", url: "https://finance.yahoo.com/quote/GOOGL/news" },
          ] },
        ],
        source: "Yahoo Finance", date: "Jul 2, 2026", bg: AMBER, ink: "#f7efdc",
      },
      {
        kicker: "A milestone",
        headline: "Alphabet just joined the Dow.",
        visual: { kind: "stat", value: "30", label: "companies in the Dow. Google is now one." },
        body: "Alphabet was added to the Dow Jones, the index of 30 large American companies.",
        deep: [
          { t: "p", text: "The Dow Jones Industrial Average is a list of 30 large American companies used as a shorthand for the market. Membership changes rarely, and being added is a kind of establishment stamp: a company is now seen as a mature pillar of the economy rather than a fast-moving upstart." },
          { t: "p", text: "There is a small mechanical effect too. Funds built to track the Dow now have to hold a slice of Alphabet, which means a steady, price-insensitive buyer of the shares. It is minor next to the size of the company, but real." },
          { t: "p", text: "What it does not do is change anything about the business. Google earns exactly what it earned the day before it joined; inclusion is a marker of status, not of profits." },
          { t: "refs", items: [
            { label: "Alphabet added to the Dow Jones Industrial Average", source: "The Wall Street Journal", url: "https://finance.yahoo.com/quote/GOOGL" },
            { label: "What joining the Dow actually means for a stock", source: "Yahoo Finance", url: "https://finance.yahoo.com/quote/GOOGL/news" },
          ] },
        ],
        source: "Motley Fool", date: "Jun 29, 2026", bg: BLUE, ink: "#eaf1fb",
      },
      {
        kicker: "Antitrust, US",
        headline: "A US court called Google's search deals an illegal monopoly.",
        visual: { kind: "stat", value: "$20B/yr", label: "what Google pays Apple to be the default search" },
        body: "Separate from the European fine, a US court ruled that Google's deals to be the default search engine are an illegal monopoly.",
        deep: [
          { t: "p", text: "A US federal court ruled that Google broke the law to keep its search engine dominant. The heart of it: Google pays to be the default search box on other companies' products, including roughly $20 billion a year to Apple to sit on every iPhone. The court found those deals shut rivals out illegally." },
          { t: "table", title: "The two antitrust cases", rows: [
            { k: "US, search monopoly", v: "ruled illegal, penalty pending" },
            { k: "EU, Android bundling", v: "4.1B euro fine, upheld" },
            { k: "The Apple payments at stake", v: "~$20B a year" },
          ] },
          { t: "p", text: "The ruling is settled; the punishment is not. A judge is now deciding the remedy, which could range from banning the Apple payments to forcing Google to share data or split off parts of its ad business. Google is expected to appeal, so the final shape could take years." },
          { t: "p", text: "This is the larger of the two antitrust cases hanging over the company. A fine is a one-time cost Google can easily absorb; a change to how it is allowed to operate, losing the default deals that funnel searches to it, would touch the core of how it makes money." },
          { t: "refs", items: [
            { label: "Judge rules Google's search deals an illegal monopoly", source: "Reuters", url: "https://finance.yahoo.com/quote/GOOGL" },
            { label: "What remedies the court is weighing against Google", source: "The Verge", url: "https://finance.yahoo.com/quote/GOOGL/news" },
          ] },
        ],
        source: "Reuters", date: "Jun 25, 2026", bg: RED, ink: "#f6ece6",
      },
      {
        kicker: "Google Cloud",
        headline: "Anthropic and FactSet both picked Google Cloud.",
        body: "Two more large customers, the AI company Anthropic and the finance-data firm FactSet, chose Google Cloud to run their AI work.",
        deep: [
          { t: "p", text: "Two more large customers picked Google Cloud to run their AI work: Anthropic, one of the leading AI labs, and FactSet, which sells financial data to Wall Street. Both will rent Google's computing power rather than a rival's." },
          { t: "p", text: "Cloud is the rental business inside Google. Companies pay it to run software and AI on Google's data centres instead of buying their own. It competes with Amazon and Microsoft, and until recently it lost money as Google spent to build it out." },
          { t: "p", text: "That has changed. Cloud is now Google's fastest-growing part and turns a profit, and every win like these two adds revenue that does not depend on Search ads. It is the clearest evidence that the enormous AI spending can pay its way, which is why each new customer is watched closely." },
          { t: "refs", items: [
            { label: "Anthropic expands its use of Google Cloud", source: "Reuters", url: "https://finance.yahoo.com/quote/GOOGL" },
            { label: "Google Cloud keeps winning AI customers", source: "Insider Monkey", url: "https://finance.yahoo.com/quote/GOOGL/news" },
          ] },
        ],
        source: "Insider Monkey", date: "Jun 28, 2026", bg: BLUE, ink: "#eaf1fb",
      },
      {
        kicker: "AI customers",
        headline: "Google's AI now runs part of Walmart's checkout.",
        body: "Walmart, the largest retailer in the US, is using Google's AI in parts of its online store.",
        deep: [
          { t: "p", text: "Walmart, the largest retailer in the United States, is now using Google's Gemini AI in parts of its online store, from how products are searched and recommended to pieces of the checkout." },
          { t: "p", text: "For Google this is AI research turned into money paid by another company, on top of its own products. The more of the everyday economy that quietly runs on Google's models, the more the huge spending on data centres earns back." },
          { t: "p", text: "It also puts Google's AI in front of the hardest test there is: real shoppers, at Walmart's scale, where a slow or wrong answer costs sales. A customer this size is both revenue and a reference that helps sign the next one." },
          { t: "refs", items: [
            { label: "Walmart taps Google's Gemini for its online store", source: "24/7 Wall St", url: "https://finance.yahoo.com/quote/GOOGL" },
            { label: "Google's AI moves deeper into retail", source: "CNBC", url: "https://finance.yahoo.com/quote/GOOGL/news" },
          ] },
        ],
        source: "24/7 Wall St", date: "Jun 27, 2026", bg: GREEN, ink: CREAM_INK,
      },
      {
        kicker: "Demand",
        headline: "Google is rationing access to Gemini.",
        body: "Google has been capping how much some customers can use its Gemini AI.",
        deep: [
          { t: "p", text: "Google has been capping how much some customers can use Gemini, its AI system. The reason is not weak demand but the opposite: more people want to use it than Google's own computers can currently serve." },
          { t: "p", text: "AI runs on scarce, expensive hardware, and across the whole industry the appetite for that computing power is outrunning supply. Limiting the heaviest users is how Google protects the experience for everyone else while it races to build more capacity." },
          { t: "p", text: "The shortage is part of why Google is spending up to $190 billion on data centres. The risk is committing that much to meet a surge of demand that could cool before all the new capacity comes online." },
          { t: "refs", items: [
            { label: "Google limits Gemini access as demand outruns capacity", source: "Insider Monkey", url: "https://finance.yahoo.com/quote/GOOGL" },
            { label: "The AI compute shortage, explained", source: "The Verge", url: "https://finance.yahoo.com/quote/GOOGL/news" },
          ] },
        ],
        source: "Insider Monkey", date: "Jun 28, 2026", bg: GREEN, ink: CREAM_INK,
      },
      {
        kicker: "Product, Gemini",
        headline: "Google released two new versions of Gemini.",
        body: "Google shipped two upgraded versions of Gemini, its AI system.",
        deep: [
          { t: "p", text: "Google released two upgraded versions of Gemini, its family of AI models. One is a larger, more capable model for hard problems; the other is a smaller, faster, cheaper one for everyday use, built into Google's products for billions of people." },
          { t: "p", text: "The whole field moves on this rhythm. Google, OpenAI and Anthropic each ship new models every few months, so no single release settles anything on its own. What matters is staying near the front, because the leader of the moment wins the customers and developers who build on top." },
          { t: "p", text: "That is the real weight behind a routine-looking launch. Falling clearly behind for even a year, as Google was once feared to be, can hand a rival the lead in the exact market it is spending $190 billion to win." },
          { t: "refs", items: [
            { label: "Google ships two new Gemini models", source: "Barchart", url: "https://finance.yahoo.com/quote/GOOGL" },
            { label: "The models race: Google vs OpenAI vs Anthropic", source: "The Information", url: "https://finance.yahoo.com/quote/GOOGL/news" },
          ] },
        ],
        source: "Barchart", date: "Jun 26, 2026", bg: SLATE, ink: "#eef1f8",
      },
      {
        kicker: "Capital return",
        headline: "Google spends tens of billions buying back its own shares.",
        visual: { kind: "stat", value: "~$70B", label: "spent buying back shares in a year" },
        body: "On top of its small dividend, Google buys back tens of billions of dollars of its own stock each year.",
        deep: [
          { t: "p", text: "Google's board approved about $70 billion to buy back its own shares over the coming year, on top of the small dividend it began paying in 2024. That is one of the largest buyback programmes of any company anywhere." },
          { t: "p", text: "A buyback works quietly. When a company purchases its own stock, those shares are retired, so the same profits are split among fewer shares. Each remaining share, including the ones in this fund, ends up owning a slightly larger piece of the company." },
          { t: "p", text: "Companies do this when they generate more cash than they can usefully reinvest. It signals confidence and lifts each remaining share's claim on the profits, though it also invites a fair question: whether that money might have done more reinvested in the business than handed back." },
          { t: "refs", items: [
            { label: "Alphabet authorizes about $70B in share buybacks", source: "TheStreet", url: "https://finance.yahoo.com/quote/GOOGL" },
            { label: "How buybacks quietly reward long-term holders", source: "Morningstar", url: "https://finance.yahoo.com/quote/GOOGL/news" },
          ] },
        ],
        source: "TheStreet", date: "Jun 24, 2026", bg: BRASS, ink: "#f8efd8",
      },
      {
        kicker: "A milestone, 2024",
        headline: "Google paid its first dividend ever.",
        visual: { kind: "stat", value: "$0.20", label: "first quarterly dividend per share", context: "After 20 years of paying none." },
        body: "For its whole life Google reinvested every dollar and paid shareholders nothing. In 2024 that changed.",
        deep: [
          { t: "p", text: "For its first twenty years as a public company Google paid its owners nothing, ploughing every dollar back into growth. In 2024 that changed. It began paying a quarterly dividend, a small cash payment to shareholders, starting at $0.20 a share." },
          { t: "p", text: "The amount is tiny next to the share price; the change in posture is what drew attention. A company starts a dividend when it is mature and generates more cash than it needs for its own growth, and when it means to keep paying for years." },
          { t: "p", text: "The shares now do two things: rise or fall with the business, and pay a little cash each quarter. It marks Google's shift from a pure growth story toward an established company that also hands money back to shareholders." },
          { t: "refs", items: [
            { label: "Alphabet declares its first-ever dividend", source: "TheStreet", url: "https://finance.yahoo.com/quote/GOOGL" },
            { label: "What a company's first dividend really signals", source: "The Motley Fool", url: "https://finance.yahoo.com/quote/GOOGL/news" },
          ] },
        ],
        source: "TheStreet", date: "Apr 25, 2024", bg: GREEN, ink: CREAM_INK,
      },
      {
        kicker: "2023, Bard",
        headline: "A chatbot error erased $100B in a day.",
        visual: { kind: "stat", value: "-$100B", label: "value lost in one day, Feb 2023", context: "Bard gave a wrong answer in its first demo." },
        body: "When Google first showed its Bard chatbot, it gave a wrong answer on stage.",
        deep: [
          { t: "p", text: "In early 2023 Google held its first public demo of Bard, its answer to ChatGPT. On stage, Bard gave a wrong answer to a simple question about a space telescope. The mistake spread everywhere within hours." },
          { t: "p", text: "Investors were already anxious that Google had been caught flat-footed on AI, and the fumble seemed to confirm it. The stock lost about $100 billion of its value in a single day, one of the sharpest one-day drops ever tied to a single product moment." },
          { t: "p", text: "It recovered fully within months, and the system behind Bard grew into Gemini, now central to the whole company. The one-day drop stands as a marker of how violently sentiment can swing on anything to do with AI." },
          { t: "refs", items: [
            { label: "Google loses $100B after Bard's flawed demo", source: "Reuters", url: "https://finance.yahoo.com/quote/GOOGL" },
            { label: "From Bard's stumble to Gemini", source: "The Verge", url: "https://finance.yahoo.com/quote/GOOGL/news" },
          ] },
        ],
        source: "Reuters", date: "Feb 8, 2023", bg: RED, ink: "#f6ece6",
      },
      {
        kicker: "2022",
        headline: "The stock fell 39% in one year.",
        visual: { kind: "trend", up: false, value: "-39%", label: "GOOGL, 2022" },
        body: "In 2022, rising interest rates and an ad-spending slump hit every big tech stock.",
        deep: [
          { t: "p", text: "In 2022 Google's stock fell 39 percent. The cause was mostly outside the company. Central banks raised interest rates fast to fight inflation, which pulls money out of every high-growth stock at once, and an advertising slump hit Google's core business at the same time." },
          { t: "p", text: "Nothing broke inside Google. Its search, its cash and its position were intact; the market simply repriced the whole technology sector downward. Amazon, Microsoft and Meta all fell hard the same year, for the same reasons." },
          { t: "p", text: "The stock then more than recovered over the next two years." },
          { t: "refs", items: [
            { label: "Big tech's brutal 2022, in numbers", source: "Barron's", url: "https://finance.yahoo.com/quote/GOOGL" },
            { label: "How rate hikes hammered growth stocks", source: "Bloomberg", url: "https://finance.yahoo.com/quote/GOOGL/news" },
          ] },
        ],
        source: "Barron's", date: "Dec 30, 2022", bg: SLATE, ink: "#eef1f8",
      },
      {
        kicker: "2015",
        headline: "A $900M stake in SpaceX, a decade ago.",
        visual: { kind: "stat", value: "$900M", label: "Google's 2015 SpaceX investment" },
        body: "In 2015, Google invested $900 million in SpaceX, then a risky rocket startup.",
        deep: [
          { t: "p", text: "Back in 2015 Google invested about $900 million in SpaceX, then a young and risky rocket company that had not yet proven reusable rockets could work at scale." },
          { t: "p", text: "A decade on, SpaceX is one of the most valuable private companies in the world, and Google's early stake is worth many times what it paid. It is a small piece of Alphabet, not something that moves the stock, but a clean example of a patient investment made long before the outcome was clear." },
          { t: "p", text: "It also fits a pattern. Google has long used its cash to take small, long-dated positions in the future, from self-driving cars to AI to rockets. Most lead nowhere; a handful, like this one, end up worth many times what it paid." },
          { t: "refs", items: [
            { label: "Google's 2015 stake in SpaceX, a decade later", source: "The Motley Fool", url: "https://finance.yahoo.com/quote/GOOGL" },
            { label: "Inside Alphabet's long-shot investments", source: "Bloomberg", url: "https://finance.yahoo.com/quote/GOOGL/news" },
          ] },
        ],
        source: "Motley Fool", date: "Jan 20, 2015", bg: BRASS, ink: "#f8efd8",
      },
      {
        kicker: "More",
        headline: "Everything else on Google.",
        visual: { kind: "stat", value: "23", label: "stories and clips, from across the sources", context: "Read or watch any right here." },
        body: "The rest of what is being written and filmed about Google, from across the sources.",
        deep: [
          { t: "feed", title: "Latest", items: [
            { kind: "video", headline: "Inside the data centres behind Google's $190B AI push", source: "Bloomberg", date: "Jul 2, 2026", minutes: 6, body: ["The number that defines Google right now is 190 billion dollars, the amount it plans to spend this year on the buildings and machines that run AI. This is a tour of where that money physically goes.", "A modern AI data centre looks less like an office and more like a power plant wrapped around a warehouse. Inside are long rows of servers, and inside those are the chips that do the actual work. Google is unusual in that it designs many of its own, called TPUs, tuned specifically to train and run its models rather than bought off the shelf from Nvidia.", "Designing its own silicon is part of how Google keeps costs down. A chip built for exactly one job can be cheaper to run than a general-purpose one, and it frees Google from paying a premium to a single supplier. It is also part of why Google Cloud can undercut rivals on the price of AI computing.", "The harder limits are not chips but power and cooling. Each large site can draw as much electricity as a small city, and running tens of thousands of chips at full load throws off enormous heat that has to be carried away constantly. Water and advanced cooling are now as much a part of the design as the servers.", "Because power is the binding constraint, the competition has quietly become a race for electricity. Google has signed long deals to secure supply, including agreements to buy from small nuclear reactors, locking in years of steady, carbon-free power before the full demand arrives.", "The scale is deliberate. The idea behind the spending is that AI becomes something most software runs on, and that whoever owns the computing power underneath it earns from many customers for years. Microsoft, Amazon and Meta are building at a similar pace, so standing still is not an option.", "The risk is as large as the ambition. This year's spending is running ahead of what the whole company earns in profit, and the payoff is years out. If demand cools before all this capacity is finished, Google is left with very expensive buildings running below their potential. The next earnings report, on July 22, is the first real read on whether it is starting to pay back."] },
            { kind: "article", headline: "Waymo passes 15 million paid robotaxi rides", source: "The Verge", date: "Jul 1, 2026", minutes: 4, body: ["Waymo, the self-driving unit inside Alphabet, said it has given more than 15 million paid rides across Phoenix, San Francisco, Los Angeles and Austin.", "It is small next to the ad business, but it is one of the few robotaxi services running at real scale, and it has been adding cities every few months."] },
            { kind: "article", headline: "Google's AI Overviews now answer most searches", source: "Reuters", date: "Jun 30, 2026", minutes: 3, body: ["The AI summaries above Google's search results now appear on the majority of searches. Publishers worry they keep readers from clicking through to their sites.", "Google says the feature keeps people searching more, which protects the ads that still bring in most of its money."] },
            { kind: "video", headline: "How Google designs its own AI chips", source: "CNBC", date: "Jun 29, 2026", minutes: 8, body: ["CNBC breaks down the TPU, the chip Google builds instead of buying everything from Nvidia.", "Designing its own silicon lets Google cut costs and tune the hardware to its own models, one reason its cloud can undercut rivals on price."] },
            { kind: "article", headline: "DeepMind's latest model tackles unsolved maths problems", source: "Nature", date: "Jun 28, 2026", minutes: 5, body: ["Google DeepMind published work showing its system solving problems at the level of the top human competitors in mathematics.", "It is research, not a product, but it shows where the models are heading and helps Google recruit the field's best people."] },
            { kind: "article", headline: "Alphabet Q2 earnings: what Wall Street is watching", source: "Barchart", date: "Jun 27, 2026", minutes: 4, body: ["Ahead of the July 22 report, analysts are focused on two numbers: Google Cloud's profit and any change to the AI spending plan.", "A strong Cloud quarter would back the case that the heavy spending is starting to pay back."] },
            { kind: "article", headline: "Gemini arrives across Gmail, Docs and Sheets", source: "TechCrunch", date: "Jun 26, 2026", minutes: 3, body: ["The Gemini assistant is now built into Google's work tools for business customers.", "It is how Google turns AI research into subscription revenue, and it puts it head to head with Microsoft's Copilot inside the apps people use at work."] },
            { kind: "article", headline: "YouTube pays out a record sum to creators", source: "Variety", date: "Jun 25, 2026", minutes: 3, body: ["YouTube said it paid creators more over the past three years than any rival platform.", "YouTube sits inside Alphabet and is one of its largest businesses after Search, across ads, subscriptions and TV."] },
            { kind: "video", headline: "The antitrust case that could reshape Google", source: "PBS", date: "Jun 24, 2026", minutes: 10, body: ["A documentary look at the US monopoly ruling against Google's search deals.", "The remedies on the table run from banning the payments to Apple to breaking off parts of the ad business. The penalty phase is expected to take months."] },
            { kind: "article", headline: "Google commits to nuclear power for its data centres", source: "Reuters", date: "Jun 23, 2026", minutes: 4, body: ["Google signed deals to buy electricity from small nuclear reactors to power its AI build-out.", "Power, not chips, is becoming the real constraint on how fast the company can grow its data centres."] },
            { kind: "article", headline: "Berkshire's Google stake: what Buffett may see", source: "Motley Fool", date: "Jun 21, 2026", minutes: 5, body: ["A closer read on the roughly $41 billion position. The case: Google throws off enormous cash, trades cheaper than other big tech, and holds a durable grip on search.", "The risk Buffett is taking is the same AI question hanging over the whole company."] },
            { kind: "video", headline: "Sundar Pichai on Google's AI strategy", source: "Yahoo Finance", date: "Jun 19, 2026", minutes: 12, body: ["Alphabet's chief executive makes the case for spending up to $190 billion this year: AI as core infrastructure, Cloud as the proof it pays, search as the business it has to defend.", "He takes on the fear that AI answers could eat into the search ads that fund all of it."] },
            { kind: "article", headline: "Google unveils Willow quantum chip, says it solved a benchmark task in minutes", source: "Reuters", date: "Jul 8, 2026", minutes: 5, body: ["Alphabet's quantum division said its latest processor completed a calculation that would take conventional supercomputers far longer, while cutting error rates as it scaled up."] },
            { kind: "article", headline: "EU opens formal charges against Google over ad-tech dominance", source: "Financial Times", date: "Jul 5, 2026", minutes: 6, body: ["Brussels signalled it may order Google to divest parts of its advertising business after finding the company favoured its own exchange."] },
            { kind: "video", headline: "Hands-on: Gemini takes over Google Maps navigation", source: "The Verge", date: "Jul 2, 2026", minutes: 7, body: ["A walkthrough of the conversational assistant now answering questions about landmarks and rerouting by voice."] },
            { kind: "article", headline: "Google launches Pixel 10 lineup with a new Tensor chip", source: "TechCrunch", date: "Jun 30, 2026", minutes: 5, body: ["The flagship phones lead with on-device Gemini features and a redesigned camera system, priced against Apple and Samsung."] },
            { kind: "article", headline: "Alphabet's Isomorphic Labs advances its first AI-designed drug toward trials", source: "Nature", date: "Jun 27, 2026", minutes: 8, body: ["One of Google's most ambitious projects has nothing to do with search or ads. Isomorphic Labs, a spinout of the DeepMind AI lab, is trying to use AI to design new medicines, and it says its first candidates are now moving toward human trials.", "The foundation is a system called AlphaFold, which learned to predict the three-dimensional shape of proteins, the molecular machines that run the body. Knowing a protein's shape is the starting point for designing a drug that fits it, and for decades working that out was slow, costly laboratory work. AlphaFold did it for hundreds of millions of proteins at once, and DeepMind released much of that data to the world's scientists for free.", "Isomorphic is the attempt to turn that breakthrough into actual medicines. Rather than testing compounds one by one, it uses AI to narrow millions of possibilities down to the few most likely to work, then partners with drug companies to run the real trials.", "For Google the near-term financial stakes are small. Drug discovery takes years and most candidates fail, so this will not move the company's earnings soon. What it signals is bigger: that Google's AI is aimed at problems far outside advertising, and that the same research feeds its recruiting and its reputation.", "It is best understood as a long-dated position on where AI leads, in the same family as its self-driving and quantum efforts. Most such projects lead nowhere. The few that work can be enormous, and this is one of the most credible attempts anyone has made to use AI to invent drugs."] },
            { kind: "article", headline: "Google to lay a new transpacific subsea cable linking the US and Japan", source: "Nikkei", date: "Jun 24, 2026", minutes: 4, body: ["The route is meant to add bandwidth for cloud and AI traffic across the Pacific."] },
            { kind: "video", headline: "How Google's stake in Anthropic fits its AI strategy", source: "CNBC", date: "Jun 21, 2026", minutes: 6, body: ["An explainer on the cloud and investment ties between Alphabet and the maker of Claude."] },
            { kind: "article", headline: "Waymo raises a new funding round valuing the unit at $45 billion", source: "Bloomberg", date: "Jun 18, 2026", minutes: 5, body: ["Outside investors joined Alphabet to fund an expansion of the robotaxi service into more cities."] },
            { kind: "article", headline: "Google delays third-party cookie changes again in Chrome", source: "The Wall Street Journal", date: "Jun 15, 2026", minutes: 6, body: ["The company said advertisers and regulators need more time to adjust to its privacy plan, pushing the timeline back once more."] },
            { kind: "article", headline: "Google commits $15 billion to a data-centre and AI hub in India", source: "Reuters", date: "Jun 12, 2026", minutes: 5, body: ["The multi-year investment is Alphabet's largest in the country and targets local cloud demand."] },
            { kind: "video", headline: "Testing Google Photos' new AI photo editor", source: "The Verge", date: "Jun 9, 2026", minutes: 7, body: ["A demo of tools that reshape, remove and relight images with a few taps."] },
          ] },
        ],
        source: "Multiple sources", date: "Jul 2026", bg: SLATE, ink: "#eef1f8",
      },
    ],
  },
  VTI: {
    name: "the US market",
    cards: [
      {
        kicker: "The Fed",
        headline: "The Fed held interest rates steady.",
        visual: { kind: "stat", value: "4.25 to 4.5%", label: "the Fed's target rate, held Jul 30", context: "Markets now expect one cut before year end." },
        body: "The Federal Reserve left rates unchanged and signalled it may cut once before the end of the year.",
        deep: [
          { t: "position", value: "$2,140", gain: "+63% all-time", shares: "7.1 shares of VTI" },
          { t: "p", text: "The Federal Reserve held its rate at 4.25 to 4.5 percent on July 30 and pointed to one possible cut later this year. Rates are the single biggest lever on the whole market, so a broad fund moves more on the Fed than on any one company." },
          { t: "line", title: "The rate, past four years", caption: "Fed target rate, upper bound", points: [0.25, 0.25, 1.75, 4.5, 5.5, 5.25, 4.75, 4.5], startLabel: "2022", endLabel: "now" },
          { t: "p", text: "The Fed raised rates fast in 2022 to fight inflation, then began easing as prices cooled. Lower rates make borrowing cheaper for companies and tend to lift stocks broadly, which is why the market reads every meeting closely." },
          { t: "refs", items: [
            { label: "Fed holds rates, pencils in one cut for 2026", source: "Reuters", url: "https://finance.yahoo.com/quote/VTI" },
            { label: "What the Fed's decision means for stocks", source: "Yahoo Finance", url: "https://finance.yahoo.com/quote/VTI/news" },
          ] },
        ],
        source: "Reuters", date: "Jul 30, 2026", bg: BLUE, ink: "#eaf1fb",
      },
      {
        kicker: "Earnings season",
        headline: "Most big US companies beat expectations.",
        visual: { kind: "stat", value: "~78%", label: "of the S&P 500 beat profit forecasts", context: "Second quarter, reported through late July." },
        body: "About four in five large US companies reported higher profits than analysts expected this quarter.",
        deep: [
          { t: "p", text: "Every quarter, US companies report how they actually did. This season about four in five of the largest, the companies in the S&P 500, reported higher profits than analysts had expected. A broad-market fund like this owns nearly all of them." },
          { t: "p", text: "Profits are what the market rests on over time. Prices can drift on mood for a while, but across years a rising market is one whose companies are earning more. A season of broad beats says the businesses inside the fund are, on the whole, still growing." },
          { t: "p", text: "For the full year, analysts expect profits across the market to rise in the high single digits, a pace that helps explain why stocks have held near records." },
          { t: "refs", items: [
            { label: "S&P 500 earnings beat rate tops 78%", source: "FactSet", url: "https://finance.yahoo.com/quote/VTI" },
            { label: "What earnings season is telling investors", source: "Reuters", url: "https://finance.yahoo.com/quote/VTI/news" },
          ] },
        ],
        source: "FactSet", date: "Jul 28, 2026", bg: GREEN, ink: CREAM_INK,
      },
      {
        kicker: "A record",
        headline: "US stocks closed at an all-time high.",
        visual: { kind: "stat", value: "+14%", label: "the US market so far this year", context: "At a fresh all-time high." },
        body: "The broad US market set a fresh record this month, up roughly 14% for the year.",
        deep: [
          { t: "p", text: "The broad US market set a fresh record this month, up roughly 14 percent for the year. New highs draw headlines, but they are ordinary in a market that rises over time: it spends much of its life at or near one." },
          { t: "p", text: "This year's climb has been led by the big technology companies and by growing confidence that the Federal Reserve will start cutting interest rates. Lower rates tend to lift the whole market, so the expectation alone has helped push prices up." },
          { t: "p", text: "The same few giants driving the gains are also the market's main risk, since so much of the market now rides on a handful of names." },
          { t: "refs", items: [
            { label: "US stocks close at a record high", source: "Yahoo Finance", url: "https://finance.yahoo.com/quote/VTI" },
            { label: "What is driving the market to records", source: "Bloomberg", url: "https://finance.yahoo.com/quote/VTI/news" },
          ] },
        ],
        source: "Yahoo Finance", date: "Jul 24, 2026", bg: AMBER, ink: "#f7efdc",
      },
      {
        kicker: "The honest risk",
        headline: "The market has never leaned this hard on big tech.",
        visual: { kind: "stat", value: "~33%", label: "of the market sits in its ten biggest companies", context: "A record, up from about 20% a decade ago." },
        body: "The ten largest US companies, almost all big tech, now make up about a third of the entire market, a record.",
        deep: [
          { t: "p", text: "An index fund like this owns nearly every US company, about 3,600 of them, so it is built to spread risk widely. It still does, but the market itself has grown top-heavy. Its ten biggest companies now make up about a third of it, up from roughly a fifth a decade ago." },
          { t: "table", title: "The ten biggest, roughly", rows: [
            { k: "Apple, Microsoft, Nvidia", v: "~18% together" },
            { k: "Amazon, Alphabet, Meta", v: "~11% together" },
            { k: "The other ~3,590 companies", v: "~67%" },
          ] },
          { t: "chart", title: "The market by sector", caption: "Share of the fund, approximate", bars: [
            { label: "Technology", value: "31%", frac: 0.31, hot: true },
            { label: "Financials", value: "13%", frac: 0.13 },
            { label: "Health care", value: "12%", frac: 0.12 },
            { label: "Consumer", value: "10%", frac: 0.10 },
            { label: "Everything else", value: "34%", frac: 0.34 },
          ] },
          { t: "p", text: "So the market rides on a handful of tech giants more than it ever has. When they climb they carry everything with them, and a stumble in a few names now moves the whole market. It is still diversified, just less than the number 3,600 suggests." },
          { t: "refs", items: [
            { label: "US market concentration hits a record", source: "Morningstar", url: "https://finance.yahoo.com/quote/VTI" },
          ] },
        ],
        source: "Morningstar", date: "Jul 22, 2026", bg: RED, ink: "#f6ece6",
      },
      {
        kicker: "Inflation",
        headline: "Inflation cooled to 2.6%.",
        visual: { kind: "trend", up: false, value: "2.6%", label: "annual US inflation, June" },
        body: "Prices rose 2.6% over the past year, closing in on the Fed's 2% target and far below the 2022 peak.",
        deep: [
          { t: "p", text: "Prices across the US economy rose 2.6 percent over the past year. That is the inflation rate, and it is the single number the Federal Reserve watches most, because its core job is to keep prices stable." },
          { t: "table", title: "Inflation, the recent path", rows: [
            { k: "2022 peak", v: "~9%" },
            { k: "Today", v: "2.6%" },
            { k: "The Fed's target", v: "2%" },
          ] },
          { t: "p", text: "At 2.6 percent, inflation is close enough to the Fed's 2 percent goal that the Fed can hold interest rates steady rather than raise them, and may soon cut. That long climb down from a 9 percent peak in 2022 is a large part of why the market has held up." },
          { t: "p", text: "Cooler inflation is what lets the Federal Reserve hold rates steady or begin cutting, and lower rates tend to lift stocks broadly." },
          { t: "refs", items: [
            { label: "US inflation cools to 2.6%", source: "Associated Press", url: "https://finance.yahoo.com/quote/VTI" },
            { label: "Why the Fed watches inflation so closely", source: "Reuters", url: "https://finance.yahoo.com/quote/VTI/news" },
          ] },
        ],
        source: "Bureau of Labor Statistics", date: "Jul 15, 2026", bg: SLATE, ink: "#eef1f8",
      },
      {
        kicker: "2022",
        headline: "The market fell 25% in a year.",
        visual: { kind: "trend", up: false, value: "-25%", label: "US market, 2022" },
        body: "In 2022 the fastest rate hikes in decades sent the whole market down about a quarter.",
        deep: [
          { t: "p", text: "In 2022 the whole US market fell about 25 percent. The trigger was the fastest series of interest-rate hikes in decades, as the Federal Reserve moved to crush the highest inflation in forty years." },
          { t: "p", text: "Higher rates pull money out of stocks across the board, so the fall was broad rather than about any one company. Nothing was broken inside the businesses; the market simply repriced everything at once as borrowing turned expensive." },
          { t: "p", text: "It recovered its losses by 2024. A fund that owns the whole market moves with the entire economy, up in years like this one and down in years like 2022." },
          { t: "refs", items: [
            { label: "The market's worst year since 2008", source: "Barron's", url: "https://finance.yahoo.com/quote/VTI" },
            { label: "How 2022's rate hikes hit stocks", source: "Bloomberg", url: "https://finance.yahoo.com/quote/VTI/news" },
          ] },
        ],
        source: "Barron's", date: "Dec 30, 2022", bg: SLATE, ink: "#eef1f8",
      },
      {
        kicker: "2020",
        headline: "The fastest crash and recovery on record.",
        visual: { kind: "stat", value: "-34%", label: "US market drop, early 2020", context: "Recovered in about five months." },
        body: "When the pandemic hit, the market fell 34% in five weeks, then made it all back within months.",
        deep: [
          { t: "p", text: "When the pandemic hit in early 2020, the US market fell 34 percent in about five weeks, the fastest crash of that size on record. For a stretch it felt like the floor had dropped out entirely." },
          { t: "p", text: "Then it turned. Emergency interest-rate cuts and enormous government support steadied markets, and the whole index made its losses back within months. By that August it was setting new record highs." },
          { t: "p", text: "It stands as the clearest recent example of how fast both a crash and a recovery can move: a 34 percent fall and a full rebound inside a single year." },
          { t: "refs", items: [
            { label: "The fastest crash and recovery in market history", source: "Reuters", url: "https://finance.yahoo.com/quote/VTI" },
            { label: "How markets recovered from the 2020 crash", source: "Morningstar", url: "https://finance.yahoo.com/quote/VTI/news" },
          ] },
        ],
        source: "Reuters", date: "Aug 18, 2020", bg: RED, ink: "#f6ece6",
      },
      {
        kicker: "More",
        headline: "Everything else on the market.",
        visual: { kind: "stat", value: "20", label: "stories and clips, from across the sources", context: "Read or watch any right here." },
        body: "The rest of what is moving the market, from across the sources.",
        deep: [
          { t: "feed", title: "Latest", items: [
            { kind: "video", headline: "What the Fed's decision means for savers and borrowers", source: "Yahoo Finance", date: "Jul 30, 2026", minutes: 5, body: ["A plain read on the Fed holding rates and signalling one cut this year.", "Rates ripple out to mortgages, savings and stocks. For a fund that owns the whole market, the rate path matters more than any single company."] },
            { kind: "article", headline: "Big tech earnings push the market to new highs", source: "Reuters", date: "Jul 29, 2026", minutes: 4, body: ["Strong results from the largest technology companies lifted the broad market to a fresh record.", "Because those companies now make up about a third of the market, their earnings increasingly set the direction for everyone else."] },
            { kind: "article", headline: "Jobs report: hiring slows but holds up", source: "Bloomberg", date: "Jul 26, 2026", minutes: 3, body: ["US employers added fewer jobs than a year ago, but unemployment stayed low.", "A cooling but steady jobs market is what the Fed wants: enough slack to keep inflation down, not so much that the economy stalls."] },
            { kind: "video", headline: "The risk of a market this concentrated", source: "CNBC", date: "Jul 22, 2026", minutes: 7, body: ["A look at how the ten biggest companies came to make up a third of the US market, and what happens to an index fund if a few of them stumble.", "Spreading across 3,600 companies still helps, just less than it did a decade ago."] },
            { kind: "article", headline: "Inflation cools to 2.6%, closing on the Fed's target", source: "AP", date: "Jul 15, 2026", minutes: 3, body: ["Prices rose 2.6% over the past year, down from a 9% peak in 2022 and near the Fed's 2% goal.", "Cooler inflation is what lets the Fed hold rates steady rather than raise them."] },
            { kind: "article", headline: "Bond yields ease as rate cuts come into view", source: "Bloomberg", date: "Jul 12, 2026", minutes: 3, body: ["The interest paid on US government bonds slipped as investors grew more confident the Fed will cut later this year.", "Lower yields tend to lift stocks, since bonds compete with them for investors' money."] },
            { kind: "article", headline: "Small companies keep lagging the giants", source: "The Wall Street Journal", date: "Jul 10, 2026", minutes: 4, body: ["Smaller US companies have trailed the big names for years. A total-market fund holds them too.", "A turn in their favour would broaden the market's gains beyond big tech, something many strategists are still waiting for."] },
            { kind: "article", headline: "How index funds quietly took over investing", source: "The Atlantic", date: "Jul 5, 2026", minutes: 6, body: ["An index fund like this one, which simply owns the whole market instead of trying to pick winners, now holds a very large share of all US stocks. This is the story of how a quiet idea took over investing.", "The idea is almost stubbornly simple. Instead of paying an expert to guess which companies will do well, an index fund buys a little of everything and charges next to nothing. It gives up any chance of beating the market in exchange for reliably matching it, at rock-bottom cost.", "For decades that was treated as a strange, defeatist strategy. Then the evidence piled up: over long stretches, most professional stock-pickers fail to beat the market after their fees, and the ones who win in one decade often lag in the next. Simply owning everything, cheaply, quietly beat most of the experts.", "Cost is the engine. When a fund charges 0.03 percent instead of 1 percent, nearly all of the market's return stays with the owner rather than leaking out in fees, and over decades that difference compounds into a large sum. Low cost, more than any clever insight, is why index funds win.", "Their rise has a flip side worth knowing. Because index funds buy companies in proportion to their size, they pour the most money into whatever is already biggest, which is part of why the market has grown so concentrated in a handful of giant firms. The approach that spreads risk widely also quietly amplifies the largest names."] },
            { kind: "video", headline: "A century of crashes and recoveries", source: "PBS", date: "Jun 30, 2026", minutes: 11, body: ["Owning the whole US market means owning its entire history, the crashes as well as the climbs. This is a walk through the big falls of the last hundred years and, just as important, what happened after each one.", "1929 is the one everyone knows. The market lost most of its value and did not fully recover for years, made far worse by a banking collapse and policy mistakes that turned a crash into the Great Depression. It is the extreme case, and much of modern financial regulation exists to prevent a repeat.", "2008 was the closest modern echo. A housing and banking crisis cut the market roughly in half, and it felt like the financial system itself might fail. It did not, and the market made back its losses within about four years, then ran into one of the longest bull markets in history.", "2020 was the strangest. When the pandemic hit, the market fell 34 percent in five weeks, the fastest crash of that size on record. Then, helped by emergency rate cuts and huge government support, it made it all back within months and was setting records by that August.", "The pattern across all of them is not that stocks always go up, they do not, but that the falls, however violent, have so far proven temporary against a long rising line. Each one felt permanent while it was happening.", "Past recoveries are not a promise of future ones, and 1929 is a reminder that a recovery can be slow and painful. What the century shows is a market that has, so far, gone on to new highs after every fall, which is the case the documentary makes for owning it across decades rather than years."] },
            { kind: "article", headline: "US economy grew 2.4% in the second quarter, above forecasts", source: "Reuters", date: "Jul 9, 2026", minutes: 5, body: ["Stronger business investment and steady consumer spending lifted the reading, easing worries about a slowdown."] },
            { kind: "article", headline: "Retail spending holds up as households keep opening their wallets", source: "The Wall Street Journal", date: "Jul 6, 2026", minutes: 5, body: ["Monthly sales rose more than expected, a sign consumers remain resilient despite higher prices."] },
            { kind: "video", headline: "A Fed governor lays out the case for holding rates steady", source: "CNBC", date: "Jul 3, 2026", minutes: 6, body: ["The official said inflation is easing but not enough to cut yet, in a speech markets watched closely."] },
            { kind: "article", headline: "Wall Street's fear gauge falls to a multi-year low", source: "Bloomberg", date: "Jun 30, 2026", minutes: 4, body: ["The VIX slid as steady earnings and calmer bond markets left investors expecting fewer sharp swings."] },
            { kind: "article", headline: "Money rotates from tech into industrials and financials", source: "Barron's", date: "Jun 27, 2026", minutes: 6, body: ["Investors broadened their holdings beyond a handful of large tech names, lifting sectors that had lagged."] },
            { kind: "article", headline: "Corporate profit margins hold near record highs", source: "Financial Times", date: "Jun 24, 2026", minutes: 5, body: ["Companies kept their pricing power and controlled costs, supporting earnings across the market."] },
            { kind: "article", headline: "Retail investors pour record sums into US stock funds", source: "Yahoo Finance", date: "Jun 21, 2026", minutes: 5, body: ["Inflows from individual investors reached a new high as confidence in the market grew."] },
            { kind: "video", headline: "The IPO market reopens after a long drought", source: "CNBC", date: "Jun 18, 2026", minutes: 7, body: ["Several large companies filed to go public, a sign risk appetite is returning to Wall Street."] },
            { kind: "article", headline: "US stock valuations climb above their long-run average", source: "Morningstar", date: "Jun 15, 2026", minutes: 6, body: ["The market's price-to-earnings ratio moved higher, prompting debate over how much room remains for gains."] },
            { kind: "article", headline: "Economists split on whether the soft landing is complete", source: "The Wall Street Journal", date: "Jun 12, 2026", minutes: 6, body: ["A survey showed forecasters divided over whether the economy can keep growing without reigniting inflation."] },
            { kind: "article", headline: "Mortgage rates ease as housing activity picks up", source: "Associated Press", date: "Jun 9, 2026", minutes: 5, body: ["Lower borrowing costs drew more buyers back to the market after a slow stretch."] },
          ] },
        ],
        source: "Multiple sources", date: "Jul 2026", bg: SLATE, ink: "#eef1f8",
      },
    ],
  },
  AAPL: {
    name: "Apple",
    cards: [
      {
        kicker: "The honest risk",
        headline: "Apple's AI is running late.",
        visual: { kind: "stat", value: "2026", label: "when the promised Siri overhaul now arrives", context: "About a year later than first shown." },
        body: "Apple showed a smarter, AI-powered Siri in 2024 and has pushed its release into 2026.",
        deep: [
          { t: "position", value: "$2,392", gain: "+154% all-time", shares: "7.64 shares of Apple" },
          { t: "p", text: "Apple was slow to the AI wave and is still catching up. The rebuilt Siri it promised has slipped by about a year, and some of its AI features lean on a partnership with OpenAI rather than Apple's own models." },
          { t: "p", text: "The counterweight is reach. Apple has more than two billion active devices and hundreds of millions of people inside its apps every day. If the AI features work, it has somewhere to put them the moment they ship." },
          { t: "chart", title: "Where Apple's money comes from", caption: "Share of revenue, approximate", bars: [
            { label: "iPhone", value: "51%", frac: 0.51, hot: true },
            { label: "Services", value: "25%", frac: 0.25 },
            { label: "Mac and iPad", value: "14%", frac: 0.14 },
            { label: "Wearables, home", value: "10%", frac: 0.10 },
          ] },
          { t: "p", text: "The risk is that half of Apple's money still rides on the iPhone, and better AI could one day make the phone matter less. The next earnings report is August 1." },
          { t: "refs", items: [
            { label: "Apple delays its AI Siri overhaul into 2026", source: "Bloomberg", url: "https://finance.yahoo.com/quote/AAPL" },
            { label: "Apple leans on OpenAI while it builds its own models", source: "Reuters", url: "https://finance.yahoo.com/quote/AAPL/news" },
          ] },
        ],
        source: "Bloomberg", date: "Jul 1, 2026", bg: SLATE, ink: "#eef1f8",
      },
      {
        kicker: "The second engine",
        headline: "Services is now a quarter of Apple.",
        visual: { kind: "stat", value: "~$100B", label: "yearly Services revenue", context: "The App Store, iCloud, Apple Pay and more." },
        body: "Apple's Services business, the App Store, iCloud, Apple Pay and subscriptions, now brings in about $100 billion a year.",
        deep: [
          { t: "p", text: "For most of its life Apple was judged by how many iPhones it sold. That is shifting. Its Services business, the App Store, iCloud, Apple Pay, Apple Music, TV+, warranties and search deals, now brings in about $100 billion a year, a full quarter of the company." },
          { t: "p", text: "Services matters out of proportion to its size because it is far more profitable than hardware and far steadier. A phone is sold once; the subscriptions and fees attached to it recur every month, drawn from the two billion Apple devices already in people's hands." },
          { t: "p", text: "It is the main reason investors pay a premium for Apple over a plain electronics maker. The risk sits in the fine print: a large slice of Services profit is the roughly $20 billion a year Google pays to be Apple's default search, which the US antitrust case could disrupt." },
          { t: "refs", items: [
            { label: "Apple Services revenue nears $100B a year", source: "Yahoo Finance", url: "https://finance.yahoo.com/quote/AAPL" },
            { label: "Why Services is Apple's most important story", source: "Bloomberg", url: "https://finance.yahoo.com/quote/AAPL/news" },
          ] },
        ],
        source: "Yahoo Finance", date: "Jun 28, 2026", bg: GREEN, ink: CREAM_INK,
      },
      {
        kicker: "Capital return",
        headline: "Apple approved another $90B of buybacks.",
        visual: { kind: "stat", value: "~$90B", label: "approved to buy back its own shares" },
        body: "Apple set aside about $90 billion to buy back its own stock, one of the largest such programmes anywhere.",
        deep: [
          { t: "p", text: "Apple's board approved about $90 billion to buy back its own shares over the coming year, one of the largest such programmes anywhere. It has repurchased hundreds of billions of dollars of stock over the past decade." },
          { t: "p", text: "The mechanism is simple. When Apple buys its own shares, they are retired, so the same profit is divided among fewer shares. Each remaining share, including the ones in this fund, quietly comes to own a larger piece of the company." },
          { t: "p", text: "Apple makes far more cash than it can reinvest in businesses that already dominate their markets, so it hands most of it back through these buybacks and a small dividend." },
          { t: "refs", items: [
            { label: "Apple authorizes about $90B in buybacks", source: "TheStreet", url: "https://finance.yahoo.com/quote/AAPL" },
            { label: "A decade of Apple buybacks, in one chart", source: "Morningstar", url: "https://finance.yahoo.com/quote/AAPL/news" },
          ] },
        ],
        source: "TheStreet", date: "Jun 24, 2026", bg: BRASS, ink: "#f8efd8",
      },
      {
        kicker: "The swing factor",
        headline: "China is Apple's hardest market.",
        visual: { kind: "stat", value: "~17%", label: "of Apple's sales come from China" },
        body: "China is one of Apple's largest markets and its most uncertain, caught between local rivals and trade tension.",
        deep: [
          { t: "p", text: "China is one of Apple's largest markets, around 17 percent of sales, and its most uncertain. It is both where many iPhones are sold and where nearly all of them are built, so the country is a double exposure." },
          { t: "p", text: "On sales, homegrown rivals led by Huawei have clawed back share with strong phones and national loyalty, and some Chinese workplaces have discouraged iPhones. On supply, almost all of Apple's manufacturing runs through China, so any friction between Washington and Beijing lands on Apple twice." },
          { t: "p", text: "Apple is slowly shifting some production to India and Vietnam to spread the risk, but the move is partial and takes years. How a given quarter looks for Apple often comes down to how China went." },
          { t: "refs", items: [
            { label: "Apple's China sales under pressure from Huawei", source: "Reuters", url: "https://finance.yahoo.com/quote/AAPL" },
            { label: "Apple's slow shift of production out of China", source: "Bloomberg", url: "https://finance.yahoo.com/quote/AAPL/news" },
          ] },
        ],
        source: "Reuters", date: "Jun 20, 2026", bg: RED, ink: "#f6ece6",
      },
      {
        kicker: "More",
        headline: "Everything else on Apple.",
        visual: { kind: "stat", value: "23", label: "stories and clips, from across the sources", context: "Read or watch any right here." },
        body: "The rest of what is being written and filmed about Apple.",
        deep: [
          { t: "feed", title: "Latest", items: [
            { kind: "video", headline: "Hands-on with the newest iPhone", source: "The Verge", date: "Jul 1, 2026", minutes: 6, body: ["A first look at the latest iPhone, where Apple's AI features show up first.", "The hardware changes are modest. The story Apple wants to tell is about the software and the assistant."] },
            { kind: "article", headline: "Apple's Vision headset still hunts for a purpose", source: "Bloomberg", date: "Jun 27, 2026", minutes: 5, body: ["Apple's mixed-reality headset remains niche two years in, with sales far below the iPhone's early years.", "Apple treats it as a long-term investment in where computing goes next, not a business that matters to this year's numbers."] },
            { kind: "article", headline: "The App Store faces new rules in Europe", source: "Reuters", date: "Jun 22, 2026", minutes: 4, body: ["European regulators are forcing Apple to allow other app stores and payment options on the iPhone.", "It chips at a slice of Services revenue, though most users have stuck with Apple's own store so far."] },
            { kind: "video", headline: "Tim Cook on Apple's AI strategy", source: "CNBC", date: "Jun 18, 2026", minutes: 9, body: ["Apple's chief executive argues Apple does not need to be first on AI, only to make it work well and privately on its devices.", "He addresses the delays and the reliance on partners while Apple's own models catch up."] },
            { kind: "article", headline: "Apple pushes back its overhauled Siri to next year", source: "Bloomberg", date: "Jul 9, 2026", minutes: 6, body: ["The company said the more personalised, AI-driven assistant needs more engineering time, extending a delay first flagged last year."] },
            { kind: "article", headline: "Apple Services revenue tops $100 billion for the first time", source: "CNBC", date: "Jul 6, 2026", minutes: 5, body: ["Growth in the App Store, iCloud and advertising made Services the company's second-largest segment."] },
            { kind: "article", headline: "Apple regains the top smartphone spot in China as Huawei momentum cools", source: "Reuters", date: "Jul 3, 2026", minutes: 6, body: ["New shipment data showed iPhone sales recovering after a run of discounts and trade-ins."] },
            { kind: "video", headline: "Inside Apple's plan to make most US iPhones in India", source: "The Wall Street Journal", date: "Jun 30, 2026", minutes: 8, body: ["For most of the iPhone's life, nearly every unit was made in China. That is changing, and this is a look at how fast and why.", "The push has two drivers. One is trade tension: tariffs and the threat of more have made a supply chain concentrated in a single country a real financial risk. The other is plain concentration risk. Relying on one place for almost all of a product that brings in half the company's revenue is fragile, whatever the politics.", "India has become the main alternative. Apple and its manufacturing partners have expanded plants there quickly, and a growing share of iPhones sold in the US are now assembled in India rather than China.", "The move is harder than it sounds. China spent two decades building the roads, suppliers, trained workforce and sheer scale that let a new iPhone go from design to tens of millions of units in months. India is building that up, but it takes years, and for now many components still come from Chinese suppliers even when final assembly happens elsewhere.", "There is an upside beyond safety. India is also one of Apple's fastest-growing markets, so making phones there helps sell phones there, both by trimming import costs and by earning goodwill with a government that wants local manufacturing.", "None of this happens overnight, and Apple has been careful not to move so fast that quality or supply slips. But the direction is set. Over the coming years a meaningful slice of iPhone production is shifting out of China, easing the single biggest concentration risk hanging over the company."] },
            { kind: "article", headline: "Apple's board approves a $110 billion buyback", source: "Barron's", date: "Jun 27, 2026", minutes: 4, body: ["The repurchase authorisation ranks among the largest ever and continues the company's steady return of cash to shareholders."] },
            { kind: "article", headline: "watchOS update adds blood-pressure alerts to the Apple Watch", source: "Yahoo Finance", date: "Jun 24, 2026", minutes: 5, body: ["The health feature cleared regulatory review and expands the watch's monitoring tools."] },
            { kind: "article", headline: "Foldable iPhone said to enter production for a 2027 launch", source: "The Information", date: "Jun 21, 2026", minutes: 6, body: ["Suppliers are reportedly finalising a hinge and a crease-resistant display for Apple's first folding phone."] },
            { kind: "video", headline: "Why the Google search deal sits at the centre of Apple's antitrust troubles", source: "CNBC", date: "Jun 18, 2026", minutes: 7, body: ["An explainer on the multibillion-dollar payment that makes Google the default search engine on the iPhone."] },
            { kind: "article", headline: "Apple to cut App Store commissions for some EU developers", source: "Financial Times", date: "Jun 15, 2026", minutes: 5, body: ["The changes follow regulatory pressure over the fees and the rules governing outside payment options."] },
            { kind: "article", headline: "New MacBook Pro with an M5 chip promises longer battery life", source: "The Verge", date: "Jun 12, 2026", minutes: 5, body: ["Apple said the latest silicon improves performance per watt for AI tasks run on the device."] },
            { kind: "video", headline: "Trying the AirPods Pro hearing-aid mode a year on", source: "TechCrunch", date: "Jun 9, 2026", minutes: 6, body: ["A hands-on with the clinical-grade hearing feature now cleared in more countries."] },
            { kind: "article", headline: "Apple Card savings account draws $20 billion in deposits", source: "CNBC", date: "Jul 9, 2026", minutes: 5, body: ["The high-yield account run with Goldman Sachs kept growing, though the two firms continued unwinding parts of their partnership."] },
            { kind: "video", headline: "Apple TV+ drama wins big at this year's Emmys", source: "Variety", date: "Jul 6, 2026", minutes: 6, body: ["A look at the awards haul that has raised the profile of Apple's streaming service."] },
            { kind: "article", headline: "Apple unveils a new iPad Pro with a faster chip and thinner design", source: "The Verge", date: "Jul 3, 2026", minutes: 5, body: ["The tablet leads with the latest M-series silicon and a brighter display aimed at creative professionals."] },
            { kind: "article", headline: "App Store revenue hits a record on games and subscriptions", source: "Barron's", date: "Jun 30, 2026", minutes: 5, body: ["Developer sales reached a new high, underscoring the storefront's role in Apple's services growth."] },
            { kind: "article", headline: "Apple builds its own AI server chips with TSMC", source: "The Information", date: "Jun 27, 2026", minutes: 6, body: ["Apple is designing its own chips to run AI in its data centres, working with TSMC, the Taiwanese company that also builds the processors inside the iPhone.", "This mirrors a move Apple already made on the device side. Years ago it stopped buying phone and laptop chips off the shelf and started designing its own, which let it tune the hardware precisely to its software and stop paying a premium to outside suppliers. Those chips became one of Apple's biggest advantages.", "Now it is doing the same for the cloud. Apple's approach to AI leans on privacy, keeping as much as possible on the device, and when a task is too big it sends it to what Apple calls a private cloud. Building the server chips itself lets it control the cost, the performance and, it argues, the security of that cloud.", "It also reduces Apple's dependence on Nvidia, whose AI chips are expensive and in short supply. A company that designs its own silicon is less exposed to a single supplier's prices and waiting lists, the same logic that drove the iPhone chip decision.", "The catch is that Apple is late to AI and playing catch-up, so custom chips are a foundation, not a finished product. They lower the long-run cost of running AI, but the features that use them, including the delayed Siri overhaul, still have to arrive and work well."] },
            { kind: "article", headline: "Apple's growing ad business draws regulatory scrutiny in Europe", source: "Financial Times", date: "Jun 24, 2026", minutes: 6, body: ["Advertising in the App Store and other apps has become a fast-growing revenue line, prompting privacy questions."] },
            { kind: "video", headline: "A tour of Apple's largest new retail store in India", source: "Bloomberg", date: "Jun 21, 2026", minutes: 7, body: ["The flagship marks the company's continued retail push into one of its fastest-growing markets."] },
            { kind: "article", headline: "Apple reaffirms its plan for a carbon-neutral supply chain by 2030", source: "Reuters", date: "Jun 18, 2026", minutes: 5, body: ["The company said more suppliers have shifted to renewable power as it works toward its climate goal."] },
          ] },
        ],
        source: "Multiple sources", date: "Jul 2026", bg: SLATE, ink: "#eef1f8",
      },
    ],
  },
  DIS: {
    name: "Disney",
    cards: [
      {
        kicker: "The turn",
        headline: "Disney's streaming finally makes money.",
        visual: { kind: "stat", value: "~180M", label: "Disney+ subscribers worldwide", context: "And the service now turns a profit." },
        body: "Disney's streaming business, Disney+ and Hulu, has swung from big losses to a profit.",
        deep: [
          { t: "position", value: "$1,620", gain: "-14% all-time", shares: "16.64 shares of Disney" },
          { t: "p", text: "For years Disney spent heavily to build its streaming services and lost money doing it. Price rises, a crackdown on password sharing and tighter spending have now pushed the business into profit." },
          { t: "chart", title: "Where Disney's money comes from", caption: "Share of revenue, approximate", bars: [
            { label: "Parks and cruises", value: "37%", frac: 0.37, hot: true },
            { label: "Streaming", value: "23%", frac: 0.23 },
            { label: "TV networks", value: "22%", frac: 0.22 },
            { label: "Studios, other", value: "18%", frac: 0.18 },
          ] },
          { t: "p", text: "The parks and cruises are still the profit engine, while the old cable-TV business shrinks as viewers cut the cord. The stock is down over the past few years, which is why this holding shows a loss. The next earnings report is August 6." },
          { t: "refs", items: [
            { label: "Disney streaming posts back-to-back profits", source: "Reuters", url: "https://finance.yahoo.com/quote/DIS" },
            { label: "Inside Disney's turnaround plan", source: "CNBC", url: "https://finance.yahoo.com/quote/DIS/news" },
          ] },
        ],
        source: "Reuters", date: "Jul 1, 2026", bg: BLUE, ink: "#eaf1fb",
      },
      {
        kicker: "The profit engine",
        headline: "The parks still carry Disney.",
        visual: { kind: "stat", value: "~37%", label: "of revenue, the largest single part", context: "Parks, resorts and cruise lines." },
        body: "Disney's parks, resorts and cruise ships are its biggest and most profitable business.",
        deep: [
          { t: "p", text: "Disney's parks, resorts and cruise lines are its largest business and its profit engine, more than a third of revenue and an even larger share of the profit. This is where Disney turns its characters into holidays families pay thousands of dollars for." },
          { t: "p", text: "It has advantages no rival can easily copy. There is only one Disney World, and the company keeps raising prices and adding capacity, including a large cruise expansion now underway. The parks are how Disney collects on the affection its films and shows create." },
          { t: "p", text: "The weakness is the flip side. A park trip is expensive and easy to postpone, so the business softens quickly when the economy does or household budgets tighten. It is Disney's steadiest profit and its most economically sensitive one at the same time." },
          { t: "refs", items: [
            { label: "Disney parks drive another strong quarter", source: "CNBC", url: "https://finance.yahoo.com/quote/DIS" },
            { label: "Inside Disney's cruise expansion", source: "Bloomberg", url: "https://finance.yahoo.com/quote/DIS/news" },
          ] },
        ],
        source: "Yahoo Finance", date: "Jun 27, 2026", bg: GREEN, ink: CREAM_INK,
      },
      {
        kicker: "The shift",
        headline: "ESPN is going fully streaming.",
        visual: { kind: "stat", value: "$30/mo", label: "for ESPN without a cable box", context: "Its biggest step off the TV bundle." },
        body: "Disney launched a standalone ESPN streaming service, letting people pay for sports without a cable package.",
        deep: [
          { t: "p", text: "Disney launched a standalone ESPN streaming service, letting people watch sports online without paying for a full cable package. It is the biggest strategic move in the company's long shift away from traditional television." },
          { t: "p", text: "Sports is the glue holding the old cable bundle together, the main reason tens of millions of households still pay for cable at all. By selling ESPN directly, Disney is choosing to lead that unbundling rather than be dragged through it." },
          { t: "p", text: "The stakes cut both ways. Cable has been a huge, high-margin profit source that now shrinks every year as people cut the cord. A strong streaming ESPN could replace much of that revenue over time; a weak one would leave a gap, and the transition itself is costly." },
          { t: "refs", items: [
            { label: "ESPN goes direct-to-consumer", source: "The Athletic", url: "https://finance.yahoo.com/quote/DIS" },
            { label: "What ESPN's streaming leap means for Disney", source: "CNBC", url: "https://finance.yahoo.com/quote/DIS/news" },
          ] },
        ],
        source: "The Athletic", date: "Jun 22, 2026", bg: BRASS, ink: "#f8efd8",
      },
      {
        kicker: "More",
        headline: "Everything else on Disney.",
        visual: { kind: "stat", value: "21", label: "stories and clips, from across the sources", context: "Read or watch any right here." },
        body: "The rest of what is being written and filmed about Disney.",
        deep: [
          { t: "feed", title: "Latest", items: [
            { kind: "article", headline: "Disney's box office: a hit and a miss", source: "Variety", date: "Jun 28, 2026", minutes: 4, body: ["A strong summer animated release offset a superhero film that underperformed.", "The studio matters for the stock less as profit and more as fuel for the parks, toys and streaming that follow a hit."] },
            { kind: "video", headline: "Inside Disney's newest cruise ship", source: "CNBC", date: "Jun 24, 2026", minutes: 6, body: ["A tour of the cruise expansion Disney is counting on for its parks growth.", "Cruises carry high margins and lean on the same characters that fill the parks."] },
            { kind: "article", headline: "The succession question at Disney", source: "Bloomberg", date: "Jun 19, 2026", minutes: 5, body: ["Disney is again working through who succeeds chief executive Bob Iger, a process that has unsettled the company before.", "A clean handover would remove one of the biggest uncertainties hanging over the stock."] },
            { kind: "article", headline: "Disney's streaming unit posts a full year of operating profit", source: "CNBC", date: "Jul 8, 2026", minutes: 5, body: ["For years, Disney's streaming business was a money pit. Building Disney+ and Hulu to challenge Netflix meant spending billions on content and technology while charging low prices to win subscribers, and the losses ran deep. That chapter is over.", "The streaming unit has now delivered a profit for four straight quarters. The turn came from a handful of unglamorous moves rather than one big hit: raising prices, cracking down on password sharing, leaning on the cheaper ad-supported tier, and spending more carefully on shows.", "The ad-supported tier matters more than it looks. It now earns more per viewer than the ad-free plan, because the advertising revenue plus the lower price adds up to more than the higher subscription alone. Pushing people toward it has been good for profit.", "Profitability changes how the whole business is judged. As long as streaming lost money, it was a drag the parks had to carry. Now it can stand on its own, and the question shifts from whether it can survive to how much it can eventually earn.", "The parks are still the profit engine, and the old cable-TV networks are still shrinking as viewers cut the cord. But streaming moving from a liability to a contributor removes one of the biggest weights that hung over Disney for years.", "The open question is whether the profit grows or just holds. A single profitable year proves the model works; years of rising streaming profit would prove it is a real second engine alongside the parks."] },
            { kind: "article", headline: "Disney launches a standalone ESPN streaming service", source: "The Wall Street Journal", date: "Jul 5, 2026", minutes: 6, body: ["The direct-to-consumer app lets sports fans subscribe without a cable package, priced at a monthly fee with live games and studio shows."] },
            { kind: "video", headline: "Inside the numbers on Disney's theme-park pricing", source: "Bloomberg", date: "Jul 2, 2026", minutes: 7, body: ["A breakdown of how per-guest spending has climbed even as attendance growth slows."] },
            { kind: "article", headline: "Disney maps a lighter Marvel slate after box-office misses", source: "Variety", date: "Jun 29, 2026", minutes: 6, body: ["The studio said it will release fewer superhero films a year and focus on its established characters."] },
            { kind: "article", headline: "Disney tightens password-sharing rules across Disney+", source: "The Verge", date: "Jun 26, 2026", minutes: 4, body: ["Households outside a subscriber's home will need to pay an extra fee, mirroring a step that lifted Netflix sign-ups."] },
            { kind: "article", headline: "Disney and a partner plan a new theme park in Abu Dhabi", source: "Reuters", date: "Jun 23, 2026", minutes: 5, body: ["The resort would be Disney's seventh and its first in the Middle East, built and run by a local operator under licence."] },
            { kind: "article", headline: "Disney completes its full buyout of Hulu from Comcast", source: "Financial Times", date: "Jun 20, 2026", minutes: 5, body: ["The final valuation settled a long dispute and gives Disney sole control of the streaming service."] },
            { kind: "video", headline: "How Universal's Epic Universe is reshaping the Orlando theme-park race", source: "CNBC", date: "Jun 17, 2026", minutes: 8, body: ["For fifty years, Walt Disney World has ruled Orlando. Universal's new Epic Universe is the most serious challenge it has faced, and this is a look at what the resort means for the theme-park race.", "Epic Universe is Universal's largest park ever, a multi-billion-dollar effort to draw the visitors who would otherwise spend all their days, and dollars, at Disney. More parks in one city can mean longer trips and more total visitors, but it also splits attention and spending in a market Disney long had mostly to itself.", "For Disney the parks are not a side business; they are its profit engine, more than a third of revenue and an even larger share of earnings. Anything that pulls attendance or pricing power away from them matters to the whole company.", "Disney's answer is the one it has always relied on: keep investing. It is pouring money into new rides and lands and a large cruise expansion, using characters no rival can copy to keep guests coming and to justify steadily higher prices.", "The likely outcome is not that one park wins and the other loses, but that a stronger Universal forces Disney to spend more and price more carefully than it did when it had no real rival. For a long-term owner, the parks holding their dominance is one of the things worth watching."] },
            { kind: "article", headline: "Disney raises its cost-cut target as it trims content spending", source: "Barron's", date: "Jun 14, 2026", minutes: 5, body: ["Management said tighter budgets on films and TV would widen margins into next year."] },
            { kind: "article", headline: "Disney sets an Avatar sequel and a live-action reboot for the holidays", source: "Variety", date: "Jun 11, 2026", minutes: 5, body: ["The releases anchor a fourth-quarter slate the studio hopes will lift theatrical results."] },
            { kind: "video", headline: "The economics of ad-supported Disney+", source: "Yahoo Finance", date: "Jun 8, 2026", minutes: 6, body: ["An explainer on why the cheaper, ad-supported tier now earns more per user than the ad-free plan."] },
            { kind: "article", headline: "Disney merchandise sales climb on new franchise tie-ins", source: "Bloomberg", date: "Jul 8, 2026", minutes: 5, body: ["Consumer-products revenue rose as toys and apparel linked to recent hits sold well."] },
            { kind: "article", headline: "Disney+ raises prices again ahead of the holidays", source: "The Wall Street Journal", date: "Jul 5, 2026", minutes: 5, body: ["The increase applies to the ad-free plans, part of a steady effort to lift streaming profit."] },
            { kind: "video", headline: "Riding Disney World's newest attraction", source: "IGN", date: "Jul 2, 2026", minutes: 7, body: ["A walkthrough of the just-opened ride anchoring the park's latest expansion."] },
            { kind: "article", headline: "A Disney animation film wins the box-office weekend", source: "Variety", date: "Jun 29, 2026", minutes: 5, body: ["The studio's latest original topped the charts at its debut, a lift after a string of sequels."] },
            { kind: "article", headline: "Disney extends Bob Iger's contract through 2027", source: "Reuters", date: "Jun 23, 2026", minutes: 5, body: ["The board kept the chief executive in place while the succession search continued."] },
            { kind: "article", headline: "Disney restructures its India business under a joint venture", source: "Financial Times", date: "Jun 20, 2026", minutes: 6, body: ["The company folded its Star India assets into a partnership to compete in the crowded streaming and TV market."] },
            { kind: "article", headline: "Disney cruise bookings run ahead as the fleet grows", source: "Barron's", date: "Jun 17, 2026", minutes: 5, body: ["Strong advance reservations for the new ships pointed to rising demand in the experiences segment."] },
          ] },
        ],
        source: "Multiple sources", date: "Jul 2026", bg: SLATE, ink: "#eef1f8",
      },
    ],
  },
  RBLX: {
    name: "Roblox",
    cards: [
      {
        kicker: "The honest picture",
        headline: "Roblox keeps growing and still loses money.",
        visual: { kind: "stat", value: "~85M", label: "daily users", context: "Growing, but not yet profitable." },
        body: "Roblox has more players than ever, around 85 million a day, and still does not turn a profit.",
        deep: [
          { t: "position", value: "$166.09", gain: "+11% all-time", shares: "2.88 shares of Roblox" },
          { t: "p", text: "Roblox is bigger than it has ever been. About 85 million people log in each day, up from roughly 65 million two years ago, and they spend more hours inside it than before. Yet on paper the company still loses money." },
          { t: "p", text: "Most of that gap is how the money is counted. When someone buys Robux, Roblox's in-game currency, the cash arrives at once but is recorded as revenue slowly, spread over the months a player is expected to keep using it. So reported revenue always trails the cash actually coming in." },
          { t: "table", title: "The numbers, past year", rows: [
            { k: "Daily users", v: "~85 million" },
            { k: "Cash players spent", v: "~$4.4 billion" },
            { k: "Reported revenue", v: "~$3.6 billion" },
            { k: "Cash left after bills", v: "about +$600 million" },
            { k: "Reported result", v: "a loss of ~$1 billion" },
          ] },
          { t: "p", text: "The cash picture has actually turned positive: after paying its bills Roblox now keeps money rather than burning it. The reported loss looks worse mostly because of that delayed accounting and the cost of paying the people who build its games." },
          { t: "chart", title: "Where Roblox's money goes", caption: "Share of spending, approximate", bars: [
            { label: "Creators and app-store fees", value: "48%", frac: 0.48, hot: true },
            { label: "Building the platform", value: "20%", frac: 0.20 },
            { label: "Computers and hosting", value: "18%", frac: 0.18 },
            { label: "Safety, admin, other", value: "14%", frac: 0.14 },
          ] },
          { t: "p", text: "The open question is whether growth and positive cash can turn into an honest profit. Its largest cost, the share it pays the creators who make the games, rises right alongside its success, so scale alone does not close the gap. The next earnings report is in early August." },
          { t: "refs", items: [
            { label: "Roblox tops 85 million daily users as engagement climbs", source: "Yahoo Finance", url: "https://finance.yahoo.com/quote/RBLX" },
            { label: "Bookings vs revenue: how to read a Roblox quarter", source: "The Motley Fool", url: "https://finance.yahoo.com/quote/RBLX/news" },
            { label: "Roblox turns free-cash-flow positive", source: "Bloomberg", url: "https://finance.yahoo.com/quote/RBLX/news" },
          ] },
        ],
        source: "Yahoo Finance", date: "Jul 1, 2026", bg: SLATE, ink: "#eef1f8",
      },
      {
        kicker: "The shift",
        headline: "Roblox is growing up on purpose.",
        visual: { kind: "stat", value: "17+", label: "its fastest-growing age group" },
        body: "Once known for young kids, Roblox now grows fastest among older teens and adults.",
        deep: [
          { t: "p", text: "Roblox began as a place for young children. It is not one anymore. Its fastest-growing group is 17 and older, and most of its players are now over 13." },
          { t: "chart", title: "Roblox players by age", caption: "Share of daily users, approximate", bars: [
            { label: "Under 13", value: "38%", frac: 0.38 },
            { label: "13 to 16", value: "22%", frac: 0.22 },
            { label: "17 to 24", value: "25%", frac: 0.25, hot: true },
            { label: "25 and older", value: "15%", frac: 0.15 },
          ] },
          { t: "p", text: "Older players change the business in two ways. They have their own money to spend, and they are the audience brands will pay to reach. A platform seen as only for kids cannot build much of an advertising business; one with millions of adults can." },
          { t: "p", text: "The risk is the flip side of the same fact. Keeping older users means competing with everything else pulling at their attention, from TikTok to console games. If the content does not grow up with them, they leave as fast as they arrived." },
          { t: "refs", items: [
            { label: "Roblox's audience keeps getting older", source: "The Verge", url: "https://finance.yahoo.com/quote/RBLX" },
            { label: "Why an older user base changes Roblox's economics", source: "Insider Monkey", url: "https://finance.yahoo.com/quote/RBLX/news" },
          ] },
        ],
        source: "The Verge", date: "Jun 26, 2026", bg: GREEN, ink: CREAM_INK,
      },
      {
        kicker: "The next business",
        headline: "Roblox is opening up to advertisers.",
        body: "Roblox is letting brands run ads and build spaces inside its world.",
        deep: [
          { t: "p", text: "For most of its life Roblox earned money one way: players buying Robux to spend inside games. It is now building a second way, letting brands advertise." },
          { t: "p", text: "The ads are not banners. Companies build spaces inside Roblox, a virtual store, a game tied to a film, and can run image and video ads between experiences. Nike, Walmart and others have already tried it." },
          { t: "p", text: "The prize is real money that does not depend on selling more Robux, and it leans on the older audience Roblox has been gaining. The catch is that it is early. Brand budgets move slowly, and it is not yet proven that advertisers will treat Roblox the way they treat Instagram or YouTube." },
          { t: "refs", items: [
            { label: "Roblox opens its world to advertisers", source: "Insider Monkey", url: "https://finance.yahoo.com/quote/RBLX" },
            { label: "The brands already building on Roblox", source: "AdWeek", url: "https://finance.yahoo.com/quote/RBLX/news" },
          ] },
        ],
        source: "Insider Monkey", date: "Jun 21, 2026", bg: BRASS, ink: "#f8efd8",
      },
      {
        kicker: "The risk",
        headline: "Safety is Roblox's biggest question.",
        body: "With so many young users, how Roblox keeps them safe is its most watched issue.",
        deep: [
          { t: "p", text: "A platform this large and this young draws hard scrutiny, and safety is the issue that could hurt Roblox most. Regulators, parents and lawsuits have all pressed it on how it protects children." },
          { t: "p", text: "Roblox has answered with age checks that estimate how old a user is, tighter controls for parents, and moderation of chat and content across billions of messages. It also limits what the youngest accounts can see and do." },
          { t: "p", text: "The stakes are plain. Getting safety right is both the decent thing and a cost that climbs with every new user. Getting it wrong, a serious failure or a harsh new law, would hit the trust the whole platform runs on, and trust is far harder to rebuild than revenue." },
          { t: "refs", items: [
            { label: "Roblox tightens age checks and parental controls", source: "Reuters", url: "https://finance.yahoo.com/quote/RBLX" },
            { label: "How Roblox moderates a platform of millions of children", source: "The New York Times", url: "https://finance.yahoo.com/quote/RBLX/news" },
          ] },
        ],
        source: "Reuters", date: "Jun 18, 2026", bg: RED, ink: "#f6ece6",
      },
      {
        kicker: "More",
        headline: "Everything else on Roblox.",
        visual: { kind: "stat", value: "22", label: "stories and clips, from across the sources", context: "Read or watch any right here." },
        body: "The rest of what is being written and filmed about Roblox.",
        deep: [
          { t: "feed", title: "Latest", items: [
            { kind: "video", headline: "How Roblox actually makes its money", source: "CNBC", date: "Jun 27, 2026", minutes: 6, body: ["Roblox looks like one game but is really a platform: millions of games built by outside creators, all running inside one app. Understanding how it makes money means following a single currency, Robux.", "Players buy Robux with real money, then spend it inside games on outfits, upgrades, access, whatever creators sell. When they do, Roblox takes a cut and passes the rest to the creator who built the experience. That split is the heart of the business.", "The catch is that Roblox keeps less of each dollar than it first appears. A large share goes to the creators, who are the reason players show up at all, and another slice goes to Apple and Google as the fee for selling Robux through their app stores. What is left has to cover the computers, the safety systems and everything else.", "This is also why the reported numbers can look strange. When someone buys Robux, Roblox gets the cash immediately but records it as revenue slowly, spread over the months a player is expected to keep using it. So the money coming in, called bookings, runs ahead of the revenue on the income statement.", "That gap is why bookings, not revenue, is the number analysts watch most closely. It is the truest near-term read on how much players are actually spending.", "The model has a built-in tension. Roblox grows by paying creators more, which draws better games and more players, but paying creators more is also its single largest cost. Reaching a real profit means growing the whole pie faster than that cost rises. That, more than user growth, is the question hanging over the company."] },
            { kind: "article", headline: "Creators earned a record sum on Roblox", source: "The Verge", date: "Jun 23, 2026", minutes: 3, body: ["The people who build games inside Roblox took home more than ever this year.", "A healthy creator economy is what keeps players coming back and the platform growing."] },
            { kind: "article", headline: "New safety controls arrive for younger players", source: "Reuters", date: "Jun 17, 2026", minutes: 4, body: ["Roblox rolled out tighter age checks and parental controls.", "The changes answer regulators and, if they work, protect the trust the platform runs on."] },
            { kind: "article", headline: "Roblox daily active users pass 100 million", source: "CNBC", date: "Jul 7, 2026", minutes: 5, body: ["The platform reported a new record for daily players, with the fastest growth outside the United States."] },
            { kind: "article", headline: "Roblox's older users now outnumber its youngest", source: "Bloomberg", date: "Jul 4, 2026", minutes: 6, body: ["Players over 17 became the largest age group, a shift the company says opens the door to advertising and commerce."] },
            { kind: "video", headline: "How brands are building stores inside Roblox", source: "The Verge", date: "Jul 1, 2026", minutes: 7, body: ["A tour of the virtual retail spaces from Nike, Walmart and others as the platform expands its ad business."] },
            { kind: "article", headline: "Roblox bookings rise while revenue lags on deferral accounting", source: "Barron's", date: "Jun 28, 2026", minutes: 6, body: ["The gap reflects how the company recognises virtual-currency sales over time, a figure analysts watch closely."] },
            { kind: "article", headline: "Roblox narrows losses and reaffirms its path to free cash flow", source: "Reuters", date: "Jun 25, 2026", minutes: 5, body: ["Management said tighter infrastructure spending is bringing the company closer to sustained positive cash flow."] },
            { kind: "video", headline: "Testing Roblox's AI tool that builds a game from a text prompt", source: "TechCrunch", date: "Jun 22, 2026", minutes: 7, body: ["A demo of the assistant that generates scenes, scripts and characters from plain-language instructions."] },
            { kind: "article", headline: "Roblox partners with Netflix to bring shows into the platform", source: "Variety", date: "Jun 19, 2026", minutes: 5, body: ["The deal adds branded experiences tied to popular series, part of Roblox's push into entertainment tie-ins."] },
            { kind: "article", headline: "Roblox faces a new state lawsuit over child-safety claims", source: "The Wall Street Journal", date: "Jun 16, 2026", minutes: 6, body: ["A US state attorney general has sued Roblox, alleging the platform did not do enough to protect children from predators and harmful content. Roblox disputes the claim. It is the latest and most serious form of a risk that hangs over the whole company.", "The issue is inseparable from what Roblox is. Tens of millions of its users are children, gathered on a platform where anyone can build a game and chat with others. That openness is the source of its growth and the source of its danger.", "Roblox has responded over the years with a growing safety apparatus: age checks that estimate how old a user is, tighter controls for parents, limits on what the youngest accounts can do, and moderation of chat and content across billions of messages. The lawsuit argues that it still falls short.", "The financial stakes are real but indirect. A single lawsuit is unlikely to dent a company this size directly. The deeper risk is to trust and to regulation: a serious, well-publicised failure, or a harsh new child-safety law, could force costly changes and drive away the parents who let their children play.", "This is why safety, not growth or profit, is often called the central question for Roblox. Getting it right is both the decent thing and an ever-rising cost; getting it badly wrong is the one problem that could undermine everything else."] },
            { kind: "article", headline: "Roblox comes to PlayStation as it widens its device reach", source: "IGN", date: "Jun 13, 2026", minutes: 4, body: ["The launch adds another console after earlier expansions, broadening the platform's audience."] },
            { kind: "article", headline: "Roblox pays developers a record sum as its creator economy grows", source: "The Information", date: "Jun 10, 2026", minutes: 6, body: ["Top studios on the platform are building larger teams as annual payouts to creators climb."] },
            { kind: "video", headline: "The hit user-made game topping Roblox this summer", source: "IGN", date: "Jun 7, 2026", minutes: 6, body: ["A look at the breakout title drawing tens of millions of players, and its small development team."] },
            { kind: "article", headline: "Roblox hours-engaged rise faster than user growth", source: "Bloomberg", date: "Jul 7, 2026", minutes: 5, body: ["Players spent more time on the platform, a metric the company ties to future spending and ad inventory."] },
            { kind: "video", headline: "Inside a live virtual concert on Roblox", source: "The Verge", date: "Jul 4, 2026", minutes: 6, body: ["A look at the in-game show that drew millions of concurrent viewers and tied into music sales."] },
            { kind: "article", headline: "Roblox partners with Spotify to bring music into experiences", source: "TechCrunch", date: "Jul 1, 2026", minutes: 5, body: ["The deal lets developers add licensed tracks and connects artist pages to in-game spaces."] },
            { kind: "article", headline: "Roblox rolls out age-estimation technology for accounts", source: "The Wall Street Journal", date: "Jun 28, 2026", minutes: 6, body: ["The system uses facial analysis to sort users into age groups and tailor safety settings."] },
            { kind: "article", headline: "Roblox expands into classrooms with education tools", source: "The Information", date: "Jun 25, 2026", minutes: 6, body: ["The company released curriculum-linked experiences aimed at teaching coding and design in schools."] },
            { kind: "article", headline: "Roblox raises its guidance on stronger bookings", source: "Reuters", date: "Jun 22, 2026", minutes: 5, body: ["Management lifted its outlook for the year, citing higher spending and international growth."] },
            { kind: "video", headline: "A celebrity's custom Roblox world draws a crowd", source: "Variety", date: "Jun 19, 2026", minutes: 6, body: ["A tour of the branded experience built around a pop star and its tie-in merchandise."] },
            { kind: "article", headline: "Roblox pushes deeper into Japan with localised experiences", source: "Nikkei", date: "Jun 16, 2026", minutes: 5, body: ["The company added local partners and payment options to grow in one of gaming's largest markets."] },
          ] },
        ],
        source: "Multiple sources", date: "Jul 2026", bg: SLATE, ink: "#eef1f8",
      },
    ],
  },
  NTDOY: {
    name: "Nintendo",
    cards: [
      {
        kicker: "The big one",
        headline: "The Switch 2 is selling fast.",
        visual: { kind: "stat", value: "6M", label: "units sold in the first month", context: "The fastest console launch in Nintendo's history." },
        body: "Nintendo's new console, the Switch 2, had the fastest launch the company has ever seen.",
        deep: [
          { t: "position", value: "$135", gain: "+35% all-time", shares: "12.41 shares of Nintendo" },
          { t: "p", text: "The original Switch sold more than 140 million units over its life. Its successor, the Switch 2, has launched faster than any Nintendo console before it, which sets up years of game and subscription sales to follow." },
          { t: "p", text: "Nintendo makes most of its money when people buy games for hardware they already own, so a fast-selling console is the base for everything after. The risk is the mirror of Google's: Nintendo leans on hit games and new hardware every few years, not steady subscriptions." },
          { t: "refs", items: [
            { label: "Switch 2 sets a console launch record", source: "Bloomberg", url: "https://finance.yahoo.com/quote/NTDOY" },
            { label: "What the Switch 2 means for Nintendo's next few years", source: "IGN", url: "https://finance.yahoo.com/quote/NTDOY/news" },
          ] },
        ],
        source: "Bloomberg", date: "Jul 1, 2026", bg: RED, ink: "#f6ece6",
      },
      {
        kicker: "The new profit line",
        headline: "Nintendo's characters are on the big screen.",
        visual: { kind: "stat", value: "$1B+", label: "box office for the first Mario film", context: "And Nintendo wants more of it." },
        body: "After the success of its Mario film, Nintendo is turning more of its characters into movies and theme-park attractions.",
        deep: [
          { t: "p", text: "Nintendo owns some of the most valuable characters in entertainment, Mario, Zelda, Pokemon, and for most of its history it only put them in games. The Mario movie changed that. It earned well over a billion dollars at the box office, and Nintendo is now building films, theme-park areas and more around its characters." },
          { t: "p", text: "The appeal is that these earn money from characters Nintendo already owns, without the cost and risk of new hardware. A film also draws fresh players back to the games, the way Disney's movies feed its parks and toys." },
          { t: "p", text: "It stays small next to games, and Nintendo guards these characters carefully rather than over-exposing them. But it turns a library built over forty years into a second, steadier source of income." },
          { t: "refs", items: [
            { label: "The Mario movie crosses $1 billion", source: "Variety", url: "https://finance.yahoo.com/quote/NTDOY" },
            { label: "Nintendo's plan for its characters beyond games", source: "Bloomberg", url: "https://finance.yahoo.com/quote/NTDOY/news" },
          ] },
        ],
        source: "Variety", date: "Jun 25, 2026", bg: GREEN, ink: CREAM_INK,
      },
      {
        kicker: "The temperament",
        headline: "A cautious, cash-rich company.",
        visual: { kind: "stat", value: "~$10B", label: "in cash, with almost no debt" },
        body: "Nintendo sits on billions in cash, carries little debt, and moves slowly and deliberately.",
        deep: [
          { t: "p", text: "Nintendo runs itself unlike most of the industry. It sits on a large cash pile, carries almost no debt, and rarely chases whatever the rest of gaming is chasing." },
          { t: "table", title: "The shape of the company", rows: [
            { k: "Cash on hand", v: "billions, little debt" },
            { k: "Switch consoles sold", v: "over 140 million" },
            { k: "Best-known franchises", v: "Mario, Zelda, Pokemon" },
          ] },
          { t: "p", text: "That caution cuts both ways. It lets Nintendo absorb a weak year, or even a weak console, without strain, and wait for the right idea rather than ship a rushed one. It also means growth arrives in jumps, tied to a new console or a hit game, rather than the steady climb many investors prefer." },
          { t: "p", text: "The same conservatism shows up in how slowly it has embraced mobile games and online services, areas where rivals moved years earlier. Nintendo tends to arrive late and on its own terms." },
          { t: "refs", items: [
            { label: "Inside Nintendo's cautious, cash-rich playbook", source: "Bloomberg", url: "https://finance.yahoo.com/quote/NTDOY" },
            { label: "Why Nintendo keeps so much cash on hand", source: "Reuters", url: "https://finance.yahoo.com/quote/NTDOY/news" },
          ] },
        ],
        source: "Yahoo Finance", date: "Jun 20, 2026", bg: BRASS, ink: "#f8efd8",
      },
      {
        kicker: "More",
        headline: "Everything else on Nintendo.",
        visual: { kind: "stat", value: "21", label: "stories and clips, from across the sources", context: "Read or watch any right here." },
        body: "The rest of what is being written and filmed about Nintendo.",
        deep: [
          { t: "feed", title: "Latest", items: [
            { kind: "video", headline: "Switch 2 review: what is new", source: "IGN", date: "Jun 28, 2026", minutes: 8, body: ["A full review of the console: the bigger screen, the faster chip, and the launch games.", "The verdict is less about the specs and more about the games only Nintendo makes."] },
            { kind: "article", headline: "Nintendo's online service passes a milestone", source: "The Verge", date: "Jun 22, 2026", minutes: 3, body: ["The paid online subscription that comes with the Switch keeps growing.", "It is the closest thing Nintendo has to the steady, recurring revenue investors prize."] },
            { kind: "article", headline: "Switch 2 sets a record with 6 million units sold in its first month", source: "Nikkei", date: "Jul 8, 2026", minutes: 5, body: ["Nintendo's new console, the Switch 2, sold about 6 million units in its first month, the fastest start of any console in the company's history and ahead of the original Switch's launch pace.", "The number matters because of how Nintendo makes money. The console itself earns little; the profit comes later, when the tens of millions of people who own the hardware buy games for it, most of them made by Nintendo. A fast-selling console is the foundation for years of high-margin software and subscription sales.", "The original Switch sold more than 140 million units across its life and carried the company for the better part of a decade. A successor that launches even faster sets up the same long tail, this time with a bigger, faster machine that makes it easier for outside studios to bring their games too.", "Supply was the main limit, not demand. Consoles and accessories sold out in several markets, and Nintendo has said it is working to raise production as component shortages ease. The shortfall leaves some early sales on the table but points to demand running ahead of supply.", "The launch lineup did its job. A new 3D Mario and a remastered Zelda gave buyers a reason to upgrade on day one, and Nintendo has already dated more marquee titles for the console's first year.", "The risk sits on the other side of Nintendo's strength. Unlike a company built on steady subscriptions, it leans on hit games and new hardware every few years, so its results move in jumps. The Switch 2's fast start is the clearest sign yet that this cycle is set up to be a good one."] },
            { kind: "video", headline: "Reviewing the Switch 2 launch lineup", source: "IGN", date: "Jul 5, 2026", minutes: 8, body: ["A rundown of the Mario and remastered Zelda titles anchoring the new console's first weeks."] },
            { kind: "article", headline: "A second Super Mario animated film gets a 2027 release date", source: "Variety", date: "Jul 2, 2026", minutes: 5, body: ["Nintendo and Illumination set the sequel to their billion-dollar hit for the spring holiday window."] },
            { kind: "article", headline: "Pokemon remains the world's highest-grossing media franchise", source: "Bloomberg", date: "Jun 29, 2026", minutes: 6, body: ["New figures confirm what has quietly been true for years: Pokemon is the highest-grossing media franchise in the world, ahead of Star Wars, Marvel, Mickey Mouse and every other entertainment property.", "The striking part is where the money comes from. Only a slice is video games. The rest is trading cards, which have boomed into a multi-billion-dollar business of their own, plus movies, TV, toys and licensing deals stamped on everything from clothing to aeroplanes.", "Pokemon sits in an unusual place in Nintendo's structure. It is run by a separate company, The Pokemon Company, which Nintendo co-owns alongside the two other firms that created the franchise. So Nintendo does not keep all of Pokemon's earnings, but it benefits enormously, both from its share and from the way Pokemon games sell Nintendo hardware.", "That is the quiet strategic point. A child who wants the new Pokemon game needs a Nintendo console to play it. Franchises like Pokemon, Mario and Zelda are the reason people buy the hardware in the first place, which is where Nintendo's real profits are made.", "It also shows the durability underneath a company that looks cyclical. Console sales rise and fall, but the value of characters built up over thirty years compounds quietly in the background, earning across cards, films and parks whatever the current hardware is doing."] },
            { kind: "article", headline: "Nintendo announces its first-ever share buyback", source: "Reuters", date: "Jun 26, 2026", minutes: 5, body: ["The company said it would return part of its large cash reserve to investors, a rare step for the Kyoto firm."] },
            { kind: "video", headline: "A visit to the Nintendo Museum outside Kyoto", source: "The Verge", date: "Jun 23, 2026", minutes: 7, body: ["A tour of the exhibits tracing the company's history from playing cards to the Switch."] },
            { kind: "article", headline: "Third-party publishers line up bigger support for the Switch 2", source: "IGN", date: "Jun 20, 2026", minutes: 5, body: ["Major studios said the more powerful hardware makes it easier to bring current-generation games to the console."] },
            { kind: "article", headline: "Nintendo keeps its mobile strategy deliberately small, executives say", source: "Financial Times", date: "Jun 17, 2026", minutes: 6, body: ["Leaders reiterated that smartphone games serve mainly to draw players toward the console rather than drive profit."] },
            { kind: "article", headline: "A new Donkey Kong area opens at Universal's theme parks", source: "Associated Press", date: "Jun 14, 2026", minutes: 4, body: ["The expansion adds to the Nintendo-themed attractions built with Universal under a licensing deal."] },
            { kind: "article", headline: "A new mainline Zelda title is dated for the holidays", source: "IGN", date: "Jun 11, 2026", minutes: 5, body: ["Nintendo set the next entry in the series as a marquee release for the Switch 2's first holiday season."] },
            { kind: "video", headline: "How Nintendo protects its characters in court", source: "Nikkei", date: "Jun 8, 2026", minutes: 6, body: ["An explainer on the company's aggressive defence of its intellectual property against emulators and clones."] },
            { kind: "article", headline: "Nintendo posts a quarterly earnings beat on Switch 2 demand", source: "Nikkei", date: "Jul 8, 2026", minutes: 5, body: ["Strong console and software sales pushed profit above analyst forecasts in the console's first full quarter."] },
            { kind: "video", headline: "Everything from the latest Nintendo Direct", source: "IGN", date: "Jul 5, 2026", minutes: 8, body: ["A recap of the showcase, including new first-party titles and release dates for the Switch 2."] },
            { kind: "article", headline: "A new Metroid title is set for later this year", source: "IGN", date: "Jul 2, 2026", minutes: 5, body: ["Nintendo dated the next entry in the series as a marquee Switch 2 release."] },
            { kind: "article", headline: "Digital sales make up a growing share of Nintendo's software revenue", source: "Bloomberg", date: "Jun 29, 2026", minutes: 6, body: ["More players bought games through the eShop, lifting the higher-margin part of the business."] },
            { kind: "article", headline: "Nintendo raises its annual dividend after a strong year", source: "Reuters", date: "Jun 26, 2026", minutes: 4, body: ["The company lifted its payout as Switch 2 sales boosted cash flow."] },
            { kind: "article", headline: "New Switch 2 accessories sell out at launch", source: "The Verge", date: "Jun 23, 2026", minutes: 4, body: ["Controllers and docks were in short supply as demand for the console's add-ons ran high."] },
            { kind: "article", headline: "Nintendo says its hardware shortages are easing", source: "Nikkei", date: "Jun 20, 2026", minutes: 5, body: ["The company reported improved component supply, allowing it to raise console shipment plans."] },
            { kind: "video", headline: "Hands-on with the new Kirby game on Switch 2", source: "IGN", date: "Jun 17, 2026", minutes: 7, body: ["A preview of the platformer built to show off the new console's hardware."] },
          ] },
        ],
        source: "Multiple sources", date: "Jul 2026", bg: SLATE, ink: "#eef1f8",
      },
    ],
  },
  MCD: {
    name: "McDonald's",
    cards: [
      {
        kicker: "The move",
        headline: "McDonald's is leaning on value again.",
        visual: { kind: "stat", value: "$5 meal", label: "the value deal it brought back", context: "To win back price-conscious diners." },
        body: "After a stretch of price rises, McDonald's brought back cheap combo deals to pull customers back in.",
        deep: [
          { t: "position", value: "$60.54", gain: "+21% all-time", shares: "0.22 shares of McDonald's" },
          { t: "p", text: "Years of price increases pushed some customers away, especially lower-income diners, and traffic slipped. McDonald's answer is a return to value, cheaper combo deals meant to bring people back through the door more often." },
          { t: "p", text: "Most of McDonald's profit does not come from selling burgers directly. About 95 percent of its restaurants are run by franchisees who pay McDonald's rent and a share of sales, so it earns steady money as a landlord and brand owner more than as a cook." },
          { t: "refs", items: [
            { label: "McDonald's brings back value meals to win back diners", source: "Reuters", url: "https://finance.yahoo.com/quote/MCD" },
            { label: "How the McDonald's franchise model really works", source: "CNBC", url: "https://finance.yahoo.com/quote/MCD/news" },
          ] },
        ],
        source: "Reuters", date: "Jul 1, 2026", bg: BRASS, ink: "#f8efd8",
      },
      {
        kicker: "A long streak",
        headline: "49 straight years of dividend raises.",
        visual: { kind: "stat", value: "49 years", label: "of raising the dividend, every year" },
        body: "McDonald's has raised its dividend every year for almost half a century.",
        deep: [
          { t: "p", text: "McDonald's has raised its dividend every single year since it began paying one in 1976, a streak of about 49 years. A company that lifts its payout through recessions, inflation shocks and a pandemic is signalling unusually steady, dependable cash." },
          { t: "p", text: "That steadiness comes from how McDonald's is built. It collects rent and a share of sales from thousands of franchised restaurants, income that holds up even in hard times, because people trade down to cheaper food rather than stop eating out." },
          { t: "p", text: "One more annual increase would put McDonald's in the small circle of companies with a 50-year raising streak, a group investors treat as the bluest of blue chips." },
          { t: "refs", items: [
            { label: "McDonald's extends its dividend-raise streak to 49 years", source: "TheStreet", url: "https://finance.yahoo.com/quote/MCD" },
            { label: "The companies closing in on 50-year dividend streaks", source: "The Motley Fool", url: "https://finance.yahoo.com/quote/MCD/news" },
          ] },
        ],
        source: "TheStreet", date: "Jun 24, 2026", bg: GREEN, ink: CREAM_INK,
      },
      {
        kicker: "The scale",
        headline: "The world's largest restaurant company.",
        visual: { kind: "stat", value: "~43,000", label: "restaurants in over 100 countries", context: "Most of them outside the United States." },
        body: "McDonald's runs about 43,000 restaurants in more than 100 countries, most of them outside the US.",
        deep: [
          { t: "p", text: "McDonald's is the largest restaurant company on earth by a wide margin, roughly 43,000 locations serving tens of millions of people a day. Most of those restaurants, and most of its growth, are now outside the United States." },
          { t: "p", text: "That global spread steadies the business. A weak year in one country tends to be offset by strength in others, though it also means currency swings and foreign economies feed into the results. The US market is largely built out, so new restaurants increasingly open abroad." },
          { t: "p", text: "The brand also holds up in hard times better than most. When money is tight, people trade down to cheaper meals rather than stop eating out, which can send some customers toward McDonald's rather than away. Investors treat the stock as a defensive holding for that reason." },
          { t: "refs", items: [
            { label: "McDonald's by the numbers: a global footprint", source: "Yahoo Finance", url: "https://finance.yahoo.com/quote/MCD" },
            { label: "Why McDonald's tends to hold up in downturns", source: "Barron's", url: "https://finance.yahoo.com/quote/MCD/news" },
          ] },
        ],
        source: "Yahoo Finance", date: "Jun 22, 2026", bg: AMBER, ink: "#f7efdc",
      },
      {
        kicker: "More",
        headline: "Everything else on McDonald's.",
        visual: { kind: "stat", value: "21", label: "stories and clips, from across the sources", context: "Read or watch any right here." },
        body: "The rest of what is being written and filmed about McDonald's.",
        deep: [
          { t: "feed", title: "Latest", items: [
            { kind: "article", headline: "McDonald's tests AI ordering at the drive-through", source: "CNBC", date: "Jun 27, 2026", minutes: 4, body: ["McDonald's is trying AI voice ordering to speed up its busiest lane.", "Small savings per order add up fast across tens of thousands of restaurants."] },
            { kind: "video", headline: "Why McDonald's is really a real-estate company", source: "Bloomberg", date: "Jun 21, 2026", minutes: 7, body: ["McDonald's sells burgers, but that is not mainly how it makes money. Look at the accounts and a large share of its profit comes from rent. This is the explanation.", "About 95 percent of McDonald's restaurants are not run by McDonald's. They are run by franchisees, independent operators who pay to use the brand, the system and, crucially, the building. McDonald's often owns the land and the restaurant itself and leases it to the operator.", "So McDonald's collects two things from most of its restaurants: a royalty, a percentage of the sales, and rent on the property. The franchisee takes on the day-to-day cost and risk of running the place; McDonald's earns a steadier, landlord-like income on top.", "This is why the company holds up so well when times get hard. Rent and royalties keep coming even in a weak year, and because people trade down to cheaper food rather than stop eating out, a downturn can even send some customers toward McDonald's. The income is far steadier than a business that has to earn every dollar at the counter.", "It is also the quiet engine behind the dividend. A company with dependable, property-backed cash flow can keep raising its payout year after year, which McDonald's has done for nearly half a century.", "The trade-off is that this model grows slowly and deliberately. McDonald's cannot flip a switch to earn more; growth comes from opening more restaurants, mostly abroad now, and lifting sales at the ones it already has."] },
            { kind: "article", headline: "McDonald's rolls out a national value meal to win back diners", source: "CNBC", date: "Jul 7, 2026", minutes: 5, body: ["McDonald's has rolled out a national value meal across its US restaurants, a low-price combo aimed at winning back customers after several quarters of softer traffic.", "The problem it answers is specific. Years of price increases, driven by higher costs for food and labour, pushed McDonald's prices up faster than many customers were comfortable with, and lower-income diners in particular started visiting less or trading down to rivals.", "Value has always been the core of the McDonald's promise, so a return to cheap, simple deals is a return to form more than a new idea. The aim is to bring people back through the door more often, on the logic that a smaller profit on more visits beats a bigger profit on fewer.", "There is a tension with the franchise model, though. Because independent operators run most restaurants and carry the cost of these deals, aggressive discounting can strain the relationship with the franchisees whose margins it squeezes. McDonald's has to balance winning back diners against keeping its operators healthy.", "The early read matters for the whole business, since the US is its largest single market and traffic there had been the soft spot. If value brings customers back without hurting franchisee economics too much, it steadies the part of McDonald's that had been wobbling."] },
            { kind: "article", headline: "McDonald's raises its dividend for a 49th straight year", source: "Barron's", date: "Jul 4, 2026", minutes: 4, body: ["The increase keeps the chain on track to join the small group of companies with a half-century of higher payouts."] },
            { kind: "article", headline: "McDonald's crosses 44,000 restaurants as it speeds up openings", source: "Reuters", date: "Jul 1, 2026", minutes: 5, body: ["Most new locations are in China and other international markets, part of a plan to reach 50,000 by the decade's end."] },
            { kind: "video", headline: "Inside McDonald's push to sell more drinks", source: "Bloomberg", date: "Jun 28, 2026", minutes: 6, body: ["A look at the beverage-focused menu and the standalone CosMc's stores aimed at afternoon sales."] },
            { kind: "article", headline: "McDonald's global same-store sales edge higher on international demand", source: "The Wall Street Journal", date: "Jun 25, 2026", minutes: 5, body: ["Growth abroad offset flat US results as the company competed on price."] },
            { kind: "article", headline: "McDonald's franchisees push back on rising fees and remodel costs", source: "Financial Times", date: "Jun 22, 2026", minutes: 6, body: ["Operators voiced concern over the expense of required upgrades amid thinner margins."] },
            { kind: "article", headline: "McDonald's expands its loyalty app to more markets", source: "Yahoo Finance", date: "Jun 19, 2026", minutes: 4, body: ["The programme now counts more than 175 million active members, a growing channel for personalised deals."] },
            { kind: "video", headline: "Why McDonald's holds up when spending slows", source: "CNBC", date: "Jun 16, 2026", minutes: 7, body: ["An explainer on the chain's low prices and franchise model during a consumer pullback."] },
            { kind: "article", headline: "McDonald's tests new chicken items to counter rival launches", source: "Associated Press", date: "Jun 13, 2026", minutes: 5, body: ["The additions target the fast-growing chicken segment where competitors have gained share."] },
            { kind: "article", headline: "McDonald's deepens delivery ties with DoorDash and Uber Eats", source: "Reuters", date: "Jun 10, 2026", minutes: 5, body: ["Expanded partnerships aim to lift off-premise orders, now a large slice of sales."] },
            { kind: "article", headline: "McDonald's shelves its plant-based burger after weak US demand", source: "Bloomberg", date: "Jun 7, 2026", minutes: 5, body: ["The company ended a trial of the meat-free sandwich, citing limited interest from American customers."] },
            { kind: "article", headline: "McDonald's leans on breakfast to lift morning traffic", source: "CNBC", date: "Jul 7, 2026", minutes: 5, body: ["The chain rolled out new morning items and deals to defend a daypart facing tougher competition."] },
            { kind: "video", headline: "The latest McDonald's celebrity meal breaks sales records", source: "Bloomberg", date: "Jul 4, 2026", minutes: 6, body: ["A look at the promotion built around a music star and how limited menus drive traffic."] },
            { kind: "article", headline: "McDonald's expands McCafe as coffee competition heats up", source: "The Wall Street Journal", date: "Jul 1, 2026", minutes: 5, body: ["The company added drinks and remodelled cafe spaces to take on chains focused on beverages."] },
            { kind: "article", headline: "Digital orders top 30% of McDonald's sales in top markets", source: "Reuters", date: "Jun 28, 2026", minutes: 5, body: ["Growth in app, kiosk and delivery orders reshaped how the chain reaches customers."] },
            { kind: "article", headline: "McDonald's speeds up drive-through service with new technology", source: "Yahoo Finance", date: "Jun 25, 2026", minutes: 5, body: ["The company said upgrades trimmed wait times, a key measure for the format that drives most US sales."] },
            { kind: "article", headline: "An analyst upgrades McDonald's on resilient international sales", source: "Barron's", date: "Jun 22, 2026", minutes: 4, body: ["A Wall Street firm raised its rating, pointing to steady demand abroad and the chain's low prices."] },
            { kind: "article", headline: "McDonald's shifts to recyclable packaging across more markets", source: "Associated Press", date: "Jun 19, 2026", minutes: 5, body: ["The rollout is part of a broader plan to cut waste from its restaurants worldwide."] },
            { kind: "video", headline: "Inside a remodelled McDonald's built around self-order kiosks", source: "CNBC", date: "Jun 16, 2026", minutes: 6, body: ["A tour of the updated restaurant design that leans on digital ordering and a smaller front counter."] },
          ] },
        ],
        source: "Multiple sources", date: "Jul 2026", bg: SLATE, ink: "#eef1f8",
      },
    ],
  },
  VXUS: {
    name: "international stocks",
    cards: [
      {
        kicker: "The turn",
        headline: "International stocks are beating the US this year.",
        visual: { kind: "stat", value: "+16%", label: "international stocks, 2026 so far", context: "Ahead of the US for the first time in years." },
        body: "Stocks outside the US have outpaced American ones this year, a change after years of lagging.",
        deep: [
          { t: "position", value: "$4,814", gain: "+65% all-time", shares: "55.85 shares of VXUS" },
          { t: "p", text: "This fund holds companies outside the United States, thousands of them across Europe, Japan, emerging markets and beyond. For over a decade US stocks left the rest of the world behind. In 2026 that has flipped, with international markets pulling ahead." },
          { t: "chart", title: "Where the fund is invested", caption: "Share of the fund, approximate", bars: [
            { label: "Europe", value: "40%", frac: 0.40, hot: true },
            { label: "Japan and Pacific", value: "27%", frac: 0.27 },
            { label: "Emerging markets", value: "25%", frac: 0.25 },
            { label: "Canada, other", value: "8%", frac: 0.08 },
          ] },
          { t: "p", text: "Two things are helping: international stocks trade cheaper than US ones, and a weaker US dollar makes foreign holdings worth more once converted back into dollars. Owning outside the US is how a portfolio avoids riding on one country alone." },
          { t: "refs", items: [
            { label: "International stocks outpace the US in 2026", source: "Morningstar", url: "https://finance.yahoo.com/quote/VXUS" },
            { label: "Why a weaker dollar lifts foreign holdings", source: "Bloomberg", url: "https://finance.yahoo.com/quote/VXUS/news" },
          ] },
        ],
        source: "Morningstar", date: "Jul 1, 2026", bg: BLUE, ink: "#eaf1fb",
      },
      {
        kicker: "Who is leading",
        headline: "Europe and Japan are out front.",
        body: "European and Japanese markets have led the international gains this year.",
        deep: [
          { t: "p", text: "This year's gains in international stocks have been led by Europe and Japan. Both had spent years overshadowed by US markets, and both are now drawing money back." },
          { t: "p", text: "Europe has been helped by cheaper starting valuations and steadier-than-feared growth, with strong runs in banks, defence and industrial companies. Japan is in the middle of a genuine shift: companies long criticised for hoarding cash are under pressure to reform and return money to shareholders, and investors have noticed." },
          { t: "p", text: "Because this fund holds thousands of companies across every major region, no single country decides its year. When the US leads, the fund captures that; when Europe or Japan leads, as now, it captures that too." },
          { t: "refs", items: [
            { label: "Europe and Japan lead a global stock rally", source: "Reuters", url: "https://finance.yahoo.com/quote/VXUS" },
            { label: "Japan's corporate reforms draw investors back", source: "Bloomberg", url: "https://finance.yahoo.com/quote/VXUS/news" },
          ] },
        ],
        source: "Reuters", date: "Jun 26, 2026", bg: GREEN, ink: CREAM_INK,
      },
      {
        kicker: "The currency piece",
        headline: "A weaker dollar is a tailwind.",
        visual: { kind: "trend", up: true, value: "weaker $", label: "the US dollar, 2026" },
        body: "The US dollar has slipped this year, which quietly raises the value of stocks held in other currencies.",
        deep: [
          { t: "p", text: "The US dollar has weakened this year, and for a fund that holds foreign stocks that is quietly a tailwind. The companies here earn in euros, yen, pounds and other currencies, and those earnings convert into more dollars when the dollar falls." },
          { t: "p", text: "So an international fund can rise for two separate reasons at once: the foreign stocks going up in their own currency, and those currencies strengthening against the dollar. This year both have been working in the same direction." },
          { t: "p", text: "It cuts the other way too. A rising dollar would shave the returns from foreign holdings even if the stocks themselves held steady. Currency is a real part of owning outside the US, and one of the reasons a global fund behaves differently from a US one." },
          { t: "refs", items: [
            { label: "A weaker dollar lifts international returns", source: "Bloomberg", url: "https://finance.yahoo.com/quote/VXUS" },
            { label: "How currency moves affect foreign stock funds", source: "Morningstar", url: "https://finance.yahoo.com/quote/VXUS/news" },
          ] },
        ],
        source: "Bloomberg", date: "Jun 20, 2026", bg: AMBER, ink: "#f7efdc",
      },
      {
        kicker: "More",
        headline: "Everything else, international.",
        visual: { kind: "stat", value: "23", label: "stories and clips, from across the sources", context: "Read or watch any right here." },
        body: "The rest of what is moving markets outside the US.",
        deep: [
          { t: "feed", title: "Latest", items: [
            { kind: "article", headline: "Japan's market draws money back after decades", source: "Reuters", date: "Jun 28, 2026", minutes: 4, body: ["Japanese stocks are attracting foreign investors again after a long stretch in the wilderness.", "Company reforms and steadier growth are the draw. This fund holds them as part of its Pacific slice."] },
            { kind: "video", headline: "Why investors are looking abroad again", source: "CNBC", date: "Jun 22, 2026", minutes: 6, body: ["A look at why money is flowing into international stocks after years of US dominance.", "Cheaper prices and a softer dollar are the main reasons."] },
            { kind: "article", headline: "Emerging markets steady as the dollar eases", source: "Bloomberg", date: "Jun 16, 2026", minutes: 4, body: ["Developing-country stocks and currencies firmed as the dollar softened.", "Emerging markets are the most volatile slice of this fund, and among the cheapest."] },
            { kind: "article", headline: "European stocks outpace the US so far this year", source: "Financial Times", date: "Jul 8, 2026", minutes: 6, body: ["For more than a decade, a simple approach beat almost everything: own US stocks, especially US tech, and largely ignore the rest of the world. This year that has flipped, and European markets are leading.", "The reasons are less about a European boom than an American pause plus a low starting point. European stocks had been unloved for years and traded far cheaper than US ones, so there was more room to rise. Steadier-than-feared growth and strong runs in banks, defence and industrial companies did the rest.", "A weaker US dollar has amplified the gains for American investors. When the dollar falls, money earned in euros or pounds converts into more dollars, so a European stock can rise in its own market and rise again when measured back home. This year both have worked in the same direction.", "Germany's main index has hit record highs, London's has too, and European bank shares, long treated as value traps, have rallied on stronger profits. None of it required the kind of runaway growth story that drove US tech; it mostly required starting cheap and not disappointing.", "This is exactly why a fund that holds the whole world exists. For years the US led and the fund captured that. Now leadership has rotated abroad, and because the fund already owns Europe, Japan and emerging markets, it captures this too, without anyone having to guess the turn in advance.", "Whether it lasts is the open question. Leadership between the US and the rest of the world has swung back and forth for a century, in long cycles rather than short ones. What this year has shown is how much a portfolio concentrated in one country, even the biggest, can miss when the wind changes."] },
            { kind: "article", headline: "A weaker US dollar lifts returns on foreign stocks", source: "Bloomberg", date: "Jul 5, 2026", minutes: 5, body: ["As the dollar slipped, gains in overseas markets translated into larger returns for US-based investors."] },
            { kind: "article", headline: "The European Central Bank cuts rates again to support growth", source: "Reuters", date: "Jul 2, 2026", minutes: 5, body: ["The move brought borrowing costs lower across the euro zone as inflation cooled toward target."] },
            { kind: "video", headline: "What China's latest stimulus means for its stock market", source: "CNBC", date: "Jun 29, 2026", minutes: 7, body: ["An explainer on the government's spending measures and how investors are reading them."] },
            { kind: "article", headline: "India's market extends its climb on strong domestic demand", source: "Nikkei", date: "Jun 26, 2026", minutes: 5, body: ["Local investors kept pushing indexes higher, making India one of the year's best-performing large markets."] },
            { kind: "article", headline: "Japan's corporate reforms draw more foreign money", source: "Financial Times", date: "Jun 23, 2026", minutes: 6, body: ["For decades, Japan was the market global investors loved to avoid. Its companies were famous for hoarding cash, protecting management and returning little to shareholders, and its stock market spent thirty years below the peak it hit in 1989. That is changing, and money is flowing back.", "The shift is being driven by reform. Japan's stock exchange and government have pushed companies hard to improve returns, unwind the tangle of cross-shareholdings in which firms owned stakes in each other, and hand more cash back through dividends and buybacks. Slowly, corporate Japan is complying.", "The results have drawn attention. Japanese share buybacks have hit records, long-dormant companies are being pressed by activist investors, and the market has finally climbed past its 1989 high. Well-known foreign investors, including Warren Buffett, have built large positions.", "For a fund that owns international stocks, Japan is one of its largest holdings, so this revival feeds directly into returns that spent years lagging the US. It is a case study in how change comes to markets slowly, and then all at once.", "Whether it lasts depends on whether the reforms stick rather than fade once the pressure eases. But after a thirty-year absence, Japan being a place investors want to own again is one of the clearer reasons international stocks have led this year."] },
            { kind: "article", headline: "Emerging-market stocks trade at a wide discount to the US", source: "Morningstar", date: "Jun 20, 2026", minutes: 6, body: ["Valuations across developing economies sat well below American shares, a gap value-focused investors noted."] },
            { kind: "video", headline: "Why European defence stocks are climbing", source: "Bloomberg", date: "Jun 17, 2026", minutes: 6, body: ["A look at how higher military spending across the continent lifted aerospace and industrial companies."] },
            { kind: "article", headline: "The currency-hedging debate splits international-fund investors", source: "Barron's", date: "Jun 14, 2026", minutes: 6, body: ["With the dollar falling, some favoured unhedged funds for the extra gains while others preferred steadier returns."] },
            { kind: "article", headline: "The UK's FTSE 100 reaches a fresh record high", source: "Reuters", date: "Jun 11, 2026", minutes: 4, body: ["Strength in energy and financial shares pushed the London index to a new peak."] },
            { kind: "article", headline: "A Taiwan chipmaker's results ripple through global markets", source: "Nikkei", date: "Jun 8, 2026", minutes: 5, body: ["Strong demand for AI processors from the world's largest contract manufacturer lifted technology stocks abroad."] },
            { kind: "article", headline: "Germany's DAX closes at a record high", source: "Reuters", date: "Jul 8, 2026", minutes: 4, body: ["Strength in industrial and export shares pushed the benchmark to a new peak."] },
            { kind: "article", headline: "European bank stocks rally on stronger profits", source: "Financial Times", date: "Jul 5, 2026", minutes: 5, body: ["Lenders across the euro zone posted solid results, lifting a sector that had lagged for years."] },
            { kind: "video", headline: "Why South Korea's Kospi is climbing", source: "CNBC", date: "Jul 2, 2026", minutes: 6, body: ["An explainer on the chip demand and corporate reforms driving the market's gains."] },
            { kind: "article", headline: "Swiss luxury stocks recover on renewed Chinese demand", source: "Bloomberg", date: "Jun 29, 2026", minutes: 5, body: ["Shares of watch and goods makers rose as shoppers in China returned to high-end purchases."] },
            { kind: "article", headline: "Mexico's market gains as nearshoring draws investment", source: "Nikkei", date: "Jun 26, 2026", minutes: 5, body: ["Manufacturers moving supply chains closer to the US lifted Mexican equities and the peso."] },
            { kind: "article", headline: "Foreign stocks pay higher dividends than US shares", source: "Morningstar", date: "Jun 23, 2026", minutes: 6, body: ["Yields across developed international markets sat above the US average, drawing income-focused investors."] },
            { kind: "article", headline: "China's tech shares rally on new stimulus and AI optimism", source: "Reuters", date: "Jun 20, 2026", minutes: 5, body: ["Hong Kong-listed internet stocks jumped as policy support and AI product launches lifted sentiment."] },
            { kind: "article", headline: "Australia's market rises on strong commodity exports", source: "Bloomberg", date: "Jun 17, 2026", minutes: 4, body: ["Higher prices for iron ore and other resources pushed mining shares and the broader index up."] },
          ] },
        ],
        source: "Multiple sources", date: "Jul 2026", bg: SLATE, ink: "#eef1f8",
      },
    ],
  },
};

export function hasStories(ticker?: string | null): boolean {
  return !!ticker && !!DECKS[ticker.toUpperCase()];
}

// ── Reactive seen-state (prototype: localStorage + pub-sub; real = server state) ──
const seenKey = (t: string) => `kiddo.story-seen.${t}`;
const listeners = new Set<() => void>();
const notify = () => listeners.forEach((l) => l());

export function useStorySeen(ticker?: string | null) {
  const t = (ticker || "").toUpperCase();
  const has = !!DECKS[t];
  const read = useCallback(() => {
    if (typeof window === "undefined" || !has) return 0;
    return parseInt(window.localStorage.getItem(seenKey(t)) || "0", 10) || 0;
  }, [has, t]);
  const [seen, setSeen] = useState(read);
  useEffect(() => {
    const l = () => setSeen(read());
    listeners.add(l); l();
    return () => { listeners.delete(l); };
  }, [read]);
  const markOpened = useCallback(() => {
    if (!has) return;
    try { window.localStorage.setItem(seenKey(t), "1"); } catch { /* private mode */ }
    notify();
  }, [has, t]);
  // "Unseen" = the ring glows until the parent has opened it at least once. The
  // real version relights whenever a genuinely new top story lands.
  return { allSeen: seen >= 1, hasAny: has, markOpened };
}

// ── Ring: glows (brand conic gradient) while there's something unseen. ──
export function HoldingStoryRing({
  ticker, size = 36, onOpen, children,
}: { ticker: string; size?: number; onOpen: () => void; children: React.ReactNode }) {
  const { hasAny, allSeen } = useStorySeen(ticker);
  if (!hasAny) return <>{children}</>;
  const ring = size + 8;
  return (
    <div
      onClick={(e) => { e.stopPropagation(); haptic("selection"); onOpen(); }}
      className="relative shrink-0 rounded-full cursor-pointer active:scale-95"
      style={{
        width: ring, height: ring, padding: 2.5,
        background: allSeen
          ? "hsl(var(--kiddo-ink) / 0.14)"
          : "conic-gradient(from 215deg, hsl(var(--kiddo-evergreen)), hsl(var(--kiddo-gold)), hsl(var(--kiddo-evergreen)))",
        transition: "background 0.45s ease, transform 0.12s ease",
      }}
      aria-label={`What's going on with ${ticker.toUpperCase()}`}
    >
      <div className="rounded-full bg-background flex items-center justify-center" style={{ width: "100%", height: "100%", padding: 2 }}>
        {children}
      </div>
    </div>
  );
}

// ── Visual renderers (ink-tinted so they sit on any card) ──
function Visual({ v, ink }: { v: StoryVisual; ink: string }) {
  if (v.kind === "stat") {
    return (
      <div>
        <p className="font-heading font-bold tabular-nums leading-none" style={{ fontSize: 46, letterSpacing: "-0.02em" }}>{v.value}</p>
        <p className="mt-2 text-[12px] font-semibold uppercase tracking-[0.09em]" style={{ opacity: 0.6 }}>{v.label}</p>
        {v.context ? <p className="mt-1.5 text-[13px]" style={{ opacity: 0.8 }}>{v.context}</p> : null}
      </div>
    );
  }
  if (v.kind === "trend") {
    const d = v.up ? "M2 42 C20 40 34 30 48 22 S74 6 84 3" : "M2 4 C20 6 34 16 48 24 S74 40 84 43";
    return (
      <div className="flex items-end gap-3">
        <svg width="86" height="46" viewBox="0 0 86 46" fill="none" style={{ opacity: 0.9 }}>
          <path d={d} stroke={ink} strokeWidth="2.5" strokeLinecap="round" fill="none" />
          <path d={`${d} L84 46 L2 46 Z`} fill={ink} opacity={0.1} />
        </svg>
        <div>
          <p className="font-heading font-bold tabular-nums leading-none" style={{ fontSize: 40, letterSpacing: "-0.02em" }}>{v.value}</p>
          <p className="mt-1.5 text-[12px] font-semibold uppercase tracking-[0.09em]" style={{ opacity: 0.6 }}>{v.label}</p>
        </div>
      </div>
    );
  }
  if (v.kind === "calendar") {
    return (
      <div className="flex items-center gap-3.5">
        <div className="rounded-2xl flex flex-col items-center justify-center" style={{ width: 64, height: 64, background: `${ink}14`, border: `1px solid ${ink}2e` }}>
          <span className="text-[10px] font-bold uppercase tracking-[0.1em]" style={{ opacity: 0.7 }}>{v.month}</span>
          <span className="font-heading font-bold tabular-nums leading-none" style={{ fontSize: 28 }}>{v.day}</span>
        </div>
        <div>
          <p className="text-[13px] font-bold">{v.note}</p>
          <p className="mt-0.5 text-[12px]" style={{ opacity: 0.65 }}>Reports after market close</p>
        </div>
      </div>
    );
  }
  return (
    <div>
      <div className="space-y-2">
        {v.rows.map((r) => (
          <div key={r.label}>
            <div className="flex items-baseline justify-between text-[12px]" style={{ opacity: r.emphasis ? 1 : 0.82 }}>
              <span className="font-medium">{r.label}</span>
              <span className="font-bold tabular-nums">{r.value}</span>
            </div>
            <div className="mt-1 h-2 rounded-full overflow-hidden" style={{ background: `${ink}22` }}>
              <div style={{ height: "100%", borderRadius: 999, width: `${Math.round(r.frac * 100)}%`, background: ink, opacity: r.emphasis ? 1 : 0.55 }} />
            </div>
          </div>
        ))}
      </div>
      <p className="mt-2.5 text-[11px]" style={{ opacity: 0.55 }}>{v.caption}</p>
    </div>
  );
}

// ── Inline glossary: tap a jargon word for a quick definition in place, instead
//    of teaching terms in a section (founder: "what capex actually is" as a
//    section is weird; highlight the word, tap it, learn it in a beat). ──
const GLOSSARY: Record<string, string> = {
  antitrust: "Laws that stop a company from using its size to shut out competition.",
  monopoly: "When one company so dominates a market that rivals cannot really compete.",
  dividend: "A share of profit paid out to the people who own the stock, usually each quarter.",
  "the Federal Reserve": "The US central bank. Its interest-rate decisions ripple through the whole economy.",
  "the Fed": "The US central bank. Its interest-rate decisions ripple through the whole economy.",
  inflation: "How fast prices across the economy are rising, measured over a year.",
  "index fund": "A fund that holds every company in a market rather than trying to pick winners.",
};
const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const GLOSS_RE = new RegExp(`\\b(${Object.keys(GLOSSARY).sort((a, b) => b.length - a.length).map(escapeRe).join("|")})\\b`, "gi");

function GlossaryText({ text }: { text: string }) {
  const [active, setActive] = useState<{ word: string; def: string; x: number; y: number } | null>(null);
  const parts: React.ReactNode[] = [];
  let last = 0; let m: RegExpExecArray | null; GLOSS_RE.lastIndex = 0;
  while ((m = GLOSS_RE.exec(text)) !== null) {
    if (m.index > last) parts.push(text.slice(last, m.index));
    const word = m[0];
    const def = GLOSSARY[word.toLowerCase()];
    parts.push(
      <button key={m.index} type="button"
        onClick={(e) => { e.stopPropagation(); const r = (e.currentTarget as HTMLElement).getBoundingClientRect(); haptic("selection"); setActive({ word, def, x: r.left + r.width / 2, y: r.top }); }}
        className="font-semibold text-foreground underline decoration-dotted decoration-1 underline-offset-[3px]"
        style={{ textDecorationColor: "hsl(var(--kiddo-evergreen))" }}>
        {word}
      </button>
    );
    last = m.index + word.length;
  }
  if (last < text.length) parts.push(text.slice(last));
  return (
    <>
      {parts}
      {active && typeof document !== "undefined" && createPortal(
        <>
          <div className="fixed inset-0 z-[95]" onClick={() => setActive(null)} />
          <div
            className="fixed z-[96] w-[216px] rounded-xl bg-white px-3.5 py-2.5 shadow-premium-lg"
            style={{ left: Math.min(Math.max(active.x, 116), (typeof window !== "undefined" ? window.innerWidth : 400) - 116), top: active.y - 9, transform: "translate(-50%, -100%)" }}
            onClick={() => setActive(null)}
          >
            <p className="text-[13px] leading-[1.45] text-foreground">{active.def}</p>
          </div>
        </>,
        document.body
      )}
    </>
  );
}

// ── Deep-read block renderer: paragraphs woven with a chart, a table, a
//    pull-quote, and tappable references. ──
function DeepBlockView({ b, onOpen }: { b: DeepBlock; onOpen: (it: ReadItem) => void }) {
  if (b.t === "p") return <p className="text-[15.5px] leading-[1.62] text-foreground/85"><GlossaryText text={b.text} /></p>;
  if (b.t === "quote") return (
    <p className="border-l-[3px] border-[hsl(var(--kiddo-evergreen))] pl-4 text-[16px] italic leading-[1.5] text-foreground/90"><GlossaryText text={b.text} /></p>
  );
  if (b.t === "position") {
    // Honesty: a losing holding must never render in the gain colour.
    const down = b.gain.trim().startsWith("-");
    const accent = down ? "rgb(201,74,74)" : "hsl(var(--kiddo-evergreen))";
    return (
      <div className="rounded-2xl px-4 py-3.5" style={{ background: down ? "rgba(201,74,74,0.08)" : "hsl(var(--kiddo-evergreen) / 0.09)", border: `1px solid ${down ? "rgba(201,74,74,0.22)" : "hsl(var(--kiddo-evergreen) / 0.2)"}` }}>
        <p className="text-[11px] font-bold uppercase tracking-[0.09em]" style={{ color: accent }}>This fund's slice</p>
        <div className="mt-1.5 flex items-baseline gap-2.5 flex-wrap">
          <span className="font-heading font-bold text-foreground tabular-nums leading-none" style={{ fontSize: 27 }}>{b.value}</span>
          <span className="text-[13.5px] font-bold tabular-nums" style={{ color: accent }}>{b.gain}</span>
        </div>
        <p className="mt-1 text-[12.5px] text-muted-foreground">{b.shares}</p>
      </div>
    );
  }
  if (b.t === "line") {
    const min = Math.min(...b.points), max = Math.max(...b.points);
    const W = 320, H = 108, pad = 5, range = max - min || 1;
    const stepX = (W - pad * 2) / (b.points.length - 1);
    const coords = b.points.map((p, idx) => [pad + idx * stepX, H - pad - ((p - min) / range) * (H - pad * 2)] as [number, number]);
    const line = coords.map(([x, y], idx) => `${idx === 0 ? "M" : "L"}${x.toFixed(1)} ${y.toFixed(1)}`).join(" ");
    const area = `${line} L${coords[coords.length - 1][0].toFixed(1)} ${H} L${coords[0][0].toFixed(1)} ${H} Z`;
    const rising = b.points[b.points.length - 1] >= b.points[0];
    const col = rising ? "hsl(var(--kiddo-evergreen))" : "rgb(200,60,60)";
    return (
      <div className="rounded-2xl bg-muted/40 px-4 py-4">
        <p className="text-[13px] font-bold text-foreground">{b.title}</p>
        <svg viewBox={`0 0 ${W} ${H}`} className="mt-3 w-full" style={{ height: 112 }} preserveAspectRatio="none">
          <defs><linearGradient id="story-line-fill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={col} stopOpacity="0.2" /><stop offset="100%" stopColor={col} stopOpacity="0" /></linearGradient></defs>
          <path d={area} fill="url(#story-line-fill)" />
          <motion.path d={line} fill="none" stroke={col} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke"
            initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 0.9, ease: [0.16, 1, 0.3, 1], delay: 0.1 }} />
        </svg>
        <div className="mt-2 flex items-center justify-between text-[12px]">
          <span className="text-muted-foreground">{b.startLabel}</span>
          <span className="font-bold tabular-nums" style={{ color: col }}>{b.endLabel}</span>
        </div>
        {b.caption ? <p className="mt-1.5 text-[11px] text-muted-foreground">{b.caption}</p> : null}
      </div>
    );
  }
  if (b.t === "chart") return (
    <div className="rounded-2xl bg-muted/40 px-4 py-4">
      <p className="text-[13px] font-bold text-foreground">{b.title}</p>
      <div className="mt-3 space-y-2.5">
        {b.bars.map((bar) => (
          <div key={bar.label}>
            <div className="flex items-baseline justify-between text-[12px]">
              <span className="font-medium text-muted-foreground">{bar.label}</span>
              <span className={`font-bold tabular-nums ${bar.hot ? "text-[hsl(var(--kiddo-evergreen))]" : "text-foreground/80"}`}>{bar.value}</span>
            </div>
            <div className="mt-1 h-2.5 rounded-full overflow-hidden" style={{ background: "hsl(var(--kiddo-ink) / 0.08)" }}>
              <motion.div className="h-full rounded-full" style={{ background: bar.hot ? "hsl(var(--kiddo-evergreen))" : "hsl(var(--kiddo-ink) / 0.32)" }}
                initial={{ width: 0 }} animate={{ width: `${Math.round(bar.frac * 100)}%` }} transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1], delay: 0.1 }} />
            </div>
          </div>
        ))}
      </div>
      {b.caption ? <p className="mt-3 text-[11px] text-muted-foreground">{b.caption}</p> : null}
    </div>
  );
  if (b.t === "table") return (
    <div className="rounded-2xl border border-border overflow-hidden">
      <p className="px-4 py-2.5 bg-muted/50 text-[12px] font-bold uppercase tracking-[0.08em] text-muted-foreground">{b.title}</p>
      {b.rows.map((r, idx) => (
        <div key={r.k} className={`flex items-center justify-between gap-3 px-4 py-2.5 text-[14px] ${idx > 0 ? "border-t border-border" : ""}`}>
          <span className="text-foreground/75">{r.k}</span>
          <span className="font-bold tabular-nums text-foreground">{r.v}</span>
        </div>
      ))}
    </div>
  );
  if (b.t === "feed") return (
    <div>
      {b.title ? <p className="mb-2.5 text-[11px] font-bold uppercase tracking-[0.08em] text-muted-foreground">{b.title}</p> : null}
      <div className="space-y-2">
        {b.items.map((it, idx) => (
          <button key={idx} type="button" onClick={() => { haptic("selection"); onOpen(it); }}
            className="w-full flex items-center gap-3 rounded-2xl bg-muted/40 px-3.5 py-3 text-left active:scale-[0.99] transition-transform">
            <span className="min-w-0 flex-1">
              <span className="block text-[14px] font-semibold text-foreground leading-snug">{it.headline}</span>
              <span className="mt-1 flex flex-wrap items-center gap-x-1.5 text-[12px] text-muted-foreground">
                <span className="font-medium">{it.source}</span>
                {it.date ? <><span aria-hidden>·</span><span>{it.date}</span></> : null}
                {it.minutes ? <><span aria-hidden>·</span><span className="inline-flex items-center gap-1">{it.kind === "video" ? <Play size={11} /> : <Clock size={11} />}{it.minutes} min</span></> : null}
              </span>
            </span>
            {it.kind === "video" ? (
              <span className="relative shrink-0 h-12 w-16 overflow-hidden rounded-lg" style={{ background: "linear-gradient(160deg,#26303e,#0b0f16)" }}>
                {it.thumb ? <img src={it.thumb} alt="" className="h-full w-full object-cover" /> : null}
                <span className="absolute inset-0 flex items-center justify-center">
                  <span className="flex h-6 w-6 items-center justify-center rounded-full bg-white/95 shadow-sm">
                    <Play size={11} className="ml-0.5 text-[#111]" />
                  </span>
                </span>
              </span>
            ) : null}
          </button>
        ))}
      </div>
    </div>
  );
  // refs: open in-app, never a browser hand-off
  return (
    <div>
      <p className="mb-2 text-[11px] font-bold uppercase tracking-[0.08em] text-muted-foreground">Sources</p>
      <div className="space-y-1.5">
        {b.items.map((it, idx) => (
          <button key={idx} type="button" onClick={() => { haptic("selection"); onOpen({ headline: it.label, source: it.source, date: "", kind: "article" }); }}
            className="w-full flex items-start gap-2.5 rounded-xl bg-muted/40 px-3.5 py-2.5 text-left active:scale-[0.99] transition-transform">
            <Newspaper size={15} className="mt-0.5 shrink-0 text-muted-foreground" />
            <span className="min-w-0">
              <span className="block text-[13.5px] font-semibold text-foreground leading-snug">{it.label}</span>
              <span className="block text-[12px] text-muted-foreground">{it.source}</span>
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}

// ── In-app reader: a source article or clip opens HERE, never in a browser.
//    Read, watch, scroll, all inside Kiddo. (Mock content in the prototype; the
//    live version streams the real piece into this same surface.) ──
function StoryReader({ item, onBack }: { item: ReadItem; onBack: () => void }) {
  const reduce = useReducedMotion();
  const [playing, setPlaying] = useState(false);
  return (
    <motion.div
      className="absolute inset-0 z-[70] flex flex-col bg-background"
      initial={reduce ? { opacity: 0 } : { x: "100%" }}
      animate={reduce ? { opacity: 1 } : { x: 0 }}
      exit={reduce ? { opacity: 0 } : { x: "100%" }}
      transition={{ type: "spring", stiffness: 400, damping: 42 }}
    >
      <div className="shrink-0 flex items-center gap-1.5 border-b border-border px-2.5 pb-3"
        style={{ paddingTop: "calc(env(safe-area-inset-top, 0px) + 10px)" }}>
        <button type="button" onClick={onBack} aria-label="Back"
          className="flex h-9 w-9 items-center justify-center rounded-full text-foreground active:scale-90" style={{ transition: "transform 0.12s ease" }}>
          <ChevronLeft size={22} />
        </button>
        <div className="min-w-0">
          <p className="truncate text-[13px] font-bold text-foreground leading-tight">{item.source}</p>
          {item.date ? <p className="text-[11px] text-muted-foreground leading-tight">{item.date}</p> : null}
        </div>
      </div>
      <div className="flex-1 overflow-y-auto px-6 pb-16 pt-5">
        {item.kind === "video" && (
          <button type="button" onClick={() => { haptic("selection"); setPlaying((v) => !v); }}
            className="relative mb-5 aspect-video w-full overflow-hidden rounded-2xl active:scale-[0.99]"
            style={{ background: "linear-gradient(160deg,#1c2430,#0b0f16)", transition: "transform 0.12s ease" }}>
            {item.thumb && !playing ? <img src={item.thumb} alt="" className="absolute inset-0 h-full w-full object-cover" /> : null}
            {!playing ? (
              <span className="absolute inset-0 flex items-center justify-center">
                <span className="flex h-14 w-14 items-center justify-center rounded-full bg-white/92 shadow-premium-lg">
                  <Play size={22} className="ml-0.5 text-[#111]" />
                </span>
              </span>
            ) : (
              <>
                <span className="absolute inset-0 flex items-center justify-center text-[12px] font-medium tracking-wide text-white/70">Playing</span>
                <span className="absolute bottom-0 left-0 right-0 h-1 bg-white/25">
                  <motion.span className="block h-full bg-white" initial={{ width: "0%" }} animate={{ width: "100%" }} transition={{ duration: 6, ease: "linear" }} />
                </span>
              </>
            )}
            {item.minutes ? <span className="absolute bottom-2 right-2 rounded bg-black/55 px-1.5 py-0.5 text-[11px] font-medium text-white">{item.minutes} min</span> : null}
          </button>
        )}
        <h1 className="font-heading font-bold leading-[1.16] text-foreground" style={{ fontSize: 24, letterSpacing: "-0.01em" }}>{item.headline}</h1>
        <p className="mt-2 flex items-center gap-1.5 text-[12.5px] text-muted-foreground">
          <span className="font-semibold">{item.source}</span>
          {item.minutes && item.kind !== "video" ? <><span aria-hidden>·</span><span className="inline-flex items-center gap-1"><Clock size={12} />{item.minutes} min read</span></> : null}
        </p>
        <div className="mt-4 space-y-3.5">
          {item.body && item.body.length ? (
            item.body.map((p, idx) => <p key={idx} className="text-[15.5px] leading-[1.62] text-foreground/85"><GlossaryText text={p} /></p>)
          ) : (
            <p className="text-[15px] leading-[1.6] text-muted-foreground">In the finished app the full piece from {item.source} opens right here, read or watched without leaving Kiddo.</p>
          )}
        </div>
      </div>
    </motion.div>
  );
}

// ── Full-screen Stories viewer ──
export function HoldingStoriesViewer({
  ticker, open, onClose,
}: { ticker: string | null; open: boolean; onClose: () => void }) {
  const t = (ticker || "").toUpperCase();
  const entry = DECKS[t];
  const cards = entry?.cards ?? [];
  const { markOpened } = useStorySeen(ticker);
  const reduce = useReducedMotion();
  const [[i, dir], setPage] = useState<[number, number]>([0, 0]);
  const [detail, setDetail] = useState(false);
  const [askNote, setAskNote] = useState(false);
  const [read, setRead] = useState<ReadItem | null>(null);
  const sheetDrag = useDragControls();

  const y = useMotionValue(0);
  const radius = useTransform(y, [0, 130], [0, 22]);
  const surfaceScale = useTransform(y, [0, 400], [1, 0.92]);
  const backdropOpacity = useTransform(y, [0, 340], [1, 0]);

  useEffect(() => { if (open) { setPage([0, 0]); setDetail(false); setRead(null); y.set(0); markOpened(); } }, [open, ticker, y, markOpened]);
  useEffect(() => { setDetail(false); setAskNote(false); setRead(null); }, [i]);
  useEffect(() => { if (!detail) { setAskNote(false); setRead(null); } }, [detail]);

  if (!open || cards.length === 0) return null;
  const card = cards[i];
  const many = cards.length > 7;
  const hasDeep = !!(card.deep || card.more);

  const paginate = (d: number) => {
    const ni = i + d;
    if (ni < 0) return;
    if (ni >= cards.length) { haptic("light"); onClose(); return; }
    haptic("selection");
    setPage([ni, d]);
  };

  const onDragEnd = (_e: unknown, info: PanInfo) => {
    const { offset, velocity } = info;
    if (Math.abs(offset.y) > Math.abs(offset.x)) {
      if (offset.y > 130 || velocity.y > 650) { haptic("light"); onClose(); return; }
      if ((offset.y < -80 || velocity.y < -650) && hasDeep) { haptic("selection"); setDetail(true); return; }
    } else {
      if (offset.x < -60 || velocity.x < -520) paginate(1);
      else if (offset.x > 60 || velocity.x > 520) paginate(-1);
    }
  };

  const slideX = reduce ? 0 : 46;
  const slideVariants = {
    enter: (d: number) => ({ x: d >= 0 ? slideX : -slideX, opacity: 0 }),
    center: { x: 0, opacity: 1 },
    exit: (d: number) => ({ x: d >= 0 ? -slideX : slideX, opacity: 0 }),
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-[80] overflow-hidden select-none"
          initial={reduce ? { opacity: 0 } : { opacity: 0, scale: 0.94 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={reduce ? { opacity: 0 } : { opacity: 0, scale: 0.96 }}
          transition={{ duration: 0.26, ease: [0.16, 1, 0.3, 1] }}
          data-testid="holding-stories-viewer"
        >
          <motion.div className="absolute inset-0 bg-black" style={{ opacity: backdropOpacity }} />

          <motion.div
            className="absolute inset-0 overflow-hidden"
            // While the deep read is open, the SHEET owns all gestures. Leaving the
            // main surface draggable let a swipe-down-to-close leak into the next
            // story (founder catch). Disable its drag AND its tap layer until close.
            drag={reduce || detail ? false : true}
            dragDirectionLock
            dragConstraints={{ top: 0, bottom: 0, left: 0, right: 0 }}
            dragElastic={{ top: 0.18, bottom: 0.7, left: 0.2, right: 0.2 }}
            onDragEnd={detail ? undefined : onDragEnd}
            style={{ y, borderRadius: radius, scale: surfaceScale }}
          >
            <AnimatePresence initial={false}>
              <motion.div key={`bg-${i}`} className="absolute inset-0" style={{ background: card.bg }}
                initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.45, ease: "easeInOut" }} />
            </AnimatePresence>

            {/* Tap layer: left third = back, rest = forward. Off while the deep
                read is open so a tap near the top never advances the story. */}
            <motion.div className="absolute inset-0 z-10" style={{ pointerEvents: detail ? "none" : "auto" }}
              onTap={(_e, info) => {
                if (detail) return;
                const w = typeof window !== "undefined" ? window.innerWidth : 400;
                if (info.point.x < w * 0.32) paginate(-1); else paginate(1);
              }} />

            {/* Top bar: progress + company */}
            <div className="absolute top-0 left-0 right-0 z-20 px-3"
              style={{ paddingTop: "calc(env(safe-area-inset-top, 0px) + 10px)", color: card.ink, transition: "color 0.4s ease" }}>
              {many ? (
                <div className="flex items-center gap-2">
                  <div className="h-[3px] flex-1 rounded-full overflow-hidden" style={{ background: `${card.ink}30` }}>
                    <motion.div style={{ height: "100%", borderRadius: 999, background: card.ink }} initial={false}
                      animate={{ width: `${((i + 1) / cards.length) * 100}%` }} transition={{ duration: reduce ? 0 : 0.4, ease: [0.16, 1, 0.3, 1] }} />
                  </div>
                  <span className="text-[10px] font-bold tabular-nums shrink-0" style={{ opacity: 0.7 }}>{i + 1} / {cards.length}</span>
                </div>
              ) : (
                <div className="flex gap-1">
                  {cards.map((_, idx) => (
                    <div key={idx} className="h-[3px] flex-1 rounded-full overflow-hidden" style={{ background: `${card.ink}30` }}>
                      <motion.div style={{ height: "100%", borderRadius: 999, background: card.ink }} initial={false}
                        animate={{ width: idx <= i ? "100%" : "0%" }} transition={{ duration: reduce ? 0 : 0.4, ease: [0.16, 1, 0.3, 1] }} />
                    </div>
                  ))}
                </div>
              )}
              <div className="mt-3 flex items-center justify-between">
                <div className="flex items-center gap-2 min-w-0" style={{ pointerEvents: "none" }}>
                  <div className="rounded-full bg-white/95 flex items-center justify-center shadow-sm" style={{ width: 28, height: 28 }}>
                    <StockLogo ticker={t} size={20} />
                  </div>
                  <p className="text-[13px] font-bold leading-tight truncate">{entry.name}</p>
                </div>
                <button type="button" onClick={onClose} aria-label="Close"
                  className="z-30 -mr-1 flex h-9 w-9 items-center justify-center rounded-full active:scale-90"
                  style={{ color: card.ink, transition: "transform 0.12s ease" }}>
                  <XIcon size={20} />
                </button>
              </div>
            </div>

            {/* Card body */}
            <div className="absolute inset-x-0 bottom-0 px-6 pb-14 pt-24 z-[5]" style={{ pointerEvents: "none", color: card.ink, transition: "color 0.4s ease" }}>
              <AnimatePresence initial={false} custom={dir} mode="popLayout">
                <motion.div key={`c-${i}`} custom={dir} variants={slideVariants} initial="enter" animate="center" exit="exit"
                  transition={{ duration: reduce ? 0 : 0.42, ease: [0.16, 1, 0.3, 1] }}>
                  <p className="text-[11px] font-bold uppercase tracking-[0.13em]" style={{ opacity: 0.66 }}>{card.kicker}</p>
                  <h2 className="mt-2 font-heading font-bold leading-[1.12]" style={{ fontSize: 25, letterSpacing: "-0.01em" }}>{card.headline}</h2>
                  {card.visual && <div className="mt-5"><Visual v={card.visual} ink={card.ink} /></div>}
                  <p className="mt-5 text-[14.5px] leading-[1.5]" style={{ opacity: 0.92, maxWidth: 480 }}>{card.body}</p>
                  <p className="mt-4 text-[11px] font-medium" style={{ opacity: 0.62 }}>{card.source} · {card.date}</p>
                </motion.div>
              </AnimatePresence>
            </div>

            {/* Swipe-up-for-more hint */}
            {hasDeep && !detail && (
              <button type="button" onClick={() => { haptic("selection"); setDetail(true); }}
                className="absolute left-1/2 -translate-x-1/2 z-20 flex flex-col items-center gap-0.5"
                style={{ bottom: "calc(env(safe-area-inset-bottom, 0px) + 12px)", color: card.ink }}
                aria-label="Read more">
                <motion.div animate={reduce ? {} : { y: [0, -4, 0] }} transition={{ duration: 1.6, repeat: Infinity, ease: "easeInOut" }}>
                  <ChevronUp size={18} style={{ opacity: 0.85 }} />
                </motion.div>
                <span className="text-[10px] font-bold uppercase tracking-[0.12em]" style={{ opacity: 0.7 }}>Read more</span>
              </button>
            )}

            {/* Deeper read: slides up on swipe-up */}
            <AnimatePresence>
              {detail && hasDeep && (
                <motion.div key="deep-scrim"
                  className="absolute inset-0 z-[38] bg-black/30"
                  initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                  onClick={() => { haptic("light"); setDetail(false); }} />
              )}
              {detail && hasDeep && (
                <motion.div key="deep-sheet"
                  className="absolute inset-x-0 bottom-0 z-40 rounded-t-3xl overflow-hidden shadow-premium-lg flex flex-col"
                  style={{ background: "hsl(var(--background))", maxHeight: "90%" }}
                  initial={reduce ? { opacity: 0 } : { y: "100%" }}
                  animate={reduce ? { opacity: 1 } : { y: 0 }}
                  exit={reduce ? { opacity: 0 } : { y: "100%" }}
                  transition={{ type: "spring", stiffness: 380, damping: 40 }}
                  drag={reduce ? false : "y"}
                  dragControls={sheetDrag}
                  dragListener={false}
                  dragConstraints={{ top: 0, bottom: 0 }}
                  dragElastic={{ top: 0, bottom: 0.55 }}
                  onDragEnd={(_e, info) => { if (info.offset.y > 90 || info.velocity.y > 500) { haptic("light"); setDetail(false); } }}
                >
                  {/* Card-themed header. Drag from here to close; it visually
                      continues the story so the sheet is the same thing opened up. */}
                  <div
                    className="relative shrink-0 px-6 pt-2.5 pb-4 cursor-grab active:cursor-grabbing touch-none"
                    style={{ background: card.bg, color: card.ink }}
                    onPointerDown={(e) => { if (!reduce) sheetDrag.start(e); }}
                  >
                    <div className="flex justify-center pb-3"><div className="h-1 w-10 rounded-full" style={{ background: `${card.ink}55` }} /></div>
                    <button type="button" aria-label="Close"
                      onPointerDown={(e) => e.stopPropagation()}
                      onClick={() => { haptic("light"); setDetail(false); }}
                      className="absolute top-2.5 right-3 flex h-9 w-9 items-center justify-center rounded-full active:scale-90"
                      style={{ color: card.ink, background: `${card.ink}1f`, transition: "transform 0.12s ease" }}>
                      <XIcon size={18} />
                    </button>
                    <p className="text-[11px] font-bold uppercase tracking-[0.13em]" style={{ opacity: 0.72 }}>{card.kicker}</p>
                    <h3 className="mt-1 font-heading font-bold leading-[1.14]" style={{ fontSize: 22, letterSpacing: "-0.01em" }}>{card.headline}</h3>
                    <p className="mt-2 text-[11px] font-medium" style={{ opacity: 0.72 }}>{card.source} · {card.date}</p>
                  </div>
                  <div className="overflow-y-auto px-6 pb-10 pt-5">
                    {card.deep ? (
                      <div className="space-y-4">
                        {card.deep.map((b, idx) => <DeepBlockView key={idx} b={b} onOpen={setRead} />)}
                      </div>
                    ) : card.more ? (
                      <p className="text-[15.5px] leading-[1.62] text-foreground/85"><GlossaryText text={card.more} /></p>
                    ) : null}
                    {card.deep && (
                      <>
                        <button type="button" onClick={() => { haptic("selection"); setAskNote((v) => !v); }}
                          className="mt-6 w-full flex items-center gap-2 rounded-2xl border border-dashed border-border px-4 py-3 text-left text-[14px] font-medium text-muted-foreground active:scale-[0.99] transition-transform">
                          <MessageCircle size={16} className="shrink-0" /> Ask anything about {entry.name}
                        </button>
                        {askNote && (
                          <p className="mt-2 px-1 text-[12.5px] leading-[1.5] text-muted-foreground">In the finished version, ask your own question and it is answered right here, in this same voice.</p>
                        )}
                      </>
                    )}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>

          {/* In-app reader: opens above the whole story surface so a link or clip
              is read/watched inside Kiddo, never handed off to a browser. */}
          <AnimatePresence>
            {read && <StoryReader item={read} onBack={() => { haptic("light"); setRead(null); }} />}
          </AnimatePresence>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
