<template>
  <view class="page">
    <view class="header">
      <text class="back" @click="goBack">←</text>
      <text class="title">权限设置</text>
      <view class="spacer" />
    </view>

    <view class="card">
      <text class="card-title">定位权限</text>
      <text class="status" :class="{ enabled: locationAuthorized }">
        {{ locationStatusText }}
      </text>
      <text class="description">
        用于计算当前位置到下一目的地的驾车时间，并提供出发提醒。
      </text>
      <button v-if="!locationAuthorized" class="primary" @click="onRequestLocation">
        请求定位权限
      </button>
      <button class="secondary" @click="onOpenSettings">
        打开应用设置
      </button>
    </view>

    <view class="card">
      <text class="card-title">后台提醒服务</text>
      <text class="status" :class="{ enabled: backgroundRunning }">
        {{ backgroundRunning ? '正在运行' : '未运行' }}
      </text>
      <text class="description">
        有今天的有效行程时，导友会显示常驻通知并约每15分钟更新位置。
      </text>
      <button class="primary" @click="onRestartBackground">
        重新检查并启动
      </button>
      <text
        v-if="operationMessage"
        class="operation-message"
        :class="{ success: operationSuccess }"
      >
        {{ operationMessage }}
      </text>
    </view>

    <view class="card">
      <text class="card-title">通知权限</text>
      <text class="status" :class="{ enabled: notificationGranted }">
        {{ notificationGranted ? '已开启' : '未开启' }}
      </text>
      <text class="description">
        Android 13及以上需要通知权限才能在通知栏显示后台服务和出发提醒。
      </text>
      <button v-if="!notificationGranted" class="primary" @click="onRequestNotification">
        请求通知权限
      </button>
      <button class="secondary" @click="onOpenNotificationSettings">
        打开系统通知设置
      </button>
    </view>
  </view>
</template>

<script setup>
import { computed, ref } from 'vue'
import { onShow } from '@dcloudio/uni-app'
import {
  getBackgroundLocationStatus,
  syncBackgroundLocation,
} from '../../services/backgroundLocation.js'
import {
  describeBackgroundLocationResult,
} from '../../services/backgroundLocationStatus.js'
import {
  startLocationReporter,
} from '../../services/locationReporter.js'
import {
  getNotificationPermissionStatus,
  openNotificationSettings,
  requestNotificationPermission,
} from '../../services/notificationPermission.js'
import {
  checkLocationPermission,
  openAppSettings,
  requestLocationPermission,
} from '../../utils/location.js'

const locationStatus = ref('unknown')
const backgroundRunning = ref(false)
const notificationGranted = ref(false)
const operationMessage = ref('')
const operationSuccess = ref(false)

const locationAuthorized = computed(() => locationStatus.value === 'authorized')
const locationStatusText = computed(() => {
  if (locationStatus.value === 'authorized') return '已开启'
  if (locationStatus.value === 'denied') return '已拒绝'
  if (locationStatus.value === 'not determined') return '尚未申请'
  return '状态未知'
})

onShow(() => {
  void refreshStatus()
})

async function refreshStatus() {
  locationStatus.value = await checkLocationPermission()
  notificationGranted.value = getNotificationPermissionStatus().granted
  const background = await getBackgroundLocationStatus()
  backgroundRunning.value = background?.running === true
}

async function onRequestLocation() {
  await requestLocationPermission()
  await restartBackgroundLocation()
  await refreshStatus()
}

function onOpenSettings() {
  openAppSettings()
}

async function onRequestNotification() {
  await requestNotificationPermission()
  await refreshStatus()
}

function onOpenNotificationSettings() {
  openNotificationSettings()
}

async function onRestartBackground() {
  await restartBackgroundLocation()
  await refreshStatus()
}

async function restartBackgroundLocation() {
  operationMessage.value = '正在检查定位和今日行程…'
  operationSuccess.value = false
  const locationReported = await startLocationReporter()
  const background = await syncBackgroundLocation()
  const result = describeBackgroundLocationResult(
    locationReported
      ? { success: true }
      : { success: false, code: 'location_report_failed' },
    background,
  )
  operationMessage.value = result.message
  operationSuccess.value = result.success
  uni.showToast({
    title: result.message,
    icon: 'none',
    duration: 3000,
  })
}

function goBack() {
  uni.navigateBack()
}
</script>

<style scoped>
.page { min-height: 100vh; padding: 0 32rpx 32rpx; background: #F7F3EC; box-sizing: border-box; }
.header { display: flex; align-items: center; min-height: 88rpx; margin: 0 -32rpx; padding: 0 32rpx; background: #F7F3EC; border-bottom: 1px solid rgba(45, 106, 94, 0.1); }
.back, .spacer { width: 80rpx; font-size: 42rpx; }
.title { flex: 1; text-align: center; font-size: 36rpx; font-weight: 600; color: #2C2C2C; }
.card { margin-top: 32rpx; padding: 40rpx; border-radius: 24rpx; background: #FDFBF7; display: flex; flex-direction: column; gap: 24rpx; }
.card-title { font-size: 34rpx; font-weight: 600; color: #2C2C2C; }
.status { color: #B54747; font-weight: 600; }
.status.enabled { color: #2D6A5E; }
.description { color: #5A5A5A; line-height: 1.6; }
button { width: 100%; border-radius: 44rpx; font-size: 30rpx; }
.primary { color: #FFFFFF; background: #2D6A5E; }
.secondary { color: #2D6A5E; background: #FFFFFF; border: 1px solid #2D6A5E; }
.operation-message { color: #B54747; line-height: 1.5; }
.operation-message.success { color: #2D6A5E; }
</style>
