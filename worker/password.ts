// PBKDF2-SHA256 via WebCrypto. Better-Auth's default scrypt falls back to a
// pure-JS implementation on Workers, which can exceed the free plan's ~10 ms
// CPU limit; crypto.subtle runs natively in workerd.

const ALGORITHM = "pbkdf2-sha256";
// Security vs CPU time trade-off: OWASP recommends 600k for SHA-256, but each
// 100k costs roughly 25 ms locally. To be tuned against production CPU metrics.
const ITERATIONS = 100_000;
const SALT_BYTES = 16;
const KEY_BITS = 256;

// Stored as `pbkdf2-sha256$<iterations>$<salt>$<hash>` (base64). Keeping the
// parameters in the hash lets us raise them later without breaking old hashes.
export async function hashPassword(password: string): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(SALT_BYTES));
  const hash = await derive(password, salt, ITERATIONS);
  return [ALGORITHM, ITERATIONS, toBase64(salt), toBase64(hash)].join("$");
}

export async function verifyPassword({
  hash,
  password,
}: {
  hash: string;
  password: string;
}): Promise<boolean> {
  const [algorithm, iterations, salt, expected] = hash.split("$");
  if (algorithm !== ALGORITHM || !iterations || !salt || !expected) {
    return false;
  }

  const expectedBytes = fromBase64(expected);
  const actualBytes = await derive(password, fromBase64(salt), Number(iterations));
  return (
    actualBytes.byteLength === expectedBytes.byteLength &&
    crypto.subtle.timingSafeEqual(actualBytes, expectedBytes)
  );
}

async function derive(
  password: string,
  salt: Uint8Array<ArrayBuffer>,
  iterations: number,
): Promise<Uint8Array<ArrayBuffer>> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(password),
    "PBKDF2",
    false,
    ["deriveBits"],
  );
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", hash: "SHA-256", salt, iterations },
    key,
    KEY_BITS,
  );
  return new Uint8Array(bits);
}

function toBase64(bytes: Uint8Array): string {
  return btoa(String.fromCharCode(...bytes));
}

function fromBase64(value: string): Uint8Array<ArrayBuffer> {
  return Uint8Array.from(atob(value), (char) => char.charCodeAt(0));
}
