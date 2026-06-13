# Kiddo — IP Strategy & Risk Memo

**Status:** strategic framing for IP counsel. NOT legal advice (author is not an
attorney). Goal: walk into a 1–2 hour IP-counsel engagement with the decisions
pre-made and the cheap-but-urgent items already done, so the spend is small and
the coverage is right for a bootstrapped, pre-PMF company.

**Governing discipline (from `COMPANY_STRATEGY.md`):** prove the loop to
funded-k≥1 before raising. So IP spend must be *minimal and sequenced* — do the
cheap/urgent things now, defer the expensive portfolio work until there's
capital and a reason. Most of "the startup should patent everything" instinct is
wrong for us; see §4.

---

## 0. TL;DR — the four things that actually matter

1. **🔴 URGENT, ~free to fix: the demo infringes Disney's *Modern Family* IP.**
   The Dunphy demo *is* the Modern Family cast and family tree (Phil/Claire/
   Luke/Alex/Haley Dunphy, Jay/Gloria Pritchett, Mitchell/Cameron Tucker, Lily,
   Manny, Joe). It's our **public-facing conversion surface** (creator links
   land there). That's unlicensed commercial use of copyrighted fictional
   characters by the most litigious IP holder on earth. **Rename before any
   public/creator launch.** The relationship *structure* (the part that sells
   the product) isn't copyrightable — only the names/characters are. Fix = a
   rename pass, not a redesign. **This is the #1 item.** (§1)

2. **🟡 "Kiddo" is a weak trademark.** It's a common dictionary word →
   crowded register, clearance risk, narrow protection. The `Kora → Kiddo`
   rename traded brand strength for warmth. Don't over-invest in the *word*;
   the defensible assets are the **logo + stylized wordmark + trade dress.**
   Clearance search first. (§2)

3. **🟢 Patents are a trap here — mostly skip them.** Our innovations are
   business-method / UX (gifter loop, Memory Book, at-majority handoff) →
   barred by *Alice*, expensive, slow, easily designed around, and a capital
   burn that violates the bootstrap discipline. (§4)

4. **The real moat isn't registrable IP at all** — it's **trade secrets +
   switching cost + the relationship data graph.** Protect those with
   confidentiality, access control, and a private repo, not a patent. (§5)

---

## 1. 🔴 The *Modern Family* demo — the urgent one

**The exposure.** `script/seed-dunphys.ts` + the demo populate a faithful
reproduction of the *Modern Family* character universe — exact names, exact
relationships (Jay m. Gloria; Manny is Gloria's son; Claire is Jay's daughter
m. Phil with Haley/Alex/Luke; Mitchell is Jay's son m. Cameron with Lily). The
demo is described in our own code/memos as the **distribution/conversion
surface** that creator-outreach links point to — i.e. **public marketing**, not
an internal sandbox.

**Why it's a real risk, not paranoia.**
- Fictional characters with distinctive, developed identities are protected by
  **copyright**; the names/franchise carry **trademark** weight too.
- *Modern Family* is 20th Television / **Disney** — the most aggressive IP
  enforcer in the industry.
- **Fair use almost certainly fails** here: the use is **commercial**
  (marketing/conversion), the works are **creative**, we use the **entire
  cast**, and it's not parody/commentary. Four factors lean against us.
- "It's just a demo" doesn't help — it's a *commercial* demo on a *public*
  surface.

**The fix (cheap, preserves all value).** Rename every persona to **original**
names while keeping the **relationship roles** that make the demo sell:
- a warm multi-generational **blended family** (these roles are *ideas/facts* —
  not protectable);
- the **grandfather super-gifter** who shows up for grandkids across two
  households (demos cross-family grouping);
- a **step-grandmother**, **co-parents**, a **graduated/handed-off** young
  adult, an **office/“neighbor/aunt”** one-off gifter, an **anonymous** gift.
- Keep the *structure*, the gift cadence, the notes (translate Gloria's Spanish
  notes to an original abuela persona) — just swap the **names**.

**Action:** a `seed-*.ts` rename pass + sweep of persona-specific copy, before
public/creator launch. Medium effort, zero design change. **Do this first.**
(Bonus: also removes the "we don't own dunfyfamily.com" email-domain oddity —
pick an original demo family + a domain we control or a clearly-fake TLD.)

---

## 2. 🟡 Trademark strategy

**The brand name.** "Kiddo" is **suggestive** (evokes the audience, doesn't
describe the service) so it's *registrable in principle* — but it's a **common
word**, which means:
- a **crowded register** (many "Kiddo" marks across classes → clearance risk;
  there may be a blocker in fintech/Class 36 or software/Class 9);
- **narrow scope** even if registered (hard to stop others using "kiddo"
  loosely).

The `Kora → Kiddo` change (per memory, founder-driven for clarity) traded a
**distinctive/arbitrary** mark ("Kora" — stronger, easier to clear/own) for a
**warm/common** one. That's a defensible product call — but go in eyes-open:
the *word* "Kiddo" will be a weaker asset.

**So prioritize the defensible assets:**
- **Logo / design mark** (the sprout + the Bricolage wordmark treatment) —
  inherently more distinctive than the word alone.
- **Composite mark** (word + logo) often clears more easily than the bare word.
- **Trade dress** (the evergreen/gold/cream palette + UI patterns) — a *future*
  asset once it acquires distinctiveness; not filed now.

**Classes (US, file lean):**
- **Class 36** — financial services (custodial/investment/gifting). *Core; file
  first.*
- **Class 9** — downloadable app software. *File with 36.*
- **Class 42** — SaaS/platform. *Add later.*

**Sequence:**
1. **Clearance search** (knockout + full) on "Kiddo" in 36/9/42 — **before**
   spending on filings or more brand investment. ~$300–1.5k via counsel; or a
   free TESS knockout to triage.
2. If clear → file **intent-to-use (1(b))** or use-based (1(a)) for the
   **composite mark** in 36 + 9. ~$250–350 USPTO fee/class + ~$1–2k counsel.
3. If blocked → options: coexist, add a distinguishing element
   (e.g. "Kiddo Invest" / a logo-forward mark), or **keep `Kora` as a defensive
   fallback** (don't let the old mark/domain lapse if it was ever filed/used).
4. **Defensive non-IP grabs (do now, ~$100s):** the canonical domain + typos +
   `.co/.app`, social handles, App Store / Play Store names.

**Watch:** competitors copy our *messaging* (per memory, EarlyBird runs
near-identical copy). Slogans are weak marks; the durable defense is the
**distinct voice** (already locked) + trade dress, not a tagline registration.
Set a basic **trademark watch** post-filing.

**🟡 Alternative-name evaluation (2026-06-12, "Later" / `later.fund` floated).**
Decision-support only; confusion analysis is an attorney's call. Findings (USPTO
records verified via uspto.report + Justia; *not* yet pulled from TSDR by counsel):
- **"Later" for a fintech = high trademark risk — recommend against.** Acorns Grow
  owns **`ACORNS LATER®` (Reg. 5,552,405)** and **`ACORNS EARLY®` (Reg. 6,828,343)**;
  **Acorns Early Invest is a UTMA/UGMA custodial account** — the *identical* service
  to ours. Acorns owns the *compound* marks (dominant element "ACORNS"), so it's not
  an automatic block, but a bare "Later" custodial-investing brand shares the
  life-stage term with a registered mark over identical services → real
  likelihood-of-confusion / TTAB-opposition vector, and Acorns is the party with both
  standing and motive. Second front: **Later.com (Victory Square Media)** holds
  `LATER` / `LATER SOCIAL` software marks + the "Later" App Store listing name.
- **The word "fund" in a brand/URL (`kiddofund.com`) is low legal risk.** The
  Investment Company Act **Names Rule (Rule 35d-1)** and **§35(d)** bind *registered
  investment companies/BDCs* — not arbitrary brands using "fund" as a verb (Cornell
  Law 17 CFR 270.35d-1; SEC release 2023-188; K&L Gates). Residual exposure is the
  general "materially misleading impression" principle. **Mitigations:** never name
  the *legal entity* or the *account product* "The Kiddo Fund," keep "fund" in the
  verb/marketing sense, disclose the real structure (custodial UTMA brokerage account
  via the custodian). Note: a bare **`.fund` TLD** reads as the *noun* ("the Later
  fund") and the registry markets it *for* investment funds → slightly worse than
  `kiddofund.com` on `.com`, which reads as the verb.
- Add to §8 counsel questions: pull TSDR on `ACORNS LATER`/`ACORNS EARLY` +
  any `KIDDO` Class 36 marks; bless the "fund"-as-verb wording + disclaimer.

---

## 3. Copyright

- **Automatic** on creation — no filing needed for protection. Registration only
  buys **statutory damages + standing to sue**; relevant only if we'd ever
  litigate a copier.
- **What's worth it (later, cheap, selective):** the **distinctive marketing
  copy / positioning voice**, the **educational SEO content** (51-state UTMA
  pages, `/compare` pages — real, copyable assets), the **demo** (once
  de-Disney'd), key **UI screens/illustrations**. Register a *bundle* of the
  highest-value, most-copyable pages if/when a copier appears.
- **Source code:** technically copyrightable but rarely registered (it changes
  daily, and registration forces a deposit). **Trade-secret + private repo is
  the real protection** (§5).
- **⚠️ AI-generated-code nuance:** the US Copyright Office holds that **purely
  AI-generated** output has **no human author → not copyrightable.** Much of this
  codebase is AI-assisted (Claude Code). This does **not** hurt the business:
  (a) the **human-directed selection, architecture, edits, and arrangement** are
  protectable; (b) **trade secret** protects the whole repo regardless of
  authorship; (c) it only matters in the rare case of registering code to sue a
  verbatim copier. Just **don't claim blanket copyright on AI-only files** in any
  future IP rep/warranty during diligence — disclose the AI-assisted nature.

---

## 4. 🟢 Patents — the contrarian (correct) take: mostly skip

The reflexive startup move is "patent the gifter loop." **Don't.** Here's why:
- **Subject-matter bar (*Alice/Mayo*):** the loop, the Memory Book, the
  at-majority handoff are **business methods / abstract ideas implemented on a
  generic computer** → the exact category the Supreme Court made (effectively)
  unpatentable. High rejection risk.
- **Cost/time vs. our stage:** ~$15–30k each, 2–4 years. That's a direct
  violation of the "don't burn capital pre-funded-k" discipline.
- **Weak as a moat:** software patents are **designed around** easily, and they
  **publish your playbook** to competitors.
- **Our actual moat is unpatentable anyway** (§5) and **stronger** than a patent.

**The only patent worth a thought:** if there is a *genuinely novel,
non-obvious, technical* mechanism (NOT a business method) — e.g. a specific
technical method for the custodial **handoff/ownership-transfer + data-migration
+ collaborator-revocation** flow, or a gift-graph **attribution** primitive —
a **cheap provisional** (~$2–5k, holds priority 12 months, "patent pending")
could be a **defensive option / fundraising signal.** Even this is *optional*
and likely deferrable. **Recommendation: file no patents now.** Revisit only if
(a) a specific investor/acquirer values one, or (b) a clearly novel technical
mechanism emerges that's worth a provisional.

---

## 5. Trade secrets + the *real* moat

Per `MOAT_MEMO.md`: the moat is **counter-positioning** ("the gifter is our
customer, everyone else's cost") + the **Memory Book switching cost** + the
**relationship/gift data graph** + the near-zero-CAC loop. **None of these are
registrable IP — and that's fine; they're better than IP.** Protect them as:
- **Trade secrets:** the k-factor mechanics, loop/conversion optimization, the
  **relationship & gift graph**, gifter-behavior data, the demo-sandbox logic,
  projection/engine internals. Protected by: **private repo, access controls,
  NDAs, confidentiality clauses, no public disclosure.** (Trade secret has *no
  expiry* and *no filing cost* — but is lost the instant it's disclosed.)
- **Switching cost = contract + data lock:** the un-ACAT-able **Memory Book** is
  defended by the **ToS** + the fact that the *data* (notes/photos/voice/the
  relational record) can't be exported to a competitor. Make sure the **ToS**
  has anti-scraping, no-reverse-engineering, and clear data-ownership terms.
- **The handoff-as-CAC-free-acquisition + the gift graph** are competitive
  assets to *keep quiet*, not to publish in a patent.

---

## 6. Foundational hygiene (cheap, often skipped, diligence-critical)

- **IP assignment:** every founder + every contractor must **assign all IP to
  the entity** (founder IP-assignment agreements; contractor agreements with
  work-for-hire + present assignment of inventions). Missing this is the
  classic fundraising/acquisition **red flag** — a past contractor can cloud
  title. Template-cheap; do it once. (If solo + no contractors yet, do it the
  moment anyone else touches the code.)
- **Entity owns everything:** domains, social handles, repos, design files,
  Figma, the brand assets — all under the **company**, not a personal account.
- **Open-source license compliance:** quick audit of deps (React, Drizzle,
  Recharts, framer-motion, Radix, etc. — mostly **MIT/permissive**, fine, but
  confirm **no copyleft/GPL** contamination and keep attributions). Low risk,
  one-time check.
- **Privacy/data law (regulatory, IP-adjacent):** we collect **child PII**
  (name, photo, DOB). **COPPA** + state privacy laws apply even though kids
  don't hold accounts (parents do). Already on the `COUNSEL_ENGAGEMENT_PACKET`
  radar — keep it there; it's a *legal-gate* sibling to IP, handled by
  privacy/regulatory counsel, not the IP attorney.
- **Fabricated testimonials (per full-audit memo):** named fake testimonials are
  an **FTC + right-of-publicity + defamation** risk. Not "IP" per se but a
  legal-content liability on marketing surfaces. Remove/replace before launch.

---

## 7. Prioritized action plan (cost-aware, bootstrap-sequenced)

**Now — cheap & urgent (≈ $0–1k + our own time):**
1. **De-Disney the demo** (rename personas; keep structure). *Engineering, free.*
2. **Trademark knockout search** on "Kiddo" (free TESS triage → then paid full
   clearance if it survives). 
3. **Defensive grabs:** domain variants, handles, store names. (~$100s)
4. **IP-assignment agreements** for any non-solo contributors. *Template.*
5. **Confirm the entity owns** all domains/repos/design accounts.
6. **Remove fabricated testimonials.**

**Soon — small spend, once the loop shows signs (≈ $2–5k):**
7. **File the composite trademark** (Kiddo + logo) in **Class 36 + 9** (ITU if
   not yet in commerce nationally). 
8. **ToS hardening** (anti-scrape, no-reverse-eng, data ownership). 
9. **Open-source license audit.**

**Later — with capital / post-funded-k (defer):**
10. Add **Class 42**, international (Madrid) if expanding.
11. **Selective copyright registrations** (top SEO/marketing assets) — only if a
    copier appears.
12. **Trademark watch service.**
13. **Provisional patent** — *only* if a genuinely novel technical mechanism or
    a specific investor demand materializes.

**Explicitly NOT doing now:** full patent filings, broad copyright registration,
international portfolio, monitoring services. (All capital burn pre-PMF.)

---

## 8. Questions for IP counsel (make the hour count)

1. Confirm the **Modern Family demo** exposure + bless the rename as sufficient.
2. **"Kiddo" clearance** in 36/9/42 — blockers? Recommend word vs composite vs
   logo-forward? Worth keeping **Kora** as a defensive fallback?
3. **Filing basis** (1(a) use vs 1(b) ITU) given our pre-launch state.
4. **AI-generated-code** posture for future IP reps/warranties — what to
   disclose, what's protectable.
5. **Contractor/founder IP-assignment** templates that survive diligence.
6. Is there **one** technical mechanism worth a cheap **provisional**, or skip
   patents entirely? (Lead with: we expect "skip.")
7. **ToS terms** that best protect the Memory Book switching cost as a data lock.

---

*Bottom line: the urgent, cheap move is renaming the demo off Disney IP. The
strategic move is to under-invest in patents/registrations, over-invest in
trade-secret + brand (logo/trade dress) protection, and keep all IP spend
sequenced behind funded-k — because our moat was never going to be a patent.*
