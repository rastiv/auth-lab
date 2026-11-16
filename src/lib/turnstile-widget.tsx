import { useEffect, useRef } from 'react'

declare global {
  interface ImportMetaEnv {
    readonly VITE_TURNSTILE_SITE_KEY: string
  }
  interface Window {
    turnstile?: {
      render(
        container: HTMLElement,
        options: {
          sitekey: string
          callback: (token: string) => void
          'expired-callback': () => void
          'error-callback': () => void
        },
      ): string
      remove(widgetId: string): void
    }
  }
}

// Loaded on first use and shared by every widget on the page.
let scriptPromise: Promise<void> | undefined

function loadScript() {
  scriptPromise ??= new Promise((resolve, reject) => {
    const script = document.createElement('script')
    script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit'
    script.async = true
    script.onload = () => resolve()
    script.onerror = () => {
      scriptPromise = undefined
      reject(new Error('Failed to load Turnstile'))
    }
    document.head.append(script)
  })
  return scriptPromise
}

export function TurnstileWidget({
  onToken,
}: {
  onToken: (token: string | undefined) => void
}) {
  const container = useRef<HTMLDivElement>(null)

  useEffect(() => {
    let widgetId: string | undefined
    let unmounted = false
    loadScript()
      .then(() => {
        if (unmounted || !container.current || !window.turnstile) return
        widgetId = window.turnstile.render(container.current, {
          sitekey: import.meta.env.VITE_TURNSTILE_SITE_KEY,
          callback: onToken,
          'expired-callback': () => onToken(undefined),
          'error-callback': () => onToken(undefined),
        })
      })
      .catch(console.error)
    return () => {
      unmounted = true
      if (widgetId) window.turnstile?.remove(widgetId)
    }
  }, [onToken])

  return <div ref={container} />
}
