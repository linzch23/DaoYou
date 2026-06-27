<!--
  LogoutConfirmDialog.vue — 我的页面私有 2 按钮退出登录弹窗(下划线前缀 = private,见 Code Style §3.4)

  Spec contract: specs/MyPage.md §3.5 + §8.1

  Props
    visible          : boolean        弹窗显示标记(v-if 绑定,非 v-show)
    title            : string         弹窗标题(本页面固定传 MyPageStrings.logoutDialogTitle)
    message          : string         弹窗正文(本页面固定传 MyPageStrings.logoutDialogMessage)
    btnConfirmLabel  : string         「退出登录」按钮文案(本页面固定传 MyPageStrings.logoutDialogConfirm,红色 Danger 配色)
    btnCancelLabel   : string         「取消」按钮文案(本页面固定传 MyPageStrings.logoutDialogCancel)

  Emits
    confirm    : void   用户点「退出登录」→ 触发 onLogoutConfirm()(per §5.2 Step 4)
    cancel     : void   用户点「取消」或关闭弹窗(点蒙层)

  注:
    - 沿用 PhotoGuidePage §3.6 2 按钮清空 dialog 形态(2026-06-24 Fix D 已移除)+ Danger 配色 +
      动效 fadeIn 0.2s + slideUp 0.3s cubic-bezier(0.34, 1.56, 0.64, 1)
    - 与 pages/edit-trip/components/DraftConfirmDialog.vue(3 按钮 + 草稿场景)
      **形态完全独立**;MVP 唯一调用方,沿用 _ 前缀**不**抽公共(per spec §3 备注 6 + §8.3)
    - 操作不可逆(无法"撤销"登出)→ 「退出登录」按钮**红色 Danger 配色**(per spec §8.1 备注)
    - 蒙层点击 = 等同「取消」(per spec §3.5)

  视觉(spec §3.5 + §8.1):
    - 蒙层 rgba(0,0,0,0.4) + 内容卡片 surfaceCard + radius-lg(16px) + shadow-lg
    - 主按钮(退出登录):linear-gradient(135deg, #C44A3A 0%, #E87D5A 100%) + 阴影
    - 次按钮(取消):AppColors.surfaceWarm 背景
    - 所有按钮 ≥ 88rpx = 44pt 触达(per spec §10 NFR 可访问性)
-->
<template>
  <view
    v-if="visible"
    class="logout-dialog-mask"
    role="dialog"
    aria-modal="true"
    @click="onMaskClick"
  >
    <view class="logout-dialog" @click.stop>
      <view class="logout-dialog-content">
        <text class="logout-dialog-title">{{ title }}</text>
        <text class="logout-dialog-message">{{ message }}</text>
      </view>

      <view class="logout-dialog-actions">
        <view
          class="logout-dialog-btn logout-dialog-btn-cancel"
          role="button"
          :aria-label="btnCancelLabel"
          hover-class="logout-dialog-btn-cancel-hover"
          :hover-stay-time="50"
          @click="onCancel"
        >
          <text class="logout-dialog-btn-cancel-text">{{ btnCancelLabel }}</text>
        </view>

        <view
          class="logout-dialog-btn logout-dialog-btn-confirm"
          role="button"
          :aria-label="btnConfirmLabel"
          hover-class="logout-dialog-btn-confirm-hover"
          :hover-stay-time="50"
          @click="onConfirm"
        >
          <text class="logout-dialog-btn-confirm-text">{{ btnConfirmLabel }}</text>
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
 * 蒙层点击 = 等同「取消」分支(spec §3.5 备注)
 */
function onMaskClick() {
  emit('cancel')
}
</script>

<style scoped>
.logout-dialog-mask {
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
  /* 高于一般浮层(999/1000),避免被其他浮层遮挡 */
  animation: logoutDialogFadeIn 0.2s ease-out both;
  padding: 40rpx;
  box-sizing: border-box;
}

.logout-dialog {
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
  animation: logoutDialogSlideUp 0.3s cubic-bezier(0.34, 1.56, 0.64, 1) both;
  /* ease-spring */
}

.logout-dialog-content {
  padding: 32rpx 32rpx 24rpx;
  /* space-xl / space-lg */
  display: flex;
  flex-direction: column;
  gap: 16rpx;
  /* space-md */
  box-sizing: border-box;
}

.logout-dialog-title {
  display: block;
  font-family: 'Noto Serif SC', serif;
  font-size: 36rpx;
  /* 18px,UI §三 中标题 */
  font-weight: 600;
  color: #2C2C2C;
  /* ink */
  line-height: 1.4;
}

.logout-dialog-message {
  display: block;
  font-family: 'Noto Sans SC', sans-serif;
  font-size: 28rpx;
  /* 14px */
  color: #5A5A5A;
  /* inkLight */
  line-height: 1.5;
}

.logout-dialog-actions {
  display: flex;
  align-items: center;
  gap: 16rpx;
  /* space-md */
  padding: 0 32rpx 32rpx;
  box-sizing: border-box;
}

.logout-dialog-btn {
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

/* 主按钮:退出登录(操作不可逆 → 红色 Danger 配色,per spec §3.5 + §8.1) */
.logout-dialog-btn-confirm {
  background: linear-gradient(135deg, #C44A3A 0%, #E87D5A 100%);
  /* Danger 渐变,见 UI §二 + §八 */
  box-shadow: 0 4rpx 16rpx rgba(196, 74, 58, 0.35);
  /* dangerShadow */
}

.logout-dialog-btn-confirm-hover {
  transform: scale(0.96);
  box-shadow: 0 2rpx 8rpx rgba(196, 74, 58, 0.35);
}

.logout-dialog-btn-confirm-text {
  font-family: 'Noto Sans SC', sans-serif;
  font-size: 30rpx;
  /* 15px,UI §三 重要正文 */
  font-weight: 600;
  color: #FFFFFF;
  line-height: 1.4;
}

/* 次按钮:取消 */
.logout-dialog-btn-cancel {
  background: #F2EBE0;
  /* surfaceWarm,见 UI §二 */
}

.logout-dialog-btn-cancel-hover {
  opacity: 0.8;
}

.logout-dialog-btn-cancel-text {
  font-family: 'Noto Sans SC', sans-serif;
  font-size: 30rpx;
  /* 15px */
  font-weight: 500;
  color: #2C2C2C;
  /* ink */
  line-height: 1.4;
}

@keyframes logoutDialogFadeIn {
  from { opacity: 0; }
  to { opacity: 1; }
}

@keyframes logoutDialogSlideUp {
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
