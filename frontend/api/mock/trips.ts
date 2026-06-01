// frontend/api/mock/trips.ts
// 覆盖 docs/API接口文档.md §6.1–§6.5、§10.1、§10.2
//   GET    /api/trips                  → tripsMock        (TripSummary[])
//   POST   /api/trips                  → createTripMock
//   GET    /api/trips/{trip_id}        → tripDetailMock   (Trip, 含 days)
//   PUT    /api/trips/{trip_id}        → updateTripMock
//   DELETE /api/trips/{trip_id}        → deleteTripMock
//   POST   /api/trips/{trip_id}/replan     → 见 mock/replan.ts
//   POST   /api/trips/{trip_id}/apply-plan → 见 mock/replan.ts

import type { ApiResponse, Trip, TripSummary } from '../types'
import { seedTrip, seedTripSummaries } from './_seed'

// GET /api/trips —— 列表（演示 3 条：active / draft / finished）
// §6.2 列表响应使用轻量 TripSummary（无 user_id、无 days）
export const tripsMock: ApiResponse<{ trips: TripSummary[] }> = {
  code: 0,
  message: 'success',
  data: {
    trips: seedTripSummaries,
  },
}

// POST /api/trips —— 返回新建行程的 id（演示固定返回 100）
export const createTripMock: ApiResponse<{ trip_id: number }> = {
  code: 0,
  message: 'success',
  data: { trip_id: 100 },
}

// GET /api/trips/{trip_id} —— 详情（含 user_id + days + items）
export const tripDetailMock: ApiResponse<Trip> = {
  code: 0,
  message: 'success',
  data: seedTrip,
}

// PUT /api/trips/{trip_id}
export const updateTripMock: ApiResponse<{ updated: true }> = {
  code: 0,
  message: 'success',
  data: { updated: true },
}

// DELETE /api/trips/{trip_id}
export const deleteTripMock: ApiResponse<{ deleted: true }> = {
  code: 0,
  message: 'success',
  data: { deleted: true },
}
