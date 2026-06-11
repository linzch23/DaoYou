import { createSSRApp } from 'vue'
import { createPinia } from 'pinia'
import App from './App.vue'
import { installMockInterceptor } from './utils/mockInterceptor.js'
import { initLocalDb } from './db/index.js'
import { logger } from './utils/logger.js'

// 启用 mock 拦截器(开发环境且未要求走真后端)
//
// 启用条件(均满足才装):
//   1. import.meta.env.DEV === true(只在 dev 启用)
//   2. window.__USE_REAL_API__ !== true(可手动 escape hatch)
//
// 生产 build 时 import.meta.env.DEV === false,下面 if 不进,
// mockInterceptor.js 的 import 在 tree-shake 后也会被去掉(无副作用)。
if (import.meta.env.DEV && typeof window !== 'undefined' && !window.__USE_REAL_API__) {
  installMockInterceptor(window.uni || uni)
  logger.info('[main] mock interceptor installed (dev only)')
}

// 初始化本地 DB(per issues/UI/UI-022-local-db-user.md 2026-06-06)
//
// 同步执行,db_users 为空时写 seed;同时初始化 db_trips / db_meta。
// mock 拦截器之后调用,确保 service 层走 DB 时 data 已 ready。
// dev / prod 均执行(mvp 阶段无后端,prod 同样依赖本地 DB;若后续接入真后端,
// 可加 `if (import.meta.env.DEV)` gate 限制只在 dev 启用)。
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

