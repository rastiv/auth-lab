// The security log a user sees under "Recent activity".

/** Older events are deleted by a daily cron job. */
export const AUTH_EVENT_RETENTION_DAYS = 90

export type AuthEventType =
  | 'account_created'
  | 'sign_in'
  | 'sign_in_failed'
  | 'two_factor_failed'
  | 'sign_out'
  | 'sessions_revoked'
  | 'password_changed'
  | 'password_reset'
  | 'two_factor_enabled'
  | 'two_factor_disabled'
  | 'method_added'
  | 'method_removed'
  | 'new_device_alerts_on'
  | 'new_device_alerts_off'

/**
 * How it happened, e.g. 'password+app', 'google', 'magic-link', or for
 * sessions_revoked 'one' / 'others'.
 */
export type AuthEventMethod = string

/** How a method reads in a sentence: "Signed in with {label}". */
export const METHOD_LABELS: Record<AuthEventMethod, string> = {
  password: 'password',
  'password+trusted-device': 'password on a trusted device',
  'password+app': 'password + authenticator app',
  'password+email-code': 'password + email code',
  'password+backup-code': 'password + backup code',
  google: 'Google',
  github: 'GitHub',
  'magic-link': 'magic link',
  'email-link': 'email verification link',
  app: 'authenticator app',
  'email-code': 'email code',
  'backup-code': 'backup code',
}

/** What GET /api/sessions returns: one per signed-in browser, no tokens. */
export type ActiveSession = {
  id: string
  device: string
  createdAt: string
  current: boolean
}

/** What GET /api/activity returns. */
export type AuthEvent = {
  id: string
  type: AuthEventType
  method: AuthEventMethod | null
  device: string | null
  // Approximate, from the network: with a VPN it's the VPN's location.
  city: string | null
  country: string | null
  network: string | null
  createdAt: string
}
