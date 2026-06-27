// frontend/services/reminders.js
// 封装 docs/API接口文档.md §10.1(智能提醒检查接口)
//
//   POST /api/reminders/check → checkReminders(req)
//
// 后端实装:backend/app/api/reminders.py:11(POST /check)
//
// MVP 约定(per AGENTS.md §4 service 层惯例 + 13 页面惯例):
//   - `user_id` 固定为 1(MVP_USER_ID),由 service 内部注入,page / store 不感知
//   - Base URL 默认 http://localhost:8000(沿 services/config.js BASE_URL)
//   - HTTP 失败 → 直接 reject(USE_MOCK_FALLBACK=false 默认配置,沿 services/config.js v0.3.0 决策)
//   - 不引入 ApiError class 复制 —— 复用 `services/preferences.js:55` 跨域 ApiError
//
// 入参形状(spec §10.1 + api/types.ts:282 ReminderCheckRequest):
//   checkReminders({ current_time: string, currentLocation?: Location })
//   ↑ current_time 必填(ISO 8601,由调用方传,homeStore 用 new Date().toISOString())
//   ↑ currentLocation 可选(per docs/API-前端一致性审计-v2.md §7.3.1 2026-06-22 改可选)
//
// 出参形状(per backend/app/schemas/reminders.py):
//   checkReminders → Promise<ApiResponse<{ has_risk: boolean, reminder: Reminder | null }>>
//
// 失败映射(spec §6.1 Error 表 + 复用 preferences.js:21-32 决策):
//   - 400 / 4000 → 参数非法 → store best-effort 静默降级
//   - 5xx / 5000 → 服务端错误 → store best-effort 静默降级
//   - fail 回调  → 网络断开(isNetworkError=true)→ store best-effort 静默降级
//
// 2026-06-24 retro fix 起源:本文件从未存在过(无 git history),但 homeStore.js:39 一直在 import
// 导致 vite 启动时 ESM static analysis 失败 → 整个 app 白屏。补本文件,沿 preferences.js 模式
// 1:1 复制,1 个 file + 1 个 function(per AGENTS.md §4 service 层惯例 1 file 1 domain)。
//
// v0.5.0(2026-06-25)改造(per Cross-Page issue location-real-fix-v2-2026-06-25 §2.3):
//   - **修 `current_location` 字段类型 bug**:
//     原:`{ current_location: JSON.stringify(req.currentLocation) }` ← 传 string
//     新:`{ current_location: req.currentLocation }`               ← 传 dict
//     后端 `backend/app/schemas/reminders.py:ReminderCheckRequest.current_location`
//     期望 Pydantic `Location` BaseModel(`backend/app/schemas/common.py:4-6`),
//     FastAPI 接 JSON body 时 Location 字段是个 dict,前端 `JSON.stringify(...)`
//     让它变成 string → Pydantic ValidationError 422 请求参数错误
//   - 注:本服务本来就没有 mock fallback(per services/config.js:36 USE_MOCK_FALLBACK
//     默认 false + AGENTS.md §4 沿用 preferences.js 模式,失败直接 reject)
//     所以本轮**不**需要删 fallback,只需修字段类型

import { ApiError } from './preferences.js'
import { logger } from '../utils/logger.js'
import { BASE_URL, MVP_USER_ID } from './config.js'

/**
 * @typedef {import('../api/types').Location} Location
 * @typedef {import('../api/types').Reminder} Reminder
 *
 * @typedef {Object} CheckRemindersRequest
 * @property {string} currentTime           必填,ISO 8601 时间(由调用方 new Date().toISOString() 派生)
 * @property {Location} [currentLocation]  可选,客户端经纬度(MVP 阶段由 page 层不传,per §10.1)
 *
 * @typedef {Object} CheckRemindersData
 * @property {boolean} has_risk
 * @property {Reminder | null} reminder
 *
 * @typedef {import('../api/types').ApiResponse<CheckRemindersData>} CheckRemindersResponse
 */

/**
 * POST /api/reminders/check —— 智能提醒检查(spec §10.1)
 *
 * 实现(per AGENTS.md §4 + preferences.js 模式):
 *   - 1) HTTP `POST /api/reminders/check` 优先(`uni.request`)
 *   - 2) HTTP 失败 → 直接 reject(USE_MOCK_FALLBACK 默认 false,沿 services/config.js:36 v0.3.0 决策)
 *   - 3) 4xx 业务错 / 5xx 服务错 → 抛 ApiError(store 端 best-effort 静默降级,per homeStore.triggerRemindersCheck §6.5.7.2)
 *
 * 入参(spec §10.1 + api/types.ts:282 ReminderCheckRequest):
 *   - currentTime 必填(ISO 8601)
 *   - currentLocation 可选(向后兼容,page 层 MVP 不传)
 *   - user_id 由 service 内部注入(MVP_USER_ID)
 *
 * @param {CheckRemindersRequest} req
 * @returns {Promise<CheckRemindersResponse>}
 * @throws  {ApiError}
 */
export function checkReminders(req) {
  // 入参校验(避免 uni.request 起飞后才报错,节省网络往返)
  if (!req || typeof req !== 'object') {
    return Promise.reject(new ApiError({
      code: 4000,
      message: '请求参数不能为空',
      statusCode: 400,
    }))
  }
  if (typeof req.currentTime !== 'string' || !req.currentTime.trim()) {
    return Promise.reject(new ApiError({
      code: 4000,
      message: 'current_time 不能为空',
      statusCode: 400,
    }))
  }
  return new Promise((resolve, reject) => {
    uni.request({
      url: `${BASE_URL}/api/reminders/check`,
      method: 'POST',
      header: { 'content-type': 'application/json' },
      data: {
        user_id: MVP_USER_ID,
        current_time: req.currentTime,
        // 可选 current_location(per docs/API-前端一致性审计-v2.md §7.3.1 2026-06-22 改可选):
        //   - 传了 → 直接传 dict 对象(per v0.5.0 修复,后端 Pydantic Location 期望 dict,
        //     原 JSON.stringify(...) 误传 string 触发 422)
        //     后端契约:`backend/app/schemas/reminders.py:ReminderCheckRequest.current_location:
        //     Location | None`,其中 `Location = Latitude + Longitude(BaseModel)`
        //   - 没传(MVP / 用户拒授权 / 定位失败)→ 字段不出现(向后兼容)
        ...(req.currentLocation
          ? { current_location: req.currentLocation }
          : {}),
      },
      success: (res) => mapSuccess(res, resolve, reject),
      fail: (err) => mapFail(err, reject),
    })
  })
}

// ──────────────────────── mapSuccess / mapFail helper(per AGENTS.md §4 跨 service 复用)────────────────────────
//
// 注:`services/preferences.js:78-111` 内部的 `mapSuccess` / `mapFail` 是**未导出**的私有函数,
// 跨 service 复用需要 export 或 inline 复制。本服务**不**改 preferences.js 既有字段(per §8.6 retro fix
// 0 触动既有),改用 inline 复制(行为 1:1 等价,uni.request 回调 `res.data: any` + fail `err.errMsg` 语义相同)。
//
// 已知妥协(deliverable §3 显式登记):preferences.js 内部 helper 提取到独立 `services/http-helpers.js`
// 是更干净路径,但本任务为单 service 复用,inline 复制 1 处可控;后续若多个 service 共享,
// 由 IssueManager 提议提取公共 helper(per ssp-arch §6 forward-looking comment 反模式)。
//
// ───────────────── mapSuccess ─────────────────
/**
 * 将 uni.request 回调统一映射为 (resolve, reject) 形态
 * @param {UniApp.RequestSuccessCallbackResult} res
 * @param {(value: any) => void} resolve
 * @param {(reason: ApiError) => void} reject
 */
function mapSuccess(res, resolve, reject) {
  const body = res.data
  if (res.statusCode >= 200 && res.statusCode < 300) {
    if (body && body.code === 0) {
      resolve(body)
    } else {
      reject(new ApiError({
        code: body?.code ?? null,
        message: body?.message || '业务处理失败',
        statusCode: res.statusCode,
      }))
    }
  } else {
    reject(new ApiError({
      code: body?.code ?? null,
      message: body?.message || `HTTP ${res.statusCode}`,
      statusCode: res.statusCode,
    }))
  }
}

// ───────────────── mapFail ─────────────────
/**
 * 将 uni.request fail 回调映射为 ApiError
 * @param {UniApp.GeneralCallbackResult | undefined} err
 * @param {(reason: ApiError) => void} reject
 */
function mapFail(err, reject) {
  reject(new ApiError({
    code: null,
    message: err?.errMsg || '网络异常,请检查网络连接',
    statusCode: 0,
    isNetworkError: true,
  }))
}
