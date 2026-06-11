<!--
  ErrorBanner.vue — 页面私有错误横幅(下划线前缀 = private,见 Code Style §3.4)
  
  Spec contract: specs/OnboardingPage.md §8.3
  
  Props
    message   : string    错误文案(必填)
    retryable : boolean   是否显示「重试」链接(默认 true)
  
  Emits
    retry     : void      用户点「重试」
-->
<template>
  <view class="error-banner" role="alert">
    <view class="error-icon" aria-hidden="true">⚠</view>
    <view class="error-content">
      <text class="error-message">{{ message }}</text>
    </view>
    <view
      v-if="retryable"
      class="error-retry"
      :class="{ 'error-retry-disabled': isLocked }"
      hover-class="error-retry-hover"
      :hover-stay-time="50"
      @click="onRetry"
    >
      <text class="error-retry-text">{{ OnboardingStrings.retry }}</text>
    </view>
  </view>
</template>

<script setup>
import { ref, computed } from 'vue'
import { OnboardingStrings } from '../constants/strings.js'

const props = defineProps({
  message: {
    type: String,
    required: true,
  },
  retryable: {
    type: Boolean,
    default: true,
  },
  /**
   * 外部注入的 loading 状态(per issues/Cross-Page/Throttle-001 §4.1)。
   * 当父 page 处于飞行中(isRetrying=true / viewMode='loading')时,
   * 视觉 disabled + tap 屏蔽,防 0~10ms brief 窗口 + 1~3s async 段双击堆叠。
   */
  loading: {
    type: Boolean,
    default: false,
  },
})

const emit = defineEmits(['retry'])

/**
 * 300ms 节流窗:防止父 onRetry 同步重入导致 emit 双触发
 * (per Throttle-001 §3.1 — 共享组件层 emit 内部节流,0 业务逻辑泄漏给 page 层)
 */
const throttled = ref(false)

/** 视觉 + 节流双重门:loading(外部) || throttled(内部) */
const isLocked = computed(() => props.loading || throttled.value)

function onRetry() {
  if (isLocked.value) return
  throttled.value = true
  emit('retry')
  setTimeout(() => {
    throttled.value = false
  }, 300)
}
</script>

<style scoped>
.error-banner {
  display: flex;
  align-items: center;
  gap: 16rpx;
  background: rgba(196, 74, 58, 0.08);
  /* Danger Soft */
  border: 1.5rpx solid rgba(196, 74, 58, 0.2);
  /* Danger Border */
  border-radius: 12px;
  /* radius-md */
  padding: 16rpx 20rpx;
  margin-top: 24rpx;
  /* space-lg */
  box-sizing: border-box;
}

.error-icon {
  font-size: 32rpx;
  color: #C44A3A;
  /* Danger */
  line-height: 1;
  flex-shrink: 0;
}

.error-content {
  flex: 1;
  min-width: 0;
}

.error-message {
  font-family: 'Noto Sans SC', sans-serif;
  font-size: 26rpx;
  /* 13px */
  color: #C44A3A;
  line-height: 1.4;
  word-break: break-all;
}

.error-retry {
  flex-shrink: 0;
  padding: 8rpx 24rpx;
  min-height: 88rpx;
  /* ≥ 44pt tap area(AC-10) */
  min-width: 88rpx;
  border-radius: 9999px;
  /* radius-full */
  background: #C44A3A;
  /* Danger */
  display: flex;
  align-items: center;
  justify-content: center;
  box-sizing: border-box;
  transition: opacity 0.15s ease-out, transform 0.15s ease-out;
}

.error-retry-hover {
  opacity: 0.8;
}

/* Throttle-001 §4.1:disabled 视觉态 — 飞行中(loading / throttled)禁 tap */
.error-retry-disabled {
  opacity: 0.5;
  pointer-events: none;
}

.error-retry-text {
  font-family: 'Noto Sans SC', sans-serif;
  font-size: 24rpx;
  /* 12px */
  color: #FFFFFF;
  font-weight: 500;
  line-height: 1.4;
}
</style>
