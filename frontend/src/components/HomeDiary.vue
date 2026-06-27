<!--
  HomeDiary.vue — 探险日记主视图(spec §3 / §5 / §8.1)
  
  Spec contract: specs/HomePage.md §8.1
  
  Props
    today      : TodayData     今日行程(spec §7.2 形状)
    favorites  : number[]      已收藏 TripItem.id 列表
  
  Emits
    selectSpot    : TripItem    用户点某 SpotCard,父组件打开 SpotDetailSheet
    viewFullTrip  : void        用户点"查看完整行程 >",父组件跳 TripDetailPage
    reminderTap   : number      用户点某 ReminderChip(本页面 MVP 不挂载,父组件忽略)
  
  Slots:无
-->
<template>
  <view
    v-if="today"
    class="home-diary"
  >
    <!-- DiaryHeader -->
    <view class="diary-header">
      <text class="greeting-line">{{ greetingText }}</text>
      <text class="title-line">{{ titleText }}</text>
    </view>

    <!-- SpotTimeAxis -->
    <SpotTimeAxis
      :items="sortedItems"
      :favorites="favorites"
      :active-id="activeId"
      @select="onSelectSpot"
    />

    <!-- FooterBlock(spec §3.1 末块) -->
    <view class="diary-footer">
      <view
        class="btn-view-full-trip"
        role="button"
        :aria-label="viewFullTripLabel"
        hover-class="btn-view-full-trip-hover"
        :hover-stay-time="50"
        @click="onViewFullTrip"
      >
        <text class="btn-view-full-trip-text">{{ viewFullTripLabel }}</text>
        <text class="btn-view-full-trip-arrow" aria-hidden="true">›</text>
      </view>
    </view>
  </view>
</template>

<script setup>
import { computed } from 'vue'
import SpotTimeAxis from './SpotTimeAxis.vue'
import { HomeStrings } from '../constants/strings.js'

const props = defineProps({
  /** @type {import('vue').PropType<{
   *   trip_id: number, trip_title: string,
   *   trip_start_date: string, // v0.6.0 新增(per user-round4-2026-06-26)
   *   date: string,
   *   today_items: import('../api/types').TripItem[], unread_reminders: number
   *   (city 字段已移除 per 2026-06-24 审计清理)
   * }>} */
  today: {
    type: Object,
    required: true,
  },
  /** @type {import('vue').PropType<number[]>} */
  favorites: {
    type: Array,
    required: true,
  },
})

const emit = defineEmits(['selectSpot', 'viewFullTrip', 'reminderTap'])

// ───────── Computed ─────────

/**
 * 按 start_time 升序(spec §9 AC-02:"时间轴卡片按 TripItem.start_time 升序排列")
 */
const sortedItems = computed(() => {
  const items = [...(props.today?.today_items || [])]
  items.sort((a, b) => {
    const sa = a.start_time || ''
    const sb = b.start_time || ''
    return sa.localeCompare(sb)
  })
  return items
})

/**
 * 当前进行中的 item id(由后端 status + 当前时间判断);
 * 给 SpotTimeAxis activeId prop
 */
const activeId = computed(() => {
  const items = props.today?.today_items || []
  const now = new Date()
  const minutes = now.getHours() * 60 + now.getMinutes()
  const found = items.find((it) => {
    if (it.status !== 'planned') return false
    const [sh, sm] = (it.start_time || '00:00').split(':').map(Number)
    const [eh, em] = (it.end_time || '23:59').split(':').map(Number)
    const s = sh * 60 + sm
    const e = eh * 60 + em
    return minutes >= s && minutes <= e
  })
  return found?.id ?? null
})

/**
 * 今日是 trip 的第几天:从 trip.start_date 算起
 * v0.6.0(per user-round4-2026-06-26 19:46):严格按 today.date - trip.start_date 算
 * 公式:day_index = Math.floor((today.date - trip.start_date) / 86400000) + 1
 * 边界:today < trip.start_date → 防御返回 1(today 接口本身已过滤 end_date >= today)
 *      today/trip_start_date 字段缺失或 NaN → 防御返回 1
 */
const dayIndex = computed(() => {
  if (!props.today) return 1
  const startDate = props.today.trip_start_date
  const todayDate = props.today.date
  if (!startDate || !todayDate) return 1
  const start = new Date(startDate).getTime()
  const today = new Date(todayDate).getTime()
  if (Number.isNaN(start) || Number.isNaN(today)) return 1
  const diffDays = Math.floor((today - start) / 86400000) + 1
  return Math.max(1, diffDays)   // 防御:负数兜底为 1
})

/**
 * 问候语按时段切换(spec §3 DiaryHeader)
 */
const greetingText = computed(() => {
  const h = new Date().getHours()
  if (h < 11) return `${HomeStrings.greetingEmojiMorning} ${HomeStrings.greetingMorning}`
  if (h < 18) return `${HomeStrings.greetingEmojiNoon} ${HomeStrings.greetingNoon}`
  return `${HomeStrings.greetingEmojiEvening} ${HomeStrings.greetingEvening}`
})

const titleText = computed(() => {
  const t = props.today
  if (!t) return ''
  return `${HomeStrings.diaryTitlePrefix}${t.trip_title}${HomeStrings.diaryTitleSuffix}${dayIndex.value}${HomeStrings.diaryDaySuffix}`
})

const viewFullTripLabel = computed(() => HomeStrings.viewFullTrip)

// ───────── Handlers ─────────

/**
 * @param {import('../api/types').TripItem} item
 */
function onSelectSpot(item) {
  emit('selectSpot', item)
}

function onViewFullTrip() {
  emit('viewFullTrip')
}
</script>

<style scoped>
.home-diary {
  display: flex;
  flex-direction: column;
  gap: 16rpx;
  /* space-md */
  background: #FDFBF7;
  /* Surface Card */
  border-radius: 16px;
  /* radius-lg */
  padding: 24rpx 0;
  box-sizing: border-box;
  margin: 0 40rpx;
  /* 水平边距 40rpx(垂直不限制,允许内容外溢) */
  box-shadow: 0 2rpx 8rpx rgba(0, 0, 0, 0.04);
  /* shadow-sm */
}

.diary-header {
  display: flex;
  flex-direction: column;
  gap: 8rpx;
  padding: 0 40rpx;
  /* 水平内边距与 Body 对齐 */
  box-sizing: border-box;
}

.greeting-line {
  font-family: 'Noto Sans SC', sans-serif;
  font-size: 26rpx;
  /* 13px */
  color: #5A5A5A;
  /* inkLight */
  line-height: 1.4;
}

.title-line {
  font-family: 'Noto Serif SC', serif;
  font-size: 36rpx;
  /* 18px,中标题 */
  font-weight: 600;
  color: #2C2C2C;
  /* ink */
  line-height: 1.4;
}

.diary-footer {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 8rpx 40rpx 0;
  box-sizing: border-box;
}

.btn-view-full-trip {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8rpx;
  padding: 16rpx 32rpx;
  min-height: 88rpx;
  /* ≥ 44pt tap area */
  background: rgba(45, 106, 94, 0.08);
  /* primarySoft */
  border-radius: 9999px;
  /* radius-full */
  box-sizing: border-box;
  transition: transform 0.15s ease-out, background 0.15s ease-out;
}

.btn-view-full-trip-hover {
  transform: scale(0.96);
  background: rgba(45, 106, 94, 0.16);
}

.btn-view-full-trip-text {
  font-family: 'Noto Sans SC', sans-serif;
  font-size: 28rpx;
  /* 14px */
  font-weight: 500;
  color: #2D6A5E;
  /* primary */
  line-height: 1.4;
}

.btn-view-full-trip-arrow {
  font-size: 32rpx;
  color: #2D6A5E;
  line-height: 1;
  font-weight: 300;
}
</style>
