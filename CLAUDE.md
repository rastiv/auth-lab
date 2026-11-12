# CLAUDE.md

This file provides guidance to Claude Code when working in this repository.

## Project goal

**auth-lab** is a live, interactive demo of authentication and authorization methods, hosted at **https://auth.rastiv.dev**. It is a portfolio project. The aim is to show senior-level judgment: every method works for real, and the UI explains what happens under the hood (cookies, sessions, 2FA challenge) and why each trade-off was made.

Scope:
- **Authentication:** email + password (with email verification), magic link, Google, GitHub, passkeys (WebAuthn); login with and without TOTP 2FA.
- **Authorization:** simple roles (USER, MODERATOR, ADMIN) and a small admin panel showing who can do what.
- **Out of scope:** e-commerce features (products, orders) and anything with running costs (e.g. SMS 2FA).

## Decided stack

| Concern | Choice | Reason |
|---|---|---|
| Hosting | Cloudflare Workers (free plan), one Worker serves both the SPA (static assets) and `/api/*` | Same origin: no CORS, first-party cookies, single deploy |
| API framework | Hono | Built for Workers; official Better-Auth integration |
| Auth | Better-Auth | Covers all methods above via plugins |
| Database | Cloudflare D1 (SQLite) + Drizzle ORM | Native D1 support; Better-Auth CLI generates the Drizzle schema |
| Frontend | React + Vite | |
| Build/dev | One Vite project with `@cloudflare/vite-plugin` | `pnpm dev` runs React and the Worker (real `workerd` runtime, local D1) together |
| Validation | Zod (v4), schemas shared between client and server | |
| Email | Resend (HTTP API, free tier) | Workers can't use SMTP the usual way |
| Bot protection | Cloudflare Turnstile (Better-Auth captcha plugin) | Public sign-up form |
| Package manager | pnpm | |

### Password hashing: PBKDF2, not scrypt

Better-Auth's default `scrypt` falls back to pure JS on Workers and can exceed the free plan CPU limit (about 10 ms per request). Use a custom `password.hash` / `password.verify` based on WebCrypto PBKDF2 (`crypto.subtle`), which runs natively.

Measured in production (2026-11-12): PBKDF2-SHA256 costs about 15 ms CPU per 100k iterations; sign-up/sign-in take 17-25 ms CPU in total. The free plan did not reject these requests (20 parallel sign-ins all succeeded), but that is observed behaviour, not a guarantee. Decision: stay on the free plan with 100k iterations (OWASP recommends 600k) and watch Workers Logs for exceeded-CPU errors. Moving to Workers Paid means raising `ITERATIONS` in `worker/password.ts` and adding rehash-on-login for existing hashes (not implemented yet).

## Planned structure

```
src/        React app
worker/     Hono API + Better-Auth config + Drizzle schema/migrations
shared/     Zod schemas and types used by both sides
vite.config.ts
wrangler.jsonc   D1 binding, routes for auth.rastiv.dev
```

A pnpm-workspace monorepo was deliberately rejected: there is a single deployable, so it would add config without benefit.

## Local development (planned)

- `pnpm dev`: Vite + Worker locally; D1 is a SQLite file under `.wrangler/state/`.
- `pnpm wrangler d1 migrations apply DB --local` / `--remote`
- Secrets locally in `.dev.vars` (git-ignored); in production via `wrangler secret put`.
- Tests: Vitest with `@cloudflare/vitest-pool-workers` (runs inside `workerd` with local D1).

## Roadmap

1. **Prototype:** scaffold, Better-Auth + D1 + Drizzle, email/password sign-up + sign-in with PBKDF2; measure CPU time.
2. Email verification + magic link (Resend), Turnstile.
3. Google + GitHub OAuth, account linking.
4. TOTP 2FA (+ backup codes), passkeys.
5. Roles + admin panel.
6. "Under the hood" explainer UI, auto-cleanup of demo accounts (e.g. after 24 h), rate limiting.
7. Tests, GitHub Actions CI, deploy to `auth.rastiv.dev`, README.

## Background

Predecessor: an Express + Prisma + SQLite backend at `D:\Projects\E-Comm-FE-BE\backend` (Better-Auth with email/password, email verification, TOTP 2FA, custom `/sign-in` wrapper, `UserPermission` table). Use it only as a reference for what was already tried. Don't copy Express/Prisma patterns. `D:\Projects\E-Comm-FE-BE\frontend` is an abandoned experiment, so ignore it.

## Working conventions

- Communicate with the user in Bulgarian. Code, comments, identifiers and commit messages in English.
- Explain the reasoning and trade-offs behind technical decisions; the user is growing toward a senior role and makes the key calls.
