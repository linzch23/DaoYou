/**
 * mockInterceptor.js — 开发环境 uni.request / uni.uploadFile 拦截器
 *
 * 触发原因:无后端环境下,MVP 演示需要让 service 层走通。
 * 拦截 uni.request / uni.uploadFile,根据 URL + method 匹配,
 * 返回 api/mock/ 目录下的 mock 数据(走 success 回调 → mapSuccess → resolve)。
 *
 * 启用条件:
 *   - import.meta.env.DEV === true(只在 dev 启用,生产 build 0 影响)
 *   - window.__USE_REAL_API__ !== true(可手动 escape hatch 关掉拦截)
 *
 * 不做的事:
 *   - 不改 services/*.js(BASE_URL / URL 路径不变)
 *   - 不改 api/mock/*(READ-ONLY)
 *   - 不模拟 fail 路径(MVP 演示只走成功路径;调试错误态手动 __USE_REAL_API__ = false + 配 fail 模式)
 *
 * 静态数据来源:api/mock/index.ts 已 export 全部 13 个 mock response
 *
 * 拦截器覆盖的 endpoint(per services/*.js 用法):
 *   PUT  /api/preferences         → updatePreferencesMock
 *   GET  /api/preferences         → preferencesMock
 *   GET  /api/home/today          → todayHomeMock
 *   GET  /api/trips               → tripsMock
 *   GET  /api/reminders           → remindersMock
 *   POST /api/trips               → createTripMock
 *   GET  /api/trips/{id}          → tripDetailMock
 *   PUT  /api/trips/{id}          → updateTripMock
 *   DELETE /api/trips/{id}        → deleteTripMock
 *   POST /api/photos/explain      → photoExplainMock
 *   POST /api/chat                → chatMock
 *   POST /api/trips/{id}/replan   → replanMock
 *   POST /api/trips/{id}/apply-plan → applyPlanMock
 *   POST /api/trips/{id}/days     → createTripDayMock
 *   POST /api/trip-items          → createTripItemMock
 *   PUT  /api/trip-items/{id}     → updateTripItemMock
 *   DELETE /api/trip-items/{id}   → deleteTripItemMock
 *   GET  /health                  → healthMock
 *   POST /api/memory/summary      → memorySummaryMock
 */
import {
  preferencesMock,
  updatePreferencesMock,
  todayHomeMock,
  tripsMock,
  remindersMock,
  reminderCheckMock,
  chatMock,
  chatHistoryMock,
  createTripMock,
  tripDetailMock,
  updateTripMock,
  deleteTripMock,
  trashListMock,
  trashRestoreMock,
  trashPermanentDeleteMock,
  photoExplainMock,
  replanMock,
  applyPlanMock,
  createTripDayMock,
  createTripItemMock,
  updateTripItemMock,
  deleteTripItemMock,
  healthMock,
  memorySummaryMock,
} from '../../api/mock/index.ts'

/**
 * 模拟 200-500ms 随机网络延迟(让 loading 视图态可见,演示完整状态机)
 */
function mockDelay() {
  const ms = 200 + Math.floor(Math.random() * 300)
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/**
 * URL pattern → mock response 查找表
 * 用 {param} 占位符匹配动态 URL
 */
const ROUTE_TABLE = [
  // Preferences
  { method: 'GET', pattern: /\/api\/preferences\/?$/, response: () => preferencesMock },
  { method: 'PUT', pattern: /\/api\/preferences\/?$/, response: () => updatePreferencesMock },

  // Home
  { method: 'GET', pattern: /\/api\/home\/today\/?$/, response: () => todayHomeMock },
  { method: 'GET', pattern: /\/api\/trips\/?$/, response: () => tripsMock },
  { method: 'GET', pattern: /\/api\/reminders\/?$/, response: () => remindersMock },

  // Trips CRUD
  { method: 'POST', pattern: /\/api\/trips\/?$/, response: () => createTripMock },
  { method: 'GET', pattern: /\/api\/trips\/\d+\/?$/, response: () => tripDetailMock },
  { method: 'PUT', pattern: /\/api\/trips\/\d+\/?$/, response: () => updateTripMock },
  { method: 'DELETE', pattern: /\/api\/trips\/\d+\/?$/, response: () => deleteTripMock },
  { method: 'POST', pattern: /\/api\/trips\/\d+\/replan\/?$/, response: () => replanMock },
  { method: 'POST', pattern: /\/api\/trips\/\d+\/apply-plan\/?$/, response: () => applyPlanMock },
  { method: 'POST', pattern: /\/api\/trips\/\d+\/days\/?$/, response: () => createTripDayMock },

  // Trash (per docs/API接口文档.md §6.10-§6.12,TrashPage v0.2.0 新增)
  { method: 'GET', pattern: /\/api\/trash\/trips\/?$/, response: () => trashListMock },
  { method: 'POST', pattern: /\/api\/trash\/trips\/\d+\/restore\/?$/, response: () => trashRestoreMock },
  { method: 'DELETE', pattern: /\/api\/trash\/trips\/\d+\/?$/, response: () => trashPermanentDeleteMock },

  // Trip Items CRUD
  { method: 'POST', pattern: /\/api\/trip-items\/?$/, response: () => createTripItemMock },
  { method: 'PUT', pattern: /\/api\/trip-items\/\d+\/?$/, response: () => updateTripItemMock },
  { method: 'DELETE', pattern: /\/api\/trip-items\/\d+\/?$/, response: () => deleteTripItemMock },

  // Photos
  { method: 'POST', pattern: /\/api\/photos\/explain\/?$/, response: () => photoExplainMock },

  // Chat
  { method: 'POST', pattern: /\/api\/chat\/?$/, response: () => chatMock },
  { method: 'GET', pattern: /\/api\/chat\/history\/?$/, response: () => chatHistoryMock },

  // Reminders
  { method: 'POST', pattern: /\/api\/reminders\/check\/?$/, response: () => reminderCheckMock },

  // Memory
  { method: 'POST', pattern: /\/api\/memory\/summary\/?$/, response: () => memorySummaryMock },

  // Health
  { method: 'GET', pattern: /\/health\/?$/, response: () => healthMock },
]

/**
 * 在 URL 里提取 path(去除 BASE_URL 前缀)
 */
function extractPath(url) {
  if (typeof url !== 'string') return ''
  // 去掉协议 + 域名 + 端口,保留 /api/...
  const match = url.match(/^https?:\/\/[^/]+(\/.*)$/)
  return match ? match[1] : url
}

/**
 * 查表:URL + method → mock response
 * @returns {object|null} mock response 或 null(未匹配,放过走真实请求)
 */
function lookupMock(method, url) {
  const path = extractPath(url)
  for (const route of ROUTE_TABLE) {
    if (route.method === method && route.pattern.test(path)) {
      return route.response()
    }
  }
  return null
}

/**
 * 安装 mock 拦截器
 * patch uni.request + uni.uploadFile,匹配则走 mock,否则放过
 *
 * @param {object} uniScope UniApp 全局对象(H5 下是 window.uni / uni 命名空间)
 * @returns {() => void} uninstall 函数
 */
export function installMockInterceptor(uniScope) {
  if (!uniScope || !uniScope.request) {
    if (typeof console !== 'undefined' && console.warn) {
      console.warn('[mockInterceptor] uni.request not found, skip install')
    }
    return () => {}
  }

  const originalRequest = uniScope.request.bind(uniScope)
  const originalUploadFile = uniScope.uploadFile?.bind(uniScope)

  /**
   * Mock uni.request
   */
  uniScope.request = function mockRequest(options) {
    const { url, method = 'GET', success, fail, complete } = options

    const mock = lookupMock(method, url)
    if (mock) {
      // 命中 mock → 异步模拟 success(走 mapSuccess 路径,service 拿到正常 ApiResponse)
      mockDelay().then(() => {
        const res = {
          statusCode: 200,
          data: mock,
          header: { 'content-type': 'application/json' },
          cookies: [],
        }
        try {
          success?.(res)
        } finally {
          complete?.(res)
        }
      })
      return
    }

    // 未命中 → 走原始 request(放过)
    return originalRequest(options)
  }

  /**
   * Mock uni.uploadFile(MVP 阶段 PhotoGuidePage 唯一用法)
   * uni.uploadFile 回调 res.data 是 string(JSON 串),需要 JSON.parse
   */
  if (originalUploadFile) {
    uniScope.uploadFile = function mockUploadFile(options) {
      const { url, success, fail, complete } = options

      const mock = lookupMock('POST', url)
      if (mock) {
        mockDelay().then(() => {
          const res = {
            statusCode: 200,
            // 注意:uni.uploadFile 的 data 字段是 string
            data: JSON.stringify(mock),
            header: { 'content-type': 'application/json' },
          }
          try {
            success?.(res)
          } finally {
            complete?.(res)
          }
        })
        return
      }

      return originalUploadFile(options)
    }
  }

  if (typeof console !== 'undefined' && console.info) {
    console.info(
      '%c[mockInterceptor] installed',
      'color: #2D6A5E; font-weight: bold;',
      '— dev only, 19 endpoint covered. set window.__USE_REAL_API__ = true to bypass.'
    )
  }

  // 返回 uninstall(给将来真后端切换留 escape hatch)
  return function uninstall() {
    uniScope.request = originalRequest
    if (originalUploadFile) {
      uniScope.uploadFile = originalUploadFile
    }
  }
}
