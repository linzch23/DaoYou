<!--
  ApplyPlanConfirmDialog.vue — ChatPage 私有 2 按钮确认弹窗(per specs/ChatPage.md §3.10 + §8.4)

  形态:沿用 EditTripPage DraftConfirmDialog 2 按钮版本;
  二次确认后 ChatPage MVP 阶段仅展示「即将上线」Toast(per §3.10)。

  Props
    visible          : boolean        弹窗显示标记(v-if 绑定,非 v-show)
    title            : string         弹窗标题(本页面传 ChatPageStrings.applyPlanTitle)
    message          : string         弹窗正文(本页面传 ChatPageStrings.applyPlanMessage)
    btnConfirmLabel  : string         「确认」按钮文案(本页面传 ChatPageStrings.applyPlanConfirm)
    btnCancelLabel   : string         「取消」按钮文案(本页面传 ChatPageStrings.applyPlanCancel)

  Emits
    confirm    : void   用户点「确认」→ 触发 ChatPage Toast(per §3.10)
    cancel     : void   用户点「取消」/ 蒙层触发

  视觉(spec §3.10 + §8.4):
    - 蒙层 rgba(0,0,0,0.4) + 内容卡片 surfaceCard + radius-lg(16px) + shadow-lg
    - 主按钮(确认):Primary 渐变 + 阴影(普通确认,非 Danger)
    - 次按钮(取消):AppColors.surfaceWarm 背景
    - 所有按钮 ≥ 88rpx = 44pt 触达(per spec §10 NFR 可访问性)
    - 蒙层点击 = 等同「取消」(per spec §8.4)
    - 动效 fadeIn 0.2s + slideUp 0.3s ease-spring

  注:
    - 沿 TrashPage PermanentDeleteConfirmDialog 私形态(MVP 唯一调用方不抽公共)
    - 与 ActionOptionsModal 形态独立(2 按钮文字描述 vs 选项列表)
    - 0 触动既有 16 page entry / 0 触动既有 components / 0 触动既有 stores / 0 触动既有 services
-->
<template>
  <view
    v-if="visible"
    class="apply-plan-mask"
    role="dialog"
    aria-modal="true"
    @click="onMaskClick"
  >
    <view class="apply-plan" @click.stop>
      <view class="apply-plan-content">
        <text class="apply-plan-title">{{ title }}</text>
        <text class="apply-plan-message">{{ message }}</text>
      </view>

      <view class="apply-plan-actions">
        <view
          class="apply-plan-btn apply-plan-btn-cancel"
          role="button"
          :aria-label="btnCancelLabel"
          hover-class="apply-plan-btn-cancel-hover"
          :hover-stay-time="50"
          @click="onCancel"
        >
          <text class="apply-plan-btn-cancel-text">{{ btnCancelLabel }}</text>
        </view>

        <view
          class="apply-plan-btn apply-plan-btn-confirm"
          role="button"
          :aria-label="btnConfirmLabel"
          hover-class="apply-plan-btn-confirm-hover"
          :hover-stay-time="50"
          @click="onConfirm"
        >
          <text class="apply-plan-btn-confirm-text">{{ btnConfirmLabel }}</text>
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
 * 蒙层点击 = 等同「取消」(per spec §8.4)
 */
function onMaskClick() {
  emit('cancel')
}
</script>

<style scoped>
.apply-plan-mask {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.4);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1100;
  /* 高于一般浮层,避免被其他浮层遮挡 */
  animation: applyPlanFadeIn 0.2s ease-out both;
  padding: 40rpx;
  box-sizing: border-box;
}

.apply-plan {
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
  animation: applyPlanSlideUp 0.3s cubic-bezier(0.34, 1.56, 0.64, 1) both;
  /* ease-spring,沿 TrashPage PermanentDeleteConfirmDialog 同形态 */
}

.apply-plan-content {
  padding: 32rpx 32rpx 24rpx;
  display: flex;
  flex-direction: column;
  gap: 16rpx;
  box-sizing: border-box;
}

.apply-plan-title {
  display: block;
  font-family: 'Noto Serif SC', serif;
  font-size: 36rpx;
  /* 18px,UI §三 中标题 */
  font-weight: 600;
  color: #2C2C2C;
  /* ink */
  line-height: 1.4;
}

.apply-plan-message {
  display: block;
  font-family: 'Noto Sans SC', sans-serif;
  font-size: 28rpx;
  /* 14px */
  color: #5A5A5A;
  /* inkLight */
  line-height: 1.5;
}

.apply-plan-actions {
  display: flex;
  align-items: center;
  gap: 16rpx;
  padding: 0 32rpx 32rpx;
  box-sizing: border-box;
}

.apply-plan-btn {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 88rpx;
  /* ≥ 44pt tap area(88rpx = 44pt,per spec §10 NFR) */
  border-radius: 9999px;
  /* radius-full */
  box-sizing: border-box;
  transition: opacity 0.15s ease-out, transform 0.15s ease-out, background 0.15s ease-out;
}

/* 主按钮:确认(普通 Primary 配色,非 Danger) */
.apply-plan-btn-confirm {
  background: linear-gradient(135deg, #2D6A5E 0%, #5BA089 100%);
  /* Primary 渐变,见 UI §二 + §八 */
  box-shadow: 0 4rpx 16rpx rgba(45, 106, 94, 0.35);
}

.apply-plan-btn-confirm-hover {
  transform: scale(0.96);
  box-shadow: 0 2rpx 8rpx rgba(45, 106, 94, 0.35);
}

.apply-plan-btn-confirm-text {
  font-family: 'Noto Sans SC', sans-serif;
  font-size: 30rpx;
  /* 15px */
  font-weight: 600;
  color: #FFFFFF;
  line-height: 1.4;
}

/* 次按钮:取消 */
.apply-plan-btn-cancel {
  background: #F2EBE0;
  /* surfaceWarm,见 UI §二 */
}

.apply-plan-btn-cancel-hover {
  opacity: 0.8;
}

.apply-plan-btn-cancel-text {
  font-family: 'Noto Sans SC', sans-serif;
  font-size: 30rpx;
  /* 15px */
  font-weight: 500;
  color: #2C2C2C;
  /* ink */
  line-height: 1.4;
}

@keyframes applyPlanFadeIn {
  from { opacity: 0; }
  to { opacity: 1; }
}

@keyframes applyPlanSlideUp {
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