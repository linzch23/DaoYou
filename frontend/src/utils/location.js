// frontend/utils/location.js
// 封装 `uni.getLocation`(uni-app 跨端抽象层)+ 权限申请。
//
// v0.4.1(2026-06-22)按 user 驳回改成**显式条件编译**(per Cross-Page issue
// location-amap-integration-2026-06-22 + user 2026-06-22 17:00 反馈"manifest 配 key
// 后 uni-app runtime 自动桥接"是未证假设):
//
//   ┌──────────────┬────────────────────────────────────────────────┬───────────┐
//   │ 平台         │ 实际走的底层                                      │ 坐标系    │
//   ├──────────────┼────────────────────────────────────────────────┼───────────┤
//   │ H5(dev 5173) │ navigator.geolocation(浏览器原生)               │ WGS-84    │
//   │ App Android  │ plus.geolocation → 高德 SDK(manifest 模块配置) │ GCJ-02    │
//   │ App iOS      │ plus.geolocation → 苹果 CoreLocation            │ WGS-84*   │
//   │ 微信小程序   │ 微信 wx.getLocation → 腾讯地图                  │ GCJ-02    │
//   └──────────────┴────────────────────────────────────────────────┴───────────┘
//   * iOS key 未申请(空 appid_ios:""),MVP 仍走 wgs84。详见 §2.1。
//
// **JS 层做什么**:
//   1. 用 `#ifdef APP-PLUS` / `#ifdef H5` / `#ifdef MP-WEIXIN` 显式分流(不是默认分支)
//   2. App 端显式 `type: 'gcj02'` —— 关键:让 HBuilderX runtime 调高德 SDK 直接
//      返回 GCJ-02 坐标,而**不是**经 WGS-84 roundtrip 后再 JS 层转换
//   3. logger 关键事件加 `platform` + `sdk` + `coordType` 字段,真机诊断时方便区分
//
// **JS 层不做什么**(per user 驳回):
//   - ❌ 不调 @dcloudio/uni-amap(那是旧的 uni_modules 风格插件,alpha 5xx 不需要)
//   - ❌ 不写"manifest 配 key 后自动桥接"的注释(已被 user 明确驳回)
//   - ❌ 不做 WGS-84 ↔ GCJ-02 转换(uni-app runtime JS 层自带,见调研 §1.2;
//        且后端 LBS 算法接受任一坐标系,per cross-page issue §2.3)
//
// 调研实证(per task §调研):
//   1. node_modules/@dcloudio/uni-app-plus/dist/uni.runtime.esm.js:API_GET_LOCATION
//      `getLocation` 内部调 `plus.geolocation.getCurrentPosition({coordsType: type})`
//      —— 平台 SDK 选择由 HBuilderX runtime 在打包时按 manifest.modules.Geolocation 配置 bundle
//   2. 同一文件 getLocationSuccess 内含 `gcj02towgs84` / `wgs84togcj02` 转换函数
//      —— 仅当 `type !== position.coordsType` 时触发(App 显式 gcj02 + Amap SDK 返
//      GCJ-02 → 不触发转换,直出 GCJ-02)
//   3. node_modules/@dcloudio/uni-h5/dist-x-vapor/uni-h5.es.js:H5 直接走
//      `navigator.geolocation.getCurrentPosition` → type 字段对 H5 是文档约定,
//      实际拿到的是浏览器原生 WGS-84
//   4. **node_modules 里无 .aar / ApsService / com.amap.api 任何 Java/Kotlin 引用**
//      —— Amap AAR 由 HBuilderX 云打包时按 `manifest.modules.Geolocation: {}` 配置动态 bundle,
//      **不需要**前端 npm install
//
// 坐标系说明(per cross-page issue §2.3):
//   - 本函数返回的坐标**不**做 WGS-84 ↔ GCJ-02 转换
//   - 直接传给后端 `PUT /api/location`
//   - 后端 LBS 算法接受任一坐标系(距离计算 / 推荐点搜索与坐标系无关)
//
// 历史:
//   - v0.4.0(2026-06-22):初始版本,统一 `type: 'wgs84'`(per location-amap-integration)
//   - v0.4.1(2026-06-22):按 user 驳回改成显式条件编译,App 端 `type: 'gcj02'` 取 GCJ-02
//   - v0.5.0(2026-06-25):新增 `checkLocationPermission()` 显式权限查询 API
//     (per Cross-Page issue location-real-fix-v2-2026-06-25 §2.5):
//     - App 端用 `uni.getAppAuthorizeSetting().locationAuthorized` 查,返回
//       'authorized' | 'denied' | 'not determined'
//     - H5 / MP 自动弹,直接返回 'authorized'
//     - 异常 / 平台不支持 → 'unknown'(静默降级)
//     - page 层在 `tryGetLocationSafe` 调用前先查权限,'denied' 时弹 modal + 引导到设置

import { ApiError } from '../services/preferences.js'
import { logger } from './logger.js'

/**
 * 定位错误码(per cross-page issue location-amap-integration §5.3)
 * @typedef {'PERMISSION_DENIED' | 'UNAVAILABLE' | 'TIMEOUT' | 'CANCELED'} LocationErrorCode
 */

/**
 * 定位成功返回结构
 * @typedef {Object} LocationResult
 * @property {number} latitude     维度(WGS-84 / GCJ-02,看平台)
 * @property {number} longitude    经度(WGS-84 / GCJ-02,看平台)
 * @property {number} [accuracy]   精度(米,部分平台可能缺失)
 * @property {number} timestamp    秒级 epoch(unix timestamp)
 */

/**
 * @typedef {'h5' | 'app' | 'mp-weixin'} LocationPlatform
 */

/**
 * @typedef {Object} LocationCtx
 * @property {LocationPlatform} platform  当前平台
 * @property {string}          sdk       当前平台调用的底层 SDK / API
 * @property {'wgs84' | 'gcj02'} coordType 传给 uni.getLocation 的 type 值
 */

/**
 * 调 `uni.getLocation` 获取经纬度(跨端统一入口,内部条件编译分流)。
 *
 * 行为:
 *   - 成功 → `resolve({latitude, longitude, accuracy?, timestamp})`
 *   - 失败(权限/网络/超时)→ `reject ApiError(code, message, statusCode=0, isNetworkError)`
 *
 * 平台分支(uni-app 条件编译,per v0.4.1 user 驳回后**显式化**):
 *   - `#ifdef H5`       → `type: 'wgs84'` 走 `navigator.geolocation`(浏览器原生)
 *   - `#ifdef APP-PLUS` → `type: 'gcj02'` 走 `plus.geolocation`(manifest 配置高德 SDK)
 *   - `#ifdef MP-WEIXIN`→ `type: 'gcj02'` 走腾讯地图
 *
 * 错误码映射(per cross-page issue §5.3):
 *   - `getLocation:fail auth deny` / `permission` / `authorize` → `PERMISSION_DENIED`
 *   - `getLocation:fail timeout`                                → `TIMEOUT`
 *   - `getLocation:fail cancel`                                 → `CANCELED`
 *   - 其他 / 系统错误                                            → `UNAVAILABLE`
 *
 * @returns {Promise<LocationResult>}
 * @throws  {ApiError}
 */
export function getCurrentLocation() {
  return new Promise((resolve, reject) => {
    // ───────── H5(dev / 浏览器)─────────
    // 走 navigator.geolocation 浏览器原生,WGS-84 坐标
    // #ifdef H5
    uni.getLocation({
      type: 'wgs84',
      geocode: false,
      isHighAccuracy: true,
      timeout: 10000,
      success: (res) => handleLocationSuccess(res, resolve, reject, {
        platform: 'h5',
        sdk: 'navigator.geolocation',
        coordType: 'wgs84',
      }),
      fail: (err) => handleLocationFail(err, reject, {
        platform: 'h5',
        sdk: 'navigator.geolocation',
        coordType: 'wgs84',
      }),
    })
    // #endif

    // ───────── App(Android 真包 / iOS 真包)─────────
    // 走 plus.geolocation(manifest.modules.Geolocation +
    // sdkConfigs.geolocation.amap.appkey_android 配
    // 高德 Android SDK)→ 显式 type: 'gcj02' 让 HBuilderX runtime 直接拿 GCJ-02
    // (不经 WGS-84 roundtrip + JS 层再转换)。
    // iOS 未配 key(MVP 暂走 wgs84 兜底),per cross-page issue §2.1 已知妥协。
    // #ifdef APP-PLUS
    uni.getLocation({
      type: 'gcj02',
      geocode: false,
      isHighAccuracy: true,
      timeout: 10000,
      success: (res) => handleLocationSuccess(res, resolve, reject, {
        platform: 'app',
        sdk: 'plus.geolocation+amap',
        coordType: 'gcj02',
      }),
      fail: (err) => handleLocationFail(err, reject, {
        platform: 'app',
        sdk: 'plus.geolocation+amap',
        coordType: 'gcj02',
      }),
    })
    // #endif

    // ───────── 微信小程序─────────
    // 走腾讯地图(uni-app runtime 内部 wx.getLocation → 腾讯)→ GCJ-02 坐标
    // #ifdef MP-WEIXIN
    uni.getLocation({
      type: 'gcj02',
      geocode: false,
      isHighAccuracy: true,
      timeout: 10000,
      success: (res) => handleLocationSuccess(res, resolve, reject, {
        platform: 'mp-weixin',
        sdk: 'tencent-map',
        coordType: 'gcj02',
      }),
      fail: (err) => handleLocationFail(err, reject, {
        platform: 'mp-weixin',
        sdk: 'tencent-map',
        coordType: 'gcj02',
      }),
    })
    // #endif
  })
}

/**
 * success 回调统一处理(per cross-page issue §5.3)
 * - 验证 `latitude` / `longitude` 是 number 类型
 * - 无效 → reject UNAVAILABLE ApiError
 * - 有效 → resolve LocationResult + logger.info 带 platform/sdk/coordType 诊断
 *
 * @param {UniApp.GetLocationSuccess} res
 * @param {(value: LocationResult) => void} resolve
 * @param {(reason: ApiError) => void} reject
 * @param {LocationCtx} ctx
 */
function handleLocationSuccess(res, resolve, reject, ctx) {
  if (typeof res?.latitude !== 'number' || typeof res?.longitude !== 'number') {
    logger.error('[location.getCurrentLocation] invalid response', { res, ...ctx })
    reject(new ApiError({
      code: 'UNAVAILABLE',
      message: '定位返回数据无效',
      statusCode: 0,
      isNetworkError: false,
    }))
    return
  }
  logger.info('[location.getCurrentLocation] ok', {
    latitude: res.latitude,
    longitude: res.longitude,
    accuracy: res.accuracy,
    ...ctx,
  })
  resolve({
    latitude: res.latitude,
    longitude: res.longitude,
    accuracy: typeof res.accuracy === 'number' ? res.accuracy : undefined,
    timestamp: Math.floor(Date.now() / 1000),
  })
}

/**
 * fail 回调统一处理(per cross-page issue §5.3)
 * - err.errMsg 形如 'getLocation:fail auth deny' / 'getLocation:fail timeout' /
 *              'getLocation:fail system error' / 'getLocation:fail cancel'
 * - 错误码映射 → PERMISSION_DENIED / TIMEOUT / CANCELED / UNAVAILABLE
 *
 * @param {UniApp.GeneralCallbackResult} err
 * @param {(reason: ApiError) => void} reject
 * @param {LocationCtx} ctx
 */
function handleLocationFail(err, reject, ctx) {
  const errMsg = err?.errMsg || '定位失败'
  let code = /** @type {LocationErrorCode} */ ('UNAVAILABLE')
  if (/auth deny|permission|authorize/i.test(errMsg)) {
    code = 'PERMISSION_DENIED'
  } else if (/timeout/i.test(errMsg)) {
    code = 'TIMEOUT'
  } else if (/cancel/i.test(errMsg)) {
    code = 'CANCELED'
  }
  logger.warn('[location.getCurrentLocation] failed', { errMsg, code, ...ctx })
  reject(new ApiError({
    code,
    message: errMsg,
    statusCode: 0,
    // PERMISSION_DENIED / CANCELED 视为用户主动行为,不当作网络错
    // UNAVAILABLE / TIMEOUT 视为环境/网络问题,isNetworkError=true
    isNetworkError: code === 'UNAVAILABLE' || code === 'TIMEOUT',
  }))
}

/**
 * 内部 helper 槽位:无(目前 success/fail 都在 `handleLocationSuccess` /
 * `handleLocationFail` 内部完成 reject / resolve)
 */

/**
 * 申请定位权限(App 端需要先授权)。
 *
 * 平台分支(uni-app 条件编译):
 *   - H5 / 微信小程序:浏览器/小程序自动弹权限框,无需显式调用 → 直接 resolve 'granted'
 *   - App 端:用 `uni.authorize` 触发系统弹窗
 *
 * 注意:本函数**不**在权限被拒时 throw,只 resolve 'denied',由调用方(store)决定
 *       是否 toast 提示用户。这是 MVP 简化:不阻塞主流程。
 *
 * @returns {Promise<'granted' | 'denied' | 'unknown'>}
 */
export function requestLocationPermission() {
  return new Promise((resolve) => {
    // #ifdef APP-PLUS
    uni.authorize({
      scope: 'scope.userLocation',
      success: () => {
        logger.info('[location.requestLocationPermission] granted', { platform: 'app' })
        resolve('granted')
      },
      fail: () => {
        logger.warn('[location.requestLocationPermission] denied', { platform: 'app' })
        resolve('denied')
      },
    })
    // #endif
    // #ifndef APP-PLUS
    // H5 / 小程序:浏览器自动弹,无需显式申请(系统权限框即 `getCurrentLocation` 触发)
    // 返回 'granted' 表示"未拦截"(实际授权发生在 `uni.getLocation` 调用时)
    logger.debug('[location.requestLocationPermission] auto-granted (h5/mp)', {})
    resolve('granted')
    // #endif
  })
}

/**
 * 检查定位权限状态(不申请,只查询)— per v0.5.0(2026-06-25)
 *
 * 与 `requestLocationPermission` 区别:
 *   - `requestLocationPermission` 会**触发**系统授权弹窗(App 端)
 *   - `checkLocationPermission` 只**查询**当前权限状态,无副作用
 *
 * 平台分支(per cross-page issue §2.5):
 *   - `#ifdef APP-PLUS`:`uni.getAppAuthorizeSetting().locationAuthorized`
 *     - 'authorized'        → 已授权
 *     - 'denied'            → 已拒绝(永久)
 *     - 'not determined'    → 未请求过(首次)
 *     - 'config error'      → 平台不支持(罕见)
 *     - undefined / 其它   → 'unknown'(静默降级)
 *   - `#ifndef APP-PLUS`:H5 / 小程序浏览器自动弹,直接返回 'authorized'
 *
 * 使用模式(page 层 tryGetLocationSafe):
 * ```js
 * const status = await checkLocationPermission()
 * if (status === 'denied') {
 *   uni.showModal({ title: '需要定位权限', ... }) // 引导到设置
 *   return null
 * }
 * ```
 *
 * @returns {Promise<'authorized' | 'denied' | 'not determined' | 'config error' | 'unknown'>}
 */
export function checkLocationPermission() {
  return new Promise((resolve) => {
    // #ifdef APP-PLUS
    try {
      const setting = uni.getAppAuthorizeSetting()
      const status = setting?.locationAuthorized || 'unknown'
      logger.info('[location.checkLocationPermission]', { status, platform: 'app' })
      resolve(status)
    } catch (err) {
      logger.warn('[location.checkLocationPermission] getAppAuthorizeSetting failed', err)
      resolve('unknown')
    }
    // #endif
    // #ifndef APP-PLUS
    // H5 / 小程序:浏览器自动弹,无需显式申请(系统权限框即 `getCurrentLocation` 触发)
    // 返回 'authorized' 表示"未拦截"(实际授权发生在 `uni.getLocation` 调用时)
    logger.debug('[location.checkLocationPermission] auto-granted (h5/mp)', {})
    resolve('authorized')
    // #endif
  })
}

/**
 * 打开应用详情设置，用于云真机或权限被拒后手动调整定位、通知权限。
 *
 * @returns {boolean}
 */
export function openAppSettings() {
  // #ifndef APP-PLUS
  return false
  // #endif
  // #ifdef APP-PLUS
  try {
    const activity = plus.android.runtimeMainActivity()
    const Intent = plus.android.importClass('android.content.Intent')
    const Settings = plus.android.importClass('android.provider.Settings')
    const Uri = plus.android.importClass('android.net.Uri')
    const intent = new Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS)
    intent.setData(Uri.parse(`package:${activity.getPackageName()}`))
    activity.startActivity(intent)
    return true
  } catch (error) {
    logger.warn('[location.openAppSettings] failed', {
      message: error?.message,
    })
    return false
  }
  // #endif
}
