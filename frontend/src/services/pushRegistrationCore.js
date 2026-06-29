const REFRESH_INTERVAL_MS = 24 * 60 * 60 * 1000

export function shouldRegisterPush(lastRegisteredAt, now = Date.now()) {
  return !Number.isFinite(lastRegisteredAt)
    || now - lastRegisteredAt >= REFRESH_INTERVAL_MS
}
