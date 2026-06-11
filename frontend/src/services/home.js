// frontend/services/home.js
// 封装 docs/API接口文档.md §5.1 / §6.2 / §9.2 + 本地 favorites 持久化
//
//   GET /api/home/today      → getToday(tripId)
//   GET /api/trips           → listTrips()
//   GET /api/reminders       → listReminders(tripId, status)   ← 本页面不主动调,留作复用
//   favorites 本地存储        → loadFavorites / saveFavorite / removeFavorite
//
// MVP 约定(见 docs/API接口文档.md §1.3):
//   - `user_id` 固定为 1,前端不感知
//   - Base URL 默认为 http://localhost:8000
//
// 失败映射(spec §6.1 Error 表 + task 友好提示):
//   - 400 / 4000 → 参数非法
//   - 5xx / 5000 → 服务端错误
//   - 404 / 4001 → 资源不存在(本页面不视为 error,trips 列表为空时正常)
//   - fail 回调  → 网络断开(isNetworkError=true)
//
// favorites 持久化(task §12):
//   - 使用 uni.setStorageSync('favorites', [id1, id2, ...])
//   - 任何页面 / 任何时刻都从 storage 读,与 store / page 解耦
//   - 异常(quota 满 / storage 不可用) → 静默降级为内存数组,UI 仍可点击

import { ApiError } from './preferences.js'
import { logger } from '../utils/logger.js'

const BASE_URL = 'http://localhost:8000'
const MVP_USER_ID = 1
const FAVORITES_STORAGE_KEY = 'favorites'

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
 * GET /api/home/today —— 首页今日行程
 *
 * @param {number} tripId  当前 trip id(MVP 阶段由 store 内部从 /api/trips 选)
 * @returns {Promise<import('../api/types').ApiResponse<{
 *   trip_id: number, trip_title: string, city: string, date: string,
 *   today_items: import('../api/types').TripItem[], unread_reminders: number
 * }>>}
 * @throws  {ApiError}
 */
export function getToday(tripId) {
  return new Promise((resolve, reject) => {
    uni.request({
      url: `${BASE_URL}/api/home/today`,
      method: 'GET',
      data: {
        user_id: MVP_USER_ID,
        trip_id: tripId,
      },
      success: (res) => mapSuccess(res, resolve, reject),
      fail: (err) => mapFail(err, reject),
    })
  })
}

/**
 * GET /api/trips —— 行程列表(轻量 TripSummary)
 *
 * @returns {Promise<import('../api/types').ApiResponse<{ trips: import('../api/types').TripSummary[] }>>}
 * @throws  {ApiError}
 */
export function listTrips() {
  return new Promise((resolve, reject) => {
    uni.request({
      url: `${BASE_URL}/api/trips`,
      method: 'GET',
      data: { user_id: MVP_USER_ID },
      success: (res) => mapSuccess(res, resolve, reject),
      fail: (err) => mapFail(err, reject),
    })
  })
}

/**
 * GET /api/reminders —— 提醒列表(本页面**不主动**调,留作其他页面复用)
 *
 * @param {number} tripId
 * @param {'unread' | 'read'} [status='unread']
 * @returns {Promise<import('../api/types').ApiResponse<{ reminders: import('../api/types').Reminder[] }>>}
 * @throws  {ApiError}
 */
export function listReminders(tripId, status = 'unread') {
  return new Promise((resolve, reject) => {
    uni.request({
      url: `${BASE_URL}/api/reminders`,
      method: 'GET',
      data: {
        user_id: MVP_USER_ID,
        trip_id: tripId,
        status,
      },
      success: (res) => mapSuccess(res, resolve, reject),
      fail: (err) => mapFail(err, reject),
    })
  })
}

// ───────────────── Favorites(本地持久化,见 task §12)─────────────────

/**
 * 读取收藏 id 列表 —— 启动时从 uni.storage 读
 *
 * 静默降级:storage 不可用 / JSON 解析失败 / 读异常 → 返回空数组
 * (不抛错,避免阻塞首页渲染)
 *
 * @returns {number[]}
 */
export function loadFavorites() {
  try {
    const raw = uni.getStorageSync(FAVORITES_STORAGE_KEY)
    if (!raw) return []
    if (typeof raw === 'string') {
      const parsed = JSON.parse(raw)
      return Array.isArray(parsed) ? parsed.filter((v) => Number.isFinite(v)) : []
    }
    if (Array.isArray(raw)) {
      return raw.filter((v) => Number.isFinite(v))
    }
    return []
  } catch (err) {
    logger.warn('[home.favorites] load failed, fallback to empty', err)
    return []
  }
}

/**
 * 写入收藏 id 列表 —— 启动时同步一次,后续 toggle 时再覆盖
 *
 * 静默降级:storage 写异常 → 仅 logger.warn,不抛错
 *
 * @param {number[]} ids
 * @returns {boolean} true = 写成功
 */
export function saveFavorites(ids) {
  try {
    uni.setStorageSync(FAVORITES_STORAGE_KEY, Array.isArray(ids) ? ids : [])
    return true
  } catch (err) {
    logger.warn('[home.favorites] save failed', err)
    return false
  }
}
