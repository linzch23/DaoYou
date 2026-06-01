// frontend/api/mock/home.ts
// GET /api/home/today —— 响应字段严格匹配 docs/API接口文档.md §6

import type { ApiResponse, TripItem } from '../types'
import { seedTodayItems, seedReminders } from './_seed'

interface HomeTodayData {
  trip_id: number
  trip_title: string
  city: string
  date: string
  today_items: TripItem[]
  unread_reminders: number
}

export const todayHomeMock: ApiResponse<HomeTodayData> = {
  code: 0,
  message: 'success',
  data: {
    trip_id: 1,
    trip_title: '大连三日游',
    city: '大连',
    date: '2026-07-01',
    today_items: seedTodayItems,
    // 与 remindersMock.data.reminders 中 status==='unread' 的数量保持一致
    unread_reminders: seedReminders.filter((r) => r.status === 'unread').length,
  },
}
