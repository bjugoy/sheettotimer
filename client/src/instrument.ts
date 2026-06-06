import * as Sentry from '@sentry/react';

Sentry.init({
  dsn: 'https://0806d203894ae26588f971d4b865676f@o4511520814268416.ingest.de.sentry.io/4511520901759056',
  environment: import.meta.env.MODE,
  integrations: [
    Sentry.browserTracingIntegration(),
    Sentry.replayIntegration(),
  ],
  tracesSampleRate:          1.0,
  replaysSessionSampleRate:  0.1,  // capture 10% of sessions
  replaysOnErrorSampleRate:  1.0,  // capture 100% of sessions that had an error
});
