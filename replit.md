# Everleaf

## Overview

Everleaf is a modern gifting platform that transforms traditional gifts into long-term investments. The core concept is "gifts that grow" - instead of giving cash or physical presents, contributors can give money that gets invested into a recipient's fund (typically for children through custodial accounts).

The platform consists of:
- **Fund Pages**: Permanent giving links for recipients (children or adults)
- **Moment Pages**: Event-specific pages (birthdays, bar mitzvahs, graduations, weddings) that link to the underlying fund
- **Contributor Checkout**: A frictionless flow for gift-givers (no account required, under 60 seconds)
- **Dashboard**: For parents/guardians to manage funds, events, and view contributions

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

### Frontend Libraries
- **QR Code Generation**: qrcode.react for shareable fund/event links
- **Date Handling**: date-fns
- **Form Handling**: react-hook-form with @hookform/resolvers

### Development Tools
- **Replit Plugins**: Cartographer, dev banner, runtime error overlay for enhanced Replit development experience