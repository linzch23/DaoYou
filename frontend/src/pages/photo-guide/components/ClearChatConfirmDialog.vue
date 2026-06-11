<!--
  ClearChatConfirmDialog.vue — 页面私有 2 按钮清空对话弹窗(下划线前缀 = private,见 Code Style §3.4)

  Spec contract: specs/PhotoGuidePage.md §8.1

  Props
    visible          : boolean        弹窗显示标记(v-if 绑定,非 v-show)
    title            : string         弹窗标题(本页面固定传 PhotoGuideStrings.clearDialogTitle)
    message          : string         弹窗正文(本页面固定传 PhotoGuideStrings.clearDialogMessage)
    btnConfirmLabel  : string         「清空」按钮文案(本页面固定传 PhotoGuideStrings.clearDialogConfirm,红色 Danger 配色)
    btnCancelLabel   : string         「取消」按钮文案(本页面固定传 PhotoGuideStrings.clearDialogCancel)

  Emits
    confirm    : void   用户点「清空」
    cancel     : void   用户点「取消」或关闭弹窗(点蒙层)

  注:
    - 与 pages/edit-trip/components/DraftConfirmDialog.vue(_DraftConfirmDialog 3 按钮 + 草稿场景)
      **形态完全独立**;MVP 唯一调用方,沿用 _ 前缀**不**抽公共(spec §10 R-4)
    - 操作不可逆 → 「清空」按钮**红色 Danger 配色**(per spec §8.1 备注)
    - 蒙层点击 = 等同「取消」(spec §3.6)

  视觉(spec §8.1):
    - 蒙层 rgba(0,0,0,0.4) + 内容卡片 surfaceCard + radius-lg(16px) + shadow-lg
    - 动效 fadeIn 0.2s + 内容 slideUp 0.3s ease-spring(沿用 EditTripPage 形态)
    - 2 按钮:主(清空,Danger 渐变) / 次(取消,surfaceWarm)
    - 所有按钮 ≥ 88rpx = 44pt 触达
-->
<template>
  <view
    v-if="visible"
    class="clear-dialog-mask"
    role="dialog"
    aria-modal="true"
    @click="onMaskClick"
  >
    <view class="clear-dialog" @click.stop>
      <view class="clear-dialog-content">
        <text class="clear-dialog-title">{{ title }}</text>
        <text class="clear-dialog-message">{{ message }}</text>
      </view>

      <view class="clear-dialog-actions">
        <view
          class="clear-dialog-btn clear-dialog-btn-confirm"
          role="button"
          :aria-label="btnConfirmLabel"
          hover-class="clear-dialog-btn-confirm-hover"
          :hover-stay-time="50"
          @click="onConfirm"
        >
          <text class="clear-dialog-btn-confirm-text">{{ btnConfirmLabel }}</text>
        </view>

        <view
          class="clear-dialog-btn clear-dialog-btn-cancel"
          role="button"
          :aria-label="btnCancelLabel"
          hover-class="clear-dialog-btn-cancel-hover"
          :hover-stay-time="50"
          @click="onCancel"
        >
          <text class="clear-dialog-btn-cancel-text">{{ btnCancelLabel }}</text>
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
  btnConfirmLabel: {
    type: String,
    required: true,
  },
  btnCancelLabel: {
    type: String,
    required: true,
  },
})

const emit = defineEmits(['confirm', 'cancel'])

function onConfirm() {
  emit('confirm')
}

function onCancel() {
  emit('cancel')
}

/**
 * 蒙层点击 = 等同「取消」分支(spec §3.6 备注)
 */
function onMaskClick() {
  emit('cancel')
}
</script>

<style scoped>
.clear-dialog-mask {
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
  animation: clearDialogFadeIn 0.2s ease-out both;
}

.clear-dialog {
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
  animation: clearDialogSlideUp 0.3s cubic-bezier(0.34, 1.56, 0.64, 1) both;
  /* ease-spring */
}

.clear-dialog-content {
  padding: 32rpx 32rpx 24rpx;
  /* space-xl / space-lg */
  display: flex;
  flex-direction: column;
  gap: 16rpx;
  /* space-md */
  box-sizing: border-box;
}

.clear-dialog-title {
  display: block;
  font-family: 'Noto Serif SC', serif;
  font-size: 36rpx;
  /* 18px,UI §三 中标题 */
  font-weight: 600;
  color: #2C2C2C;
  /* ink */
  line-height: 1.4;
}

.clear-dialog-message {
  display: block;
  font-family: 'Noto Sans SC', sans-serif;
  font-size: 28rpx;
  /* 14px */
  color: #5A5A5A;
  /* inkLight */
  line-height: 1.5;
}

.clear-dialog-actions {
  display: flex;
  flex-direction: column;
  gap: 16rpx;
  /* space-md */
  padding: 0 32rpx 32rpx;
  /* 0 / space-xl */
  box-sizing: border-box;
}

.clear-dialog-btn {
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

/* 主按钮:清空(操作不可逆 → 红色 Danger 配色) */
.clear-dialog-btn-confirm {
  background: linear-gradient(135deg, #C44A3A 0%, #E87D5A 100%);
  /* Danger 渐变,见 UI §八 + spec §8.1 */
  box-shadow: 0 4rpx 16rpx rgba(196, 74, 58, 0.35);
}

.clear-dialog-btn-confirm-hover {
  transform: scale(0.96);
  box-shadow: 0 2rpx 8rpx rgba(196, 74, 58, 0.35);
}

.clear-dialog-btn-confirm-text {
  font-family: 'Noto Sans SC', sans-serif;
  font-size: 30rpx;
  /* 15px,UI §三 重要正文 */
  font-weight: 600;
  color: #FFFFFF;
  line-height: 1.4;
}

/* 次按钮:取消 */
.clear-dialog-btn-cancel {
  background: #F2EBE0;
  /* surfaceWarm,见 UI §二 */
}

.clear-dialog-btn-cancel-hover {
  opacity: 0.8;
}

.clear-dialog-btn-cancel-text {
  font-family: 'Noto Sans SC', sans-serif;
  font-size: 30rpx;
  /* 15px */
  font-weight: 500;
  color: #2C2C2C;
  /* ink */
  line-height: 1.4;
}

@keyframes clearDialogFadeIn {
  from { opacity: 0; }
  to { opacity: 1; }
}

@keyframes clearDialogSlideUp {
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
