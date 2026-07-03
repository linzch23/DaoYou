import test from 'node:test'
import assert from 'node:assert/strict'
import { validateActionOption } from '../src/services/actionOptionValidation.js'

test('valid server batch action passes validation', () => {
  assert.equal(validateActionOption({
    action_id: 'batch-action-id',
    operation: 'batch',
    operations: [
      { operation: 'create_trip_item', label: '新增星海广场' },
      { operation: 'create_trip_item', label: '新增贝壳博物馆' },
    ],
  }), null)
})

test('batch action requires one server id and at least two operations', () => {
  assert.equal(validateActionOption({
    operation: 'batch',
    operations: [{ operation: 'create_trip_item' }],
  }), 'invalid_batch')
})
