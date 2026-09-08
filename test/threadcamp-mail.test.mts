// Contract tests for lib/threadcamp-mail.ts: a transactional sender must
// never report success it did not get, never turn a held-for-approval
// message into "delivered", and never hide a suppressed recipient.
import { eq, ok, report } from "./_assert.mts";

const ORIGINAL_ENV = { ...process.env };
const ORIGINAL_FETCH = globalThis.fetch;

function configure(over: Record<string, string | undefined> = {}) {
  process.env.THREADCAMP_API_KEY = "sk_live_test";
  process.env.THREADCAMP_FROM_ADDRESS = "leads@send.wagecoach.com";
  process.env.THREADCAMP_FROM_NAME = "WageCoach Leads";
  process.env.THREADCAMP_API_URL = "https://worker.test/v1";
  for (const [k, v] of Object.entries(over)) {
    if (v === undefined) delete process.env[k];
    else process.env[k] = v;
  }
}

type Call = { url: string; body: Record<string, unknown> };

function mockFetch(response: { ok: boolean; body: unknown; status?: number }): Call[] {
  const calls: Call[] = [];
  globalThis.fetch = (async (url: string, init: RequestInit) => {
    calls.push({ url, body: JSON.parse(String(init.body ?? "{}")) });
    return {
      ok: response.ok,
      status: response.status ?? (response.ok ? 200 : 400),
      json: async () => response.body,
    } as Response;
  }) as typeof fetch;
  return calls;
}

// Import after env plumbing is in place, but before any config() call — the
// module reads process.env lazily inside mailConfig(), not at import time.
const { sendEmail, emailEnabled, sendingAddress } = await import("../lib/threadcamp-mail.ts");

// Unconfigured (no API key) → not_configured, never a fake success
configure({ THREADCAMP_API_KEY: undefined });
eq(emailEnabled(), false, "disabled without an API key");
let result = await sendEmail({ to: "a@b.com", subject: "hi", text: "hi" });
eq(result.sent, false, "unconfigured send reports not sent");
if (!result.sent) eq(result.reason, "not_configured", "unconfigured reason");
eq(sendingAddress(), "leads@send.wagecoach.com", "sendingAddress still reflects the from default");

// Configured: emailEnabled and sendingAddress
configure();
eq(emailEnabled(), true, "enabled once key + from address are set");
eq(sendingAddress(), "leads@send.wagecoach.com", "sendingAddress reflects config");

// The hardcoded fallback (no THREADCAMP_FROM_ADDRESS at all) is the real
// verified branded inbox, not the shared relay it started on.
configure({ THREADCAMP_FROM_ADDRESS: undefined });
eq(sendingAddress(), "leads@send.wagecoach.com", "falls back to the branded send.wagecoach.com inbox");

// Empty recipient list → error, no network call
configure();
let calls = mockFetch({ ok: true, body: {} });
result = await sendEmail({ to: "  ", subject: "hi", text: "hi" });
eq(result.sent, false, "blank recipient rejected");
if (!result.sent) eq(result.error, "no recipient", "blank recipient error message");
eq(calls.length, 0, "no fetch made for a rejected send");

// No body (no html/text/markdown) → error, no network call
calls = mockFetch({ ok: true, body: {} });
result = await sendEmail({ to: "a@b.com", subject: "hi" });
eq(result.sent, false, "missing body rejected");
if (!result.sent) eq(result.error, "no body (html, text or markdown)", "missing body error message");
eq(calls.length, 0, "no fetch made for a rejected send");

// Successful send: request shape + response mapping
calls = mockFetch({ ok: true, body: { id: "msg_1", status: "sent", thread_id: "th_1", suppressed: [] } });
result = await sendEmail({ to: ["a@b.com", "c@d.com"], subject: "New lead", html: "<p>hi</p>", replyTo: "lead@x.com", clientId: "abc" });
eq(result.sent, true, "successful send reports sent");
if (result.sent) {
  eq(result.id, "msg_1", "message id passed through");
  eq(result.status, "sent", "status passed through");
  eq(result.threadId, "th_1", "thread id passed through");
}
eq(calls.length, 1, "exactly one request for one recipient list");
eq(calls[0]!.url, "https://worker.test/v1/emails", "posts to the configured API URL");
eq(calls[0]!.body.from, "leads@send.wagecoach.com", "from is the bare configured address");
eq(calls[0]!.body.from_name, "WageCoach Leads", "from_name carries the display name separately");
eq(JSON.stringify(calls[0]!.body.to), JSON.stringify(["a@b.com", "c@d.com"]), "to is an array of trimmed recipients");
eq(calls[0]!.body.reply_to, "lead@x.com", "reply_to passed through");
eq(calls[0]!.body.client_id, "abc", "client_id passed through for idempotency");
ok(!("markdown" in calls[0]!.body), "no stray markdown field when html was supplied directly");

// pending_approval is surfaced, not laundered into a plain "sent"
calls = mockFetch({ ok: true, body: { id: "msg_2", status: "pending_approval", suppressed: ["c@d.com"] } });
result = await sendEmail({ to: "a@b.com", subject: "hi", text: "hi" });
ok(result.sent === true && result.status === "pending_approval", "pending_approval status is preserved, not rewritten to sent");
ok(result.sent === true && result.suppressed.includes("c@d.com"), "a suppressed recipient is reported, not hidden");

// A rejected send surfaces the platform's own error message
calls = mockFetch({ ok: false, status: 429, body: { error: { message: "daily cap reached" } } });
result = await sendEmail({ to: "a@b.com", subject: "hi", text: "hi" });
eq(result.sent, false, "platform rejection reports not sent");
if (!result.sent) eq(result.error, "daily cap reached", "platform's own error message is surfaced verbatim");

// markdown input is rendered to both html and text when neither is supplied directly
calls = mockFetch({ ok: true, body: { id: "msg_3", status: "sent", suppressed: [] } });
result = await sendEmail({ to: "a@b.com", subject: "hi", markdown: "**Bold** and a link https://example.com" });
ok(String(calls[0]!.body.html).includes("<strong>Bold</strong>"), "markdown bold renders to <strong> in html");
ok(String(calls[0]!.body.html).includes('<a href="https://example.com">'), "bare URL in markdown becomes a link in html");
ok(String(calls[0]!.body.text) === "Bold and a link https://example.com", "markdown text strips ** markers, keeps the URL bare");

globalThis.fetch = ORIGINAL_FETCH;
process.env = ORIGINAL_ENV;

report("threadcamp-mail");
