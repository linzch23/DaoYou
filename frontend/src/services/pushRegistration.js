import { BASE_URL, MVP_USER_ID } from './config.js'
import { shouldRegisterPush } from './pushRegistrationCore.js'
import { logger } from '../utils/logger.js'

const LAST_REGISTERED_AT_KEY = 'vivo_push_last_registered_at'

function registerNativePush() {
  // #ifndef APP-PLUS
  return Promise.resolve(null)
  // #endif
  // #ifdef APP-PLUS
  try {
    const plugin = uni.requireNativePlugin('VivoPushPlugin')
    if (!plugin || typeof plugin.register !== 'function') return Promise.resolve(null)
    return new Promise((resolve) => plugin.register({}, resolve))
  } catch (error) {
    return Promise.reject(error)
  }
  // #endif
}

function uploadDevice(regId) {
  return new Promise((resolve, reject) => {
    const system = uni.getSystemInfoSync()
    uni.request({
      url: `${BASE_URL}/api/push/devices`,
      method: 'POST',
      header: { 'content-type': 'application/json' },
      data: {
        user_id: MVP_USER_ID,
        reg_id: regId,
        device_name: `${system.brand || ''} ${system.model || ''}`.trim(),
        app_version: system.appVersion || '',
      },
      success: (response) => {
        if (response.statusCode >= 200 && response.statusCode < 300) resolve(response.data)
        else reject(new Error(`HTTP ${response.statusCode}`))
      },
      fail: reject,
    })
  })
}

export async function ensurePushDeviceRegistered() {
  // #ifndef APP-PLUS
  return false
  // #endif
  const lastRegisteredAt = Number(uni.getStorageSync(LAST_REGISTERED_AT_KEY))
  if (!shouldRegisterPush(lastRegisteredAt)) return true
  try {
    const result = await registerNativePush()
    if (!result?.success || !result?.regId) return false
    await uploadDevice(result.regId)
    uni.setStorageSync(LAST_REGISTERED_AT_KEY, Date.now())
    return true
  } catch (error) {
    logger.warn('[pushRegistration] registration failed', {
      message: error?.message,
    })
    return false
  }
}
