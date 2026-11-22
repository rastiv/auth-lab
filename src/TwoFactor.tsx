import { useEffect, useState, type FormEvent } from 'react'
import { renderSVG } from 'uqr'
import { authClient } from './lib/auth-client'

/** 'app': an authenticator app (TOTP). 'email': a one-time code sent by email. */
export type TwoFactorMethod = 'app' | 'email'

/**
 * Second step of a password sign-in for accounts with 2FA. The server has not
 * created a session yet: it waits for a valid code (10-minute window, failed
 * attempts counted in the database).
 */
export function TwoFactorChallenge({ method }: { method: TwoFactorMethod }) {
  const [useBackupCode, setUseBackupCode] = useState(false)
  const [error, setError] = useState<string>()
  const [status, setStatus] = useState<string>()

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    const code = String(form.get('code')).trim()
    // A signed cookie that skips this step on this browser for 30 days.
    const trustDevice = form.get('trustDevice') === 'on'
    const { error } =
      method === 'email'
        ? await authClient.twoFactor.verifyOtp({ code, trustDevice })
        : useBackupCode
          ? await authClient.twoFactor.verifyBackupCode({ code, trustDevice })
          : await authClient.twoFactor.verifyTotp({ code, trustDevice })
    // On success the session refetches and the app shows the signed-in view.
    setError(error?.message)
  }

  async function resend() {
    // A new code replaces the old one.
    const { error } = await authClient.twoFactor.sendOtp()
    setError(error?.message)
    setStatus(error ? undefined : 'We sent a new code.')
  }

  const numeric = method === 'email' || !useBackupCode

  return (
    <form onSubmit={handleSubmit}>
      <h2>Two-factor authentication</h2>
      <p>
        {method === 'email'
          ? 'We emailed you a 6-digit code. It expires in 5 minutes.'
          : useBackupCode
            ? 'Enter one of your backup codes. Each code works only once.'
            : 'Enter the 6-digit code from your authenticator app.'}
      </p>
      <input
        name="code"
        placeholder={numeric ? '123456' : 'Backup code'}
        autoComplete="one-time-code"
        inputMode={numeric ? 'numeric' : 'text'}
        pattern={numeric ? '[0-9]{6}' : undefined}
        required
      />
      <label>
        <input type="checkbox" name="trustDevice" /> Trust this device for 30 days
      </label>
      <button type="submit">Verify</button>
      {method === 'email' ? (
        <button type="button" onClick={resend}>
          Send a new code
        </button>
      ) : (
        <button
          type="button"
          onClick={() => {
            setUseBackupCode(!useBackupCode)
            setError(undefined)
          }}
        >
          {useBackupCode ? 'Use an authenticator code' : 'Use a backup code'}
        </button>
      )}
      {status && <p role="status">{status}</p>}
      {error && <p role="alert">{error}</p>}
    </form>
  )
}

type Setup = { totpURI: string; backupCodes: string[] }

const METHOD_LABELS: Record<TwoFactorMethod, string> = {
  app: 'authenticator app',
  email: 'code by email, the weaker option',
}

/**
 * On/off switch for 2FA. Both directions ask for the password, so a stolen
 * session alone can neither turn 2FA off nor bind the attacker's authenticator.
 * To change the method, turn 2FA off and on again.
 */
export function TwoFactorSetting({ enabled }: { enabled: boolean }) {
  const [method, setMethod] = useState<TwoFactorMethod>()
  const [confirming, setConfirming] = useState(false)
  const [setup, setSetup] = useState<Setup>()
  const [backupCodes, setBackupCodes] = useState<string[]>()
  const [error, setError] = useState<string>()

  // The session only says whether 2FA is on, not which method.
  useEffect(() => {
    if (!enabled) return
    let ignore = false
    fetch('/api/two-factor-method')
      .then((response) => response.json() as Promise<{ method: TwoFactorMethod | null }>)
      .then((data) => {
        if (!ignore) setMethod(data.method ?? undefined)
      })
    return () => {
      ignore = true
    }
  }, [enabled])

  function reset() {
    setConfirming(false)
    setSetup(undefined)
    setBackupCodes(undefined)
    setError(undefined)
  }

  async function handlePassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    const password = String(form.get('password'))
    if (enabled) {
      const { error } = await authClient.twoFactor.disable({ password })
      if (error) return setError(error.message)
      reset()
      return
    }
    const chosen = form.get('method') === 'email' ? 'otp' : 'totp'
    // TOTP creates the secret, but 2FA stays off until a code proves the scan
    // worked. Email codes are on right away.
    const { data, error } = await authClient.twoFactor.enable({ password, method: chosen })
    if (error) return setError(error.message)
    setError(undefined)
    setConfirming(false)
    if (data.method === 'totp') setSetup(data)
  }

  async function handleCode(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const code = String(new FormData(event.currentTarget).get('code')).trim()
    const { error } = await authClient.twoFactor.verifyTotp({ code })
    if (error?.code === 'INVALID_CODE') {
      // Usually a leftover entry from an earlier setup: apps keep both under the same name.
      return setError(
        "That code doesn't match. If your app shows more than one auth-lab entry, delete the older ones and use the newest.",
      )
    }
    if (error) return setError(error.message)
    setError(undefined)
    setBackupCodes(setup?.backupCodes)
    setSetup(undefined)
  }

  if (backupCodes) {
    return (
      <div>
        <p>
          Two-factor authentication is on. Save these backup codes somewhere safe: each one
          signs you in once if you lose your phone. They won't be shown again.
        </p>
        <ul>
          {backupCodes.map((code) => (
            <li key={code}>
              <code>{code}</code>
            </li>
          ))}
        </ul>
        <button onClick={reset}>I've saved them</button>
      </div>
    )
  }

  if (setup) {
    // An <img> with a data URI, not injected markup: the SVG can't run script.
    const qrCode = `data:image/svg+xml;utf8,${encodeURIComponent(renderSVG(setup.totpURI))}`
    return (
      <form onSubmit={handleCode}>
        <ol>
          <li>
            Open an authenticator app on your phone. Don't have one? Install a free one from
            your app store: Google Authenticator, Microsoft Authenticator, Authy, 2FAS or
            Bitwarden Authenticator.
          </li>
          <li>In the app, add a new account and scan this QR code:</li>
        </ol>
        <img src={qrCode} alt="QR code for your authenticator app" width={180} height={180} />
        <ol start={3}>
          <li>
            The app now shows a 6-digit code for auth-lab. It changes every 30 seconds. Enter
            the current one here:
          </li>
        </ol>
        <input
          name="code"
          aria-label="6-digit code from your app"
          placeholder="123456"
          autoComplete="one-time-code"
          inputMode="numeric"
          pattern="[0-9]{6}"
          required
        />
        <button type="submit">Turn on</button>
        <button type="button" onClick={reset}>
          Cancel
        </button>
        {error && <p role="alert">{error}</p>}
      </form>
    )
  }

  return (
    <div>
      <label>
        <input
          type="checkbox"
          role="switch"
          checked={enabled}
          onChange={() => setConfirming(true)}
          disabled={confirming}
        />{' '}
        Two-factor authentication
        {enabled && method && ` (${METHOD_LABELS[method]})`}
      </label>
      {confirming && (
        <form onSubmit={handlePassword}>
          {!enabled && (
            <fieldset>
              <legend>How should we ask for the second step?</legend>
              <label>
                <input type="radio" name="method" value="app" defaultChecked />{' '}
                <strong>Authenticator app</strong> (recommended): codes come from an app on your
                phone, so someone who gets into your email still can't sign in.
              </label>
              <label>
                <input type="radio" name="method" value="email" /> <strong>Code by email</strong>{' '}
                (easier, weaker): nothing to install, but whoever controls your inbox has both
                factors, and could also sign in with a magic link.
              </label>
            </fieldset>
          )}
          <input
            name="password"
            type="password"
            placeholder={enabled ? 'Password to turn it off' : 'Password to turn it on'}
            autoComplete="current-password"
            required
          />
          <button type="submit">Confirm</button>
          <button type="button" onClick={reset}>
            Cancel
          </button>
          {error && <p role="alert">{error}</p>}
        </form>
      )}
    </div>
  )
}
