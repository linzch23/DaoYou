// frontend/stores/homeStore.js
// 首页域 Pinia store —— 唯一 owner of `today` / `trips` / `error` / `lastFetchedAt`
//
// Spec contract: specs/HomePage.md §7.1
//
// state
//   today             : TodayData | null
//   isFetchingToday   : boolean
//   trips             : TripSummary[]
//   isFetchingTrips   : boolean
//   error             : ErrorInfo | null
//   lastFetchedAt     : string | null(ISO 8601)
//   activeReminder    : Reminder | null    # v0.4.0 §6.5.4 新增
//   isCheckingReminders: boolean          # v0.4.0 §6.5.4 新增(互斥锁,仅 store 内部用)
//
// getter
//   hasActiveOrUpcomingTrip : boolean    today !== null
//   unreadCount             : number     today?.unread_reminders ?? 0
//   hasActiveReminder       : boolean    # v0.4.0 §6.5.7.1 新增;activeReminder !== null
//
// action
//   fetchTrips()    : Promise<void>      GET /api/trips
//   fetchToday()    : Promise<void>      内部依赖 trips 选 date,再 GET /api/home/today
//   refreshAll()    : Promise<void>      先刷新 trips,再基于 active trip 拉今日行程
//   markSpotVisited(itemId) : Promise<void>   乐观更新 status='done'(MVP 不发远端)
//   clearHome()     : void               登出场景
//   triggerRemindersCheck() : Promise<void>  # v0.4.0 §6.5.7.2 新增;best-effort POST /api/reminders/check
//   dismissReminder() : void             # v0.4.0 §6.5.7.2 新增;清 activeReminder(不调 API / 不持久化)
//
// 4 态决策(交给页面,不在 store 内部决定):
//   page.compute viewMode(store.today, store.trips) → 'diary' | 'trips' | 'empty'

import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import {
  getToday as svcGetToday,
  listTrips as svcListTrips,
} from '../services/home.js'
import { checkReminders as svcCheckReminders } from '../services/reminders.js'
import { deleteTrip as svcDeleteTrip } from '../services/trips.js'
import { ApiError } from '../services/preferences.js'
import { logger } from '../utils/logger.js'

/**
 * @typedef {import('../api/types').TripItem} TripItem
 * @typedef {import('../api/types').TripSummary} TripSummary
 * @typedef {import('../api/types').ItemStatus} ItemStatus
 * @typedef {import('../api/types').Reminder} Reminder
 *
 * @typedef {Object} TodayData
 * @property {number} trip_id
 * @property {string} trip_title
 * @property {string} date           // 'YYYY-MM-DD'
 * @property {TripItem[]} today_items
 * @property {number} unread_reminders
 * // (city 字段已移除 per 2026-06-24 trip_id 一致性审计清理)
 *
 * @typedef {'network' | 'server' | 'badrequest' | 'notfound'} ErrorType
 *
 * @typedef {Object} ErrorInfo
 * @property {ErrorType} type
 * @property {string} message
 * @property {unknown} [cause]
 * @property {string} occurredAt
 */

export const useHomeStore = defineStore('home', () => {
  // ───────── State ─────────
  /** @type {import('vue').Ref<TodayData | null>} */
  const today = ref(null)
  const isFetchingToday = ref(false)
  /** @type {import('vue').Ref<TripSummary[]>} */
  const trips = ref([])
  const isFetchingTrips = ref(false)
  /** @type {import('vue').Ref<ErrorInfo | null>} */
  const error = ref(null)
  const lastFetchedAt = ref(null)
  // 2026-06-24 扩展(per task「每行程有独立 chatSession」):page 显式 set 的 tripId override
  //   当 page 从 URL ?tripId=N 跳进来时,显式调用 setCurrentTripId(N) 强制覆盖派生,
  //   让 chatStore 拿对的 trip session(否则默认走 today.trip_id 或 active 第一条,会走错)
  //   null = 未显式 set,fallback 到 today / pickActiveTrip 派生
  const forcedTripId = ref(/** @type {number | null} */ (null))

  // ───────── Getters ─────────
  const hasActiveOrUpcomingTrip = computed(() => today.value !== null)
  const unreadCount = computed(() => today.value?.unread_reminders ?? 0)
  // v0.5.0(2026-06-24)trip_id 修复:暴露当前 trip id 供跨页派生
  //   chatStore / chat page / photo-guide page 复用
  //   派生规则:
  //     - 2026-06-24 扩展:forcedTripId 优先(page 显式 set,例如 chat page 从 ?tripId=N 进来)
  //     - today.trip_id 其次(今天已经拉过 → 准确)
  //     - 否则取 trips 中 status='active' 第一条
  //     - 都没有 → null(调用方需自行处理)
  //   **不**触发任何 fetch,只是只读派生(per AGENTS.md §5 store 惯例)
  const currentTripId = computed(() => {
    if (forcedTripId.value !== null && Number.isFinite(forcedTripId.value) && forcedTripId.value > 0) {
      return forcedTripId.value
    }
    if (today.value?.trip_id && Number.isFinite(today.value.trip_id) && today.value.trip_id > 0) {
      return today.value.trip_id
    }
    const activeTrip = pickActiveTrip()
    if (activeTrip && Number.isFinite(activeTrip.id) && activeTrip.id > 0) {
      return activeTrip.id
    }
    return null
  })

  // ───────── Internal helpers ─────────

  /**
   * 格式化今日日期为 'YYYY-MM-DD' 字符串(local time,非 UTC)。
   * 2026-06-24 Fix A:之前 fetchToday 错误传 active trip 的 start_date,
   * 导致后端查询 trip start_date 那天(today_items 多为空)。
   * 改成传**今天**真实日期,Section 1 才能正确显示"今日行程"。
   *
   * @returns {string} YYYY-MM-DD
   */
  function formatTodayDate() {
    const d = new Date()
    const y = d.getFullYear()
    const m = String(d.getMonth() + 1).padStart(2, '0')
    const day = String(d.getDate()).padStart(2, '0')
    return `${y}-${m}-${day}`
  }

  /**
   * 将 ApiError 归一为 ErrorInfo(spec §7.3)
   * @param {ApiError | Error | unknown} err
   * @returns {ErrorInfo}
   */
  function buildErrorInfo(err) {
    /** @type {ErrorType} */
    let type = 'server'
    let message = '服务器开小差,请稍后再试'
    if (err instanceof ApiError) {
      if (err.isNetworkError) {
        type = 'network'
        message = '网络异常,请稍后重试'
      } else if (err.code === 4000 || err.statusCode === 400) {
        type = 'badrequest'
        message = '参数不合法,请刷新后重试'
      } else if (err.code === 4001 || err.statusCode === 404) {
        type = 'notfound'
        message = '行程不存在'
      } else if (err.code === 5000 || (err.statusCode >= 500 && err.statusCode < 600)) {
        type = 'server'
        message = '服务器开小差,请稍后再试'
      }
    } else if (err && typeof err === 'object' && 'message' in err) {
      message = String((/** @type {{ message: unknown }} */ (err)).message)
    }
    return {
      type,
      message,
      cause: err,
      occurredAt: new Date().toISOString(),
    }
  }

  /**
   * 筛选 active trip:从 trips 中选 status='active' 且最靠近今天的那条
   * 若 trips 为空 / 无 active → 返回 null(spec §6.4.3)
   *
   * MVP 简化:取 active 列表中 start_date 最近的那条
   *
   * @returns {TripSummary | null}
   */
  function pickActiveTrip() {
    const activeTrips = trips.value.filter((t) => t.status === 'active')
    if (activeTrips.length === 0) return null
    activeTrips.sort((a, b) => {
      const da = new Date(a.start_date).getTime() || 0
      const db = new Date(b.start_date).getTime() || 0
      return da - db
    })
    return activeTrips[0]
  }

  // ───────── Actions ─────────

  /**
   * 拉取行程列表 —— GET /api/trips
   * @returns {Promise<void>}
   * @throws  {ApiError}
   */
  async function fetchTrips() {
    isFetchingTrips.value = true
    try {
      const res = await svcListTrips()
      trips.value = res.data.trips || []
      error.value = null
      logger.info('[homeStore.fetchTrips] ok', { count: trips.value.length })
    } catch (err) {
      logger.error('[homeStore.fetchTrips] failed', err)
      throw err
    } finally {
      isFetchingTrips.value = false
    }
  }

  /**
   * 拉取今日行程 —— 内部先确保 trips 已就绪,再选 date 调 /api/home/today
   *
   * 实现说明(spec §6.4.3 / §6.1):
   *   - 若 trips 为空 → short-circuit,today = null,不发起请求
   *   - 若 trips 无 active → short-circuit,today = null
   *   - 选 status='active' 中 start_date 最靠近今天的那条
   *
   * @returns {Promise<void>}
   * @throws  {ApiError}
   */
  async function fetchToday() {
    isFetchingToday.value = true
    try {
      // 若 trips 还没拉过,先拉(spec §6.4.3 决策)
      if (trips.value.length === 0 && !isFetchingTrips.value) {
        await fetchTrips()
      }
      const activeTrip = pickActiveTrip()
      if (activeTrip === null) {
        today.value = null
        lastFetchedAt.value = new Date().toISOString()
        logger.info('[homeStore.fetchToday] no active trip, short-circuit')
        return
      }
      const res = await svcGetToday(formatTodayDate())
      today.value = res.data
      lastFetchedAt.value = new Date().toISOString()
      error.value = null
      logger.info('[homeStore.fetchToday] ok', {
        date: formatTodayDate(),
        items: res.data.today_items?.length ?? 0,
      })
    } catch (err) {
      // 2026-06-28 retro fix(spec §600 字面合规化):
      //   后端 GET /api/home/today 在"今天没 active trip 覆盖"时正确返回 404 + code=4001
      //   (per backend/app/services/home_service.py:32-33),"RESTful 语义=资源不存在,属正常空状态"
      //   spec/HomePage.md §600 明确规定:404/4001 → today=null,不视为 error,
      //   走 trips / empty 视图(由 HomePage sectionVisibility 派生)
      //   改前 bug:本 catch 走 throw → refreshAll catch → buildErrorInfo → error.type='notfound'
      //   → HomePage sectionVisibility.showError=true → 整页 HomeErrorOverlay,
      //   用户看到「行程不存在」+ 重试无效(数据条件不变,retry 永远失败)
      //   改后:本 catch 内单独识别 4001/404 → today=null + error=null + log info + return,
      //   与 spec §600 字面对齐;其他 statusCode 仍走 throw(由 refreshAll catch 兜底)
      if (err instanceof ApiError && (err.code === 4001 || err.statusCode === 404)) {
        today.value = null
        lastFetchedAt.value = new Date().toISOString()
        error.value = null
        logger.info('[homeStore.fetchToday] no active trip today, short-circuit (spec §600)', {
          code: err.code,
          statusCode: err.statusCode,
        })
        return
      }
      logger.error('[homeStore.fetchToday] failed', err)
      throw err
    } finally {
      isFetchingToday.value = false
    }
  }

  /**
   * 刷新 trips + today —— 供 onShow / 重试按钮使用
   * 任意一个 reject → 内部消化为 error,页面通过 error 字段决定 viewMode
   * @returns {Promise<void>}
   */
  async function refreshAll() {
    error.value = null
    isFetchingTrips.value = true
    isFetchingToday.value = true
    try {
      const tripsRes = await svcListTrips()
      trips.value = tripsRes.data.trips || []

      const activeTrip = pickActiveTrip()
      if (activeTrip === null) {
        today.value = null
      } else {
        const todayRes = await svcGetToday(formatTodayDate())
        today.value = todayRes.data
      }

      error.value = null
      lastFetchedAt.value = new Date().toISOString()
      logger.info('[homeStore.refreshAll] done', {
        trips: trips.value.length,
        items: today.value?.today_items?.length ?? 0,
        error: error.value?.type ?? null,
      })
    } catch (err) {
      // 2026-06-28 retro fix(spec §600 兜底防御):
      //   正常路径下 fetchToday 已内部消化 4001/404 不 throw(改 A 后),
      //   本 catch 不会被 fetchToday 触发;但保险起见保留 4001/404 静默分支,
      //   避免未来重构(fetchToday 重新 throw)时 404 误归类为 error 再次触发整页 overlay
      //   改前 bug:本 catch 走 buildErrorInfo → error.type='notfound' → HomeErrorOverlay
      //   改后:4001/404 → log info + error=null + today=null(防御性 short-circuit)
      if (err instanceof ApiError && (err.code === 4001 || err.statusCode === 404)) {
        logger.info('[homeStore.refreshAll] 404 caught, no active trip today, short-circuit', {
          code: err.code,
          statusCode: err.statusCode,
        })
        error.value = null
        today.value = null
      } else {
        // 理论上 Promise.allSettled 不会 reject,这里兜底
        logger.error('[homeStore.refreshAll] failed', err)
        error.value = buildErrorInfo(err)
      }
    } finally {
      isFetchingTrips.value = false
      isFetchingToday.value = false
    }
  }

  /**
   * 乐观更新:将 today_items[i].status 置为 'done'
   * MVP 阶段不发起远端 PUT(见 spec §7.5);下次 fetchToday 时由服务端覆盖
   *
   * @param {number} itemId
   * @returns {Promise<void>}
   */
  async function markSpotVisited(itemId) {
    if (!today.value) {
      logger.warn('[homeStore.markSpotVisited] no today, skip')
      return
    }
    const item = today.value.today_items.find((i) => i.id === itemId)
    if (!item) {
      logger.warn('[homeStore.markSpotVisited] item not found', { itemId })
      return
    }
    // 乐观更新:本地立刻改 status
    /** @type {ItemStatus} */
    const prevStatus = item.status
    item.status = 'done'
    logger.info('[homeStore.markSpotVisited] ok (local)', { itemId, prevStatus })
  }

  /**
   * 清空首页 state —— 登出 / 切换账号场景
   * 本页面不触发
   */
  function clearHome() {
    today.value = null
    trips.value = []
    error.value = null
    lastFetchedAt.value = null
  }

  // ───────── v0.4.0 Reminders/Check 扩展(spec §6.5.7,0 触动既有 5 action)─────────

  /**
   * 当前激活的智能提醒(spec §6.5.4)
   * `null` = 无提醒;`POST /api/reminders/check` 返回 `has_risk=true` 时由 store 写入
   * **不**持久化(per spec §6.5.7.4 MVP YAGNI)
   * @type {import('vue').Ref<Reminder | null>}
   */
  const activeReminder = ref(null)

  /**
   * `triggerRemindersCheck` 飞行中标记(互斥锁,spec §6.5.4)
   * 仅供 store 内部防重入,**不**暴露给 UI
   * @type {import('vue').Ref<boolean>}
   */
  const isCheckingReminders = ref(false)

  /**
   * `activeReminder !== null` 的语义化别名(spec §6.5.7.1 getter)
   * 供 `<ReminderBanner v-if="hasActiveReminder">` 使用
   */
  const hasActiveReminder = computed(() => activeReminder.value !== null)

  /**
   * 主动触发一次智能提醒检查(spec §6.5.7.2 + AC-16/17/19)
   *
   * 实现(spec §6.5.5 State Flow + AGENTS.md §8.4 best-effort 模式):
   *   1. if (isCheckingReminders) return         // 互斥锁防重入
   *   2. isCheckingReminders = true
   *   3. try { 调 services/reminders.checkReminders({ current_time })
   *        if (has_risk && reminder)  → activeReminder = reminder + logger.info risk
   *        else                       → activeReminder = null    + logger.info no risk
   *      } catch (err) { activeReminder = null + logger.warn failed (silent)
   *        // **不**修改 homeStore.error(**不**触发 sectionVisibility.showError)
   *        // **不**弹 toast,**不**切 error 视图(best-effort 静默降级)
   *      } finally { isCheckingReminders = false }
   *
   * @returns {Promise<void>}
   */
  async function triggerRemindersCheck() {
    if (isCheckingReminders.value) {
      logger.debug('[homeStore.triggerRemindersCheck] already running, skip')
      return
    }
    isCheckingReminders.value = true
    try {
      const res = await svcCheckReminders({
        current_time: new Date().toISOString(),
      })
      if (res.data && res.data.has_risk && res.data.reminder) {
        activeReminder.value = res.data.reminder
        logger.info('[HomePage] reminders check: risk', {
          type: res.data.reminder.type,
          id: res.data.reminder.id,
        })
      } else {
        activeReminder.value = null
        logger.info('[HomePage] reminders check: no risk')
      }
    } catch (err) {
      // best-effort:失败静默降级,activeReminder=null,**不**写 homeStore.error(per R-16 + AC-19)
      activeReminder.value = null
      logger.warn('[HomePage] reminders check failed (silent)', {
        error: err?.message || String(err),
      })
    } finally {
      isCheckingReminders.value = false
    }
  }

  /**
   * 用户点 ReminderBanner 关闭按钮 → 清 activeReminder(spec §6.5.7.2 + AC-18)
   *
   * 实现:
   *   - activeReminder = null
   *   - hasActiveReminder 派生 → false → banner 立即退场
   *   - **不**调任何 API,**不**持久化(MVP YAGNI;下次 onShow 重新触发 triggerRemindersCheck)
   *
   * @returns {void}
   */
  function dismissReminder() {
    if (activeReminder.value) {
      logger.info('[HomePage] reminder dismissed', { id: activeReminder.value.id })
    }
    activeReminder.value = null
  }

  /**
   * 2026-06-24 扩展(per task「每行程有独立 chatSession」):page 显式 set 当前 tripId,
   * 让 chatStore.fetchHistory 拿对 trip session(per Q1 决策 chatStore 自动从 homeStore
   * 派生 currentTripId;本 action 拓展派生链,page 显式 URL ?tripId=N 进来时强制覆盖)
   *
   * 设计:
   *   - 不调任何 API,只覆盖 ref(per AGENTS.md §5 store 惯例,action 写操作要纯)
   *   - page 离开时调 clearCurrentTripId(),避免 trip N 永远 forced(下次进 home page
   *     又拿 trip N);pinia store 在 SPA 不会自动 reset state
   *
   * @param {number | null} tripId
   * @returns {void}
   */
  function setCurrentTripId(tripId) {
    if (tripId !== null && (!Number.isFinite(tripId) || tripId <= 0)) {
      logger.warn('[homeStore.setCurrentTripId] invalid tripId, skip', { tripId })
      return
    }
    const prev = forcedTripId.value
    forcedTripId.value = tripId
    logger.info('[homeStore.setCurrentTripId] done', { prev, next: tripId })
  }

  /**
   * 2026-06-24 扩展:清空 forced override,fallback 到 today / pickActiveTrip 派生
   * (page onUnmounted 调,避免 trip 跨 page 一直 forced)
   *
   * @returns {void}
   */
  function clearCurrentTripId() {
    if (forcedTripId.value !== null) {
      logger.info('[homeStore.clearCurrentTripId] done', { prev: forcedTripId.value })
      forcedTripId.value = null
    }
  }

  /**
   * 2026-06-24 UserRound2-001 §3 Bug C 新增:删除行程
   * store action 纪律:只做"删"一件事,**不**耦合 refresh(per AGENTS.md §5);
   * page 层调 deleteTrip 后显式调 refreshAll() 重拉。
   *
   * @param {number} tripId
   * @returns {Promise<void>}
   */
  async function deleteTrip(tripId) {
    if (!Number.isInteger(tripId) || tripId <= 0) {
      logger.error('[homeStore.deleteTrip] invalid tripId', { tripId })
      throw new Error('invalid tripId')
    }
    logger.info('[homeStore.deleteTrip] start', { tripId })
    await svcDeleteTrip(tripId)
    logger.info('[homeStore.deleteTrip] ok', { tripId })
  }

  return {
    // state
    today,
    isFetchingToday,
    trips,
    isFetchingTrips,
    error,
    lastFetchedAt,
    // getters
    hasActiveOrUpcomingTrip,
    unreadCount,
    currentTripId,  // v0.5.0(2026-06-24)trip_id 修复
    // actions
    fetchTrips,
    fetchToday,
    refreshAll,
    markSpotVisited,
    clearHome,
    // 2026-06-24 扩展(per task「每行程有独立 chatSession」)
    setCurrentTripId,
    clearCurrentTripId,
    // 2026-06-24 UserRound2-001 §3 Bug C 新增:删除行程
    deleteTrip,
    // v0.4.0 Reminders/Check 扩展(spec §6.5.7)
    activeReminder,
    isCheckingReminders,
    hasActiveReminder,
    triggerRemindersCheck,
    dismissReminder,
    // internal(为测试导出)
    buildErrorInfo,
  }
})
