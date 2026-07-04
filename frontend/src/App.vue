<script>
import {
  startLocationReporter,
  stopLocationReporter,
} from './services/locationReporter.js'
import { syncBackgroundLocation } from './services/backgroundLocation.js'
import { ensurePushDeviceRegistered } from './services/pushRegistration.js'
import { ensureNotificationPermission } from './services/notificationPermission.js'

export default {
  onLaunch: function () {
    console.log('App Launch — DaoYou v0.1.0')
  },
  onShow: function () {
    console.log('App Show')
    void startLocationReporter().finally(async () => {
      await syncBackgroundLocation()
      await ensureNotificationPermission()
    })
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
:root {
  --dy-status-bar-height: 22px;
  --dy-nav-bar-height: 44px;
}

html,
body,
#app {
  background: #F7F3EC;
}

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

.header {
  height: var(--dy-nav-bar-height) !important;
  min-height: var(--dy-nav-bar-height) !important;
  margin-top: var(--dy-status-bar-height) !important;
  position: sticky !important;
  top: var(--dy-status-bar-height);
  z-index: 100;
  background: #F7F3EC !important;
  border-bottom: 1px solid rgba(45, 106, 94, 0.1);
  box-sizing: border-box;
}

body::before,
#app::before,
page::before {
  content: '';
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  height: var(--dy-status-bar-height);
  z-index: 101;
  pointer-events: none;
  background: #F7F3EC;
}
</style>
