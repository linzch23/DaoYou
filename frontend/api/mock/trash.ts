// frontend/api/mock/trash.ts
// 覆盖 docs/API接口文档.md §6.10–§6.12 回收站域
//   GET    /api/trash/trips                       → trashListMock
//   POST   /api/trash/trips/{trip_id}/restore     → trashRestoreMock
//   DELETE /api/trash/trips/{trip_id}             → trashPermanentDeleteMock
//
// v0.2.0 修订(specs/TrashPage.md §6.4.1 Resolved):后端补 3 trash 域端点,
// 不再走 GET 全量 + JS filter 兜底路径;恢复走 POST /restore(原 PUT /api/trips/{id} 改 status 路径废弃);
// 永久删除走 DELETE(原 MVP 0 API 路径废弃)。
//
// 数据源:seedTripSummaries 中 deleted_at !== null 的行(seedTrip4 + seedTrip5,per _seed.ts)。

import type { ApiResponse, TripSummary } from '../types'
import { seedTripSummaries } from './_seed'

// GET /api/trash/trips —— 已删行程列表
// 服务端约定:只返回 deleted_at IS NOT NULL 的行(per docs/API接口文档.md §6.10)
// mock 端在客户端 filter deleted_at !== null 后再 sort by deleted_at desc(seed 内已按 id desc 近似)
export const trashListMock: ApiResponse<{ trips: TripSummary[] }> = {
  code: 0,
  message: 'success',
  data: {
    trips: seedTripSummaries
      .filter((t) => t.deleted_at !== null)
      .sort((a, b) => {
        // deleted_at desc(seed 都有非 null,fallback id desc)
        if (a.deleted_at && b.deleted_at) {
          return b.deleted_at.localeCompare(a.deleted_at)
        }
        return (b.id || 0) - (a.id || 0)
      }),
  },
}

// POST /api/trash/trips/{trip_id}/restore —— 从回收站恢复
// 服务端置 deleted_at = null(per docs/API接口文档.md §6.11)
export const trashRestoreMock: ApiResponse<{ restored: true }> = {
  code: 0,
  message: 'success',
  data: { restored: true },
}

// DELETE /api/trash/trips/{trip_id} —— 手动永久删除
// 物理删除记录(per docs/API接口文档.md §6.12)
export const trashPermanentDeleteMock: ApiResponse<{ permanently_deleted: true }> = {
  code: 0,
  message: 'success',
  data: { permanently_deleted: true },
}
