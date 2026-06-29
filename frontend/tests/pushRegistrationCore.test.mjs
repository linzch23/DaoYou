import assert from 'node:assert/strict'
import test from 'node:test'

import { shouldRegisterPush } from '../src/services/pushRegistrationCore.js'

test('push registration is due initially and after 24 hours', () => {
  const now = 100_000_000
  assert.equal(shouldRegisterPush(Number.NaN, now), true)
  assert.equal(shouldRegisterPush(now - 86_400_000, now), true)
})

test('push registration is skipped inside 24 hours', () => {
  const now = 100_000_000
  assert.equal(shouldRegisterPush(now - 86_399_999, now), false)
})
