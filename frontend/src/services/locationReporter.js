import { updateLocation } from './locations.js'
import {
  checkLocationPermission,
  getCurrentLocation,
} from '../utils/location.js'
import { logger } from '../utils/logger.js'
import { createLocationReporter } from './locationReporterCore.js'

const reporter = createLocationReporter({
  checkPermission: checkLocationPermission,
  getLocation: getCurrentLocation,
  updateLocation,
  setIntervalFn: setInterval,
  clearIntervalFn: clearInterval,
  nowSeconds: () => Math.floor(Date.now() / 1000),
  onError: (error) => {
    logger.warn('[locationReporter] report failed', {
      code: error?.code,
      message: error?.message,
    })
  },
})

export function startLocationReporter() {
  return reporter.start()
}

export function stopLocationReporter() {
  reporter.stop()
}
