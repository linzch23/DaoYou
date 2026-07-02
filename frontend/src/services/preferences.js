// frontend/services/preferences.js
// 封装 docs/API接口文档.md §11(用户偏好接口)
//
//   PUT /api/preferences → updatePreferences(payload)
//   GET  /api/preferences → getPreferences()
//
// MVP 约定(见 docs/API接口文档.md §1.3):
//   - `user_id` 固定为 1,前端不感知
//   - Base URL 默认为 http://localhost:8000
//
// 调用约定(OnboardingPage 场景):
//   updatePreferences({ interests: ['history', 'photo'] })
//   ↑ 只送本次修改的字段;后端对未携带字段保持既有值(PUT 语义)。
//   **前端不替用户保留其它字段**(explanation_style),
//   这些由 PersonalProfilePage / StyleSettingPage 各自负责。
//
// v0.3.1(2026-06-28)PersonalProfilePage v0.2.0 扩段:
//   - updateUserInfo 签名由 `{ interests }` 扩展为 `{ interests, travel_pace, special_needs }`
//   - 内部过滤 undefined 字段后转发 updatePreferences(沿 PUT partial-update 语义)
//
// 返回:
//   成功:Promise<{ code: 0, message: 'success', data: { updated: true } }>
//   失败:Promise.reject(new ApiError({ code, message, statusCode, isNetworkError }))
//
// 失败映射(spec §6.1 Error 表):
//   - 400 / 4000 → 参数非法
//   - 5xx / 5000 → 服务端错误
//   - fail 回调  → 网络断开(isNetworkError=true)
//
// v0.3.0(2026-06-11)改造(per integrate-r1 task):
//   - 改回 HTTP 优先路径:`uni.request PUT/GET /api/preferences`
//   - HTTP 失败(isNetworkError / 5xx)→ 静默降级到 `api/mock/preferences` 的
//     `getPreferencesMock` / `updatePreferencesMock`
//   - Mock 失败才 → 兜底走本地 DB(`db/getUser` / `db/updateUser`)
//   - 公开 ApiResponse 形状 1:1 保留(`{preferences}` / `{updated: true}`),
//     userStore 0 改动
//   - `updateUserInfo` 薄包装保留(给 PersonalProfilePage 用),1:1 转发
//   - `ApiError` class 继续 export,跨域复用不变
//
// 历史:
//   - v0.2.0(2026-06-06):getPreferences / updatePreferences 改走本地 DB
//   - v0.3.0(2026-06-11):HTTP 优先 + mock/local-DB fallback

import { getUser as dbGetUser, updateUser as dbUpdateUser } from '../db/index.js'
import { BASE_URL, MVP_USER_ID, USE_MOCK_FALLBACK } from './config.js'
import { logger } from '../utils/logger.js'
import {
  preferencesMock,
  updatePreferencesMock,
} from '../../api/mock/preferences.ts'

/**
 * 业务错误 —— 携带 code / statusCode / isNetworkError
 * 页面据此映射到友好提示(spec §6.1 Error 表)
 *
 * v0.3.0 起增加可选 `isMock` / `fromLocalDb` 字段,仅供 store / page 排错用;
 * 公开发布函数仍返回标准 ApiResponse 形状。
 */
export class ApiError extends Error {
  constructor({ code, message, statusCode, isNetworkError, isMock, fromLocalDb }) {
    super(message || 'API 请求失败')
    this.name = 'ApiError'
    /** @type {number | null} 后端业务 code;网络断开时为 null */
    this.code = code ?? null
    /** @type {number} HTTP status;网络断开时为 0 */
    this.statusCode = statusCode ?? 0
    /** @type {boolean} true = uni.request fail(网络断开 / 超时) */
    this.isNetworkError = !!isNetworkError
    /** @type {boolean} true = fallback mock 返回时,标记非真后端响应(诊断用) */
    this.isMock = !!isMock
    /** @type {boolean} true = 本地 DB fallback 返回(诊断用) */
    this.fromLocalDb = !!fromLocalDb
  }
}

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
 * GET /api/preferences —— 查询用户偏好
 *
 * 实现 v0.3.0(per integrate-r1 task):
 *   - 1) HTTP `GET /api/preferences?user_id=1` 优先
 *   - 2) HTTP 失败(isNetworkError / 5xx)→ mock `preferencesMock` 静默降级
 *   - 3) mock 也失败(防御性兜底)→ 本地 DB `db/getUser`,只取 4 个偏好字段
 *   - Public return shape:`{ code: 0, message, data: { preferences } }`
 *
 * @returns {Promise<{ code: 0, message: string, data: { preferences: import('../api/types').Preferences } }>}
 * @throws  {ApiError} 仅当 mock + 本地 DB 双重失败时(用户从未 seed 过)
 */
export function getPreferences() {
  return new Promise((resolve, reject) => {
    uni.request({
      url: `${BASE_URL}/api/preferences`,
      method: 'GET',
      data: { user_id: MVP_USER_ID },
      success: (res) => mapSuccess(res, resolve, reject),
      fail: (err) => mapFail(err, reject),
    })
  }).catch((httpErr) => {
    // HTTP 失败 → 尝试 mock fallback
    if (isFallbackable(httpErr)) {
      logger.warn('[preferences.getPreferences] HTTP failed, fallback to mock', {
        isNetworkError: httpErr.isNetworkError,
        statusCode: httpErr.statusCode,
      })
      return Promise.resolve(preferencesMock)
    }
    // 不可 fallback 的错误(4xx 业务错)直接 reject
    return Promise.reject(httpErr)
  }).catch(() => {
    // mock 失败防御性兜底 → 本地 DB
    try {
      const user = dbGetUser(String(MVP_USER_ID))
      const preferences = {
        explanation_style: user.explanation_style,
        travel_pace: user.travel_pace,
        interests: user.interests,
        special_needs: user.special_needs,
      }
      logger.warn('[preferences.getPreferences] fallback to local DB', {
        userId: MVP_USER_ID,
      })
      return Promise.resolve({
        code: 0,
        message: 'success (local DB fallback)',
        data: { preferences },
      })
    } catch (dbErr) {
      logger.error('[preferences.getPreferences] all fallback failed', dbErr)
      return Promise.reject(dbErr)
    }
  })
}

/**
 * PUT /api/preferences —— 更新用户偏好
 *
 * 实现 v0.3.0(per integrate-r1 task):
 *   - 1) HTTP `PUT /api/preferences` body `{user_id, preferences}` 优先
 *   - 2) 失败 → mock `updatePreferencesMock` 静默降级
 *   - 3) mock 也失败 → 本地 DB `db/updateUser`
 *   - Public return shape:`{ code: 0, message, data: { updated: true } }`
 *
 * @param {object} payload 完整或部分 Preferences(spec §7.2 形状)
 *   例:{ interests: ['history', 'photo'] }   ← OnboardingPage 唯一用法
 * @returns {Promise<{ code: 0, message: string, data: { updated: true } }>}
 */
export function updatePreferences(payload) {
  return new Promise((resolve, reject) => {
    uni.request({
      url: `${BASE_URL}/api/preferences`,
      method: 'PUT',
      header: { 'content-type': 'application/json' },
      data: {
        user_id: MVP_USER_ID,
        preferences: payload,
      },
      success: (res) => mapSuccess(res, resolve, reject),
      fail: (err) => mapFail(err, reject),
    })
  }).catch((httpErr) => {
    if (isFallbackable(httpErr)) {
      logger.warn('[preferences.updatePreferences] HTTP failed, fallback to mock', {
        isNetworkError: httpErr.isNetworkError,
        statusCode: httpErr.statusCode,
      })
      return Promise.resolve(updatePreferencesMock)
    }
    return Promise.reject(httpErr)
  }).catch(() => {
    try {
      dbUpdateUser(String(MVP_USER_ID), payload)
      logger.warn('[preferences.updatePreferences] fallback to local DB', {
        userId: MVP_USER_ID,
      })
      return Promise.resolve({
        code: 0,
        message: 'success (local DB fallback)',
        data: { updated: true },
      })
    } catch (dbErr) {
      logger.error('[preferences.updatePreferences] all fallback failed', dbErr)
      return Promise.reject(dbErr)
    }
  })
}

/**
 * POST /api/preferences/parse —— 将自由文本整理为可确认的结构化旅行偏好。
 * 原文只作为不可信偏好数据，服务端不会把它当系统指令执行。
 * @param {string} text
 * @param {object} currentPreferences
 * @returns {Promise<any>}
 */
export function parseCustomPreferences(text, currentPreferences = {}) {
  if (typeof text !== 'string' || !text.trim() || text.trim().length > 500) {
    return Promise.reject(new ApiError({
      code: 4000,
      message: '请输入 1-500 字的个性化偏好',
      statusCode: 400,
    }))
  }
  return new Promise((resolve, reject) => {
    uni.request({
      url: `${BASE_URL}/api/preferences/parse`,
      method: 'POST',
      header: { 'content-type': 'application/json' },
      data: {
        user_id: MVP_USER_ID,
        text: text.trim(),
        current_preferences: currentPreferences,
      },
      success: (res) => mapSuccess(res, resolve, reject),
      fail: (err) => mapFail(err, reject),
    })
  })
}

/**
 * PUT /api/preferences —— PersonalProfilePage 专用更新入口
 *
 * 用途(specs/PersonalProfilePage.md §6.2 + §6.4.5 v0.2.0 扩):
 *   - 接受 3 字段:`interests` / `travel_pace` / `special_needs`
 *   - `gender` / `age_range` 后端无对应字段,走 `uni.setStorageSync` 本地存储(per §6.4.2)
 *   - 与 `OnboardingPage` 复用同一个 PUT 端点;Page 端**不**直接调用此函数,
 *     经由 `userStore.updateProfile(payload)` 走 store 层(spec §3.6 + §7.1 复用)
 *
 * v0.3.1(2026-06-28)PersonalProfilePage v0.2.0 扩展:
 *   - 签名由 `{ interests }` 扩展为 `{ interests, travel_pace, special_needs }`
 *   - 内部过滤 undefined 字段后转发 updatePreferences(沿 PUT partial-update 语义)
 *   - `travel_pace: null` / `special_needs: []` 仍携带(spec AC-17 显式允许)
 *
 * 实现:薄包装 `updatePreferences(payload)`,1:1 转发,保证 user_id 注入 + 错误映射与
 * `updatePreferences` 完全一致(复用 `ApiError` class + `mapSuccess/mapFail` helper)
 *
 * @param {{
 *   interests?: Array<import('../api/types').Interest>,
 *   travel_pace?: import('../api/types').TravelPace | null,
 *   special_needs?: Array<import('../api/types').SpecialNeed>,
 * }} body
 * @returns {Promise<{ code: 0, message: string, data: { updated: true } }>}
 * @throws  {ApiError}
 */
export function updateUserInfo(body) {
  // 过滤 undefined 字段(沿 PUT partial-update 语义,后端对未携带字段保持既有值)
  // null / [] 保留(per spec AC-17 显式允许空字段携带,后端保留语义待 backend 文档化)
  const payload = Object.fromEntries(
    Object.entries(body).filter(([, v]) => v !== undefined),
  )
  return updatePreferences(payload)
}
