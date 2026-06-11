<!--
  DraftConfirmDialog.vue — 页面私有 3 按钮草稿弹窗(下划线前缀 = private,见 Code Style §3.4)
  
  Spec contract: specs/NewTripPage.md §8.1
  
  Props
    visible          : boolean        弹窗显示标记
    title            : string         弹窗标题
    message          : string         弹窗正文
    btnSaveLabel     : string         「保存草稿」按钮文案
    btnDontSaveLabel : string         「不保存」按钮文案
    btnContinueLabel : string         「继续编辑」按钮文案
  
  Emits
    save       : void   用户点「保存草稿」或主操作
    dontSave   : void   用户点「不保存」或蒙层(等同不保存)
    continue   : void   用户点「继续编辑」
  
  视觉:
    - 蒙层 rgba(0,0,0,0.4) + 内容卡片 surfaceCard + radius-lg(16px) + shadow-lg
    - 动效 fadeIn 0.2s + slideUp 0.3s ease-spring(沿用 SpotDetailSheet 浮层动效)
    - 3 按钮:主(保存草稿 Primary 渐变) / 幽灵(继续编辑 描边) / 次(不保存 surfaceWarm)
    - 所有按钮 ≥ 88rpx = 44pt 触达
-->
<template>
  <view
    v-if="visible"
    class="draft-dialog-mask"
    role="dialog"
    aria-modal="true"
    @click="onMaskClick"
  >
    <view class="draft-dialog" @click.stop>
      <view class="draft-dialog-content">
        <text class="draft-dialog-title">{{ title }}</text>
        <text class="draft-dialog-message">{{ message }}</text>
      </view>

      <view class="draft-dialog-actions">
        <view
          class="draft-dialog-btn draft-dialog-btn-primary"
          role="button"
          :aria-label="btnSaveLabel"
          hover-class="draft-dialog-btn-primary-hover"
          :hover-stay-time="50"
          @click="onSave"
        >
          <text class="draft-dialog-btn-primary-text">{{ btnSaveLabel }}</text>
        </view>

        <view
          class="draft-dialog-btn draft-dialog-btn-ghost"
          role="button"
          :aria-label="btnContinueLabel"
          hover-class="draft-dialog-btn-ghost-hover"
          :hover-stay-time="50"
          @click="onContinue"
        >
          <text class="draft-dialog-btn-ghost-text">{{ btnContinueLabel }}</text>
        </view>

        <view
          class="draft-dialog-btn draft-dialog-btn-secondary"
          role="button"
          :aria-label="btnDontSaveLabel"
          hover-class="draft-dialog-btn-secondary-hover"
          :hover-stay-time="50"
          @click="onDontSave"
        >
          <text class="draft-dialog-btn-secondary-text">{{ btnDontSaveLabel }}</text>
        </view>
      </view>
    </view>
  </view>
</template>

<script setup>
defineProps({
  visible: {
    type: Boolean,
    required: true,
  },
  title: {
    type: String,
    required: true,
  },
  message: {
    type: String,
    required: true,
  },
  btnSaveLabel: {
    type: String,
    required: true,
  },
  btnDontSaveLabel: {
    type: String,
    required: true,
  },
  btnContinueLabel: {
    type: String,
    required: true,
  },
})

const emit = defineEmits(['save', 'dontSave', 'continue'])

function onSave() {
  emit('save')
}

function onContinue() {
  emit('continue')
}

function onDontSave() {
  emit('dontSave')
}

/**
 * 蒙层点击 = 等同「不保存」分支(spec §5.4 备注)
 */
function onMaskClick() {
  emit('dontSave')
}
</script>

<style scoped>
.draft-dialog-mask {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.4);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  animation: dialogFadeIn 0.2s ease-out both;
}

.draft-dialog {
  width: 80%;
  max-width: 600rpx;
  background: #FDFBF7;
  /* surfaceCard,见 UI §二 */
  border-radius: 16px;
  /* radius-lg */
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.14);
  /* shadow-lg */
  overflow: hidden;
  box-sizing: border-box;
  animation: dialogSlideUp 0.3s cubic-bezier(0.34, 1.56, 0.64, 1) both;
  /* ease-spring */
}

.draft-dialog-content {
  padding: 32rpx 32rpx 24rpx;
  /* space-xl / space-lg */
  display: flex;
  flex-direction: column;
  gap: 16rpx;
  /* space-md */
  box-sizing: border-box;
}

.draft-dialog-title {
  display: block;
  font-family: 'Noto Serif SC', serif;
  font-size: 36rpx;
  /* 18px,UI §三 中标题 */
  font-weight: 600;
  color: #2C2C2C;
  /* ink */
  line-height: 1.4;
}

.draft-dialog-message {
  display: block;
  font-family: 'Noto Sans SC', sans-serif;
  font-size: 28rpx;
  /* 14px */
  color: #5A5A5A;
  /* inkLight */
  line-height: 1.5;
}

.draft-dialog-actions {
  display: flex;
  flex-direction: column;
  gap: 16rpx;
  /* space-md */
  padding: 0 32rpx 32rpx;
  /* 0 / space-xl */
  box-sizing: border-box;
}

.draft-dialog-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 88rpx;
  /* ≥ 44pt tap area(88rpx = 44pt) */
  border-radius: 9999px;
  /* radius-full */
  box-sizing: border-box;
  transition: opacity 0.15s ease-out, transform 0.15s ease-out, background 0.15s ease-out;
}

/* 主按钮:保存草稿 */
.draft-dialog-btn-primary {
  background: linear-gradient(135deg, #2D6A5E 0%, #3D8B7D 100%);
  /* Primary 渐变,见 UI §八 */
  box-shadow: 0 4rpx 16rpx rgba(45, 106, 94, 0.35);
  /* primaryShadow */
}

.draft-dialog-btn-primary-hover {
  transform: scale(0.96);
  box-shadow: 0 2rpx 8rpx rgba(45, 106, 94, 0.35);
}

.draft-dialog-btn-primary-text {
  font-family: 'Noto Sans SC', sans-serif;
  font-size: 30rpx;
  /* 15px,UI §三 重要正文 */
  font-weight: 600;
  color: #FFFFFF;
  line-height: 1.4;
}

/* 幽灵按钮:继续编辑 */
.draft-dialog-btn-ghost {
  background: transparent;
  border: 1.5px solid #2D6A5E;
  /* Primary 描边,见 UI §八 幽灵按钮 */
}

.draft-dialog-btn-ghost-hover {
  background: #2D6A5E;
}

.draft-dialog-btn-ghost-hover .draft-dialog-btn-ghost-text {
  color: #FFFFFF;
}

.draft-dialog-btn-ghost-text {
  font-family: 'Noto Sans SC', sans-serif;
  font-size: 30rpx;
  /* 15px */
  font-weight: 500;
  color: #2D6A5E;
  line-height: 1.4;
}

/* 次按钮:不保存 */
.draft-dialog-btn-secondary {
  background: #F2EBE0;
  /* surfaceWarm,见 UI §二 */
}

.draft-dialog-btn-secondary-hover {
  opacity: 0.8;
}

.draft-dialog-btn-secondary-text {
  font-family: 'Noto Sans SC', sans-serif;
  font-size: 30rpx;
  /* 15px */
  font-weight: 500;
  color: #2C2C2C;
  /* ink */
  line-height: 1.4;
}

@keyframes dialogFadeIn {
  from { opacity: 0; }
  to { opacity: 1; }
}

@keyframes dialogSlideUp {
  from {
    opacity: 0;
    transform: translateY(20rpx);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}
</style>
