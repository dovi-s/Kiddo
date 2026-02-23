# Kora

## Overview

Kora is a gifting platform that transforms traditional gifts into long-term investments, primarily for custodial accounts for children. It aims to be a leading consumer financial platform by offering a seamless experience for gifting and investing, focusing on "gifts that grow." The platform allows users to create investment funds (custodial UTMA for children, personal taxable for adults), link event pages to funds for attribution, and manage the gift lifecycle from payment to settled investment. Its progressive onboarding allows immediate account and link creation, with identity verification (KYC) only required for activating investing features.

## User Preferences

Preferred communication style: Simple, everyday language.
Writing style: Never use em dashes. Use periods, commas, or rewrite the sentence instead. Keep copy personal and grounded in real user experience.

## System Architecture

### Core Concepts and Features

*   **Funds**: Each fund maps to a single brokerage account (e.g., UTMA custodial, Personal Taxable).
*   **Pages vs. Funds**: Public-facing pages (e.g., event pages) route all gifts to a single underlying fund for attribution.
*   **Gift Lifecycle**: Gifts progress from "Pending" (payment captured) to "Invested" (trade settled), with holdings visible at the Fund level.
*   **Onboarding**: A multi-step activation with no upfront KYC; users create accounts and name funds, then explicitly activate investing via KYC. Gifts can be pledged pre-activation.
*   **User Roles**: Includes Gift-Giver, Parent/Host (account owner, KYC, manages funds/events), Kid/Recipient (read-only), Adult Recipient, and Co-Parent/Family Admin.
*   **Dashboard IA**: Features a fund switcher, balance breakdown (invested, cash, pending), holdings, events summary, activity feed, and quick actions.
*   **Child Privacy**: Minors are non-discoverable by default with link-only access. Pages for minors display only the first name.
*   **Child Experience**: Designed to make investing feel like progress via milestones and feedback, avoiding financial jargon.
*   **Pricing Model**:
    *   **Processing Fees**: Card/Apple Pay/Google Pay (~2.9% + $0.30), ACH bank transfer (0.8%, max $5).
    *   **Kora Platform Fee**: 1.5% per gift (min $1, max $10), same for all payment methods.
    *   **Account Memberships**:
        *   **Free ($0)**: Guests pay processing + Kora platform fee. Host can cover platform fee per event.
        *   **Family ($149/year)**: Kora platform fee waived up to $15,000/year, unlimited premium event pages, household dashboard, recurring gift management, priority support.
    *   **Event Add-on**: **Event Pass ($99/event)**: One-time purchase for Free-tier users, waives Kora platform fee up to $7,500 gift volume for a single event; includes premium themes, goal cards, thank-you automation. Family Plan members get these features included. This is not a subscription plan.
    *   **Payment Methods**: Apple Pay, Google Pay, credit/debit cards, bank transfer (ACH). Apple Pay/Google Pay are one-tap and seamless. ACH has lower fees for larger gifts.
*   **Withdrawal & Selling Policy**:
    *   Custodians (parents) can sell investments and withdraw, but funds must be used for the child's benefit (UTMA law).
    *   Adult account holders have full control to sell and withdraw whenever they want.
    *   Gifts are irrevocable once made (they belong to the recipient).
    *   No Kora withdrawal fees. Standard settlement (T+1) applies before cash is withdrawable.
    *   UTMA accounts transfer to the child's full control at age of majority (18-21 depending on state).

### Technical Implementation

*   **Monorepo**: Contains client, server, and shared code.
*   **Frontend**: React with TypeScript, Wouter for routing, Tailwind CSS v4, shadcn/ui components, TanStack React Query for state, Framer Motion for animations, and Vite for building.
*   **Backend**: Node.js with Express, TypeScript (ESM), and a RESTful API.
*   **Data Layer**: Drizzle ORM with PostgreSQL, shared schema (`shared/schema.ts`), and Zod for validation.
*   **Design Decisions**: Emphasis on end-to-end type safety, customizable UI components, and an optimized custom build process.

### Gift Execution Models

Kora supports three models:
*   **Auto-Invest (Default)**: Giver pays, cash lands, system auto-buys the fund's default basket at the next trading window.
*   **Hold as Seed (Control Mode)**: Giver pays, gift becomes a Seed balance, owner chooses allocation and invests.
*   **Giver Chooses (Personalized)**: On checkout, givers select from the fund's strategy, a Favorites list, or a specific stock/ETF.

### Trust Layer & Memory Book

The platform emphasizes transparency regarding asset holding (e.g., Apex Clearing), SIPC coverage, account control, status updates (pending → invested → settled), and clear fee disclosure. A "Memory Book" feature captures sentimental data like messages, photos, and milestones to foster long-term engagement.

## Pages and Routes

### Public Pages (no auth required)
*   **Home** (`/`): Landing page with hero, growth calculator, how it works, trust section, pricing, CTA
*   **FAQ** (`/faq`, `/how-it-works`): Searchable FAQ with How It Works visual guides
*   **Gift Checkout** (`/:fund`, `/:fund/:event`): Gift-giver checkout with one-tap amounts, execution models, message, always-visible order summary with itemized fees (gift amount, processing fee with rate, Kora platform fee with explanation, total charge, recipient receives amount, cover-fees toggle, plan savings info)
*   **Gift Success** (`/gift/success`): Celebration page after gifting with sharing CTAs
*   **Kid View** (`/kid/:fundId`): Fun kid-friendly view using garden/seed metaphor, public API endpoints

### Auth Pages
*   **Login** (`/login`): Kora-branded email/password + Google OAuth
*   **Get Started** (`/get-started`): Multi-step onboarding: hook > choose > personalize > projection > account > children > success
*   **Activate Investing** (`/activate`): Plain-English KYC simulation with strategy picker

### Authenticated Pages (sidebar offset)
*   **Dashboard** (`/dashboard`): Fund switcher, balance breakdown, quick actions (share, create event, invest cash), growth projection, holdings with sell action, recent gifts, events summary
*   **Events** (`/events`): Event list with stats, share links, Event Pass upsell
*   **Event Create** (`/event/create`): Multi-step event creation (type, details, fund link, goal)
*   **Memory Book** (`/memory/:fundId`): Timeline of gift messages, milestones, photos, notes
*   **Activity** (`/activity`): Filtered activity feed grouped by date
*   **Settings** (`/settings`): Profile, funds list, membership (with fee savings example), Event Passes, KYC status, privacy toggle per fund, sell holdings, withdraw cash, bank account management
*   **Admin** (`/admin`): Internal admin dashboard with tabs for Overview (revenue, AUM, gift flow, pipeline), Users (all accounts with plan, KYC, fund counts), Funds (all funds with owners, holdings, events), Gifts (full fee itemization per gift), Transactions (complete ledger)

### Reusable Components
*   **EducationTip** (`client/src/components/ui/education.tsx`): Inline, expandable, and tooltip education with pre-built content for UTMA, auto-invest, SIPC, fees, pending cash, taxes, gift growth

## External Dependencies

*   **Database**: PostgreSQL (managed via `DATABASE_URL`), Drizzle Kit for migrations.
*   **Payment Processing**: Stripe.
*   **Authentication & Sessions**: Passport.js (local strategy), express-session, connect-pg-simple.
*   **Brokerage Integration**: Embedded broker-dealer model with partners like Apex Clearing or DriveWealth for KYC/AML, custody, clearing, settlement, and tax reporting.
*   **Frontend Libraries**: qrcode.react, date-fns, react-hook-form with @hookform/resolvers.

## Responsive Layout Architecture

### Desktop Sidebar (`client/src/components/layout/DesktopSidebar.tsx`)
*   Shows on md+ screens for authenticated users on main app pages
*   Fixed left sidebar: 220px on md, 260px on lg
*   Nav items: Fund, Events, Activity, Settings + user profile + logout
*   Hidden on: Home, auth/flow pages (login, get-started, onboard, activate, claim, send)

### Responsive Breakpoints
*   **Mobile** (<768px): Bottom tab nav (MobileNav), max-w-lg content
*   **Tablet** (md: 768px+): Desktop sidebar, max-w-3xl content, grids activate
*   **Desktop** (lg: 1024px+): Wider sidebar (260px), max-w-5xl content
*   Logged-in pages offset content with `md:ml-[220px] lg:ml-[260px]`
*   Form/flow pages use centered `md:max-w-2xl` containers

### Brand Assets
*   **Logo**: `client/src/assets/kora-logo-cropped.png` (brushstroke K mark)
*   **Mascot**: `client/src/assets/kora-mascot.png` (green sprout character)
*   **Brand Mark**: `client/src/assets/kora-brand-mark.png` (mascot + K + wordmark combo)
*   **OG Image**: `client/public/kora-og-image.png` (social sharing preview)
*   **Splash Screen**: Shows brand mark on first app load (1.8s), sessionStorage gated

## Gemini Design System

The platform implements Google Gemini-inspired visual design based on detailed design analysis. Key principles: softness and glow, ethereal blur, circular warmth, intentional motion, and trustworthy fintech aesthetics.

### Component Library (`client/src/components/ui/gemini.tsx`)
*   **GeminiSparkle**: Animated sparkle icon (the ubiquitous Gemini motif) with configurable size, color, delay
*   **SparkleCluster**: Multiple sparkles arranged in a spread pattern
*   **SparkleBurst**: Particle explosion animation for reward/success feedback
*   **SpectrumWave**: Animated gradient bars for activity/loading states
*   **GeminiHeroGradient**: Large floating gradient orbs for hero sections
*   **GeminiBalanceGlow**: Subtle gradient for dashboard balance cards
*   **ThinkingOrb**: Rotating conic gradient ring with glow halo for loading
*   **EnergyRing**: Rotating gradient ring around content
*   **EtherealCard / GeminiCard**: Cards with warm hover glow using radial gradients
*   **GradientText**: Animated gradient text with Kora brand colors
*   **ProcessingState**: Full processing view with ThinkingOrb + sparkles + spectrum wave
*   **SuccessState**: Success view with checkmark, sparkle burst, gradient text
*   **EnlighteningReveal**: Entrance animation with blur-to-clear reveal
*   **ExpandReveal**: Height-based expand/collapse with fade
*   **GlowHalo**: Standalone breathing glow orb
*   **BreathingGlow**: Wrapper that adds breathing glow behind children

### CSS Classes (`client/src/index.css`)
*   `gemini-btn-shimmer`: Gentle light sweep on CTA buttons
*   `gemini-hover-glow`: Warm ethereal border glow on hover (radial gradient)
*   `gemini-pulse-dot`: Gentle breathing indicator for pending states
*   `gemini-warm-section`: Spatial warmth with fuzzy radial gradients
*   `gemini-soft-container`: Ambient warmth around card containers
*   `gemini-glass-warm`: Frosted glass with warmth and saturation
*   `gemini-ethereal-card`: Backdrop blur card with subtle border
*   `gemini-sparkle-hint`: Tiny sparkle icon that peeks on interactive elements
*   `gemini-ripple`: Radial ripple feedback on tap/click
*   `gemini-intro-glow`: Feature introduction sweep bar animation
*   `gemini-featured-border`: Rotating conic gradient border
*   `gemini-active-card`: Breathing border with soft halo
*   `gemini-text-shimmer`: Subtle text highlight shimmer

### Motion Variants
*   `geminiEntrance`: Spring entrance with blur-to-clear
*   `geminiStagger`: Staggered children reveal
*   `geminiCard`: Card entrance with blur
*   `geminiFloat`: Gentle floating animation
*   `geminiBreathe`: Scale + opacity breathing
*   `geminiExpand`: Expansion-based reveal with blur