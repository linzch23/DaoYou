// src/utils/tripStatus.js
// TripStatus 派生 helper — 把后端返回的 trip.status + today 综合,
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
//   派生规则 v0.6.0:看字段完整性(title / start_date / end_date / itinerary_count)
//     缺任一字段 → 'draft';完整 + today > end_date → 'finished';否则 'inProgress'
//
// v0.6.1(per fix-trip-status-machine 2026-06-26)4 状态 strict 化 + HomeTripStatusLabel 加 inProgress 键
//   修复 TripCard fallback chain 吞 inProgress 派生值的 verifier feedback
//
// v0.6.2(per fix-trip-status-effective 2026-07-03)优先级重排 — 已结束覆盖不完整行程
//   把 today > end_date → finished 提前到「缺字段→草稿」之前,修复「已结束 + 删光 items」仍显示草稿 bug
//
// v0.7.0(per fix-trip-status-v0.7.0 2026-07-03 + issues/Cross-Page/TripStatusConsistent-001 v2)重写
//   触发原因:user 报「三重脱节」— 显示用 helper 派生(看字段 + items + 日期),点击/删除用后端 trip.status 字面,
//     显示与点击各走各路;EditTripPage 不发 status,草稿加 item 后,后端 status='draft' 与显示派生值不一致
//   修复路径(per user 2026-07-03 12:39 决策):
//     - 完全放弃「缺字段/items=0 → 草稿」派生(v0.6.x 引入的字段完整性启发式被废除)
//     - 4 状态独立判定,**只看**后端 status 字段 + 日期:
//
//     新派生规则 v0.7.0(优先级 1→2→3):
//       1. deleted_at != null                       → 'deleted'(软删,per docs/API接口文档.md §3.1)
//       2. trip.status === 'draft'                  → 'draft'(后端持久化的草稿语义,UI 「保存为草稿」入口)
//       3. trip.status === 'finished'               → 'finished'(后端持久化的已结束语义,优先级最高,避免客户端日期误判)
//       4. status='active' 按日期派生:
//          - today < start_date → 'upcoming'        (未开始)
//          - today > end_date   → 'finished'        (客户端派生已结束,补充后端未切 case)
//          - today in [start_date, end_date] → 'inProgress'
//
//   字面影响:
//     - 「保存为草稿」+ 任意 items → 'draft'(v0.6.2 给的 inProgress 撤销);点击 → EditTripPage
//     - 「保存为草稿」+ EditTripPage 满足「完整字段 + 至少 1 item」保存 → 隐式发布为 'active'(per Issue Q1 决策 C 方案)
//       → 下次 fetch 后 helper 派生 = status='active' + today 派生(走日期分流)
//     - 后端 status='active' + 任意 items 数(包括 0) → helper 派生按日期判定
//     - 后端 status='active' + 0 items 但 today>end_date → helper 派生 'finished'(客户端兜底,真链路上后端 finalize 会写入 status='finished')
//     - 后端 status='active' + today<start_date → helper 派生 'upcoming'(沿 v0.5.0 决策)
//
//   显示/点击同源化收益(per Issue §2.2):
//     - pages/home/index.vue onSelectTrip / onDeleteTrip / TripCard canDelete 全部改用 helper 派生
//     - pages/trip-detail/index.vue decideSubStatus 4 子态(draft / upcoming / inProgress / finished)
//       直接 return computeEffectiveStatus(trip, ref),'expired' 子态**不再可达**(helper 拦到 finished)
//     - 显示端 + 点击端 + 删除可见性 1:1 对齐,用户行为可预测
//
//   EditTripPage 隐式发布(per Issue §2.4 + user Q1 决策 C 方案):
//     - 草稿 trip(status='draft')在满足「完整字段 + ≥1 item」保存时,doUpdate 调 PUT 额外附 status='active'
//     - 后端 Pydantic `UpdateTripRequest` 2026-06-26 v0.5.0 扩展已接受 `status?: TripStatus` 字段
//     - api/types.ts:UpdateTripRequest.status? 字段(v0.7.0 验证**已经**存在,本 fix **不**触动 types 文件)
//     - 不发 status 时,**不**主动发 'finished' 或 强切 'draft',沿 v0.4.0 TripCreateEditFix-001 决策
//
// 注意:本函数**不**修改入参 trip,**不**调任何 API,**不**持久化,纯计算函数
// 跨端兼容:本文件**无副作用**,仅导出 Object.freeze + 纯函数
//
// 边界:
//   - start_date / end_date 格式: 'YYYY-MM-DD'(per `api/types.ts:118-119`)
//   - trip.status 必须是 'draft' | 'active' | 'finished' 3 枚举之一(per `api/types.ts:103`)
//   - today: 取 `new Date()`(本地时区,后端跨时区场景后续 IssueManager 提议)
//   - today < start_date 含严格小于(等号归属 inProgress)
//   - today > end_date 含严格大于(等号归属 inProgress)
//   - v0.7.0 简化:helper 不再读 itinerary_count / title 字段(只做 status + 日期派生)
//
// 后续扩展:如需"3 天内即将开始"等更细分,可加 `effectiveSubStatus` 派生,
//   但本 task 范围仅 5 状态;trip-detail 子态细分由 trip-detail 页面自行实现

/**
 * 派生 trip 的"用户可见状态",考虑 today vs end_date + 完整行程判定
 * 纯函数,**不**修改入参
 *
 * v0.7.0(per fix-trip-status-v0.7.0 2026-07-03)4 状态重写:
 *   - deleted_at != null                            → 'deleted'
 *   - trip.status === 'draft'                       → 'draft'(后端字面优先,废除 v0.6.x 字段完整性启发式)
 *   - trip.status === 'finished'                    → 'finished'(后端字面优先)
 *   - status='active' 按日期派生:
 *     - today < start_date   → 'upcoming'
 *     - today > end_date     → 'finished'
 *     - today in [start, end]→ 'inProgress'
 *
 * @param {object} trip TripSummary 形状(`api/types.ts:135-145`)
 *   v0.7.0 **不**读取 itinerary_count / title 字段(只读 status + dates + deleted_at)
 * @param {Date} [refDate] 派生参考时间(默认 new Date()),便于测试注入
 * @returns {'draft' | 'upcoming' | 'inProgress' | 'finished' | 'deleted'}
 */
export function computeEffectiveStatus(trip, refDate) {
  if (!trip) return 'draft'
  const now = refDate || new Date()

  // 1. 软删优先(deleted_at 非 null)—— 与 status 字段无关(per docs/API接口文档.md §3.1)
  if (trip.deleted_at != null) {
    return 'deleted'
  }

  // 2. 后端 status='draft' 字面优先(per v0.7.0 简化决策)
  //    废除 v0.6.x 的「缺字段/items=0 → 草稿」启发式
  //    与之前版本差异:有完整字段 + ≥1 item 的 draft trip,**不再**派生为 inProgress
  //    后续若想自动变 active,需在 EditTripPage 调用 PUT 时显式 status='active'(见 Issue §2.4)
  if (trip.status === 'draft') {
    return 'draft'
  }

  // 3. 后端 status='finished' 字面优先(避免客户端日期误判覆盖持久化值)
  if (trip.status === 'finished') {
    return 'finished'
  }

  // 4. status='active' 按 today vs 日期派生(3 子态:upcoming / finished / inProgress)
  //    注:helper 不假设 trip.start_date / trip.end_date 非空;
  //    若任一日期缺失,today vs 日期比较无意义,但 dateString > dateString 走字典序,实际无人调用此路径
  const today = formatDateOnly(now)
  if (today < trip.start_date) return 'upcoming'   // 未开始(等号归属 inProgress)
  if (today > trip.end_date) return 'finished'     // 客户端派生已结束(等号归属 inProgress)
  return 'inProgress'                              // 进行中(含 today in [start_date, end_date])
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
