<script>
import {
  startLocationReporter,
  stopLocationReporter,
} from './services/locationReporter.js'
import { syncBackgroundLocation } from './services/backgroundLocation.js'
import { ensurePushDeviceRegistered } from './services/pushRegistration.js'

export default {
  onLaunch: function () {
    console.log('App Launch — DaoYou v0.1.0')
  },
  onShow: function () {
    console.log('App Show')
    void startLocationReporter().finally(() => syncBackgroundLocation())
    void ensurePushDeviceRegistered()
  },
  onHide: function () {
    console.log('App Hide')
    stopLocationReporter()
  }
}
</script>

<style>
/* 全局样式 — H5 模式直接用 shanshui 调色板硬编码;page 端组件用 AppColors.* 引用(uni-app 自动 rpx -> px) */
page {
  background-color: #F7F3EC;
  color: #2C2C2C;
  font-family: 'Noto Sans SC', -apple-system, BlinkMacSystemFont, 'Helvetica Neue', sans-serif;
  font-size: 28rpx;
  line-height: 1.5;
  min-height: 100vh;
}

view, text, button, input, textarea, scroll-view, swiper, swiper-item {
  box-sizing: border-box;
}

button::after {
  border: none;
}
</style>
