# Kiddo Policies

> Last updated: 2026-05-10
>
> This directory contains Kiddo's written information-security and
> operational policies. They describe how the company *operates*, not
> how the code is *built* (that's `ARCHITECTURE.md`).
>
> **Maturity caveat:** these policies are written to match Kiddo's
> actual current state — single founder, no employees yet, pre-launch.
> Some controls described here ("annual training," "background checks
> on all hires," "quarterly access reviews") become operational at
> first hire. Until then they document the *intended* process so the
> on-ramp is clear when scaling begins.
>
> Policies are reviewed annually by the policy owner (the founder
> today; the security/compliance owner once that role exists). Material
> changes require sign-off from the same role.

## Policy index

| File | What it covers | Status |
|---|---|---|
| [security.md](security.md) | Information security policy — overarching framework | Active |
| [access-control.md](access-control.md) | Who gets access to what, MFA, access reviews, termination | Active (single-person scope) |
| [incident-response.md](incident-response.md) | How we detect, respond to, and learn from security incidents | Active |
| [vendor-management.md](vendor-management.md) | Vendor inventory, risk assessment, annual review | Active |
| [data-classification.md](data-classification.md) | Data sensitivity tiers and handling rules | Active |
| [change-management.md](change-management.md) | How code changes reach production safely | Active |
| [backup-and-recovery.md](backup-and-recovery.md) | Backup cadence, restore drills, RPO/RTO targets | Active |
| [sdlc.md](sdlc.md) | Secure development lifecycle — code review, dependency scanning, secrets handling | Active |

## Out of scope (today)

These policies will be added when the relevant role first exists at
Kiddo:

- Employee handbook / acceptable use (first hire)
- Security training program (first hire)
- Background check standard operating procedure (first hire)
- Mobile device management policy (first hire with company laptop)
- Physical security policy (first office)

## See also

- `SECURITY.md` (repo root) — public-facing security posture
- `ARCHITECTURE.md` (repo root) — technical implementation detail
- `PRODUCT.md` (repo root) — product strategy and locked decisions
- `incidents/` — incident log and templates
