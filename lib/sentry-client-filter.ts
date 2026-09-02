type SentryEvent = {
  exception?: {
    values?: Array<{
      type?: string;
      value?: string;
      stacktrace?: {
        frames?: Array<{
          filename?: string;
          lineno?: number;
          colno?: number;
        }>;
      };
    }>;
  };
};

// Render bots can execute their own malformed `script.js` while crawling a page.
// This signature has no application frame, so retaining it would only obscure
// actionable visitor errors in Sentry.
export function isSyntheticScriptParseError(event: SentryEvent): boolean {
  return event.exception?.values?.some((exception) =>
    exception.type === "SyntaxError"
    && exception.value === "Invalid or unexpected token"
    && exception.stacktrace?.frames?.some((frame) =>
      /\/script\.js$/.test(frame.filename ?? "")
      && frame.lineno === 1
      && frame.colno === 2,
    ),
  ) ?? false;
}
