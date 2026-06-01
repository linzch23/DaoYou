// frontend/api/mock/trip-days.ts
// POST /api/trips/{trip_id}/days —— docs/API接口文档.md §11

import type { ApiResponse } from '../types'

export const createTripDayMock: ApiResponse<{ trip_day_id: number }> = {
  code: 0,
  message: 'success',
  data: { trip_day_id: 200 },
}
