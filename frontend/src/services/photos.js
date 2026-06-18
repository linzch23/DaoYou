// frontend/services/photos.js
// 封装 docs/API接口文档.md §8.1 拍照讲解接口
//
//   POST /api/photos/explain (multipart/form-data) → explainPhoto(req)
//
// MVP 约定(见 docs/API接口文档.md §1.3):
//   - `user_id` 固定为 1,前端不感知
//   - Base URL 默认为 http://localhost:8000
//
// 入参形状(spec §6.1):
//   { image: string (本地临时路径) }
//
// formData 内部注入(per spec §6.1 + §7.3):
//   - `user_id = MVP_USER_ID` 服务端识别
//   - `image` 走 `uni.uploadFile({ filePath, name: 'image' })` 单独字段(uni.uploadFile 自动 multipart 编码)
//
// 重要不传字段(spec §6.3.2 + §6.3.3):
//   - **不**传 `history` 字段(追问循环复用 photo_id 关联会话,后端按 photo_id 拿历史)
//   - **不**传 `current_location` 字段(MVP 阶段无定位权限,不传避免假数据)
//
// 失败映射(spec §6.1 Error 表):
//   - 400 / 4000 / 4002 → 参数非法 / 文件上传失败(errorBadRequest)
//   - 401                  → 全局拦截器跳登录(本页不感知,errorNetwork 兜底)
//   - 404 / 4001           → 资源不存在(本页不直接调 GET,errorFallback 兜底)
//   - 5xx / 5000           → 服务端错误(errorServer)
//   - 5001                 → LLM 错误(errorLLM,本页面专属)
//   - fail 回调            → 网络断开(isNetworkError=true,errorNetwork)
//   - 上传超时(> 30s)     → 由页面 setTimeout 兜底触发,本服务不感知(errorUploadTimeout)
//
// v0.3.0(2026-06-11)改造(per integrate-r1 task):
//   - `explainPhoto(req)` 加 mock fallback → `api/mock/photos` 的 `photoExplainMock`
//   - HTTP 失败(isNetworkError / 5xx)→ 静默降级到 mock
//   - 本地缓存函数(`saveGuideResult` / `getGuideResult` / `clearGuideResult` /
//     `loadGuideResults`)0 改动,继续走 storage
//   - `BASE_URL` / `MVP_USER_ID` / `UPLOAD_TIMEOUT_MS` 改 import 自 `services/config.js`

import { ApiError } from './preferences.js'
import { logger } from '../utils/logger.js'
import { BASE_URL, MVP_USER_ID, USE_MOCK_FALLBACK } from './config.js'
import { photoExplainMock } from '../../api/mock/photos.ts'

const UPLOAD_TIMEOUT_MS = 30000 // 30s 上传超时,per spec §1 + §5.2 + §6.1

/**
 * PhotoGuideData 响应 data 形状(spec §6.1 + api/types.ts:30-33)
 * @typedef {Object} PhotoExplainData
 * @property {number} photo_id
 * @property {string} image_path
 * @property {string} recognition_result
 * @property {string} explanation
 * @property {string[]} follow_up_questions
 */

/**
 * @typedef {import('../api/types').ApiResponse<PhotoExplainData>} PhotoExplainResponse
 */

/**
 * @typedef {Object} ExplainPhotoRequest
 * @property {string} image     本地图片临时路径(由 uni.chooseImage 返回的 tempFilePaths[0])
 */

/**
 * 将 uni.uploadFile fail 回调映射为 ApiError
 * @param {UniApp.GeneralCallbackResult | undefined} err
 * @param {(reason: ApiError) => void} reject
 */
function mapUploadError(err, reject) {
  reject(new ApiError({
    code: null,
    message: err?.errMsg || '网络异常,请检查网络连接',
    statusCode: 0,
    isNetworkError: true,
  }))
}

/**
 * 将 uni.uploadFile success 回调 + body 映射为 (resolve, reject) 形态
 *
 * 与 `services/preferences.js:52` `mapSuccess` / `services/trips.js:50` `mapSuccess`
 * **不**直接 import,因为:
 *   1) `uni.uploadFile({ success })` 回调入参是 `UploadFileSuccessCallbackResult`,
 *      data 是 `string` 形态(JSON 字符串,需 `JSON.parse` 解码),与
 *      `UniApp.RequestSuccessCallbackResult.data: any` 不同
 *   2) spec §7.3 显式要求本服务**独立实现** upload 回调映射(per §6.1 备注)
 *
 * @param {UniApp.UploadFileSuccessCallbackResult | any} res
 * @param {(value: PhotoExplainResponse) => void} resolve
 * @param {(reason: ApiError) => void} reject
 */
function mapUploadSuccess(res, resolve, reject) {
  // uni.uploadFile 回调里 statusCode 是 number(与 uni.request 同语义)
  const statusCode = typeof res?.statusCode === 'number' ? res.statusCode : 0
  let body = null
  // res.data 是 string(JSON),需要 parse
  if (typeof res?.data === 'string' && res.data) {
    try {
      body = JSON.parse(res.data)
    } catch (err) {
      logger.warn('[photos.explainPhoto] response JSON parse failed', err)
      body = null
    }
  } else if (res?.data && typeof res.data === 'object') {
    body = res.data
  }
  if (statusCode >= 200 && statusCode < 300) {
    if (body && body.code === 0) {
      resolve(body)
    } else {
      reject(new ApiError({
        code: body?.code ?? null,
        message: body?.message || '业务处理失败',
        statusCode,
      }))
    }
  } else {
    reject(new ApiError({
      code: body?.code ?? null,
      message: body?.message || `HTTP ${statusCode}`,
      statusCode,
    }))
  }
}

/**
 * POST /api/photos/explain —— 拍照讲解(multipart/form-data)
 *
 * v0.3.0(per integrate-r1 task):
 *   - 1) HTTP `uni.uploadFile POST /api/photos/explain` 优先
 *   - 2) HTTP 失败(isNetworkError / 5xx)→ 静默降级到 `photoExplainMock`
 *   - 注:mock 端 `photoExplainMock.data` 是固定 4 块演示数据;**不**写真实 image_path,
 *     调用方 `saveGuideResult` 时按 mock 形态缓存
 *   - 入参校验失败 → 直接 reject(不走 fallback,沿用 spec §7.3)
 *
 * 入参(per spec §6.1):
 *   - image:   本地图片临时路径(uni.chooseImage 返回的 tempFilePaths[0])
 *
 * 内部处理:
 *   - formData 注入 `user_id = MVP_USER_ID`(前端不感知,沿用项目 MVP 约定)
 *   - image 走 `uni.uploadFile({ filePath, name: 'image' })` 单独字段
 *   - **不**传 `current_location`(spec §6.3.3)
 *   - **不**传 `history`(spec §6.3.2 追问循环复用 photo_id 关联)
 *   - 30s 上传超时(spec §1 + §5.2)
 *
 * 错误归一(沿用 `services/preferences.ApiError` class):
 *   - 4000 / 400 / 4002 → 参数非法 / 文件上传失败
 *   - 5000 / 5xx         → 服务端错误
 *   - 5001               → LLM 错误
 *   - isNetworkError     → 网络断开 / fail 回调
 *   - 兜底 5xx / 4001    → 系统错误
 *
 * 错误映射**不**在本服务做(只暴露 ApiError,原因见 spec §6.1 备注),
 * 由 `pages/photo-guide/index.vue` 内 `mapAnalyzeError` / `mapChatError` 处理。
 *
 * @param {ExplainPhotoRequest} req
 * @returns {Promise<PhotoExplainResponse>}
 * @throws  {ApiError}
 */
export function explainPhoto(req) {
  // 入参校验(避免 uni.uploadFile 起飞后才报错,减少 30s 浪费)
  if (!req || typeof req !== 'object') {
    return Promise.reject(new ApiError({
      code: 4000,
      message: '请求参数不能为空',
      statusCode: 400,
    }))
  }
  if (typeof req.image !== 'string' || !req.image) {
    return Promise.reject(new ApiError({
      code: 4000,
      message: 'image 路径不能为空',
      statusCode: 400,
    }))
  }
  return new Promise((resolve, reject) => {
    uni.uploadFile({
      url: `${BASE_URL}/api/photos/explain`,
      filePath: req.image,
      name: 'image',
      formData: {
        user_id: MVP_USER_ID,
        // **不**含 trip_id(spec §9.1 后端不接)
        // **不**含 style(spec §9.1 后端不接)
        // **不**含 current_location(spec §6.3.3 MVP 不传,接高德 SDK 时再开)
        // **不**含 history(spec §6.3.2 追问循环复用 photo_id 关联)
      },
      timeout: UPLOAD_TIMEOUT_MS,
      success: (res) => mapUploadSuccess(res, resolve, reject),
      fail: (err) => mapUploadError(err, reject),
    })
  }).catch((httpErr) => {
    // HTTP 失败 → mock fallback(isNetworkError / 5xx)
    if (httpErr instanceof ApiError && (
      httpErr.isNetworkError === true
      || (httpErr.statusCode >= 500 && httpErr.statusCode < 600)
    ) && USE_MOCK_FALLBACK) {
      logger.warn('[photos.explainPhoto] HTTP failed, fallback to mock', {
        isNetworkError: httpErr.isNetworkError,
        statusCode: httpErr.statusCode,
      })
      return Promise.resolve(photoExplainMock)
    }
    // 4xx 业务错或 USE_MOCK_FALLBACK=false → 直接 reject
    return Promise.reject(httpErr)
  })
}

// ───────────────── GuideResultPage 本地缓存层(specs/GuideResultPage.md §4.5 + §6.0) ─────────────────
//
// 背景(spec §6.4.1 PD-001):GET /api/photos/{photoId} 不存在 → 走本地缓存
//   uni.setStorageSync('guide_results', { [photo_id]: PhotoExplainData })
// 写入方:PhotoGuidePage 完成讲解时(per spec §5.5 配套 + C-7 元决策)
// 读取方:GuideResultPage onLoad 后异步 getGuideResult(photoId)
//
// MVP 简化(per spec §4.5):
//   - 覆盖式:同 photo_id 多次讲解以最后一次为准
//   - **不**实现 LRU(超出 20 条由 Vue/uni-app GC 兜底;若未来需要由 IssueManager 提议)
//   - 异常静默降级 + logger.warn,不抛错阻塞 UI
//
// 复用约定(spec §10 C-2):
//   - 复用 `ApiError` class(从 services/preferences.js import,跨域复用)
//   - 复用 `logger`(utils/logger.js)

/** 本地缓存 storage key(沿用 spec §4.5 约定) */
const GUIDE_RESULTS_STORAGE_KEY = 'guide_results'

/**
 * 读全部 guide_results 字典(spec §6.0)
 * 异常静默降级,返回空对象
 * @returns {Record<string, unknown>}
 */
export function loadGuideResults() {
  let cache = {}
  try {
    const raw = uni.getStorageSync(GUIDE_RESULTS_STORAGE_KEY)
    if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
      cache = raw
    }
  } catch (err) {
    logger.warn('[photos.loadGuideResults] storage read failed', err)
    cache = {}
  }
  return cache
}

/**
 * 写一条 guide_results(覆盖式)
 * PhotoGuidePage 完成讲解时(per spec §5.5 + C-7)调一次
 *
 * 异常静默降级 + logger.warn(spec §4.5 + HomePage §8.1 favorites 模式);
 * 失败不影响调用方流程(best-effort)
 *
 * @param {PhotoExplainData} data
 * @returns {boolean} true 写入成功;false 失败(供调用方决定是否 toast)
 */
export function saveGuideResult(data) {
  if (!data || typeof data !== 'object' || typeof data.photo_id !== 'number') {
    logger.warn('[photos.saveGuideResult] invalid data', { data })
    return false
  }
  try {
    const all = loadGuideResults()
    all[String(data.photo_id)] = data
    uni.setStorageSync(GUIDE_RESULTS_STORAGE_KEY, all)
    logger.info('[photos.saveGuideResult] ok', { photo_id: data.photo_id })
    return true
  } catch (err) {
    logger.warn('[photos.saveGuideResult] storage write failed', err)
    return false
  }
}

/**
 * 读单条 guide_result(per spec §6.0)
 * - photoId 无效(非数字/<=0)→ reject ApiError(4000)
 * - 缓存 miss → resolve(null)
 * - 缓存命中 + 形状校验通过 → resolve(data)
 * - 缓存命中 + 形状损坏 → resolve(null) + logger.warn
 * - storage read 抛错 → resolve(null) + logger.warn
 *
 * @param {number} photoId
 * @returns {Promise<PhotoExplainData | null>}
 * @throws {ApiError} 仅 photoId 无效时 reject
 */
export function getGuideResult(photoId) {
  return new Promise((resolve, reject) => {
    if (typeof photoId !== 'number' || !Number.isFinite(photoId) || photoId <= 0) {
      reject(new ApiError({
        code: 4000,
        message: 'photoId 必须为正整数',
        statusCode: 400,
      }))
      return
    }
    const all = loadGuideResults()
    const data = all[String(photoId)]
    if (!data || typeof data !== 'object') {
      // cache miss
      resolve(null)
      return
    }
    // 形状校验(避免 storage 损坏导致后续渲染异常)
    if (
      typeof data.photo_id === 'number'
      && typeof data.image_path === 'string'
      && typeof data.recognition_result === 'string'
      && typeof data.explanation === 'string'
      && Array.isArray(data.follow_up_questions)
      && data.photo_id === photoId
    ) {
      resolve(/** @type {PhotoExplainData} */ (data))
      return
    }
    // 缓存损坏,降级为 cache miss
    logger.warn('[photos.getGuideResult] cache corrupted for photoId', { photoId })
    resolve(null)
  })
}

/**
 * 清单条 guide_result(spec §4.5 MVP 可选,本页面不调用,留接口)
 * 异常静默降级 + logger.warn
 * @param {number} photoId
 * @returns {boolean} true 清理成功;false 失败
 */
export function clearGuideResult(photoId) {
  if (typeof photoId !== 'number' || !Number.isFinite(photoId) || photoId <= 0) {
    return false
  }
  try {
    const all = loadGuideResults()
    delete all[String(photoId)]
    uni.setStorageSync(GUIDE_RESULTS_STORAGE_KEY, all)
    logger.info('[photos.clearGuideResult] ok', { photoId })
    return true
  } catch (err) {
    logger.warn('[photos.clearGuideResult] storage write failed', err)
    return false
  }
}
