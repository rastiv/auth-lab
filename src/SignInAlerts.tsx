import { useState } from 'react'
import { authClient } from './lib/auth-client'

/** On by default; worker/known-devices.ts decides which browsers are new. */
export function SignInAlerts({ enabled }: { enabled: boolean }) {
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string>()

  async function toggle() {
    setSaving(true)
    // The session refetches on its own afterwards, which moves the switch.
    const { error } = await authClient.updateUser({ newDeviceAlerts: !enabled })
    setSaving(false)
    setError(error?.message)
  }

  return (
    <section>
      <h2>Sign-in alerts</h2>
      <label>
        <input type="checkbox" role="switch" checked={enabled} onChange={toggle} disabled={saving} />{' '}
        Email me when my account is signed in to from a new browser
      </label>
      <p>
        Each browser you sign in from is remembered. When someone signs in from a browser we
        haven't seen before, we email you which device, roughly where and how, so you can act right
        away if it wasn't you.
      </p>
      <p>
        You'll also get this email when you sign in yourself on a new device, in a private window
        or after clearing cookies. We recommend keeping it on.
      </p>
      {error && <p role="alert">{error}</p>}
    </section>
  )
}
