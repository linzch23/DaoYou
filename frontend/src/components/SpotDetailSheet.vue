<!--
  SpotDetailSheet.vue — 景点详情底部浮层(spec §3.5 / §8.4)
  
  Spec contract: specs/HomePage.md §8.4 + specs/SpotDetailSheet.md §8.1

  Refactor 记录(specs/SpotDetailSheet.md §10 R-4/R-5/R-6):
    原 import `HomeStrings, HomeItemTypeEmoji` 改为
    `SpotDetailSheetStrings, ItemTypeEmoji`,实现跨页复用(HomePage + 独立 route)。
  
  Props (v0.3.0 收敛,per user-round5-2026-06-27)
    spot        : TripItem | null     父组件控制:null = 隐藏
    isFavorite  : (removed v0.3.0)
  
  Emits (v0.3.0 收敛)
    close          : void               用户关闭(蒙层/拖动/✕)
    navigate       : TripItem           导航去这里
    guide          : (removed v0.3.0)
    toggleFavorite : (removed v0.3.0)
-->
<template>
  <view
    v-if="spot"
    class="sheet-root"
    aria-modal="true"
  >
    <!-- 蒙层 -->
    <view
      class="sheet-mask"
      aria-hidden="true"
      @click="onClose"
    />
    <!-- 浮层主体(slideUp 0.4s spring) -->
    <view
      class="sheet-panel"
      :class="{ 'sheet-panel-closing': isClosing }"
      role="dialog"
      :aria-label="ariaLabel"
    >
      <!-- 拖动条 -->
      <view
        class="sheet-drag-handle"
        aria-hidden="true"
        @click="onClose"
      />
      <!-- ✕ 关闭 -->
      <view
        class="sheet-close"
        role="button"
        :aria-label="closeLabel"
        hover-class="sheet-close-hover"
        :hover-stay-time="50"
        @click="onClose"
      >
        <text class="sheet-close-text">✕</text>
      </view>

      <!-- 内容区 -->
      <scroll-view
        class="sheet-content"
        scroll-y
        :enhanced="true"
        :show-scrollbar="false"
      >
        <view class="sheet-content-inner">
          <!-- 名称 -->
          <view class="sheet-name-row">
            <text class="sheet-emoji" aria-hidden="true">{{ typeEmoji }}</text>
            <text class="sheet-name">{{ spot.title }}</text>
          </view>
          <!-- 简介(notes 一句话) -->
          <text
            v-if="introText"
            class="sheet-intro"
          >{{ introText }}</text>
          <!-- 时间 -->
          <view class="sheet-info-row">
            <text class="sheet-info-label">🕒</text>
            <text class="sheet-info-value">{{ timeText }}</text>
          </view>
          <!-- 交通指引(MVP:显示 address) -->
          <view class="sheet-info-block">
            <text class="sheet-info-block-title">{{ trafficTitle }}</text>
            <text class="sheet-info-block-text">{{ spot.address || '—' }}</text>
          </view>
          <!-- 小贴士(notes) -->
          <view
            v-if="noteText"
            class="sheet-info-block"
          >
            <text class="sheet-info-block-title">{{ noteTitle }}</text>
            <text class="sheet-info-block-text">{{ noteText }}</text>
          </view>
        </view>
      </scroll-view>

      <!-- v0.3.0(per user-round5-2026-06-27):4 按钮 → 1 按钮,只保留「导航去这里」
           原「拍照讲解」(📷) + 「收藏」(🤍/❤️) 2 按钮整段删除 -->
      <view class="sheet-actions">
        <view
          class="sheet-action sheet-action-navigate"
          role="button"
          :aria-label="navigateLabel"
          hover-class="sheet-action-hover"
          :hover-stay-time="50"
          @click="onNavigate"
        >
          <text class="sheet-action-emoji" aria-hidden="true">🧭</text>
          <text class="sheet-action-text">{{ navigateLabel }}</text>
        </view>
      </view>
    </view>
  </view>
</template>

<script setup>
import { ref, computed, watch } from 'vue'
import {
  SpotDetailSheetStrings,
  ItemTypeEmoji,
} from '../constants/strings.js'

const props = defineProps({
  /** @type {import('vue').PropType<import('../api/types').TripItem | null>} */
  spot: {
    type: Object,
    default: null,
  },
  // v0.3.0(per user-round5-2026-06-27):isFavorite prop 已删除
  //   原用于驱动收藏按钮视觉态,本组件 v0.3.0 起不再显示收藏按钮
})

const emit = defineEmits(['close', 'navigate'])
// v0.3.0(per user-round5-2026-06-27):删 guide + toggleFavorite emit
//   拍照讲解 / 收藏 2 按钮已删除,对应 emit 收敛

const isClosing = ref(false)

// spec §3.5:"拖动条下滑" — MVP 简化为点击拖动条 = 关闭(无 swipe 手势实现)
function onClose() {
  if (isClosing.value) return
  isClosing.value = true
  // slideDown 0.3s ease-out 后再 emit,让退场动画可见
  setTimeout(() => {
    isClosing.value = false
    emit('close')
  }, 280)
}

function onNavigate() {
  if (!props.spot) return
  emit('navigate', props.spot)
}
// v0.3.0(per user-round5-2026-06-27):删 onGuide / onToggleFavorite
//   拍照讲解 / 收藏 2 按钮已删除,对应 handler 收敛

const closeLabel = computed(() => SpotDetailSheetStrings.sheetCloseLabel)
const trafficTitle = computed(() => SpotDetailSheetStrings.sheetTrafficTitle)
const noteTitle = computed(() => SpotDetailSheetStrings.sheetNoteTitle)
const navigateLabel = computed(() => SpotDetailSheetStrings.actionNavigate)
// v0.3.0(per user-round5-2026-06-27):删 guideLabel / favoriteLabel / favoriteEmoji
//   拍照讲解 / 收藏 2 按钮已删除,对应 computed 收敛

const typeEmoji = computed(
  () => (props.spot && ItemTypeEmoji[props.spot.item_type]) || ItemTypeEmoji.default
)

const timeText = computed(() => {
  if (!props.spot) return ''
  const startTime = props.spot.start_time || ''
  const endTime = props.spot.end_time || ''
  return endTime
    ? `${startTime}${SpotDetailSheetStrings.timeRangeSeparator}${endTime}`
    : startTime
})

const introText = computed(() => {
  // spec §3.5 "SpotIntro 来自 item.notes";但 notes 可能为空 → 显示空
  return props.spot?.notes || ''
})

const noteText = computed(() => props.spot?.notes || '')

const ariaLabel = computed(() =>
  props.spot ? `${props.spot.title} 详情` : ''
)

// 当 spot 从 null 切换到非空时,isClosing 重置
watch(
  () => props.spot,
  (next) => {
    if (next) isClosing.value = false
  }
)
</script>

<style scoped>
.sheet-root {
  position: fixed;
  inset: 0;
  z-index: 999;
  /* spec §3.5:蒙层 z-index: 999,内容 z-index: 1000 */
}

.sheet-mask {
  position: absolute;
  inset: 0;
  background: rgba(0, 0, 0, 0.4);
  animation: sheetMaskIn 0.3s ease-out both;
}

.sheet-panel {
  position: absolute;
  left: 0;
  right: 0;
  bottom: 0;
  background: #FDFBF7;
  /* Surface Card */
  border-top-left-radius: 20px;
  /* radius-xl */
  border-top-right-radius: 20px;
  box-shadow: 0 -8rpx 32rpx rgba(0, 0, 0, 0.14);
  /* shadow-lg */
  z-index: 1000;
  min-height: 60vh;
  max-height: 80vh;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  animation: sheetSlideUp 0.4s cubic-bezier(0.34, 1.56, 0.64, 1) both;
  /* spec §3.5:slideUp 0.4s spring */
}

.sheet-panel-closing {
  animation: sheetSlideDown 0.3s ease-out both;
}

.sheet-drag-handle {
  width: 100%;
  height: 88rpx;
  /* spec §10 NFR 可访问性:≥ 44pt 触达(88rpx = 44pt)
     可视 8rpx 胶囊由 ::after 渲染,周围 80rpx 透明区提供触达 */
  display: flex;
  align-items: center;
  justify-content: center;
  position: relative;
  flex-shrink: 0;
}

.sheet-drag-handle::after {
  content: '';
  display: block;
  width: 80rpx;
  height: 8rpx;
  border-radius: 4rpx;
  background: rgba(45, 106, 94, 0.2);
}

.sheet-close {
  position: absolute;
  top: 8rpx;
  right: 8rpx;
  width: 88rpx;
  height: 88rpx;
  /* spec §10 NFR 可访问性:≥ 44pt 触达(88rpx = 44pt)
     容器从 64rpx → 88rpx,top/right 16rpx → 8rpx 使 88rpx 居中在原 64rpx 区域;
     ✕ 字符 / 圆角 / 背景色均不变 — 零视觉变化,仅触达区扩大 24rpx(12pt) */
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  z-index: 2;
  background: rgba(45, 106, 94, 0.08);
  box-sizing: border-box;
  transition: background 0.15s ease-out, transform 0.15s ease-out;
}

.sheet-close-hover {
  background: rgba(45, 106, 94, 0.16);
  transform: scale(0.96);
}

.sheet-close-text {
  font-size: 28rpx;
  color: #2C2C2C;
  line-height: 1;
}

.sheet-content {
  flex: 1;
  min-height: 0;
  padding: 0 40rpx 16rpx;
  box-sizing: border-box;
}

.sheet-content-inner {
  display: flex;
  flex-direction: column;
  gap: 16rpx;
  padding-top: 8rpx;
  padding-bottom: 16rpx;
}

.sheet-name-row {
  display: flex;
  align-items: center;
  gap: 12rpx;
}

.sheet-emoji {
  font-size: 36rpx;
  line-height: 1;
}

.sheet-name {
  font-family: 'Noto Serif SC', serif;
  font-size: 36rpx;
  /* 18px,UI §三 中标题 */
  font-weight: 600;
  color: #2C2C2C;
  line-height: 1.3;
  flex: 1;
}

.sheet-intro {
  font-family: 'Noto Sans SC', sans-serif;
  font-size: 28rpx;
  /* 14px */
  color: #5A5A5A;
  /* inkLight */
  line-height: 1.5;
}

.sheet-info-row {
  display: flex;
  align-items: center;
  gap: 8rpx;
  margin-top: 8rpx;
}

.sheet-info-label {
  font-size: 24rpx;
  line-height: 1;
}

.sheet-info-value {
  font-family: 'Noto Sans SC', sans-serif;
  font-size: 26rpx;
  /* 13px */
  color: #2C2C2C;
  line-height: 1.4;
}

.sheet-info-block {
  display: flex;
  flex-direction: column;
  gap: 8rpx;
  margin-top: 8rpx;
  background: rgba(45, 106, 94, 0.04);
  border-radius: 12px;
  /* radius-md */
  padding: 16rpx 20rpx;
  box-sizing: border-box;
}

.sheet-info-block-title {
  font-family: 'Noto Sans SC', sans-serif;
  font-size: 24rpx;
  /* 12px */
  color: #9A9A9A;
  /* inkMuted */
  line-height: 1.4;
}

.sheet-info-block-text {
  font-family: 'Noto Sans SC', sans-serif;
  font-size: 28rpx;
  /* 14px */
  color: #2C2C2C;
  line-height: 1.5;
  word-break: break-all;
}

.sheet-actions {
  display: flex;
  align-items: center;
  gap: 16rpx;
  padding: 16rpx 40rpx 32rpx;
  border-top: 1.5rpx solid rgba(45, 106, 94, 0.06);
  flex-shrink: 0;
  box-sizing: border-box;
}

.sheet-action {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 4rpx;
  min-height: 88rpx;
  /* ≥ 44pt tap area */
  border-radius: 12px;
  /* radius-md */
  padding: 8rpx 4rpx;
  background: rgba(45, 106, 94, 0.08);
  /* primarySoft */
  box-sizing: border-box;
  transition: transform 0.15s ease-out, background 0.15s ease-out;
}

.sheet-action-hover {
  transform: scale(0.96);
  background: rgba(45, 106, 94, 0.16);
}

.sheet-action-emoji {
  font-size: 32rpx;
  line-height: 1;
}

.sheet-action-text {
  font-family: 'Noto Sans SC', sans-serif;
  font-size: 22rpx;
  /* 11px,UI §三 标签 */
  font-weight: 500;
  color: #2D6A5E;
  /* primary */
  line-height: 1.4;
}

/* v0.3.0(per user-round5-2026-06-27):删 .sheet-action-favorite-on 3 段 CSS */
/* 收藏按钮已删除,对应样式同步收敛 */

/* 蒙层入场 */
@keyframes sheetMaskIn {
  from { opacity: 0; }
  to { opacity: 1; }
}

/* 浮层入场:slideUp spring */
@keyframes sheetSlideUp {
  from {
    transform: translateY(100%);
  }
  to {
    transform: translateY(0);
  }
}

/* 浮层退场:slideDown ease-out */
@keyframes sheetSlideDown {
  from {
    transform: translateY(0);
  }
  to {
    transform: translateY(100%);
  }
}

/* spec §3.5 / §9 AC-09 / §10 NFR Compatibility:大屏(H5 ≥ 1024px)内容最大宽度 640rpx 居中
   沿用 HomePage v0.1.0 §10 NFR;只约束内容内部(.sheet-content-inner / .sheet-actions),
   保留浮层"贴近视口底部"的形态(panel 仍 left/right:0 bottom:0 全宽);移动端零变化 */
@media (min-width: 1024px) {
  .sheet-content-inner,
  .sheet-actions {
    max-width: 640rpx;
    margin: 0 auto;
  }
}
</style>
