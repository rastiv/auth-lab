import { useEffect, useState } from 'react'
import {
  AUTH_EVENT_RETENTION_DAYS,
  METHOD_LABELS,
  type ActiveSession,
  type AuthEvent,
} from '../shared/auth-events'
import { authClient } from './lib/auth-client'

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
    case 'new_device_alerts_on':
      return 'Emails about sign-ins from a new browser turned on'
    case 'new_device_alerts_off':
      return 'Emails about sign-ins from a new browser turned off'
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
export function SecurityActivity() {
  const [sessions, setSessions] = useState<ActiveSession[]>()
  const [events, setEvents] = useState<AuthEvent[]>()
  const [error, setError] = useState<string>()
  const [version, setVersion] = useState(0)

  useEffect(() => {
    let ignore = false
    Promise.all([
      fetch('/api/sessions').then((response) => response.json() as Promise<ActiveSession[]>),
      fetch('/api/activity').then((response) => response.json() as Promise<AuthEvent[]>),
    ]).then(([active, activity]) => {
      if (ignore) return
      setSessions(active)
      setEvents(activity)
    })
    return () => {
      ignore = true
    }
  }, [version])

  async function revoke(id: string) {
    const response = await fetch(`/api/sessions/${encodeURIComponent(id)}`, { method: 'DELETE' })
    setError(response.ok ? undefined : 'That device could not be signed out. Please try again.')
    setVersion((n) => n + 1)
  }

  async function revokeOthers() {
    const { error } = await authClient.revokeOtherSessions()
    setError(error?.message)
    setVersion((n) => n + 1)
  }

  if (!sessions || !events) return <p>Loading activity...</p>

  const others = sessions.filter((s) => !s.current)

  return (
    <>
      <section>
        <h2>Where you're signed in</h2>
        <ul>
          {sessions.map((s) => (
            <li key={s.id}>
              <strong>{s.device}</strong>, signed in {timeAgo(s.createdAt)}{' '}
              {s.current ? (
                '(this device)'
              ) : (
                <button onClick={() => revoke(s.id)}>Sign out</button>
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
