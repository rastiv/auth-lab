import { defineConfig } from 'drizzle-kit'

// Only generates SQL; migrations are applied by wrangler (`pnpm db:migrate:local`).
export default defineConfig({
  dialect: 'sqlite',
  schema: './worker/db/schema.ts',
  out: './worker/db/migrations',
})
