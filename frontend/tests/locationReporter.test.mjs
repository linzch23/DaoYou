import assert from 'node:assert/strict'
import test from 'node:test'

import { createLocationReporter } from '../src/services/locationReporterCore.js'


test('start reports immediately and replaces existing timer', async () => {
  const reports = []
  const cleared = []
  let nextTimerId = 1
  const reporter = createLocationReporter({
    checkPermission: async () => 'authorized',
    getLocation: async () => ({ latitude: 31.2, longitude: 121.4 }),
    updateLocation: async (payload) => reports.push(payload),
    setIntervalFn: () => nextTimerId++,
    clearIntervalFn: (timerId) => cleared.push(timerId),
    nowSeconds: () => 1000,
  })

  await reporter.start()
  await reporter.start()

  assert.equal(reports.length, 2)
  assert.deepEqual(reports[0], {
    latitude: 31.2,
    longitude: 121.4,
    timestamp: 1000,
  })
  assert.deepEqual(cleared, [1])
})


test('concurrent reports share one in-flight request', async () => {
  let locationCalls = 0
  let releaseLocation
  const reporter = createLocationReporter({
    checkPermission: async () => 'authorized',
    getLocation: () => {
      locationCalls += 1
      return new Promise((resolve) => {
        releaseLocation = resolve
      })
    },
    updateLocation: async () => {},
    setIntervalFn: () => 1,
    clearIntervalFn: () => {},
    nowSeconds: () => 1000,
  })

  const first = reporter.reportNow()
  const second = reporter.reportNow()
  await Promise.resolve()
  releaseLocation({ latitude: 31.2, longitude: 121.4 })
  await Promise.all([first, second])

  assert.equal(locationCalls, 1)
})


test('permission denial skips location and upload', async () => {
  let locationCalls = 0
  let uploadCalls = 0
  const reporter = createLocationReporter({
    checkPermission: async () => 'denied',
    getLocation: async () => {
      locationCalls += 1
    },
    updateLocation: async () => {
      uploadCalls += 1
    },
    setIntervalFn: () => 1,
    clearIntervalFn: () => {},
    nowSeconds: () => 1000,
  })

  await reporter.reportNow()

  assert.equal(locationCalls, 0)
  assert.equal(uploadCalls, 0)
})


test('first start requests undetermined location permission and uploads immediately', async () => {
  let permissionStatus = 'not determined'
  let permissionRequests = 0
  const reports = []
  const reporter = createLocationReporter({
    checkPermission: async () => permissionStatus,
    requestPermission: async () => {
      permissionRequests += 1
      permissionStatus = 'authorized'
      return 'granted'
    },
    getLocation: async () => ({ latitude: 23.1, longitude: 113.3 }),
    updateLocation: async (payload) => reports.push(payload),
    setIntervalFn: () => 1,
    clearIntervalFn: () => {},
    nowSeconds: () => 2000,
  })

  const result = await reporter.start()

  assert.equal(permissionRequests, 1)
  assert.equal(result, true)
  assert.equal(reports.length, 1)
  assert.deepEqual(reports[0], {
    latitude: 23.1,
    longitude: 113.3,
    timestamp: 2000,
  })
})
