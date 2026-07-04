<!--
  ActionOptionsModal.vue — ChatPage 私有选项列表 modal(per specs/ChatPage.md §3.9 + §8.3)

  形态:沿 PhotoGuidePage ClearChatConfirmDialog 2 按钮 modal 形态;
  选项区 v-for 渲染,每项可选中(背景 AppColors.primarySoft + 1.5px AppColors.primary 描边 + ✓);
  二次确认后 ChatPage MVP 阶段仅展示「即将上线」Toast(per §3.9)。

  Props
    visible          : boolean        弹窗显示标记(v-if 绑定,非 v-show)
    options          : any[]          改线选项列表(MVP any[] 占位,per §6.4 PD-001 决策 #3)
    title            : string         modal 标题(本页面固定传 ChatPageStrings.actionOptionsTitle)
    btnConfirmLabel  : string         「应用此方案」按钮文案(本页面传 ChatPageStrings.actionOptionsConfirm)
    btnCancelLabel   : string         「取消」按钮文案(本页面传 ChatPageStrings.actionOptionsCancel)
    invalidMessage   : string         (v0.3.0 新增)校验失败提示;非空时顶部显示 banner + confirm 按钮 disabled,
                                       文本走父 page 提供(本页面传 ChatPageStrings.replanInvalid);空 = 隐藏 banner

  Emits
    confirm  (selectedOption: any)   用户选中某项 + 点「应用此方案」触发,传选中 option
    cancel                            用户点「取消」/ 蒙层触发

  视觉(spec §3.9 + §8.3):
    - 蒙层 rgba(0,0,0,0.4) + 内容卡片 surfaceCard + radius-lg(16px) + shadow-lg
    - 主按钮(应用此方案):Primary 渐变 + 阴影
    - 次按钮(取消):AppColors.surfaceWarm 背景
    - 所有按钮 ≥ 88rpx = 44pt 触达(per spec §10 NFR 可访问性)
    - 选项 v-for 渲染,选中态背景 primarySoft + 1.5px primary 描边
    - 蒙层点击 = 等同「取消」(per spec §8.3)
    - 动效 fadeIn 0.2s + slideUp 0.3s ease-spring

  注:
    - 沿用 TrashPage PermanentDeleteConfirmDialog 私有 modal 形态(MVP 唯一调用方不抽公共)
    - 0 触动既有 16 page entry / 0 触动既有 components / 0 触动既有 stores / 0 触动既有 services
-->
<template>
  <view
    v-if="visible"
    class="action-options-mask"
    role="dialog"
    aria-modal="true"
    @click="onMaskClick"
  >
    <view class="action-options" @click.stop>
      <view class="action-options-content">
        <text class="action-options-title">{{ title }}</text>

        <!-- v0.3.0 新增:校验失败顶部 banner(per spec §3.9 step 6 + AC-24,父 page 传 ChatPageStrings.replanInvalid) -->
        <view
          v-if="invalidMessage"
          class="action-options-invalid-banner"
          role="alert"
          aria-live="polite"
        >
          <text class="action-options-invalid-banner-text">{{ invalidMessage }}</text>
        </view>

        <scroll-view
          class="action-options-list"
          scroll-y
          :enhanced="true"
          :show-scrollbar="false"
        >
          <view
            v-if="planOption"
            class="action-option-row"
            :class="{ 'action-options-btn-disabled': submitting }"
            :aria-label="getOptionLabel(planOption)"
          >
            <view class="action-option-row-text">
              <text class="action-option-title">{{ getOptionTitle(planOption) }}</text>
              <text
                v-if="getOptionDescription(planOption)"
                class="action-option-description"
              >{{ getOptionDescription(planOption) }}</text>
              <view v-if="batchOperations.length" class="batch-operation-list">
                <view
                  v-for="operation in batchOperations"
                  :key="operation.operation_id"
                  class="batch-operation-row"
                  :class="{ 'batch-operation-row-selected': isOperationSelected(operation.operation_id) }"
                  role="checkbox"
                  :aria-label="operation.label || operation.operation"
                  :aria-checked="isOperationSelected(operation.operation_id) ? 'true' : 'false'"
                  @click="toggleOperation(operation.operation_id)"
                >
                  <text class="batch-operation-item">{{ operation.label || operation.operation }}</text>
                  <view
                    v-if="isOperationSelected(operation.operation_id)"
                    class="action-option-check"
                    aria-hidden="true"
                  >
                    <text class="action-option-check-icon">✓</text>
                  </view>
                </view>
              </view>
            </view>
          </view>
        </scroll-view>
      </view>

      <view class="action-options-actions">
        <view
          class="action-options-btn action-options-btn-cancel"
          role="button"
          :aria-label="btnCancelLabel"
          hover-class="action-options-btn-cancel-hover"
          :hover-stay-time="50"
          @click="onCancel"
        >
          <text class="action-options-btn-cancel-text">{{ btnCancelLabel }}</text>
        </view>

        <view
          class="action-options-btn action-options-btn-confirm"
          :class="{ 'action-options-btn-disabled': confirmDisabled }"
          role="button"
          :aria-label="confirmButtonLabel"
          :aria-disabled="confirmDisabled ? 'true' : 'false'"
          hover-class="action-options-btn-confirm-hover"
          :hover-stay-time="50"
          @click="onConfirm"
        >
          <text class="action-options-btn-confirm-text">{{ confirmButtonLabel }}</text>
        </view>
      </view>
    </view>
  </view>
</template>

<script setup>
import { computed, ref, watch } from 'vue'
import { getBatchOperationIds } from '../../../services/actionOptionValidation.js'

const props = defineProps({
  visible: {
    type: Boolean,
    required: true,
  },
  options: {
    type: Array,
    required: true,
  },
  title: {
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
  submitting: {
    type: Boolean,
    default: false,
  },
  // v0.3.0 新增:校验失败顶部 banner(per spec §3.9 step 6 + AC-24)
  invalidMessage: {
    type: String,
    default: '',
  },
})

const emit = defineEmits(['confirm', 'cancel'])

const selectedOperationIds = ref([])
const planOption = computed(() => props.options.length === 1 ? props.options[0] : null)
const batchOperations = computed(() => getBatchOperations(planOption.value))
const confirmDisabled = computed(() => (
  !planOption.value
  || props.submitting
  || !!props.invalidMessage
  || (batchOperations.value.length > 0 && selectedOperationIds.value.length === 0)
))
const confirmButtonLabel = computed(() => (
  batchOperations.value.length > 0
    ? `添加选中项（${selectedOperationIds.value.length}）`
    : props.btnConfirmLabel
))

// 弹窗关闭后清空选中态(避免下次弹时残留)
watch(
  () => [
    props.visible,
    props.options.map((option) => option?.action_id || '').join('|'),
  ],
  ([visible]) => {
    if (!visible) {
      selectedOperationIds.value = []
    } else {
      selectedOperationIds.value = getBatchOperationIds(planOption.value)
    }
  },
  { immediate: true }
)

/**
 * 提取 option title(优先使用 Agent 合同的 label 字段)
 * @param {any} opt
 * @returns {string}
 */
function getOptionTitle(opt) {
  if (opt && typeof opt === 'object') {
    if (typeof opt.label === 'string') return opt.label
    if (typeof opt.title === 'string') return opt.title
    if (typeof opt.name === 'string') return opt.name
  }
  return String(opt)
}

/**
 * 提取 option description(可选字段)
 * @param {any} opt
 * @returns {string}
 */
function getOptionDescription(opt) {
  if (opt && typeof opt === 'object' && typeof opt.description === 'string') {
    return opt.description
  }
  return ''
}

function getBatchOperations(opt) {
  return opt?.operation === 'batch' && Array.isArray(opt.operations)
    ? opt.operations
    : []
}

/**
 * 派生 aria-label(title + description)
 * @param {any} opt
 * @returns {string}
 */
function getOptionLabel(opt) {
  const t = getOptionTitle(opt)
  const d = getOptionDescription(opt)
  return d ? `${t},${d}` : t
}

/**
 * 点击某项 → 选中态切换
 * @param {number} idx
 */
function isOperationSelected(operationId) {
  return selectedOperationIds.value.includes(operationId)
}

function toggleOperation(operationId) {
  if (props.submitting) return
  selectedOperationIds.value = isOperationSelected(operationId)
    ? selectedOperationIds.value.filter((id) => id !== operationId)
    : [...selectedOperationIds.value, operationId]
}

/**
 * 「应用此方案」→ emit confirm(option)
 */
function onConfirm() {
  if (confirmDisabled.value) return
  emit(
    'confirm',
    planOption.value,
    batchOperations.value.length > 0 ? selectedOperationIds.value : undefined
  )
}

/**
 * 「取消」按钮 → emit cancel
 */
function onCancel() {
  if (props.submitting) return
  emit('cancel')
}

/**
 * 蒙层点击 = 等同「取消」(per spec §8.3)
 */
function onMaskClick() {
  if (props.submitting) return
  emit('cancel')
}
</script>

<style scoped>
.action-options-mask {
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
  animation: actionOptionsFadeIn 0.2s ease-out both;
  padding: 40rpx;
  box-sizing: border-box;
}

.action-options {
  width: 80%;
  max-width: 600rpx;
  max-height: 80vh;
  background: #FDFBF7;
  /* surfaceCard,见 UI §二 */
  border-radius: 16px;
  /* radius-lg */
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.14);
  /* shadow-lg */
  overflow: hidden;
  box-sizing: border-box;
  animation: actionOptionsSlideUp 0.3s cubic-bezier(0.34, 1.56, 0.64, 1) both;
  /* ease-spring,沿用 TrashPage _PermanentDeleteConfirmDialog 形态 */
  display: flex;
  flex-direction: column;
}

.action-options-content {
  padding: 32rpx 32rpx 16rpx;
  display: flex;
  flex-direction: column;
  gap: 16rpx;
  box-sizing: border-box;
  flex: 1;
  min-height: 0;
}

.action-options-title {
  display: block;
  font-family: 'Noto Serif SC', serif;
  font-size: 36rpx;
  /* 18px,UI §三 中标题 */
  font-weight: 600;
  color: #2C2C2C;
  /* ink */
  line-height: 1.4;
}

/* v0.3.0 新增:校验失败顶部 banner(per spec §3.9 step 6 + AC-24) */
.action-options-invalid-banner {
  background: rgba(196, 74, 58, 0.08);
  /* danger #C44A3A 8% 透明,见 UI §二 */
  border-left: 4rpx solid #C44A3A;
  /* danger,见 UI §二 */
  border-radius: 8px;
  padding: 16rpx 20rpx;
  box-sizing: border-box;
  opacity: 0.95;
  animation: actionOptionsFadeIn 0.15s ease-out both;
}

.action-options-invalid-banner-text {
  font-family: 'Noto Sans SC', sans-serif;
  font-size: 26rpx;
  /* 13px */
  color: #C44A3A;
  /* danger,见 UI §二 */
  line-height: 1.4;
}

.action-options-list {
  flex: 1;
  /* 占满剩余高度 */
  min-height: 200rpx;
  max-height: 480rpx;
}

.action-option-row {
  display: flex;
  align-items: center;
  gap: 16rpx;
  padding: 20rpx 24rpx;
  margin-bottom: 12rpx;
  border-radius: 12px;
  /* radius-md */
  border: 1.5rpx solid transparent;
  background: #F7F3EC;
  /* surfaceWarm */
  min-height: 88rpx;
  /* ≥ 44pt tap area(per spec §10 NFR) */
  box-sizing: border-box;
  transition: background 0.15s ease-out, border-color 0.15s ease-out, transform 0.15s ease-out;
}

.action-option-row-hover {
  transform: scale(0.98);
}

.action-option-row-selected {
  background: rgba(45, 106, 94, 0.08);
  /* primarySoft */
  border-color: #2D6A5E;
  /* primary */
}

.action-option-row-text {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 4rpx;
}

.action-option-title {
  font-family: 'Noto Sans SC', sans-serif;
  font-size: 30rpx;
  /* 15px */
  font-weight: 600;
  color: #2C2C2C;
  /* ink */
  line-height: 1.4;
}

.action-option-description {
  font-family: 'Noto Sans SC', sans-serif;
  font-size: 26rpx;
  /* 13px */
  color: #5A5A5A;
  /* inkLight */
  line-height: 1.4;
}

.batch-operation-list {
  display: flex;
  flex-direction: column;
  gap: 12rpx;
  margin-top: 16rpx;
}

.batch-operation-row {
  display: flex;
  align-items: center;
  gap: 16rpx;
  min-height: 80rpx;
  padding: 16rpx 20rpx;
  border: 1.5rpx solid rgba(45, 106, 94, 0.12);
  border-radius: 10px;
  background: #FDFBF7;
  box-sizing: border-box;
}

.batch-operation-row-selected {
  border-color: #2D6A5E;
  background: rgba(45, 106, 94, 0.08);
}

.batch-operation-item {
  flex: 1;
  font-family: 'Noto Sans SC', sans-serif;
  font-size: 27rpx;
  color: #2C2C2C;
  line-height: 1.5;
}

.action-option-check {
  flex-shrink: 0;
  width: 48rpx;
  height: 48rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #2D6A5E;
  /* primary */
  border-radius: 9999px;
  /* radius-full */
}

.action-option-check-icon {
  color: #FFFFFF;
  font-size: 32rpx;
  line-height: 1;
  font-weight: 600;
}

.action-options-actions {
  display: flex;
  align-items: center;
  gap: 16rpx;
  padding: 0 32rpx 32rpx;
  box-sizing: border-box;
  border-top: 1.5rpx solid rgba(45, 106, 94, 0.06);
  /* borderSubtle */
  padding-top: 24rpx;
}

.action-options-btn {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 88rpx;
  /* ≥ 44pt tap area(per spec §10 NFR) */
  border-radius: 9999px;
  /* radius-full */
  box-sizing: border-box;
  transition: opacity 0.15s ease-out, transform 0.15s ease-out, background 0.15s ease-out;
}

/* 主按钮:应用此方案(per spec §8.3 Primary 配色) */
.action-options-btn-confirm {
  background: linear-gradient(135deg, #2D6A5E 0%, #5BA089 100%);
  /* Primary 渐变,见 UI §二 + §八 */
  box-shadow: 0 4rpx 16rpx rgba(45, 106, 94, 0.35);
}

.action-options-btn-confirm-hover {
  transform: scale(0.96);
  box-shadow: 0 2rpx 8rpx rgba(45, 106, 94, 0.35);
}

.action-options-btn-disabled {
  opacity: 0.5;
  pointer-events: none;
}

.action-options-btn-confirm-text {
  font-family: 'Noto Sans SC', sans-serif;
  font-size: 30rpx;
  /* 15px */
  font-weight: 600;
  color: #FFFFFF;
  line-height: 1.4;
}

/* 次按钮:取消 */
.action-options-btn-cancel {
  background: #F2EBE0;
  /* surfaceWarm,见 UI §二 */
}

.action-options-btn-cancel-hover {
  opacity: 0.8;
}

.action-options-btn-cancel-text {
  font-family: 'Noto Sans SC', sans-serif;
  font-size: 30rpx;
  /* 15px */
  font-weight: 500;
  color: #2C2C2C;
  /* ink */
  line-height: 1.4;
}

@keyframes actionOptionsFadeIn {
  from { opacity: 0; }
  to { opacity: 1; }
}

@keyframes actionOptionsSlideUp {
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
