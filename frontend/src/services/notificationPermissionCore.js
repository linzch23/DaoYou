export function shouldRequestNotificationPermission({
  platform,
  sdkInt,
  requested,
  granted,
}) {
  return platform === 'android'
    && sdkInt >= 33
    && requested !== true
    && granted !== true
}
