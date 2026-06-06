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
//   **前端不替用户保留其它字段**(explanation_style / travel_pace / special_needs),
//   这些由 PersonalProfilePage / StyleSettingPage 各自负责。
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
// 改造历史(per issues/UI/UI-022-local-db-user.md 2026-06-06):
//   - v0.2.0(2026-06-06):getPreferences / updatePreferences 改走本地 DB
//     (`src/db/index.js`),mock 拦截器仅作 fallback / 调试用
//   - Public ApiResponse 形状保持不变(`data.preferences` / `data.updated`),
//     userStore 0 改动
//   - `ApiError` class + `mapSuccess` / `mapFail` 保留,跨 service 复用
//     (`services/home.js` / `services/photos.js` / `services/trips.js` /
//     `stores/homeStore.js` / `stores/trashStore.js` 都 import 此处)

import { getUser as dbGetUser, updateUser as dbUpdateUser } from '../db/index.js'

const BASE_URL = 'http://localhost:8000'
const MVP_USER_ID = 1

/**
 * 业务错误 —— 携带 code / statusCode / isNetworkError
 * 页面据此映射到友好提示(spec §6.1 Error 表)
 */
export class ApiError extends Error {
  constructor({ code, message, statusCode, isNetworkError }) {
    super(message || 'API 请求失败')
    this.name = 'ApiError'
    /** @type {number | null} 后端业务 code;网络断开时为 null */
    this.code = code ?? null
    /** @type {number} HTTP status;网络断开时为 0 */
    this.statusCode = statusCode ?? 0
    /** @type {boolean} true = uni.request fail(网络断开 / 超时) */
    this.isNetworkError = !!isNetworkError
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
 * PUT /api/preferences —— 更新用户偏好
 *
 * 实现(per issue UI-022 v0.2.0):
 *   - 不再走 `uni.request` + mock 拦截器,改走本地 DB(`db/updateUser`)
 *   - Public return shape 保持 `{ code: 0, message: 'success', data: { updated: true } }`,
 *     userStore 0 改动
 *   - PATCH 语义:`db/updateUser` 仅合并传入字段,未携带字段保留
 *
 * @param {object} payload 完整或部分 Preferences(spec §7.2 形状)
 *   例:{ interests: ['history', 'photo'] }   ← OnboardingPage 唯一用法
 * @returns {Promise<{ code: 0, message: string, data: { updated: true } }>}
 * @throws  {Error} dev 期硬错误:userId 不在 DB / storage 写失败
 *                (替代原 `ApiError` 网络异常,本路径下不会触发)
 */
export function updatePreferences(payload) {
  return new Promise((resolve, reject) => {
    try {
      dbUpdateUser(String(MVP_USER_ID), payload)
      resolve({ code: 0, message: 'success', data: { updated: true } })
    } catch (err) {
      reject(err)
    }
  })
}

/**
 * PUT /api/preferences —— PersonalProfilePage 专用更新入口
 *
 * 用途(specs/PersonalProfilePage.md §6.2 + §6.4.1 PD-001 决策):
 *   - 只更新 `interests` 字段(后端 Preferences 4 字段,本页面**仅**传 interests)
 *   - `gender` / `age_range` 后端无对应字段,走 `uni.setStorageSync` 本地存储(per §6.4.2)
 *   - 与 `OnboardingPage` 复用同一个 PUT 端点;Page 端**不**直接调用此函数,
 *     经由 `userStore.updateProfile({ interests })` 走 store 层(spec §3.6 + §7.1 复用)
 *
 * 实现:薄包装 `updatePreferences(payload)`,1:1 转发,保证 user_id 注入 + 错误映射与
 * `updatePreferences` 完全一致(复用 `ApiError` class + `mapSuccess/mapFail` helper)
 *
 * @param {{ interests: Array<import('../api/types').Interest> }} body
 * @returns {Promise<{ code: 0, message: string, data: { updated: true } }>}
 * @throws  {ApiError}
 */
export function updateUserInfo({ interests }) {
  return updatePreferences({ interests })
}

/**
 * GET /api/preferences —— 查询用户偏好
 *
 * 实现(per issue UI-022 v0.2.0):
 *   - 不再走 `uni.request` + mock 拦截器,改走本地 DB(`db/getUser`)
 *   - Public return shape 保持 `{ code: 0, message: 'success', data: { preferences: Preferences } }`,
 *     userStore 0 改动(`res.data.preferences` 仍命中)
 *   - DB 中 user 包含 4 个偏好字段(`explanation_style` / `travel_pace` / `interests` /
 *     `special_needs`) + 3 个衍生字段(`id` / `nickname` / `avatarEmoji` / `createdAt`),
 *     此处**只**返回 4 个偏好字段(保持原 `ApiResponse<{ preferences: Preferences }>` 形态)
 *
 * @returns {Promise<{ code: 0, message: string, data: { preferences: Preferences } }>}
 * @throws  {Error} dev 期硬错误:userId 不在 seed
 */
export function getPreferences() {
  return new Promise((resolve, reject) => {
    try {
      const user = dbGetUser(String(MVP_USER_ID))
      // 4 个偏好字段(对齐 api/types.ts:Preferences + 旧 `preferencesMock` 形状)
      const preferences = {
        explanation_style: user.explanation_style,
        travel_pace: user.travel_pace,
        interests: user.interests,
        special_needs: user.special_needs,
      }
      resolve({ code: 0, message: 'success', data: { preferences } })
    } catch (err) {
      reject(err)
    }
  })
}
