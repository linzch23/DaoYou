// frontend/api/mock/health.ts
// GET /health —— docs/API接口文档.md §5

import type { ApiResponse } from '../types'

export const healthMock: ApiResponse<{ status: 'ok' }> = {
  code: 0,
  message: 'success',
  data: { status: 'ok' },
}
