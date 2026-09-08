import { NextResponse } from "next/server";
import { SITE } from "@/lib/site";
import { buildLeadEmail, type Lead } from "@/lib/lead-email";
import { sendEmail as sendThreadCampEmail } from "@/lib/threadcamp-mail";

// Free-case-review intake. A submitted lead is delivered to whichever channels
// are configured — ThreadCamp email (THREADCAMP_API_KEY) and/or a partner
// webhook (LEAD_WEBHOOK_URL, e.g. an attorney-network intake, CRM or Zapier
// hook). Nothing is stored here: the site is otherwise database-free, so
// delivery is the single integration point. If a channel is configured but
// fails, we tell the user to email us directly rather than silently dropping
// the lead. If no channel is configured at all, the route still accepts the
// submission so the form works in every environment.
//
// Lead-gen to attorneys is regulated and varies by state bar (referral-fee and
// advertising rules). This forwards an inquiry the user initiated; it is not a
// referral-fee arrangement. Confirm the model with counsel before going live.

function validEmail(e: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e);
}

// Deliver via lib/threadcamp-mail.ts — the same generated-client shape every
// other ProductFactory product uses for ThreadCamp, rather than a one-off
// fetch call in this route.
async function sendEmail(lead: Lead): Promise<boolean | null> {
  const to = process.env.LEAD_TO || SITE.email;
  const { subject, html, text } = buildLeadEmail(lead);
  const result = await sendThreadCampEmail({ to, subject, html, text, replyTo: lead.email });
  if (result.sent === false && result.reason === "not_configured") return null;
  return result.sent;
}

async function sendWebhook(lead: Lead): Promise<boolean | null> {
  const hook = process.env.LEAD_WEBHOOK_URL;
  if (!hook) return null; // not configured
  const res = await fetch(hook, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ...lead, source: "wagecoach/free-case-review", at: new Date().toISOString() }),
  });
  return res.ok;
}

export async function POST(req: Request) {
  let lead: Lead;
  try {
    lead = await req.json();
  } catch {
    return NextResponse.json({ message: "Invalid submission." }, { status: 400 });
  }

  if (!lead.email || !validEmail(lead.email)) {
    return NextResponse.json({ message: "Please enter a valid email address." }, { status: 400 });
  }

  // Attempt every configured channel. `null` = channel not configured.
  let results: Array<boolean | null>;
  try {
    results = await Promise.all([sendEmail(lead), sendWebhook(lead)]);
  } catch {
    results = [false];
  }
  const configured = results.filter((r) => r !== null);
  // If at least one channel is configured and none of them succeeded, surface
  // a clear fallback so the lead is never silently lost.
  if (configured.length > 0 && !configured.some((r) => r === true)) {
    return NextResponse.json(
      { message: "We couldn't submit that just now. Please email hello@wagecoach.com and we'll connect you." },
      { status: 502 },
    );
  }

  return NextResponse.json({
    ok: true,
    message: "Thanks — your details are on their way to a wage attorney who can review your case for free. Expect to hear back by email.",
  });
}
