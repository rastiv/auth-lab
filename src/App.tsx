import { useState, type FormEvent } from 'react'
import { authClient } from './lib/auth-client'
import { useTurnstile } from './lib/use-turnstile'

const params = new URLSearchParams(window.location.search)
// Better-Auth redirects back with ?error=... when an email link is invalid or expired.
const linkError = params.get('error')
// A valid password reset link lands on /reset-password?token=...
const initialResetToken = window.location.pathname === '/reset-password' ? params.get('token') : null

const LINK_ERROR_MESSAGE = 'This link is invalid, expired, or already used. Request a new one.'

function App() {
  const { data: session, isPending, isRefetching } = authClient.useSession()
  const [resetToken, setResetToken] = useState(initialResetToken)
  const [passwordReset, setPasswordReset] = useState(false)

  function handlePasswordReset() {
    // Drop the spent token from the address bar and history.
    window.history.replaceState(null, '', '/')
    setResetToken(null)
    setPasswordReset(true)
    // The server just revoked every session, but /reset-password isn't one of
    // the paths that make useSession refetch on its own.
    authClient.$store.notify('$sessionSignal')
  }

  // While signed out, every session refetch (e.g. after sign-up) also reports
  // isPending; only block the UI on the first load so forms keep their state.
  if (isPending && !isRefetching) return <p>Loading...</p>

  return (
    <main>
      <h1>auth-lab</h1>
      {linkError && <p role="alert">{LINK_ERROR_MESSAGE}</p>}
      {passwordReset && (
        <p role="status">
          Your password was changed and every session was signed out. Sign in with the new
          password.
        </p>
      )}
      {resetToken ? (
        <ResetPasswordForm token={resetToken} onDone={handlePasswordReset} />
      ) : session ? (
        <section>
          <p>
            Signed in as <strong>{session.user.email}</strong>
          </p>
          <button onClick={() => authClient.signOut()}>Sign out</button>
        </section>
      ) : (
        <>
          <SignUpForm />
          <SignInForm />
          <ForgotPasswordForm />
          <MagicLinkForm />
        </>
      )}
    </main>
  )
}

function SignUpForm() {
  const [error, setError] = useState<string>()
  const [sentTo, setSentTo] = useState<string>()
  const captcha = useTurnstile()

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    const email = String(form.get('email'))
    const { error } = await authClient.signUp.email({
      name: String(form.get('name')),
      email,
      password: String(form.get('password')),
      fetchOptions: { headers: captcha.headers },
    })
    captcha.reset()
    setError(error?.message)
    setSentTo(error ? undefined : email)
  }

  if (sentTo) {
    return (
      <p>
        Check your inbox: we sent a verification link to <strong>{sentTo}</strong>.
      </p>
    )
  }

  return (
    <form onSubmit={handleSubmit}>
      <h2>Sign up</h2>
      <input name="name" placeholder="Name" required />
      <input name="email" type="email" placeholder="Email" required />
      <input name="password" type="password" placeholder="Password" minLength={8} required />
      {captcha.widget}
      <button type="submit" disabled={!captcha.token}>
        {captcha.token ? 'Create account' : 'Verifying…'}
      </button>
      {error && <p role="alert">{error}</p>}
    </form>
  )
}

function SignInForm() {
  const [error, setError] = useState<string>()
  const captcha = useTurnstile()

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    const { error } = await authClient.signIn.email({
      email: String(form.get('email')),
      password: String(form.get('password')),
      fetchOptions: { headers: captcha.headers },
    })
    captcha.reset()
    // A failed captcha is a 403 too, so match on the code.
    if (error?.code === 'EMAIL_NOT_VERIFIED') {
      setError('Your email is not verified yet. We sent you a new verification link.')
    } else {
      setError(error?.message)
    }
  }

  return (
    <form onSubmit={handleSubmit}>
      <h2>Sign in</h2>
      <input name="email" type="email" placeholder="Email" required />
      <input name="password" type="password" placeholder="Password" required />
      {captcha.widget}
      <button type="submit" disabled={!captcha.token}>
        {captcha.token ? 'Sign in' : 'Verifying…'}
      </button>
      {error && <p role="alert">{error}</p>}
    </form>
  )
}

function ForgotPasswordForm() {
  const [error, setError] = useState<string>()
  const [sentTo, setSentTo] = useState<string>()
  const captcha = useTurnstile()

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const email = String(new FormData(event.currentTarget).get('email'))
    const { error } = await authClient.requestPasswordReset({
      email,
      redirectTo: '/reset-password',
      fetchOptions: { headers: captcha.headers },
    })
    captcha.reset()
    setError(error?.message)
    setSentTo(error ? undefined : email)
  }

  if (sentTo) {
    // Worded so it doesn't reveal whether the address has an account.
    return (
      <p>
        If an account exists for <strong>{sentTo}</strong>, we sent it a link to reset the
        password. It expires in 1 hour.
      </p>
    )
  }

  return (
    <form onSubmit={handleSubmit}>
      <h2>Forgot your password?</h2>
      <input name="email" type="email" placeholder="Email" required />
      {captcha.widget}
      <button type="submit" disabled={!captcha.token}>
        {captcha.token ? 'Email me a reset link' : 'Verifying…'}
      </button>
      {error && <p role="alert">{error}</p>}
    </form>
  )
}

function ResetPasswordForm({ token, onDone }: { token: string; onDone: () => void }) {
  const [error, setError] = useState<string>()

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const { error } = await authClient.resetPassword({
      newPassword: String(new FormData(event.currentTarget).get('password')),
      token,
    })
    if (!error) onDone()
    else setError(error.code === 'INVALID_TOKEN' ? LINK_ERROR_MESSAGE : error.message)
  }

  return (
    <form onSubmit={handleSubmit}>
      <h2>Choose a new password</h2>
      <input
        name="password"
        type="password"
        placeholder="New password"
        autoComplete="new-password"
        minLength={8}
        required
      />
      <button type="submit">Set new password</button>
      {error && <p role="alert">{error}</p>}
      <p>
        <a href="/">Back to sign in</a>
      </p>
    </form>
  )
}

function MagicLinkForm() {
  const [error, setError] = useState<string>()
  const [sentTo, setSentTo] = useState<string>()
  const captcha = useTurnstile()

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const email = String(new FormData(event.currentTarget).get('email'))
    const { error } = await authClient.signIn.magicLink({
      email,
      callbackURL: '/',
      fetchOptions: { headers: captcha.headers },
    })
    captcha.reset()
    setError(error?.message)
    setSentTo(error ? undefined : email)
  }

  if (sentTo) {
    return (
      <p>
        Check your inbox: we sent a sign-in link to <strong>{sentTo}</strong>. It expires in 5
        minutes.
      </p>
    )
  }

  return (
    <form onSubmit={handleSubmit}>
      <h2>Sign in with a magic link</h2>
      <input name="email" type="email" placeholder="Email" required />
      {captcha.widget}
      <button type="submit" disabled={!captcha.token}>
        {captcha.token ? 'Email me a link' : 'Verifying…'}
      </button>
      {error && <p role="alert">{error}</p>}
    </form>
  )
}

export default App
