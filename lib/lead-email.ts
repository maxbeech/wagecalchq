// Builds the internal notification email for a free-case-review lead. Pulled
// out of app/api/lead/route.ts so the markup can be unit-tested without a
// network call, and so it can be reused if another intake ever needs it.

export interface Lead {
  name?: string;
  email?: string;
  phone?: string;
  state?: string;
  claimType?: string;
  amount?: number;
  summary?: string;
}

export function esc(v: unknown): string {
  return String(v ?? "")
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function formattedAmount(lead: Lead): string {
  return typeof lead.amount === "number" && isFinite(lead.amount)
    ? `$${Math.round(lead.amount).toLocaleString("en-US")}`
    : "";
}

function leadRows(lead: Lead): Array<[string, string]> {
  return ([
    ["Name", lead.name], ["Email", lead.email], ["Phone", lead.phone],
    ["State", lead.state], ["Claim type", lead.claimType],
    ["Summary", lead.summary],
  ] as Array<[string, string | undefined]>)
    .filter(([, v]) => v && String(v).trim())
    .map(([k, v]) => [k, String(v)]);
}

// Ledger-styled HTML: matches the site's paper/ink-green/brass identity
// (app/globals.css) using only colors and web-safe fonts email clients
// actually render — no external stylesheet or webfont request.
const PAPER = "#f6f3ec";
const CARD = "#ffffff";
const INK = "#16201b";
const MUTED = "#4d554f";
const FAINT = "#636b64";
const LINE = "#e7e1d4";
const BRAND_700 = "#0d543f";
const BRAND_900 = "#0a3429";
const GOLD_500 = "#b08a35";

export function buildLeadEmail(lead: Lead): { subject: string; html: string; text: string } {
  const rows = leadRows(lead);
  const amount = formattedAmount(lead);
  const subject = `New case review — ${lead.state || "lead"}${lead.name ? ` (${lead.name})` : ""}`;

  const rowsHtml = rows
    .map(
      ([k, v], i) =>
        `<tr style="border-top:${i === 0 ? "none" : `1px solid ${LINE}`}">` +
        `<td style="padding:9px 16px 9px 0;font:600 13px Arial,Helvetica,sans-serif;color:${FAINT};white-space:nowrap;vertical-align:top">${esc(k)}</td>` +
        `<td style="padding:9px 0;font:14px/1.5 Arial,Helvetica,sans-serif;color:${INK}">${esc(v)}</td>` +
        `</tr>`,
    )
    .join("");

  const amountHtml = amount
    ? `<tr>` +
      `<td colspan="2" style="padding:14px 16px;background:${PAPER};border:1px solid ${LINE};border-radius:6px">` +
      `<span style="font:11px Arial,Helvetica,sans-serif;letter-spacing:.04em;text-transform:uppercase;color:${FAINT}">Self-reported back-pay estimate</span><br/>` +
      `<span style="font:700 22px 'Courier New',Courier,monospace;color:${BRAND_900}">${esc(amount)}</span>` +
      `</td></tr><tr><td colspan="2" style="height:12px"></td></tr>`
    : "";

  const html =
    `<div style="background:${PAPER};padding:24px 16px;font-family:Arial,Helvetica,sans-serif">` +
    `<table role="presentation" width="100%" style="max-width:560px;margin:0 auto;background:${CARD};border:1px solid ${LINE};border-radius:8px;overflow:hidden">` +
    `<tr><td style="background:${BRAND_700};padding:16px 24px">` +
    `<span style="font:700 15px Georgia,'Times New Roman',serif;color:#fff;letter-spacing:.01em">WageCoach</span> ` +
    `<span style="font:12px Arial,sans-serif;color:${GOLD_500}">&mdash; Leads</span>` +
    `</td></tr>` +
    `<tr><td style="padding:24px 24px 4px">` +
    `<h1 style="margin:0 0 4px;font:400 20px Georgia,'Times New Roman',serif;color:${INK}">New free-case-review lead</h1>` +
    `<p style="margin:0 0 18px;font:13px Arial,sans-serif;color:${MUTED}">Reply to this email to respond to ${esc(lead.name || "the claimant")} directly.</p>` +
    `<table role="presentation" width="100%" style="border-collapse:collapse">${amountHtml}${rowsHtml}</table>` +
    `</td></tr>` +
    `<tr><td style="padding:16px 24px 22px;border-top:1px solid ${LINE}">` +
    `<p style="margin:0;font:11px/1.5 Arial,sans-serif;color:${FAINT}">Source: wagecoach/free-case-review. General information, not legal advice.</p>` +
    `</td></tr>` +
    `</table></div>`;

  const text =
    `New free-case-review lead\n\n` +
    (amount ? `Self-reported back-pay estimate: ${amount}\n\n` : "") +
    rows.map(([k, v]) => `${k}: ${v}`).join("\n") +
    `\n\nReply to this email to respond to ${lead.name || "the claimant"} directly.\n` +
    `Source: wagecoach/free-case-review. General information, not legal advice.`;

  return { subject, html, text };
}
