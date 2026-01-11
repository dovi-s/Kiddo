# Kora

## Overview

Kora is a modern gifting platform designed to transform traditional gifts into long-term investments, focusing on "gifts that grow." It enables users to contribute money to a recipient's investment fund, typically custodial accounts for children. The platform aims to be a leading consumer financial platform by offering a seamless experience for gifting and investing.

The product operates on a three-layer model:
1.  **Kora**: The user-facing UI, handling gifting, registries, checkout, messages, thank-you flows, and displaying investment details.
2.  **Brokerage Account**: The actual securities account with a partner like Apex/DriveWealth, holding cash and shares, hidden from the end-user.
3.  **Clearing/Custody**: A regulated entity managing KYC/AML, custody, trade execution, and tax documentation, completely abstracted from the user.

Key capabilities include creating investment funds (custodial UTMA for children, personal taxable for adults), linking multiple public-facing event pages to a single fund for attribution, and managing a gift lifecycle from pending payment to settled investment. The onboarding process is designed for progressive activation, allowing users to create accounts and share links immediately, with identity verification (KYC) required only when activating investing.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Core Concepts and Features

*   **Funds**: Each fund maps to a single brokerage account (e.g., "Mila's Fund" = a UTMA custodial account). V1 supports Custodial UTMA and Personal Taxable accounts.
*   **Pages vs. Funds**: Pages (e.g., `kora.com/mila/5th-birthday`) are public-facing "skins" that route all gifts to the same underlying fund, serving as attribution labels.
*   **Gift Lifecycle**: Gifts move from "Pending" (payment captured) to "Invested" (trade settled via broker), with holdings visible at the Fund level.
*   **Onboarding**: A 7-beat activation journey with no upfront KYC. Users create an account, name funds, and then explicitly activate investing via KYC. Gifts can be pledged even before activation.
*   **User Roles**: Includes Gift-Giver (no account needed), Parent/Host (account owner, KYC, manages funds/events), Kid/Recipient (read-only "Story Mode"), Adult Recipient (self-directed), and Co-Parent/Family Admin (collaborator with limited permissions).
*   **Dashboard IA**: Provides a fund switcher, total balance breakdown (invested, cash, pending), holdings, events summary, activity feed, and quick actions (share link, create event, send thank-yous).
*   **Child Privacy**: Minors are non-discoverable by default, with link-only access. Visibility settings for pages include "Unlisted" (default for minors), "Private," and "Public" (adults only). Pages for minors display first name only.
*   **Child Experience**: Designed to make investing feel like a scoreboard of progress through milestones and behavior-based feedback, avoiding complex financial jargon.
*   **Pricing Model**: Two fee layers at checkout:
    1. **Processing (pass-through)**: Card ~2.9% + $0.30, ACH ~$0.75
    2. **Kora platform fee**: Card 1.5% (min $1, max $10), ACH 1.0% (min $0.75, max $10)
    
    **Account Memberships (household-level):**
    - **Free ($0)**: Guests pay processing + Kora platform fee. Host can toggle to cover platform fee per event (billed 1.5% per gift).
    - **Family ($199/year)**: Kora platform fee waived up to $15,000/year. Household dashboard for multiple kids, recurring gift management, priority support.
    - **Organizations**: Contact sales for schools, nonprofits, teams.
    
    **Event Add-on (per-event, NOT a plan):**
    - **Event Pass ($99/event)**: One-time purchase for a single event. Kora platform fee waived up to $7,500 gift volume. Premium themes, goal cards, thank-you automation. Guests still pay processing. NEVER shown in account settings/billing as a "plan" - only appears in event creation/management contexts.
    
    **Critical distinction**: "Event Pass" is NOT a subscription plan. It is a one-time add-on purchased when creating or editing an event. The only subscription plan is "Family".

### Technical Implementation

*   **Monorepo**: Client, server, and shared code within a single repository.
*   **Frontend**: React with TypeScript, Wouter for routing, Tailwind CSS v4 for styling, shadcn/ui for components, TanStack React Query for state, Framer Motion for animations, and Vite for building.
*   **Backend**: Node.js with Express, TypeScript (ESM), RESTful API.
*   **Data Layer**: Drizzle ORM with PostgreSQL, shared schema (`shared/schema.ts`), and Zod for validation.
*   **Design Decisions**: End-to-end type safety, customizable shadcn/ui components, and a custom build process for server optimization.

## External Dependencies

*   **Database**: PostgreSQL (via `DATABASE_URL`), Drizzle Kit for migrations.
*   **Payment Processing**: Stripe.
*   **Authentication & Sessions**: Passport.js (local strategy), express-session, connect-pg-simple (PostgreSQL session store).
*   **Brokerage Integration**: Embedded broker-dealer model with partners like Apex Clearing or DriveWealth, handling KYC/AML, custody, clearing, settlement, and tax reporting. Kora manages the front-end UX and customer relationships.
*   **Frontend Libraries**: qrcode.react for QR codes, date-fns for date handling, react-hook-form with @hookform/resolvers for form management.
*   **Development Tools**: Replit Plugins (Cartographer, dev banner, runtime error overlay).

## PLG Loops & Stickiness Strategy

### Holy Metric
**"Event shared → 3 gifts received within 7 days"**
This proves virality + value. Track shares → gifts conversion.

### 5 Retention Loops

**Loop 1: Event Loop (Viral Acquisition)**
- 1 host creates event → 50-200 guests visit → some become hosts → repeat
- Key primitive: shareable page + QR + instant card reveal

**Loop 2: Recurring Loop (Revenue + Retention)**
- "Every birthday", "Monthly for a year", "Holiday season"
- Frame as "presence over time" not investing

**Loop 3: Gratitude Loop (Emotional Retention)**
- Thank-you flow is THE retention engine
- Auto-drafted thank-yous, one-tap send, optional video
- This is where "this product is better than everything else" happens

**Loop 4: Identity Loop (Kid Grows Up With Product)**
- Child view: "People who backed you", "How compounding works"
- If done right, kid becomes evangelist later in life

**Loop 5: Household Loop (Multi-Fund Expansion)**
- sibling fund → education goal → first home → wedding fund
- Same household keeps expanding without churn

### What to Gamify (Tastefully)
**DO:**
- Milestones, not points (First Gift, 10 People, $1K, 1-Year, First Dividend)
- Streaks for gratitude/learning (NOT deposits)
- Memory book (sentimental data = moat)
- Progress bars for group goals (teamwork feel)

**DON'T:**
- Stock performance confetti
- "Beat the market" language
- Leaderboards
- "Invite 10 friends to level up"
- Rewards tied to trading actions

### The 3 Features That Create Love
1. **Card reveal + share formats** - textable, printable, wallet-pass, premium stationery feel
2. **Group goal cards** - simple, viral, progress bar, teamwork
3. **Thank-you automation** - fast, classy, satisfying

### Trust Layer (Must Be Designed, Not Just Policy)
On every gift page:
- Who holds assets (Apex Clearing)
- SIPC coverage (factual, short)
- Who controls it (parent until age)
- Status: pending → invested → settled
- Fees (simple, not hidden)

### Memory Book (Sentimental Data Moat)
The reason people stay even if gifting slows:
- Messages from contributors
- Photos from events
- Who gave what (private, permissioned)
- Milestones achieved
- Recap cards (Spotify Wrapped style)

This data cannot be exported from competitors.

## Child Experience Philosophy

**Goal**: Make investing feel like a scoreboard of progress, not a finance course.

**5 core lessons to embed (without teaching them directly)**:
1. Owning pieces of real businesses is normal
2. Time is the advantage
3. Volatility is the price of growth
4. Diversification is the safety net
5. Consistency beats "being smart"

**Separate balance from progress**:
- "Your Fund" = total balance (simple number)
- "Your Progress" = behavior-based (days invested, streaks, milestones)
- Pride comes from behavior, not gifts received

**Milestones over returns**:
- First $100, First $500, First $1,000
- First dividend received
- One year invested
- Stayed invested through a dip
- Added to fund 6 months in a row

**Compounding visual**: Show "What people added" vs "What time added" - no percentages, no trading vibes

**Three-tab IA for recipient**:
1. **Today**: Total, next milestone, "what changed" card
2. **Progress**: Time ramp, streaks, milestones timeline
3. **Story**: Contributors + notes, thank-you prompts

**Messaging rules**:
- Never: "Get rich", "Beat the market", "Pick winners"
- Always: "Start early", "Let time do the work", "Own the world, not one stock", "Stay invested"

## Onboarding Flow (7-Beat Activation Journey)

The onboarding is designed to be light upfront, with brokerage activation as an explicit action:

### Phase 1: Create Account (no KYC yet)
1. Choose account type (parent/guardian or self)
2. Create account (name, email, password)
3. Name your fund(s)
4. Confirmation → Dashboard with status = "draft"

### Phase 2: Dashboard (Fund Not Yet Activated)
- Status chip: "Not activated" (stone colored)
- "Activate investing" button (primary CTA)
- Gift rules: Contributors can pledge, pledges convert when activated

### Phase 3: Activate Investing (KYC)
1. Intro: Overview of steps
2. Brokerage: "Where will assets live?" (Kora embedded = recommended)
3. Identity: Parent KYC (name, DOB, SSN, address, phone)
4. Child: Child info (if custodial)
5. Agreements: Customer agreement, privacy, disclosures
6. Status: "Opening your investing account..."

### Key Principles
1. No KYC during initial signup
2. Brokerage is inside Kora (not external connection in v1)
3. Progressive activation
4. Persistent status chip on every fund card

## Gift Execution Models

Kora supports 3 execution models. Each fund has a default, with options for customization.

### Model A: Auto-Invest (Default)
- **What happens**: Giver pays → cash lands at broker → system auto-buys the fund's default basket at next trading window
- **Status flow**: Pending → Processing → Invested
- **When to use**: Most kid funds, event registries, "Future Fund" default
- **Guardrails**: Parent sets default once; optional "auto-invest only in ETFs" toggle

### Model B: Hold as Seed (Control Mode)
- **What happens**: Giver pays → gift becomes Seed balance → owner gets notification → owner chooses allocation and invests
- **When to use**: New/nervous users, funds where parents want to pick stocks, large gifts ($500+)
- **Downside**: Lower instant gratification, more support questions if ignored

### Model C: Giver Chooses (Personalized)
- **What happens**: On checkout, giver selects from Fund's strategy, Favorites list, or specific stock/ETF
- **When to use**: Event gifting with a story, older kids with curated favorites
- **Guardrails**: Favorites list pre-approved by parent (10-20 tickers max); default stays "Fund's strategy"

### Default Configuration
- **Per-fund default**: Auto-invest (Model A)
- **Settings toggles**:
  - "Hold gifts as Seed until I invest" (enables Model B)
  - "Let givers choose from Favorites" (enables Model C)

### Execution Timing
- Market open: "Executes today"
- Market closed: "Executes next trading day"
- Always show status: Received → Processing → Invested

### Approval & Control
- **Owner (parent/guardian)**: Controls defaults and favorites list
- **Kid view**: View-only, or "Suggest favorites" requiring parent approval

### Refunds & Chargebacks
- If payment reversed while pending: Cancel the trade
- If already invested: Sell equivalent shares or pull from cash balance (policy must be clearly defined)

### Account Structure (V1)
- 1 taxable brokerage per adult
- 1 custodial brokerage (UTMA) per child
- No IRA routing in V1 (too complex for gifting)
- "Connect existing" is advanced toggle, not default

## Tax & Legal Considerations

### Personal Gifts (Core Product)
- **No direct tax deduction** for the giver - personal gifts are not deductible
- **Gift tax simplicity**: Annual exclusion is $19,000/recipient (2026) before filing Form 709
- **Appreciated stock benefit**: Giver avoids realizing capital gains; recipient inherits carryover basis
- **Messaging**: Focus on emotional/growth value, NOT tax advantages

### Gifting Appreciated Stock
- Giver does not realize capital gains at moment of gift (no sale = no gain)
- Recipient gets carryover basis (IRS Publication 551 rules)
- Future gains may be taxed at recipient's (potentially lower) rate
- This is "tax smart" but NOT a tax write-off

### Future Product Rails
- **Charitable giving**: Donating appreciated securities = real tax benefit (deduction + avoid cap gains)
- **529 contributions**: State-dependent tax benefits; "5-year election" superfunding option
- **Donor-Advised Funds**: Extension for "gift to causes they care about"

### Product Implications
1. **Clear labeling**: Distinguish "Gift" (true gift) from "Reimbursement" (could trigger tax)
2. **No over-promising**: Don't market tax benefits for personal gifts
3. **Disclosures**: Accurate language about what's happening (purchase → transfer)
4. **Backend separation**: Keep gift types conceptually separated for compliance

### UX Language
- Default: "Gifts are invested automatically into Future Fund"
- Toggle: "Hold gifts as Seed until I invest"
- Toggle: "Let givers choose from Favorites"
- Checkout: Big button "Gift to Future Fund" + small "More options" link