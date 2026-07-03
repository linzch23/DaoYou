const INTERVAL_MS = 15 * 60 * 1000

export function createLocationReporter({
  checkPermission,
  requestPermission,
  getLocation,
  updateLocation: uploadLocation,
  setIntervalFn,
  clearIntervalFn,
  nowSeconds,
  onError = () => {},
}) {
  let timerId = null
  let reportingPromise = null

  async function doReport() {
    let permission = await checkPermission()
    if (permission === 'not determined' && requestPermission) {
      const requested = await requestPermission()
      if (requested === 'granted') {
        permission = 'authorized'
      }
    }
    if (permission !== 'authorized') return false
    const location = await getLocation()
    await uploadLocation({
      latitude: location.latitude,
      longitude: location.longitude,
      timestamp: nowSeconds(),
    })
    return true
  }

  function reportNow() {
    if (reportingPromise) return reportingPromise
    reportingPromise = doReport()
      .catch((error) => {
        onError(error)
        return false
      })
      .finally(() => {
        reportingPromise = null
      })
    return reportingPromise
  }

  async function start() {
    stop()
    const reported = await reportNow()
    timerId = setIntervalFn(() => {
      void reportNow()
    }, INTERVAL_MS)
    return reported
  }

  function stop() {
    if (timerId !== null) {
      clearIntervalFn(timerId)
      timerId = null
    }
  }

  return { reportNow, start, stop }
}
