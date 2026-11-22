import { useEffect, useState } from 'react'
import { AUTH_EVENT_RETENTION_DAYS, type AuthEvent } from '../shared/auth-events'
import { describeDevice } from '../shared/device'
import { authClient } from './lib/auth-client'

type Session = NonNullable<Awaited<ReturnType<typeof authClient.listSessions>>['data']>[number]

const METHOD_LABELS: Record<string, string> = {
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

function describeEvent({ type, method }: AuthEvent): string {
  const via = method ? (METHOD_LABELS[method] ?? method) : ''
  switch (type) {
    case 'account_created':
      return `Account created with ${via}`
    case 'sign_in':
      return `Signed in with ${via}`
    case 'sign_in_failed':
      return 'Failed sign-in: wrong password'
    case 'two_factor_failed':
      return `Failed sign-in: right password, wrong ${via}`
    case 'sign_out':
      return 'Signed out'
    case 'sessions_revoked':
      return method === 'one' ? 'Signed out another device' : 'Signed out all other devices'
    case 'password_changed':
      return 'Password changed'
    case 'password_reset':
      return 'Password set with an email link'
    case 'two_factor_enabled':
      return `Two-factor authentication turned on (${via})`
    case 'two_factor_disabled':
      return 'Two-factor authentication turned off'
    case 'method_added':
      return `Sign-in method added: ${via}`
    case 'method_removed':
      return `Sign-in method removed: ${via}`
  }
}

const relativeTime = new Intl.RelativeTimeFormat('en', { numeric: 'auto' })

function timeAgo(date: string | Date): string {
  const seconds = (new Date(date).getTime() - Date.now()) / 1000
  const units = [
    ['day', 86400],
    ['hour', 3600],
    ['minute', 60],
  ] as const
  for (const [unit, size] of units) {
    if (Math.abs(seconds) >= size) return relativeTime.format(Math.round(seconds / size), unit)
  }
  return 'just now'
}

/** "Was that me?": where you're signed in now, and what happened recently. */
export function SecurityActivity({ currentSessionId }: { currentSessionId: string }) {
  const [sessions, setSessions] = useState<Session[]>()
  const [events, setEvents] = useState<AuthEvent[]>()
  const [error, setError] = useState<string>()
  const [version, setVersion] = useState(0)

  useEffect(() => {
    let ignore = false
    Promise.all([
      authClient.listSessions(),
      fetch('/api/activity').then((response) => response.json() as Promise<AuthEvent[]>),
    ]).then(([{ data, error }, activity]) => {
      if (ignore) return
      setSessions(data ?? [])
      setError(error?.message)
      setEvents(activity)
    })
    return () => {
      ignore = true
    }
  }, [version])

  async function revoke(token: string) {
    const { error } = await authClient.revokeSession({ token })
    setError(error?.message)
    setVersion((n) => n + 1)
  }

  async function revokeOthers() {
    const { error } = await authClient.revokeOtherSessions()
    setError(error?.message)
    setVersion((n) => n + 1)
  }

  if (!sessions || !events) return <p>Loading activity...</p>

  const others = sessions.filter((s) => s.id !== currentSessionId)

  return (
    <>
      <section>
        <h2>Where you're signed in</h2>
        <ul>
          {sessions.map((s) => (
            <li key={s.id}>
              <strong>{describeDevice(s.userAgent)}</strong>, signed in {timeAgo(s.createdAt)}{' '}
              {s.id === currentSessionId ? (
                '(this device)'
              ) : (
                <button onClick={() => revoke(s.token)}>Sign out</button>
              )}
            </li>
          ))}
        </ul>
        {others.length > 0 && (
          <button onClick={revokeOthers}>Sign out everywhere else</button>
        )}
        {error && <p role="alert">{error}</p>}
      </section>
      <section>
        <h2>Recent activity</h2>
        <ul>
          {events.map((event) => {
            const place = [event.city, event.country].filter(Boolean).join(', ')
            const where = [event.device, place, event.network].filter(Boolean).join(' · ')
            const failed = event.type === 'sign_in_failed' || event.type === 'two_factor_failed'
            return (
              <li key={event.id}>
                {failed ? <strong>{describeEvent(event)}</strong> : describeEvent(event)}
                {where && ` · ${where}`} ·{' '}
                <time dateTime={event.createdAt} title={new Date(event.createdAt).toLocaleString()}>
                  {timeAgo(event.createdAt)}
                </time>
                {event.type === 'two_factor_failed' && (
                  <p>
                    Whoever tried this knew your password. If it wasn't you, change your password.
                  </p>
                )}
              </li>
            )
          })}
        </ul>
        <p>
          Locations are approximate and based on the network: with a VPN you see the VPN's
          location. Activity is kept for {AUTH_EVENT_RETENTION_DAYS} days.
        </p>
      </section>
    </>
  )
}
