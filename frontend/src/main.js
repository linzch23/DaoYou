import { createSSRApp } from 'vue'
import { createPinia } from 'pinia'
import App from './App.vue'
import { installMockInterceptor } from './utils/mockInterceptor.js'
import { initLocalDb } from './db/index.js'
import { logger } from './utils/logger.js'
import { USE_MOCK_FALLBACK } from './services/config.js'

// v0.3.0(2026-06-11):service 层改为 HTTP 优先 + mock/local-DB fallback
//
// 关键变化(per integrate-r1 task):
//   - 4 个 service(preferences / home / trips / photos)统一改为:
//     1) HTTP `uni.request` 真后端优先
//     2) HTTP 失败(isNetworkError / 5xx)→ 静默降级到 `api/mock/*` 的对应函数
//     3) preferences 还多 1 层:mock 失败 → 本地 DB
//   - trash 3 函数(listDeletedTrips / restoreTrashById / permanentlyDeleteTrip)
//     后端无对应端点,改走本地 DB(`src/db/index.js`),store 0 改动
//   - mock 拦截器仅在 `USE_MOCK_FALLBACK === true` 时启用(开发模式)
//   - `USE_MOCK_FALLBACK === false` 时直接走 HTTP,不拦截(prod 模式)

// 启用 mock 拦截器(开发环境且 USE_MOCK_FALLBACK=true)
//
// 启用条件(均满足才装):
//   1. USE_MOCK_FALLBACK === true(service 层会静默降级到 mock)
//   2. import.meta.env.DEV === true(只在 dev 启用)
//   3. window.__USE_REAL_API__ !== true(可手动 escape hatch)
//
// 当 USE_MOCK_FALLBACK=false 时(典型场景:prod 部署),mock 拦截器**不**安装,
// service 层走真后端,失败 → reject(不静默降级)。
//
// 开发者提示:若 dev 模式下想真连后端(而不是被 mock 拦截器截走),
// 在浏览器 console 执行 `window.__USE_REAL_API__ = true` 后刷新页面即可。
// 此时 mock 拦截器不装,service 层走真后端,失败时降级 mock(per USE_MOCK_FALLBACK)。
if (USE_MOCK_FALLBACK && import.meta.env.DEV && typeof window !== 'undefined' && !window.__USE_REAL_API__) {
  installMockInterceptor(window.uni || uni)
  logger.info('[main] mock interceptor installed (dev + USE_MOCK_FALLBACK=true)')
} else {
  logger.info('[main] mock interceptor disabled', {
    USE_MOCK_FALLBACK,
    isDev: import.meta.env.DEV,
  })
}

// 初始化本地 DB(per issues/UI/UI-022-local-db-user.md 2026-06-06)
//
// v0.3.0 仍保留:trash 3 函数(listDeletedTrips / restoreTrashById /
// permanentlyDeleteTrip)走本地 DB(`db/listTrips` / `db/patchTrip` 等),
// 必须 initLocalDb() 才能 seed 5 条演示 trip。
// 同步执行,db_users 为空时写 seed;同时初始化 db_trips / db_meta。
// dev / prod 均执行(本地 DB 是 trash 兜底的基础设施;若未来全部走真后端,
// 可加 `if (USE_MOCK_FALLBACK)` gate 限制只在 dev 启用)。
initLocalDb()

// Preview 模式:接受 URL query `?entry=xxx` 或 env `UNI_PREVIEW_ENTRY` 决定初始 page
//
// 用法 1:http://localhost:5173/?entry=home  → 启动后 reLaunch 到 pages/home/index
// 用法 2:UNI_PREVIEW_ENTRY=home npx uni  → 同上(便于 preview-all 脚本多 server 启动)
//
// 仅在 dev 启用;生产 build tree-shake 掉
if (import.meta.env.DEV && typeof window !== 'undefined') {
  // 优先级:URL query > env > 默认(pages.json 第一个)
  const params = new URLSearchParams(window.location.search)
  const queryEntry = params.get('entry')
  // env 通过 uni CLI 传入,但 Vite 在 dev 模式下不会暴露所有 env 到 import.meta.env
  // 用一个全局占位符方式(uni CLI 可以通过 -e 或 --mode 注入)
  // 这里简化为只读 URL query
  const entry = queryEntry
  if (entry) {
    // 等 App.onLaunch 跑完再 reLaunch
    setTimeout(() => {
      // reLaunch url 必须以 / 开头(绝对路径),否则被解析为相对路径拼接当前 page
      let targetPath = entry.startsWith('/') ? entry : (entry.startsWith('pages/') ? `/${entry}` : `/pages/${entry}/index`)
      // 透传其他 query 参数(除 entry 外),例如 ?entry=trip-detail&tripId=1
      // → reLaunch URL = /pages/trip-detail/index?tripId=1
      const extraParams = []
      for (const [k, v] of params.entries()) {
        if (k !== 'entry') extraParams.push(`${k}=${encodeURIComponent(v)}`)
      }
      if (extraParams.length > 0) {
        targetPath += `?${extraParams.join('&')}`
      }
      logger.info('[main] preview entry', { targetPath })
      if (window.uni?.reLaunch) {
        window.uni.reLaunch({ url: targetPath })
      }
    }, 200)
  }
}

export function createApp() {
  const app = createSSRApp(App)
  const pinia = createPinia()
  app.use(pinia)
  return { app, pinia }
}