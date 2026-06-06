<!--
  QuietHoursRow.vue — 页面私有静默时段卡(QHHeader toggle + 可选 QHPickers 2 列)

  Spec contract: specs/NotificationSettingPage.md §8.4
  Route: /pages/notification-setting/index
  入口:NotificationSettingPage(本页面) 1:1 渲染(per §3.6)
  用途:1 个静默时段卡片;QHHeader 横排(左 text / 右 toggle),QHPickers 2 列横排
       (仅 enabled=true 时显示,隐藏时内部值保留 per §5.3 G)

  Props
    enabled    : boolean  当前 toggle 状态
    start      : string   开始时间,'HH:mm' 格式
    end        : string   结束时间,'HH:mm' 格式
    startLabel : string   开始时间 picker 标签(走 NotificationSettingStrings.pickerStartLabel)
    endLabel   : string   结束时间 picker 标签(走 NotificationSettingStrings.pickerEndLabel)

  Emits
    update:enabled : boolean  toggle 切换时触发
    update:start   : string   开始时间 picker 变化时触发
    update:end     : string   结束时间 picker 变化时触发

  注:
    1) 私有子组件(per Code Style §3.4 `_` 前缀),MVP 唯一调用方 = NotificationSettingPage
    2) slot-free(本规格不预留 slot 扩展)
    3) QHHeader min-height 96rpx(容纳 2 行 text + 44pt 触达 + switch,per spec §3.6 + §10.2)
    4) QHPickers 2 列横排,每列 min-height 80rpx(沿 NewTripPage §3.5 picker 决策)
    5) <picker mode="time"> 跨端组件,value='HH:mm' 字符串绑,@change 触发 update:start / end
    6) QHPickers 常驻渲染(per UI-018 fix B):移除历史 v-if="enabled" 条件渲染,
       改用 :disabled="!enabled" 属性切换 + .qh-pickers-disabled 视觉弱化(opacity 0.5 + pointer-events: none)
       原因:历史 v-if 在 enabled 切换时卸载/重挂载 picker,qhFadeIn 0.2s 动画重新播放,产生"刷新"抖动
       副作用:enabled=false 时 picker 在 DOM 仍可见(灰显),但 picker 内部 start/end 选中值稳定保留
       首次进入页面 fadeIn 0.2s 仍播放一次(只播一次,不重播)
-->
<template>
  <view class="quiet-hours-row">
    <!-- QHHeader(横排常驻) -->
    <view
      class="qh-header"
      role="button"
      :aria-label="title"
      :aria-pressed="enabled || undefined"
      hover-class="qh-header-hover"
      :hover-stay-time="50"
      @click="onHeaderTap"
    >
      <view class="qh-text">
        <text class="qh-title">{{ title }}</text>
        <text class="qh-desc">{{ desc }}</text>
      </view>
      <switch
        class="qh-toggle"
        :checked="enabled"
        color="#2D6A5E"
        :aria-label="title"
        @change="onToggleChange"
      />
    </view>

    <!-- QHPickers(常驻渲染,enabled=false 时禁用 + 视觉弱化;per UI-018 fix B:
         移除 v-if 避免 picker 卸载/重挂载导致 fadeIn 动画重新播放的"刷新"抖动) -->
    <view
      class="qh-pickers"
      :class="{ 'qh-pickers-disabled': !enabled }"
    >
      <view class="qh-picker-col">
        <text class="qh-picker-label">{{ startLabel }}</text>
        <picker
          mode="time"
          :value="start"
          :start="START_TIME"
          :disabled="!enabled"
          @change="onStartChange"
        >
          <view class="qh-picker-value">
            <text
              v-if="start"
              class="qh-picker-value-text"
            >{{ start }}</text>
            <text
              v-else
              class="qh-picker-value-text qh-picker-value-placeholder"
            >{{ startPlaceholder }}</text>
          </view>
        </picker>
      </view>
      <view class="qh-picker-col">
        <text class="qh-picker-label">{{ endLabel }}</text>
        <picker
          mode="time"
          :value="end"
          :start="START_TIME"
          :disabled="!enabled"
          @change="onEndChange"
        >
          <view class="qh-picker-value">
            <text
              v-if="end"
              class="qh-picker-value-text"
            >{{ end }}</text>
            <text
              v-else
              class="qh-picker-value-text qh-picker-value-placeholder"
            >{{ endPlaceholder }}</text>
          </view>
        </picker>
      </view>
    </view>
  </view>
</template>

<script setup>
import { NotificationSettingStrings } from '../../../constants/strings.js'

const props = defineProps({
  enabled: {
    type: Boolean,
    required: true,
  },
  start: {
    type: String,
    required: true,
  },
  end: {
    type: String,
    required: true,
  },
  startLabel: {
    type: String,
    default: NotificationSettingStrings.pickerStartLabel,
  },
  endLabel: {
    type: String,
    default: NotificationSettingStrings.pickerEndLabel,
  },
})

const emit = defineEmits(['update:enabled', 'update:start', 'update:end'])

// QHHeader title/desc 引用 NotificationSettingStrings(沿 spec §3.6)
const title = NotificationSettingStrings.quietHoursTitle
const desc = NotificationSettingStrings.quietHoursDesc
const startPlaceholder = NotificationSettingStrings.pickerStartPlaceholder
const endPlaceholder = NotificationSettingStrings.pickerEndPlaceholder

// picker mode="time" start 下界(00:00);end 不设 end 上界(允许 23:59,跨午夜场景 per §5.3 H)
const START_TIME = '00:00'

/**
 * QHHeader 整行点击:同时切换(与 _NotificationSwitchRow 同模式)
 */
function onHeaderTap() {
  emit('update:enabled', !props.enabled)
}

/**
 * toggle 本身 change 事件
 * @param {Event} e
 */
function onToggleChange(e) {
  const next = !!(e?.detail?.value)
  if (next === props.enabled) return
  emit('update:enabled', next)
}

/**
 * start picker change
 * @param {Event} e
 */
function onStartChange(e) {
  const value = e?.detail?.value
  if (typeof value !== 'string' || value === props.start) return
  emit('update:start', value)
}

/**
 * end picker change
 * @param {Event} e
 */
function onEndChange(e) {
  const value = e?.detail?.value
  if (typeof value !== 'string' || value === props.end) return
  emit('update:end', value)
}
</script>

<style scoped>
.quiet-hours-row {
  background: #FDFBF7;
  /* surfaceCard */
  border-radius: 12px;
  /* radius-md */
  padding: 24rpx;
  /* space-lg */
  box-sizing: border-box;
  display: flex;
  flex-direction: column;
  gap: 20rpx;
  /* space-md,header 与 pickers 间 20rpx */
}

/* ─── QHHeader ─── */
.qh-header {
  display: flex;
  flex-direction: row;
  align-items: center;
  gap: 20rpx;
  min-height: 96rpx;
  /* ≥ 44pt tap area + 容纳 2 行 text + switch(spec §3.6 + §10.2) */
  box-sizing: border-box;
  transition: background 0.15s ease-out, opacity 0.15s ease-out;
}

.qh-header-hover {
  opacity: 0.96;
}

.qh-text {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 4rpx;
  box-sizing: border-box;
}

.qh-title {
  font-family: 'Noto Serif SC', serif;
  font-size: 32rpx;
  /* 16px */
  font-weight: 600;
  color: #2C2C2C;
  /* ink */
  line-height: 1.4;
}

.qh-desc {
  font-family: 'Noto Sans SC', sans-serif;
  font-size: 26rpx;
  /* 13px */
  color: #5A5A5A;
  /* inkLight */
  line-height: 1.4;
}

.qh-toggle {
  flex-shrink: 0;
}

/* ─── QHPickers(2 列横排) ─── */
.qh-pickers {
  display: flex;
  flex-direction: row;
  gap: 20rpx;
  /* space-md */
  animation: qhFadeIn 0.2s ease-out both;
  /* fadeIn 0.2s(spec §3.6 + §5.3 G)
     注:在 always-render 模式下,此动画仅在首次 mount 时播放一次,enabled 切换不会重播
     (per UI-018 fix B:避免 v-if 重挂载导致的"刷新"抖动) */
  transition: opacity 0.2s ease-out;
  /* enabled 切换时 picker 灰显过渡平滑(per UI-018 fix B 视觉一致性) */
  box-sizing: border-box;
}

.qh-pickers-disabled {
  /* 整组 picker 视觉弱化:enabled=false 时不可交互 */
  opacity: 0.5;
  pointer-events: none;
  /* 阻断 tap 落到 <picker>(配合 <picker :disabled> 双保险) */
}

.qh-picker-col {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 8rpx;
  /* space-sm */
  box-sizing: border-box;
}

.qh-picker-label {
  font-family: 'Noto Sans SC', sans-serif;
  font-size: 24rpx;
  /* 12px */
  color: #9A9A9A;
  /* inkMuted */
  line-height: 1.4;
}

.qh-picker-value {
  display: flex;
  align-items: center;
  min-height: 80rpx;
  /* 沿 NewTripPage §3.5 picker 高度(spec §3.6 + §10.2) */
  padding: 0 20rpx;
  background: #F2EBE0;
  /* surfaceWarm */
  border-radius: 12px;
  /* radius-md */
  box-sizing: border-box;
}

.qh-picker-value-text {
  font-family: 'Noto Sans SC', sans-serif;
  font-size: 30rpx;
  /* 15px */
  color: #2C2C2C;
  /* ink */
  line-height: 1.4;
  font-weight: 500;
}

.qh-picker-value-placeholder {
  color: #9A9A9A;
  /* inkMuted */
  font-weight: 400;
}

/* ─── Animations ─── */
@keyframes qhFadeIn {
  from {
    opacity: 0;
    transform: translateY(-4rpx);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}
</style>
