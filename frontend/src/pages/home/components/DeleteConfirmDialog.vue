<!--
  DeleteConfirmDialog.vue — HomePage 私有 2 按钮删除确认弹窗

  Spec contract: UserRound2-001 §3 Bug C 首页草稿删除入口
  形态:沿用 TrashPage PermanentDeleteConfirmDialog(per AGENTS.md §8.6 私形态决策);
  MVP 唯一调用方,不抽公共子组件。

  Props
    visible          : boolean        弹窗显示标记(v-if 绑定,非 v-show)
    title            : string         弹窗标题(本页面固定传 HomeStrings.deleteConfirmTitle)
    message          : string         弹窗正文(本页面固定传 HomeStrings.deleteConfirmMessage)
    btnConfirmLabel  : string         「删除」按钮文案(本页面固定传 HomeStrings.deleteConfirmConfirm)
    btnCancelLabel   : string         「取消」按钮文案(本页面固定传 HomeStrings.deleteConfirmCancel)

  Emits
    confirm    : void   用户点「删除」→ 触发 HomePage 调 homeStore.deleteTrip + refreshAll
    cancel     : void   用户点「取消」/ 蒙层触发

  视觉(spec §3 + UI §二):
    - 蒙层 rgba(0,0,0,0.4) + 内容卡片 surfaceCard + radius-lg(16px) + shadow-lg
    - 主按钮(删除):Primary 渐变 + 阴影(普通操作,非 Danger — 与 TrashPage 永久删除的「操作不可逆」语义不同;
      home page 删除 = 软删除 + 后端置 deleted_at,可走回收站恢复,per services/trips.js L359)
    - 次按钮(取消):AppColors.surfaceWarm 背景
    - 所有按钮 ≥ 88rpx = 44pt 触达(per AGENTS.md §0 NFR 可访问性)
    - 蒙层点击 = 等同「取消」
    - 动效 fadeIn 0.2s + slideUp 0.3s ease-spring

  注:
    - 沿用 TrashPage PermanentDeleteConfirmDialog 同形态(MVP 唯一调用方不抽公共)
    - 与 _DraftConfirmDialog(3 按钮草稿)/ _LogoutConfirmDialog / ApplyPlanConfirmDialog 形态独立;
      本页面 = 2 按钮(取消 / 删除,Primary 非 Danger)
    - 0 触动既有 16 page entry / 0 触动既有 components / 0 触动既有 stores / 0 触动既有 services
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
          hover-class="delete-dialog-btn-cancel-hover"
          :hover-stay-time="50"
          @click="onCancel"
        >
          <text class="delete-dialog-btn-cancel-text">{{ btnCancelLabel }}</text>
        </view>

        <view
          class="delete-dialog-btn delete-dialog-btn-confirm"
          role="button"
          :aria-label="btnConfirmLabel"
          hover-class="delete-dialog-btn-confirm-hover"
          :hover-stay-time="50"
          @click="onConfirm"
        >
          <text class="delete-dialog-btn-confirm-text">{{ btnConfirmLabel }}</text>
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
 * 蒙层点击 = 等同「取消」
 */
function onMaskClick() {
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
  /* 高于一般浮层,避免被其他浮层遮挡 */
  animation: deleteDialogFadeIn 0.2s ease-out both;
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
  animation: deleteDialogSlideUp 0.3s cubic-bezier(0.34, 1.56, 0.64, 1) both;
  /* ease-spring,沿用 TrashPage PermanentDeleteConfirmDialog 形态 */
}

.delete-dialog-content {
  padding: 32rpx 32rpx 24rpx;
  display: flex;
  flex-direction: column;
  gap: 16rpx;
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
  padding: 0 32rpx 32rpx;
  box-sizing: border-box;
}

.delete-dialog-btn {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 88rpx;
  /* ≥ 44pt tap area(per AGENTS.md §0 NFR) */
  border-radius: 9999px;
  /* radius-full */
  box-sizing: border-box;
  transition: opacity 0.15s ease-out, transform 0.15s ease-out, background 0.15s ease-out;
}

/* 主按钮:删除(Primary 配色 — 与 TrashPage 永久删除的「Danger 不可逆」语义不同;
   本页面删除 = 软删除 + 后端置 deleted_at,可走回收站恢复,per services/trips.js:359) */
.delete-dialog-btn-confirm {
  background: linear-gradient(135deg, #2D6A5E 0%, #5BA089 100%);
  /* Primary 渐变,见 UI §二 + §八 */
  box-shadow: 0 4rpx 16rpx rgba(45, 106, 94, 0.35);
}

.delete-dialog-btn-confirm-hover {
  transform: scale(0.96);
  box-shadow: 0 2rpx 8rpx rgba(45, 106, 94, 0.35);
}

.delete-dialog-btn-confirm-text {
  font-family: 'Noto Sans SC', sans-serif;
  font-size: 30rpx;
  /* 15px */
  font-weight: 600;
  color: #FFFFFF;
  line-height: 1.4;
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

@keyframes deleteDialogFadeIn {
  from { opacity: 0; }
  to { opacity: 1; }
}

@keyframes deleteDialogSlideUp {
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