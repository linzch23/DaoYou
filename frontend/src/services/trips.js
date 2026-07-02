// frontend/services/trips.js
// 封装 docs/API接口文档.md §6.1 创建行程 + §6.2 行程列表 + §6.3 行程详情 + §6.4 修改行程 + §6.5 软删除 + §6.10-§6.12 回收站域 + 本地草稿持久化
//
//   POST   /api/trips                          → createTrip(req)
//   GET    /api/trips                          → listTrips() (wrapper → services/home.listTrips,保留为兼容入口)
//   GET    /api/trash/trips?user_id=1          → listDeletedTrips()
//   GET    /api/trips/{trip_id}                → getTripDetail(tripId)
//   PUT    /api/trips/{trip_id}                → updateTrip(tripId, req)        [EditTripPage 落地]
//   DELETE /api/trips/{trip_id}                → deleteTrip(tripId) [TripDetailPage 软删除,后端置 deleted_at]
//   POST   /api/trash/trips/{trip_id}/restore  → restoreTrashById(tripId)
//   DELETE /api/trash/trips/{trip_id}          → permanentlyDeleteTrip(tripId)
//   草稿 uni.setStorageSync                    → saveDraft(draft) / loadDrafts()            [NewTripPage 列表]
//   编辑草稿 uni.setStorageSync                → saveEditDraft(draft) / loadEditDraft(tripId) / clearEditDraft(tripId)  [EditTripPage 落地]
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
//
// v0.3.0(2026-06-11)改造(per integrate-r1 task):
//   - 4 个 HTTP 函数(`createTrip` / `getTripDetail` / `updateTrip` / `deleteTrip`)加 mock fallback
//     (createTripMock / tripDetailMock / updateTripMock / deleteTripMock)
//   - 3 个 trash 函数(`listDeletedTrips` / `restoreTrashById` / `permanentlyDeleteTrip`)
//     **后端无对应端点**(per integrate-r1 task 后端实测),改走本地 DB
//     (`db/listTrips` / `db/patchTrip` 等),保留函数签名,store 0 改动
//   - `listTrips` 保留为 wrapper,委托给 `services/home.listTrips`(home.js 迁移过去)
//   - 草稿函数(`loadDrafts` / `saveDraft` / `loadEditDraft` / `saveEditDraft` / `clearEditDraft`)0 改动
//   - `updateTrip` 调用方发 `itineraryArrange` 时后端 Pydantic 会忽略 extra 字段(实测 200 OK),不动
//   - `BASE_URL` / `MVP_USER_ID` 改 import 自 `services/config.js`
//
// v0.3.1(2026-06-11)改造(per integrate-r2 task):
//   - 3 个 trash 函数从「本地 DB-only」改为「HTTP 优先 → 失败降级本地 DB」:
//     * `listDeletedTrips`     — 1) HTTP GET /api/trash/trips?user_id=1
//                                2) 失败 → 读 db_trips + 客户端 filter deleted_at != null + sort desc
//     * `restoreTrashById`     — 1) HTTP POST /api/trash/trips/{id}/restore {user_id}
//                                2) 失败 → db/patchTrip({deleted_at: null})
//     * `permanentlyDeleteTrip`— 1) HTTP DELETE /api/trash/trips/{id}?user_id=1
//                                2) 失败 → db/deleteTrip(tripId) 物理删除
//   - 函数 JSDoc 顶部的旧 marker 注释已清理(后端 4 trash 端点已实装)
//   - 公开 ApiResponse 形状 1:1 保留({trips} / {restored:true} / {permanently_deleted:true}),
//     store 0 改动
//   - 404(资源不存在)在 listDeletedTrips 视为「空列表」,
//     在 restoreTrashById / permanentlyDeleteTrip 视为「幂等成功」(tashStore 仍按 404 静默处理)

import { ApiError } from './preferences.js'
import { logger } from '../utils/logger.js'
import { BASE_URL, MVP_USER_ID, USE_MOCK_FALLBACK } from './config.js'
import {
  createTripMock,
  tripDetailMock,
  updateTripMock,
  deleteTripMock,
} from '../../api/mock/trips.ts'
import { createTripDayMock } from '../../api/mock/trip-days.ts'
import {
  // v0.5.0(2026-06-25 per Cross-Page issue location-real-fix-v2-2026-06-25 §2.2):
  // - 删除 `createTripItemMock` / `updateTripItemMock` import(本服务不再使用)
  // - 保留 `deleteTripItemMock` import(deleteTripItem 函数仍走 fallback,
  //   per issue §2.2 删除清单**仅**列 createTripItem + updateTripItem 2 个函数)
  deleteTripItemMock,
} from '../../api/mock/trip-items.ts'
import {
  getTrip as dbGetTrip,
  setTrip as dbSetTrip,
  listTrips as dbListTrips,
  patchTrip as dbPatchTrip,
  deleteTrip as dbDeleteTrip,
} from '../db/index.js'

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
 * 判定 HTTP 失败是否可降级到 mock(isNetworkError / 5xx 走 fallback)
 *
 * @param {ApiError} err
 * @returns {boolean}
 */
function isFallbackable(err) {
  if (!USE_MOCK_FALLBACK) return false
  return err.isNetworkError === true
    || (err.statusCode >= 500 && err.statusCode < 600)
}

/**
 * POST /api/trips —— 创建行程
 *
 * v0.4.0(2026-06-24 per TripCreateEditFix-001):
 *   - 移除 `city` 字段传递:后端 CreateTripRequest extra=ignore 静默丢,徒增 noise。
 *     后端 `backend/app/models/trip.py:10-21` Trip 模型也无 city 列,
 *     city 仅在 trip_items.city 上(per issues/Arch/HomePage-001.md 类型审计)。
 *   - title 派生:`fd.title || 'Trip ${start} - ${end} ${days}天游'`(纯日期兜底,
 *     不再依赖 city 字段,per spec §6.4.4 v0.4.0 改造)。
 *   - POST body 仅 `{user_id, title, start_date, end_date, [itineraryArrange]}`。
 *
 * v0.3.0(per integrate-r1 task):
 *   - 1) HTTP `POST /api/trips` body `{user_id, title, start_date, end_date, [itineraryArrange]}` 优先
 *   - 2) HTTP 失败(isNetworkError / 5xx)→ 静默降级到 `createTripMock`(返回固定 trip_id=100)
 *
 * 入参只接受后端支持的 4 字段(`title` + `start_date` + `end_date` +
 * UI-025 `itineraryArrange`,`user_id` 由本服务内部注入);4 选填 client-only 字段
 * (spec §6.4.2)**不**进入 Request 体,本函数**不**感知。
 *
 * UI-025:`itineraryArrange: ItineraryItem[]` 是**可选**字段(spec §6.4.x 暂未明确
 * 后端是否落表,前端**默认发送**便于后端补字段时无侵入升级);空数组也合法。
 * 后端 Pydantic 默认 `extra=ignore`,此字段会被静默忽略,但携带无害。
 *
 * @param {object} req
 * @param {string} req.title  派生自 user input title 或日期兜底(spec §6.4.4)
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
        start_date: req.start_date,
        end_date: req.end_date,
        // UI-025 行程安排字段:空数组 fallback,后端 Pydantic 静默 ignore
        ...(Array.isArray(req.itineraryArrange) ? { itineraryArrange: req.itineraryArrange } : {}),
      },
      success: (res) => mapSuccess(res, resolve, reject),
      fail: (err) => mapFail(err, reject),
    })
  }).catch((httpErr) => {
    if (isFallbackable(httpErr)) {
      logger.warn('[trips.createTrip] HTTP failed, fallback to mock', {
        isNetworkError: httpErr.isNetworkError,
        statusCode: httpErr.statusCode,
      })
      return Promise.resolve(createTripMock)
    }
    return Promise.reject(httpErr)
  })
}

/**
 * POST /api/trips/{tripId}/days —— 创建行程某一天
 *
 * v0.4.0(2026-06-24 per TripCreateEditFix-001):
 *   - 1) HTTP `POST /api/trips/{tripId}/days` body `{user_id, day_index, trip_date, [summary]}` 优先
 *   - 2) HTTP 失败(isNetworkError / 5xx)→ 静默降级到 `createTripDayMock`(返回固定 trip_day_id=200)
 *
 * 沿 createTrip 现有模式(`new Promise((resolve, reject) => { uni.request({...}) })` +
 * `.catch(isFallbackable → mock)`)。
 *
 * @param {number} tripId
 * @param {object} req
 * @param {number} req.day_index  从 1 开始(后端约定,见 backend/app/schemas/trips.py:CreateTripDayRequest)
 * @param {string} req.trip_date  'YYYY-MM-DD'
 * @param {string} [req.summary]  可选,前端 MVP 默认传 ''
 * @returns {Promise<import('../api/types').ApiResponse<{ trip_day_id: number }>>}
 * @throws  {ApiError}
 */
export function createTripDay(tripId, req) {
  return new Promise((resolve, reject) => {
    uni.request({
      url: `${BASE_URL}/api/trips/${tripId}/days`,
      method: 'POST',
      header: { 'content-type': 'application/json' },
      data: {
        user_id: MVP_USER_ID,
        day_index: req.day_index,
        trip_date: req.trip_date,
        summary: req.summary || '',
      },
      success: (res) => mapSuccess(res, resolve, reject),
      fail: (err) => mapFail(err, reject),
    })
  }).catch((httpErr) => {
    if (isFallbackable(httpErr)) {
      logger.warn('[trips.createTripDay] HTTP failed, fallback to mock', {
        tripId,
        isNetworkError: httpErr.isNetworkError,
        statusCode: httpErr.statusCode,
      })
      return Promise.resolve(createTripDayMock)
    }
    return Promise.reject(httpErr)
  })
}

/**
 * POST /api/trip-items —— 创建行程项
 *
 * v0.5.0(2026-06-25 per Cross-Page issue location-real-fix-v2-2026-06-25 §2.2):
 *   - 1) HTTP `POST /api/trip-items` body `{user_id, trip_day_id, city, title, item_type,
 *      [start_time], [end_time], [address], [latitude], [longitude], [notes]}` 优先
 *   - 2) **失败不 mock fallback** → 直接抛 ApiError(per user 2026-06-25 16:12 硬要求)
 *   - city 必填(per backend/app/models/trip.py:34-51 + api/types.ts:228 CreateTripItemRequest),
 *     page 层 NewTripPage.submitTripRequest + EditTripPage.onAddItem 调本函数时
 *     city 从 trip.title 派生(默认 trip.title 字面值,后端 Pydantic min_length=1 接受任意非空)
 *
 * 沿 createTrip 现有模式(`new Promise((resolve, reject) => { uni.request({...}) })`)。
 *
 * @param {object} req
 * @param {number} req.trip_day_id
 * @param {string} req.city       必填,page 层从 trip.title 派生(不允许空字符串)
 * @param {string} req.title
 * @param {import('../api/types').ItemType} [req.item_type]
 * @param {string} [req.start_time]  'HH:mm'
 * @param {string} [req.end_time]    'HH:mm'
 * @returns {Promise<import('../api/types').ApiResponse<{ item_id: number }>>}
 * @throws  {ApiError}
 */
export function createTripItem(req) {
  return new Promise((resolve, reject) => {
    uni.request({
      url: `${BASE_URL}/api/trip-items`,
      method: 'POST',
      header: { 'content-type': 'application/json' },
      data: {
        user_id: MVP_USER_ID,
        trip_day_id: req.trip_day_id,
        // city 必填(per v0.5.0 修复):原 `req.city || ''` 兜底已删除
        // 后端 Pydantic CreateTripItemRequest.city: str 必填,前端发空串触发 422
        city: req.city,
        title: req.title,
        ...(req.item_type ? { item_type: req.item_type } : {}),
        ...(req.start_time ? { start_time: req.start_time } : {}),
        ...(req.end_time ? { end_time: req.end_time } : {}),
        ...(req.address ? { address: req.address } : {}),
        ...(typeof req.latitude === 'number' ? { latitude: req.latitude } : {}),
        ...(typeof req.longitude === 'number' ? { longitude: req.longitude } : {}),
        ...(req.notes ? { notes: req.notes } : {}),
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
 * PUT /api/trip-items/{trip_item_id} —— 更新行程项
 *
 * v0.5.0(per Cross-Page issue location-real-fix-v2-2026-06-25 §2.2):
 *   - 1) HTTP `PUT /api/trip-items/{tripItemId}` body `{user_id, [title], [item_type],
 *      [start_time], [end_time], [city], [address], [latitude], [longitude], [notes]}` 优先
 *   - 2) **失败不 mock fallback** → 直接抛 ApiError
 *
 * 与 createTripItem 不同:本函数不要求 title 必填(per UpdateTripItemRequest: 全字段 optional);
 * 调用方(EditTripPage.onUpdateItem)按 PUT partial-update 语义仅发 changed 字段。
 *
 * 注:与 PUT /api/trips/{id} 不同,后端 Pydantic `UpdateTripItemRequest` 模型实际
 * 接受 `title` / `item_type` 等可改字段(per backend/app/schemas/trips.py + user 实测 200 OK),
 * 所以本函数可全字段透传,前端**不**做字段级过滤(沿 updateTrip 模式)。
 *
 * @param {number} tripItemId
 * @param {object} req UpdateTripItemRequest 形状(`api/types.ts:UpdateTripItemRequest`):
 *   { title?, item_type?, start_time?, end_time?, status?, notes?, city? }
 * @returns {Promise<import('../api/types').ApiResponse<{ updated: true }>>}
 * @throws  {ApiError}
 */
export function updateTripItem(tripItemId, req) {
  return new Promise((resolve, reject) => {
    uni.request({
      url: `${BASE_URL}/api/trip-items/${tripItemId}`,
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
  // 注:v0.5.0 起删除 .catch((httpErr) => { mock fallback }) 段
}

/**
 * DELETE /api/trip-items/{trip_item_id} —— 删除行程项
 *
 * v0.5.0(2026-06-25 per UserRound2-001 Bug A):
 *   - 1) HTTP `DELETE /api/trip-items/{tripItemId}?user_id=1` 优先
 *   - 2) HTTP 失败(isNetworkError / 5xx)→ 静默降级到 `deleteTripItemMock`
 *      (返回固定 `{deleted: true}`)
 *
 * user_id 走 query string(后端 `delete_trip_item_endpoint(trip_item_id, user_id: int)` 必填),
 * 与 `deleteTrip` 路径同模式(per trips.js:359-378 v0.3.0 实证)。
 *
 * 404(资源不存在 / 已被并发删除)在 store 层视为幂等成功;service 层透传,EditTripPage
 * 走乐观更新 → 失败回滚路径,无 404 静默语义(per issue §1.3.2 onRemoveItem 决策)。
 *
 * @param {number} tripItemId
 * @returns {Promise<import('../api/types').ApiResponse<{ deleted: true }>>}
 * @throws  {ApiError}
 */
export function deleteTripItem(tripItemId) {
  return new Promise((resolve, reject) => {
    uni.request({
      url: `${BASE_URL}/api/trip-items/${tripItemId}?user_id=${MVP_USER_ID}`,
      method: 'DELETE',
      success: (res) => mapSuccess(res, resolve, reject),
      fail: (err) => mapFail(err, reject),
    })
  }).catch((httpErr) => {
    if (isFallbackable(httpErr)) {
      logger.warn('[trips.deleteTripItem] HTTP failed, fallback to mock', {
        tripItemId,
        isNetworkError: httpErr.isNetworkError,
        statusCode: httpErr.statusCode,
      })
      return Promise.resolve(deleteTripItemMock)
    }
    return Promise.reject(httpErr)
  })
}

/**
 * GET /api/trips —— wrapper to services/home.listTrips
 *
 * v0.3.0 起 `listTrips` 实际归属移到 `services/home.js`(homeStore 用);
 * 本函数保留为 wrapper,1:1 转发,避免破坏潜在的 import path
 * (本文件历史 import 过 listTrips 的页面 / store)
 *
 * @returns {Promise<import('../api/types').ApiResponse<{ trips: import('../api/types').TripSummary[] }>>}
 */
export function listTrips() {
  // 动态 import 避免循环依赖(home.js 也 import ApiError from preferences.js)
  return import('./home.js').then((home) => home.listTrips())
}

/**
 * GET /api/trips/{trip_id} —— 行程详情(含 days[].items[] 全量)
 *
 * v0.3.0(per integrate-r1 task):
 *   - 1) HTTP `GET /api/trips/{trip_id}?user_id=1` 优先
 *   - 2) HTTP 失败(isNetworkError / 5xx)→ 静默降级到 `tripDetailMock`
 *   - 注:mock 端 `tripDetailMock.data` 是固定 `seedTrip`;真实后端响应**无** `user_id` /
 *     `deleted_at` / `days[].items` 字段(per integrate-r1 后端实测),调用方按 spec 形态兼容
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
  }).catch((httpErr) => {
    if (isFallbackable(httpErr)) {
      logger.warn('[trips.getTripDetail] HTTP failed, fallback to mock', {
        isNetworkError: httpErr.isNetworkError,
        statusCode: httpErr.statusCode,
      })
      return Promise.resolve(tripDetailMock)
    }
    return Promise.reject(httpErr)
  })
}

/**
 * DELETE /api/trips/{trip_id} —— 软删除(由后端实现,前端不感知硬/软删)
 *
 * v0.3.0(per integrate-r1 task):
 *   - 1) HTTP `DELETE /api/trips/{trip_id}` 优先
 *   - 2) HTTP 失败(isNetworkError / 5xx)→ 静默降级到 `deleteTripMock`
 *
 * @param {number} tripId
 * @returns {Promise<import('../api/types').ApiResponse<{ deleted: true }>>}
 * @throws  {ApiError}
 */
export function deleteTrip(tripId) {
  return new Promise((resolve, reject) => {
    uni.request({
      // fix-trip-bugs-v1:user_id 改走 query string(后端 delete_trip_endpoint(trip_id, user_id: int) 必填),
      // 原 data 走 body → 4000;实测 `?user_id=1` → 200 OK
      url: `${BASE_URL}/api/trips/${tripId}?user_id=${MVP_USER_ID}`,
      method: 'DELETE',
      success: (res) => mapSuccess(res, resolve, reject),
      fail: (err) => mapFail(err, reject),
    })
  }).catch((httpErr) => {
    if (isFallbackable(httpErr)) {
      logger.warn('[trips.deleteTrip] HTTP failed, fallback to mock', {
        isNetworkError: httpErr.isNetworkError,
        statusCode: httpErr.statusCode,
      })
      return Promise.resolve(deleteTripMock)
    }
    return Promise.reject(httpErr)
  })
}

/**
 * PUT /api/trips/{trip_id} —— 修改行程
 *
 * v0.3.0(per integrate-r1 task):
 *   - 1) HTTP `PUT /api/trips/{trip_id}` body `{user_id, [title], [status], [itineraryArrange]}` 优先
 *   - 2) HTTP 失败(isNetworkError / 5xx)→ 静默降级到 `updateTripMock`
 *
 * @param {number} tripId
 * @param {object} req UpdateTripRequest 形状(`api/types.ts:UpdateTripRequest`):
 *   { title?: string, status?: 'draft' | 'active' | 'finished',
 *     itineraryArrange?: ItineraryItem[] }
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
  }).catch((httpErr) => {
    if (isFallbackable(httpErr)) {
      logger.warn('[trips.updateTrip] HTTP failed, fallback to mock', {
        isNetworkError: httpErr.isNetworkError,
        statusCode: httpErr.statusCode,
      })
      return Promise.resolve(updateTripMock)
    }
    return Promise.reject(httpErr)
  })
}

// ───────────────── Trash 3 函数(HTTP 优先 → 失败降级本地 DB)─────────────────
//
// v0.3.1 决策(per integrate-r2 task):
//   - 后端**已实装** 4 trash 端点(per backend/api/locations.py + backend/api/trash.py
//     后端实测,见整合 deliverable §3 契约校验):
//     * GET    /api/trash/trips?user_id=1
//     * POST   /api/trash/trips/{id}/restore  body {user_id}
//     * DELETE /api/trash/trips/{id}?user_id=1
//     * DELETE /api/trash/trips?user_id=1   ← 批量(per trashStore.clearTrash 扩展用)
//   - 端点契约 1:1 对齐 docs/API接口文档.md §6.10-§6.12
//   - HTTP 优先(uni.request 真后端) → 失败(isNetworkError / 5xx / 404 资源不存在)→ 静默降级本地 DB
//   - 404 在 listDeletedTrips 视为「空列表」,在 restoreTrashById / permanentlyDeleteTrip
//     视为「幂等成功」,与 trashStore 的 404 静默路径对齐
//   - 公开 ApiResponse 形状 1:1 保留({trips} / {restored:true} / {permanently_deleted:true}),
//     store 0 改动(沿 v0.3.0 兼容路径)
//
// 实现细节:
//   - HTTP 路径走 `mapSuccess` 统一映射(2xx + code===0 resolve;其它 reject ApiError)
//   - DB 路径走 `db/listTrips` / `db/patchTrip` / `db/deleteTrip`(v0.3.1 新增)
//   - listDeletedTrips 的 DB 路径**不**走 mock(同 v0.3.0 决策:trash 不在 mock 范围)
//   - 失败回退 DB 后,resolve 形态 1:1 保留(消息末尾 '(local DB)' 标识供调试用)

// ─────────── listDeletedTrips ───────────

/**
 * GET /api/trash/trips —— 拉取已删行程列表
 *
 * v0.3.1(per integrate-r2 task):
 *   - 1) HTTP `GET /api/trash/trips?user_id=1` 优先
 *   - 2) HTTP 失败(isNetworkError / 5xx / 404)→ 静默降级到本地 DB:
 *     读 `db_trips` 中所有 trip,客户端 filter `deleted_at !== null`,
 *     按 `deleted_at desc` 排序(对齐 mock `trashListMock` 的 sort 行为)
 *   - 公开 ApiResponse 形状 1:1 保留:`{trips: TripSummary[]}`,
 *     trashStore.fetchTrash 0 改动
 *
 * @returns {Promise<import('../api/types').ApiResponse<{ trips: import('../api/types').TripSummary[] }>>}
 * @throws  {ApiError} 仅当 HTTP 不可 fallback(4xx 业务错,非 404)+ 本地 DB 损坏时才 reject
 */
export function listDeletedTrips() {
  return new Promise((resolve, reject) => {
    uni.request({
      url: `${BASE_URL}/api/trash/trips`,
      method: 'GET',
      data: { user_id: MVP_USER_ID },
      success: (res) => {
        // HTTP 404 视为空列表(沿用 trashStore 404 静默语义)
        if (res.statusCode === 404) {
          logger.warn('[trips.listDeletedTrips] HTTP 404, fallback to local DB (empty list)')
          return resolveLocalDbList(resolve, reject)
        }
        mapSuccess(res, resolve, (err) => {
          // 不可 fallback 的 HTTP 错误(4xx 业务错,非 404)→ reject
          reject(err)
        })
      },
      fail: (err) => {
        // 网络断开 → 降级本地 DB
        const apiErr = new ApiError({
          code: null,
          message: err?.errMsg || '网络异常,请检查网络连接',
          statusCode: 0,
          isNetworkError: true,
        })
        if (isFallbackable(apiErr)) {
          logger.warn('[trips.listDeletedTrips] HTTP network failed, fallback to local DB')
          return resolveLocalDbList(resolve, reject)
        }
        return reject(apiErr)
      },
    })
  }).catch((httpErr) => {
    // mapSuccess 抛出的非 404 4xx / 5xx → 尝试 fallback(同 home.js 模式)
    if (isFallbackable(httpErr)) {
      logger.warn('[trips.listDeletedTrips] HTTP failed, fallback to local DB', {
        isNetworkError: httpErr.isNetworkError,
        statusCode: httpErr.statusCode,
      })
      return Promise.resolve(buildLocalDbListResponse())
    }
    return Promise.reject(httpErr)
  })
}

/**
 * 本地 DB 路径 —— 读 db_trips,filter deleted_at != null,sort desc
 * @param {(value: any) => void} resolve
 * @param {(reason: ApiError) => void} reject
 */
function resolveLocalDbList(resolve, reject) {
  try {
    resolve(buildLocalDbListResponse())
  } catch (err) {
    logger.error('[trips.listDeletedTrips] local DB failed', err)
    reject(new ApiError({
      code: 5000,
      message: '本地 DB 不可用,无法读取回收站',
      statusCode: 500,
    }))
  }
}

/**
 * 构建本地 DB 列表响应(纯函数,便于复用 / 单测)
 * @returns {import('../api/types').ApiResponse<{ trips: import('../api/types').TripSummary[] }>}
 */
function buildLocalDbListResponse() {
  const all = dbListTrips()
  // DB Trip 形状包含全字段;此处投影为 TripSummary(对齐 spec §6.2)
  const deleted = all
    .filter((t) => t && t.deleted_at)
    .map((t) => ({
      id: typeof t.id === 'string' ? Number(t.id) : t.id,
      title: t.title,
      city: t.city,
      start_date: t.start_date,
      end_date: t.end_date,
      status: t.status,
      deleted_at: t.deleted_at,
    }))
    .sort((a, b) => {
      if (a.deleted_at && b.deleted_at) {
        return String(b.deleted_at).localeCompare(String(a.deleted_at))
      }
      return (b.id || 0) - (a.id || 0)
    })
  logger.info('[trips.listDeletedTrips] ok (local DB)', { deleted: deleted.length })
  return {
    code: 0,
    message: 'success (local DB)',
    data: { trips: deleted },
  }
}

// ─────────── restoreTrashById ───────────

/**
 * POST /api/trash/trips/{id}/restore —— 恢复已删行程
 *
 * v0.3.1(per integrate-r2 task):
 *   - 1) HTTP `POST /api/trash/trips/{tripId}/restore` body `{user_id: 1}` 优先
 *   - 2) HTTP 失败(isNetworkError / 5xx)→ 静默降级到本地 DB:
 *     `db/patchTrip(tripId, {deleted_at: null})` 置 deleted_at = null
 *   - 公开 ApiResponse 形状 1:1 保留:`{restored: true}`,trashStore.restoreTrashById 0 改动
 *   - HTTP 404(trip 已被自动清理)→ resolve `{restored: true}` 幂等成功(与 trashStore 404 静默路径对齐)
 *
 * @param {number} tripId
 * @returns {Promise<import('../api/types').ApiResponse<{ restored: true }>>}
 * @throws  {ApiError} tripId 在 HTTP 不可 fallback(4xx 业务错,非 404)+ 本地 DB 也无时
 */
export function restoreTrashById(tripId) {
  return new Promise((resolve, reject) => {
    uni.request({
      url: `${BASE_URL}/api/trash/trips/${tripId}/restore`,
      method: 'POST',
      header: { 'content-type': 'application/json' },
      data: { user_id: MVP_USER_ID },
      success: (res) => {
        // 404 静默:幂等视为成功(沿 trashStore §5.3.H + AC-06 404 静默语义)
        if (res.statusCode === 404) {
          logger.warn('[trips.restoreTrashById] HTTP 404, trip already gone, resolve as success', { tripId })
          return resolve({
            code: 0,
            message: 'success (idempotent, trip already gone)',
            data: { restored: true },
          })
        }
        mapSuccess(res, resolve, (err) => reject(err))
      },
      fail: (err) => {
        const apiErr = new ApiError({
          code: null,
          message: err?.errMsg || '网络异常,请检查网络连接',
          statusCode: 0,
          isNetworkError: true,
        })
        if (isFallbackable(apiErr)) {
          logger.warn('[trips.restoreTrashById] HTTP network failed, fallback to local DB', { tripId })
          return resolveLocalDbRestore(tripId, resolve, reject)
        }
        return reject(apiErr)
      },
    })
  }).catch((httpErr) => {
    if (isFallbackable(httpErr)) {
      logger.warn('[trips.restoreTrashById] HTTP failed, fallback to local DB', {
        tripId,
        isNetworkError: httpErr.isNetworkError,
        statusCode: httpErr.statusCode,
      })
      return new Promise((resolve, reject) => resolveLocalDbRestore(tripId, resolve, reject))
    }
    return Promise.reject(httpErr)
  })
}

/**
 * 本地 DB 恢复:将 trip 的 `deleted_at` 置 null
 * @param {number} tripId
 * @param {(value: any) => void} resolve
 * @param {(reason: ApiError) => void} reject
 */
function resolveLocalDbRestore(tripId, resolve, reject) {
  try {
    const updated = dbPatchTrip(tripId, { deleted_at: null })
    if (!updated) {
      logger.warn('[trips.restoreTrashById] trip not found in local DB', { tripId })
      // 与 HTTP 404 静默路径一致:trip 不存在视为幂等成功
      return resolve({
        code: 0,
        message: 'success (idempotent, trip not in local DB)',
        data: { restored: true },
      })
    }
    logger.info('[trips.restoreTrashById] ok (local DB)', { tripId })
    return resolve({
      code: 0,
      message: 'success (local DB)',
      data: { restored: true },
    })
  } catch (err) {
    logger.error('[trips.restoreTrashById] local DB failed', err)
    return reject(new ApiError({
      code: 5000,
      message: '本地 DB 不可用,无法恢复',
      statusCode: 500,
    }))
  }
}

// ─────────── permanentlyDeleteTrip ───────────

/**
 * DELETE /api/trash/trips/{id} —— 永久删除行程
 *
 * v0.3.1(per integrate-r2 task):
 *   - 1) HTTP `DELETE /api/trash/trips/{tripId}?user_id=1` 优先
 *   - 2) HTTP 失败(isNetworkError / 5xx)→ 静默降级到本地 DB:
 *     `db/deleteTrip(tripId)` 物理删除 db_trips 中该 trip(v0.3.1 新增)
 *   - 公开 ApiResponse 形状 1:1 保留:`{permanently_deleted: true}`,
 *     trashStore.permanentlyDeleteTrip 0 改动
 *   - HTTP 404(trip 已被自动清理)→ resolve `{permanently_deleted: true}` 幂等成功
 *
 * @param {number} tripId
 * @returns {Promise<import('../api/types').ApiResponse<{ permanently_deleted: true }>>}
 * @throws  {ApiError} 仅当 HTTP 不可 fallback + 本地 DB 写失败时
 */
export function permanentlyDeleteTrip(tripId) {
  return new Promise((resolve, reject) => {
    uni.request({
      url: `${BASE_URL}/api/trash/trips/${tripId}`,
      method: 'DELETE',
      data: { user_id: MVP_USER_ID },
      success: (res) => {
        // 404 静默:幂等视为成功(与 trashStore 404 静默路径对齐)
        if (res.statusCode === 404) {
          logger.warn('[trips.permanentlyDeleteTrip] HTTP 404, trip already gone, resolve as success', { tripId })
          return resolve({
            code: 0,
            message: 'success (idempotent, trip already gone)',
            data: { permanently_deleted: true },
          })
        }
        mapSuccess(res, resolve, (err) => reject(err))
      },
      fail: (err) => {
        const apiErr = new ApiError({
          code: null,
          message: err?.errMsg || '网络异常,请检查网络连接',
          statusCode: 0,
          isNetworkError: true,
        })
        if (isFallbackable(apiErr)) {
          logger.warn('[trips.permanentlyDeleteTrip] HTTP network failed, fallback to local DB', { tripId })
          return resolveLocalDbDelete(tripId, resolve, reject)
        }
        return reject(apiErr)
      },
    })
  }).catch((httpErr) => {
    if (isFallbackable(httpErr)) {
      logger.warn('[trips.permanentlyDeleteTrip] HTTP failed, fallback to local DB', {
        tripId,
        isNetworkError: httpErr.isNetworkError,
        statusCode: httpErr.statusCode,
      })
      return new Promise((resolve, reject) => resolveLocalDbDelete(tripId, resolve, reject))
    }
    return Promise.reject(httpErr)
  })
}

/**
 * 本地 DB 永久删除:物理移除 db_trips 中该 trip
 * @param {number} tripId
 * @param {(value: any) => void} resolve
 * @param {(reason: ApiError) => void} reject
 */
function resolveLocalDbDelete(tripId, resolve, reject) {
  try {
    // 先校验 trip 是否存在(避免误删)
    const existing = dbGetTrip(tripId)
    if (!existing) {
      logger.warn('[trips.permanentlyDeleteTrip] trip not found in local DB, idempotent', { tripId })
      return resolve({
        code: 0,
        message: 'success (idempotent, trip not in local DB)',
        data: { permanently_deleted: true },
      })
    }
    const ok = dbDeleteTrip(tripId)
    if (!ok) {
      logger.error('[trips.permanentlyDeleteTrip] db/deleteTrip returned false', { tripId })
      return reject(new ApiError({
        code: 5000,
        message: '本地 DB 不可用,无法永久删除',
        statusCode: 500,
      }))
    }
    logger.info('[trips.permanentlyDeleteTrip] ok (local DB)', { tripId })
    return resolve({
      code: 0,
      message: 'success (local DB)',
      data: { permanently_deleted: true },
    })
  } catch (err) {
    logger.error('[trips.permanentlyDeleteTrip] local DB failed', err)
    return reject(new ApiError({
      code: 5000,
      message: '本地 DB 不可用,无法永久删除',
      statusCode: 500,
    }))
  }
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
 * v0.7.0 简化:TripDraft 形状从 5 字段 → 3 字段(spec §4.3):
 *   删除 `inputText` + `attachedFiles`(随 input 态 / 文件 chips 一起删除)
 *   保留字段 = `id` + `created_at` + `formData`
 *
 * @param {object} draft TripDraft 形状(spec §4.3,v0.7.0 起):
 *   { id: number, created_at: string, formData: object }
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

/** 从自然语言中提取明确的行程字段；未提及字段由后端保持为空。 */
export function parseTripText(text) {
  const now = new Date()
  const currentDate = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
  return new Promise((resolve, reject) => {
    uni.request({
      url: `${BASE_URL}/api/trips/parse`,
      method: 'POST',
      header: { 'content-type': 'application/json' },
      data: {
        user_id: MVP_USER_ID,
        text,
        current_date: currentDate,
        timezone: 'Asia/Shanghai',
      },
      success: (res) => mapSuccess(res, resolve, reject),
      fail: (err) => mapFail(err, reject),
    })
  })
}

/** 在单个后端事务中创建 Trip、TripDay 和 TripItem。 */
export function createTripFromDraft(req) {
  return new Promise((resolve, reject) => {
    uni.request({
      url: `${BASE_URL}/api/trips/from-draft`,
      method: 'POST',
      header: { 'content-type': 'application/json' },
      data: { ...req, user_id: MVP_USER_ID },
      success: (res) => mapSuccess(res, resolve, reject),
      fail: (err) => mapFail(err, reject),
    })
  })
}
