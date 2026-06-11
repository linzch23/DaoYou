<!--
  TripCard.vue — 跨页通用行程列表卡片
  
  Spec contract: specs/HomePage.md §8.6
  
  Props
    trip  : TripSummary   行程(字段见 api/types.ts:82-89)
  
  Emits
    tap   : void          用户点击卡片
  
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
        <text class="trip-card-city">📍 {{ trip.city }}</text>
        <text class="trip-card-date">{{ dateRangeText }}</text>
      </view>
    </view>
    <text class="trip-card-arrow" aria-hidden="true">›</text>
  </view>
</template>

<script setup>
import { computed } from 'vue'
import { HomeTripStatusLabel } from '../constants/strings.js'

const props = defineProps({
  /** @type {import('vue').PropType<import('../api/types').TripSummary>} */
  trip: {
    type: Object,
    required: true,
  },
})

const emit = defineEmits(['tap'])

// v0.2.0 修订(per TrashPage spec §6.4.4 Resolved):TripStatus 4→3 枚举后,
// 'deleted' 语义由 deleted_at 字段承担;UI 仍禁点已删 trip 不可跳详情(per spec §7.1 决策)
// 兼容旧 mock 数据中 deleted_at 可能为 undefined 的边界(用 != 兜底 null/undefined)
const isDisabled = computed(() => props.trip.deleted_at != null)

const statusLabel = computed(
  () => HomeTripStatusLabel[props.trip.status] || props.trip.status
)

const dateRangeText = computed(
  () => `${props.trip.start_date} ~ ${props.trip.end_date}`
)

const ariaLabel = computed(
  () => `${props.trip.title},${statusLabel.value},${dateRangeText.value}`
)

function onTap() {
  emit('tap')
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

.trip-card-city,
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
</style>
