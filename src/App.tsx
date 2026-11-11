import { useState, type FormEvent } from 'react'
import { authClient } from './lib/auth-client'

function App() {
  const { data: session, isPending } = authClient.useSession()

  if (isPending) return <p>Loading...</p>

  return (
    <main>
      <h1>auth-lab</h1>
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
        </>
      )}
    </main>
  )
}

function SignUpForm() {
  const [error, setError] = useState<string>()

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    const { error } = await authClient.signUp.email({
      name: String(form.get('name')),
      email: String(form.get('email')),
      password: String(form.get('password')),
    })
    setError(error?.message)
  }

  return (
    <form onSubmit={handleSubmit}>
      <h2>Sign up</h2>
      <input name="name" placeholder="Name" required />
      <input name="email" type="email" placeholder="Email" required />
      <input name="password" type="password" placeholder="Password" minLength={8} required />
      <button type="submit">Create account</button>
      {error && <p role="alert">{error}</p>}
    </form>
  )
}

function SignInForm() {
  const [error, setError] = useState<string>()

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    const { error } = await authClient.signIn.email({
      email: String(form.get('email')),
      password: String(form.get('password')),
    })
    setError(error?.message)
  }

  return (
    <form onSubmit={handleSubmit}>
      <h2>Sign in</h2>
      <input name="email" type="email" placeholder="Email" required />
      <input name="password" type="password" placeholder="Password" required />
      <button type="submit">Sign in</button>
      {error && <p role="alert">{error}</p>}
    </form>
  )
}

export default App
