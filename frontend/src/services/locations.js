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
// v0.5.0(2026-06-25)改造(per Cross-Page issue location-real-fix-v2-2026-06-25 §2.2):
//   - **删除** mock fallback:`PUT /api/locations` HTTP 失败(isNetworkError / 5xx)
//     不再静默降级到 `{code:0, message:'success (mock fallback)', data:{success:true}}`
//   - 失败一律抛 ApiError,由 page / store 层 best-effort 处理
//   - 删除 `isFallbackable()` 辅助函数(本服务不再需要 fallback 判定)
//   - 注:`USE_MOCK_FALLBACK` import 保留(从 services/config.js 导出,可能其他 helper 引用),
//     但本服务**不再使用**它做 fallback 决策
//   - 真接入高德(per cross-page issue §2.1):`utils/location.js` v0.4.1 显式条件编译 +
//     `manifest.modules.Amap: {}` + `sdkConfigs.amap.appid_android` 让 HBuilderX 云打包
//     时动态 bundle 高德 AAR,JS 层不感知
//
// 历史:
//   - v0.3.1(2026-06-11):新建(per integrate-r2)
//   - v0.5.0(2026-06-25):删 mock fallback(per Cross-Page issue location-real-fix-v2)

import { ApiError } from './preferences.js'
import { logger } from '../utils/logger.js'
import { BASE_URL, MVP_USER_ID } from './config.js'

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
 * PUT /api/locations —— 上报用户位置
 *
 * v0.5.0(per Cross-Page issue location-real-fix-v2-2026-06-25 §2.2):
 *   - HTTP `PUT /api/locations` body `{user_id, latitude, longitude, timestamp}` 直发
 *   - **失败不 mock fallback**(per user 2026-06-25 16:12 硬要求「坚决不能 mock 兜底」)
 *     - isNetworkError → reject ApiError(由 page / store best-effort 处理)
 *     - 5xx / 4xx     → reject ApiError
 *   - 公开 ApiResponse 形状 1:1 与后端契约对齐:`{code, message, data:{success}}`
 *
 * **定位能力不在本 service 内**(per integrate-r2 task 决策):
 *   - 本函数**只**接受 page 层已经获取到的 {latitude, longitude} 数字
 *   - 真正的定位能力由 page 层调 `uni.getLocation` / 高德 SDK 获取
 *   - 高德 Android SDK 由 `manifest.modules.Amap: {}` + `sdkConfigs.amap.appid_android`
 *     在 HBuilderX 云打包时动态 bundle,JS 层不感知(per cross-page issue §2.1)
 *
 * @param {object} payload
 * @param {number} payload.latitude   维度(WGS-84 / GCJ-02,看平台)
 * @param {number} payload.longitude  经度(WGS-84 / GCJ-02,看平台)
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
  })
  // 注:v0.5.0 起删除 .catch((httpErr) => { mock fallback }) 段
  // HTTP 失败由 uni.request 回调内 mapFail / mapSuccess 内部 reject ApiError,
  // Promise 链无后续处理,调用方 page / store 需 best-effort 处理(isNetworkError 不静默)。
}
