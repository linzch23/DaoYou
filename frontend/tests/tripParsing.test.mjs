import test from 'node:test'
import assert from 'node:assert/strict'
import {
  buildTripDraftPayload,
  mapParsedTripToForm,
  mergeParsedTripIntoForm,
} from '../src/utils/tripParsing.js'

test('partial parse keeps missing fields empty and preserves fuzzy time', () => {
  const form = mapParsedTripToForm({
    title: null,
    start_date: '2026-08-12',
    end_date: null,
    items: [{ title: '西湖', city: '杭州', trip_date: null, time_period: 'morning' }],
  }, 100)
  assert.equal(form.title, '')
  assert.equal(form.end_date, '')
  assert.equal(form.itineraryArrange[0].date, '')
  assert.equal(form.itineraryArrange[0].start_time, '')
  assert.equal(form.itineraryArrange[0].time_period, 'morning')
})

test('confirmed form groups items into atomic creation days', () => {
  const payload = buildTripDraftPayload({
    start_date: '2026-08-12',
    end_date: '2026-08-13',
    itineraryArrange: [
      { title: '灵隐寺', city: '杭州', date: '2026-08-13', item_type: 'attraction' },
      { title: '西湖', city: '杭州', date: '2026-08-12', item_type: 'attraction' },
    ],
  }, '杭州旅行', 'trip-key-123', '杭州')
  assert.deepEqual(payload.days.map((day) => day.trip_date), ['2026-08-12', '2026-08-13'])
  assert.equal(payload.days[0].day_index, 1)
  assert.equal(payload.days[0].items[0].title, '西湖')
})

test('AI extraction fills blanks without overwriting manual fields', () => {
  const merged = mergeParsedTripIntoForm({
    title: '我手动写的标题',
    start_date: '',
    end_date: '',
    itineraryArrange: [],
  }, {
    title: 'AI 标题',
    start_date: '2026-08-12',
    end_date: null,
    items: [],
  }, 100)
  assert.equal(merged.title, '我手动写的标题')
  assert.equal(merged.start_date, '2026-08-12')
  assert.equal(merged.end_date, '')
})
