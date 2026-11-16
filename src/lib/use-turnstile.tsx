import { useCallback, useState } from 'react'
import { TurnstileWidget } from './turnstile-widget'

/**
 * A Turnstile widget plus the token it produced. Tokens are single-use (the
 * server redeems them with Cloudflare), so call reset() after every submit.
 */
export function useTurnstile() {
  const [token, setToken] = useState<string>()
  const [generation, setGeneration] = useState(0)

  const reset = useCallback(() => {
    setToken(undefined)
    // A new key remounts the widget, which issues a fresh token.
    setGeneration((n) => n + 1)
  }, [])

  return {
    token,
    reset,
    widget: <TurnstileWidget key={generation} onToken={setToken} />,
    // Better-Auth's captcha plugin reads the token from this header.
    headers: { 'x-captcha-response': token ?? '' },
  }
}
