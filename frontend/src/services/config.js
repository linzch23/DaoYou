// frontend/services/config.js
// 集中常量 —— 4 个 service 共用
//
// v0.3.0(2026-06-11)新增,per integrate-r1 task:
//   - BASE_URL       后端 API 根地址(原先每个 service 顶部重复定义)
//   - MVP_USER_ID    MVP 单用户固定为 1,service 内部注入,page / store 不感知
//   - USE_MOCK_FALLBACK  HTTP 失败时是否降级到 `api/mock/*` mock 数据
//                     默认 true;false 时 HTTP 失败直接 reject 给 store / page
//
// 引入方(per integrate-r1 §1):
//   - services/preferences.js
//   - services/home.js
//   - services/trips.js
//   - services/photos.js
//
// 部署口:
//   - 真后端部署时改 BASE_URL 即可;MVP 阶段 `window.__USE_REAL_API__` 在 main.js 决定是否装 mock 拦截器
//   - 拦截器关闭后,HTTP 真连后端,失败时本 fallback 链接管

/** @type {string} FastAPI 后端根地址(per docs/API接口文档.md §1 + 全项目 MVP 约定) */
export const BASE_URL = 'https://8.163.114.90'
// export const BASE_URL = 'http://localhost:8000'

/** @type {number} MVP 单用户固定 id,service 内部注入 */
export const MVP_USER_ID = 1

/**
 * HTTP 失败时是否降级到 `api/mock/*`(per integrate-r1 §1 决策)
 *
 * true(默认):HTTP isNetworkError / 5xx → 静默降级 mock → mock 失败才 reject
 * false:HTTP 任何失败 → 直接 reject(不降级 mock)
 *
 * 切换建议:
 *   - MVP 演示 / 后端未起 / demo 场景 → 留 true
 *   - 后端已部署且要严格线上行为 → 改 false(或 main.js 关掉 `__USE_REAL_API__`)
 */
export const USE_MOCK_FALLBACK = false
