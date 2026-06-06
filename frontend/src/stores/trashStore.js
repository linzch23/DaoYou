// frontend/stores/trashStore.js
// 回收站域 Pinia store —— 唯一 owner of `trashedTrips` / `error` / `isFetching` / `restoringId`
//
// Spec contract: specs/TrashPage.md §7.1
//
// state
//   trashedTrips   : TripSummary[]                  已删行程列表(GET 全量 + JS filter 后写入)
//   error          : ApiError | null                拉取 / 恢复失败时的错误
//   isFetching     : boolean                        fetchTrash 飞行中标记
//   restoringId    : number | null                  当前正在恢复的 trip id(单值,防并发)
//
// action
//   fetchTrash()           : Promise<void>   GET /api/trips → listDeletedTrips → 写 trashedTrips
//   restoreTrashById(id)   : Promise<void>   PUT /api/trips/{id} { status: 'active' } + 乐观更新 + 失败回滚
//   clearTrash()           : void            onUnmounted 兜底清空(避免下次进入页面看到上次残留)
//
// 4 态决策(交给页面,不在 store 内部决定):
//   page.compute viewMode(store.trashedTrips, store.error, store.isFetching) → 'loading' | 'loaded' | 'empty' | 'error'
//
// 不复用 homeStore(语义不同,per spec §1 + §7.1):
//   - homeStore 持有 status='active'/'draft'/'finished' 活跃行
//   - trashStore 持有 status='deleted' 删除行(per spec §1 决策:不污染 homeStore)
//
// 不调用 homeStore.fetchTrips()(per spec §1 + §7.1):恢复后由 HomePage onShow 自动重拉,避免本页面主动触发

import { defineStore } from 'pinia'
import { ref } from 'vue'
import {
  listDeletedTrips as svcListDeletedTrips,
  updateTrip as svcUpdateTrip,
} from '../services/trips.js'
import { ApiError } from '../services/preferences.js'
import { logger } from '../utils/logger.js'

export const useTrashStore = defineStore('trash', () => {
  // ───────── State ─────────
  /** @type {import('vue').Ref<import('../api/types').TripSummary[]>} */
  const trashedTrips = ref([])
  /** @type {import('vue').Ref<ApiError | null>} */
  const error = ref(null)
  const isFetching = ref(false)
  /** @type {import('vue').Ref<number | null>} */
  const restoringId = ref(null)

  // ───────── Actions ─────────

  /**
   * 拉取已删行程列表 —— GET /api/trips?user_id=1 + JS filter status='deleted'
   *
   * 错误归一(ApiError class 复用,见 services/preferences.js:33-44):
   *   - 4000 / 400     → 参数非法(GET 理论上不会,除非 url 拼错)
   *   - 5000 / 5xx     → 服务端错误
   *   - isNetworkError → 网络断开
   *
   * @returns {Promise<void>}
   * @throws  {ApiError}  抛给 page 端 catch 切 viewMode='error'
   */
  async function fetchTrash() {
    isFetching.value = true
    try {
      const res = await svcListDeletedTrips()
      trashedTrips.value = Array.isArray(res.data?.trips) ? res.data.trips : []
      error.value = null
      logger.info('[trashStore.fetchTrash] ok', { count: trashedTrips.value.length })
    } catch (err) {
      logger.error('[trashStore.fetchTrash] failed', err)
      throw err
    } finally {
      isFetching.value = false
    }
  }

  /**
   * 恢复某条已删行程 —— 乐观更新 + PUT + 失败回滚协议(per spec §7.3)
   *
   * 实现要点(spec §7.3):
   *   1. findIndex 提前取 idx(因乐观更新会改 state.trashedTrips 引用,**不能**延后取)
   *   2. 乐观更新:trashedTrips.filter(t => t.id !== tripId) + restoringId = tripId
   *   3. await services/trips.updateTrip(tripId, { status: 'active' })
   *   4. 成功:restoringId = null + logger.info,row 已在乐观更新时移除
   *   5. 失败(非 404):回滚 splice(idx, 0, trip) + restoringId = null + error = err + throw
   *   6. 404/4001 静默:trip 已被自动清理,不回滚不切 error(per spec §5.3.H + AC-06)
   *
   * 错误归一(ApiError 复用):
   *   - 4000 / 400     → 4xx 业务错误
   *   - 4001 / 404     → 静默(trip 已不存在,无需重试)
   *   - 5000 / 5xx     → 服务端错误
   *   - isNetworkError → 网络断开
   *
   * @param {number} tripId
   * @returns {Promise<void>}
   * @throws  {ApiError}  抛给 page 端 catch 切 viewMode='error'(仅非 404 错误)
   */
  async function restoreTrashById(tripId) {
    const idx = trashedTrips.value.findIndex((t) => t.id === tripId)
    if (idx === -1) {
      logger.warn('[trashStore.restoreTrashById] target not found, skip', { tripId })
      return
    }
    const trip = trashedTrips.value[idx]

    // 1. 乐观更新:从 trashedTrips 移除 + 置 restoringId
    trashedTrips.value = trashedTrips.value.filter((t) => t.id !== tripId)
    restoringId.value = tripId
    error.value = null

    try {
      // 2. 调 services/trips.updateTrip
      await svcUpdateTrip(tripId, { status: 'active' })

      // 3. 成功:清空 restoringId(乐观更新已生效,row 已在列表外)
      restoringId.value = null
      logger.info('[trashStore.restoreTrashById] ok', { tripId })
    } catch (err) {
      // 4. 失败:先看是不是 404(trip 已被自动清理)
      const apiErr = err instanceof ApiError
        ? err
        : new ApiError({ code: null, message: '未知错误', statusCode: 0, isNetworkError: true })

      if (apiErr.code === 4001 || apiErr.statusCode === 404) {
        // 404 静默路径(per spec §5.3.H + AC-06):不回滚不切 error 态
        restoringId.value = null
        logger.warn('[TrashPage] restore failed, trip 404, dropping silently', { tripId })
        return
      }

      // 5. 其他失败:回滚 + 写 error + throw
      trashedTrips.value = [
        ...trashedTrips.value.slice(0, idx),
        trip,
        ...trashedTrips.value.slice(idx),
      ]
      restoringId.value = null
      error.value = apiErr
      logger.error('[trashStore.restoreTrashById] failed', { tripId, err })
      throw apiErr
    }
  }

  /**
   * 清空 store 状态 —— onUnmounted 兜底(per spec §3 备注 7 + §5.1)
   * 避免下次进入页面看到上次残留(trashedTrips / restoringId 是删除行,数据可能频繁变化)
   */
  function clearTrash() {
    trashedTrips.value = []
    error.value = null
    isFetching.value = false
    restoringId.value = null
  }

  /**
   * 清空 error 字段 —— page 端 _ErrorBanner 点「重试」前主动清(避免 loading 态闪烁 error)
   * per spec §5.3 A:用户点重试 → viewMode='loading' 重新拉,error 内部 fetchTrash 失败时由 store 重写
   */
  function clearLoadError() {
    error.value = null
  }

  return {
    // state
    trashedTrips,
    error,
    isFetching,
    restoringId,
    // actions
    fetchTrash,
    restoreTrashById,
    clearTrash,
    clearLoadError,
  }
})
