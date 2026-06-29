import assert from 'node:assert/strict'
import test from 'node:test'

import { hasPendingDestination } from '../src/services/backgroundLocationCore.js'

test('pending destination requires planned status and coordinates', () => {
  assert.equal(hasPendingDestination({
    data: {
      today_items: [
        { status: 'done', latitude: 39, longitude: 121 },
        { status: 'planned', latitude: 39, longitude: 121 },
      ],
    },
  }), true)
})

test('empty or coordinate-less itinerary does not start background location', () => {
  assert.equal(hasPendingDestination(null), false)
  assert.equal(hasPendingDestination({
    data: { today_items: [{ status: 'planned', latitude: null, longitude: 121 }] },
  }), false)
})
