import * as Sentry from '@sentry/node';

Sentry.init({
  dsn: 'https://0806d203894ae26588f971d4b865676f@o4511520814268416.ingest.de.sentry.io/4511520901759056',
  environment: process.env.NODE_ENV ?? 'development',
  tracesSampleRate: 1.0,
});
