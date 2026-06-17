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
//
// getter
//   hasActiveOrUpcomingTrip : boolean    today !== null
//   unreadCount             : number     today?.unread_reminders ?? 0
//
// action
//   fetchTrips()    : Promise<void>      GET /api/trips
//   fetchToday()    : Promise<void>      内部依赖 trips 选 date,再 GET /api/home/today
//   refreshAll()    : Promise<void>      先刷新 trips,再基于 active trip 拉今日行程
//   markSpotVisited(itemId) : Promise<void>   乐观更新 status='done'(MVP 不发远端)
//   clearHome()     : void               登出场景
//
// 4 态决策(交给页面,不在 store 内部决定):
//   page.compute viewMode(store.today, store.trips) → 'diary' | 'trips' | 'empty'

import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import {
  getToday as svcGetToday,
  listTrips as svcListTrips,
} from '../services/home.js'
import { ApiError } from '../services/preferences.js'
import { logger } from '../utils/logger.js'

/**
 * @typedef {import('../api/types').TripItem} TripItem
 * @typedef {import('../api/types').TripSummary} TripSummary
 * @typedef {import('../api/types').ItemStatus} ItemStatus
 *
 * @typedef {Object} TodayData
 * @property {number} trip_id
 * @property {string} trip_title
 * @property {string} city
 * @property {string} date
 * @property {TripItem[]} today_items
 * @property {number} unread_reminders
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

  // ───────── Getters ─────────
  const hasActiveOrUpcomingTrip = computed(() => today.value !== null)
  const unreadCount = computed(() => today.value?.unread_reminders ?? 0)

  // ───────── Internal helpers ─────────

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
      const res = await svcGetToday(activeTrip.start_date)
      today.value = res.data
      lastFetchedAt.value = new Date().toISOString()
      error.value = null
      logger.info('[homeStore.fetchToday] ok', {
        date: activeTrip.start_date,
        items: res.data.today_items?.length ?? 0,
      })
    } catch (err) {
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
        const todayRes = await svcGetToday(activeTrip.start_date)
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
      // 理论上 Promise.allSettled 不会 reject,这里兜底
      logger.error('[homeStore.refreshAll] failed', err)
      error.value = buildErrorInfo(err)
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
    // actions
    fetchTrips,
    fetchToday,
    refreshAll,
    markSpotVisited,
    clearHome,
    // internal(为测试导出)
    buildErrorInfo,
  }
})
