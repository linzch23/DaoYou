// frontend/api/mock/memory.ts
// POST /api/memory/summary —— docs/API接口文档.md §22

import type { ApiResponse, MemoryRecord } from '../types'
import { seedMemories } from './_seed'

export const memorySummaryMock: ApiResponse<{
  updated: boolean
  memories: MemoryRecord[]
}> = {
  code: 0,
  message: 'success',
  data: { updated: true, memories: seedMemories },
}
