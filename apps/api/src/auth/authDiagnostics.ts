// Назначение файла: in-memory диагностика проблем авторизации и CSRF.
// Основные модули: отсутствуют (чистые функции)

export type AuthDiagnosticEventType =
  | 'csrf_error'
  | 'password_login_success'
  | 'password_login_failure';

export type AuthDiagnosticEvent = {
  type: AuthDiagnosticEventType;
  at: string;
  method?: string;
  path?: string;
  origin?: string;
  referer?: string;
  userAgent?: string;
  reason?: string;
};

const MAX_EVENTS = 100;
const events: AuthDiagnosticEvent[] = [];

function pushEvent(event: AuthDiagnosticEvent): void {
  events.push(event);
  if (events.length > MAX_EVENTS) {
    events.splice(0, events.length - MAX_EVENTS);
  }
}

const trimHeader = (value: unknown): string | undefined => {
  if (typeof value !== 'string') {
    return undefined;
  }
  const trimmed = value.trim();
  return trimmed ? trimmed : undefined;
};

export function recordCsrfDiagnostic(payload: {
  method: string;
  path: string;
  origin?: string;
  referer?: string;
  userAgent?: string;
  reason?: string;
}): void {
  pushEvent({
    type: 'csrf_error',
    at: new Date().toISOString(),
    method: payload.method,
    path: payload.path,
    origin: trimHeader(payload.origin),
    referer: trimHeader(payload.referer),
    userAgent: trimHeader(payload.userAgent),
    reason: trimHeader(payload.reason),
  });
}

export function recordPasswordLoginDiagnostic(
  success: boolean,
  reason?: string,
): void {
  pushEvent({
    type: success ? 'password_login_success' : 'password_login_failure',
    at: new Date().toISOString(),
    reason: trimHeader(reason),
  });
}

export function getAuthDiagnosticsSnapshot(): {
  totalEvents: number;
  lastEvents: AuthDiagnosticEvent[];
} {
  return {
    totalEvents: events.length,
    lastEvents: events.slice(-20),
  };
}
