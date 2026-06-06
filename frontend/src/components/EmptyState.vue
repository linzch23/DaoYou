<!--
  EmptyState.vue — 跨页通用空状态
  
  Spec contract: specs/HomePage.md §8.7
  
  Props
    title        : string         主标题(必填)
    subtitle     : string         副标题(可选)
    ctaLabel     : string         CTA 按钮文案(可选,空时不显示按钮)
    illustration : string         占位 emoji 组合(默认 📖🌏)
  
  Emits
    cta          : void           用户点 CTA
  
  Slots
    illustration : ()             自定义插画(默认由 illustration prop 渲染)
-->
<template>
  <view class="empty-state" role="status">
    <view class="empty-illustration" aria-hidden="true">
      <slot name="illustration">
        <text class="empty-emoji">{{ illustration }}</text>
      </slot>
    </view>
    <text class="empty-title">{{ title }}</text>
    <text v-if="subtitle" class="empty-subtitle">{{ subtitle }}</text>
    <view
      v-if="ctaLabel"
      class="empty-cta"
      hover-class="empty-cta-hover"
      :hover-stay-time="50"
      role="button"
      @click="onCta"
    >
      <text class="empty-cta-text">{{ ctaLabel }}</text>
    </view>
  </view>
</template>

<script setup>
defineProps({
  title: {
    type: String,
    required: true,
  },
  subtitle: {
    type: String,
    default: '',
  },
  ctaLabel: {
    type: String,
    default: '',
  },
  illustration: {
    type: String,
    default: '📖🌏',
  },
})

const emit = defineEmits(['cta'])

function onCta() {
  emit('cta')
}
</script>

<style scoped>
.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 80rpx 40rpx;
  /* spec §3.3:垂直居中,占 Body 高度 ≥ 60% */
  min-height: 60vh;
  box-sizing: border-box;
  gap: 16rpx;
}

.empty-illustration {
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 16rpx;
}

.empty-emoji {
  font-size: 96rpx;
  /* 48px */
  line-height: 1;
  letter-spacing: 16rpx;
}

.empty-title {
  font-family: 'Noto Serif SC', serif;
  font-size: 44rpx;
  /* 22px,UI §三 页面标题 */
  font-weight: 600;
  color: #2C2C2C;
  /* ink */
  line-height: 1.4;
  text-align: center;
}

.empty-subtitle {
  font-family: 'Noto Sans SC', sans-serif;
  font-size: 28rpx;
  /* 14px */
  color: #5A5A5A;
  /* inkLight */
  line-height: 1.5;
  text-align: center;
  margin-top: 8rpx;
}

.empty-cta {
  margin-top: 32rpx;
  /* space-xl */
  min-width: 320rpx;
  min-height: 88rpx;
  /* ≥ 44pt tap area(88rpx = 44pt) */
  padding: 0 48rpx;
  background: linear-gradient(135deg, #2D6A5E 0%, #3D8B7D 100%);
  /* Primary → Primary Light,见 UI §八 主按钮 */
  border-radius: 9999px;
  /* radius-full */
  box-shadow: 0 8rpx 32rpx rgba(45, 106, 94, 0.35);
  display: flex;
  align-items: center;
  justify-content: center;
  box-sizing: border-box;
  transition: transform 0.15s ease-out, box-shadow 0.15s ease-out;
}

.empty-cta-hover {
  transform: scale(0.96);
  box-shadow: 0 4rpx 16rpx rgba(45, 106, 94, 0.35);
}

.empty-cta-text {
  font-family: 'Noto Sans SC', sans-serif;
  font-size: 30rpx;
  /* 15px,见 UI §三 */
  font-weight: 600;
  color: #FFFFFF;
  line-height: 1;
}
</style>
