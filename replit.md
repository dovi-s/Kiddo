# Kora

## Overview

Kora is a gifting platform designed to transform traditional gifts into long-term investments, primarily for custodial accounts for children. It aims to become a leading consumer financial platform by providing a seamless experience for gifting and investing. The platform enables users to create investment funds (custodial UTMA for children, personal taxable for adults), link event pages to these funds for gift attribution, and manage the entire gift lifecycle from payment to settled investment. A key feature is its progressive onboarding, which allows immediate account and link creation, deferring identity verification (KYC) until investing features are activated.

## User Preferences

Preferred communication style: Simple, everyday language.
Writing style: Never use em dashes. Use periods, commas, or rewrite the sentence instead. Keep copy personal and grounded in real user experience.

## System Architecture

Kora facilitates financial gifting through individual investment funds and event-linked gift pages. The platform manages the entire gift lifecycle, from initial payment capture to investment settlement. Onboarding is progressive, allowing immediate account setup and gift pledging before KYC is required for investment activation. User roles include Gift-Giver, Parent/Host, Kid/Recipient, Adult Recipient, and Co-Parent/Family Admin. The dashboard provides a comprehensive view of funds, holdings, events, and activities. Child privacy is maintained through non-discoverability and link-only access for minors, with a child-friendly interface that avoids financial jargon.

Kora's pricing includes processing fees (paid by gift-giver) and a Kora Platform Fee per gift, which can be waived with subscription plans (Free, Starter, Family). Event Boosts offer premium features for specific events. Withdrawals are handled in accordance with UTMA laws for custodial accounts, ensuring funds are used for the child's benefit, while adult accounts have full control.

The technical stack is built on a monorepo architecture. The frontend uses React with TypeScript, Wouter, Tailwind CSS v4, shadcn/ui, TanStack React Query, and Framer Motion. The backend is a Node.js Express application with TypeScript. Data persistence is managed with PostgreSQL and Drizzle ORM, emphasizing end-to-end type safety.

The UI/UX is inspired by Google Gemini, focusing on softness, glow, ethereal blur, intentional motion, and a trustworthy fintech aesthetic. This design system is implemented through a custom component library featuring elements like `GeminiSparkle`, `SparkleBurst`, `SpectrumWave`, `EtherealCard`, and various animations for transitions and feedback.

## External Dependencies

*   **Database**: PostgreSQL (managed via `DATABASE_URL`)
*   **Payment Processing**: Stripe (checkout, subscriptions, webhooks, billing portal)
*   **Authentication & Sessions**: Passport.js (local strategy), express-session, connect-pg-simple
*   **Brokerage Integration**: DriveWealth, LLC (for KYC/AML, custody, clearing, settlement, fractional shares, tax reporting)
*   **Frontend Utilities**: qrcode.react, date-fns, react-hook-form with @hookform/resolvers