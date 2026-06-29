import { BASE_URL, MVP_USER_ID } from './config.js'
import { getToday } from './home.js'
import { logger } from '../utils/logger.js'
import { hasPendingDestination } from './backgroundLocationCore.js'

const PLUGIN_NAME = 'BackgroundLocationPlugin'

function getPlugin() {
  // #ifdef APP-PLUS
  try {
    return uni.requireNativePlugin(PLUGIN_NAME)
  } catch (error) {
    logger.warn('[backgroundLocation] native plugin unavailable', error)
  }
  // #endif
  return null
}

function callPlugin(method, options = {}) {
  const plugin = getPlugin()
  if (!plugin || typeof plugin[method] !== 'function') {
    return Promise.resolve({ success: false, code: 'plugin_unavailable' })
  }
  return new Promise((resolve) => {
    plugin[method](options, (result) => resolve(result || { success: false }))
  })
}

function localDate() {
  const now = new Date()
  const year = now.getFullYear()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const day = String(now.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

export async function syncBackgroundLocation() {
  // #ifndef APP-PLUS
  return { success: false, code: 'not_app_plus' }
  // #endif

  try {
    const today = await getToday(localDate())
    if (!hasPendingDestination(today)) {
      return callPlugin('stopBackgroundLocation')
    }
    return callPlugin('startBackgroundLocation', {
      baseUrl: BASE_URL,
      userId: MVP_USER_ID,
    })
  } catch (error) {
    logger.warn('[backgroundLocation] trip check failed', {
      code: error?.code,
      message: error?.message,
    })
    return { success: false, code: 'trip_check_failed' }
  }
}

export function stopBackgroundLocation() {
  return callPlugin('stopBackgroundLocation')
}

export function getBackgroundLocationStatus() {
  return callPlugin('getBackgroundLocationStatus')
}
