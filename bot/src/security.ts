// Назначение: middleware безопасности Helmet и CSP.
// Основные модули: express, helmet, config
import express from 'express';
import helmet from 'helmet';
import type { ContentSecurityPolicyOptions } from 'helmet';

import config from './config';

const parseList = (env?: string): string[] =>
  env
    ? env
        .split(/[ ,]+/)
        .map((s) => s.trim())
        .filter(Boolean)
    : [];

export default function applySecurity(app: express.Express): void {
  const reportOnly = process.env.CSP_REPORT_ONLY !== 'false';

  const connectSrc = [
    "'self'",
    'https://router.project-osrm.org',
    ...parseList(process.env.CSP_CONNECT_SRC_ALLOWLIST),
  ];
  try {
    connectSrc.push(new URL(config.routingUrl).origin);
  } catch {
    // Игнорируем некорректный routingUrl
  }

  const imgSrc = [
    "'self'",
    'data:',
    'https://a.tile.openstreetmap.org',
    'https://b.tile.openstreetmap.org',
    'https://c.tile.openstreetmap.org',
    ...parseList(process.env.CSP_IMG_SRC_ALLOWLIST),
  ];

  const scriptSrc = [
    "'self'",
    "'unsafe-eval'",
    'https://telegram.org',
    ...parseList(process.env.CSP_SCRIPT_SRC_ALLOWLIST),
  ];

  const styleSrc = [
    "'self'",
    "'unsafe-inline'",
    'https://fonts.googleapis.com',
    ...parseList(process.env.CSP_STYLE_SRC_ALLOWLIST),
  ];

  const fontSrc = [
    "'self'",
    'https://fonts.gstatic.com',
    ...parseList(process.env.CSP_FONT_SRC_ALLOWLIST),
  ];

  const directives: NonNullable<ContentSecurityPolicyOptions['directives']> = {
    'frame-src': ["'self'", 'https://oauth.telegram.org'],
    'script-src': scriptSrc,
    'style-src': styleSrc,
    'font-src': fontSrc,
    'img-src': imgSrc,
    'connect-src': connectSrc,
  };

  if (reportOnly) directives['upgrade-insecure-requests'] = null;
  else directives['upgrade-insecure-requests'] = [];
  const reportUri = process.env.CSP_REPORT_URI;
  if (reportUri) directives['report-uri'] = [reportUri];

  const csp: ContentSecurityPolicyOptions = {
    useDefaults: true,
    directives,
    reportOnly,
  };

  app.use(
    helmet({
      hsts: true,
      noSniff: true,
      referrerPolicy: { policy: 'no-referrer' },
      frameguard: { action: 'deny' },

      contentSecurityPolicy: csp,
    }),
  );
}
