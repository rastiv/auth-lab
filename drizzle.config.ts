import { readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { defineConfig } from 'drizzle-kit'

// Local D1 is a plain SQLite file managed by wrangler; Drizzle Studio
// (`pnpm db:studio`) opens it directly.
const LOCAL_D1_DIR = '.wrangler/state/v3/d1/miniflare-D1DatabaseObject'

// Wrangler names the file by a hash and starts a new one when database_id
// changes, so pick the most recently written database.
function findLocalD1File(): string | undefined {
  try {
    return readdirSync(LOCAL_D1_DIR)
      .filter((name) => name.endsWith('.sqlite') && name !== 'metadata.sqlite')
      .map((name) => join(LOCAL_D1_DIR, name))
      .sort((a, b) => lastWrite(b) - lastWrite(a))[0]
  } catch {
    return undefined
  }
}

// Recent writes land in the WAL file first, so check it too.
function lastWrite(file: string): number {
  const wal = statSync(`${file}-wal`, { throwIfNoEntry: false })
  return Math.max(statSync(file).mtimeMs, wal?.mtimeMs ?? 0)
}

const localD1File = findLocalD1File()

// Only generates SQL; migrations are applied by wrangler (`pnpm db:migrate:local`).
export default defineConfig({
  dialect: 'sqlite',
  schema: './worker/db/schema.ts',
  out: './worker/db/migrations',
  ...(localD1File && { dbCredentials: { url: `file:${localD1File}` } }),
})
