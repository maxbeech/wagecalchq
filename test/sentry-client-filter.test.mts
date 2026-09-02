import { isSyntheticScriptParseError } from "../lib/sentry-client-filter.ts";
import { eq, report } from "./_assert.mts";

eq(isSyntheticScriptParseError({
  exception: {
    values: [{
      type: "SyntaxError",
      value: "Invalid or unexpected token",
      stacktrace: { frames: [{ filename: "app:///9e8abec0754b8ed8/script.js", lineno: 1, colno: 2 }] },
    }],
  },
}), true, "drops the exact crawler-owned script parse signature");

eq(isSyntheticScriptParseError({
  exception: {
    values: [{
      type: "SyntaxError",
      value: "Invalid or unexpected token",
      stacktrace: { frames: [{ filename: "app:///app/page.tsx", lineno: 1, colno: 2 }] },
    }],
  },
}), false, "keeps an application SyntaxError for investigation");

eq(isSyntheticScriptParseError({
  exception: {
    values: [{
      type: "TypeError",
      value: "Cannot read properties of undefined",
      stacktrace: { frames: [{ filename: "app:///9e8abec0754b8ed8/script.js", lineno: 1, colno: 2 }] },
    }],
  },
}), false, "keeps other errors from the same script path");

report("sentry-client-filter");
