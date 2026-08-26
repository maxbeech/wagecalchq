# Changelog

## 2026-08-26

- Refreshed the unpaid-wage demand-letter guide with a records checklist, settlement cautions, retaliation guidance, and current U.S. Department of Labor sources.
- Refreshed the on-call-pay guide with a direct answer and the DOL's current hours-worked guidance.

## Unreleased — GEO audit fixes

- **`llms.txt` added** (`public/llms.txt`): a machine-readable summary of what
  WageCoach is, plus links to every real route (tools, wage-claim guides,
  state/city data, blog, pricing, methodology) for AI answer engines. Was
  previously 404.
- **Machine-readable pricing (`/pricing`):** added a `SoftwareApplication` +
  `Offer[]` JSON-LD block with the free ($0), Claim Kit ($29) and Pro report
  ($19) tiers, matching the prices rendered on the page. This was the gap
  flagged by the 2026-07-10 SEO audit ("missing SoftwareApplication schema") —
  calculators and the homepage already emitted a $0 `Offer`, but nothing
  reflected the two paid products.
- **Site identity JSON-LD:** added `Organization` and `WebSite` schema to the
  homepage so answer engines can resolve "WageCoach" as an entity, alongside
  the existing `WebApplication` block.
- **Blog `Article` schema:** added `image` (the post's real hero image) and
  `mainEntityOfPage`.
- **README:** corrected the stale "apex not connected" canonical-host note
  (the custom domain has been wired for a while — `wagecoach.com` 308s to
  `www.wagecoach.com`) and documented the GEO surfaces above.

## Unreleased — Production readiness + Claim Kit improvements

- **Canonical host live:** `lib/site.ts` now points at `www.wagecoach.com` (the
  wired custom domain) instead of the Vercel host, so canonical tags, sitemap,
  robots and JSON-LD all reference the public domain. Checkout fallback host
  updated to match.
- **Lead delivery via Resend:** `app/api/lead/route.ts` now emails each
  free-case-review lead through Resend (`RESEND_API_KEY`, no SDK — raw `fetch`),
  with `reply_to` set to the worker. The `LEAD_WEBHOOK_URL` path is preserved, so
  both can run. New optional env: `RESEND_API_KEY`, `LEAD_TO` (default
  `hello@wagecoach.com`), `LEAD_FROM` (default `leads@wagecoach.com`). If a
  configured channel fails the user gets a clear fallback instead of a silent drop.

- **Blog imagery:** `components/BlogImage.tsx` — a dependency-free, ledger-styled
  SVG hero/thumbnail generated per post from its category (`lib/blog-images.ts`
  maps slug → `BlogCategory`). The blog index is now a two-column card grid with
  cropped thumbnails; each post renders a full-width hero. No external image
  fetches, so it adds zero runtime/network cost.
- **8 wage-recovery blog posts** added (`lib/posts.ts`, "WEEK3") — wage theft,
  filing a wage claim, DOL complaint, back pay, statute of limitations, demand
  letter, hiring an attorney, reporting wage theft — feeding the recovery funnel.
- **Deploy:** `npm run deploy` added (mirrors controlbook) — pulls production env,
  builds locally, and ships the prebuilt output with `vercel deploy --prebuilt --prod`.
- Lint clean: annotated the intentional hydration-safe client-only date effect in
  `ClaimKitPersonaliser.tsx` (`react-hooks/set-state-in-effect`).

- **Rebrand:** WageCalc HQ → **WageCoach** across all public copy, code, wordmark
  (`Logo`, favicon, OG image), `package.json`, emails (`hello@wagecoach.com`) and
  the canonical host (`wagecoach.vercel.app`). Repo + Vercel project renamed.
- **Positioning:** home, OG image, `lib/site.ts`, README and `CLAUDE.md` reframed
  to recovery-led — "Are you owed back pay? Find out to the cent." — with a new
  back-pay band on the homepage. The calculators remain the top-of-funnel.
- **Offering live:** Stripe products/prices created (test + live); the $29 Claim
  Kit now delivers — `app/claim-kit/page.tsx` verifies the Checkout session
  server-side (no DB) and renders a pre-filled demand letter + state filing guide
  from `lib/demand-letter.ts`. Checkout carries the case into the success URL.
- Env documented: `STRIPE_SECRET_KEY`, `STRIPE_KIT_PRICE_ID`, `STRIPE_PRICE_ID`,
  `NEXT_PUBLIC_SITE_URL`, `LEAD_WEBHOOK_URL`. Test keys in gitignored `.env.local`.
- **Demand-letter personalisation** (`components/ClaimKitPersonaliser.tsx`) — an
  interactive form on the Claim Kit success page lets the buyer fill in their name,
  address, phone, email, employer details and dates. The letter updates live in the
  browser; `personaliseLetter()` in `lib/demand-letter.ts` handles substitution.
  Zero-bracket counter shows how many placeholders remain before printing.
- **Analytics + Speed Insights** wired into `app/layout.tsx` — `@vercel/analytics`
  and `@vercel/speed-insights` were already in `package.json` but unused.
- **Vercel production env vars** set via CLI: `NEXT_PUBLIC_SITE_URL`,
  `STRIPE_KIT_PRICE_ID`, `STRIPE_PRICE_ID` (production environment).

## Earlier — Wage-claim / back-pay offering

A new paid direction: monetize the high-intent employee traffic the calculators
already attract ("I think I'm underpaid") rather than the low-volume employer
buyer. Grounded in keyword research (wage theft 5.4k/mo, back pay calculator
390/mo, department of labor complaint 2.4k/mo, "wage claim [state]" — CA 1.3k).

### Added

- **Back-pay engine** (`lib/backpay.ts`) — the inverse of the overtime engine.
  Estimates unpaid wages from what you earned vs. what you were paid, anchored to
  the FLSA recovery window (2 years, 3 if willful) plus equal liquidated damages.
- **Case-strength signal** (`lib/case-score.ts`) — a transparent triage score
  from the size, duration and recoverability of the shortfall.
- **Per-state wage-claim data** (`lib/wage-claim-data.ts`) — filing agency,
  official route and notable state penalties for all 50 states + DC.
- **Shareable case file** (`lib/backpay-url.ts`) — the estimate encodes to the URL,
  so a case is a link (no account/DB), matching the pay-calculator pattern.
- **Back-pay calculator** (`/calculators/back-pay-calculator`) with a verdict that
  surfaces the estimate, the case-strength signal, and CTAs to the Claim Kit and a
  free attorney review (`components/BackPayCalculator.tsx`, `BackPayResults.tsx`).
- **`/wage-claim` + `/wage-claim/[state]`** — index plus 51 programmatic state
  guides with an extractable answer, filing route, and `HowTo` / `FAQPage` /
  `BreadcrumbList` JSON-LD for SEO/GEO.
- **Free attorney case review** (`/free-case-review`, `components/CaseReviewForm.tsx`)
  posting to `app/api/lead/route.ts` (forwards to `LEAD_WEBHOOK_URL`, no storage).
- **$29 Claim Kit** as a second Stripe product; `app/api/checkout/route.ts` now
  takes `POST { product: "kit" | "report" }` (`STRIPE_KIT_PRICE_ID`).
- `test/backpay.test.mts` — 32 checks across the engine, score, URL and data.

### Changed

- Pricing page now shows three tiers: Free, Claim Kit ($29, workers), Pro ($19,
  employers). Header nav gains "Unpaid wages"; sitemap covers the new routes.

### Notes

- All figures are estimates / general information, not legal advice. Attorney
  lead-gen is bar-regulated; confirm the model with counsel before going live.
