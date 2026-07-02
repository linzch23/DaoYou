<template>
  <view class="page">
    <view class="header">
      <text class="back" @click="goBack">←</text>
      <text class="title">通知设置</text>
      <view class="spacer" />
    </view>

    <view class="card">
      <text class="card-title">系统通知权限</text>
      <text class="status" :class="{ enabled: status.granted }">
        {{ status.granted ? '已开启' : '未开启' }}
      </text>
      <text class="description">
        导友通过系统通知发送出发预警和行程紧急提醒。
      </text>
      <button v-if="!status.granted" class="primary" @click="requestPermission">
        请求通知权限
      </button>
      <button class="secondary" @click="onOpenSettings">
        打开系统通知设置
      </button>
    </view>
  </view>
</template>

<script setup>
import { ref } from 'vue'
import { onShow } from '@dcloudio/uni-app'
import {
  getNotificationPermissionStatus,
  openNotificationSettings,
  requestNotificationPermission,
} from '../../services/notificationPermission.js'

const status = ref(getNotificationPermissionStatus())

onShow(() => {
  status.value = getNotificationPermissionStatus()
})

async function requestPermission() {
  status.value = await requestNotificationPermission()
}

function goBack() {
  uni.navigateBack()
}

function onOpenSettings() {
  openNotificationSettings()
}
</script>

<style scoped>
.page { min-height: 100vh; padding: 32rpx; background: #F7F3EC; }
.header { display: flex; align-items: center; min-height: 88rpx; }
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
</style>
