import { logger } from '../utils/logger.js'
import { shouldRequestNotificationPermission } from './notificationPermissionCore.js'

const PERMISSION = 'android.permission.POST_NOTIFICATIONS'
const REQUESTED_KEY = 'notification_permission_requested'

function getAndroidRuntime() {
  // #ifndef APP-PLUS
  return null
  // #endif
  // #ifdef APP-PLUS
  if (plus.os.name !== 'Android') return null
  const activity = plus.android.runtimeMainActivity()
  const BuildVersion = plus.android.importClass('android.os.Build$VERSION')
  const PackageManager = plus.android.importClass('android.content.pm.PackageManager')
  return {
    activity,
    sdkInt: Number(BuildVersion.SDK_INT),
    permissionGranted: Number(PackageManager.PERMISSION_GRANTED),
  }
  // #endif
}

export function getNotificationPermissionStatus() {
  try {
    const runtime = getAndroidRuntime()
    if (!runtime) {
      return { supported: false, granted: true, sdkInt: 0 }
    }
    if (runtime.sdkInt < 33) {
      return { supported: true, granted: true, sdkInt: runtime.sdkInt }
    }
    const granted = runtime.activity.checkSelfPermission(PERMISSION)
      === runtime.permissionGranted
    return { supported: true, granted, sdkInt: runtime.sdkInt }
  } catch (error) {
    logger.warn('[notificationPermission] status check failed', {
      message: error?.message,
    })
    return { supported: false, granted: false, sdkInt: 0 }
  }
}

export function requestNotificationPermission() {
  // #ifndef APP-PLUS
  return Promise.resolve(getNotificationPermissionStatus())
  // #endif
  // #ifdef APP-PLUS
  return new Promise((resolve) => {
    plus.android.requestPermissions(
      [PERMISSION],
      () => resolve(getNotificationPermissionStatus()),
      (error) => {
        logger.warn('[notificationPermission] request failed', {
          message: error?.message,
        })
        resolve(getNotificationPermissionStatus())
      },
    )
  })
  // #endif
}

export async function ensureNotificationPermission() {
  const status = getNotificationPermissionStatus()
  const requested = uni.getStorageSync(REQUESTED_KEY) === true
  if (!shouldRequestNotificationPermission({
    platform: status.supported ? 'android' : 'other',
    sdkInt: status.sdkInt,
    requested,
    granted: status.granted,
  })) {
    return status
  }

  uni.setStorageSync(REQUESTED_KEY, true)
  return new Promise((resolve) => {
    uni.showModal({
      title: '开启行程通知',
      content: '用于接收出发时间和行程紧急提醒，可随时在“我的-通知设置”中修改。',
      confirmText: '继续',
      cancelText: '暂不开启',
      success: async ({ confirm }) => {
        resolve(confirm ? await requestNotificationPermission() : status)
      },
      fail: () => resolve(status),
    })
  })
}

export function openNotificationSettings() {
  // #ifndef APP-PLUS
  return false
  // #endif
  // #ifdef APP-PLUS
  try {
    const activity = plus.android.runtimeMainActivity()
    const Intent = plus.android.importClass('android.content.Intent')
    const Settings = plus.android.importClass('android.provider.Settings')
    const Uri = plus.android.importClass('android.net.Uri')
    const BuildVersion = plus.android.importClass('android.os.Build$VERSION')
    const intent = Number(BuildVersion.SDK_INT) >= 26
      ? new Intent(Settings.ACTION_APP_NOTIFICATION_SETTINGS)
      : new Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS)
    if (Number(BuildVersion.SDK_INT) >= 26) {
      intent.putExtra(Settings.EXTRA_APP_PACKAGE, activity.getPackageName())
    } else {
      intent.setData(Uri.parse(`package:${activity.getPackageName()}`))
    }
    activity.startActivity(intent)
    return true
  } catch (error) {
    logger.warn('[notificationPermission] open settings failed', {
      message: error?.message,
    })
    return false
  }
  // #endif
}
