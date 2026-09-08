/**
 * ThreadCamp — this product's transactional email.
 *
 * WageCoach sends through ThreadCamp (threadcamp.com), a Resend-compatible
 * email API for AI agents that we own. It has its own dedicated inbox
 * (wagecoach-leads@relay.threadcamp.com) and its own API key, but not yet its
 * own verified domain — `mail.wagecoach.com` is already claimed as an SES
 * identity by something else in the account (see ProductFactory/_services/
 * SERVICES.md, 2026-09-08 entry), so mail sends from the shared relay until
 * that's sorted out.
 *
 * NO SILENT SUCCESS. An unconfigured product returns
 * `{ sent: false, reason: "not_configured" }` and a failed send returns
 * `{ sent: false, reason: "error", error }`. Nothing here ever returns a made-up
 * message id, and nothing here retries into a duplicate send — pass `clientId`
 * for idempotency if the caller may retry.
 *
 * SERVER ONLY. `THREADCAMP_API_KEY` is an account-scoped credential; shipping
 * it to a browser would hand any visitor the ability to send as this product.
 */

const DEFAULT_API_URL = "https://www.threadcamp.com/v1";

function assertServer(): void {
  if (typeof window !== "undefined") {
    throw new Error(
      "threadcamp-mail must only be used on the server - it carries the product's API key. " +
        "Move this call into a route handler, server action or server component.",
    );
  }
}

export interface MailConfig {
  apiUrl: string;
  apiKey: string | null;
  /** The address this product sends from, e.g. "wagecoach-leads@relay.threadcamp.com". */
  fromAddress: string | null;
  /** Display name on outbound mail. Without it, ThreadCamp shows the raw tenant id. */
  fromName: string;
}

export function mailConfig(): MailConfig {
  assertServer();
  return {
    apiUrl: (process.env.THREADCAMP_API_URL || DEFAULT_API_URL).replace(/\/+$/, ""),
    apiKey: process.env.THREADCAMP_API_KEY?.trim() || null,
    fromAddress: process.env.THREADCAMP_FROM_ADDRESS?.trim() || "wagecoach-leads@relay.threadcamp.com",
    fromName: process.env.THREADCAMP_FROM_NAME?.trim() || "WageCoach Leads",
  };
}

/** True when this deployment can actually send. Check before promising a user mail. */
export function emailEnabled(): boolean {
  const c = mailConfig();
  return Boolean(c.apiKey && c.fromAddress);
}

export interface SendEmailInput {
  /**
   * Recipient(s). Several recipients are delivered as ONE message — they see
   * each other in the To header, which is what a shared alert should do. Use
   * `bcc` when they must not.
   */
  to: string | string[];
  subject: string;
  /** Body as HTML. Supply this, `text`, or `markdown` — at least one. */
  html?: string;
  text?: string;
  /** Simple markdown body (bold + links + paragraphs); rendered to HTML and text here. */
  markdown?: string;
  cc?: string[];
  /** Blind copies. Never rendered into a header the other recipients can see. */
  bcc?: string[];
  replyTo?: string;
  /**
   * Idempotency key. Re-sending with the same value returns the original
   * message instead of delivering twice — use it anywhere a retry is possible
   * (webhook handlers, queue consumers, form posts).
   */
  clientId?: string;
}

export type SendResult =
  | {
      sent: true;
      /** Platform message id. */
      id: string;
      /**
       * "sent" | "scheduled" | "pending_approval". `pending_approval` means the
       * inbox is holding it for human release — it has NOT been delivered, so a
       * caller that wants to say "check your inbox" should require "sent".
       */
      status: string;
      threadId: string | null;
      /** Recipients dropped because they are suppressed (hard bounce/complaint).
       *  The message WAS delivered to everyone else. */
      suppressed: string[];
    }
  | { sent: false; reason: "not_configured" | "error"; error?: string };

/** Minimal markdown → HTML: **bold**, bare URLs, blank-line paragraphs. */
function markdownToHtml(markdown: string): string {
  const escape = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const paragraphs = markdown.split(/\n\s*\n/).map((block) => {
    let html = escape(block.trim()).replace(/\n/g, "<br>");
    html = html.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
    html = html.replace(/(https?:\/\/[^\s<]+)/g, '<a href="$1">$1</a>');
    return `<p>${html}</p>`;
  });
  return paragraphs.join("\n");
}

/** Minimal markdown → plain text: strip the ** markers, leave everything else as-is. */
function markdownToText(markdown: string): string {
  return markdown.replace(/\*\*(.+?)\*\*/g, "$1");
}

/**
 * Send one transactional email.
 *
 * ONE request, one message, however many recipients — ThreadCamp's
 * Resend-compatible POST /v1/emails accepts an array `to`.
 */
export async function sendEmail(input: SendEmailInput): Promise<SendResult> {
  const cfg = mailConfig();
  if (!cfg.apiKey || !cfg.fromAddress) {
    console.warn(`[mail] ThreadCamp is not configured (THREADCAMP_API_KEY / THREADCAMP_FROM_ADDRESS) - skipped "${input.subject}"`);
    return { sent: false, reason: "not_configured" };
  }

  const to = (Array.isArray(input.to) ? input.to : [input.to]).map((r) => r.trim()).filter(Boolean);
  if (to.length === 0) return { sent: false, reason: "error", error: "no recipient" };
  if (!input.html && !input.text && !input.markdown) {
    return { sent: false, reason: "error", error: "no body (html, text or markdown)" };
  }

  const html = input.html ?? (input.markdown ? markdownToHtml(input.markdown) : undefined);
  const text = input.text ?? (input.markdown ? markdownToText(input.markdown) : undefined);

  const body: Record<string, unknown> = {
    from: cfg.fromAddress,
    from_name: cfg.fromName,
    to,
    subject: input.subject,
    html,
    text,
    cc: input.cc,
    bcc: input.bcc,
    reply_to: input.replyTo,
    client_id: input.clientId,
  };
  for (const k of Object.keys(body)) if (body[k] === undefined) delete body[k];

  try {
    const res = await fetch(`${cfg.apiUrl}/emails`, {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${cfg.apiKey}` },
      body: JSON.stringify(body),
    });
    const payload = (await res.json().catch(() => ({}))) as Record<string, unknown>;
    if (!res.ok) {
      // The platform's own message, not a paraphrase: "recipient is suppressed
      // after a hard bounce" and "daily cap reached" need different fixes.
      const err = payload.error as { message?: string } | undefined;
      const detail = err?.message ?? `HTTP ${res.status}`;
      console.error(`[mail] send failed: ${detail}`);
      return { sent: false, reason: "error", error: detail };
    }
    return {
      sent: true,
      id: String(payload.id ?? ""),
      status: String(payload.status ?? "sent"),
      threadId: (payload.thread_id as string | null) ?? null,
      suppressed: Array.isArray(payload.suppressed) ? (payload.suppressed as string[]) : [],
    };
  } catch (err) {
    const detail = err instanceof Error ? err.message : String(err);
    console.error(`[mail] send failed: ${detail}`);
    return { sent: false, reason: "error", error: detail };
  }
}

/**
 * The address this product actually sends from, for showing in a UI ("replies
 * go to …") or a support page.
 */
export function sendingAddress(): string | null {
  return mailConfig().fromAddress;
}
