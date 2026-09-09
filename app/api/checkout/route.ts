import { NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";

// Stripe Checkout for the one-time products: the $19 multi-state compliance
// report and the $29 wage Claim Kit. Keys are injected as Vercel env vars
// (STRIPE_SECRET_KEY plus STRIPE_PRICE_ID / STRIPE_KIT_PRICE_ID). When the
// relevant price is absent (e.g. before Stripe is wired) the endpoint degrades
// gracefully — the buy button reads "launching shortly" instead of a 500.

const PRODUCTS = {
  report: { env: "STRIPE_PRICE_ID", path: "/pricing" },
  kit: { env: "STRIPE_KIT_PRICE_ID", path: "/wage-claim" },
} as const;

type ProductKey = keyof typeof PRODUCTS;

export async function POST(req: Request) {
  const secret = process.env.STRIPE_SECRET_KEY;
  // Resolve the public base URL defensively: an env var that is empty or missing
  // its scheme would otherwise produce a relative success_url that Stripe rejects
  // ("Not a valid URL"). `??` doesn't catch an empty string, so normalise here.
  const raw = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  let base = raw || "https://www.wagecoach.com";
  if (!/^https?:\/\//i.test(base)) base = `https://${base}`;
  base = base.replace(/\/+$/, "");

  let product: ProductKey = "report";
  let caseQuery = "";
  try {
    const body = await req.json();
    if (body?.product === "kit") product = "kit";
    if (typeof body?.caseQuery === "string") caseQuery = body.caseQuery.replace(/^\?/, "").slice(0, 500);
  } catch { /* no body → default report */ }

  const price = process.env[PRODUCTS[product].env];
  if (!secret || !price) {
    return NextResponse.json(
      { message: "This is launching shortly. Email hello@mail.wagecoach.com for early access." },
      { status: 200 },
    );
  }

  try {
    const ret = `${base}${PRODUCTS[product].path}`;
    // The Claim Kit is delivered on a server-verified success page that renders
    // the demand letter from the case the buyer carried over; the report just
    // returns to pricing. {CHECKOUT_SESSION_ID} is Stripe's literal template.
    const successUrl = product === "kit"
      ? `${base}/claim-kit?session_id={CHECKOUT_SESSION_ID}${caseQuery ? `&${caseQuery}` : ""}`
      : `${ret}?status=success`;
    const body = new URLSearchParams({
      "mode": "payment",
      "line_items[0][price]": price,
      "line_items[0][quantity]": "1",
      "success_url": successUrl,
      "cancel_url": `${ret}?status=cancel`,
      "allow_promotion_codes": "true",
    });
    const res = await fetch("https://api.stripe.com/v1/checkout/sessions", {
      method: "POST",
      headers: { Authorization: `Bearer ${secret}`, "Content-Type": "application/x-www-form-urlencoded" },
      body,
    });
    const session = await res.json();
    if (!res.ok) {
      Sentry.captureMessage("Stripe checkout session creation failed", {
        level: "error",
        tags: { flow: "checkout", product },
        extra: { status: res.status, stripeError: session?.error?.message },
      });
      return NextResponse.json({ message: session?.error?.message ?? "Stripe error" }, { status: 502 });
    }
    return NextResponse.json({ url: session.url });
  } catch (err) {
    Sentry.captureException(err, { tags: { flow: "checkout", product } });
    return NextResponse.json({ message: "Could not reach Stripe. Please try again." }, { status: 502 });
  }
}
