// frontend/api/mock/home.ts
// GET /api/home/today —— 响应字段严格匹配 docs/API接口文档.md §6

import type { ApiResponse, TripItem } from '../types'
import { seedTodayItems } from './_seed'

interface HomeTodayData {
  trip_id: number
  trip_title: string
  // v0.6.0(per user-round4-2026-06-26 19:46 bug):前端 HomeDiary 派生 day_index 用
  // (原本只返回 date,前端无法按 today - start_date 算)
  trip_start_date: string // 'YYYY-MM-DD'
  date: string
  today_items: TripItem[]
}

export const todayHomeMock: ApiResponse<HomeTodayData> = {
  code: 0,
  message: 'success',
  data: {
    trip_id: 1,
    trip_title: '大连三日游',
    // v0.6.0(per user-round4):mock 与 data 同步,day_index 派生用
    trip_start_date: '2026-07-01',
    date: '2026-07-01',
    today_items: seedTodayItems,
  },
}
