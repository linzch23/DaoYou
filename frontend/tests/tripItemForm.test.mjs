import assert from 'node:assert/strict'
import test from 'node:test'

import {
  buildTripItemPayload,
  getTripItemErrorMessage,
  getInheritedCity,
  normalizeNewTripItem,
} from '../src/services/tripItemForm.js'


test('getInheritedCity uses the last non-empty item city', () => {
  assert.equal(getInheritedCity([
    { city: '大连', title: '星海广场' },
    { city: '', title: '途中休息' },
    { city: ' 北京 ', title: '故宫博物院' },
  ]), '北京')
})


test('normalizeNewTripItem trims and preserves city and title', () => {
  assert.deepEqual(
    normalizeNewTripItem({
      city: ' 北京 ',
      title: ' 故宫博物院 ',
      date: '2026-07-02',
      start_time: '09:00',
      end_time: '11:00',
      item_type: 'attraction',
    }),
    {
      city: '北京',
      title: '故宫博物院',
      date: '2026-07-02',
      start_time: '09:00',
      end_time: '11:00',
      item_type: 'attraction',
    },
  )
})


test('buildTripItemPayload never includes client coordinates', () => {
  assert.deepEqual(
    buildTripItemPayload({
      trip_day_id: 3,
      city: '北京',
      title: '故宫博物院',
      item_type: 'attraction',
      latitude: 39.9,
      longitude: 116.4,
    }),
    {
      trip_day_id: 3,
      city: '北京',
      title: '故宫博物院',
      item_type: 'attraction',
    },
  )
})


test('getTripItemErrorMessage preserves actionable geocoding errors', () => {
  assert.equal(
    getTripItemErrorMessage(
      {
        code: 4003,
        message: '未找到该地点，请补充更准确的城市、地点或地址',
      },
      '新增失败',
    ),
    '未找到该地点，请补充更准确的城市、地点或地址',
  )
  assert.equal(getTripItemErrorMessage(new Error('network'), '新增失败'), '新增失败')
})
