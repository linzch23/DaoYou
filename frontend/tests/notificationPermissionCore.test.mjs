import assert from 'node:assert/strict'
import test from 'node:test'

import {
  shouldRequestNotificationPermission,
} from '../src/services/notificationPermissionCore.js'

test('requests notification permission once on Android 13 or newer', () => {
  assert.equal(shouldRequestNotificationPermission({
    platform: 'android',
    sdkInt: 33,
    requested: false,
    granted: false,
  }), true)
})

test('does not automatically repeat or request on unsupported platforms', () => {
  assert.equal(shouldRequestNotificationPermission({
    platform: 'android',
    sdkInt: 33,
    requested: true,
    granted: false,
  }), false)
  assert.equal(shouldRequestNotificationPermission({
    platform: 'android',
    sdkInt: 32,
    requested: false,
    granted: false,
  }), false)
  assert.equal(shouldRequestNotificationPermission({
    platform: 'ios',
    sdkInt: 17,
    requested: false,
    granted: false,
  }), false)
})
