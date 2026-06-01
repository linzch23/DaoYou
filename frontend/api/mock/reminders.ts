// frontend/api/mock/reminders.ts
// 覆盖 docs/API接口文档.md §17–§18
//   POST /api/reminders/check → reminderCheckMock
//   GET  /api/reminders       → remindersMock

import type { ApiResponse, Reminder } from '../types'
import { seedReminders } from './_seed'

export const remindersMock: ApiResponse<{ reminders: Reminder[] }> = {
  code: 0,
  message: 'success',
  data: { reminders: seedReminders },
}

// 演示一次「无风险」返回，让首页可正常渲染未触发提醒的场景
export const reminderCheckMock: ApiResponse<{
  has_risk: boolean
  reminder: Reminder | null
}> = {
  code: 0,
  message: 'success',
  data: { has_risk: false, reminder: null },
}
