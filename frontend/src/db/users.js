// frontend/db/users.js
// 用户表 storage I/O + CRUD 实现
//
// 触发原因(per issues/UI/UI-022-local-db-user.md §1 + §4):
//   - 用 `uni.setStorageSync` 模拟 DB,跨 H5 + Android 兼容
//   - 内部封装 `getStorage` / `setStorage` / 异常静默降级(沿用 `services/home.js:149-183` favorites 模式)
//
// 跨端兼容性:
//   - 只用 `uni.setStorageSync` / `uni.getStorageSync` 同步 API(uni-app 跨端)
//   - 不依赖 `plus.io` / `fs` / `IndexedDB` / Node 端 API
//   - H5 + Android App 端 0 差异
//
// 与 service 层关系:
//   - 本文件**仅**封装 storage I/O,不返回 `{ code, data, message }` 形态
//   - service 层 `preferences.js` 调本文件的 `loadUsers` / `saveUsers` 后,自行包成 ApiResponse
//   - 业务代码(page / store)不直接 import 本文件,只 import `db/index.js`

import { logger } from '../utils/logger.js'
import { DB_STORAGE_KEYS } from './schema.js'

// ───────────────── Storage I/O 内部 helper ─────────────────

/**
 * 读 db_users —— 静默降级:storage 异常 / JSON 损坏 → 返回空对象
 *
 * 沿用 `services/photos.js:230-242` `loadGuideResults` 模式
 *
 * @returns {Record<string, import('./schema.js').User>}
 */
export function loadUsers() {
  let result = {}
  try {
    const raw = uni.getStorageSync(DB_STORAGE_KEYS.USERS)
    if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
      result = raw
    }
  } catch (err) {
    logger.warn('[db.users] loadUsers storage read failed', err)
    result = {}
  }
  return result
}

/**
 * 写 db_users(覆盖式)—— 静默降级:storage 异常 / quota 满 → logger.warn + return false
 *
 * 沿用 `services/home.js:175-183` `saveFavorites` 模式
 *
 * @param {Record<string, import('./schema.js').User>} users
 * @returns {boolean} true = 写成功;false = 失败(供上层决定是否 fallback)
 */
export function saveUsers(users) {
  try {
    uni.setStorageSync(DB_STORAGE_KEYS.USERS, users || {})
    return true
  } catch (err) {
    logger.warn('[db.users] saveUsers storage write failed', err)
    return false
  }
}

// ───────────────── CRUD 操作 ─────────────────

/**
 * 读单个用户 —— MVP 单用户,直接 `users[userId]`
 *
 * @param {string} userId
 * @returns {import('./schema.js').User | null} 不存在返回 null
 */
export function readUserById(userId) {
  const users = loadUsers()
  return users[userId] || null
}

/**
 * 写单个用户(覆盖式)
 *
 * @param {import('./schema.js').User} user
 * @returns {boolean} true = 写成功
 */
export function writeUser(user) {
  if (!user || !user.id) {
    logger.warn('[db.users] writeUser called with invalid user', user)
    return false
  }
  const users = loadUsers()
  users[user.id] = user
  return saveUsers(users)
}

/**
 * 部分更新用户(PATCH 语义)—— 沿用 preferences service PUT 习惯
 *
 * 不可变字段(`id` / `createdAt`)即使在 patch 中传入也**被忽略**(被当前值覆盖)
 *
 * @param {string} userId
 * @param {import('./schema.js').UserPatch} patch
 * @returns {import('./schema.js').User | null} 更新后的 user;userId 不存在返回 null
 */
export function patchUser(userId, patch) {
  const users = loadUsers()
  const existing = users[userId]
  if (!existing) {
    logger.warn('[db.users] patchUser target not found', { userId })
    return null
  }
  // 过滤不可变字段:id / createdAt 不允许 PATCH 修改
  const safePatch = { ...patch }
  delete safePatch.id
  delete safePatch.createdAt

  const updated = { ...existing, ...safePatch }
  users[userId] = updated
  if (!saveUsers(users)) {
    return null
  }
  return updated
}

/**
 * 列出所有用户(MVP 单用户,返回 [user1])
 *
 * @returns {import('./schema.js').User[]}
 */
export function listAllUsers() {
  const users = loadUsers()
  return Object.values(users)
}
