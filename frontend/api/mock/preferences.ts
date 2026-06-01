// frontend/api/mock/preferences.ts
// 覆盖 docs/API接口文档.md §20–§21
//   GET /api/preferences → preferencesMock
//   PUT /api/preferences → updatePreferencesMock

import type { ApiResponse, Preferences } from '../types'
import { seedPreferences } from './_seed'

export const preferencesMock: ApiResponse<{ preferences: Preferences }> = {
  code: 0,
  message: 'success',
  data: { preferences: seedPreferences },
}

export const updatePreferencesMock: ApiResponse<{ updated: true }> = {
  code: 0,
  message: 'success',
  data: { updated: true },
}
