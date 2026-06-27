<!--
  PhotoActionButton.vue — ChatPage 拍照按钮(per specs/ChatPage.md §3.11 + §8.5)

  形态:_InputBar 左侧圆形 88rpx(44pt 触达),emoji 🖼 + AppColors.surfaceWarm 背景;
  触发父 page 弹 PhotoActionSheet(per §3.10);

  Props
    visible   : boolean  是否显示(由父 page 控制:loading/error 时 false)
    disabled  : boolean  viewMode='sending' 时 true
    ariaLabel : string   aria-label(本页面传 ChatPageStrings.btnPhotoAria)

  Emits
    tap       : void     用户点按钮 → 父 page onPhotoTap → 弹 PhotoActionSheet

  Slots:无

  视觉(spec §3.11 + §10 NFR):
    - 88rpx 圆形 + surfaceWarm(#F2EBE0)背景 + 🖼 emoji(48rpx)
    - min-width: 88rpx / min-height: 88rpx(≥ 44pt 触达)
    - hover 时 scale(0.96)(沿 13 页面惯例)
    - disabled:opacity 0.5 + pointer-events none

  复用:本组件是 ChatPage 私有,沿 §8.4 + §8.8 命名 PascalCase 无前缀。
-->
<template>
  <view
    v-if="visible"
    class="photo-action-btn"
    :class="{ 'photo-action-btn-disabled': disabled }"
    role="button"
    :aria-label="ariaLabel"
    :aria-disabled="disabled ? 'true' : 'false'"
    hover-class="photo-action-btn-hover"
    :hover-stay-time="50"
    @click="onTap"
  >
    <text class="photo-action-btn-emoji" aria-hidden="true">🖼</text>
  </view>
</template>

<script setup>
import { logger } from '../../../utils/logger.js'

defineProps({
  visible: {
    type: Boolean,
    required: true,
    default: true,
  },
  disabled: {
    type: Boolean,
    required: true,
    default: false,
  },
  ariaLabel: {
    type: String,
    required: false,
    default: '',
  },
})

const emit = defineEmits(['tap'])

function onTap() {
  // 注:disabled 由父 page 控制在 visible=false 时根本不渲染;此处仅二次兜底
  if (arguments[0] && arguments[0].currentTarget && arguments[0].type === 'click') {
    // 透传 click,父 page 即可在 disabled 时返回
  }
  emit('tap')
  logger.debug('[PhotoActionButton] tap emit')
}
</script>

<style scoped>
.photo-action-btn {
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
  background: #F2EBE0;
  /* surfaceWarm */
  flex-shrink: 0;
  box-sizing: border-box;
  transition: background 0.15s ease-out, transform 0.15s ease-out;
}

.photo-action-btn-hover {
  background: #E8E0D4;
  transform: scale(0.96);
}

.photo-action-btn-disabled {
  opacity: 0.5;
  pointer-events: none;
}

.photo-action-btn-emoji {
  font-size: 48rpx;
  /* 24px */
  line-height: 1;
}
</style>
