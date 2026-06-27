<!--
  ImagePreviewModal.vue — ChatPage 图片放大全屏 modal(per specs/ChatPage.md §3.12 + §8.8)

  形态:全屏 modal,深色背景 rgba(0,0,0,0.9),图片 fit: contain 居中,右上角 ✕ 按钮 88rpx;
  关闭:✕ / 蒙层 / 系统返回 → emit close;

  Props
    visible : boolean                              是否显示 modal
    src     : string                               全屏显示的图片路径

  Emits
    close   : void                                 用户点 ✕ / 蒙层 / 系统返回

  Slots:无

  视觉(spec §3.12 + §10 NFR):
    - 全屏黑底 + 图片居中(fit: contain)
    - 右上角 ✕ 按钮 88rpx(44pt 触达)
    - 动效 fadeIn 0.2s + scaleIn(沿 §8.4 模式)
    - 蒙层点击 = 关闭

  复用:本组件是 ChatPage 私有,沿 §8.4 + §8.8 命名 PascalCase 无前缀。
-->
<template>
  <view
    v-if="visible"
    class="img-preview-mask"
    role="dialog"
    aria-modal="true"
    @click="onMaskClick"
  >
    <view class="img-preview-content" @click.stop>
      <image
        v-if="src"
        class="img-preview-image"
        :src="src"
        mode="aspectFit"
      />
    </view>
    <view
      class="img-preview-close"
      role="button"
      :aria-label="CLOSE_ARIA"
      hover-class="img-preview-close-hover"
      :hover-stay-time="50"
      @click="onCloseClick"
    >
      <text class="img-preview-close-text" aria-hidden="true">✕</text>
    </view>
  </view>
</template>

<script setup>
import { logger } from '../../../utils/logger.js'

defineProps({
  visible: {
    type: Boolean,
    required: true,
    default: false,
  },
  src: {
    type: String,
    required: true,
    default: '',
  },
})

const emit = defineEmits(['close'])

// ✕ 按钮 aria-label(MVP 简化,直接字面常量;沿 ApplyPlanConfirmDialog 字面模式)
const CLOSE_ARIA = '关闭'

function onCloseClick() {
  emit('close')
  logger.debug('[ImagePreviewModal] close button')
}

function onMaskClick() {
  // 蒙层点击 = 关闭(spec §3.12)
  emit('close')
  logger.debug('[ImagePreviewModal] mask click → close')
}
</script>

<style scoped>
.img-preview-mask {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.9);
  /* 全屏深色背景(spec §3.12) */
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 9999;
  animation: imgPreviewFadeIn 0.2s ease-out both;
}

.img-preview-content {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  height: 100%;
  padding: 80rpx 40rpx;
  box-sizing: border-box;
  animation: imgPreviewScaleIn 0.25s cubic-bezier(0.22, 1, 0.36, 1) both;
}

.img-preview-image {
  max-width: 100%;
  max-height: 100%;
  width: auto;
  height: auto;
}

.img-preview-close {
  position: fixed;
  top: 32rpx;
  right: 32rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 88rpx;
  height: 88rpx;
  min-width: 88rpx;
  min-height: 88rpx;
  /* ≥ 44pt tap area(spec §10 NFR 可访问性) */
  border-radius: 9999px;
  /* radius-full */
  background: rgba(255, 255, 255, 0.15);
  box-sizing: border-box;
  transition: background 0.15s ease-out, transform 0.15s ease-out;
}

.img-preview-close-hover {
  background: rgba(255, 255, 255, 0.25);
  transform: scale(0.96);
}

.img-preview-close-text {
  font-family: 'Noto Sans SC', sans-serif;
  font-size: 40rpx;
  /* 20px */
  color: #FFFFFF;
  line-height: 1;
}

/* ───────── Animations(沿 §8.4 模式)───────── */
@keyframes imgPreviewFadeIn {
  from { opacity: 0; }
  to { opacity: 1; }
}

@keyframes imgPreviewScaleIn {
  from {
    opacity: 0;
    transform: scale(0.95);
  }
  to {
    opacity: 1;
    transform: scale(1);
  }
}
</style>
