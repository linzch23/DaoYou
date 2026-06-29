// frontend/stores/userStore.js
// 用户域 Pinia store —— 唯一 owner of `preferences`
//
// Spec contract: specs/OnboardingPage.md §7.1 + specs/PersonalProfilePage.md §7.1
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
//   updateProfile(payload): Promise<void>       —— PUT /api/preferences(经 services.preferences.updateUserInfo)
//   clearProfile()        : void                —— 清空(登出场景)
//
// v0.2.0(2026-06-28)PersonalProfilePage v0.2.0 architectural change(per spec §6.4.5 / §7.1):
//   - updateProfile 内部 routing 从 svcUpdatePreferences 直接调用改为 svcUpdateUserInfo
//   - svcUpdateUserInfo 是 PersonalProfilePage 专用薄包装,内部 filter undefined 后转发 svcUpdatePreferences
//   - 调用方(OnboardingPage `{ interests }` / StyleSettingPage `{ explanation_style }` / PersonalProfilePage `{ interests, travel_pace, special_needs }`)无需感知路由变化;
//     filter undefined 保证旧调用方(OnboardingPage 单字段 PUT)行为完全一致
//   - updatePreferences 仍 export(给 updateUserInfo 内部用 + 外部若直接调用),未删除

import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import {
  updateUserInfo as svcUpdateUserInfo,
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
   * 调用约定(OnboardingPage / StyleSettingPage / PersonalProfilePage 共用):
   *   userStore.updateProfile({ interests: [...] })                                    // OnboardingPage
   *   userStore.updateProfile({ explanation_style: '...' })                            // StyleSettingPage
   *   userStore.updateProfile({ interests, travel_pace, special_needs })               // PersonalProfilePage v0.2.0
   * ↑ 只送本次修改的字段;service 层负责包 `user_id` + `preferences` 外壳;
   * v0.2.0 起 routing 改走 `services.preferences.updateUserInfo`(薄包装),
   * 内部 `Object.fromEntries(Object.entries(body).filter(([, v]) => v !== undefined))`
   * 过滤 undefined 字段后转发 `updatePreferences`,沿 PUT partial-update 语义
   * (per specs/PersonalProfilePage.md §6.4.5 + AC-17 + §7.1)
   *
   * @param {UpdateProfilePayload} payload
   * @returns {Promise<void>}
   * @throws  {import('../services/preferences.js').ApiError}
   */
  async function updateProfile(payload) {
    isUpdatingProfile.value = true
    try {
      // v0.2.0 路由:走 updateUserInfo 薄包装,内部过滤 undefined 走 partial-update(per spec §6.4.5 + AC-17)
      await svcUpdateUserInfo(payload)
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
