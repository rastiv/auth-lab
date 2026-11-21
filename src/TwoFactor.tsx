import { useState, type FormEvent } from 'react'
import { renderSVG } from 'uqr'
import { authClient } from './lib/auth-client'

/**
 * Second step of a password sign-in for accounts with 2FA. The server has not
 * created a session yet: it waits for a valid code (10-minute window, failed
 * attempts counted in the database).
 */
export function TwoFactorChallenge() {
  const [useBackupCode, setUseBackupCode] = useState(false)
  const [error, setError] = useState<string>()

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    const code = String(form.get('code')).trim()
    // A signed cookie that skips this step on this browser for 30 days.
    const trustDevice = form.get('trustDevice') === 'on'
    const { error } = useBackupCode
      ? await authClient.twoFactor.verifyBackupCode({ code, trustDevice })
      : await authClient.twoFactor.verifyTotp({ code, trustDevice })
    // On success the session refetches and the app shows the signed-in view.
    setError(error?.message)
  }

  return (
    <form onSubmit={handleSubmit}>
      <h2>Two-factor authentication</h2>
      <p>
        {useBackupCode
          ? 'Enter one of your backup codes. Each code works only once.'
          : 'Enter the 6-digit code from your authenticator app.'}
      </p>
      <input
        name="code"
        placeholder={useBackupCode ? 'Backup code' : '123456'}
        autoComplete="one-time-code"
        inputMode={useBackupCode ? 'text' : 'numeric'}
        pattern={useBackupCode ? undefined : '[0-9]{6}'}
        required
      />
      <label>
        <input type="checkbox" name="trustDevice" /> Trust this device for 30 days
      </label>
      <button type="submit">Verify</button>
      <button
        type="button"
        onClick={() => {
          setUseBackupCode(!useBackupCode)
          setError(undefined)
        }}
      >
        {useBackupCode ? 'Use an authenticator code' : 'Use a backup code'}
      </button>
      {error && <p role="alert">{error}</p>}
    </form>
  )
}

type Setup = { totpURI: string; backupCodes: string[] }

/**
 * On/off switch for TOTP. Both directions ask for the password, so a stolen
 * session alone can neither turn 2FA off nor bind the attacker's authenticator.
 */
export function TwoFactorSetting({ enabled }: { enabled: boolean }) {
  const [confirming, setConfirming] = useState(false)
  const [setup, setSetup] = useState<Setup>()
  const [backupCodes, setBackupCodes] = useState<string[]>()
  const [error, setError] = useState<string>()

  function reset() {
    setConfirming(false)
    setSetup(undefined)
    setBackupCodes(undefined)
    setError(undefined)
  }

  async function handlePassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const password = String(new FormData(event.currentTarget).get('password'))
    if (enabled) {
      const { error } = await authClient.twoFactor.disable({ password })
      if (error) return setError(error.message)
      reset()
    } else {
      // Creates the secret, but 2FA stays off until a code proves the scan worked.
      const { data, error } = await authClient.twoFactor.enable({ password })
      if (error) return setError(error.message)
      setError(undefined)
      setConfirming(false)
      // "otp" (codes by email) is another 2FA method this app doesn't enable.
      if (data.method === 'totp') setSetup(data)
    }
  }

  async function handleCode(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const code = String(new FormData(event.currentTarget).get('code')).trim()
    const { error } = await authClient.twoFactor.verifyTotp({ code })
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
    const secret = new URL(setup.totpURI).searchParams.get('secret') ?? ''
    // An <img> with a data URI, not injected markup: the SVG can't run script.
    const qrCode = `data:image/svg+xml;utf8,${encodeURIComponent(renderSVG(setup.totpURI))}`
    return (
      <form onSubmit={handleCode}>
        <p>Scan this with your authenticator app, then enter the code it shows.</p>
        <img src={qrCode} alt="QR code for your authenticator app" width={180} height={180} />
        <p>
          Can't scan? Enter this key manually: <code>{secret.match(/.{1,4}/g)?.join(' ')}</code>
        </p>
        <input
          name="code"
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
        Two-factor authentication (authenticator app)
      </label>
      {confirming && (
        <form onSubmit={handlePassword}>
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
