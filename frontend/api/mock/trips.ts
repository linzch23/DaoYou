// frontend/api/mock/trips.ts
// 覆盖 docs/API接口文档.md §6.1–§6.5、§10.1、§10.2
//   GET    /api/trips                  → tripsMock        (TripSummary[])
//   POST   /api/trips                  → createTripMock
//   GET    /api/trips/{trip_id}        → tripDetailMock   (Trip, 含 days)
//   PUT    /api/trips/{trip_id}        → updateTripMock
//   DELETE /api/trips/{trip_id}        → deleteTripMock
// (注:`/api/trips/{trip_id}/replan` + `/apply-plan` 已合并到 §8.1 /api/chat 改线意图路径,
//   mock/replan.ts 已删除 — per 2026-06-24 审计清理)

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
