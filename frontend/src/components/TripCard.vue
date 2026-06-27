<!--
  TripCard.vue — 跨页通用行程列表卡片

  Spec contract: specs/HomePage.md §8.6

  Props
    trip  : TripSummary   行程(字段见 api/types.ts:82-89)

  Emits
    tap    : void          用户点击卡片(跳详情)
    chat   : void          用户点击 chat 按钮(跳 chat page,2026-06-24 新增入口)
    delete : void          用户点击 delete 按钮(弹 DeleteConfirmDialog,2026-06-24 UserRound2-001 §3 Bug C 新增)

  Slots:无
-->
<template>
  <view
    class="trip-card"
    :class="{ 'trip-card-disabled': isDisabled }"
    role="button"
    :aria-label="ariaLabel"
    hover-class="trip-card-hover"
    :hover-stay-time="50"
    @click="onTap"
  >
    <view class="trip-card-content">
      <view class="trip-card-row">
        <text class="trip-card-title">{{ trip.title }}</text>
        <view class="trip-card-status" :class="`trip-card-status-${trip.status}`">
          <text class="trip-card-status-text">{{ statusLabel }}</text>
        </view>
      </view>
      <view class="trip-card-row trip-card-meta">
        <text class="trip-card-date">{{ dateRangeText }}</text>
      </view>
    </view>
    <!-- 2026-06-24 新增:每条 trip 的 chat 入口,@click.stop 阻止冒泡到 card 自身的 onTap -->
    <view
      class="btn-chat-trip"
      :class="{ 'btn-chat-trip-disabled': isDisabled }"
      role="button"
      :aria-label="chatButtonAria"
      :aria-disabled="isDisabled ? 'true' : 'false'"
      hover-class="btn-chat-trip-hover"
      :hover-stay-time="50"
      @click.stop="onChatTap"
    >
      <text class="btn-chat-trip-icon" aria-hidden="true">{{ chatButtonLabel }}</text>
    </view>
    <!-- 2026-06-24 UserRound2-001 §3 Bug C 新增:草稿/已结束 trip 显示删除入口
         @click.stop 阻止冒泡到 card 自身的 onTap(避免同时跳详情);
         canDelete 控制显隐:active trip 不显示,引导走回收站(per HomeStrings.deleteActiveTripToast) -->
    <view
      v-if="canDelete"
      class="btn-delete-trip"
      role="button"
      :aria-label="deleteButtonAria"
      hover-class="btn-delete-trip-hover"
      :hover-stay-time="50"
      @click.stop="onDeleteTap"
    >
      <text class="btn-delete-trip-icon" aria-hidden="true">{{ deleteButtonLabel }}</text>
    </view>
    <text class="trip-card-arrow" aria-hidden="true">›</text>
  </view>
</template>

<script setup>
import { computed } from 'vue'
import { HomeTripStatusLabel, HomeStrings } from '../constants/strings.js'
// v0.5.0 新增(per user-round3-2026-06-26 + ask_user Q2 client-derive 拍板):
// 派生 effective_status 替代后端 status 字面(东莞 trip 时间已过需显示「已结束」)
// 派生规则见 src/utils/tripStatus.js:deleted / draft / finished 直传;active 按 today 派生 upcoming/inProgress/finished
import { computeEffectiveStatus } from '../utils/tripStatus.js'

const props = defineProps({
  /** @type {import('vue').PropType<import('../api/types').TripSummary>} */
  trip: {
    type: Object,
    required: true,
  },
})

const emit = defineEmits(['tap', 'chat', 'delete'])

// v0.2.0 修订(per TrashPage spec §6.4.4 Resolved):TripStatus 4→3 枚举后,
// 'deleted' 语义由 deleted_at 字段承担;UI 仍禁点已删 trip 不可跳详情(per spec §7.1 决策)
// 兼容旧 mock 数据中 deleted_at 可能为 undefined 的边界(用 != 兜底 null/undefined)
const isDisabled = computed(() => props.trip.deleted_at != null)

// 2026-06-24 UserRound2-001 §3 Bug C 新增:delete 按钮可见性门控
// 仅 draft / finished trip 显示(active 引导走回收站 + 弹 toast 提示);
// 已删 trip(deleted_at 非空)不可删,与 isDisabled 一致
const canDelete = computed(
  () => !isDisabled.value && (props.trip.status === 'draft' || props.trip.status === 'finished')
)

// v0.5.0 派生 effective_status(per user-round3-2026-06-26 + ask_user Q2 client-derive 拍板)
// v0.6.1 重写(per user-round4-2026-06-26 19:46 bug 修复):4 状态派生 —
//   draft(缺任一字段) / inProgress(完整 + today <= end_date) / finished(完整 + today > end_date) / deleted(软删)
// 派生规则见 src/utils/tripStatus.js
// 不修改入参 trip / 不调 API / 不持久化,纯计算
const effectiveStatus = computed(
  () => computeEffectiveStatus(props.trip)
)

// 显示文案:沿用 HomeTripStatusLabel(已有 draft/active/finished/inProgress/deleted 5 键,per v0.6.1.1 fix)
// v0.6.1.1 fix(per verifier feedback attempt 1):新增 inProgress 键,核心 bug 修复 2 才能落地
//   - 旧 v0.5.0 fallback chain `HomeTripStatusLabel[effectiveStatus] || HomeTripStatusLabel[trip.status]`
//     对 DB `status='draft'` + itinerary_count >= 1 的 trip 持续显示「草稿」(因为 fallback 回 'draft' 键)
//   - 修法:加 inProgress 键后,label 走「进行中」,与 v0.6.1 helper 派生值一致
// 视觉:东莞 trip 过期显示「已结束」(核心 bug 修复 1);草稿 trip 加 item 后变「进行中」(核心 bug 修复 2)
const statusLabel = computed(
  () => HomeTripStatusLabel[effectiveStatus.value]
    || HomeTripStatusLabel[props.trip.status]
    || props.trip.status
)

const dateRangeText = computed(
  () => `${props.trip.start_date} ~ ${props.trip.end_date}`
)

const ariaLabel = computed(
  () => `${props.trip.title},${statusLabel.value},${dateRangeText.value}`
)

// 2026-06-24 新增:chat 按钮文案 + aria 派生(per AGENTS.md §8.6 13 页面惯例)
// aria 模板带 {title} 占位,运行时插值更准
const chatButtonLabel = computed(() => HomeStrings.btnChatTrip)

const chatButtonAria = computed(() =>
  HomeStrings.btnChatTripAria.replace('{title}', props.trip.title)
)

// 2026-06-24 UserRound2-001 §3 Bug C 新增:delete 按钮文案 + aria 派生
const deleteButtonLabel = computed(() => HomeStrings.btnDeleteTrip)

const deleteButtonAria = computed(() =>
  HomeStrings.btnDeleteTripAria.replace('{title}', props.trip.title)
)

function onTap() {
  emit('tap')
}

// 2026-06-24 新增:chat 按钮点击 → emit 'chat' 事件(父组件跳 chat page)
// @click.stop 已在 template 加,不冒泡到 card 自身的 onTap(避免同时跳详情)
function onChatTap() {
  if (isDisabled.value) return
  emit('chat')
}

// 2026-06-24 UserRound2-001 §3 Bug C 新增:delete 按钮点击 → emit 'delete' 事件
// 父组件 HomePage 弹 DeleteConfirmDialog 二次确认
function onDeleteTap() {
  if (!canDelete.value) return
  emit('delete')
}
</script>

<style scoped>
.trip-card {
  display: flex;
  align-items: center;
  gap: 16rpx;
  background: #FDFBF7;
  /* Surface Card */
  border: 1.5rpx solid rgba(45, 106, 94, 0.06);
  /* borderSubtle */
  border-radius: 16px;
  /* radius-lg */
  padding: 24rpx;
  /* space-lg */
  min-height: 88rpx;
  /* ≥ 44pt tap area */
  box-shadow: 0 2rpx 8rpx rgba(0, 0, 0, 0.04);
  /* shadow-sm */
  box-sizing: border-box;
  transition: transform 0.15s ease-out, box-shadow 0.15s ease-out;
}

.trip-card-hover {
  transform: scale(0.96);
  box-shadow: 0 4rpx 16rpx rgba(0, 0, 0, 0.1);
}

.trip-card-disabled {
  opacity: 0.6;
  pointer-events: none;
}

.trip-card-content {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 8rpx;
}

.trip-card-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16rpx;
}

.trip-card-title {
  font-family: 'Noto Serif SC', serif;
  font-size: 32rpx;
  /* 16px,小标题 */
  font-weight: 600;
  color: #2C2C2C;
  /* ink */
  line-height: 1.3;
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.trip-card-status {
  flex-shrink: 0;
  padding: 4rpx 16rpx;
  border-radius: 9999px;
  /* radius-full */
  background: rgba(45, 106, 94, 0.08);
  /* primarySoft */
}

.trip-card-status-text {
  font-family: 'Noto Sans SC', sans-serif;
  font-size: 22rpx;
  /* 11px,小标签 */
  color: #2D6A5E;
  /* primary */
  line-height: 1.4;
}

.trip-card-status-draft .trip-card-status-text {
  color: #5A5A5A;
  /* inkLight */
}

.trip-card-status-finished {
  background: rgba(154, 154, 154, 0.1);
}

.trip-card-status-finished .trip-card-status-text {
  color: #9A9A9A;
  /* inkMuted */
}

.trip-card-status-deleted {
  background: rgba(196, 74, 58, 0.08);
  /* dangerSoft */
}

.trip-card-status-deleted .trip-card-status-text {
  color: #C44A3A;
  /* danger */
}

.trip-card-meta {
  font-family: 'Noto Sans SC', sans-serif;
  font-size: 24rpx;
  /* 12px */
  color: #5A5A5A;
  /* inkLight */
  line-height: 1.4;
}

.trip-card-date {
  font-family: 'Noto Sans SC', sans-serif;
  font-size: 24rpx;
  color: #5A5A5A;
  line-height: 1.4;
}

.trip-card-arrow {
  flex-shrink: 0;
  font-size: 40rpx;
  color: #9A9A9A;
  /* inkMuted */
  line-height: 1;
  font-weight: 300;
}

/* 2026-06-24 新增:chat 入口按钮(per task「每行程独立 chatSession」)
   - 位置:card 右侧,arrow 之前(主操作 → 次操作 → 装饰)
   - 88×88rpx 圆形,primarySoft 背景,emoji 💬 图标
   - ≥ 44pt 触达(per AGENTS.md §8.6 NFR)
   - hover 态:背景加深 + scale 0.96(沿 trip-card 一致)
   - disabled:沿 trip-card 一致(opacity 0.5 + pointer-events: none)
   - 0 触动既有 .trip-card 既有 5 段 CSS + .trip-card-disabled 既有视觉态 */
.btn-chat-trip {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 88rpx;
  height: 88rpx;
  min-width: 88rpx;
  min-height: 88rpx;
  /* ≥ 44pt tap area */
  border-radius: 9999px;
  /* radius-full */
  background: rgba(45, 106, 94, 0.08);
  /* primarySoft */
  flex-shrink: 0;
  box-sizing: border-box;
  transition: background 0.15s ease-out, transform 0.15s ease-out;
}

.btn-chat-trip-hover {
  background: rgba(45, 106, 94, 0.16);
  /* primarySoft 加深(16%) */
  transform: scale(0.96);
}

.btn-chat-trip-disabled {
  opacity: 0.5;
  pointer-events: none;
}

.btn-chat-trip-icon {
  font-size: 36rpx;
  /* 18px emoji */
  line-height: 1;
  font-family: 'Apple Color Emoji', 'Segoe UI Emoji', 'Noto Color Emoji', sans-serif;
  /* 跨平台 emoji 渲染 */
}

/* 2026-06-24 UserRound2-001 §3 Bug C 新增:草稿/已结束 trip 显示的删除入口
   - 位置:chat button 之后,arrow 之前(主操作 → chat → delete → 装饰)
   - 64×64rpx 圆形,surfaceWarm 背景,emoji 🗑 图标
   - ≥ 44pt 触达(per AGENTS.md §0 NFR)
   - hover 态:背景加深 + scale 0.96(沿 btn-chat-trip 一致)
   - 仅 draft / finished trip 渲染(active 不可见,引导走回收站 + 弹 toast 提示)
   - 0 触动既有 .trip-card 5 段 CSS + .btn-chat-trip 既有视觉态 */
.btn-delete-trip {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 64rpx;
  height: 64rpx;
  min-width: 88rpx;
  min-height: 88rpx;
  /* ≥ 44pt tap area(per AGENTS.md §0 NFR) */
  border-radius: 9999px;
  /* radius-full */
  background: #F2EBE0;
  /* surfaceWarm,见 UI §二 */
  flex-shrink: 0;
  box-sizing: border-box;
  transition: background 0.15s ease-out, transform 0.15s ease-out;
}

.btn-delete-trip-hover {
  background: rgba(196, 74, 58, 0.12);
  /* dangerSoft,删除语义 — hover 提示可点 */
  transform: scale(0.96);
}

.btn-delete-trip-icon {
  font-size: 32rpx;
  /* 16px emoji */
  line-height: 1;
  font-family: 'Apple Color Emoji', 'Segoe UI Emoji', 'Noto Color Emoji', sans-serif;
  /* 跨平台 emoji 渲染 */
}
</style>
