// src/utils/tripStatus.js
// TripStatus 派生 helper — 把后端返回的 trip.status + 完整行程字段 + today 综合,
// 派生"用户实际看到的"状态。
//
// v0.5.0(per user-round3-2026-06-26)新增 — client-derive(per ask_user Q2)
//   触发原因:user 报「东莞 trip 时间已过 status 没切 finished」
//   派生规则 v0.5.0:看 trip.status 字段(后端持久化值) + today vs end_date
//     - status='active' + today > end_date → 'finished'(核心 bug 修复)
//     - status='active' + today < start_date → 'upcoming'
//     - status='active' + 中间 → 'inProgress'
//
// v0.6.0(per user-round4-2026-06-26 19:46)重写 — 4 状态 + 完整行程判定
//   触发原因:user 报「草稿/进行中/已结束的判断逻辑应为:若有行程标题、起始日期、有至少一个行程,
//     则视为完整行程;对于完整行程结束日期大于等于当前日期则判断为进行中,否则为已结束。
//     若缺少任何字段则都视为草稿或无法建立草稿。 现在的逻辑似乎只要有标题和起始日期就能"进行中"
//     且"草稿"没有办法转变为"进行中"」
//   派生规则 v0.6.0(per spec `specs/HomePage.md` §3.1.1 v0.6.0 状态机重写):
//     1. deleted_at != null                  → 'deleted'(软删,与 status 字段无关)
//     2. !title || !start_date || !end_date || itinerary_count === 0 → 'draft'(不完整)
//     3. today > end_date                    → 'finished'(已结束)
//     4. today <= end_date                   → 'inProgress'(进行中,含 today < start_date + today in [start, end])
//   删掉 v0.5.0 的 'upcoming' 状态(user 不需要,today < start_date 也是 inProgress)
//   删掉原 status 字面分支(user 期望「草稿不能转变进行中」是因为 trip.status='draft' 永远不会自动变,
//     现在改为前端派生,只要 user 加 itinerary item,下次 fetch 后就变 inProgress — 这正是 user 期望的)
//
//   跨页影响(per cross-page fix-only 协议):
//     - 后端 `serialize_trip_summary` v0.6.0 新增 itinerary_count 字段(subquery 避免 N+1)
//     - 前端 `api/types.ts:TripSummary` v0.6.0 新增 itinerary_count 字段
//     - `src/components/TripCard.vue` L97-105 已用 `computeEffectiveStatus` 派生 → 0 改动
//     - `src/pages/trip-detail/index.vue` L472-485 / `src/pages/edit-trip/index.vue` L528-545
//       既有 active×日期派生 0 改动(本 helper 升级后,其派生值也走新 4 状态)
//
// 注意:本函数**不**修改入参 trip,**不**调任何 API,**不**持久化,纯计算函数
// 跨端兼容:本文件**无副作用**,仅导出 Object.freeze + 纯函数
//
// 边界:
//   - start_date / end_date 格式: 'YYYY-MM-DD'(per `api/types.ts:118-119`)
//   - itinerary_count: 来自后端 serialize_trip_summary v0.6.0,缺字段时 fallback 0(向后兼容)
//   - today: 取 `new Date()`(本地时区,后端跨时区场景后续 IssueManager 提议)
//   - today <= end_date 含等号(等号归属 inProgress)
//   - today > end_date 含严格大于(等号归属 inProgress)
//
// 后续扩展:如需"3 天内即将开始"等更细分,可加 `effectiveSubStatus` 派生,
//   但本 task 范围仅 4 状态

import { logger } from './logger.js'

/**
 * 派生 trip 的"用户可见状态",考虑 today vs end_date + 完整行程判定
 * 纯函数,**不**修改入参
 *
 * v0.6.0(per user-round4-2026-06-26 19:46 bug 修复)4 状态重写:
 *   - deleted_at != null                                → 'deleted'
 *   - !title || !start_date || !end_date || itinerary_count === 0 → 'draft'
 *   - today > end_date                                  → 'finished'
 *   - today <= end_date                                 → 'inProgress'
 *
 * @param {object} trip TripSummary 形状(`api/types.ts:126-141`)
 *   v0.6.0 新增字段:itinerary_count(后端 serialize_trip_summary v0.6.0 返回)
 * @param {Date} [refDate] 派生参考时间(默认 new Date()),便于测试注入
 * @returns {'draft' | 'inProgress' | 'finished' | 'deleted'}
 */
export function computeEffectiveStatus(trip, refDate) {
  if (!trip) return 'draft'
  const now = refDate || new Date()

  // 1. 软删优先(deleted_at 非 null)
  if (trip.deleted_at != null) {
    return 'deleted'
  }

  // 2. 完整行程判定(per user-round4-2026-06-26 19:46 期望)
  //    缺任一字段(title / start_date / end_date / itinerary_count=0)→ 草稿
  //    这正是 user 报「草稿不能转变为进行中」的根因:
  //      trip.status='draft' 是后端持久化字段,**任何**机制都不会自动改
  //      改前端派生后,只要 user 加 itinerary item,下次 fetch 后 status='draft' 的 trip
  //      因 itinerary_count=1 重新判定为完整行程 → inProgress / finished
  //      这正是 user 期望的「草稿转进行中」语义
  const hasTitle = !!(trip.title && trip.title.trim())
  const hasStartDate = !!trip.start_date
  const hasEndDate = !!trip.end_date
  const hasItems = (trip.itinerary_count ?? 0) > 0
  if (!hasTitle || !hasStartDate || !hasEndDate || !hasItems) {
    return 'draft'  // 缺字段 → 草稿(per user 19:46)
  }

  // 3. 完整行程 + 日期判定
  // today 是 Date 对象,取 YYYY-MM-DD 后与字符串比较(避免时区问题)
  const today = formatDateOnly(now)
  if (today > trip.end_date) return 'finished'  // 已结束(东莞 trip 场景 + 任何过期 trip)
  return 'inProgress'  // 进行中(含 today <= start_date + today in [start, end] 全部情况)
}

/**
 * 格式化 Date 对象为 'YYYY-MM-DD' 字符串(local time)
 * 内部 helper,仅供 computeEffectiveStatus 使用
 * @param {Date} d
 * @returns {string}
 */
function formatDateOnly(d) {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}
