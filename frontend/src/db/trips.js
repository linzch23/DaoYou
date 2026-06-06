// frontend/db/trips.js
// 行程表 storage I/O + CRUD(per issues/UI/UI-022-local-db-user.md §1 + issues/UI/UI-023-draft-page-prefill.md §3)
//
// 触发原因(per issues/UI/UI-022-local-db-user.md §1 + §任务 3/4/5):
//   - 任务 3(草稿补全)→ 读 db_trips[tripId] 字段预填(本文件 getTrip)
//   - 任务 4(复制行程)→ 复制时新建 trip(本文件 setTrip)
//   - 任务 5(行程安排拖动)→ 拖动后 PATCH(本文件 patchTrip)
//   - 初始化:`initLocalDb()` 启动时把 mock seedTrips 5 条 seed 到 db_trips
//     (含 seedTrip2 青岛 draft,提供"草稿"演示数据,per issues/UI/UI-023-draft-page-prefill.md §3)
//
// 跨端兼容性:
//   - 只用 `uni.setStorageSync` / `uni.getStorageSync` 同步 API
//   - H5 + Android App 端 0 差异
//
// 占位说明:
//   - Plan 1 仅提供 `loadTrips` / `saveTrips` 内部 storage helper
//   - 任务 3 落地后:**新增** `getTrip` / `setTrip` / `patchTrip` / `getAllTrips` 4 个公开 API
//   - 业务代码(page / store)只 import `db/index.js` 公开入口,**不**直接碰 storage

import { logger } from '../utils/logger.js'
import { DB_STORAGE_KEYS } from './schema.js'

/**
 * 读 db_trips —— 静默降级
 *
 * @returns {Record<string, import('./schema.js').Trip>}
 */
export function loadTrips() {
  let result = {}
  try {
    const raw = uni.getStorageSync(DB_STORAGE_KEYS.TRIPS)
    if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
      result = raw
    }
  } catch (err) {
    logger.warn('[db.trips] loadTrips storage read failed', err)
    result = {}
  }
  return result
}

/**
 * 写 db_trips(覆盖式)—— 静默降级
 *
 * @param {Record<string, import('./schema.js').Trip>} trips
 * @returns {boolean} true = 写成功
 */
export function saveTrips(trips) {
  try {
    uni.setStorageSync(DB_STORAGE_KEYS.TRIPS, trips || {})
    return true
  } catch (err) {
    logger.warn('[db.trips] saveTrips storage write failed', err)
    return false
  }
}

// ───────────────── CRUD 操作(per issues/UI/UI-023-draft-page-prefill.md §3)─────────────────

/**
 * 读单个 trip —— MVP keyed by id(`db_trips[String(tripId)]`)
 *
 * 与 `users.js:readUserById` 形态 1:1
 *
 * @param {string | number} tripId
 * @returns {import('./schema.js').Trip | null} 不存在返回 null
 */
export function readTripById(tripId) {
  if (tripId === null || tripId === undefined || tripId === '') return null
  const trips = loadTrips()
  // 支持 number 与 string 两种 key(seed 写入时是 string,业务调用常用 number)
  const key = String(tripId)
  return trips[key] || trips[/** @type {any} */ (tripId)] || null
}

/**
 * 写单个 trip(覆盖式)—— 沿 `users.js:writeUser` 形态
 *
 * @param {import('./schema.js').Trip} trip
 * @returns {boolean} true = 写成功
 */
export function writeTrip(trip) {
  if (!trip || !trip.id) {
    logger.warn('[db.trips] writeTrip called with invalid trip', trip)
    return false
  }
  const trips = loadTrips()
  trips[String(trip.id)] = trip
  return saveTrips(trips)
}

/**
 * 部分更新 trip(PATCH 语义)—— 沿 `users.js:patchUser` 形态
 *
 * 不可变字段(`id` / `user_id`)即使在 patch 中传入也**被忽略**
 *
 * @param {string | number} tripId
 * @param {Partial<import('./schema.js').Trip>} patch
 * @returns {import('./schema.js').Trip | null} 更新后的 trip;tripId 不存在返回 null
 */
export function patchTrip(tripId, patch) {
  if (tripId === null || tripId === undefined || tripId === '') return null
  const trips = loadTrips()
  const key = String(tripId)
  const existing = trips[key] || trips[/** @type {any} */ (tripId)]
  if (!existing) {
    logger.warn('[db.trips] patchTrip target not found', { tripId })
    return null
  }
  // 过滤不可变字段:id / user_id 不允许 PATCH 修改
  const safePatch = { ...patch }
  delete safePatch.id
  delete safePatch.user_id

  const updated = { ...existing, ...safePatch }
  trips[key] = updated
  if (!saveTrips(trips)) {
    return null
  }
  return updated
}

/**
 * 列出所有 trip(MVP 演示用,沿 `users.js:listAllUsers` 形态)
 *
 * @returns {import('./schema.js').Trip[]}
 */
export function listAllTrips() {
  return Object.values(loadTrips())
}

// 内部 re-export 便于单测 / 调试
export { readTripById as getTrip, writeTrip as setTrip }
