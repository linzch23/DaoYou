<!--
  pages/onboarding/index.vue — 首次启动引导页(单步兴趣 5 选 1)
  
  Spec contract: specs/OnboardingPage.md v0.2.0
  Route: /pages/onboarding/index
  路由守卫在 userStore.preferences 为空时拉起,不属于底部 Tab。
  
  4 态(spec §3 / §5):
    interests   — 默认(欢迎 + 5 选项 + 跳过 + 完成设置)
    submitting  — 提交中(NextButton loading,SkipButton 禁用)
    error       — 提交失败(_ErrorBanner 出现,允许重试)
    completed   — 成功(Toast + uni.reLaunch 跳首页)
-->
<template>
  <view class="onboarding-page">
    <!-- Header:44pt 顶栏,右对齐 SkipButton -->
    <view class="header">
      <view
        class="skip-button"
        :class="{ 'skip-button-disabled': isSubmitting }"
        hover-class="skip-button-hover"
        :hover-stay-time="50"
        @click="onSkip"
      >
        <text class="skip-button-text">{{ strings.skipButton }}</text>
      </view>
    </view>

    <!-- Body:可滚动,内容最大宽度 640rpx 居中(spec §3) -->
    <scroll-view
      class="body"
      scroll-y
      :enhanced="true"
      :show-scrollbar="false"
    >
      <view class="body-inner">
        <!-- WelcomeBlock(spec §3) -->
        <view class="welcome-block">
          <text class="welcome-title">{{ strings.welcomeTitle }}</text>
          <text class="welcome-subtitle">{{ strings.welcomeSubtitle }}</text>
        </view>

        <!-- StepContainer(fadeSlideUp 0.45s ease-out) -->
        <view class="step-container">
          <text class="step-title">{{ strings.stepTitle }}</text>
          <text class="step-hint">{{ strings.stepHint }}</text>

          <InterestGrid
            v-model="selectedInterests"
            @change="onInterestChange"
          />

          <!-- 错误横幅:仅在 submitError 非空时渲染(spec §3) -->
          <ErrorBanner
            v-if="submitError"
            :message="submitError"
            :retryable="true"
            @retry="onSubmit"
          />
        </view>
      </view>
    </scroll-view>

    <!-- Footer:固定底部,NextButton 单 label -->
    <view class="footer">
      <NextButton
        :label="strings.completeButton"
        :loading="isSubmitting"
        :disabled="isNextDisabled"
        @click="onSubmit"
      />
    </view>
  </view>
</template>

<script setup>
import { ref, computed } from 'vue'
import InterestGrid from '../../components/InterestGrid.vue'
import NextButton from '../../components/NextButton.vue'
import ErrorBanner from '../../components/ErrorBanner.vue'
import { useUserStore } from '../../stores/userStore.js'
import { OnboardingStrings } from '../../constants/strings.js'
import { AppRoutes } from '../../constants/routes.js'
import { logger } from '../../utils/logger.js'

const strings = OnboardingStrings

// ─────────────── Local State(spec §4.1) ───────────────
/** @type {import('vue').Ref<'interests' | 'submitting' | 'completed'>} */
const currentStep = ref('interests')
/** @type {import('vue').Ref<Array<import('../../api/types').Interest>>} */
const selectedInterests = ref([])
/** @type {import('vue').Ref<string | null>} */
const submitError = ref(null)

// ─────────────── Computed ───────────────
const isSubmitting = computed(() => currentStep.value === 'submitting')
const isNextDisabled = computed(
  () => isSubmitting.value || selectedInterests.value.length === 0
)

// ─────────────── Store ───────────────
const userStore = useUserStore()

// ─────────────── Handlers ───────────────

/** InterestGrid 选中态切换回调(spec §8.1)。父组件目前只用于日志。 */
function onInterestChange({ value, selected }) {
  logger.debug('[OnboardingPage] interest changed', { value, selected })
}

/**
 * 主提交流程(spec §5.2)
 *   - selectedInterests.length >= 1
 *   - currentStep = 'submitting'
 *   - userStore.updateProfile({ interests: selectedInterests })
 *     - 2xx:currentStep = 'completed',Toast + reLaunch HomePage
 *     - 4xx/5xx/网络:currentStep 回退 'interests',submitError = 友好提示
 *   - 保留 selectedInterests
 */
async function onSubmit() {
  if (isNextDisabled.value) return
  if (selectedInterests.value.length === 0) return

  currentStep.value = 'submitting'
  submitError.value = null

  try {
    await userStore.updateProfile({ interests: [...selectedInterests.value] })
    currentStep.value = 'completed'
    logger.info('[OnboardingPage] submit ok', {
      interests: selectedInterests.value,
    })

    uni.showToast({
      title: strings.successToast,
      icon: 'success',
      duration: 1500,
    })

    // Toast 出现后再 reLaunch,避免跳转吞掉 toast
    setTimeout(() => {
      uni.reLaunch({ url: AppRoutes.Home })
    }, 1200)
  } catch (err) {
    logger.error('[OnboardingPage] submit failed', err)
    currentStep.value = 'interests'
    submitError.value = mapErrorToMessage(err)
  }
}

/**
 * 跳过流程(spec §5.3.C)
 *   - 不调任何 API
 *   - 不写 userStore
 *   - 直接 uni.reLaunch 到 HomePage
 *   - 提交中(SkipButton 禁用)期间无此路径
 */
function onSkip() {
  if (isSubmitting.value) return
  logger.info('[OnboardingPage] skip')
  uni.reLaunch({ url: AppRoutes.Home })
}

/**
 * 错误码 → 友好提示映射(spec §6.1 Error 表)
 * @param {import('../../services/preferences.js').ApiError} err
 * @returns {string}
 */
function mapErrorToMessage(err) {
  if (!err) return strings.errorNetwork
  // 400 / 4000 参数非法
  if (err.code === 4000 || err.statusCode === 400) {
    return strings.errorBadRequest
  }
  // 5xx / 5000 服务端错误
  if (err.code === 5000 || (err.statusCode >= 500 && err.statusCode < 600)) {
    return strings.errorServer
  }
  // 其它(含网络断开)→ 网络异常
  return strings.errorNetwork
}
</script>

<style scoped>
.onboarding-page {
  display: flex;
  flex-direction: column;
  min-height: 100vh;
  background: #F7F3EC;
  /* Surface,见 UI §二 */
}

/* ───────── Header ───────── */
.header {
  height: 44px;
  display: flex;
  align-items: center;
  justify-content: flex-end;
  padding: 0 20px;
  flex-shrink: 0;
}

.skip-button {
  display: flex;
  align-items: center;
  justify-content: center;
  background: transparent;
  border: 1.5px solid #2D6A5E;
  /* Primary,幽灵按钮见 UI §八 */
  border-radius: 9999px;
  /* radius-full */
  padding: 8rpx 32rpx;
  min-height: 88rpx;
  /* ≥ 44pt tap area(88rpx = 44pt) */
  min-width: 88rpx;
  box-sizing: border-box;
  transition: background 0.15s ease-out, color 0.15s ease-out, opacity 0.15s ease-out;
}

.skip-button-hover {
  background: #2D6A5E;
}

.skip-button-hover .skip-button-text {
  color: #FFFFFF;
}

.skip-button-disabled {
  opacity: 0.5;
  pointer-events: none;
}

.skip-button-text {
  font-family: 'Noto Sans SC', sans-serif;
  font-size: 26rpx;
  /* 13px */
  color: #2D6A5E;
  font-weight: 500;
  line-height: 1.4;
}

/* ───────── Body ───────── */
.body {
  flex: 1;
  /* 让 scroll-view 撑开 */
  min-height: 0;
}

.body-inner {
  max-width: 640rpx;
  /* spec §3 大屏居中 */
  margin: 0 auto;
  padding: 16rpx 40rpx 32rpx;
  /* space-md / space-xl */
  box-sizing: border-box;
}

/* ─── WelcomeBlock ─── */
.welcome-block {
  margin-bottom: 48rpx;
  /* space-2xl */
  animation: fadeSlideUp 0.45s cubic-bezier(0.22, 1, 0.36, 1) both;
}

.welcome-title {
  display: block;
  font-family: 'Noto Serif SC', serif;
  font-size: 44rpx;
  /* 22px,见 UI §三 page title */
  font-weight: 600;
  color: #2C2C2C;
  /* ink */
  line-height: 1.4;
  margin-bottom: 16rpx;
  /* space-md */
}

.welcome-subtitle {
  display: block;
  font-family: 'Noto Sans SC', sans-serif;
  font-size: 28rpx;
  /* 14px */
  color: #5A5A5A;
  /* inkLight */
  line-height: 1.5;
}

/* ─── StepContainer ─── */
.step-container {
  animation: fadeSlideUp 0.45s cubic-bezier(0.22, 1, 0.36, 1) 0.1s both;
}

.step-title {
  display: block;
  font-family: 'Noto Serif SC', serif;
  font-size: 36rpx;
  /* 18px,UI §三 中标题 */
  font-weight: 500;
  color: #2C2C2C;
  line-height: 1.4;
  margin-bottom: 16rpx;
}

.step-hint {
  display: block;
  font-family: 'Noto Sans SC', sans-serif;
  font-size: 24rpx;
  /* 12px */
  color: #9A9A9A;
  /* inkMuted */
  line-height: 1.4;
  margin-bottom: 24rpx;
  /* space-lg */
}

/* ───────── Footer ───────── */
.footer {
  flex-shrink: 0;
  padding: 16rpx 40rpx 32rpx;
  /* space-md / space-xl */
  background: transparent;
  box-sizing: border-box;
}

/* ───────── Animations ───────── */
@keyframes fadeSlideUp {
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
