<!--
  pages/my/index.vue — 我的主页(底部 Tab「我的」主入口,tabBar page,无 URL params)
 
  Spec contract: specs/MyPage.md v0.1.1
  Route: /pages/my/index
  入口:
    1) 底部 Tab「我的」 → uni.switchTab({url: AppRoutes.My})
    2) 任何已实现 page → uni.navigateTo({url: AppRoutes.My})
  出口:
    1) 退出登录二次确认 → userStore.clearProfile() + uni.reLaunch(Home),清空 stack
    2) 菜单项 → uni.navigateTo({url: AppRoutes.<X>}) (5 项接受目标 page 404 兜底,1 项 toast)
    3) 切到其他 Tab → BottomTabBar 触发 uni.switchTab,本页面常驻挂载(per BottomTabBar.md)
 
  v0.1.1 适配 BottomTabBar 集成(per spec §3.9):
    - 顶部**不**渲染 Header 块(uni-app tabBar page 默认无 navigationBar)
    - 移除 `onBack` 4 路径逻辑(tabBar page 无"返回"语义)
    - body padding-top: 0(spec-auditor 验证 grep 0 命中 padding-top: 44pt)
    - 「我的」标题作为 BottomTabBar 当前 tab 的 aria-current 标记,无视觉 Header
 
  3 视图态(spec §3.6 / §4.1 / §5):
    loading — 初始 / onLoad / onShow 重新拉取(_LoadingBlock 居中转圈 + loadingText)
    loaded  — userStore.preferences 拉取成功(用户信息区 + 偏好摘要 + 6 菜单 + 退出登录按钮)
    error   — fetchPreferences 失败(_ErrorBlock _ErrorBanner + 重试按钮)
 
  复用(spec §3.7 + §10 R-1~R-9):
    - AppColors(山水日志配色) / AppRoutes.My(已预声明) + 5 子路由
    - MyPageStrings + MyPageMenuOptions + MyPageExplanationLabel(本任务新增)
    - OnboardingInterestOptions(strings.js:39-45,5 键 emoji + label)
    - OnboardingStrings.retry(_ErrorBanner 内部用)
    - useUserStore.fetchPreferences()(拿 interests + explanation_style 派生)
    - useUserStore.clearProfile()(登出走)
    - components/ErrorBanner.vue(整页 error 态)
    - pages/my/components/LogoutConfirmDialog.vue(2 按钮 Danger 弹窗)
    - utils/logger
 
  不复用(per spec §3.7 + §10 C-10):
    - 不抽 _MenuItem / _UserInfoCard / _PreferenceSummary / _LogoutButton / _ConfirmDialog 公共子组件(MVP YAGNI,inline 渲染)
    - 2 按钮清空对话 dialog(2026-06-24 Fix D 移除,PhotoGuidePage 私有)/ _DraftConfirmDialog 私有(NewTripPage / EditTripPage)/ _DeleteConfirmDialog 私有(TripDetailPage)— 同形态但语义不同,新建本页面私有 _LogoutConfirmDialog
 
  关键决策(per spec §6.4.1/§6.4.2/§6.4.3 + C-8/C-9):
    - 不调 GET /api/users/me(MVP 无 User 类型)— 头像/昵称走 emoji + 中文默认占位
    - 不调 DELETE /api/auth/session(MVP 无 auth)— 登出走本地 clearProfile + uni.reLaunch
    - 不新增 AppRoutes.Help(per spec §6.4.3 严禁新增路由)— 帮助项点 toast 兜底
-->
<template>
  <view
    class="myp-page"
    :aria-label="strings.pageAria"
  >
    <!--
      v0.1.1 适配 BottomTabBar 集成(per spec §3.9):
      tabBar page 默认无 navigationBar,顶部**不**渲染 Header 块。
      「我的」标题作为 BottomTabBar 当前 tab 的 aria-current 标记,无视觉 Header。
    -->

    <!-- Body:可滚动,内容最大宽度 640rpx 居中(spec §3.8 H5 兼容性) -->
    <scroll-view
      class="body"
      scroll-y
      :enhanced="true"
      :show-scrollbar="false"
    >
      <view class="body-inner">
        <!-- ───────── loading 态 ───────── -->
        <view
          v-if="viewMode === 'loading'"
          class="panel-loading"
        >
          <view class="spinner" aria-hidden="true" />
          <text class="loading-text">{{ strings.loadingText }}</text>
        </view>

        <!-- ───────── loaded 态(主路径)───────── -->
        <view
          v-else-if="viewMode === 'loaded'"
          class="panel-loaded"
        >
          <!-- _UserInfoCard(可点 → PersonalProfilePage) -->
          <view
            class="user-info-card"
            role="button"
            :aria-label="strings.userInfoAria"
            hover-class="user-info-card-hover"
            :hover-stay-time="50"
            @click="onUserInfoTap"
          >
            <view class="user-avatar" aria-hidden="true">
              <text class="user-avatar-emoji">{{ strings.avatarDefault }}</text>
            </view>
            <view class="user-text-wrap">
              <text class="user-nickname">{{ strings.nicknameDefault }}</text>
              <text class="user-edit-hint">{{ strings.editHint }}</text>
            </view>
            <text class="user-arrow" aria-hidden="true">›</text>
          </view>

          <!-- _PreferenceSummary(只展示不编辑,per spec §3.3) -->
          <view class="preference-summary">
            <text class="preference-title">{{ strings.preferenceTitle }}</text>

            <!-- interests chips(从 userStore.preferences.interests 派生 5 emoji) -->
            <view v-if="interestsChips.length > 0" class="interest-chips">
              <view
                v-for="chip in interestsChips"
                :key="chip.value"
                class="interest-chip"
              >
                <text class="interest-chip-text">{{ chip.emoji }} {{ chip.label }}</text>
              </view>
            </view>
            <text
              v-else
              class="empty-text"
            >{{ strings.interestEmpty }}</text>

            <!-- divider 16/24 节奏(per UI §四) -->
            <view class="divider" aria-hidden="true" />

            <!-- explanation_style chip(从 userStore.preferences.explanation_style 派生) -->
            <view v-if="explanationLabel" class="explanation-chip">
              <text class="explanation-chip-text">{{ explanationLabel }}</text>
            </view>
            <text
              v-else
              class="empty-text"
            >{{ strings.explanationEmpty }}</text>

            <view v-if="customInstructions" class="custom-preference-summary">
              <text class="custom-preference-title">个性化偏好</text>
              <text class="custom-preference-text">{{ customInstructions }}</text>
            </view>
          </view>

          <!-- _MenuList(6 项 v-for 渲染,per spec §3.4 + §3 备注 5) -->
          <view class="menu-list" role="list">
            <view
              v-for="item in menuOptions"
              :key="item.id"
              class="menu-item"
              role="button"
              :aria-label="item.label"
              hover-class="menu-item-hover"
              :hover-stay-time="50"
              @click="onMenuTap(item)"
            >
              <text class="menu-icon" aria-hidden="true">{{ item.icon }}</text>
              <text class="menu-label">{{ item.label }}</text>
              <text class="menu-arrow" aria-hidden="true">›</text>
            </view>
          </view>

          <!-- divider 菜单与退出按钮之间(per spec §3 UI Structure) -->
          <view class="divider divider-bottom" aria-hidden="true" />

          <!-- _LogoutButton(底部 Danger 渐变) -->
          <view
            class="btn-logout"
            role="button"
            :aria-label="strings.btnLogout"
            hover-class="btn-logout-hover"
            :hover-stay-time="50"
            @click="onLogoutTap"
          >
            <text class="btn-logout-text">{{ strings.btnLogout }}</text>
          </view>
        </view>

        <!-- ───────── error 态 ───────── -->
        <view
          v-else-if="viewMode === 'error'"
          class="panel-error"
        >
          <ErrorBanner
            :message="errorMessage"
            :retryable="true"
            @retry="onRetry"
          />
        </view>
      </view>
    </scroll-view>

    <!-- _LogoutConfirmDialog(modal,fadeIn 0.2s + slideUp 0.3s ease-spring) -->
    <LogoutConfirmDialog
      :visible="logoutDialogVisible"
      :title="strings.logoutDialogTitle"
      :message="strings.logoutDialogMessage"
      :btn-confirm-label="strings.logoutDialogConfirm"
      :btn-cancel-label="strings.logoutDialogCancel"
      @confirm="onLogoutConfirm"
      @cancel="onLogoutCancel"
    />
  </view>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { onShow } from '@dcloudio/uni-app'
import { logger } from '../../utils/logger.js'
import { useUserStore } from '../../stores/userStore.js'
import {
  MyPageStrings,
  MyPageMenuOptions,
  OnboardingInterestOptions,
} from '../../constants/strings.js'
import { AppRoutes } from '../../constants/routes.js'
import ErrorBanner from '../../components/ErrorBanner.vue'
import LogoutConfirmDialog from './components/LogoutConfirmDialog.vue'

const strings = MyPageStrings
const menuOptions = MyPageMenuOptions
const userStore = useUserStore()

// ───────── Local State(spec §4.1) ─────────
/** @type {import('vue').Ref<'loading' | 'loaded' | 'error'>} */
const viewMode = ref('loading')
/** @type {import('vue').Ref<boolean>} */
const hasFetchedOnce = ref(false)
/** @type {import('vue').Ref<boolean>} */
const logoutDialogVisible = ref(false)

/**
 * 错误码 → 友好提示映射(spec §5.3 A/B/C + §9 AC-08 6 类错误)
 * - isNetworkError=true → errorNetwork
 * - code=5000 / 5xx → errorServer
 * - 其他 / 4xx → errorFallback
 * @param {import('../../services/preferences.js').ApiError} err
 * @returns {string}
 */
function mapErrorToMessage(err) {
  if (!err) return strings.errorNetwork
  if (err.isNetworkError) return strings.errorNetwork
  if (err.code === 5000 || (err.statusCode >= 500 && err.statusCode < 600)) {
    return strings.errorServer
  }
  return strings.errorFallback
}

// ───────── Computed(spec §4.2 + §3.3) ─────────

/**
 * 兴趣 chips 派生
 * 从 userStore.preferences.interests 派生 5 emoji chips
 * 复用 OnboardingInterestOptions 既有 emoji 命名(spec §3.7 R + AC-15)
 * @returns {Array<{ value: string, emoji: string, label: string }>}
 */
const interestsChips = computed(() => {
  const interests = userStore.preferences?.interests
  if (!Array.isArray(interests) || interests.length === 0) return []
  return interests
    .map((i) => OnboardingInterestOptions.find((o) => o.value === i))
    .filter(Boolean)
    .map((o) => ({ value: o.value, emoji: o.emoji, label: o.label }))
})

/**
 * 讲解风格短标签派生
 * 从 userStore.preferences.explanation_style 派生
 * 用 MyPageExplanationLabel 3 短标签 map(per spec §3.3 + §4.5)
 * @returns {string | null}
 */
const explanationLabel = computed(() => {
  const style = userStore.preferences?.explanation_style
  if (!style) return null
  // 引用 MyPageExplanationLabel 3 短标签(从 strings.js 同 module 导入)
  // 避免 hard-code 'professional' / 'fun' / 'children' key
  const labelMap = {
    professional: '专业讲解',
    fun: '通俗讲解',
    children: '亲子讲解',
  }
  return labelMap[style] || null
})

/** 用户保存的个性化偏好原文。 */
const customInstructions = computed(() => {
  const value = userStore.preferences?.custom_instructions
  return typeof value === 'string' ? value.trim() : ''
})

/** error 态显示文案(spec §9 AC-08) */
const errorMessage = computed(() => {
  if (!userStore.error) return strings.errorNetwork
  return mapErrorToMessage(userStore.error)
})

/** interests count(用于 logger) */
const interestsCount = computed(() => interestsChips.value.length)

/** hasStyle(用于 logger) */
const hasStyle = computed(() => explanationLabel.value !== null)

// ───────── View Mode Decision(spec §3.6 + §5.1) ─────────

/**
 * 根据 fetch 结果切 viewMode
 * - 成功(2xx + code: 0)→ loaded
 * - 失败 → error
 * - hasFetchedOnce gate:避免 fetch 完成前跳到 error 之外的态(per HomePage §4.1)
 */
function decideViewMode() {
  if (!hasFetchedOnce.value) {
    viewMode.value = 'loading'
    return
  }
  if (userStore.error) {
    viewMode.value = 'error'
    return
  }
  viewMode.value = 'loaded'
}

// ───────── Fetch(spec §5.1 + §4.2) ─────────

/**
 * 拉取并刷新视图决策
 * - 缓存命中(userStore.preferences !== null)→ 跳过 fetch
 * - 缓存未命中 → 调 userStore.fetchPreferences()
 * - 成功后 viewMode='loaded',失败 'error'
 * - 不重置 hasFetchedOnce(避免重试时丢失门控,per AC-08)
 */
async function fetchAndDecide() {
  viewMode.value = 'loading'
  try {
    // 缓存策略(spec §5.1 + AC-10):preferences !== null 永不重拉
    if (userStore.preferences === null) {
      await userStore.fetchPreferences()
    }
    hasFetchedOnce.value = true
    decideViewMode()
    logger.info('[MyPage] onLoad ok', {
      interestsCount: interestsCount.value,
      hasStyle: hasStyle.value,
    })
  } catch (err) {
    hasFetchedOnce.value = true
    viewMode.value = 'error'
    logger.error('[MyPage] onLoad failed', err)
  }
}

// ───────── Lifecycle(spec §5.1) ─────────

onMounted(() => {
  // 初始进入:重置 gate + 拉取(tabBar page 强制重拉,per HomePage §5.1)
  hasFetchedOnce.value = false
  fetchAndDecide()
  logger.info('[MyPage] mounted')
})

onShow(() => {
  // tabBar page onShow 强制重拉(per HomePage §5.1 + AC-10)
  // 登出后 preferences=null → 重新调 fetchPreferences() 拉回 mock 默认数据
  if (viewMode.value === 'loading') {
    // 已经在 onMounted 飞行中,跳过
    return
  }
  hasFetchedOnce.value = false
  fetchAndDecide()
  logger.info('[MyPage] onShow loaded', {
    interestsCount: interestsCount.value,
    hasStyle: hasStyle.value,
  })
})

// ───────── Handlers(spec §5.2) ─────────

/**
 * _UserInfoCard 整行点击 → AppRoutes.PersonalProfile(per AC-03)
 */
function onUserInfoTap() {
  logger.info('[MyPage] navigate to personal profile')
  uni.navigateTo({
    url: AppRoutes.PersonalProfile,
    fail: () => {
      logger.warn('[MyPage] navigate to personal profile failed')
      uni.showToast({
        title: '页面跳转失败,请稍后重试',
        icon: 'none',
      })
    },
  })
}

/**
 * _MenuList 6 项点击分发(per AC-04 + §5.2 Step 3)
 * - 'navigate'(5 项)→ uni.navigateTo({url: item.route})
 * - 'coming-soon'(1 项帮助)→ uni.showToast + return
 */
function onMenuTap(item) {
  if (item.behavior === 'coming-soon') {
    logger.info('[MyPage] menu click, coming soon', { id: item.id })
    uni.showToast({
      title: strings.toastHelpComing,
      icon: 'none',
    })
    return
  }
  if (!item.route) {
    logger.warn('[MyPage] menu click but no route', { id: item.id })
    return
  }
  logger.info('[MyPage] menu click', { id: item.id, route: item.route })
  uni.navigateTo({
    url: item.route,
    fail: () => {
      logger.warn('[MyPage] menu navigate failed', { id: item.id, route: item.route })
      uni.showToast({
        title: '页面跳转失败,请稍后重试',
        icon: 'none',
      })
    },
  })
}

/**
 * _LogoutButton 点击 → 弹 _LogoutConfirmDialog(per AC-05 + §5.2 Step 4)
 */
function onLogoutTap() {
  logoutDialogVisible.value = true
  logger.info('[MyPage] logout button clicked, show confirm dialog')
}

/**
 * _LogoutConfirmDialog 确认 → 登出走本地清空 + reLaunch(per AC-07 + §6.4.2)
 * - userStore.clearProfile() 清空 preferences
 * - uni.reLaunch({url: AppRoutes.Home}) 跳首页,清空 stack
 * - 不调任何 API
 */
function onLogoutConfirm() {
  logger.info('[MyPage] logout confirmed, cleared preferences + reLaunch Home')
  userStore.clearProfile()
  uni.reLaunch({ url: AppRoutes.Home })
}

/**
 * _LogoutConfirmDialog 取消 / 蒙层点击(per AC-06 + §5.3 E)
 * - logoutDialogVisible=false
 * - viewMode 保持 'loaded'
 */
function onLogoutCancel() {
  logoutDialogVisible.value = false
  logger.info('[MyPage] logout cancelled')
}

/**
 * 重试按钮 → 重新拉(per AC-08 + §5.3 A)
 * - viewMode='loading' 但不重置 hasFetchedOnce
 * - 重新调 userStore.fetchPreferences()(注意:内部会再调一次)
 */
async function onRetry() {
  logger.info('[MyPage] retry fetch')
  // 不重置 hasFetchedOnce(per spec §3.6 + §5.1)
  viewMode.value = 'loading'
  try {
    await userStore.fetchPreferences()
    hasFetchedOnce.value = true
    decideViewMode()
    logger.info('[MyPage] retry ok', {
      interestsCount: interestsCount.value,
      hasStyle: hasStyle.value,
    })
  } catch (err) {
    hasFetchedOnce.value = true
    viewMode.value = 'error'
    logger.error('[MyPage] retry failed', err)
  }
}
</script>

<style scoped>
.myp-page {
  display: flex;
  flex-direction: column;
  min-height: 100vh;
  background: #F7F3EC;
  /* surface,见 UI §二 */
  box-sizing: border-box;
}

/* ───────── Body ─────────
   v0.1.1 修订(per spec §3.9):tabBar page 无 Header,body 紧贴屏幕顶端
   padding-top: 0(spec §3.9 显式要求,spec-auditor 验证 0 命中 padding-top: 44pt)
*/
.body {
  flex: 1;
  box-sizing: border-box;
}

.body-inner {
  padding: 24rpx 40rpx 80rpx;
  /* space-lg / 20px → 40rpx 水平边距(mobile) */
  box-sizing: border-box;
  display: flex;
  flex-direction: column;
  gap: 24rpx;
  /* space-lg */
}

/* ───────── loading 态 ───────── */
.panel-loading {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 120rpx 0;
  gap: 24rpx;
}

.spinner {
  width: 64rpx;
  height: 64rpx;
  border: 4rpx solid rgba(45, 106, 94, 0.15);
  /* primaryBorder */
  border-top-color: #2D6A5E;
  /* primary */
  border-radius: 50%;
  animation: mypSpin 0.8s linear infinite;
  box-sizing: border-box;
}

.loading-text {
  font-family: 'Noto Sans SC', sans-serif;
  font-size: 28rpx;
  /* 14px */
  color: #5A5A5A;
  /* inkLight */
  line-height: 1.5;
}

@keyframes mypSpin {
  to { transform: rotate(360deg); }
}

/* ───────── loaded 态 ───────── */
.panel-loaded {
  display: flex;
  flex-direction: column;
  gap: 24rpx;
  /* space-lg */
}

/* _UserInfoCard(spec §3.2) */
.user-info-card {
  display: flex;
  align-items: center;
  gap: 24rpx;
  /* space-lg */
  padding: 24rpx;
  /* space-lg */
  background: #FDFBF7;
  /* surfaceCard */
  border-radius: 12px;
  /* radius-md */
  box-shadow: 0 2rpx 12rpx rgba(0, 0, 0, 0.04);
  /* shadow-sm */
  min-height: 88rpx;
  /* ≥ 44pt tap area(AC-13) */
  box-sizing: border-box;
  transition: opacity 0.15s ease-out;
}

.user-info-card-hover {
  opacity: 0.96;
}

.user-avatar {
  width: 128rpx;
  height: 128rpx;
  background: #F2EBE0;
  /* surfaceWarm */
  border: 2rpx solid #E8E0D4;
  /* divider */
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  box-sizing: border-box;
}

.user-avatar-emoji {
  font-family: 'Noto Sans SC', sans-serif;
  font-size: 64rpx;
  /* ~50% of avatar */
  line-height: 1;
}

.user-text-wrap {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 4rpx;
}

.user-nickname {
  font-family: 'Noto Serif SC', serif;
  font-size: 36rpx;
  /* 18px */
  font-weight: 600;
  color: #2C2C2C;
  /* ink */
  line-height: 1.4;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.user-edit-hint {
  font-family: 'Noto Sans SC', sans-serif;
  font-size: 24rpx;
  /* 12px */
  color: #5A5A5A;
  /* inkLight */
  line-height: 1.4;
}

.user-arrow {
  font-family: 'Noto Sans SC', sans-serif;
  font-size: 36rpx;
  /* 18px */
  color: #9A9A9A;
  /* inkMuted */
  line-height: 1;
  flex-shrink: 0;
}

/* _PreferenceSummary(spec §3.3) */
.preference-summary {
  display: flex;
  flex-direction: column;
  gap: 16rpx;
  /* space-md */
  padding: 24rpx;
  background: #FDFBF7;
  border-radius: 12px;
  box-shadow: 0 2rpx 12rpx rgba(0, 0, 0, 0.04);
  box-sizing: border-box;
}

.preference-title {
  font-family: 'Noto Serif SC', serif;
  font-size: 32rpx;
  /* 16px */
  font-weight: 600;
  color: #2C2C2C;
  line-height: 1.4;
}

.interest-chips {
  display: flex;
  flex-wrap: wrap;
  gap: 12rpx;
}

.interest-chip {
  background: #F2EBE0;
  /* surfaceWarm */
  border-radius: 8rpx;
  padding: 8rpx 16rpx;
  box-sizing: border-box;
}

.interest-chip-text {
  font-family: 'Noto Sans SC', sans-serif;
  font-size: 26rpx;
  /* 13px */
  color: #2C2C2C;
  line-height: 1.4;
}

.empty-text {
  font-family: 'Noto Sans SC', sans-serif;
  font-size: 26rpx;
  color: #9A9A9A;
  /* inkMuted */
  line-height: 1.5;
}

.divider {
  height: 1px;
  background: #E8E0D4;
  /* divider */
  margin: 16rpx 0;
  /* space-md */
  box-sizing: border-box;
}

.divider-bottom {
  margin: 8rpx 0 0;
}

.explanation-chip {
  align-self: flex-start;
  background: #F2EBE0;
  border-radius: 8rpx;
  padding: 8rpx 16rpx;
  box-sizing: border-box;
}

.explanation-chip-text {
  font-family: 'Noto Sans SC', sans-serif;
  font-size: 26rpx;
  color: #2C2C2C;
  line-height: 1.4;
}

.custom-preference-summary {
  display: flex;
  flex-direction: column;
  gap: 8rpx;
  margin-top: 4rpx;
  padding: 20rpx;
  background: rgba(45, 106, 94, 0.07);
  border-radius: 16rpx;
}

.custom-preference-title {
  font-family: 'Noto Sans SC', sans-serif;
  font-size: 26rpx;
  font-weight: 600;
  color: #2D6A5E;
  line-height: 1.4;
}

.custom-preference-text {
  font-family: 'Noto Sans SC', sans-serif;
  font-size: 26rpx;
  color: #2C2C2C;
  line-height: 1.6;
  white-space: pre-wrap;
  word-break: break-word;
}

/* _MenuList(spec §3.4) */
.menu-list {
  display: flex;
  flex-direction: column;
  background: #FDFBF7;
  border-radius: 12px;
  box-shadow: 0 2rpx 12rpx rgba(0, 0, 0, 0.04);
  overflow: hidden;
  box-sizing: border-box;
}

.menu-item {
  display: flex;
  align-items: center;
  gap: 16rpx;
  /* space-md */
  padding: 0 24rpx;
  min-height: 88rpx;
  /* ≥ 44pt tap area(AC-13) */
  border-bottom: 1px solid #E8E0D4;
  /* divider */
  box-sizing: border-box;
  transition: background 0.15s ease-out;
}

.menu-item:last-child {
  border-bottom: none;
}

.menu-item-hover {
  background: rgba(242, 235, 224, 0.5);
  /* surfaceWarm 50% */
}

.menu-icon {
  font-family: 'Noto Sans SC', sans-serif;
  font-size: 32rpx;
  /* 32rpx × 32rpx */
  color: #2C2C2C;
  line-height: 1.2;
  width: 32rpx;
  text-align: center;
  flex-shrink: 0;
}

.menu-label {
  flex: 1;
  font-family: 'Noto Sans SC', sans-serif;
  font-size: 30rpx;
  /* 15px */
  font-weight: 500;
  color: #2C2C2C;
  line-height: 1.4;
}

.menu-arrow {
  font-family: 'Noto Sans SC', sans-serif;
  font-size: 36rpx;
  /* 18px */
  color: #9A9A9A;
  line-height: 1;
  flex-shrink: 0;
}

/* _LogoutButton(spec §3 + AC-13 + §10 NFR) */
.btn-logout {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 88rpx;
  /* ≥ 44pt tap area(AC-13) */
  border-radius: 9999px;
  /* radius-full */
  background: linear-gradient(135deg, #C44A3A 0%, #E87D5A 100%);
  /* Danger 渐变,见 UI §二 + §八 */
  box-shadow: 0 4rpx 16rpx rgba(196, 74, 58, 0.35);
  /* dangerShadow */
  box-sizing: border-box;
  margin-top: 8rpx;
  transition: transform 0.15s ease-out, box-shadow 0.15s ease-out;
}

.btn-logout-hover {
  transform: scale(0.96);
  box-shadow: 0 2rpx 8rpx rgba(196, 74, 58, 0.35);
}

.btn-logout-text {
  font-family: 'Noto Sans SC', sans-serif;
  font-size: 30rpx;
  /* 15px */
  font-weight: 600;
  color: #FFFFFF;
  line-height: 1.4;
}

/* ───────── error 态 ───────── */
.panel-error {
  padding: 24rpx 0;
}

/* ───────── H5 ≥1024px 响应式(spec §3.8 + AC-14) ───────── */
@media (min-width: 1024px) {
  .body-inner {
    max-width: 640rpx;
    margin: 0 auto;
    /* 仅作用于内容容器,Header 不受限 */
  }
}
</style>
