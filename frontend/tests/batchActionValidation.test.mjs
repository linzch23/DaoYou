import test from 'node:test'
import assert from 'node:assert/strict'
import {
  getBatchOperationIds,
  validateActionOption,
  validateActionOptionsResponse,
} from '../src/services/actionOptionValidation.js'

test('valid server batch action passes validation', () => {
  assert.equal(validateActionOption({
    action_id: 'batch-action-id',
    operation: 'batch',
    operations: [
      { operation_id: 'operation_001', operation: 'create_trip_item', label: '新增星海广场' },
      { operation_id: 'operation_002', operation: 'create_trip_item', label: '新增贝壳博物馆' },
    ],
  }), null)
})

test('batch operation ids are stable selection values', () => {
  assert.deepEqual(getBatchOperationIds({
    operation: 'batch',
    operations: [
      { operation_id: 'operation_001' },
      { operation_id: 'operation_003' },
    ],
  }), ['operation_001', 'operation_003'])
})

test('multiple top-level options are rejected as an incompatible legacy response', () => {
  assert.equal(validateActionOptionsResponse([
    { operation: 'create_trip_item', action_id: 'one' },
    { operation: 'create_trip_item', action_id: 'two' },
  ]), 'incompatible_action_options')
})

test('batch action requires one server id and at least two operations', () => {
  assert.equal(validateActionOption({
    operation: 'batch',
    operations: [{ operation: 'create_trip_item' }],
  }), 'invalid_batch')
})
