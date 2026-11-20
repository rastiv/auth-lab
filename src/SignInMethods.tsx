import { useEffect, useState, type FormEvent } from 'react'
import { authClient } from './lib/auth-client'
import { useTurnstile } from './lib/use-turnstile'

type Account = NonNullable<Awaited<ReturnType<typeof authClient.listAccounts>>['data']>[number]

const METHODS = [
  { providerId: 'credential', label: 'Password' },
  { providerId: 'google', label: 'Google' },
  { providerId: 'github', label: 'GitHub' },
] as const

const UNLINK_ERRORS: Record<string, string> = {
  // Better-Auth only allows this within a day of signing in (session.freshAge).
  SESSION_NOT_FRESH:
    'Removing a sign-in method needs a recent sign-in. Sign out, sign in again, and retry.',
  FAILED_TO_UNLINK_LAST_ACCOUNT: "You can't remove your only sign-in method.",
}

/** One row per sign-in method: each is a row in the account table. */
export function SignInMethods({ email }: { email: string }) {
  const [accounts, setAccounts] = useState<Account[]>()
  const [error, setError] = useState<string>()
  const [version, setVersion] = useState(0)

  useEffect(() => {
    let ignore = false
    authClient.listAccounts().then(({ data, error }) => {
      if (ignore) return
      setAccounts(data ?? [])
      setError(error?.message)
    })
    return () => {
      ignore = true
    }
  }, [version])

  async function unlink(account: Account) {
    const { error } = await authClient.unlinkAccount({ accountId: account.id })
    if (error) setError(UNLINK_ERRORS[error.code ?? ''] ?? error.message)
    else setVersion((n) => n + 1)
  }

  function link(provider: 'google' | 'github') {
    // Redirects to the provider; back on '/', the new account row is there.
    authClient.linkSocial({ provider, callbackURL: '/', errorCallbackURL: '/' })
  }

  if (!accounts) return <p>Loading sign-in methods...</p>

  const onlyOne = accounts.length === 1

  return (
    <section>
      <h2>Sign-in methods</h2>
      <ul>
        {METHODS.map(({ providerId, label }) => {
          const account = accounts.find((a) => a.providerId === providerId)
          return (
            <li key={providerId}>
              <strong>{label}</strong>{' '}
              {account ? (
                <>
                  connected{' '}
                  {providerId === 'credential' && <ChangePassword />}
                  {/* The server enforces this too; disabling just explains it up front. */}
                  <button
                    onClick={() => unlink(account)}
                    disabled={onlyOne}
                    title={onlyOne ? "You can't remove your only sign-in method." : undefined}
                  >
                    Remove
                  </button>
                </>
              ) : providerId === 'credential' ? (
                <SetPassword email={email} />
              ) : (
                <button onClick={() => link(providerId)}>Connect</button>
              )}
            </li>
          )
        })}
      </ul>
      <p>
        Magic links always work with your verified email, so they aren't a separate method here.
      </p>
      {error && <p role="alert">{error}</p>}
    </section>
  )
}

/**
 * Needs the current password, so a stolen session alone can't lock you out.
 * This device stays signed in; every other session is revoked.
 */
function ChangePassword() {
  const [open, setOpen] = useState(false)
  const [error, setError] = useState<string>()
  const [changed, setChanged] = useState(false)

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    const { error } = await authClient.changePassword({
      currentPassword: String(form.get('currentPassword')),
      newPassword: String(form.get('newPassword')),
      revokeOtherSessions: true,
    })
    setError(error?.message)
    if (!error) {
      setChanged(true)
      setOpen(false)
    }
  }

  if (changed && !open) {
    return <span>Password changed; other devices were signed out. </span>
  }
  if (!open) return <button onClick={() => setOpen(true)}>Change</button>

  return (
    <form onSubmit={handleSubmit}>
      <input
        name="currentPassword"
        type="password"
        placeholder="Current password"
        autoComplete="current-password"
        required
      />
      <input
        name="newPassword"
        type="password"
        placeholder="New password"
        autoComplete="new-password"
        minLength={8}
        required
      />
      <button type="submit">Change password</button>
      <button type="button" onClick={() => setOpen(false)}>
        Cancel
      </button>
      {error && <p role="alert">{error}</p>}
    </form>
  )
}

/**
 * Accounts created with Google, GitHub or a magic link have no password.
 * Setting one reuses the reset flow: the emailed link proves you own the address.
 */
function SetPassword({ email }: { email: string }) {
  const [error, setError] = useState<string>()
  const [sent, setSent] = useState(false)
  const captcha = useTurnstile()

  async function handleClick() {
    const { error } = await authClient.requestPasswordReset({
      email,
      redirectTo: '/reset-password',
      fetchOptions: { headers: captcha.headers },
    })
    captcha.reset()
    setError(error?.message)
    setSent(!error)
  }

  if (sent) return <span>We emailed you a link to set a password.</span>

  return (
    <>
      {captcha.widget}
      <button onClick={handleClick} disabled={!captcha.token}>
        {captcha.token ? 'Set a password' : 'Verifying…'}
      </button>
      {error && <span role="alert"> {error}</span>}
    </>
  )
}
