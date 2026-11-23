import { integer, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";
import { user } from "./auth-schema";

// Browsers each user has signed in from, so a sign-in from any other one can
// trigger a "new sign-in" email. The browser keeps a random token in a cookie;
// only its hash is stored, so a leaked database can't be used to make an
// attacker's browser look familiar.
export const knownDevice = sqliteTable(
  "known_device",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    tokenHash: text("token_hash").notNull(),
    lastSeenAt: integer("last_seen_at", { mode: "timestamp_ms" })
      .notNull()
      .$defaultFn(() => new Date()),
  },
  // One browser can be known to several accounts (e.g. a shared computer).
  (table) => [uniqueIndex("known_device_userId_tokenHash_idx").on(table.userId, table.tokenHash)],
);
