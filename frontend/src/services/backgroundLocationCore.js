export function hasPendingDestination(response) {
  const items = response?.data?.today_items
  return Array.isArray(items) && items.some((item) => (
    item?.status === 'planned'
    && Number.isFinite(item?.latitude)
    && Number.isFinite(item?.longitude)
  ))
}
