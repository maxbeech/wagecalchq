import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  environment: process.env.VERCEL_ENV ?? process.env.NODE_ENV,
  sendDefaultPii: false,
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
