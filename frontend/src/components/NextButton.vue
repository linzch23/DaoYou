<!--
  NextButton.vue — 主按钮(单 label / loading / disabled 三态)
  
  Spec contract: specs/OnboardingPage.md §8.2
  
  Props
    label    : string    按钮文字
    loading  : boolean   提交中态(scale 0.96 + 转圈)
    disabled : boolean   禁用(无选项 / 提交中)
  
  Emits
    click    : void
  
  Slots
    default  : { loading } 自定义按钮内容
-->
<template>
  <button
    class="next-button"
    :class="{
      'next-button-loading': loading,
      'next-button-disabled': isEffectivelyDisabled,
    }"
    :disabled="isEffectivelyDisabled"
    hover-class="next-button-hover"
    :hover-stay-time="50"
    @click="onClick"
  >
    <slot :loading="loading">
      <view v-if="loading" class="loading-spinner" />
      <text v-else class="button-label">{{ label }}</text>
    </slot>
  </button>
</template>

<script setup>
import { computed } from 'vue'

const props = defineProps({
  label: {
    type: String,
    required: true,
  },
  loading: {
    type: Boolean,
    default: false,
  },
  disabled: {
    type: Boolean,
    default: false,
  },
})

const emit = defineEmits(['click'])

const isEffectivelyDisabled = computed(() => props.disabled || props.loading)

function onClick() {
  if (isEffectivelyDisabled.value) return
  emit('click')
}
</script>

<style scoped>
.next-button {
  width: 100%;
  height: 88rpx;
  /* ≥ 44pt = 88rpx,满足可访问性 §10 */
  background: linear-gradient(135deg, #2D6A5E 0%, #3D8B7D 100%);
  /* Primary → Primary Light,见 UI §二 */
  color: #FFFFFF;
  font-family: 'Noto Sans SC', sans-serif;
  font-size: 30rpx;
  /* 15px,见 UI §三 */
  font-weight: 600;
  border: none;
  border-radius: 9999px;
  /* radius-full */
  box-shadow: 0 8rpx 32rpx rgba(45, 106, 94, 0.35);
  /* shadow-lg + primary shadow */
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 16rpx;
  box-sizing: border-box;
  transition: transform 0.15s ease-out, box-shadow 0.15s ease-out, opacity 0.15s ease-out;
}

.next-button-hover {
  transform: scale(0.96);
  box-shadow: 0 4rpx 16rpx rgba(45, 106, 94, 0.35);
}

.next-button-disabled,
.next-button-loading {
  opacity: 0.5;
  /* AC-04:50% 透明度 */
  pointer-events: none;
}

.next-button-loading {
  /* spec §3 / AC-02:loading 态需 scale(0.96) + 转圈;不依赖 hover 状态,持续生效 */
  transform: scale(0.96);
}

.button-label {
  line-height: 1;
  color: #FFFFFF;
}

.loading-spinner {
  width: 32rpx;
  height: 32rpx;
  border: 4rpx solid rgba(255, 255, 255, 0.3);
  border-top-color: #FFFFFF;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}
</style>
