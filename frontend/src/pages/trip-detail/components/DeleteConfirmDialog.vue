<!--
  DeleteConfirmDialog.vue — 行程详情页私有 2 按钮删除确认弹窗(下划线前缀 = private,见 Code Style §3.4)
  
  Spec contract: specs/TripDetailPage.md §8.1
  
  Props
    visible          : boolean        弹窗显示标记(v-if 绑定,非 v-show)
    title            : string         弹窗标题(父传 TripDetailStrings.deleteDialogTitle)
    message          : string         弹窗正文(父传 TripDetailStrings.deleteDialogMessage)
    btnCancelLabel   : string         「取消」按钮文案
    btnConfirmLabel  : string         「确定删除」按钮文案
    confirming       : boolean        删除飞行中标记;true 时按钮置灰 + 文案改为 deleteDialogConfirming
  
  Emits
    cancel    : void    用户点「取消」/ 关闭弹窗(蒙层点击等同取消)
    confirm   : void    用户点「确定删除」
  
  视觉:
    - 蒙层 rgba(0,0,0,0.4) + 内容卡片 surfaceCard + radius-lg(16px) + shadow-lg
    - 动效 fadeIn 0.2s + slideUp 0.3s ease-spring(沿用 _DraftConfirmDialog 形态)
    - 2 按钮横排:次(取消 surfaceWarm,左)/ 主(确定删除 Primary 渐变,右)
    - 所有按钮 ≥ 88rpx = 44pt 触达(spec §10 NFR 可访问性)
-->
<template>
  <view
    v-if="visible"
    class="delete-dialog-mask"
    role="dialog"
    aria-modal="true"
    @click="onMaskClick"
  >
    <view class="delete-dialog" @click.stop>
      <view class="delete-dialog-content">
        <text class="delete-dialog-title">{{ title }}</text>
        <text class="delete-dialog-message">{{ message }}</text>
      </view>

      <view class="delete-dialog-actions">
        <view
          class="delete-dialog-btn delete-dialog-btn-cancel"
          role="button"
          :aria-label="btnCancelLabel"
          :class="{ 'delete-dialog-btn-disabled': confirming }"
          hover-class="delete-dialog-btn-cancel-hover"
          :hover-stay-time="50"
          @click="onCancel"
        >
          <text class="delete-dialog-btn-cancel-text">{{ btnCancelLabel }}</text>
        </view>

        <view
          class="delete-dialog-btn delete-dialog-btn-confirm"
          role="button"
          :aria-label="confirming ? confirmingLabel : btnConfirmLabel"
          :class="{ 'delete-dialog-btn-disabled': confirming }"
          hover-class="delete-dialog-btn-confirm-hover"
          :hover-stay-time="50"
          @click="onConfirm"
        >
          <text class="delete-dialog-btn-confirm-text">{{ confirming ? confirmingLabel : btnConfirmLabel }}</text>
        </view>
      </view>
    </view>
  </view>
</template>

<script setup>
import { computed } from 'vue'
import { TripDetailStrings } from '../../../constants/strings.js'

const props = defineProps({
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
  btnCancelLabel: {
    type: String,
    required: true,
  },
  btnConfirmLabel: {
    type: String,
    required: true,
  },
  confirming: {
    type: Boolean,
    default: false,
  },
})

const emit = defineEmits(['cancel', 'confirm'])

// 飞行中文案(删除中...)— 引用 TripDetailStrings 避免硬编码
const confirmingLabel = computed(() => TripDetailStrings.deleteDialogConfirming)

function onCancel() {
  if (props.confirming) return
  emit('cancel')
}

function onConfirm() {
  if (props.confirming) return
  emit('confirm')
}

/**
 * 蒙层点击 = 等同「取消」分支(spec §5.3.J 关闭)
 */
function onMaskClick() {
  if (props.confirming) return
  emit('cancel')
}
</script>

<style scoped>
.delete-dialog-mask {
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
  /* 高于 SpotDetailSheet 浮层(999 / 1000),避免被景点详情遮挡 */
  animation: dialogFadeIn 0.2s ease-out both;
  padding: 40rpx;
  box-sizing: border-box;
}

.delete-dialog {
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

.delete-dialog-content {
  padding: 32rpx 32rpx 24rpx;
  /* space-xl / space-lg */
  display: flex;
  flex-direction: column;
  gap: 16rpx;
  /* space-md */
  box-sizing: border-box;
}

.delete-dialog-title {
  display: block;
  font-family: 'Noto Serif SC', serif;
  font-size: 36rpx;
  /* 18px,UI §三 中标题 */
  font-weight: 600;
  color: #2C2C2C;
  /* ink */
  line-height: 1.4;
}

.delete-dialog-message {
  display: block;
  font-family: 'Noto Sans SC', sans-serif;
  font-size: 28rpx;
  /* 14px */
  color: #5A5A5A;
  /* inkLight */
  line-height: 1.5;
}

.delete-dialog-actions {
  display: flex;
  align-items: center;
  gap: 16rpx;
  /* space-md */
  padding: 0 32rpx 32rpx;
  box-sizing: border-box;
}

.delete-dialog-btn {
  flex: 1;
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

/* 次按钮:取消 */
.delete-dialog-btn-cancel {
  background: #F2EBE0;
  /* surfaceWarm,见 UI §二 */
}

.delete-dialog-btn-cancel-hover {
  opacity: 0.8;
}

.delete-dialog-btn-cancel-text {
  font-family: 'Noto Sans SC', sans-serif;
  font-size: 30rpx;
  /* 15px */
  font-weight: 500;
  color: #2C2C2C;
  /* ink */
  line-height: 1.4;
}

/* 主按钮:确定删除 */
.delete-dialog-btn-confirm {
  background: linear-gradient(135deg, #2D6A5E 0%, #3D8B7D 100%);
  /* Primary 渐变,见 UI §八 */
  box-shadow: 0 4rpx 16rpx rgba(45, 106, 94, 0.35);
  /* primaryShadow */
}

.delete-dialog-btn-confirm-hover {
  transform: scale(0.96);
  box-shadow: 0 2rpx 8rpx rgba(45, 106, 94, 0.35);
}

.delete-dialog-btn-confirm-text {
  font-family: 'Noto Sans SC', sans-serif;
  font-size: 30rpx;
  /* 15px,UI §三 重要正文 */
  font-weight: 600;
  color: #FFFFFF;
  line-height: 1.4;
}

/* 飞行中置灰(spec §5.3.F + §9 AC-06) */
.delete-dialog-btn-disabled {
  opacity: 0.5;
  pointer-events: none;
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
