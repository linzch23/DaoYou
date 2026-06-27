<!--
  MessageImage.vue — ChatPage 消息内嵌图片缩略图(per specs/ChatPage.md §3.4 + §8.7)

  形态:inline 渲染 user msg 图片缩略图;max-width rpx;圆角 12rpx;点击 emit tap 触发父 page 全屏放大;

  Props
    src       : string                              图片本地路径
    maxWidth  : number | string                     最大宽度(rpx),默认 200

  Emits
    tap       : void                                用户点击图片(触发放大)

  Slots:无

  视觉(spec §3.1 + §3.4):
    - max-width rpx;object-fit: cover;圆角 12rpx
    - 失败 placeholder:灰底 + 🖼 emoji(沿 EmptyState 模式)
    - 0 业务逻辑泄漏(纯展示 + emit)

  复用:本组件是 ChatPage 私有,沿 §8.4 + §8.8 命名 PascalCase 无前缀。
-->
<template>
  <view class="msg-image-wrap">
    <image
      v-if="!loadFailed && src"
      class="msg-image"
      :src="src"
      :style="imageStyle"
      mode="aspectFill"
      @click="onTap"
      @error="onLoadError"
    />
    <view
      v-else
      class="msg-image-placeholder"
      :style="imageStyle"
    >
      <text class="msg-image-placeholder-emoji" aria-hidden="true">🖼</text>
    </view>
  </view>
</template>

<script setup>
import { computed, ref } from 'vue'
import { logger } from '../../../utils/logger.js'

const props = defineProps({
  src: {
    type: String,
    required: true,
    default: '',
  },
  maxWidth: {
    type: [Number, String],
    required: false,
    default: 200,
  },
})

const emit = defineEmits(['tap'])

const loadFailed = ref(false)

const imageStyle = computed(() => {
  const w = typeof props.maxWidth === 'number' ? props.maxWidth : Number(props.maxWidth) || 200
  return {
    width: `${w}rpx`,
    maxWidth: `${w}rpx`,
  }
})

function onTap() {
  emit('tap')
  logger.debug('[MessageImage] tap emit')
}

function onLoadError(err) {
  loadFailed.value = true
  logger.warn('[MessageImage] image load failed', { src: props.src, err })
}
</script>

<style scoped>
.msg-image-wrap {
  display: inline-block;
  box-sizing: border-box;
}

.msg-image {
  display: block;
  border-radius: 12rpx;
  /* radius-lg */
  object-fit: cover;
  background: #F2EBE0;
  /* surfaceWarm 占位底色 */
  box-sizing: border-box;
}

.msg-image-placeholder {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 200rpx;
  border-radius: 12rpx;
  background: #F2EBE0;
  /* surfaceWarm */
  box-sizing: border-box;
}

.msg-image-placeholder-emoji {
  font-size: 80rpx;
  /* 40px */
  line-height: 1;
  color: #9A9A9A;
  /* inkMuted */
  opacity: 0.5;
}
</style>
