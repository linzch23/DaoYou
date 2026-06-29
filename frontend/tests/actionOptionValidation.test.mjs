import assert from 'node:assert/strict'
import test from 'node:test'

import { validateActionOption } from '../src/services/actionOptionValidation.js'

test('create_trip_item is valid without item_id when target day exists', () => {
  assert.equal(validateActionOption({
    operation: 'create_trip_item',
    trip_id: 1,
    trip_day_id: 2,
    payload: { city: '大连', title: '咖啡馆' },
  }), null)
})

test('update_trip_item requires item_id', () => {
  assert.equal(validateActionOption({
    operation: 'update_trip_item',
    trip_id: 1,
    payload: { status: 'skipped' },
  }), 'invalid_item_id')
})

test('create_trip_item requires an existing or creatable target day', () => {
  assert.equal(validateActionOption({
    operation: 'create_trip_item',
    trip_id: 1,
    payload: { city: '大连', title: '咖啡馆' },
  }), 'invalid_trip_day')
})
