const INTERVAL_MS = 15 * 60 * 1000

export function createLocationReporter({
  checkPermission,
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
    const permission = await checkPermission()
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
    await reportNow()
    timerId = setIntervalFn(() => {
      void reportNow()
    }, INTERVAL_MS)
  }

  function stop() {
    if (timerId !== null) {
      clearIntervalFn(timerId)
      timerId = null
    }
  }

  return { reportNow, start, stop }
}
