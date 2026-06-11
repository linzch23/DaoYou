// frontend/services/trips.js
// 封装 docs/API接口文档.md §6.1 创建行程 + §6.2 行程列表 + §6.3 行程详情 + §6.4 修改行程 + §6.5 软删除 + §6.10-§6.12 回收站域 + 本地草稿持久化
//
//   POST   /api/trips                      → createTrip(req)
//   GET    /api/trips?user_id=1            → listTrips() [HomePage / EditTripPage]
//   GET    /api/trash/trips?user_id=1      → listDeletedTrips()                              [TrashPage v0.2.0,后端已支持 deleted_at IS NOT NULL 过滤]
//   GET    /api/trips/{trip_id}            → getTripDetail(tripId)
//   PUT    /api/trips/{trip_id}            → updateTrip(tripId, req)        [EditTripPage 落地]
//   DELETE /api/trips/{trip_id}            → deleteTrip(tripId) [TripDetailPage 软删除,后端置 deleted_at]
//   POST   /api/trash/trips/{trip_id}/restore → restoreTrashById(tripId)    [TrashPage v0.2.0 落地,后端置 deleted_at = null]
//   DELETE /api/trash/trips/{trip_id}      → permanentlyDeleteTrip(tripId)  [TrashPage v0.2.0 落地,真删]
//   草稿 uni.setStorageSync                → saveDraft(draft) / loadDrafts()            [NewTripPage 列表]
//   编辑草稿 uni.setStorageSync            → saveEditDraft(draft) / loadEditDraft(tripId) / clearEditDraft(tripId)  [EditTripPage 落地]
//
// MVP 约定(见 docs/API接口文档.md §1.3):
//   - `user_id` 固定为 1,前端不感知
//   - Base URL 默认为 http://localhost:8000
//
// 失败映射(spec §6.1 Error 表 + §6.1/§6.2):
//   - 400 / 4000 → 参数非法
//   - 404 / 4001 → 资源不存在(GET 详情 → 视为 notfound;PUT → 视为并发删除,走 error;DELETE → 视为并发删除,Toast 提示)
//   - 5xx / 5000 → 服务端错误
//   - fail 回调  → 网络断开(isNetworkError=true)
//
// 草稿持久化(spec §4.3 + §6.4.3):
//   - NewTripPage 草稿 key = 'trip_drafts',value = TripDraft[] 列表
//   - EditTripPage 草稿 key = 'edit_trip_drafts',value = Record<tripId, EditTripDraft> keyed by tripId
//     (因编辑一次只涉及一条 trip,keyed by tripId 避免列表扫描;同 id 二次进入页面可覆盖)
//   - 任何读 / 写异常 → 静默降级(load* 返回 []/null,save* 返回 false)
//   - **不**为草稿新建 draftStore(MVP YAGNI,沿用 HomePage 收藏模式)
//
// 4 选填字段(companions / budget_range / transport_preference / special_needs)
//   按 spec §6.4.2 决策树:UI 保留展示,POST/PUT **不**传后端(本服务不感知)
//
// UpdateTripRequest 2 字段约束(spec EditTripPage §6.2 / §6.4.1,触发 PD-001):
//   - 仅 `{ user_id, title?, status? }` 可入参
//   - city / start_date / end_date / 4 选填字段 **不**在 UpdateTripRequest 中
//   - 调用方(EditTripPage)负责按 PUT partial-update 语义仅发 changed 字段

import { ApiError } from './preferences.js'
import { logger } from '../utils/logger.js'

const BASE_URL = 'http://localhost:8000'
const MVP_USER_ID = 1
const DRAFTS_STORAGE_KEY = 'trip_drafts'
const EDIT_DRAFTS_STORAGE_KEY = 'edit_trip_drafts'

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

/**
 * POST /api/trips —— 创建行程
 *
 * 入参只接受后端支持的 5 字段(`title` + `city` + `start_date` + `end_date` +
 * UI-025 `itineraryArrange`,`user_id` 由本服务内部注入),4 选填 client-only 字段
 * (spec §6.4.2)**不**进入 Request 体,本函数**不**感知。
 *
 * UI-025:`itineraryArrange: ItineraryItem[]` 是**可选**字段(spec §6.4.x 暂未明确
 * 后端是否落表,前端**默认发送**便于后端补字段时无侵入升级);空数组也合法。
 *
 * @param {object} req
 * @param {string} req.title  派生自 city + 日期(spec §6.4.4)
 * @param {string} req.city
 * @param {string} req.start_date  'YYYY-MM-DD'
 * @param {string} req.end_date    'YYYY-MM-DD'
 * @param {import('../api/types').ItineraryItem[]} [req.itineraryArrange]  UI-025 新增,可选
 * @returns {Promise<import('../api/types').ApiResponse<{ trip_id: number }>>}
 * @throws  {ApiError}
 */
export function createTrip(req) {
  return new Promise((resolve, reject) => {
    uni.request({
      url: `${BASE_URL}/api/trips`,
      method: 'POST',
      header: { 'content-type': 'application/json' },
      data: {
        user_id: MVP_USER_ID,
        title: req.title,
        city: req.city,
        start_date: req.start_date,
        end_date: req.end_date,
        // UI-025 行程安排字段:空数组 fallback,后端 mock 拦截器自动 echo
        ...(Array.isArray(req.itineraryArrange) ? { itineraryArrange: req.itineraryArrange } : {}),
      },
      success: (res) => mapSuccess(res, resolve, reject),
      fail: (err) => mapFail(err, reject),
    })
  })
}

/**
 * GET /api/trips/{trip_id} —— 行程详情(含 days[].items[] 全量)
 *
 * 错误归一(ApiError class 复用,见 services/preferences.js:33-44):
 *   - 4000 / 400     → 参数非法(GET 理论上不会,除非 url 拼错)
 *   - 4001 / 404     → 资源不存在(由调用方判 viewMode='notfound')
 *   - 5000 / 5xx     → 服务端错误
 *   - isNetworkError → 网络断开
 *
 * @param {number} tripId
 * @returns {Promise<import('../api/types').ApiResponse<import('../api/types').Trip>>}
 * @throws  {ApiError}
 */
export function getTripDetail(tripId) {
  return new Promise((resolve, reject) => {
    uni.request({
      url: `${BASE_URL}/api/trips/${tripId}`,
      method: 'GET',
      data: { user_id: MVP_USER_ID },
      success: (res) => mapSuccess(res, resolve, reject),
      fail: (err) => mapFail(err, reject),
    })
  })
}

/**
 * DELETE /api/trips/{trip_id} —— 软删除(由后端实现,前端不感知硬/软删)
 *
 * 错误归一(ApiError 复用):
 *   - 4000 / 400     → 参数非法
 *   - 4001 / 404     → 资源不存在(并发删除场景,Toast「删除失败」即可)
 *   - 5000 / 5xx     → 服务端错误
 *   - isNetworkError → 网络断开
 *
 * 注意(spec §6.2):本函数**不**调用方约定 deleteTrip 失败时 viewMode 切换
 * —— TripDetailPage 的删除失败走 Toast(详情仍可看),**不**切到 error 态。
 *
 * @param {number} tripId
 * @returns {Promise<import('../api/types').ApiResponse<{ deleted: true }>>}
 * @throws  {ApiError}
 */
export function deleteTrip(tripId) {
  return new Promise((resolve, reject) => {
    uni.request({
      url: `${BASE_URL}/api/trips/${tripId}`,
      method: 'DELETE',
      data: { user_id: MVP_USER_ID },
      success: (res) => mapSuccess(res, resolve, reject),
      fail: (err) => mapFail(err, reject),
    })
  })
}

/**
 * PUT /api/trips/{trip_id} —— 修改行程(specs/EditTripPage.md §6.2 / §7.2 触发,本规格新增)
 *
 * 关键约束(per `api/types.ts:174-178` `UpdateTripRequest`):
 *   - 入参**仅**含 `{ user_id, title?, status?, itineraryArrange? }` 3 字段可选
 *   - city / start_date / end_date / 4 选填字段 **不**在 UpdateTripRequest 中
 *   - 调用方(EditTripPage)负责按 PUT partial-update 语义仅发 changed 字段
 *   - city / start_date / end_date 由 EditTripPage 端在 onSave 时阻断(per spec §6.4.1 PD-001)
 *   - UI-025:`itineraryArrange?` 是 EditTripPage 调用方按需携带的字段(仅当与原值不同时),
 *     本服务**不**强制要求
 *
 * 错误归一(ApiError 复用):
 *   - 4000 / 400     → 参数非法
 *   - 4001 / 404     → 资源不存在(并发删除场景 → 视为 notfound,调用方 currentStep='notfound')
 *   - 5000 / 5xx     → 服务端错误
 *   - isNetworkError → 网络断开
 *
 * @param {number} tripId
 * @param {object} req UpdateTripRequest 形状(`api/types.ts:174-178` + UI-025):
 *   { title?: string, status?: 'draft' | 'active' | 'finished',
 *     itineraryArrange?: ItineraryItem[] }
 *   - title?: 仅当 formData.title !== originalData.title 时携带
 *   - status?: 仅当 formData.status !== originalData.status 时携带
 *   - itineraryArrange?: 仅当 formData.itineraryArrange !== originalData.itineraryArrange 时携带
 *   - **不**含 city / start_date / end_date / 4 选填字段
 *   - 内部 `data: { user_id: MVP_USER_ID, ...req }` 注入 user_id
 *   - TripStatus 3 枚举(per v0.2.0 spec-writer 修订,TrashPage / TripDetailPage spec v0.2.0)
 *   - 'deleted' 语义**不**由 status 表达,由 `deleted_at: string | null` 字段承担
 *   - 恢复软删除的 trip 用 `restoreTrashById`(POST /api/trash/trips/{id}/restore),**不**走 updateTrip
 * @returns {Promise<import('../api/types').ApiResponse<{ updated: true }>>}
 * @throws  {ApiError}
 */
export function updateTrip(tripId, req) {
  return new Promise((resolve, reject) => {
    uni.request({
      url: `${BASE_URL}/api/trips/${tripId}`,
      method: 'PUT',
      header: { 'content-type': 'application/json' },
      data: {
        user_id: MVP_USER_ID,
        ...req,
      },
      success: (res) => mapSuccess(res, resolve, reject),
      fail: (err) => mapFail(err, reject),
    })
  })
}

/**
 * GET /api/trash/trips?user_id=1 —— 拉取已删行程列表(specs/TrashPage.md §6.10 / §6.4.1 触发新增)
 *
 * v0.2.0 关键决策(per TrashPage spec §6.4.1 Resolved,后端补 3 trash 域端点):
 *   - 后端 `GET /api/trash/trips` 端点已支持,服务端**只**返回 `deleted_at IS NOT NULL` 的行
 *   - 本函数 URL 改 `/api/trash/trips`(原 `/api/trips` 全量 + JS filter 路径废弃)
 *   - service 层**不**做客户端 filter(后端已过滤);**不**做客户端 sort(后端按 `deleted_at desc` 返回)
 *   - data 形如 `{ trips: TripSummary[] }`(每项含 `deleted_at: string | null` 字段,后端非 null)
 *
 * 错误归一(走既有 mapSuccess):
 *   - 4000 / 400     → 参数非法(GET 理论上不会,除非 url 拼错)
 *   - 5000 / 5xx     → 服务端错误
 *   - isNetworkError → 网络断开
 *
 * @returns {Promise<import('../api/types').ApiResponse<{ trips: import('../api/types').TripSummary[] }>>}
 * @throws  {ApiError}
 */
export function listDeletedTrips() {
  return new Promise((resolve, reject) => {
    uni.request({
      url: `${BASE_URL}/api/trash/trips`,
      method: 'GET',
      data: { user_id: MVP_USER_ID },
      success: (res) => {
        const body = res.data
        if (res.statusCode >= 200 && res.statusCode < 300 && body && body.code === 0) {
          const deletedTrips = Array.isArray(body.data?.trips) ? body.data.trips : []
          logger.info('[trips.listDeletedTrips] ok', { deleted: deletedTrips.length })
          resolve({ ...body, data: { trips: deletedTrips } })
        } else {
          // 走既有 mapSuccess 错误归一
          mapSuccess(res, resolve, reject)
        }
      },
      fail: (err) => mapFail(err, reject),
    })
  })
}

/**
 * POST /api/trash/trips/{trip_id}/restore —— 恢复已删行程(per docs/API接口文档.md §6.11,TrashPage v0.2.0 落地)
 *
 * v0.2.0 关键决策(per TrashPage spec §6.4.1 Resolved):
 *   - **不**走 v0.1.0 `PUT /api/trips/{id} { status: 'active' }` 路径(原路径依赖 TripStatus 4 枚举含 'deleted',
 *     v0.2.0 TripStatus 缩为 3 枚举后该路径已废弃)
 *   - 后端置 `deleted_at = null`(per API doc §6.11)
 *   - body 仅 `{ user_id }`(无其他字段;user_id 由本服务内部注入)
 *
 * 错误归一(ApiError 复用):
 *   - 4000 / 400     → 参数非法
 *   - 4001 / 404     → 资源不存在(并发删除场景 → 视为 notfound,store 端静默)
 *   - 5000 / 5xx     → 服务端错误
 *   - isNetworkError → 网络断开
 *
 * @param {number} tripId
 * @returns {Promise<import('../api/types').ApiResponse<{ restored: true }>>}
 * @throws  {ApiError}
 */
export function restoreTrashById(tripId) {
  return new Promise((resolve, reject) => {
    uni.request({
      url: `${BASE_URL}/api/trash/trips/${tripId}/restore`,
      method: 'POST',
      header: { 'content-type': 'application/json' },
      data: { user_id: MVP_USER_ID },
      success: (res) => mapSuccess(res, resolve, reject),
      fail: (err) => mapFail(err, reject),
    })
  })
}

/**
 * DELETE /api/trash/trips/{trip_id} —— 永久删除(per docs/API接口文档.md §6.12,TrashPage v0.2.0 落地)
 *
 * v0.2.0 关键决策(per TrashPage spec §6.4.2 Resolved):
 *   - **不**走 v0.1.0 MVP 0 API 路径(等后端 30 天定时任务)
 *   - 后端**真删**记录(per API doc §6.12)
 *   - data 形如 `{ user_id }`(query param 注入,符合后端 REST 风格)
 *
 * 错误归一(ApiError 复用):
 *   - 4000 / 400     → 参数非法
 *   - 4001 / 404     → 资源不存在(并发删除场景 → 静默,store 端 drop row)
 *   - 5000 / 5xx     → 服务端错误
 *   - isNetworkError → 网络断开
 *
 * @param {number} tripId
 * @returns {Promise<import('../api/types').ApiResponse<{ permanently_deleted: true }>>}
 * @throws  {ApiError}
 */
export function permanentlyDeleteTrip(tripId) {
  return new Promise((resolve, reject) => {
    uni.request({
      url: `${BASE_URL}/api/trash/trips/${tripId}?user_id=${MVP_USER_ID}`,
      method: 'DELETE',
      success: (res) => mapSuccess(res, resolve, reject),
      fail: (err) => mapFail(err, reject),
    })
  })
}

// ───────────────── 草稿(本地持久化,见 spec §4.3 + §6.4.3)─────────────────

/**
 * 读取草稿列表
 *
 * 静默降级:storage 不可用 / JSON 解析失败 / 读异常 → 返回空数组
 * (不抛错,避免阻塞 NewTripPage 渲染)
 *
 * @returns {Array<object>}
 */
export function loadDrafts() {
  try {
    const raw = uni.getStorageSync(DRAFTS_STORAGE_KEY)
    if (!raw) return []
    if (typeof raw === 'string') {
      const parsed = JSON.parse(raw)
      return Array.isArray(parsed) ? parsed : []
    }
    if (Array.isArray(raw)) return raw
    return []
  } catch (err) {
    logger.warn('[trips.drafts] load failed, fallback to empty', err)
    return []
  }
}

/**
 * 写入单条草稿 —— 读现有列表 → push → 写回
 *
 * 静默降级:storage 写异常(quota 满 / 不可用)→ 仅 logger.warn,返回 false
 * 调用方(NewTripPage)据此 Toast「草稿保存失败,内容已保留在页面」
 * 并保留在原态继续编辑(spec §5.3.K)。
 *
 * @param {object} draft TripDraft 形状(spec §4.3):
 *   { id: number, created_at: string, inputText: string,
 *     attachedFiles: Array<{name, size, path}>, formData: object }
 * @returns {boolean} true = 写成功
 */
export function saveDraft(draft) {
  try {
    const existing = loadDrafts()
    existing.push(draft)
    uni.setStorageSync(DRAFTS_STORAGE_KEY, existing)
    return true
  } catch (err) {
    logger.warn('[trips.drafts] save failed', err)
    return false
  }
}

// ───────────────── 编辑行程草稿(EditTripPage,spec §4.3 + §6.4.3 + §7.2 触发新增)─────────────────
//
// 与 NewTripPage 草稿(`trip_drafts: TripDraft[]` 列表)不同,本段用独立 key
// `edit_trip_drafts: Record<tripId, EditTripDraft>` keyed by tripId:
//   - 编辑一次只涉及一条 trip,keyed by tripId 避免列表扫描
//   - 同 tripId 二次保存覆盖(避免列表无限增长)
//   - TrashPage 后续接管时同时兼容两种结构
//
// EditTripDraft 形状(spec §4.3):
//   { tripId: number, savedAt: string (ISO 8601), formData: EditTripFormData }

function loadAllEditDrafts() {
  const raw = uni.getStorageSync(EDIT_DRAFTS_STORAGE_KEY)
  if (!raw) return {}
  let parsed = raw
  if (typeof raw === 'string') {
    try {
      parsed = JSON.parse(raw)
    } catch (err) {
      logger.warn('[trips.editDrafts] JSON parse failed, fallback to empty', err)
      return {}
    }
  }
  return (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) ? parsed : {}
}

function saveAllEditDrafts(map) {
  uni.setStorageSync(EDIT_DRAFTS_STORAGE_KEY, map)
}

/**
 * 读取指定 tripId 的编辑草稿(spec §4.3 + §5.1 + §5.3.H 触发新增)
 *
 * 静默降级:storage 不可用 / JSON 解析失败 / 读异常 → 返回 null
 * (不抛错,避免阻塞 EditTripPage 进入 editing 态)
 *
 * @param {number} tripId
 * @returns {object | null} EditTripDraft 形状:
 *   { tripId: number, savedAt: string, formData: EditTripFormData } | null
 */
export function loadEditDraft(tripId) {
  try {
    const all = loadAllEditDrafts()
    const key = String(tripId)
    const draft = all[key]
    if (!draft || typeof draft !== 'object') return null
    return draft
  } catch (err) {
    logger.warn('[trips.editDrafts] load failed, fallback to null', err)
    return null
  }
}

/**
 * 写入/覆盖指定 tripId 的编辑草稿 —— 读现有 map → 覆盖单 key → 写回
 *
 * 静默降级:storage 写异常(quota 满 / 不可用)→ 仅 logger.warn,返回 false
 * 调用方(EditTripPage)据此 Toast「草稿保存失败,内容已保留在页面」
 * 并保留在原态继续编辑(spec §5.3.K)。
 *
 * @param {object} draft EditTripDraft 形状(spec §4.3):
 *   { tripId: number, savedAt: string, formData: EditTripFormData }
 * @returns {boolean} true = 写成功
 */
export function saveEditDraft(draft) {
  try {
    if (!draft || typeof draft !== 'object' || !draft.tripId) {
      logger.warn('[trips.editDrafts] saveEditDraft invalid draft', { draft })
      return false
    }
    const all = loadAllEditDrafts()
    const key = String(draft.tripId)
    all[key] = draft
    saveAllEditDrafts(all)
    return true
  } catch (err) {
    logger.warn('[trips.editDrafts] save failed', err)
    return false
  }
}

/**
 * 清除指定 tripId 的编辑草稿 —— 读现有 map → delete 该 key → 写回
 *
 * **不**调用 `uni.removeStorageSync(EDIT_DRAFTS_STORAGE_KEY)` 整 key
 * (避免误删其他 trip 草稿,spec §7.2 实现细节)
 *
 * @param {number} tripId
 * @returns {boolean} true = 写成功(删除不存在 key 视为成功)
 */
export function clearEditDraft(tripId) {
  try {
    const all = loadAllEditDrafts()
    const key = String(tripId)
    if (key in all) {
      delete all[key]
      saveAllEditDrafts(all)
    }
    return true
  } catch (err) {
    logger.warn('[trips.editDrafts] clear failed', err)
    return false
  }
}
