# Kado Design System Principles

This document separates:
- what is verified in platform guidance
- what is already true in this repo
- what is intentionally Kado-authored

It is not a copy of Apple or Google guidance. It is Kado's operating design brief.

## 1. Verified External Inputs

### Apple
Apple's Human Interface Guidelines emphasize:
- hierarchy
- harmony
- consistency
- native behaviors
- accessibility
- motion with clear purpose

For Kado this means:
- important financial information must be visually prioritized
- interactions should feel native and trustworthy on iPhone
- motion should explain, confirm, or guide, not decorate
- haptics and Live Activities are appropriate for meaningful moments

### Google
Google's recent Gemini and Material direction supports:
- warmth over sterile utility
- soft gradients and atmospheric depth
- fluid transitions instead of hard cuts
- motion that signals system activity and guidance

For Kado this means:
- warmth is not a gimmick, it is part of the product experience
- gradients and glow should be used to create emotional tone, not visual noise
- transitions should feel continuous and calm

## 2. Repo Reality

The current codebase already contains:
- a shared mascot component
- brand mascot assets
- a haptics utility
- gold-accent visual language across key surfaces
- warm loading and motion treatments in several flows

Relevant implementation references:
- [mascot.tsx](/abs/path/c:/Apps/Kora%20(newest)/client/src/components/ui/mascot.tsx)
- [brand-assets.ts](/abs/path/c:/Apps/Kora%20(newest)/client/src/lib/brand-assets.ts)
- [haptics.ts](/abs/path/c:/Apps/Kora%20(newest)/client/src/lib/haptics.ts)
- [KORA_DESIGN_GUARDRAILS.md](/abs/path/c:/Apps/Kora%20(newest)/KORA_DESIGN_GUARDRAILS.md)

So Kado is not starting from zero. The task is refinement and systemization.

## 3. Kado Principles

Kado's design system should be governed by four principles:

### Warmth
Kado should feel caring, optimistic, and human.

Use:
- warm neutrals
- selective glow accents
- soft gradients
- friendly illustration and celebration moments

Avoid:
- cold fintech sterility
- overly corporate grayscale
- cartoon energy on trust-critical screens

### Clarity
Parents should always understand what is happening with money, ownership, and next steps.

Use:
- explicit fee breakdowns
- strong information hierarchy
- plain language
- visible state changes

Avoid:
- decorative clutter near financial actions
- ambiguous labels
- hidden fee or plan context

### Trust
Kado must feel safe enough for a parent to use with their child's future.

Use:
- restrained motion on sensitive flows
- native-feeling controls
- consistent visual hierarchy
- accessibility-first contrast and focus states

Avoid:
- mascot-heavy trust surfaces
- playful visuals competing with compliance copy
- aggressive or flashy animation in checkout, settings, or billing

### Momentum
Growth, gifting, and milestones should feel alive.

Use:
- motion to show contributions landing
- subtle celebratory feedback
- progressive transitions instead of abrupt swaps
- state color to reinforce meaning

Avoid:
- long, blocking animations
- animation that delays core tasks
- movement without user benefit

## 4. Color Roles

Kado should treat color as a system, not decoration.

Suggested role mapping:
- Gold: upgrade, value, emphasis, celebratory highlights
- Green: successful contribution, positive completion, healthy state
- Amber: reminder, caution, pending status, notification warmth
- Deep neutral: primary text, high-trust surfaces
- Warm off-white: primary backgrounds and cards
- Soft accent tints: hover, focus, supportive depth

Rules:
- no critical state should rely on color alone
- gold should stay special and not become the default for everything
- green should mean success consistently

## 5. Motion Rules

Motion must always have a job.

Approved motion jobs:
- confirming an action
- guiding attention
- visualizing growth
- smoothing state transitions
- creating emotional payoff after a meaningful event

Rules:
- use `transform` and `opacity` first
- default to ease-in-out or other calm curves
- use overshoot sparingly for celebratory moments only
- respect `prefers-reduced-motion`
- never block a financial action behind animation

## 6. Haptic Language

Kado already has a haptic utility in code. It should be used intentionally.

Recommended language:
- `light`: small selection or tap feedback
- `selection`: toggles, tabs, segmented choices
- `medium`: important action initiated
- `success`: contribution completed, save completed, milestone reached
- `error`: failed action, rejected input, payment issue

Rules:
- success haptics should feel earned
- do not add haptics to every tap indiscriminately
- stronger haptics belong to meaningful moments, not routine browsing

## 7. Mascot Policy

The Kado character should be a product element, not the primary brand mark.

That means:
- the logo carries trust and brand recognition
- the character adds warmth inside the product
- the character should appear where emotion helps comprehension or delight

Primary launch placements:
- child view
- gift success / celebration moments
- selected empty states

Do not lead with the character on:
- pricing
- legal
- billing
- login
- FAQ/support
- blog/editorial index pages
- dense investment or settings surfaces

## 8. Surface Guidance

### Marketing Website
- instant, low-friction, content-first
- minimal loading theatrics
- the logo leads, not the character

### Parent App
- warmer loading
- richer motion
- more personality
- strong state feedback

### Gifter Checkout
- fastest path wins
- motion is secondary to speed and trust
- design must stay simple, readable, and calm on mobile

## 9. What To Build Next

Highest-signal design/system work from here:
- define a canonical color token map by role
- formalize haptic usage rules in component guidance
- standardize mascot placement rules
- create one reusable celebratory motion pattern for gifts and milestones
- add a platform-aware native roadmap for Live Activities and richer device feedback

## 10. Simple Rule

If a design choice improves warmth but hurts clarity or trust, reject it.

If a design choice improves clarity and trust while preserving warmth, it is probably right for Kado.
