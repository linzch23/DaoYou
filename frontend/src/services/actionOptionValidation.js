export function validateActionOption(option) {
  if (option?.operation === 'batch') {
    const hasActionId = typeof option.action_id === 'string' && option.action_id.length > 0
    const operationIds = getBatchOperationIds(option)
    const hasOperations = Array.isArray(option.operations)
      && option.operations.length > 1
      && option.operations.length <= 20
      && operationIds.length === option.operations.length
      && new Set(operationIds).size === operationIds.length
    return hasActionId && hasOperations ? null : 'invalid_batch'
  }
  if (!option?.payload || typeof option.payload !== 'object') {
    return 'invalid_payload'
  }
  if (option.operation === 'update_trip_item') {
    return Number.isInteger(option.item_id) && option.item_id > 0
      ? null
      : 'invalid_item_id'
  }
  if (option.operation === 'create_trip_item') {
    if (typeof option.payload.city !== 'string' || !option.payload.city.trim()) {
      return 'invalid_city'
    }
    if (typeof option.payload.title !== 'string' || !option.payload.title.trim()) {
      return 'invalid_title'
    }
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

export function getBatchOperationIds(option) {
  if (option?.operation !== 'batch' || !Array.isArray(option.operations)) return []
  return option.operations
    .map((operation) => operation?.operation_id)
    .filter((operationId) => typeof operationId === 'string' && operationId.length > 0)
}

export function validateActionOptionsResponse(options) {
  if (!Array.isArray(options) || options.length !== 1) return 'incompatible_action_options'
  return validateActionOption(options[0])
}
