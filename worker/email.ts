import { env } from "cloudflare:workers";

type Email = { to: string; subject: string; text: string; html: string };

// Resend's HTTP API is a single fetch, so no SDK (Workers can't use SMTP anyway).
export async function sendEmail(email: Email): Promise<void> {
  if (import.meta.env.DEV) {
    // Local development never sends real email; the link is printed instead.
    console.log(`\n[email] to: ${email.to}\n[email] subject: ${email.subject}\n${email.text}\n`);
    return;
  }

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ from: env.EMAIL_FROM, ...email }),
  });
  if (!response.ok) {
    throw new Error(`Resend responded ${response.status}: ${await response.text()}`);
  }
}

export function verificationEmail(url: string): Omit<Email, "to"> {
  return {
    subject: "Verify your email for auth-lab",
    text: `Confirm your email address by opening this link:\n${url}\n\nThe link expires in 1 hour. If you didn't sign up, ignore this email.`,
    html: `<p>Confirm your email address:</p><p><a href="${escapeHtml(url)}">Verify email</a></p><p>The link expires in 1 hour. If you didn't sign up, ignore this email.</p>`,
  };
}

export function magicLinkEmail(url: string): Omit<Email, "to"> {
  return {
    subject: "Your sign-in link for auth-lab",
    text: `Sign in to auth-lab by opening this link:
${url}

The link works once and expires in 5 minutes. If you didn't request it, ignore this email.`,
    html: `<p>Sign in to auth-lab:</p><p><a href="${escapeHtml(url)}">Sign in</a></p><p>The link works once and expires in 5 minutes. If you didn't request it, ignore this email.</p>`,
  };
}

export function resetPasswordEmail(url: string): Omit<Email, "to"> {
  return {
    subject: "Reset your auth-lab password",
    text: `Choose a new password by opening this link:
${url}

The link works once and expires in 1 hour. If you didn't request it, ignore this email: your password stays the same.`,
    html: `<p>Choose a new password for auth-lab:</p><p><a href="${escapeHtml(url)}">Reset password</a></p><p>The link works once and expires in 1 hour. If you didn't request it, ignore this email: your password stays the same.</p>`,
  };
}

// The code stays out of the subject, so it doesn't show on a lock screen.
export function twoFactorCodeEmail(code: string): Omit<Email, "to"> {
  return {
    subject: "Your auth-lab sign-in code",
    text: `Your sign-in code is ${code}

It works once and expires in 5 minutes.

This email means someone just entered your password. If it wasn't you, change your password right away.`,
    html: `<p>Your sign-in code is</p><p style="font-size:24px;letter-spacing:4px"><strong>${escapeHtml(code)}</strong></p><p>It works once and expires in 5 minutes.</p><p>This email means someone just entered your password. <strong>If it wasn't you</strong>, change your password right away.</p>`,
  };
}

// Sent after both a change and a reset (which also covers setting a first password).
export function passwordChangedEmail(appUrl: string): Omit<Email, "to"> {
  return {
    subject: "Your auth-lab password was changed",
    text: `A new password was just set for your auth-lab account, and your other devices were signed out.

If this was you, there's nothing to do.

If it wasn't, someone may have access to your account: reset your password right away with "Forgot your password?" at ${appUrl}`,
    html: `<p>A new password was just set for your auth-lab account, and your other devices were signed out.</p><p>If this was you, there's nothing to do.</p><p><strong>If it wasn't</strong>, someone may have access to your account: reset your password right away with "Forgot your password?" at <a href="${escapeHtml(appUrl)}">auth-lab</a>.</p>`,
  };
}

export type NewDeviceSignIn = {
  /** Already a label, e.g. "Google" or "password + authenticator app". */
  method: string;
  device: string;
  /** "Sofia, BG · Vivacom Bulgaria EAD", or empty when unknown. */
  location: string;
  when: Date;
  /** Google or GitHub, when the sign-in went through one. */
  provider?: string;
};

export function newDeviceEmail(appUrl: string, signIn: NewDeviceSignIn): Omit<Email, "to"> {
  const when = `${new Intl.DateTimeFormat("en-GB", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "UTC",
  }).format(signIn.when)} UTC`;
  const details = [
    ["Device", signIn.device],
    ["Location (approximate)", signIn.location || "unknown"],
    ["Signed in with", signIn.method],
    ["Time", when],
  ];
  // With Google or GitHub, the way in was that account, not our password.
  const secure = signIn.provider
    ? `secure your ${signIn.provider} account`
    : "change your password";
  const advice = (link: string) =>
    `sign in at ${link}, ${secure}, and choose "Sign out everywhere else" under "Where you're signed in".`;
  return {
    subject: `New sign-in to auth-lab from ${signIn.device}`,
    text: `Your auth-lab account was just signed in to from a browser it hasn't been used on before.

${details.map(([label, value]) => `${label}: ${value}`).join("\n")}

If this was you, there's nothing to do. You'll also get this after clearing cookies or in a private window.

If it wasn't, someone may have access to your account: ${advice(appUrl)}`,
    html: `<p>Your auth-lab account was just signed in to from a browser it hasn't been used on before.</p><p>${details.map(([label, value]) => `${label}: <strong>${escapeHtml(value)}</strong>`).join("<br>")}</p><p>If this was you, there's nothing to do. You'll also get this after clearing cookies or in a private window.</p><p><strong>If it wasn't</strong>, someone may have access to your account: ${advice(`<a href="${escapeHtml(appUrl)}">auth-lab</a>`)}</p>`,
  };
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll('"', "&quot;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}
