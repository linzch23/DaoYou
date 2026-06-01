// frontend/api/mock/trip-items.ts
// 覆盖 docs/API接口文档.md §12–§14
//   POST   /api/trip-items              → createTripItemMock
//   PUT    /api/trip-items/{item_id}    → updateTripItemMock
//   DELETE /api/trip-items/{item_id}    → deleteTripItemMock

import type { ApiResponse } from '../types'

export const createTripItemMock: ApiResponse<{ item_id: number }> = {
  code: 0,
  message: 'success',
  data: { item_id: 300 },
}

export const updateTripItemMock: ApiResponse<{ updated: true }> = {
  code: 0,
  message: 'success',
  data: { updated: true },
}

export const deleteTripItemMock: ApiResponse<{ deleted: true }> = {
  code: 0,
  message: 'success',
  data: { deleted: true },
}
