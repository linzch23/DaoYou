// frontend/db/index.js
// DB 入口 —— 导出 `getUser` / `updateUser` / `listUsers` / `initLocalDb`
//
// 触发原因(per issues/UI/UI-022-local-db-user.md §4 + §7):
//   - 用 `uni.setStorageSync` 模拟 DB,跨 H5 + Android 兼容
//   - 业务代码(page / store)只 import 本入口,**不**直接碰 storage
//   - service 层 `preferences.js` 调本文件的 `getUser` / `updateUser`
//
// 跨端兼容性:
//   - 本入口**不**直接调 `uni.setStorageSync`,所有 storage I/O 经 `users.js` / `trips.js`
//   - 同步 API,无 Promise 包装(uni-app 跨端 storage 是同步的)
//   - H5 + Android App 端 0 差异
//
// 数据初始化时序(per spec §7 + issue §7):
//   1. `src/main.js` 启动 → `installMockInterceptor()` 之后调 `initLocalDb()`
//   2. `initLocalDb()` 检查 `db_users` 是否为空 → 空则写 seed
//   3. 后续 `getUser('1')` 直接从 storage 读(命中已 seed 数据)

import { logger } from '../utils/logger.js'
import { seedUsers, seedTrips, SEED_VERSION } from './_seed.js'
import {
  loadUsers,
  saveUsers,
  readUserById,
  writeUser,
  patchUser,
  listAllUsers,
} from './users.js'
import {
  loadTrips,
  saveTrips,
  readTripById,
  writeTrip,
  patchTrip,
  listAllTrips,
  deleteTrip as deleteTripImpl,
} from './trips.js'
import { DB_STORAGE_KEYS } from './schema.js'

/** MVP 默认用户 id(per docs/API接口文档.md §1.3 + 全项目 userStore 约定) */
export const MVP_USER_ID = '1'

/**
 * 读 db_meta —— 静默降级
 *
 * @returns {import('./schema.js').DbMeta | null}
 */
function loadMeta() {
  try {
    const raw = uni.getStorageSync(DB_STORAGE_KEYS.META)
    if (raw && typeof raw === 'object' && typeof raw.version === 'number') {
      return raw
    }
  } catch (err) {
    logger.warn('[db] loadMeta storage read failed', err)
  }
  return null
}

/**
 * 写 db_meta(覆盖式)
 *
 * @param {import('./schema.js').DbMeta} meta
 * @returns {boolean} true = 写成功
 */
function saveMeta(meta) {
  try {
    uni.setStorageSync(DB_STORAGE_KEYS.META, meta)
    return true
  } catch (err) {
    logger.warn('[db] saveMeta storage write failed', err)
    return false
  }
}

// ───────────────── Public API ─────────────────

/**
 * 读单个用户 —— 优先从 storage 读,无则从 seed 初始化并写回
 *
 * 调用方:`services/preferences.js:getPreferences`
 *
 * @param {string} [userId='1'] MVP 固定 `'1'`
 * @returns {import('./schema.js').User}
 * @throws {Error} userId 在 seed 中**不**存在(开发期硬错误,提示代码 bug)
 */
export function getUser(userId = MVP_USER_ID) {
  // 1. 优先从 storage 读
  const existing = readUserById(userId)
  if (existing) {
    return existing
  }

  // 2. storage 无 → 从 seed 初始化
  const seed = seedUsers[userId]
  if (!seed) {
    throw new Error(
      `[db.getUser] userId '${userId}' not in seed (available: ${Object.keys(seedUsers).join(', ')})`
    )
  }
  // 拷贝解冻 Object.freeze 的 seed,允许后续 PATCH
  const fresh = JSON.parse(JSON.stringify(seed))
  writeUser(fresh)
  // 首次写入时初始化 meta
  if (!loadMeta()) {
    saveMeta({ version: SEED_VERSION, lastWriteAt: new Date().toISOString() })
  }
  logger.info(`[db] init seed user ${userId}`)
  return fresh
}

/**
 * 部分更新用户(PATCH 语义)—— 沿用 preferences service PUT 习惯
 *
 * 调用方:`services/preferences.js:updatePreferences`
 *
 * 不可变字段(`id` / `createdAt`)即使在 patch 中传入也**被忽略**(`users.js:patchUser` 内部过滤)
 *
 * @param {string} userId
 * @param {import('./schema.js').UserPatch} patch
 * @returns {import('./schema.js').User} 更新后的 user
 * @throws {Error} userId 不存在(开发期硬错误)
 */
export function updateUser(userId, patch) {
  const updated = patchUser(userId, patch)
  if (!updated) {
    throw new Error(`[db.updateUser] userId '${userId}' not found`)
  }
  // 同步更新 meta
  saveMeta({ version: SEED_VERSION, lastWriteAt: new Date().toISOString() })
  return updated
}

/**
 * 列出所有用户 —— MVP 单用户,实际返回 [user1] 数组
 *
 * @returns {import('./schema.js').User[]}
 */
export function listUsers() {
  // MVP 单用户:即使 storage 为空,也从 seed 拿一遍(避免空 array 误导调用方)
  const fromStorage = listAllUsers()
  if (fromStorage.length > 0) {
    return fromStorage
  }
  // 触发 seed 初始化
  getUser(MVP_USER_ID)
  return listAllUsers()
}

/**
 * 同步 seed trips 到 db_trips(per issues/UI/UI-023-draft-page-prefill.md §3)
 *
 * 行为:
 *   - 读 db_trips 当前内容 → 缺失/版本低于 SEED_VERSION 的 trip 写入 seed
 *   - 已有 trip(id 在 db_trips 中)→ 保留不动(避免覆盖用户 PATCH 的数据)
 *   - 仅写入 `_seed.js:seedTrips` 中的 5 条演示 trip
 *
 * 与 `getUser()` 不同:**不**覆盖已有 trip 数据(用户可能已 PATCH 过);
 * 仅对"缺失"做补齐。
 *
 * @returns {boolean} true = 同步成功
 */
function seedTripsToDb() {
  try {
    const existing = loadTrips()
    let added = 0
    for (const key of Object.keys(seedTrips)) {
      if (!existing[key]) {
        // 拷贝解冻 Object.freeze 的 seed,允许后续 PATCH
        const fresh = JSON.parse(JSON.stringify(seedTrips[key]))
        existing[key] = fresh
        added += 1
      }
    }
    if (added > 0) {
      saveTrips(existing)
      logger.info('[db] seed trips to db_trips', { added, total: Object.keys(existing).length })
    }
    return true
  } catch (err) {
    logger.warn('[db] seedTripsToDb failed', err)
    return false
  }
}

/**
 * DB 初始化 —— 启动时(`src/main.js`)同步调用一次
 *
 * 行为:
 *   1. 检查 `db_users` 是否为空 → 空则触发 `getUser('1')` 写 seed
 *   2. 检查 `db_trips` 是否包含 seed trips → 缺失则补(per 任务 3)
 *   3. 检查 `db_meta` 是否存在 → 缺失则补 `{ version: SEED_VERSION, lastWriteAt: now }`
 *   4. 静默降级:storage 不可用 → logger.error,但不抛错(避免阻塞应用启动)
 *
 * 任务 3 落地后:trip 演示数据(5 条,含 seedTrip2 青岛 draft)从 `_seed.js:seedTrips`
 * 同步到 db_trips,供 EditTripPage `?mode=draft` 草稿补全用。
 *
 * @returns {boolean} true = 初始化成功(seed 写入完成)
 */
export function initLocalDb() {
  try {
    const users = loadUsers()
    if (Object.keys(users).length === 0) {
      // 触发 seed 写入(走 getUser 内部逻辑)
      getUser(MVP_USER_ID)
      // 同步 trips 空对象(保证 storage key 存在,避免下游误读)
      saveTrips({})
      logger.info('[db] init local DB with seed', { userId: MVP_USER_ID, version: SEED_VERSION })
    } else {
      // 已有数据 → 检查 meta
      const meta = loadMeta()
      if (!meta) {
        saveMeta({ version: SEED_VERSION, lastWriteAt: new Date().toISOString() })
        logger.info('[db] backfill meta (storage existed but meta missing)', { userId: MVP_USER_ID })
      } else {
        logger.info('[db] init local DB from existing storage', {
          userCount: Object.keys(users).length,
          version: meta.version,
          lastWriteAt: meta.lastWriteAt,
        })
      }
    }
    // 同步 seed trips 到 db_trips(任务 3 触发,补 5 条含 seedTrip2 青岛 draft)
    seedTripsToDb()
    return true
  } catch (err) {
    logger.error('[db] initLocalDb failed', err)
    return false
  }
}

/**
 * 读单个 trip —— 业务代码唯一入口,内部从 `db_trips` 读
 *
 * 与 `getUser` 形态 1:1;**不**触发 seed 初始化(避免误覆盖)
 *
 * 调用方:`pages/edit-trip/index.vue` `?mode=draft` 路径
 *
 * @param {string | number} tripId
 * @returns {import('./schema.js').Trip | null} 不存在返回 null
 */
export function getTrip(tripId) {
  return readTripById(tripId)
}

/**
 * 写单个 trip(覆盖式)—— 业务代码唯一入口
 *
 * @param {import('./schema.js').Trip} trip
 * @returns {boolean} true = 写成功
 */
export function setTrip(trip) {
  return writeTrip(trip)
}

/**
 * 部分更新 trip(PATCH 语义)—— 业务代码唯一入口
 *
 * @param {string | number} tripId
 * @param {Partial<import('./schema.js').Trip>} patch
 * @returns {import('./schema.js').Trip | null} 更新后的 trip;tripId 不存在返回 null
 */
export function updateTrip(tripId, patch) {
  return patchTrip(tripId, patch)
}

/**
 * 列出所有 trip —— 沿 `listUsers` 形态
 *
 * @returns {import('./schema.js').Trip[]}
 */
export function listTrips() {
  return listAllTrips()
}

/**
 * 物理删除单个 trip —— **只**为 trash 永久删除本地 fallback 用
 *
 * v0.3.1(2026-06-11,per integrate-r2):
 *   - 后端 `DELETE /api/trash/trips/{id}` 不可达时降级到本地,
 *     物理移除 db_trips 中该 trip
 *   - 幂等:tripId 不存在也返回 true
 *
 * @param {string | number} tripId
 * @returns {boolean}
 */
export function deleteTrip(tripId) {
  return deleteTripImpl(tripId)
}

// 内部 re-export 便于单测 / 调试(本任务不引入单测,保留作后续扩展 hook)
export { loadUsers, saveUsers, readUserById, writeUser, patchUser, listAllUsers, loadTrips, saveTrips }
