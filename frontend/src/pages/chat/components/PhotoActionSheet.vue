<!--
  PhotoActionSheet.vue — ChatPage 拍照 ActionSheet 弹窗(per specs/ChatPage.md §3.10 + §8.6)

  形态:沿 EditTripPage DraftConfirmDialog 2 按钮 + OptionRow 模式自写 modal 形态;
  2 选项(拍照 / 相册) + 取消按钮;选完 emit select(value) → 父 page uni.chooseImage;

  Props
    visible         : boolean                            是否显示 modal
    title           : string                             弹窗标题(本页面传 ChatPageStrings.actionSheetTitle)
    options         : Array<{label: string, value: 'camera' | 'album'}>  选项列表
    btnCancelLabel  : string                             取消按钮文案(本页面传 ChatPageStrings.actionSheetCancel)

  Emits
    select : (value: 'camera' | 'album')                 用户点某选项
    cancel : ()                                          用户点取消按钮 / 蒙层

  Slots:无

  视觉(spec §3.10 + §10 NFR):
    - 蒙层 rgba(0,0,0,0.5) + 内容卡片 surfaceCard + radius-lg(16px) + shadow-lg
    - 选项 + 取消按钮 ≥ 88rpx = 44pt 触达(per spec §10 NFR 可访问性)
    - 取消按钮 Danger 配色**不**用(本 dialog 是常规选择,不是不可逆操作;沿 ClearHistoryConfirmDialog §8.4 决策)
    - 动效 fadeIn 0.2s + slideUp 0.3s ease-spring(沿 §8.4 模式)
    - 蒙层点击 = 取消(per spec §3.10)

  复用:本组件是 ChatPage 私有,沿 §8.4 + §8.8 命名 PascalCase 无前缀。
-->
<template>
  <view
    v-if="visible"
    class="photo-sheet-mask"
    role="dialog"
    aria-modal="true"
    @click="onMaskClick"
  >
    <view class="photo-sheet" @click.stop>
      <view class="photo-sheet-content">
        <text class="photo-sheet-title">{{ title }}</text>
        <view class="photo-sheet-options">
          <view
            v-for="(opt, idx) in options"
            :key="idx"
            class="photo-sheet-option"
            role="button"
            :aria-label="opt.label"
            hover-class="photo-sheet-option-hover"
            :hover-stay-time="50"
            @click="onOptionClick(idx, opt)"
          >
            <text class="photo-sheet-option-emoji" aria-hidden="true">{{ optionEmoji(opt) }}</text>
            <text class="photo-sheet-option-label">{{ opt.label }}</text>
          </view>
        </view>
      </view>

      <view
        class="photo-sheet-cancel"
        role="button"
        :aria-label="btnCancelLabel"
        hover-class="photo-sheet-cancel-hover"
        :hover-stay-time="50"
        @click="onCancelClick"
      >
        <text class="photo-sheet-cancel-text">{{ btnCancelLabel }}</text>
      </view>
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
  title: {
    type: String,
    required: true,
    default: '',
  },
  options: {
    type: Array,
    required: true,
    default: () => [],
  },
  btnCancelLabel: {
    type: String,
    required: false,
    default: '取消',
  },
})

const emit = defineEmits(['select', 'cancel'])

function optionEmoji(opt) {
  if (!opt || typeof opt.value !== 'string') return '📷'
  return opt.value === 'camera' ? '📷' : '🖼'
}

function onOptionClick(idx, opt) {
  emit('select', opt?.value)
  logger.debug('[PhotoActionSheet] option select', { idx, value: opt?.value })
}

function onCancelClick() {
  emit('cancel')
  logger.debug('[PhotoActionSheet] cancel button')
}

function onMaskClick() {
  // 蒙层点击 = 取消(per spec §3.10)
  emit('cancel')
  logger.debug('[PhotoActionSheet] mask click → cancel')
}
</script>

<style scoped>
.photo-sheet-mask {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: flex-end;
  justify-content: center;
  z-index: 999;
  animation: photoSheetFadeIn 0.2s ease-out both;
}

.photo-sheet {
  width: 100%;
  padding: 0 24rpx 32rpx;
  box-sizing: border-box;
  display: flex;
  flex-direction: column;
  gap: 16rpx;
  animation: photoSheetSlideUp 0.3s cubic-bezier(0.22, 1, 0.36, 1) both;
}

.photo-sheet-content {
  background: #FDFBF7;
  /* surfaceCard */
  border-radius: 16px;
  box-shadow: 0 -4rpx 24rpx rgba(45, 106, 94, 0.18);
  padding: 16rpx 0;
  box-sizing: border-box;
}

.photo-sheet-title {
  display: block;
  font-family: 'Noto Serif SC', serif;
  font-size: 30rpx;
  /* 15px */
  font-weight: 600;
  color: #2C2C2C;
  /* ink */
  line-height: 1.4;
  text-align: center;
  padding: 16rpx 32rpx;
  box-sizing: border-box;
  border-bottom: 1px solid rgba(45, 106, 94, 0.06);
}

.photo-sheet-options {
  display: flex;
  flex-direction: column;
  box-sizing: border-box;
}

.photo-sheet-option {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 16rpx;
  min-height: 88rpx;
  /* ≥ 44pt tap area(spec §10 NFR 可访问性) */
  padding: 0 32rpx;
  box-sizing: border-box;
  transition: background 0.15s ease-out;
}

.photo-sheet-option-hover {
  background: rgba(45, 106, 94, 0.06);
  /* primarySoft */
}

.photo-sheet-option-emoji {
  font-size: 36rpx;
  /* 18px */
  line-height: 1;
}

.photo-sheet-option-label {
  font-family: 'Noto Sans SC', sans-serif;
  font-size: 32rpx;
  /* 16px */
  color: #2C2C2C;
  /* ink */
  line-height: 1.4;
}

.photo-sheet-cancel {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 88rpx;
  /* ≥ 44pt tap area(spec §10 NFR 可访问性) */
  padding: 0 32rpx;
  background: #FDFBF7;
  /* surfaceCard */
  border-radius: 16px;
  box-shadow: 0 -4rpx 24rpx rgba(45, 106, 94, 0.18);
  box-sizing: border-box;
  transition: background 0.15s ease-out, transform 0.15s ease-out;
}

.photo-sheet-cancel-hover {
  background: #F2EBE0;
  /* surfaceWarm */
  transform: scale(0.99);
}

.photo-sheet-cancel-text {
  font-family: 'Noto Sans SC', sans-serif;
  font-size: 32rpx;
  font-weight: 600;
  color: #2C2C2C;
  /* ink */
  line-height: 1.4;
}

/* ───────── Animations(沿 §8.4 模式)───────── */
@keyframes photoSheetFadeIn {
  from { opacity: 0; }
  to { opacity: 1; }
}

@keyframes photoSheetSlideUp {
  from {
    opacity: 0;
    transform: translateY(40rpx);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}
</style>
