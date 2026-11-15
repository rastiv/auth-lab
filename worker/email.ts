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

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll('"', "&quot;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}
