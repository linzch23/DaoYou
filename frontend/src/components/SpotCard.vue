<!--
  SpotCard.vue — 景点卡片(4 态视觉,见 spec §3.1 / §8.3)
  
  Spec contract: specs/HomePage.md §8.3
  
  Props
    spot        : TripItem          单个 item
    state       : 'done' | 'active' | 'upcoming' | 'expired' | 'changed'   由父组件计算
    isFavorite  : boolean           是否已收藏(显示右上角 ❤)
  
  Emits
    tap         : void              用户点击卡片主体(expired 态不触发)
-->
<template>
  <view
    class="spot-card"
    :class="`spot-card-${state}`"
    role="button"
    :aria-label="ariaLabel"
    :aria-disabled="state === 'expired' ? 'true' : 'false'"
    :hover-class="state === 'expired' ? '' : 'spot-card-hover'"
    :hover-stay-time="50"
    @click="onTap"
  >
    <!-- 状态徽章:左上角 -->
    <view
      v-if="state === 'done'"
      class="spot-card-stamp"
      aria-hidden="true"
    >
      <text class="spot-card-stamp-text">✅</text>
    </view>
    <view
      v-else-if="state === 'active'"
      class="spot-card-now-tag"
      aria-hidden="true"
    >
      <text class="spot-card-now-tag-text">{{ nowLabel }}</text>
    </view>

    <!-- 收藏角标:右上角 -->
    <view
      v-if="isFavorite"
      class="spot-card-fav"
      aria-hidden="true"
    >
      <text class="spot-card-fav-text">❤️</text>
    </view>

    <view class="spot-card-body">
      <!-- 时间段 -->
      <text class="spot-card-time">{{ timeText }}</text>
      <!-- 标题行:type emoji + 名称 -->
      <view class="spot-card-title-row">
        <text class="spot-card-emoji" aria-hidden="true">{{ typeEmoji }}</text>
        <text class="spot-card-title">{{ spot.title }}</text>
      </view>
      <!-- 状态行:active / changed 时显示 -->
      <text
        v-if="state === 'active'"
        class="spot-card-status"
      >🟢 {{ statusLabel }}</text>
      <text
        v-else-if="state === 'changed'"
        class="spot-card-status spot-card-status-warn"
      >⚠️ {{ statusLabel }}</text>
    </view>
  </view>
</template>

<script setup>
import { computed } from 'vue'
import { HomeStrings, ItemTypeEmoji, HomeItemStatusLabel } from '../constants/strings.js'

const props = defineProps({
  /** @type {import('vue').PropType<import('../api/types').TripItem>} */
  spot: {
    type: Object,
    required: true,
  },
  /** @type {import('vue').PropType<'done' | 'active' | 'upcoming' | 'expired' | 'changed'>} */
  state: {
    type: String,
    required: true,
  },
  isFavorite: {
    type: Boolean,
    default: false,
  },
})

const emit = defineEmits(['tap'])

const nowLabel = computed(() => HomeStrings.statusNow)
const statusLabel = computed(() => {
  // active 态用 "现在",其他用后端 status 对应文案
  if (props.state === 'active') return HomeStrings.statusNow
  if (props.state === 'done') return HomeStrings.statusDone
  if (props.state === 'upcoming') return HomeStrings.statusUpcoming
  if (props.state === 'expired') return HomeStrings.statusExpired
  if (props.state === 'changed') return HomeStrings.statusChanged
  return ''
})

const typeEmoji = computed(
  () => ItemTypeEmoji[props.spot.item_type] || ItemTypeEmoji.default
)

const timeText = computed(
  () => `${props.spot.start_time}${HomeStrings.timeRangeSeparator}${props.spot.end_time}`
)

const ariaLabel = computed(
  () => `${props.spot.title},${timeText.value},${statusLabel.value}`
)

function onTap() {
  // 已过期不触发 tap(spec §3.1 表格 + §8.3)
  if (props.state === 'expired') return
  emit('tap')
}
</script>

<style scoped>
.spot-card {
  position: relative;
  display: flex;
  flex-direction: column;
  background: #FDFBF7;
  /* Surface Card */
  border: 1.5rpx solid rgba(45, 106, 94, 0.10);
  /* UI-026 (2026-06-06):从 0.06 提升到 0.10,提升卡片间边界可识别度 */
  border-radius: 16px;
  /* radius-lg */
  padding: 16rpx;
  /* space-md */
  width: 240rpx;
  /* spec §3.1 固定 240rpx */
  min-height: 168rpx;
  box-sizing: border-box;
  flex-shrink: 0;
  box-shadow: 0 4rpx 12rpx rgba(0, 0, 0, 0.06);
  /* UI-026:从无(default) 提升为 0 4rpx 12rpx 0.06,让卡片在 scroll-view 中有微投影 */
  transition: transform 0.15s ease-out, box-shadow 0.15s ease-out, background 0.2s ease-out, border-color 0.2s ease-out;
}

.spot-card-hover {
  transform: scale(0.96);
  box-shadow: 0 4rpx 16rpx rgba(0, 0, 0, 0.1);
}

.spot-card-body {
  display: flex;
  flex-direction: column;
  gap: 8rpx;
  width: 100%;
}

/* ───────── 4 态样式(spec §3.1 表格)───────── */

/* UI-021 修订(2026-06-06):去除 done 专属绿底后,以下 3 态(active / upcoming
   / expired)即为该组件完整视觉态。done 视觉态不再有专属背景,与 upcoming
   共用 #FDFBF7 白底;若 prop 仍传入 'done'(其他 page 兼容路径),wrapper
   class 命名仍为 spot-card-<done> 但无对应 CSS,直接 fallback 到 .spot-card
   基础样式 — 视觉与 upcoming 一致,仅 ✅ 印章(spot-card-stamp)仍由
   template v-if 渲染,保留"打卡反馈"信息。*/

/* UI-026 修订(2026-06-06):在 task 1 移除绿底后,done 视觉态从隐式
   继承 .spot-card 基础样式改为显式 background: #FFFFFF。
   - 复用 stamp ✅(template v-if 渲染)作为"已打卡"反馈
   - #FFFFFF 与 day-block 背景同色,形成"已完成 = 融入背景"微妙视觉信号
   - 4 状态(active / upcoming / expired / changed)零触动 */
.spot-card-done {
  background: #FFFFFF;
}

/* 进行中:边框加粗 + primarySoft + 右上"现在"标签 */
.spot-card-active {
  background: rgba(45, 106, 94, 0.08);
  /* primarySoft */
  border: 4rpx solid #2D6A5E;
  /* Primary 加粗 */
}

.spot-card-active .spot-card-time,
.spot-card-active .spot-card-title {
  color: #1D4A3E;
  /* Primary Dark */
}

.spot-card-active .spot-card-status {
  color: #2D6A5E;
  /* Primary */
}

/* 即将到来:默认 Surface Card,无特殊样式 */
.spot-card-upcoming {
  background: #FDFBF7;
  /* Surface Card */
}

.spot-card-upcoming .spot-card-time {
  color: #5A5A5A;
  /* inkLight */
}

.spot-card-upcoming .spot-card-title {
  color: #2C2C2C;
  /* ink */
}

/* 已过期:整张 opacity 0.5,不可点击 */
.spot-card-expired {
  background: #FDFBF7;
  opacity: 0.5;
  pointer-events: none;
}

.spot-card-expired .spot-card-time,
.spot-card-expired .spot-card-title {
  color: #9A9A9A;
  /* inkMuted */
}

/* 改动过:边框 Warning */
.spot-card-changed {
  background: #FDFBF7;
  border: 4rpx solid #D4A03A;
  /* Warning */
}

.spot-card-changed .spot-card-time,
.spot-card-changed .spot-card-title {
  color: #2C2C2C;
}

.spot-card-status-warn {
  color: #D4A03A;
  /* Warning */
}

/* ───────── 元素样式 ───────── */

.spot-card-stamp {
  position: absolute;
  top: 8rpx;
  left: 8rpx;
  width: 40rpx;
  height: 40rpx;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
}

.spot-card-stamp-text {
  font-size: 24rpx;
  line-height: 1;
}

.spot-card-now-tag {
  position: absolute;
  top: 8rpx;
  right: 8rpx;
  padding: 2rpx 12rpx;
  border-radius: 9999px;
  background: #2D6A5E;
  /* Primary */
}

.spot-card-now-tag-text {
  font-family: 'Noto Sans SC', sans-serif;
  font-size: 20rpx;
  /* 10px,小标签 */
  color: #FFFFFF;
  font-weight: 600;
  line-height: 1.4;
}

.spot-card-fav {
  position: absolute;
  bottom: 8rpx;
  right: 8rpx;
}

.spot-card-fav-text {
  font-size: 24rpx;
  line-height: 1;
}

.spot-card-time {
  font-family: 'Noto Sans SC', sans-serif;
  font-size: 22rpx;
  /* 11px,UI §三 标签 */
  color: #5A5A5A;
  /* inkLight */
  line-height: 1.4;
  margin-top: 24rpx;
  /* 给"现在"/✅ 印章让位 */
}

.spot-card-title-row {
  display: flex;
  align-items: center;
  gap: 8rpx;
  min-width: 0;
}

.spot-card-emoji {
  font-size: 28rpx;
  line-height: 1;
  flex-shrink: 0;
}

.spot-card-title {
  font-family: 'Noto Serif SC', serif;
  font-size: 27rpx;
  /* 13.5px(per v0.2.0 spec §4.4:32rpx → 27rpx,-5px 字号修订;原 v0.1.0 32rpx / 当前 28rpx;最终落地 27rpx spec 字面) */
  font-weight: 600;
  color: #2C2C2C;
  line-height: 1.3;
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
}

.spot-card-status {
  font-family: 'Noto Sans SC', sans-serif;
  font-size: 22rpx;
  line-height: 1.4;
  margin-top: 4rpx;
}
</style>
