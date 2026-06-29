export function validateActionOption(option) {
  if (!option?.payload || typeof option.payload !== 'object') {
    return 'invalid_payload'
  }
  if (option.operation === 'update_trip_item') {
    return Number.isInteger(option.item_id) && option.item_id > 0
      ? null
      : 'invalid_item_id'
  }
  if (option.operation === 'create_trip_item') {
    const hasExistingDay = Number.isInteger(option.trip_day_id)
      && option.trip_day_id > 0
    const hasCreatableDay = Number.isInteger(option.target_day_index)
      && option.target_day_index > 0
      && typeof option.target_date === 'string'
      && option.target_date.length > 0
    return hasExistingDay || hasCreatableDay ? null : 'invalid_trip_day'
  }
  return 'invalid_operation'
}
