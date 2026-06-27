// frontend/services/chat.js
// 封装智能对话接口(specs/ChatPage.md §6 API Contract)
//
//   POST /api/chat         → sendChatMessage(req)
//   GET  /api/chat/history → getChatHistory(req)
//
// 后端实装:backend/app/api/chat.py:11(POST)+:16(GET history)
//
// MVP 约定(per AGENTS.md §4 service 层惯例 + 13 页面惯例):
//   - `user_id` 固定为 1(MVP_USER_ID),由 service 内部注入,page / store 不感知
//   - Base URL 默认 http://localhost:8000(沿 services/config.js BASE_URL)
//   - HTTP 失败(isNetworkError / 5xx)→ 直接抛 ApiError,**不** mock fallback
//     (per Cross-Page issue location-real-fix-v2-2026-06-25 §2.2 +
//      user 2026-06-25 16:12 硬要求「坚决不能 mock 兜底」)
//
// 入参形状(spec §6.1 ChatRequest):
//   sendChatMessage({ message: string, tripId: number, currentLocation?: Location })
//   ↑ 只送本次修改的字段;user_id 由 service 内部注入
//   trip_id 必填(per 2026-06-24 审计修复:types.ts:242-247 ChatRequest 含 trip_id 必填 +
//   current_location 可选,与 backend/app/schemas/chat.py:7-11 ChatRequest 对齐);
//   trip_id 由 store 从 homeStore.currentTripId 派生注入,page 层不直接持有
//   **不**含 session_id(spec §6.4 PD-001 #1:types.ts 根本不存在此字段)
//
// 出参形状(spec §6.1 ChatReplyData / §6.2 chatHistoryMock):
//   sendChatMessage → Promise<{ code: 0, message, data: ChatReplyData }>
//     ChatReplyData: { reply, intent, action_options, follow_up_questions }
//   getChatHistory → Promise<{ code: 0, message, data: { messages: ChatMessage[] } }>
//
// 失败映射(spec §3.7 Error 表):
//   - 400 / 4000 → 参数不合法(errorBadRequest)
//   - 404 / 4001 → trip 不存在(errorTripNotFound)
//   - 5000       → LLM 失败(errorLLM)
//   - 5xx(无 code)→ 服务端错误(errorServer,复用 OnboardingStrings)
//   - fail 回调  → 网络断开(isNetworkError=true, errorNetwork,复用 OnboardingStrings)
//
// 复用(per AGENTS.md §4 + spec §3.12 复用性约束):
//   - ApiError class(services/preferences.js 跨 service 复用,**不**复制代码)
//   - mapSuccess / mapFail helper(同源,跨 service 复用)
//
// 错误映射**不**在本服务做(只暴露 ApiError),由 page 层 `mapHistoryError` /
// `mapSendError` 处理(spec §5.5 伪代码)。

// v0.5.0(2026-06-25)改造(per Cross-Page issue location-real-fix-v2-2026-06-25 §2.2):
//   - **删除** `chatMock` / `chatHistoryMock` import(api/mock/chat.ts)
//   - **删除** 2 处 `.catch(isFallbackable → mock)` 段:
//     * sendChatMessage L170-180:失败不再降级 chatMock
//     * getChatHistory L230-239:失败不再降级 chatHistoryMock
//   - **删除** `isFallbackable()` 辅助函数(本服务不再需要 fallback 判定)
//   - **删除** `USE_MOCK_FALLBACK` import(本服务**不**再使用)
//   - HTTP 失败一律抛 ApiError,由 page / store 层 best-effort 处理
//   - 注:api/mock/chat.ts 保留(mock 文件不动,只是 service 不再 import;per task §2.6)
//
// 历史:
//   - v0.3.0(2026-06-11):chat 真接入(integrate-r1)
//   - v0.3.x:加 mock fallback(per integrate-r1 task 决策)
//   - v0.5.0(2026-06-25):删 mock fallback(per Cross-Page issue location-real-fix-v2)

import { ApiError } from './preferences.js'
import { logger } from '../utils/logger.js'
import { BASE_URL, MVP_USER_ID } from './config.js'

/**
 * 业务错误 —— 携带 code / statusCode / isNetworkError
 * 复用 `services/preferences.js` 跨 service 共享的 ApiError class
 * (per AGENTS.md §4 + spec §3.12 复用性约束,**不**在本服务复制)
 * 直接 re-export,page / store 可以 `import { ApiError } from '@/services/chat.js'` 也可以从 preferences 走
 */
export { ApiError } from './preferences.js'

/**
 * @typedef {import('../api/types').ChatMessage} ChatMessage
 * @typedef {import('../utils/location.js').LocationResult} LocationResult
 *
 * @typedef {Object} SendChatRequest
 * @property {string} message                 必填,用户输入文本(trim 后 1-500 字符,page 层校验)
 * @property {number} tripId                  必填,当前旅行 ID(> 0);service 内部注入到 body.trip_id
 * @property {LocationResult} [currentLocation] 可选,客户端经纬度
 *   (per 2026-06-24 审计修复 Q3「前端必取 + 优雅降级」)
 *
 * @typedef {Object} ChatReplyData
 * @property {string} reply
 * @property {string} intent                   3 枚举:chat | replan | apply-plan
 * @property {any[]} action_options            MVP 占位 any[],per spec §6.4 PD-001 #3
 * @property {string[]} follow_up_questions    追问建议,长度 0-5
 *
 * @typedef {import('../api/types').ApiResponse<ChatReplyData>} SendChatResponse
 * @typedef {import('../api/types').ApiResponse<{ messages: ChatMessage[] }>} GetChatHistoryResponse
 *
 * @typedef {Object} GetChatHistoryRequest
 * @property {number} tripId                  必填,当前旅行 ID(> 0);service 内部注入到 query.trip_id
 * @property {number} [limit]                 可选,拉取条数上限(MVP 暂不接,query 不带)
 */

/**
 * POST /api/chat —— 发送对话消息(spec §6.1)
 *
 * v0.5.0 实现(per Cross-Page issue location-real-fix-v2-2026-06-25 §2.2):
 *   - 1) HTTP `POST /api/chat` 直发(`uni.request`)
 *   - 2) HTTP 失败(isNetworkError / 5xx / 4xx)→ 直接抛 ApiError
 *      (per user 2026-06-25 16:12 硬要求「坚决不能 mock 兜底」)
 *
 * 入参(spec §6.1 ChatRequest v0.3.x,per types.ts:242-247):
 *   - message:         必填,用户输入文本
 *   - tripId:          必填,store 从 homeStore.currentTripId 派生注入(> 0);
 *                      无 active trip → 抛 ApiError(4000, '请先创建或选择旅行')(per 2026-06-24 Q2 a 决策)
 *   - currentLocation: 可选,page 层 try `getCurrentLocation()` 拿到才上送;拒授权
 *                      / 定位失败静默降级,字段不出现(per 2026-06-24 审计修复 Q3「前端必取 + 优雅降级」)
 *
 * 内部处理:
 *   - `user_id = MVP_USER_ID` 由 service 注入,page / store 不感知
 *   - `trip_id = req.tripId` 由 page/store 透传,service **不**做默认值兜底
 *     (per 2026-06-24 修复:必须有 active trip 才能调 sendMessage,无 trip → 弹 ErrorBanner「去新建」)
 *   - **不**含 session_id(per spec §6.4 PD-001 #1,types.ts 根本不存在)
 *   - currentLocation 传了 → JSON 字符串化上送(沿 PhotoGuidePage §6.3.3 模式)
 *   - currentLocation 没传 → 字段不出现(向后兼容)
 *
 * @param {SendChatRequest} req
 * @returns {Promise<SendChatResponse>}
 * @throws  {ApiError}
 */
export function sendChatMessage(req) {
  // 入参校验(避免 uni.request 起飞后才报错,节省网络往返)
  if (!req || typeof req !== 'object') {
    return Promise.reject(new ApiError({
      code: 4000,
      message: '请求参数不能为空',
      statusCode: 400,
    }))
  }
  if (typeof req.message !== 'string' || !req.message.trim()) {
    return Promise.reject(new ApiError({
      code: 4000,
      message: '消息内容不能为空',
      statusCode: 400,
    }))
  }
  // 2026-06-24 修复:无 active trip 时拒发,提示用户去新建(Q2 a 决策)
  if (!Number.isFinite(req.tripId) || req.tripId <= 0) {
    return Promise.reject(new ApiError({
      code: 4000,
      message: '请先创建或选择旅行',
      statusCode: 400,
    }))
  }
  return new Promise((resolve, reject) => {
    uni.request({
      url: `${BASE_URL}/api/chat`,
      method: 'POST',
      header: { 'content-type': 'application/json' },
      data: {
        user_id: MVP_USER_ID,
        // 2026-06-24 真接入修复:body 必带 trip_id(per api/types.ts:244 + backend/app/schemas/chat.py:8
        // + alembic 0006 restore trip_id NOT NULL);由 store 从 homeStore.currentTripId 派生注入,
        // service **不**做默认值兜底(无 trip 时直接 reject ApiError 4000)
        trip_id: req.tripId,
        message: req.message.trim(),
        // 可选 current_location(per spec §6.1 备注 + 2026-06-25 UserRound2-002 Bug A 修复):
        //   - 传了 → dict 对象上送(后端 Location Pydantic 期望 dict,非 string)
        //     (per backend/app/schemas/chat.py:6-10 + common.py Location BaseModel)
        //   - 没传(MVP / 用户拒授权 / 定位失败)→ 字段不出现
        //   - **不**用 JSON.stringify(2026-06-25 修复前误用 → 后端 Pydantic 4000 请求参数错误)
        //   - 注:PhotoGuidePage 也有类似模式(per memory §8.3 + §6.3.3)但本 task 不动
        ...(req.currentLocation
          ? { current_location: req.currentLocation }
          : {}),
        // **不**含 session_id(spec §6.4 PD-001 #1)
      },
      success: (res) => mapSuccess(res, resolve, reject),
      fail: (err) => mapFail(err, reject),
    })
  })
  // 注:v0.5.0 起删除 .catch((httpErr) => { mock fallback }) 段
  // HTTP 失败由 uni.request 回调内 mapFail / mapSuccess 内部 reject ApiError,
  // Promise 链无后续处理,调用方 page / store 需 best-effort 处理。
}

/**
 * GET /api/chat/history —— 拉取历史对话(spec §6.2)
 *
 * v0.5.0(per Cross-Page issue location-real-fix-v2-2026-06-25 §2.2):
 *   - HTTP `GET /api/chat/history` 直发(`uni.request`)
 *   - **失败不 mock fallback** → 直接抛 ApiError
 *
 * 入参(spec §6.2 + 2026-06-24 审计修复):
 *   - req.tripId  必填,query 透传到后端 trip_id(per docs/API接口文档.md §8.2 + 后端
 *     backend/app/api/chat.py:16-23 history 路由 trip_id: int 必填);由 store 从
 *     homeStore.currentTripId 派生注入;无 trip → 抛 ApiError(4000, '请先创建或选择旅行')
 *   - req.limit    可选,MVP 暂不接,query 不带 limit
 *   - user_id 由 service 内部注入(MVP_USER_ID)
 *
 * 出参:Promise<GetChatHistoryResponse>
 *   data.messages 严格 1:1 对齐 api/types.ts:158-163 ChatMessage 4 字段
 *
 * @param {GetChatHistoryRequest} req  旅程 id;page / store 透传
 * @returns {Promise<GetChatHistoryResponse>}
 * @throws  {ApiError}
 */
export function getChatHistory(req) {
  // 2026-06-24 修复:无 active trip 时拒发(per Q2 a 决策)
  if (!req || typeof req !== 'object') {
    return Promise.reject(new ApiError({
      code: 4000,
      message: '请求参数不能为空',
      statusCode: 400,
    }))
  }
  if (!Number.isFinite(req.tripId) || req.tripId <= 0) {
    return Promise.reject(new ApiError({
      code: 4000,
      message: '请先创建或选择旅行',
      statusCode: 400,
    }))
  }
  return new Promise((resolve, reject) => {
    uni.request({
      url: `${BASE_URL}/api/chat/history`,
      method: 'GET',
      // 2026-06-24 真接入修复:query 必带 trip_id(per backend/app/api/chat.py:16-23
      // history 路由 trip_id: int 必填 + alembic 0006 restore trip_id NOT NULL)
      data: { user_id: MVP_USER_ID, trip_id: req.tripId },
      success: (res) => mapSuccess(res, resolve, reject),
      fail: (err) => mapFail(err, reject),
    })
  })
  // 注:v0.5.0 起删除 .catch((httpErr) => { mock fallback }) 段
}

// ──────────────────────── mapSuccess / mapFail helper(per AGENTS.md §4 跨 service 复用)────────────────────────
//
// 注:`services/preferences.js` 内部的 `mapSuccess` / `mapFail` helper 是**未导出**的私有函数
// (per services/preferences.js:78-111),跨 service 复用需要 export 或 inline 复制。
// 本服务**不**修改 preferences.js 既有字段(per task「0 触动既有」约束),改用 inline 复制
// helper(行为 1:1 等价,uni.request 回调 `res.data: any` + fail `err.errMsg` 语义相同)。
//
// 已知妥协(交付 deliverable §3 显式登记):`preferences.js` 内部 helper 提取到独立 `services/http-helpers.js`
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
