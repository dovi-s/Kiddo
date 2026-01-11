# Everleaf

## Overview

Everleaf is a modern gifting platform that transforms traditional gifts into long-term investments. The core concept is "gifts that grow" - instead of giving cash or physical presents, contributors can give money that gets invested into a recipient's fund (typically for children through custodial accounts).

## The 3-Layer Model

Understanding the product requires knowing these three layers:

| Layer | What it is | Who sees it |
|-------|------------|-------------|
| **Layer 1: Everleaf** | The UI + gifting/registry layer. Creates pages, runs checkout, stores messages, runs thank-you flows, shows "where it's invested" | Everyone |
| **Layer 2: Brokerage Account** | The real securities account at Apex/DriveWealth where cash + shares actually sit. Gets SIPC coverage. | Hidden from users |
| **Layer 3: Clearing/Custody** | Regulated entity handling KYC/AML, custody, trade execution, statements, tax docs | Users never think about this |

**Key insight**: Users only see Layer 1 (Everleaf). They never need to know what Apex is.

## Core Concepts

### What is a "Fund"?

**One Fund = One Brokerage Account**

- "Mila's Fund" = a UTMA custodial account at Apex
- "My Fund" = a personal taxable account at Apex
- "Wedding Fund" = a joint or individual taxable account

A Fund is the "container" that maps to one brokerage account. V1 supports only:
- **Custodial UTMA** (for kids)
- **Personal taxable** (for adults)

No IRAs, no external account linking (Schwab/Fidelity) in v1.

### Pages vs Funds

Pages are public-facing "skins" that route gifts into the same Fund:

```
Fund (Mila's UTMA Account)
├── everleaf.com/mila (Open anytime)
├── everleaf.com/mila/5th-birthday
├── everleaf.com/mila/kindergarten-graduation
└── everleaf.com/mila/bar-mitzvah
```

**All pages route to the same Fund.** Pages are just attribution labels for thank-yous. You do NOT open a new brokerage account per event.

### Gift Lifecycle

1. **Gift received** → Shows as "Pending" (payment captured)
2. **Market opens** → Everleaf places buy order via broker
3. **Trade settles** → Status updates to "Invested"
4. **Holdings appear** → Visible at Fund level in "Where it's invested"

If markets are closed (weekend): "Will invest when markets open"

### Holdings Location

Holdings are always at the **Fund level** (because that's the brokerage account).

- "Where it's invested" = Fund
- "Contributions and notes" = Fund and Event
- "Event totals" = Event

Events are attribution layers, NOT separate portfolios.

## User Flows

### 1. Gift-Giver (no account, 60 seconds)
1. Opens link → Sees event page
2. Picks amount ($25, $50, $100, custom)
3. Picks type: "Future Fund" (default basket) OR "Pick a stock"
4. Adds name + note
5. Pays (Apple Pay/card)
6. Sees "Gift pending - will invest when markets open"
7. Done. No account needed.

### 2. Parent/Host (account owner)
1. Creates Fund (for child or self)
2. Completes identity verification (KYC)
3. Creates event pages
4. Shares links/QR codes
5. Dashboard shows: Total, Invested vs Cash, Recent gifts
6. Sends thank-yous

### 3. Kid/Recipient (read-only "Story Mode")
- Sees total, milestones, messages
- Can't trade or withdraw
- Like a digital scrapbook with a balance

### 4. Adult Recipient (self-directed)
- Same as parent but no custodian
- Creates their own Fund
- Uses for wedding, milestone birthday, etc.

### 5. Co-Parent/Family Admin
- Invited as collaborator
- Can: View, create events, send thank-yous
- Can't: Change settings, withdraw

## Key Scenarios

| Scenario | What happens |
|----------|--------------|
| Gift on Saturday | Shows "Pending" → Monday 9:30am auto-invests → Updates to "Invested" |
| Seed Mode | Gifts stay as cash → Parent clicks "Invest Now" after event |
| 2 kids | 2 separate Funds → Dashboard has fund switcher |
| Pick a stock | Contributor picks Disney → Payment clears → Buy order placed → Shares appear |

## Dashboard IA

```
[Fund Switcher: Mila ▾ | Noah | Me]

Total Balance: $4,250
├── Invested: $3,800
├── Cash: $450
└── Pending: $180 (pulsing indicator)

[Holdings] - Fund level
• VTI - US Total Market
• VXUS - International
• DIS - Disney
• AAPL - Apple

[Events] - Share/QR per row
• Open anytime - $2,180
• 5th Birthday - $1,420

[Activity] - Status per gift
• Dave Chen → 5th Birthday (+$180) [Pending]
• Ruth Stein → Open anytime (+$500) [Invested]

[Quick Actions]
1. Share link (primary)
2. Create event page
3. Send thank-yous (3 pending)
4. Send a gift (secondary)
```

## Platform Architecture

The platform consists of:
- **Fund Pages**: Permanent giving links for recipients
- **Event Pages**: Occasion-specific pages that route to the underlying fund
- **Contributor Checkout**: Frictionless 60-second flow (no account required)
- **Dashboard**: For parents/guardians to manage funds and send thank-yous

The business model involves platform fees on gifts (capped percentages), with optional subscription tiers for hosts who want fee-free gifting for their guests.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture
- **Framework**: React with TypeScript
- **Routing**: Wouter (lightweight React router)
- **Styling**: Tailwind CSS v4 with custom design tokens for a "premium, calm, established" brand feel
- **UI Components**: shadcn/ui (New York style) with Radix UI primitives
- **State Management**: TanStack React Query for server state
- **Animations**: Framer Motion for micro-interactions and page transitions
- **Build Tool**: Vite with custom plugins for Replit integration

### Backend Architecture
- **Runtime**: Node.js with Express
- **Language**: TypeScript (ESM modules)
- **API Pattern**: RESTful endpoints prefixed with `/api`
- **Development**: Hot reload via Vite middleware integration

### Data Layer
- **ORM**: Drizzle ORM with PostgreSQL dialect
- **Schema Location**: `shared/schema.ts` (shared between frontend and backend)
- **Validation**: Zod schemas generated from Drizzle schema via drizzle-zod
- **Storage Interface**: Abstracted through `IStorage` interface in `server/storage.ts` (currently in-memory, designed for easy database swap)

### Project Structure
```
client/           # Frontend React application
  src/
    components/   # Reusable UI components
    pages/        # Route-based page components
    hooks/        # Custom React hooks
    lib/          # Utilities and query client
server/           # Backend Express application
  index.ts        # Entry point
  routes.ts       # API route registration
  storage.ts      # Data access layer
shared/           # Code shared between client and server
  schema.ts       # Database schema and types
```

### Key Design Decisions
1. **Monorepo Structure**: Client, server, and shared code in one repository with path aliases (`@/`, `@shared/`)
2. **Type Safety**: End-to-end TypeScript with shared schema types
3. **Component Architecture**: shadcn/ui components are copied into the project (not imported from a package) for full customization
4. **Build Process**: Custom build script bundles server with select dependencies to optimize cold start times

## External Dependencies

### Database
- **PostgreSQL**: Primary database (configured via `DATABASE_URL` environment variable)
- **Drizzle Kit**: Database migrations stored in `/migrations`

### Payment Processing
- **Stripe**: Payment processing for gift contributions (dependency present in package.json)

### Authentication & Sessions
- **Passport.js**: Authentication framework with local strategy
- **express-session**: Session management
- **connect-pg-simple**: PostgreSQL session store

### Brokerage Integration (Embedded Broker Model)
Everleaf uses an embedded broker-dealer model where:
- **Broker Partner**: Apex Clearing or DriveWealth acts as the broker-dealer of record
- **What Partner Handles**: KYC/AML, identity verification, custody, clearing, settlement, tax reporting, brokerage statements, SIPC membership
- **What Everleaf Handles**: Front-end UX, event registry, payments, gift cards, thank-you system, templates, customer relationships
- **Key Messaging**: "Brokerage services provided by [Partner], member FINRA/SIPC"

Accounts opened "inside Everleaf, powered by [Partner]" - users never leave the Everleaf experience.

### Compliance (Everleaf Responsibilities)
Even with an embedded broker partner, Everleaf must handle:
- **Marketing/Product Compliance**: All claims, disclosures, no performance promises
- **Payment Fraud Controls**: Chargebacks, velocity limits, risk scoring, disputes
- **Data Security**: Encryption, access control, audit logs, SOC 2-ready controls
- **Customer Support**: Complaint workflows, response times, recordkeeping
- **Insurance**: Cyber liability, crime/fraud coverage, E&O, D&O, general liability

### User Roles & Permissions
- **Guardian/Parent**: Creates account, manages children's funds, receives thank-yous
- **Child/Recipient**: Has fund in their name, receives gifts (custodial account)
- **Adult User**: Self-directed account holder
- **Guest Contributor**: Gives gifts without creating account (60-second checkout)

### UX Priorities
- **Fee Transparency**: Separate "Processing (payment processor)" vs "Platform fee" line items
- **Trust Signals**: Every page shows "No account required • Apple Pay • Secure checkout"
- **Performance**: <2 second page loads, no reloads during checkout
- **Thank-You Automation**: Draft suggestions, reminders, optional video thank-yous
- **Milestones**: Celebrate first $500, 10 contributors, one-year anniversary

### Phase 2 Features (Planned)

**Payback Feature** - Turn Everleaf from "events only" to everyday use:
- When you owe someone money (covered dinner, split a bill), offer to pay back to their Fund instead of cash
- Two destinations only: **Cash** or **Their Fund** (recommended)
- NO stock picking in payback - keeps it simple, avoids timing/price confusion
- Default to "Add to your Fund" - one-tap to confirm
- Increases usage frequency without complicating the core product
- Implementation: same rails as gifting (money → account → invests per their default rules)

### Frontend Libraries
- **QR Code Generation**: qrcode.react for shareable fund/event links
- **Date Handling**: date-fns
- **Form Handling**: react-hook-form with @hookform/resolvers

### Development Tools
- **Replit Plugins**: Cartographer, dev banner, runtime error overlay for enhanced Replit development experience