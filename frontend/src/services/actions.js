import { ApiError } from './preferences.js'
import { BASE_URL, MVP_USER_ID } from './config.js'

export function confirmAgentAction(actionId) {
  return decideAction(actionId, 'confirm')
}

export function rejectAgentAction(actionId) {
  return decideAction(actionId, 'reject')
}

function decideAction(actionId, decision) {
  if (typeof actionId !== 'string' || !actionId.trim()) {
    return Promise.reject(new ApiError({
      code: 4000,
      message: '行程操作标识无效',
      statusCode: 400,
    }))
  }
  return new Promise((resolve, reject) => {
    uni.request({
      url: `${BASE_URL}/api/actions/${encodeURIComponent(actionId)}/${decision}`,
      method: 'POST',
      header: { 'content-type': 'application/json' },
      data: { user_id: MVP_USER_ID },
      success: (res) => {
        const body = res.data
        if (res.statusCode >= 200 && res.statusCode < 300 && body?.code === 0) {
          resolve(body)
          return
        }
        reject(new ApiError({
          code: body?.code ?? null,
          message: body?.message || `HTTP ${res.statusCode}`,
          statusCode: res.statusCode,
        }))
      },
      fail: (err) => reject(new ApiError({
        code: null,
        message: err?.errMsg || '网络异常,请检查网络连接',
        statusCode: 0,
        isNetworkError: true,
      })),
    })
  })
}
