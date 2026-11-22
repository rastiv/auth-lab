import { AUTH_EVENT_RETENTION_DAYS } from '../shared/auth-events'

const CONTACT_EMAIL = 'rastiv.bg@gmail.com'

export function PrivacyPolicy() {
  return (
    <main>
      <h1>Privacy policy</h1>
      <p>Last updated: 22 November 2026</p>
      <p>
        auth-lab is an open-source reference implementation of modern authentication by Raycho
        Ivanov. Every sign-in method runs for real, and the trade-offs behind each one are
        explained. It is not a commercial service.
      </p>

      <h2>What is stored</h2>
      <ul>
        <li>
          <strong>Your account:</strong> email address, name, profile picture URL (if Google or
          GitHub provides one), and whether your email is verified.
        </li>
        <li>
          <strong>How you sign in:</strong> a hash of your password (never the password itself).
          For Google or GitHub, your account ID there and encrypted access tokens. Only your basic
          profile and email address are requested from them.
        </li>
        <li>
          <strong>Two-factor authentication</strong> (if you turn it on): your authenticator
          secret and backup codes, encrypted.
        </li>
        <li>
          <strong>Sessions:</strong> a session cookie, and the IP address and browser of each
          signed-in session.
        </li>
        <li>
          <strong>Account activity:</strong> sign-ins, failed sign-in attempts, sign-outs and
          security changes (such as a new password), each with the time, the browser and
          operating system, and the approximate city, country and network provider. No IP
          address is kept in this log. You can see it under "Recent activity"; it is deleted after{' '}
          {AUTH_EVENT_RETENTION_DAYS} days.
        </li>
        <li>
          <strong>Email links:</strong> short-lived tokens for verification, sign-in and password
          reset links. They expire within an hour.
        </li>
      </ul>

      <h2>Why</h2>
      <p>
        Only to let you sign in and to demonstrate how authentication works. There are no ads,
        no analytics and no tracking cookies. Your data is never sold or shared for marketing.
      </p>
      <p>
        The activity log is for your security: it lets you spot a sign-in that wasn't you. Under
        the GDPR, this is a legitimate interest (Art. 6(1)(f)).
      </p>

      <h2>Services that process your data</h2>
      <ul>
        <li>
          <strong>Cloudflare:</strong> hosting, database and bot protection (Turnstile).
        </li>
        <li>
          <strong>Resend:</strong> sends the emails.
        </li>
        <li>
          <strong>Google and GitHub:</strong> only if you choose to sign in with them.
        </li>
      </ul>

      <h2>How long</h2>
      <p>This is a demo: accounts and their data may be deleted at any time.</p>

      <h2>Your rights</h2>
      <p>
        To see or delete your data, email <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>.
      </p>

      <p>
        <a href="/">Back to auth-lab</a>
      </p>
    </main>
  )
}

export function TermsOfService() {
  return (
    <main>
      <h1>Terms of service</h1>
      <p>Last updated: 20 November 2026</p>
      <ul>
        <li>
          auth-lab is a live demonstration, provided as is, without any guarantee of
          availability.
        </li>
        <li>Don't use it for anything important: accounts may be deleted at any time.</li>
        <li>
          Don't abuse it: no automated sign-ups, spam, or attempts to break into other
          people's accounts.
        </li>
        <li>
          Your data is handled as described in the <a href="/privacy">privacy policy</a>.
        </li>
      </ul>
      <p>
        Questions: <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>
      </p>
      <p>
        <a href="/">Back to auth-lab</a>
      </p>
    </main>
  )
}
