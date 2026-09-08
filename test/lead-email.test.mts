import { buildLeadEmail, esc, type Lead } from "../lib/lead-email.ts";
import { eq, ok, report } from "./_assert.mts";

const full: Lead = {
  name: "Geneva Driggers",
  email: "genevadriggers12@gmail.com",
  phone: "17069058379",
  state: "GA",
  claimType: "Unpaid overtime",
  amount: 4832.4,
  summary: "Worked low voltage access control, no prevailing wage.",
};

// Subject line follows "New case review — STATE (Name)"
let { subject, html, text } = buildLeadEmail(full);
eq(subject, "New case review — GA (Geneva Driggers)", "subject includes state and name");

// Every populated field appears in both html and text bodies
for (const v of [full.name, full.email, full.phone, full.state, full.claimType, full.summary]) {
  ok(html.includes(v!), `html contains "${v}"`);
  ok(text.includes(v!), `text contains "${v}"`);
}

// Amount is rounded and formatted as currency, not raw
ok(html.includes("$4,832"), "html formats amount as rounded currency");
ok(!html.includes("4832.4"), "html does not leak raw amount");
ok(text.includes("$4,832"), "text formats amount as rounded currency");

// Reply hint uses the claimant's name
ok(html.includes("Reply to this email to respond to Geneva Driggers"), "html includes reply hint with name");

// XSS: a hostile summary must not inject markup into the HTML email
const hostile: Lead = { ...full, summary: '<img src=x onerror=alert(1)>"quoted"' };
({ html } = buildLeadEmail(hostile));
ok(!html.includes("<img src=x"), "html escapes an injected tag in summary");
ok(html.includes("&lt;img"), "html renders the escaped tag as text");

// Missing optional fields are simply omitted, not shown as blank rows
const minimal: Lead = { email: "a@b.com" };
({ html, text } = buildLeadEmail(minimal));
ok(!html.includes("Self-reported back-pay estimate"), "minimal lead (no amount) omits the amount block");
ok(html.includes("a@b.com"), "minimal lead still renders the email row");
ok(!html.includes("undefined") && !html.includes("null"), "minimal lead never renders literal undefined/null");

// No state or name still produces a sane fallback subject
({ subject } = buildLeadEmail({ email: "x@y.com" }));
eq(subject, "New case review — lead", "fallback subject with no state/name");

// esc() neutralizes the five HTML-sensitive characters
eq(esc(`<a href="x">&'</a>`), "&lt;a href=&quot;x&quot;&gt;&amp;'&lt;/a&gt;", "esc escapes & < > \"");

report("lead-email");
