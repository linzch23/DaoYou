<!--
  _ErrorOverlay.vue — SpotDetailSheet 页面级错误兜底
  
  Spec contract: specs/SpotDetailSheet.md §8.2
  
  Props
    type        : 'notfound' | 'error' | 'empty'   驱动 icon / 标题
    message     : string                            副文案(由父传,本组件不写死)
    buttonLabel : string                            主按钮文本(由父传)
  
  Emits
    action      : void                              用户点主按钮
  
  Slots:无
-->
<template>
  <view
    class="error-overlay-root"
    role="alert"
    :aria-label="ariaLabel"
  >
    <view class="error-overlay-inner">
      <text class="error-overlay-icon" aria-hidden="true">{{ icon }}</text>
      <text class="error-overlay-title">{{ title }}</text>
      <text
        v-if="message"
        class="error-overlay-message"
      >{{ message }}</text>
      <view
        class="error-overlay-button"
        role="button"
        :aria-label="buttonLabel"
        hover-class="error-overlay-button-hover"
        :hover-stay-time="50"
        @click="onAction"
      >
        <text class="error-overlay-button-text">{{ buttonLabel }}</text>
      </view>
    </view>
  </view>
</template>

<script setup>
import { computed } from 'vue'

const props = defineProps({
  /** @type {import('vue').PropType<'notfound' | 'error' | 'empty'>} */
  type: {
    type: String,
    required: true,
    validator: (v) => ['notfound', 'error', 'empty'].includes(v),
  },
  message: {
    type: String,
    default: '',
  },
  buttonLabel: {
    type: String,
    required: true,
  },
})

const emit = defineEmits(['action'])

// type → icon 映射(spec §8.2 视觉差异)
const icon = computed(() => {
  if (props.type === 'notfound') return '⚠️'
  if (props.type === 'error') return '📡'
  return '📭' // empty(预留扩展,MVP 不调用)
})

// type → title 映射(spec §8.2 视觉差异)
// 标题从本组件硬编码,仅文案"兜底"驱动(不在父页面重复传)
const title = computed(() => {
  if (props.type === 'notfound') return '该景点不可用'
  if (props.type === 'error') return '加载失败'
  return '暂无内容' // empty
})

const ariaLabel = computed(() => `${title.value}:${props.message || ''}`)

function onAction() {
  emit('action')
}
</script>

<style scoped>
.error-overlay-root {
  position: fixed;
  inset: 0;
  z-index: 900;
  /* 浮层 z-index 是 999,错误兜底 z-index 略低(蒙层 900 < 浮层 1000) */
  display: flex;
  align-items: center;
  justify-content: center;
  background: #F7F3EC;
  /* Surface,见 UI §二 */
  padding: 40rpx;
  box-sizing: border-box;
}

.error-overlay-inner {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 16rpx;
  width: 100%;
  padding: 48rpx 32rpx;
  box-sizing: border-box;
}

.error-overlay-icon {
  font-size: 80rpx;
  /* 40px,大图标 */
  line-height: 1;
  margin-bottom: 8rpx;
}

.error-overlay-title {
  font-family: 'Noto Serif SC', serif;
  font-size: 36rpx;
  /* 18px,UI §三 中标题 */
  font-weight: 600;
  color: #2C2C2C;
  /* ink */
  line-height: 1.4;
  text-align: center;
}

.error-overlay-message {
  font-family: 'Noto Sans SC', sans-serif;
  font-size: 28rpx;
  /* 14px */
  color: #5A5A5A;
  /* inkLight */
  line-height: 1.5;
  text-align: center;
  margin-bottom: 16rpx;
}

.error-overlay-button {
  display: flex;
  align-items: center;
  justify-content: center;
  min-width: 240rpx;
  /* ≥ 88rpx tap area 宽度(由 min-height 决定) */
  min-height: 88rpx;
  /* ≥ 44pt tap area(88rpx = 44pt,见 OnboardingPage 2026-06-02 ui-reviewer 速算) */
  padding: 0 32rpx;
  background: #2D6A5E;
  /* Primary,见 UI §二 */
  border-radius: 9999px;
  /* radius-full */
  box-shadow: 0 4rpx 16rpx rgba(45, 106, 94, 0.35);
  /* shadow-md */
  box-sizing: border-box;
  transition: transform 0.15s ease-out, background 0.15s ease-out;
}

.error-overlay-button-hover {
  background: #3D8B7D;
  /* Primary Light */
  transform: scale(0.96);
}

.error-overlay-button-text {
  font-family: 'Noto Sans SC', sans-serif;
  font-size: 30rpx;
  /* 15px */
  font-weight: 600;
  color: #FFFFFF;
  line-height: 1.4;
}

/* spec §3.5 / §9 AC-09 / §10 NFR Compatibility:大屏(H5 ≥ 1024px)内容最大宽度 640rpx 居中
   沿用 HomePage v0.1.0 §10 NFR;移动端(< 1024px)零变化 */
@media (min-width: 1024px) {
  .error-overlay-inner {
    max-width: 640rpx;
    margin: 0 auto;
  }
}
</style>
