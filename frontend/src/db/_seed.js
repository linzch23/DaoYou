// frontend/db/_seed.js
// 初始 seed 数据 —— 从 `api/mock/_seed.ts:317-322` `seedPreferences` 派生
//                     + 从 `api/mock/_seed.ts:172-237` `seedTrips` 派生
//
// 触发原因(per issues/UI/UI-022-local-db-user.md):
//   - dev 模式下,uni-app 启动时 `db_users` 为空 → 写 seed
//   - 用户实际可编辑的字段(`explanation_style` / `travel_pace` / `interests` /
//     `special_needs`)来自 mock 的 `seedPreferences`
//   - 衍生字段(`id` / `nickname` / `avatarEmoji` / `createdAt`)MVP 硬编码
//
// 触发原因(per issues/UI/UI-023-draft-page-prefill.md §3):
//   - 启动时把 mock seedTrips 5 条 seed 到 db_trips(草稿补全用)
//   - **不**修改 `api/mock/_seed.ts` mock data(per issue 硬规则)
//   - **只**在本文件镜像 5 条 trip 的核心字段(id / user_id / title / city /
//     start_date / end_date / status / createdAt)用于演示
//   - days[].items[] 在 db_trips **不**保留(任务 3 草稿补全不需要详细 itinerary,
//     任务 5 拖动后续在 db 内存独立维护 ItineraryItem,per schema.js:90-100)
//
// 跨端兼容性:
//   - 本文件**无副作用**,仅导出 Object.freeze 的常量
//   - 不调 `uni.setStorageSync` / `uni.getStorageSync` / `uni.*`(只导出数据)
//   - H5 + Android App 端 0 差异

import { logger } from '../utils/logger.js'

/**
 * MVP 单用户(per docs/API接口文档.md §1.3:`user_id` 固定为 1)
 *
 * User 字段构成:
 *   - id                : string       — 字符串 key(`'1'`),与后端数字 `user_id=1` 对应
 *   - nickname          : string       — MyPage 用户信息卡片显示(衍生字段)
 *   - avatarEmoji       : string       — emoji 占位头像(无头像功能,per spec)
 *   - explanation_style : 'professional' | 'fun' | 'children'  — from seedPreferences
 *   - travel_pace       : 'compact' | 'normal' | 'slow'        — from seedPreferences
 *   - interests         : Interest[]                          — from seedPreferences
 *   - special_needs     : SpecialNeed[]                       — from seedPreferences
 *   - createdAt         : ISO 8601 string                     — 用户创建时间
 *
 * @type {Readonly<Record<string, Readonly<import('./schema.js').User>>>}
 */
export const seedUsers = Object.freeze({
  '1': Object.freeze({
    id: '1',
    nickname: '旅行者',
    avatarEmoji: '🧳',
    explanation_style: 'fun',
    travel_pace: 'slow',
    interests: Object.freeze(['history', 'photo']),
    special_needs: Object.freeze(['less_walking']),
    createdAt: '2026-05-01T00:00:00+08:00',
  }),
})

/**
 * MVP 演示用 5 条 trip —— 从 `api/mock/_seed.ts:172-237` `seedTrips` 镜像
 *
 * Trip 字段构成(精简版,**不**含 days[].items[]):
 *   - id          : string         — 字符串 key(`'1'` ~ `'5'`)
 *   - user_id     : string         — MVP 固定 `'1'`
 *   - title       : string         — 行程标题
 *   - city        : string         — 目的地
 *   - start_date  : string         — 出发日期 'YYYY-MM-DD'
 *   - end_date    : string         — 返回日期 'YYYY-MM-DD'
 *   - status      : TripStatus     — 'active' | 'draft' | 'finished' | 'deleted'
 *   - createdAt   : ISO 8601 string — 草稿详情「首次创建于 Y」展示用(seedTrip2 青岛)
 *
 * 镜像字段范围(per issue §3 硬规则:不**改 mock data):
 *   - 仅镜像 5 条 trip 的核心字段,**不**复制 days[].items[](per spec §1 MVP YAGNI)
 *   - 若 mock 的 seedTrips 形状变更,**只**更新本文件,不动 mock(单向镜像)
 *
 * @type {Readonly<Record<string, Readonly<import('./schema.js').Trip>>>}
 */
export const seedTrips = Object.freeze({
  '1': Object.freeze({
    id: '1',
    user_id: '1',
    title: '大连三日游',
    city: '大连',
    start_date: '2026-07-01',
    end_date: '2026-07-03',
    status: 'active',
    createdAt: '2026-06-01T00:00:00+08:00',
  }),
  '2': Object.freeze({
    id: '2',
    user_id: '1',
    title: '青岛两日周末',
    city: '青岛',
    start_date: '2026-08-15',
    end_date: '2026-08-16',
    status: 'draft',
    createdAt: '2026-06-02T00:00:00+08:00',
  }),
  '3': Object.freeze({
    id: '3',
    user_id: '1',
    title: '西安四日文化行',
    city: '西安',
    start_date: '2026-05-01',
    end_date: '2026-05-04',
    status: 'finished',
    createdAt: '2026-04-20T00:00:00+08:00',
  }),
  '4': Object.freeze({
    id: '4',
    user_id: '1',
    title: '西藏自驾游',
    city: '拉萨',
    start_date: '2026-06-01',
    end_date: '2026-06-03',
    status: 'deleted',
    createdAt: '2026-05-15T00:00:00+08:00',
  }),
  '5': Object.freeze({
    id: '5',
    user_id: '1',
    title: '上海周末',
    city: '上海',
    start_date: '2026-04-15',
    end_date: '2026-04-16',
    status: 'deleted',
    createdAt: '2026-04-10T00:00:00+08:00',
  }),
})

/**
 * Schema 版本号 —— 后续 `_seed` 形状变更时,递增
 * `initLocalDb()` 启动时比对 `db_meta.version`:
 *   - 缺失 / 低于当前 → 用当前 seed 覆盖(升级路径)
 *   - 高于当前 → 报错 + 不动(MVP 暂不处理向前兼容)
 *
 * v1: 首版(2026-06-06),与本文件 `seedUsers` 形状一致
 * v2: 2026-06-06 任务 3 落地,新增 `seedTrips`(5 trips)用于 db_trips 初始化
 */
export const SEED_VERSION = 2

/**
 * Logger:seed 已被消费(给 dev console 提示)
 * 仅 dev 启用,生产 tree-shake 掉
 */
if (import.meta.env?.DEV) {
  logger.info('[db._seed] loaded', {
    userCount: Object.keys(seedUsers).length,
    tripCount: Object.keys(seedTrips).length,
    version: SEED_VERSION,
  })
}
