# WageCoach

**Check your pay. Recover what you're owed.** WageCoach helps U.S. workers find
unpaid wages and get them back. It pairs free **wage & hour calculators** — overtime
and time-and-a-half pay, minimum wage by state, tipped-wage checks, exempt-salary
tests, PTO payout and final-paycheck deadlines — with a **back-pay estimator** and
step-by-step **wage-claim** help for every state, all built on the federal **FLSA**
and **2026** state rules for all 50 states and DC.

**Positioning (set in this product cycle):** the free calculators attract a large
employee audience (overtime/paycheck searches); WageCoach monetizes *that* audience at
the highest-intent moment — "am I owed back pay?" — rather than chasing the low-volume
employer buyer. The funnel is: free calculator → back-pay verdict → **$29 Claim Kit**
(a pre-filled demand letter + filing guide) and a **free attorney case review**
(lead-gen). The legacy **$19 employer report** remains as a secondary product.

Live: https://www.wagecoach.com

## Content maintenance

Blog guides are defined in `lib/posts.ts`. Substantive refreshes should preserve the post schema, use primary sources for time-sensitive wage-law claims, and update the post date only when the reader-facing content materially changes.

## Stack

- Next.js 16 (App Router) + React 19
- Tailwind CSS 4
- 100% client-side calculation engines (no DB needed for the free tools)
- tsx unit tests

## Design

The identity is a working payroll ledger: warm paper, ink-green, a brass accent,
hairline rules and tabular figures. Headings use **Fraunces** (an editorial
serif), with **Geist** for UI and **Geist Mono** for every dollar figure (loaded
via `next/font`). Design tokens live in `app/globals.css` (`paper`, `ink`,
`muted`, `faint`, the `brand-*` green scale, `forest`, `gold-*`, plus the
`ledger-grid`, `leader` and `shadow-card` utilities). Shared presentational
atoms are in `components/primitives.tsx`; the homepage hero is a live,
draggable paystub (`components/HeroPaystub.tsx`) that runs the real overtime
engine, so even the illustration shows genuine numbers.

The page is composed to break the "metronome" of equal-weight sections: an
annotated **interactive overtime bar** (`components/illustrations/OvertimeBar.tsx`,
drag the week past 40 and the premium lights up), a ledger-style index of the
calculators, and a full-bleed dark **wage spectrum**
(`components/illustrations/WageSpectrum.tsx`, every state plotted by its real 2026
minimum wage with a live rate sheet). Both illustrations are driven by the actual
engines, never mock data. Motion is opt-out aware: `components/Reveal.tsx` adds
scroll-entrance fades and `useCountUp` tallies dollar figures, both disabled under
`prefers-reduced-motion`. The single "read more" affordance is `MoreLink` (a
chevron + underline reveal) — there are no decorative `→` arrows anywhere.

## What's real

The engines are real and cited, not rules of thumb:

- **`lib/federal.ts`** — FLSA constants ($7.25 min wage, $2.13 tipped cash wage,
  1.5× overtime over 40, $35,568 exempt threshold).
- **`lib/overtime.ts`** — FLSA weekly overtime + state daily overtime (CA/AK/NV/CO),
  California double time and the 7th-consecutive-day rule, with weekly reconciliation.
- **`lib/states-data.ts`** — 2026 minimum & tipped wages and daily-overtime rules,
  cross-checked across the U.S. DOL, GovDocs, Paycom and Paycor.
- **`lib/state-extras.ts`** — final-paycheck deadlines and meal/rest-break rules,
  compiled from state labor departments and reputable compliance references.
- **`lib/wage.ts`** — tip-credit check, exempt salary test, PTO payout. The
  exempt test applies the **higher state thresholds** (CA/AK/ME by formula; NY,
  WA and CO by their verified 2026 figures) and returns a neutral "confirm"
  verdict where the answer is location-dependent (e.g. NY between the
  rest-of-state and downstate figures) rather than a false "exempt".
- **`lib/salary.ts`** — salary↔hourly converter (annual / monthly / biweekly / hourly).
- **`lib/cities.ts`** — 2026 minimum wage for 20 major cities (Seattle, NYC, LA, SF, Chicago…), each cited.
- **`lib/backpay.ts`** — back-pay estimator. The inverse of the overtime engine: given
  what you should have earned and what you were paid, it estimates the unpaid wages and
  the FLSA recovery window (2 years, or 3 if willful) plus equal liquidated damages.
- **`lib/case-score.ts`** — a transparent "case-strength" triage signal from the size,
  duration and recoverability of the shortfall (not a legal opinion).
- **`lib/wage-claim-data.ts`** — per-state wage-claim agency, official filing route and
  notable state penalties, used by the `/wage-claim/[state]` guides.

The engines are covered by hand-written unit tests **plus a fuzz suite** that sweeps every
state × rate × hours combination (33k+ cases / 150k+ assertions) to guarantee no NaN, no
negative pay, and that totals always reconcile.

Every figure is current for 2026 and surfaced with a "confirm with your state labor
department" disclaimer. See `/methodology` for sources.

## Develop

```bash
npm install
npm run dev      # http://localhost:3000
npm test         # engine + data + URL tests
npm run lint
```

## Paid offering

Two one-time products, both through the same graceful Stripe route
(`app/api/checkout/route.ts`, `POST { product }`):

- **Claim Kit — $29** (`product: "kit"`, `STRIPE_KIT_PRICE_ID`). For workers. The funnel is
  the free **back-pay estimator** (`/wage-claim`, `/calculators/back-pay-calculator`): the
  verdict surfaces the estimate, a case-strength signal, and two CTAs — the Claim Kit and a
  **free attorney case review**. After payment, Stripe returns to **`/claim-kit`**, a
  `force-dynamic`, noindex page that **verifies the Checkout session server-side** (no DB —
  the session id is the proof) and renders the deliverable from `lib/demand-letter.ts`: a
  demand letter pre-filled with the buyer's figures plus a state filing guide.
- **Pro report — $19** (`product: "report"`, `STRIPE_PRICE_ID`). For employers: the
  multi-state wage & hour compliance report.

The checkout route degrades gracefully when `STRIPE_SECRET_KEY` or the relevant price id is
absent. The free attorney review (`/free-case-review`) posts to `app/api/lead/route.ts`,
which forwards leads to `LEAD_WEBHOOK_URL` (an attorney-network/CRM intake) when set and
otherwise confirms without storing anything — the site stays database-free.

### Environment

| Var | Purpose |
| --- | --- |
| `STRIPE_SECRET_KEY` | Stripe API key (test `sk_test_…` for dev, live `sk_live_…` in prod). Also used to verify the kit Checkout session. |
| `STRIPE_KIT_PRICE_ID` | Price id for the $29 Claim Kit. |
| `STRIPE_PRICE_ID` | Price id for the $19 Pro report. |
| `NEXT_PUBLIC_SITE_URL` | Canonical base for Stripe success/cancel URLs (e.g. `https://www.wagecoach.com`). |
| `LEAD_WEBHOOK_URL` | Optional. Where free-case-review leads are POSTed (CRM/Zapier/attorney intake). |

Local dev: copy the keys into `.env.local` (gitignored). Use Stripe **test** keys + test
price ids there; set the **live** values only in the Vercel project's env.

### SEO/GEO

The wage-claim work is built to grow on the highest-intent terms the keyword research
surfaced ("wage theft", "back pay calculator", "how to file a wage claim [state]",
"department of labor complaint"). `/wage-claim/[state]` renders 51 programmatic guides with
an extractable one-paragraph answer, the filing agency, the federal window, `HowTo` +
`FAQPage` + `BreadcrumbList` JSON-LD, and the embedded estimator — the shape answer engines
quote. New env vars: `STRIPE_KIT_PRICE_ID`, `LEAD_WEBHOOK_URL`.

> Self-help information, not legal advice, and not a law firm.

## Canonical host

`lib/site.ts` sets `SITE.url` to `https://www.wagecoach.com` — the wired custom
domain, which is what actually serves the site. It drives every canonical tag,
the sitemap, robots and all JSON-LD URLs. The apex `wagecoach.com` 308-redirects
to `www.wagecoach.com`.

## GEO surfaces (AI answer engines)

- `public/llms.txt` — machine-readable overview of the product and its real
  routes, per the [llms.txt](https://llmstxt.org/) convention.
- `app/robots.ts` allows all user agents (including GPTBot, ClaudeBot,
  PerplexityBot, Google-Extended, CCBot) by not restricting anything.
- JSON-LD: `Organization` + `WebSite` on the homepage, `SoftwareApplication`
  on every calculator and `/pricing` (with `Offer`s matching the visible $0 /
  $29 / $19 prices), `Article` on blog posts, `FAQPage` wherever `Faq` is used,
  `HowTo` + `BreadcrumbList` on `/wage-claim/[state]`, `BreadcrumbList` on
  `/calculators/[slug]`, `/states/[slug]` and `/cities/[slug]`.

> General information, not legal or tax advice.
