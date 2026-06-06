// frontend/db/schema.js
// DB 数据 schema —— JSDoc typedef 集中登记
//
// 触发原因(per issues/UI/UI-022-local-db-user.md §1):
//   - DB 层作为基础设施被后续 5 个任务依赖(任务 3 草稿补全 / 任务 4 复制行程 / 任务 5 拖动)
//   - 形状必须先稳定,后续 task 直接复用
//
// 跨端兼容性:
//   - 本文件**纯类型声明**,无运行时副作用
//   - 不调 `uni.*` / 不调 `console.*` / 不调 storage
//   - H5 + Android App 端 0 差异
//
// 类型来源说明:
//   - User 字段从 `_seed.js:seedUsers` 派生,4 个可编辑字段从 `api/types.ts:Preferences`
//     重导出,保持与后端 `seedPreferences` 形状 1:1
//   - Preferences 类型直接 re-export 避免双源

// ───────────────── Re-exports(避免双源)─────────────────

/**
 * 用户偏好 4 字段(从 `api/types.ts:Preferences` 重导出)
 * DB 层与 mock 后端共享同一份类型定义,避免 drift
 *
 * @typedef {import('../api/types').Preferences} Preferences
 */

/**
 * 单个偏好枚举值
 * @typedef {import('../api/types').ExplanationStyle} ExplanationStyle
 * @typedef {import('../api/types').TravelPace} TravelPace
 * @typedef {import('../api/types').Interest} Interest
 * @typedef {import('../api/types').SpecialNeed} SpecialNeed
 */

// ───────────────── DB Schema ─────────────────

/**
 * DB 中存储的 User 记录
 *
 * 与后端 `Preferences` 区别:
 *   - 多 3 个衍生字段:`id` / `nickname` / `avatarEmoji` / `createdAt`
 *     (后端无 user 表概念,前端 DB 独立维护)
 *   - 4 个可编辑字段形状与 `Preferences` 1:1
 *
 * MVP 不可变字段(写后不应被 PATCH 修改):
 *   - `id` / `createdAt`
 *
 * @typedef {object} User
 * @property {string} id                  — 字符串 user id(MVP 单用户 `'1'`)
 * @property {string} nickname            — MyPage 用户信息卡片显示
 * @property {string} avatarEmoji         — emoji 占位头像
 * @property {ExplanationStyle} explanation_style
 * @property {TravelPace} travel_pace
 * @property {Interest[]} interests
 * @property {SpecialNeed[]} special_needs
 * @property {string} createdAt           — ISO 8601(中国时区 `+08:00`)
 */

/**
 * User 局部更新 payload
 *
 * 沿用 `services/preferences.js` PUT 语义:**只**送本次修改字段,未携带字段保留。
 * 不可变字段(`id` / `createdAt`)即使送入也**被忽略**。
 *
 * 字段子集(去掉 id / createdAt):
 * @typedef {Partial<Pick<User,
 *   'nickname' | 'avatarEmoji' | 'explanation_style' | 'travel_pace' | 'interests' | 'special_needs'
 * >>} UserPatch
 */

/**
 * Trip 记录(MVP 占位形状,任务 3/4 扩展)
 *
 * 当前 tasks 尚未使用,本 typedef 只为后续 trip 字段预留位置。
 * 完整 Trip 类型详见 `api/types.ts:Trip`。
 *
 * @typedef {object} Trip
 * @property {string} id
 * @property {string} user_id
 * @property {string} title
 * @property {string} city
 * @property {string} start_date
 * @property {string} end_date
 * @property {string} status
 */

/**
 * ItineraryItem 记录(MVP 占位,任务 5 拖动扩展)
 *
 * @typedef {object} ItineraryItem
 * @property {string} id
 * @property {string} trip_id
 * @property {number} day_index
 * @property {number} order_index
 * @property {string} start_time
 * @property {string} [end_time]
 * @property {string} title
 * @property {string} [location]
 * @property {string} [note]
 */

/**
 * DB meta —— schema 版本 + 最近写入时间
 *
 * @typedef {object} DbMeta
 * @property {number} version             — schema 版本号(对齐 `_seed.SEED_VERSION`)
 * @property {string} lastWriteAt         — ISO 8601,最近一次成功写 DB 的时间
 */

/**
 * DB 三表 memory 形状(在 storage 中以 3 个 key 独立存)
 *
 * - db_users : Record<userId, User>
 * - db_trips : Record<tripId, Trip>
 * - db_meta  : DbMeta
 *
 * @typedef {Record<string, User>} UsersById
 * @typedef {Record<string, Trip>} TripsById
 */

// ───────────────── Storage Keys(全局单点)─────────────────

/** @type {const} */
export const DB_STORAGE_KEYS = Object.freeze({
  USERS: 'db_users',
  TRIPS: 'db_trips',
  META: 'db_meta',
})
