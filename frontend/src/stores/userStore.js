// frontend/stores/userStore.js
// 用户域 Pinia store —— 唯一 owner of `preferences`
//
// Spec contract: specs/OnboardingPage.md §7.1
//
// state
//   preferences           : Preferences | null  —— 完整偏好对象,初始 null
//   isFetchingPreferences : boolean             —— 拉取偏好 loading
//   isUpdatingProfile     : boolean             —— 更新偏好 loading
//
// getter
//   hasPreferences        : boolean             —— 路由守卫可用
//
// action
//   fetchPreferences()    : Promise<void>       —— GET /api/preferences(本页面不调用)
//   updateProfile(payload): Promise<void>       —— PUT /api/preferences
//   clearProfile()        : void                —— 清空(登出场景)

import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import {
  updatePreferences as svcUpdatePreferences,
  getPreferences as svcGetPreferences,
} from '../services/preferences.js'
import { logger } from '../utils/logger.js'

/**
 * @typedef {import('../api/types').Preferences} Preferences
 * @typedef {Partial<Preferences>} UpdateProfilePayload
 */

export const useUserStore = defineStore('user', () => {
  // ───────── State ─────────
  /** @type {import('vue').Ref<Preferences | null>} */
  const preferences = ref(null)
  const isFetchingPreferences = ref(false)
  const isUpdatingProfile = ref(false)

  // ───────── Getters ─────────
  const hasPreferences = computed(
    () => preferences.value !== null && Object.keys(preferences.value).length > 0
  )

  // ───────── Actions ─────────

  /**
   * 拉取用户偏好 —— 调用 GET /api/preferences
   * OnboardingPage 不调用,见 spec §6.3;由其他页面(Maybe)触发。
   *
   * @returns {Promise<void>}
   * @throws  {import('../services/preferences.js').ApiError}
   */
  async function fetchPreferences() {
    isFetchingPreferences.value = true
    try {
      const res = await svcGetPreferences()
      preferences.value = res.data.preferences
      logger.info('[userStore.fetchPreferences] ok', res.data.preferences)
    } catch (err) {
      logger.error('[userStore.fetchPreferences] failed', err)
      throw err
    } finally {
      isFetchingPreferences.value = false
    }
  }

  /**
   * 更新用户偏好 —— 调用 PUT /api/preferences
   *
   * 调用约定(OnboardingPage):
   *   userStore.updateProfile({ interests: selectedInterests })
   * ↑ 只送本次修改的字段;service 层负责包 `user_id` + `preferences` 外壳;
   * 其它 Preferences 字段(explanation_style / travel_pace / special_needs)
   **不**在前端持有副本,本方法不会回传。
   *
   * @param {UpdateProfilePayload} payload
   * @returns {Promise<void>}
   * @throws  {import('../services/preferences.js').ApiError}
   */
  async function updateProfile(payload) {
    isUpdatingProfile.value = true
    try {
      await svcUpdatePreferences(payload)
      // 局部合并:把本次提交的字段写入 store,其它字段保留既有值
      preferences.value = {
        ...(preferences.value || {}),
        ...payload,
      }
      logger.info('[userStore.updateProfile] ok', payload)
    } catch (err) {
      logger.error('[userStore.updateProfile] failed', err)
      throw err
    } finally {
      isUpdatingProfile.value = false
    }
  }

  /**
   * 清空偏好 —— 用于登出 / 切换账号
   * 本页面不触发。
   */
  function clearProfile() {
    preferences.value = null
  }

  return {
    // state
    preferences,
    isFetchingPreferences,
    isUpdatingProfile,
    // getters
    hasPreferences,
    // actions
    fetchPreferences,
    updateProfile,
    clearProfile,
  }
})
