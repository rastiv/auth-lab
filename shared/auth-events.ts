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

/**
 * How it happened, e.g. 'password+app', 'google', 'magic-link', or for
 * sessions_revoked 'one' / 'others'.
 */
export type AuthEventMethod = string

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
