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
*   **Pricing Model**: Starts with a free tier, with upgrades (Plus per event, Family annual) for hosts to cover guest fees.

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