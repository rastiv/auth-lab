/**
 * "Chrome on Windows" from a User-Agent string. A few lines instead of a
 * parser package: only the browser and OS families are shown or stored, never
 * the full string. Brave deliberately reports itself as Chrome.
 */
export function describeDevice(userAgent: string | null | undefined): string {
  if (!userAgent) return 'Unknown device'
  const browser = /Edg\//.test(userAgent)
    ? 'Edge'
    : /OPR\//.test(userAgent)
      ? 'Opera'
      : /Firefox\/|FxiOS/.test(userAgent)
        ? 'Firefox'
        : /SamsungBrowser/.test(userAgent)
          ? 'Samsung Internet'
          : /Chrome\/|CriOS/.test(userAgent)
            ? 'Chrome'
            : /Safari\//.test(userAgent)
              ? 'Safari'
              : 'Unknown browser'
  // Android and iOS first: their User-Agents also mention Linux and Mac OS X.
  const os = /Android/.test(userAgent)
    ? 'Android'
    : /iPhone|iPad|iPod/.test(userAgent)
      ? 'iOS'
      : /Windows/.test(userAgent)
        ? 'Windows'
        : /Mac OS X/.test(userAgent)
          ? 'macOS'
          : /CrOS/.test(userAgent)
            ? 'ChromeOS'
            : /Linux/.test(userAgent)
              ? 'Linux'
              : undefined
  return os ? `${browser} on ${os}` : browser
}
