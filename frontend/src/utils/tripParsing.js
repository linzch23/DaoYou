export function mapParsedTripToForm(parsed, idSeed = Date.now()) {
  return {
    title: parsed?.title || '',
    start_date: parsed?.start_date || '',
    end_date: parsed?.end_date || '',
    itineraryArrange: Array.isArray(parsed?.items)
      ? parsed.items.filter((item) => item?.title).map((item, index) => ({
          id: idSeed + index,
          title: item.title,
          city: item.city || '',
          date: item.trip_date || '',
          start_time: item.start_time || '',
          end_time: item.end_time || '',
          item_type: item.item_type || 'other',
          time_period: item.time_period || null,
          notes: item.notes || '',
        }))
      : [],
  }
}

export function mergeParsedTripIntoForm(current, parsed, idSeed = Date.now()) {
  const extracted = mapParsedTripToForm(parsed, idSeed)
  const existingKeys = new Set(current.itineraryArrange.map((item) => (
    `${item.title}|${item.date || ''}|${item.start_time || ''}`
  )))
  const newItems = extracted.itineraryArrange.filter((item) => !existingKeys.has(
    `${item.title}|${item.date || ''}|${item.start_time || ''}`
  ))
  return {
    title: current.title || extracted.title,
    start_date: current.start_date || extracted.start_date,
    end_date: current.end_date || extracted.end_date,
    itineraryArrange: [...current.itineraryArrange, ...newItems],
  }
}

export function buildTripDraftPayload(formData, title, idempotencyKey, cityFallback) {
  const grouped = new Map()
  for (const item of formData.itineraryArrange) {
    const items = grouped.get(item.date) || []
    items.push(item)
    grouped.set(item.date, items)
  }
  return {
    title,
    start_date: formData.start_date,
    end_date: formData.end_date,
    status: 'active',
    idempotency_key: idempotencyKey,
    days: Array.from(grouped.keys()).sort().map((tripDate, index) => ({
      day_index: index + 1,
      trip_date: tripDate,
      summary: null,
      items: grouped.get(tripDate).map((item) => ({
        title: item.title,
        city: item.city || cityFallback,
        item_type: item.item_type || 'other',
        start_time: item.start_time || null,
        end_time: item.end_time || null,
        notes: item.notes || null,
      })),
    })),
  }
}
