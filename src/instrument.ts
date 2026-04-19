import * as Sentry from '@sentry/node';

import { config } from '@/config/env';

Sentry.init({
  dsn: config.SENTRY_DSN,
  enabled: Boolean(config.SENTRY_DSN),
  environment: config.SENTRY_ENVIRONMENT,
  release: config.SENTRY_RELEASE,
  tracesSampleRate: config.NODE_ENV === 'production' ? 0.1 : 1,
  sendDefaultPii: false,
});
