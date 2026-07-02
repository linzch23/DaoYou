const WRITABLE_TRIP_ITEM_FIELDS = Object.freeze([
  'trip_day_id',
  'city',
  'title',
  'item_type',
  'start_time',
  'end_time',
  'address',
  'status',
  'notes',
])


export function getInheritedCity(items) {
  for (let index = items.length - 1; index >= 0; index -= 1) {
    const city = typeof items[index]?.city === 'string'
      ? items[index].city.trim()
      : ''
    if (city) return city
  }
  return ''
}


export function normalizeNewTripItem(form) {
  return {
    city: form.city.trim(),
    title: form.title.trim(),
    date: form.date,
    start_time: form.start_time,
    end_time: form.end_time,
    item_type: form.item_type,
  }
}


export function buildTripItemPayload(input) {
  return Object.fromEntries(
    WRITABLE_TRIP_ITEM_FIELDS
      .filter((field) => input[field] !== undefined)
      .map((field) => [field, input[field]]),
  )
}


export function getTripItemErrorMessage(error, fallback) {
  return error?.code === 4003 && typeof error.message === 'string'
    ? error.message
    : fallback
}
