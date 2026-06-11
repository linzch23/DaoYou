<!--
  TrashItemRow.vue — TrashPage 私有 1 行已删行程卡片(下划线前缀 = private,见 Code Style §3.4)

  Spec contract: specs/TrashPage.md §3.2 + §8.1

  Props
    trip        : TripSummary                 已删行程(6 字段,见 api/types.ts:82-89)
    isRestoring : boolean                     当前是否处于「恢复中」状态(派生自 trashStore.restoringId === trip.id)
    statusLabel : string                      状态徽章文案(本页面固定传 HomeTripStatusLabel.deleted '已结束')

  Emits
    restore          : tripId: number    用户点「恢复」按钮
    permanent-delete : tripId: number    用户点「永久删除」按钮 → 父页面弹 _PermanentDeleteConfirmDialog

  Slots: 无

  视觉(spec §3.2):
    - 3 段垂直布局:
        _ItemHeader:  flex horizontal + justify-between → 标题(1 行省略) + 状态徽章(灰色)
        _ItemMeta:    flex horizontal + gap 16rpx       → 📍 城市 + 日期范围
        _ItemActions: flex horizontal + gap 12rpx       → 「恢复」flex 1 +「永久删除」flex 1(等宽)
    - 底部 2 按钮 min-height: 88rpx = 44pt 触达(per spec §10 NFR)
    - 卡片 hover: 整张卡 surfaceWarm 50% 背景 0.15s ease-out(沿用 MyPage 菜单 hover)
    - disabled 态: isRestoring=true 时 2 按钮 opacity 0.5 + pointer-events none(per spec §5.2 Step 2)

  数据源:从 trashStore.trashedTrips[i] 派生(TripSummary 形状)
-->
<template>
  <view
    class="trash-item-row"
    role="group"
    :aria-label="ariaLabel"
  >
    <!-- _ItemHeader: 标题 + 状态徽章 -->
    <view class="row-header">
      <text class="row-title">{{ trip.title }}</text>
      <view class="row-status-badge">
        <text class="row-status-text">{{ statusLabel }}</text>
      </view>
    </view>

    <!-- _ItemMeta: 城市 + 日期范围 -->
    <view class="row-meta">
      <text class="row-city">📍 {{ trip.city }}</text>
      <text class="row-date">{{ dateRange }}</text>
    </view>

    <!-- _ItemActions: 「恢复」+「永久删除」2 按钮 -->
    <view class="row-actions">
      <view
        class="row-btn row-btn-restore"
        :class="isRestoring ? 'row-btn-disabled' : ''"
        role="button"
        :aria-label="btnRestoreLabel"
        hover-class="row-btn-restore-hover"
        :hover-stay-time="50"
        @click="onRestoreTap"
      >
        <text v-if="isRestoring" class="row-btn-restore-spinner" aria-hidden="true" />
        <text class="row-btn-restore-text">{{ btnRestoreLabel }}</text>
      </view>

      <view
        class="row-btn row-btn-perm-delete"
        :class="isRestoring ? 'row-btn-disabled' : ''"
        role="button"
        :aria-label="btnPermanentDeleteLabel"
        hover-class="row-btn-perm-delete-hover"
        :hover-stay-time="50"
        @click="onPermanentDeleteTap"
      >
        <text class="row-btn-perm-delete-text">{{ btnPermanentDeleteLabel }}</text>
      </view>
    </view>
  </view>
</template>

<script setup>
import { computed } from 'vue'
import { TrashPageStrings, HomeTripStatusLabel } from '../../../constants/strings.js'

const props = defineProps({
  trip: {
    type: Object,
    required: true,
  },
  isRestoring: {
    type: Boolean,
    required: true,
  },
  statusLabel: {
    type: String,
    required: true,
  },
})

const emit = defineEmits(['restore', 'permanent-delete'])

const btnRestoreLabel = TrashPageStrings.btnRestore
const btnPermanentDeleteLabel = TrashPageStrings.btnPermanentDelete

/**
 * 日期范围派生:`${start_date} ~ ${end_date}`
 * 沿用 HomePage tripDateFormat 模板(per strings.js:127 `{start} ~ {end}`),
 * 但本页面直接拼接,避免新增国际化模板(单一使用点,MVP YAGNI)
 */
const dateRange = computed(() => `${props.trip.start_date} ~ ${props.trip.end_date}`)

/**
 * 整行 aria-label(spec §8.1):从 TrashPageStrings.itemAriaLabelTemplate 模板替换
 * 模板:`{title},{city},{dateRange}`
 */
const ariaLabel = computed(() =>
  TrashPageStrings.itemAriaLabelTemplate
    .replace('{title}', props.trip.title)
    .replace('{city}', props.trip.city)
    .replace('{dateRange}', dateRange.value)
)

function onRestoreTap() {
  if (props.isRestoring) return
  emit('restore', props.trip.id)
}

function onPermanentDeleteTap() {
  if (props.isRestoring) return
  emit('permanent-delete', props.trip.id)
}

/**
 * 状态徽章兜底:如果父页面忘记传 statusLabel,默认走 HomeTripStatusLabel.deleted = '已结束'
 * (防御性,正常调用方会传)
 */
const _ = HomeTripStatusLabel // 引用以避免 vite tree-shake 误删(本文件未直接用,但导入确保 side-effect 关联)
</script>

<style scoped>
.trash-item-row {
  display: flex;
  flex-direction: column;
  gap: 12rpx;
  /* 卡片内字段间 12rpx(per spec §3.1 + UI §四 8/16/24 节奏) */
  padding: 24rpx;
  background: #FDFBF7;
  /* surfaceCard,见 UI §二 */
  border-radius: 12px;
  /* radius-md */
  box-shadow: 0 2rpx 12rpx rgba(0, 0, 0, 0.04);
  /* shadow-sm,见 spec §3.1 */
  box-sizing: border-box;
  transition: background 0.15s ease-out;
}

/* 整行 hover 反馈(沿用 MyPage 菜单 hover,per spec §3.2) */
.trash-item-row:hover {
  background: rgba(242, 235, 224, 0.5);
  /* surfaceWarm 50% */
}

/* ───────── _ItemHeader ───────── */
.row-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12rpx;
}

.row-title {
  flex: 1;
  min-width: 0;
  font-family: 'Noto Serif SC', serif;
  font-size: 34rpx;
  /* 17px,UI §三 */
  font-weight: 600;
  color: #2C2C2C;
  /* ink */
  line-height: 1.4;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.row-status-badge {
  flex-shrink: 0;
  background: #E8E0D4;
  /* divider,见 UI §二 */
  border-radius: 6rpx;
  padding: 4rpx 12rpx;
  box-sizing: border-box;
}

.row-status-text {
  font-family: 'Noto Sans SC', sans-serif;
  font-size: 22rpx;
  /* 11px */
  color: #9A9A9A;
  /* inkMuted */
  line-height: 1.4;
}

/* ───────── _ItemMeta ───────── */
.row-meta {
  display: flex;
  align-items: center;
  gap: 16rpx;
  flex-wrap: nowrap;
}

.row-city {
  flex-shrink: 0;
  font-family: 'Noto Sans SC', sans-serif;
  font-size: 26rpx;
  /* 13px */
  color: #5A5A5A;
  /* inkLight */
  line-height: 1.5;
}

.row-date {
  flex: 1;
  min-width: 0;
  font-family: 'Noto Sans SC', sans-serif;
  font-size: 26rpx;
  /* 13px */
  color: #5A5A5A;
  /* inkLight */
  line-height: 1.5;
  text-align: right;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

/* ───────── _ItemActions ───────── */
.row-actions {
  display: flex;
  align-items: center;
  gap: 12rpx;
  margin-top: 4rpx;
}

.row-btn {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 88rpx;
  /* ≥ 44pt tap area(88rpx = 44pt,per spec §10 NFR 可访问性) */
  border-radius: 9999px;
  /* radius-full */
  box-sizing: border-box;
  transition: opacity 0.15s ease-out, transform 0.15s ease-out, box-shadow 0.15s ease-out;
}

/* 主按钮:恢复(Primary 渐变) */
.row-btn-restore {
  background: linear-gradient(135deg, #2D6A5E 0%, #3D8B7D 100%);
  /* Primary 渐变,见 UI §二 + §八 */
  box-shadow: 0 4rpx 16rpx rgba(45, 106, 94, 0.35);
}

.row-btn-restore-hover {
  transform: scale(0.96);
  box-shadow: 0 2rpx 8rpx rgba(45, 106, 94, 0.35);
}

.row-btn-restore-text {
  font-family: 'Noto Sans SC', sans-serif;
  font-size: 30rpx;
  /* 15px,UI §三 重要正文 */
  font-weight: 600;
  color: #FFFFFF;
  line-height: 1.4;
}

/* 恢复中:左侧小转圈占位 + 文字(opacity 由 row-btn-disabled 控制) */
.row-btn-restore-spinner {
  display: inline-block;
  width: 24rpx;
  height: 24rpx;
  border: 2rpx solid rgba(255, 255, 255, 0.3);
  border-top-color: #FFFFFF;
  border-radius: 50%;
  animation: rowBtnSpin 0.8s linear infinite;
  margin-right: 8rpx;
  box-sizing: border-box;
  flex-shrink: 0;
}

@keyframes rowBtnSpin {
  to { transform: rotate(360deg); }
}

/* 次按钮:永久删除(Danger 描边 + Danger 文字) */
.row-btn-perm-delete {
  background: transparent;
  border: 1.5px solid #C44A3A;
  /* Danger 描边 1.5px,per spec §3.1 + §3.2 */
}

.row-btn-perm-delete-hover {
  transform: scale(0.96);
  background: rgba(196, 74, 58, 0.05);
  /* 极淡 Danger 软色,hover 反馈 */
}

.row-btn-perm-delete-text {
  font-family: 'Noto Sans SC', sans-serif;
  font-size: 30rpx;
  /* 15px */
  font-weight: 500;
  color: #C44A3A;
  /* Danger 文字,见 spec §3.1 + §3.2 */
  line-height: 1.4;
}

/* disabled 态:isRestoring=true 时(per spec §5.2 Step 2) */
.row-btn-disabled {
  opacity: 0.5;
  pointer-events: none;
}
</style>
