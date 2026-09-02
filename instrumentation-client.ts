import * as Sentry from "@sentry/nextjs";
import { isSyntheticScriptParseError } from "./lib/sentry-client-filter";

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  environment: process.env.VERCEL_ENV ?? process.env.NODE_ENV,
  sendDefaultPii: false,
  beforeSend(event) {
    return isSyntheticScriptParseError(event) ? null : event;
  },
  integrations: [
    Sentry.feedbackIntegration({
      autoInject: true,
      buttonLabel: "Send feedback",
      formTitle: "Send feedback to WageCoach",
      submitButtonLabel: "Send feedback",
    }),
  ],
});

export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
