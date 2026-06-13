// frontend/services/locations.js
// 封装 docs/API接口文档.md §X 定位上报接口
//
//   PUT /api/locations  → updateLocation({latitude, longitude, timestamp?})
//
// MVP 约定(见 docs/API接口文档.md §1.3):
//   - `user_id` 固定为 1,前端不感知(service 内部注入)
//   - Base URL 默认为 http://localhost:8000
//
// **定位能力不在本 service 内**(per integrate-r2 task 决策):
//   - 本函数**只**接受 page 层已经获取到的 {latitude, longitude} 数字
//   - 真正的定位能力由 page 层调 `uni.getLocation` / 未来高德 SDK 获取
//   - MVP 阶段**不**接高德 SDK(per hard constraint 「不接高德 SDK」)
//   - 若未来需更高精度,IssueManager 提议在 manifest.json 配高德 key +
//     引入 `@dcloudio/uni-amap` 插件
//
// 失败映射(spec §6.1 Error 表 + 本函数 MVP 简化):
//   - 400 / 4000 → 参数非法
//   - 5xx / 5000 → 服务端错误
//   - fail 回调  → 网络断开(isNetworkError=true)
//
// v0.3.1(2026-06-11)新增(per integrate-r2 task):
//   - 1) HTTP `PUT /api/locations` body `{user_id, latitude, longitude, timestamp}` 优先
//   - 2) HTTP 失败(isNetworkError / 5xx)→ 静默降级到 `mockInterceptor` 拦截的 mock
//     (`PUT /api/locations` mock handler 已在 mockInterceptor.js 注册,返回
//     `{code:0, message:'success', data:{success:true}}`)
//   - 3) 公开 ApiResponse 形状 1:1 与后端契约对齐:
//     `{code:0, message:'success', data:{success:true}}`
//   - 注:本 service **不**直接 import mock(沿 `services/trips.js` / `services/preferences.js`
//     惯例:mock 由 mockInterceptor 自动拦截 uni.request,service 层不感知)
//
// 历史:
//   - v0.3.1(2026-06-11):新建(per integrate-r2)

import { ApiError } from './preferences.js'
import { logger } from '../utils/logger.js'
import { BASE_URL, MVP_USER_ID, USE_MOCK_FALLBACK } from './config.js'

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
 * 5xx 触发 mock fallback 是**显式策略**:后端 PUT /api/locations 当前**未 mount** 到
 * router(per integrate-r2 后端实测),MVP 阶段 dev 模式下 mock 拦截器会接住
 * PUT /api/locations → 返回 `{success:true}`,**不**走 404 路径(因为 mock 拦在
 * HTTP 之前,根本不打后端);prod 模式下 `USE_MOCK_FALLBACK=false` + 后端实装后
 * `__USE_REAL_API__` escape hatch 启用 → 走真后端,5xx/网络错仍走 fallback 链
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
 * PUT /api/locations —— 上报用户位置
 *
 * v0.3.1(per integrate-r2 task):
 *   - 1) HTTP `PUT /api/locations` body `{user_id, latitude, longitude, timestamp}` 优先
 *   - 2) HTTP 失败(isNetworkError / 5xx)→ 静默降级到 mock(mockInterceptor 拦截)
 *   - 公开 ApiResponse 形状 1:1 与后端契约对齐:`{code, message, data:{success}}`
 *
 * **定位能力不在本 service 内**(per integrate-r2 task 决策):
 *   - 本函数**只**接受 page 层已经获取到的 {latitude, longitude} 数字
 *   - 真正的定位能力由 page 层调 `uni.getLocation` / 未来高德 SDK 获取
 *   - MVP 阶段**不**接高德 SDK(per hard constraint)
 *   - 若未来需更高精度,IssueManager 提议在 manifest.json 配高德 key +
 *     引入 `@dcloudio/uni-amap` 插件
 *
 * @param {object} payload
 * @param {number} payload.latitude   维度(WGS-84)
 * @param {number} payload.longitude  经度(WGS-84)
 * @param {number} [payload.timestamp] 秒级时间戳(不传则内部用 Math.floor(Date.now()/1000))
 * @returns {Promise<import('../api/types').LocationUpdateResponse>}
 * @throws  {ApiError}
 */
export function updateLocation(payload) {
  return new Promise((resolve, reject) => {
    if (!payload
      || typeof payload.latitude !== 'number'
      || typeof payload.longitude !== 'number'
      || !Number.isFinite(payload.latitude)
      || !Number.isFinite(payload.longitude)
    ) {
      return reject(new ApiError({
        code: 4000,
        message: '参数非法:latitude / longitude 必须为有限数字',
        statusCode: 400,
      }))
    }
    const timestamp = Number.isFinite(payload.timestamp)
      ? payload.timestamp
      : Math.floor(Date.now() / 1000)
    uni.request({
      // v0.3.1 fix:后端 router.py:7 mount 为单数 prefix="/location",非 spec 复数 "/api/locations"
      // 1-line fix by orchestrator 2026-06-11 13:20,per integrate-r2 后端实测契约
      url: `${BASE_URL}/api/location`,
      method: 'PUT',
      header: { 'content-type': 'application/json' },
      data: {
        user_id: MVP_USER_ID,
        latitude: payload.latitude,
        longitude: payload.longitude,
        timestamp,
      },
      success: (res) => mapSuccess(res, resolve, reject),
      fail: (err) => mapFail(err, reject),
    })
  }).catch((httpErr) => {
    // 不可 fallback 的错误(4xx 业务错)直接 reject
    if (!isFallbackable(httpErr)) {
      return Promise.reject(httpErr)
    }
    // 降级到 mock(mvp 阶段 mock 拦截器会接住 PUT /api/locations → 返 {success:true};
    // 如果拦截器没装(USE_MOCK_FALLBACK=false),isFallbackable 已在上一步返回 false)
    logger.warn('[locations.updateLocation] HTTP failed, fallback to mock', {
      isNetworkError: httpErr.isNetworkError,
      statusCode: httpErr.statusCode,
    })
    // 显式构造 mock 响应(若拦截器未装 + 5xx 双重降级,此处兜底)
    return Promise.resolve({
      code: 0,
      message: 'success (mock fallback)',
      data: { success: true },
    })
  })
}
