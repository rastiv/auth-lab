import { useState, type FormEvent } from 'react'
import { authClient } from './lib/auth-client'
import { useTurnstile } from './lib/use-turnstile'

// Better-Auth redirects back with ?error=... when an email link is invalid or expired.
const linkError = new URLSearchParams(window.location.search).get('error')

function App() {
  const { data: session, isPending, isRefetching } = authClient.useSession()

  // While signed out, every session refetch (e.g. after sign-up) also reports
  // isPending; only block the UI on the first load so forms keep their state.
  if (isPending && !isRefetching) return <p>Loading...</p>

  return (
    <main>
      <h1>auth-lab</h1>
      {linkError && (
        <p role="alert">This link is invalid, expired, or already used. Request a new one.</p>
      )}
      {session ? (
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
