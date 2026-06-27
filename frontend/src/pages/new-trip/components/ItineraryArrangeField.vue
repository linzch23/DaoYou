<!--
  ItineraryArrangeField.vue — 页面私有 4 字段行程安排组件(下划线前缀 = private,见 Code Style §3.4)

  Spec contract: issues/UI/UI-025-itinerary-arrange-drag.md

  Props
    modelValue  : ItineraryItem[]   v-model 双向绑定(spec §3.5 Field 6)
    readonly    : boolean            只读标记(任务 4 复制模式预填,本 MVP 默认 false,沿用 v-model)

  Emits
    update:modelValue  : (arr: ItineraryItem[]) => void   v-model 标准
    add                : (item: ItineraryItem) => void    v0.5.0 per UserRound2-001 Bug A;
                                                          NewTripPage 不消费,EditTripPage onAddItem 接住调 POST /api/trip-items
    remove             : (id: number) => void             v0.5.0 同上;EditTripPage onRemoveItem 接住调 DELETE
                                                          v0.5.1(per UserRound2-002 Bug C):emit 顺序固定为
                                                          emit('remove', id) **先**,v-model splice **后** — 父级
                                                          handler findIndex 时 arr 还在,避免 -1 early return
    update             : (arr: ItineraryItem[]) => void   v0.5.0 拖动结束发;EditTripPage MVP 不调 API
                                                          v0.5.1(per UserRound2-002 Bug D):也用于 onUpdateExistingItem
                                                          (用户编辑现有 item 路径,MVP 简化不实现 UI,协议保留)

  跨端硬约束(per issues/UI/UI-025 §实现挑战):
    - 不用 HTML5 drag-and-drop(Android uni-app x UTS 不解析)
    - 自写 @touchstart + @touchmove + @touchend(跨 H5 + Android 兼容)
    - 不引 npm 依赖(沿 MVP 惯例)

  功能(per issues/UI/UI-025 §修复方案 + UserRound2-002 Bug D 升级):
    - 横向 scroll-view 渲染 items(每项 280rpx 宽卡)
    - 每项卡:title + start_time~end_time + item_type emoji
    - 长按 200ms 进入"拖动模式"(该卡半透明 + scale 1.05 + 提示「拖动调整顺序」)
    - 滑动 → 与相邻项位置碰撞,跨过 50% 阈值自动交换
    - 松手 → emit('update:modelValue', newOrder)
    - 「+ 添加行程」按钮 → 弹 inline 展开表单(地点名/起止时间/item_type 5 选 1)
    - 每项右上角小 x → 删除(简单 toast 提示后立即删,MVP 简化)
    - v0.5.1(per UserRound2-002 Bug D):自动按 date+start_time 升序 + 重叠检测
      - sortItems(arr) 按 date 升序 → 同 date 按 start_time 升序
      - findOverlap(arr, newItem) 重叠时段检测;[start1,end1) ∩ [start2,end2) ≠ ∅
      - confirmAdd 路径:重叠 → Toast「与「{title}」时段重叠」+ 拒绝;否则 sort + emit
      - onUpdateExistingItem 路径:同上,MVP 简化不实现 ✏️ UI 触发(协议保留)
-->
<template>
  <view class="itinerary-arrange-field">
    <!-- 字段 label + hint -->
    <view class="field-header">
      <text class="field-label">{{ strings.fieldLabel }}</text>
      <text class="field-hint">{{ strings.fieldHint }}</text>
    </view>

    <!-- 横向 scroll-view 渲染 items -->
    <scroll-view
      v-if="modelValue && modelValue.length > 0"
      class="items-scroll"
      :scroll-x="true"
      :enhanced="true"
      :show-scrollbar="false"
      :scroll-with-animation="true"
      :style="scrollViewPointerEvents"
      @touchstart="onScrollTouchStart"
      @touchmove="onScrollTouchMove"
    >
      <view class="items-row">
        <view
          v-for="(item, idx) in modelValue"
          :key="item.id"
          class="item-card"
          :class="{ 'item-card-dragging': isDragging && draggingId === item.id }"
          :style="getItemStyle(item.id)"
          @touchstart="(e) => onItemTouchStart(item, idx, e)"
          @touchmove.stop.prevent="onItemTouchMove"
          @touchend="onItemTouchEnd"
          @touchcancel="onItemTouchEnd"
        >
          <!-- 卡片内容 -->
          <view class="item-card-emoji" aria-hidden="true">
            <text class="item-card-emoji-text">{{ getEmoji(item.item_type) }}</text>
          </view>
          <text class="item-card-title">{{ item.title || '未命名地点' }}</text>
          <text class="item-card-time">{{ formatItemDate(item.date) }} {{ item.start_time || '--:--' }} ~ {{ item.end_time || '--:--' }}</text>
          <text class="item-card-type">{{ getTypeLabel(item.item_type) }}</text>

          <!-- 删除按钮(右上角小 x) -->
          <view
            v-if="!isDragging"
            class="item-card-remove"
            role="button"
            :aria-label="strings.btnRemoveAria"
            hover-class="item-card-remove-hover"
            :hover-stay-time="50"
            @click.stop="onRemoveItem(item.id)"
            @touchstart.stop
          >
            <text class="item-card-remove-text" aria-hidden="true">✕</text>
          </view>
        </view>

        <!-- 末尾 + 添加按钮(可始终在尾部) -->
        <view
          class="item-add-btn"
          role="button"
          :aria-label="strings.btnAddAria"
          hover-class="item-add-btn-hover"
          :hover-stay-time="50"
          @click="toggleAddPanel"
        >
          <text class="item-add-btn-text">{{ strings.btnAdd }}</text>
        </view>
      </view>
    </scroll-view>

    <!-- 空态(无 item 时) -->
    <view
      v-else
      class="items-empty"
    >
      <view
        class="item-add-btn item-add-btn-empty"
        role="button"
        :aria-label="strings.btnAddAria"
        hover-class="item-add-btn-hover"
        :hover-stay-time="50"
        @click="toggleAddPanel"
      >
        <text class="item-add-btn-text">{{ strings.btnAdd }}</text>
      </view>
    </view>

    <!-- v0.6.0(2026-06-26 per user-round4-2026-06-26):删掉拖动提示浮层
         原 v-if="isDragging" 块整段删除(显示「拖动调整顺序」),MVP 不实现拖动 UI
         引用方 0 命中(strings.dragHint 同步删除)
         保留:touchstart / touchmove / touchend handlers + isDragging computed
               (per task 简化方案:不删 dead code,避免触碰大段代码引入新 bug) -->

    <!-- inline 添加表单 -->
    <view
      v-if="addPanelVisible"
      class="add-panel"
    >
      <input
        v-model="addForm.title"
        class="add-panel-input"
        :placeholder="strings.placeholderTitle"
        placeholder-class="add-panel-input-placeholder"
      />
      <view class="add-panel-time-row">
        <picker
          mode="date"
          :value="addForm.date"
          :start="datePickerStart"
          :end="datePickerEnd"
          @change="(e) => { addForm.date = e.detail.value }"
        >
          <view class="add-panel-time-picker">
            <text
              class="add-panel-time-picker-text"
              :class="{ 'add-panel-time-picker-text-placeholder': !addForm.date }"
            >{{ addForm.date || strings.placeholderDate }}</text>
          </view>
        </picker>
        <picker
          mode="time"
          :value="addForm.start_time"
          @change="(e) => { addForm.start_time = e.detail.value }"
        >
          <view class="add-panel-time-picker">
            <text
              class="add-panel-time-picker-text"
              :class="{ 'add-panel-time-picker-text-placeholder': !addForm.start_time }"
            >{{ addForm.start_time || strings.placeholderStartTime }}</text>
          </view>
        </picker>
        <text class="add-panel-time-separator">~</text>
        <picker
          mode="time"
          :value="addForm.end_time"
          @change="(e) => { addForm.end_time = e.detail.value }"
        >
          <view class="add-panel-time-picker">
            <text
              class="add-panel-time-picker-text"
              :class="{ 'add-panel-time-picker-text-placeholder': !addForm.end_time }"
            >{{ addForm.end_time || strings.placeholderEndTime }}</text>
          </view>
        </picker>
      </view>
      <view class="add-panel-type-row">
        <view
          v-for="opt in ItineraryArrangeItemTypeOptions"
          :key="opt.value"
          class="add-panel-type-chip"
          :class="{ 'add-panel-type-chip-selected': addForm.item_type === opt.value }"
          role="button"
          :aria-label="opt.label"
          hover-class="add-panel-type-chip-hover"
          :hover-stay-time="50"
          @click="addForm.item_type = opt.value"
        >
          <text
            class="add-panel-type-chip-text"
            :class="{ 'add-panel-type-chip-text-selected': addForm.item_type === opt.value }"
          >{{ opt.emoji }} {{ opt.label }}</text>
        </view>
      </view>
      <view class="add-panel-actions">
        <view
          class="add-panel-btn add-panel-btn-cancel"
          role="button"
          :aria-label="'取消'"
          hover-class="add-panel-btn-hover"
          :hover-stay-time="50"
          @click="cancelAdd"
        >
          <text class="add-panel-btn-cancel-text">取消</text>
        </view>
        <view
          class="add-panel-btn add-panel-btn-confirm"
          :class="{ 'add-panel-btn-confirm-disabled': !canConfirmAdd }"
          role="button"
          :aria-label="'确定'"
          hover-class="add-panel-btn-hover"
          :hover-stay-time="50"
          @click="confirmAdd"
        >
          <text class="add-panel-btn-confirm-text">确定</text>
        </view>
      </view>
    </view>
  </view>
</template>

<script setup>
import { ref, computed } from 'vue'
import { ItineraryArrangeStrings, ItineraryArrangeItemTypeOptions } from '../../../constants/strings.js'
import { logger } from '../../../utils/logger.js'

const strings = ItineraryArrangeStrings

// ──────────── 派生常量(per UserRound2-002 Bug D) ────────────
//
// 2026-06-25 新增(per UserRound2-002 Bug D):重叠警告文案拼接收敛到 page-local const,
// 避免改 constants/strings.js 跨多个 page 影响(沿 PhotoGuidePage §8.3 + TrashPage
// 14 行 page-local 决策;page-only 警告文案,不在其他页面复用)。
//
// 模板:'与「{title}」时段重叠' → 通过字符串拼接(per PhotoGuidePage §8.3 模板用法)
const OVERLAP_WARNING_PREFIX = '与「'
const OVERLAP_WARNING_MIDDLE = '」时段重叠'

// ──────────── Props / Emits ────────────
const props = defineProps({
  modelValue: {
    type: Array,
    default: () => [],
  },
  readonly: {
    type: Boolean,
    default: false,
  },
})

const emit = defineEmits([
  'update:modelValue',
  // v0.5.0(2026-06-25 per UserRound2-001 Bug A):加 3 个显式事件,EditTripPage 接住调 API
  //   - `add`    : user 点「确定」添加一条新 item(newItem 形状含 client-generated id)
  //   - `remove` : user 点 item 右上角小 ✕ 删除(emit 该 item 的 id)
  //   - `update` : user 拖动 reorder(emit 整个新 arr,EditTripPage 可感知顺序变化)
  // 沿 NewTripPage 兼容路径:NewTripPage **不**接这 3 个事件(只接 v-model),
  // 0 breaking change;EventArgs 1:1 复用 ItineraryItem / id 标量
  'add',
  'remove',
  'update',
])

// ──────────── Touch / Drag 状态 ────────────
/** @type {import('vue').Ref<number | null>} 当前正在拖动的 item id */
const draggingId = ref(null)
/** @type {import('vue').Ref<number>} 拖动起始 index(原始位置) */
const originalIndex = ref(-1)
/** @type {import('vue').Ref<number | null>} longPress 200ms 定时器 id */
let longPressTimerId = null
/** @type {import('vue').Ref<number>} 手指 X 起始 clientX(用于计算 dragOffsetX) */
const dragStartX = ref(0)
/** @type {import('vue').Ref<number>} 当前手指 X 相对 dragStartX 的偏移(px) */
const dragOffsetX = ref(0)
/** @type {import('vue').Ref<number>} scroll-view 左侧 padding 累计偏移(px),用于 rpx/px 换算 */
const scrollLeft = ref(0)

const isDragging = computed(() => draggingId.value !== null)

/** scroll-view 拖动时是否禁用原生滚动(避免与 item 拖动冲突) */
const scrollViewPointerEvents = computed(() => {
  if (isDragging.value) {
    // 拖动时禁止 scroll-view 滚动
    return { 'pointer-events': 'none' }
  }
  return {}
})

// ──────────── 触摸事件处理 ────────────

/**
 * scroll-view 容器 touchstart(占位,主要逻辑在 item 上)
 * @param {UniApp.TouchEvent} _e
 */
function onScrollTouchStart(_e) {
  // do nothing,所有逻辑在 item 的 touchstart 触发
}

/**
 * scroll-view 容器 touchmove(拖动时拦截,避免 scroll-view 抢手势)
 * @param {UniApp.TouchEvent} _e
 */
function onScrollTouchMove(_e) {
  if (isDragging.value) {
    // 拦截,避免 scroll-view 横向滚动
    return false
  }
  return true
}

/**
 * Item touchstart — 启动 long-press 200ms 定时器
 * @param {import('../../../api/types').ItineraryItem} item
 * @param {number} idx
 * @param {UniApp.TouchEvent} e
 */
function onItemTouchStart(item, idx, e) {
  if (e.touches.length !== 1) return
  const touch = e.touches[0]
  // 记录起始位置(用于 200ms 后进入拖动模式)
  dragStartX.value = touch.clientX
  originalIndex.value = idx

  // 启动 200ms long-press 定时器
  clearLongPressTimer()
  longPressTimerId = setTimeout(() => {
    longPressTimerId = null
    // 进入拖动模式
    draggingId.value = item.id
    dragOffsetX.value = 0
    logger.info('[ItineraryArrangeField] drag start', { id: item.id, originalIndex: idx })
  }, 200)
}

/**
 * Item touchmove — 计算 dragOffsetX,跨过 50% 阈值时交换
 * @param {UniApp.TouchEvent} e
 */
function onItemTouchMove(e) {
  if (!isDragging.value) {
    // 未进入拖动模式:中断 long-press(用户只是滚动 / 拖动 < 200ms)
    clearLongPressTimer()
    return
  }
  if (e.touches.length !== 1) return

  const touch = e.touches[0]
  const offsetX = touch.clientX - dragStartX.value
  dragOffsetX.value = offsetX

  // 计算跨越了多少个 item 宽度(单卡 ~280rpx ≈ 140px @ 750rpx 设计稿)
  // 此处简化:1 像素 ≈ 1.9 rpx @ 750rpx 设计稿
  const itemWidthPx = 140 // 280rpx / 2
  const delta = Math.round(offsetX / itemWidthPx)

  if (delta !== 0) {
    // 计算新 index
    const newIndex = originalIndex.value + delta
    const arr = [...props.modelValue]
    const total = arr.length

    if (newIndex >= 0 && newIndex < total && newIndex !== originalIndex.value) {
      // 数组内位置交换
      const item = arr[originalIndex.value]
      arr.splice(originalIndex.value, 1)
      arr.splice(newIndex, 0, item)

      emit('update:modelValue', arr)
      originalIndex.value = newIndex
      // 重置 dragStartX 与 offset(避免连续跨越累计)
      dragStartX.value = touch.clientX
      dragOffsetX.value = 0
      logger.debug('[ItineraryArrangeField] drag swap', { from: originalIndex.value, to: newIndex })
    }
  }
}

/**
 * Item touchend / touchcancel — 提交新顺序 + 清理拖动状态
 * @param {UniApp.TouchEvent} _e
 */
function onItemTouchEnd(_e) {
  clearLongPressTimer()
  if (isDragging.value) {
    const draggedId = draggingId.value
    const finalArr = [...props.modelValue]
    logger.info('[ItineraryArrangeField] drag end', { id: draggedId, finalIndex: finalArr.findIndex((it) => it.id === draggedId) })
    draggingId.value = null
    dragOffsetX.value = 0
    originalIndex.value = -1
    // v0.5.0(per UserRound2-001 Bug A):拖动结束 emit update 事件
    //   - 拖动过程中 emit('update:modelValue', arr) 已多次触发(每次跨过 50% 阈值),
    //     EditTripPage 父级 v-model 数组顺序实时更新(本地)
    //   - 拖动结束 emit('update', finalArr) 一次性通知「order change settled」
    //     → EditTripPage MVP:不调 API(后端无 reorder 端点,仅展示用)
    //   - NewTripPage 仍可继续走 v-model,无 0 breaking
    emit('update', finalArr)
  }
}

function clearLongPressTimer() {
  if (longPressTimerId !== null) {
    clearTimeout(longPressTimerId)
    longPressTimerId = null
  }
}

// ──────────── 删除 / 添加 inline 表单 ────────────

// ──── 排序 + 重叠检测(per UserRound2-002 Bug D,2026-06-25 新增) ────

/**
 * 按 date + start_time 升序排序
 * 2026-06-25 新增(per UserRound2-002 Bug D + spec §3.5 Field 6 升级):
 *   - user 实测需求驱动从「手动拖动排序」升级为「自动按 date + start_time 升序」
 *   - 注:HH:mm 时间字符串可直接比较('08:00' < '10:00')
 *   - 缺 start_time 的项排到该日期末尾
 *
 * @param {import('../../../api/types').ItineraryItem[]} arr
 * @returns {import('../../../api/types').ItineraryItem[]}
 */
function sortItems(arr) {
  return [...arr].sort((a, b) => {
    if (a.date !== b.date) return a.date < b.date ? -1 : 1
    // 同一日期,按 start_time 升序;空 start_time 排最后
    if (!a.start_time) return 1
    if (!b.start_time) return -1
    return a.start_time < b.start_time ? -1 : a.start_time > b.start_time ? 1 : 0
  })
}

/**
 * 重叠时段检测
 * 2026-06-25 新增(per UserRound2-002 Bug D):返回首个与 newItem 重叠的 item(无重叠返 null)
 *   - 同 date + [start1, end1) 与 [start2, end2) 重叠判定:start1 < end2 && start2 < end1
 *   - 跳过 newItem 自己(id 一致,避免 update 路径自重叠)
 *   - 缺任意 time 字段 → 不算重叠(per issue §4.3.1 决策,用户编辑半成品不阻塞)
 *
 * @param {import('../../../api/types').ItineraryItem[]} arr 现有 items(不含 newItem)
 * @param {import('../../../api/types').ItineraryItem} newItem 待检测 item
 * @returns {import('../../../api/types').ItineraryItem | null}
 */
function findOverlap(arr, newItem) {
  if (!newItem.date || !newItem.start_time || !newItem.end_time) return null
  for (const it of arr) {
    if (it.id === newItem.id) continue  // 跳过自己(update 路径)
    if (it.date !== newItem.date) continue
    if (!it.start_time || !it.end_time) continue
    // [start1, end1) 与 [start2, end2) 重叠 = start1 < end2 && start2 < end1
    if (newItem.start_time < it.end_time && it.start_time < newItem.end_time) {
      return it
    }
  }
  return null
}

/**
 * 删除指定 item
 *
 * 2026-06-25 修复(per UserRound2-002 Bug C):emit 顺序调整——
 *   - **先 emit('remove', id)** 让父级 handler(EditTripPage.onRemoveItem)能在 v-model splice
 *     **前** findIndex by id(arr 还在,idx 有效)→ 调 DELETE API
 *   - 反向(v0.5.0 旧版先 v-model splice)父级 findIndex 永远 -1 → early return → 永远不调 DELETE
 *   - 后 emit('update:modelValue', arr) 走 v-model 删本地(乐观更新)
 *   - 失败由 EditTripPage handler 自行 Toast(per issue §3.3 决策,不回滚避免重复 splice)
 *
 * @param {number} id
 */
function onRemoveItem(id) {
  // 顺序固定:emit('remove') 在前,父级 handler 能 findIndex
  emit('remove', id)
  const arr = props.modelValue.filter((it) => it.id !== id)
  emit('update:modelValue', arr)
  logger.info('[ItineraryArrangeField] remove item', { id, remaining: arr.length })
}

// ──── inline 添加 ────
const addPanelVisible = ref(false)
const addForm = ref({
  title: '',
  date: '',
  start_time: '',
  end_time: '',
  item_type: 'attraction',
})

/** date-picker 起始日期(今天) */
const datePickerStart = computed(() => {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
})

/** date-picker 截止日期(2 年后) */
const datePickerEnd = computed(() => {
  const d = new Date()
  d.setFullYear(d.getFullYear() + 2)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
})

const canConfirmAdd = computed(() => {
  return addForm.value.title.trim() !== ''
    && addForm.value.date !== ''
    && addForm.value.start_time !== ''
    && addForm.value.end_time !== ''
})

function toggleAddPanel() {
  if (props.readonly) return
  if (addPanelVisible.value) {
    cancelAdd()
    return
  }
  addPanelVisible.value = true
  addForm.value = {
    title: '',
    date: '',
    start_time: '',
    end_time: '',
    item_type: 'attraction',
  }
  logger.debug('[ItineraryArrangeField] add panel open')
}

function cancelAdd() {
  addPanelVisible.value = false
  addForm.value = {
    title: '',
    date: '',
    start_time: '',
    end_time: '',
    item_type: 'attraction',
  }
  logger.debug('[ItineraryArrangeField] add panel cancel')
}

function confirmAdd() {
  if (!canConfirmAdd.value) {
    logger.warn('[ItineraryArrangeField] add blocked, missing required fields')
    return
  }
  const newItem = {
    // 客户端生成稳定 key(Date.now() + 随机后缀避免同毫秒冲突)
    id: Date.now() * 1000 + Math.floor(Math.random() * 1000),
    title: addForm.value.title.trim(),
    date: addForm.value.date,
    start_time: addForm.value.start_time,
    end_time: addForm.value.end_time,
    item_type: addForm.value.item_type,
  }
  // 2026-06-25 新增(per UserRound2-002 Bug D):重叠检测
  //   - 同 date + 时段重叠 → 拒绝 + Toast 警告 + 不 emit
  //   - 沿 PhotoGuidePage §8.3 错误处理模式(uni.showToast 简单反馈)
  const overlap = findOverlap(props.modelValue, newItem)
  if (overlap) {
    uni.showToast({
      title: `${OVERLAP_WARNING_PREFIX}${overlap.title}${OVERLAP_WARNING_MIDDLE}`,
      icon: 'none',
      duration: 2000,
    })
    logger.warn('[ItineraryArrangeField] add blocked, overlap', {
      newTitle: newItem.title,
      overlapTitle: overlap.title,
      newDate: newItem.date,
      newTime: `${newItem.start_time}~${newItem.end_time}`,
    })
    return
  }
  // 2026-06-25 新增(per UserRound2-002 Bug D):自动按 date+start_time 升序插入
  //   - 替代旧版「手动拖动排序」(spec §3.5 Field 6 升级)
  //   - 沿用 emit('update:modelValue', sorted) v-model 协议
  const sorted = sortItems([...props.modelValue, newItem])
  emit('update:modelValue', sorted)
  // v0.5.0(per UserRound2-001 Bug A):显式 emit add,EditTripPage onAddItem 接住调 POST
  // 与 update:modelValue 并行触发;EditTripPage handler 收到事件后
  // (1) 乐观更新:v-model 已加本地(client-id);(2) handler await POST,成功把 server-id
  //     splice 回去替换 client-id 行(per issue §1.3.2 onAddItem 决策)
  emit('add', newItem)
  logger.info('[ItineraryArrangeField] add item', { id: newItem.id, title: newItem.title, totalCount: sorted.length })
  cancelAdd()
}

/**
 * 用户编辑现有 item 后 → 查重 + 排序 + emit update
 * 2026-06-25 新增(per UserRound2-002 Bug D):MVP 简化不实现 ✏️ UI 触发(沿 NewTripPage §8.2 +
 * PhotoGuidePage §8.3 决策),本函数保留供未来 IssueManager 提议 hook(per issue §4.3.3 决策)。
 * 协议签名:接收 updatedItem(完整 item 含 id),内部查重 + 替换 + 排序 + emit('update:modelValue', sorted) + emit('update', updatedItem)。
 *
 * @param {import('../../../api/types').ItineraryItem} updatedItem
 */
function onUpdateExistingItem(updatedItem) {
  // 查重(排除自己 — findOverlap 内部已跳过 it.id === updatedItem.id)
  const overlap = findOverlap(props.modelValue, updatedItem)
  if (overlap) {
    uni.showToast({
      title: `${OVERLAP_WARNING_PREFIX}${overlap.title}${OVERLAP_WARNING_MIDDLE}`,
      icon: 'none',
      duration: 2000,
    })
    logger.warn('[ItineraryArrangeField] update blocked, overlap', {
      updatedTitle: updatedItem.title,
      overlapTitle: overlap.title,
    })
    return
  }
  // 替换 + 重排
  const arr = props.modelValue.map((it) => (it.id === updatedItem.id ? updatedItem : it))
  const sorted = sortItems(arr)
  emit('update:modelValue', sorted)
  emit('update', updatedItem)
  logger.info('[ItineraryArrangeField] update item', { id: updatedItem.id, totalCount: sorted.length })
}

// ──────────── 派生:emoji / typeLabel ────────────

/**
 * 5 ItemType 1:1 对齐 emoji
 * @param {string} t
 * @returns {string}
 */
function getEmoji(t) {
  return ItineraryArrangeItemTypeOptions.find((o) => o.value === t)?.emoji || '📍'
}

/**
 * 5 ItemType 1:1 对齐中文短标签
 * @param {string} t
 * @returns {string}
 */
function getTypeLabel(t) {
  return ItineraryArrangeItemTypeOptions.find((o) => o.value === t)?.label || t
}

/**
 * 格式化 item.date 'YYYY-MM-DD' → 'MM月DD日'(per TripCreateEditFix-001 C 决策)
 * 无 date(edit 模式派生时缺)→ 返回空串,避免卡片显示 'undefined月undefined日'
 * @param {string | undefined} dateIso
 * @returns {string}
 */
function formatItemDate(dateIso) {
  if (!dateIso || typeof dateIso !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(dateIso)) {
    return ''
  }
  const [, mm, dd] = dateIso.split('-')
  return `${parseInt(mm, 10)}月${parseInt(dd, 10)}日`
}

// ──────────── 样式派生:拖动视觉反馈 ────────────

/**
 * 拖动中 item 的 style(沿原位置但 X 偏移 dragOffsetX)
 * @param {number} id
 * @returns {Record<string, string>}
 */
function getItemStyle(id) {
  if (isDragging.value && draggingId.value === id) {
    return {
      transform: `translateX(${dragOffsetX.value}px) scale(1.05)`,
      opacity: '0.6',
      'z-index': '10',
    }
  }
  return {}
}
</script>

<style scoped>
.itinerary-arrange-field {
  display: flex;
  flex-direction: column;
  gap: 12rpx;
  /* space-sm,label 与 items 之间 12rpx */
  box-sizing: border-box;
}

.field-header {
  display: flex;
  flex-direction: column;
  gap: 4rpx;
  box-sizing: border-box;
}

.field-label {
  font-family: 'Noto Sans SC', sans-serif;
  font-size: 28rpx;
  /* 14px,正文 */
  font-weight: 500;
  color: #2C2C2C;
  /* ink */
  line-height: 1.4;
}

.field-hint {
  font-family: 'Noto Sans SC', sans-serif;
  font-size: 24rpx;
  /* 12px */
  color: #9A9A9A;
  /* inkMuted */
  line-height: 1.4;
}

.items-scroll {
  width: 100%;
  white-space: nowrap;
  /* 防止内容换行,横向滚动必备 */
  box-sizing: border-box;
}

.items-row {
  display: inline-flex;
  flex-direction: row;
  gap: 16rpx;
  /* space-md,卡片间 16rpx */
  padding: 8rpx 0;
  box-sizing: border-box;
}

.item-card {
  position: relative;
  display: inline-flex;
  flex-direction: column;
  gap: 8rpx;
  /* space-sm */
  width: 280rpx;
  /* 每张卡片固定 280rpx 宽(spec §3.5) */
  height: 220rpx;
  /* 固定高度,避免抖动 */
  padding: 16rpx 20rpx;
  background: #FDFBF7;
  /* surfaceCard */
  border: 1.5px solid #E8E0D4;
  /* divider */
  border-radius: 12px;
  /* radius-md */
  box-sizing: border-box;
  flex-shrink: 0;
  /* 防止 scroll-view 挤压 */
  transition: transform 0.15s ease-out, opacity 0.15s ease-out;
  white-space: normal;
  /* 卡片内文字可换行(与 items-row 的 nowrap 区分) */
  box-shadow: 0 2rpx 8rpx rgba(0, 0, 0, 0.04);
  cursor: grab;
}

.item-card-dragging {
  cursor: grabbing;
}

.item-card-emoji {
  width: 48rpx;
  height: 48rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(45, 106, 94, 0.08);
  /* primarySoft */
  border-radius: 50%;
  box-sizing: border-box;
}

.item-card-emoji-text {
  font-size: 32rpx;
  /* 16px */
  line-height: 1;
}

.item-card-title {
  font-family: 'Noto Serif SC', serif;
  font-size: 28rpx;
  /* 14px */
  font-weight: 600;
  color: #2C2C2C;
  /* ink */
  line-height: 1.3;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  max-width: 100%;
}

.item-card-time {
  font-family: 'Noto Sans SC', sans-serif;
  font-size: 22rpx;
  /* 11px */
  color: #5A5A5A;
  /* inkLight */
  line-height: 1.4;
}

.item-card-type {
  font-family: 'Noto Sans SC', sans-serif;
  font-size: 22rpx;
  /* 11px */
  color: #2D6A5E;
  /* primary */
  line-height: 1.4;
  margin-top: auto;
  /* 推到底部 */
}

.item-card-remove {
  position: absolute;
  top: 4rpx;
  right: 4rpx;
  width: 48rpx;
  height: 48rpx;
  min-width: 48rpx;
  min-height: 48rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(196, 74, 58, 0.1);
  /* dangerSoft */
  border-radius: 50%;
  box-sizing: border-box;
}

.item-card-remove-hover {
  background: rgba(196, 74, 58, 0.2);
}

.item-card-remove-text {
  font-family: 'Noto Sans SC', sans-serif;
  font-size: 20rpx;
  /* 10px */
  color: #C44A3A;
  /* danger */
  line-height: 1;
  margin-top: -2rpx;
}

.item-add-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 160rpx;
  height: 220rpx;
  /* 与卡片同高,视觉对齐 */
  padding: 0 24rpx;
  background: transparent;
  border: 1.5px dashed #9A9A9A;
  /* inkMuted 虚线 */
  border-radius: 12px;
  box-sizing: border-box;
  flex-shrink: 0;
  transition: background 0.15s ease-out, border-color 0.15s ease-out;
}

.item-add-btn-empty {
  width: 100%;
  min-width: 0;
  height: 120rpx;
  /* 空态时高度小一些 */
}

.item-add-btn-hover {
  background: rgba(45, 106, 94, 0.06);
  border-color: #2D6A5E;
}

.item-add-btn-text {
  font-family: 'Noto Sans SC', sans-serif;
  font-size: 28rpx;
  /* 14px */
  color: #5A5A5A;
  /* inkLight */
  line-height: 1.4;
  white-space: nowrap;
}

.items-empty {
  display: flex;
  width: 100%;
  box-sizing: border-box;
}

.drag-hint {
  position: absolute;
  top: 8rpx;
  right: 8rpx;
  padding: 4rpx 12rpx;
  background: rgba(45, 106, 94, 0.12);
  /* primarySoftStrong */
  border-radius: 9999px;
  box-sizing: border-box;
  pointer-events: none;
}

.drag-hint-text {
  font-family: 'Noto Sans SC', sans-serif;
  font-size: 22rpx;
  /* 11px */
  color: #2D6A5E;
  /* primary */
  line-height: 1.4;
}

/* ─── inline 添加表单 ─── */
.add-panel {
  display: flex;
  flex-direction: column;
  gap: 12rpx;
  padding: 16rpx;
  background: #F2EBE0;
  /* surfaceWarm */
  border-radius: 12px;
  /* radius-md */
  box-sizing: border-box;
  margin-top: 12rpx;
}

.add-panel-input {
  width: 100%;
  height: 80rpx;
  padding: 0 20rpx;
  background: #FDFBF7;
  /* surfaceCard */
  border: 1.5px solid #E8E0D4;
  /* divider */
  border-radius: 12px;
  font-family: 'Noto Sans SC', sans-serif;
  font-size: 30rpx;
  /* 15px */
  color: #2C2C2C;
  line-height: 1.4;
  box-sizing: border-box;
}

.add-panel-input-placeholder {
  color: #9A9A9A;
}

.add-panel-time-row {
  display: flex;
  align-items: center;
  gap: 8rpx;
  box-sizing: border-box;
}

.add-panel-time-picker {
  flex: 1;
  height: 80rpx;
  display: flex;
  align-items: center;
  padding: 0 20rpx;
  background: #FDFBF7;
  border: 1.5px solid #E8E0D4;
  border-radius: 12px;
  box-sizing: border-box;
}

.add-panel-time-picker-text {
  font-family: 'Noto Sans SC', sans-serif;
  font-size: 30rpx;
  color: #2C2C2C;
  line-height: 1.4;
}

.add-panel-time-picker-text-placeholder {
  color: #9A9A9A;
}

.add-panel-time-separator {
  font-family: 'Noto Sans SC', sans-serif;
  font-size: 28rpx;
  color: #5A5A5A;
  line-height: 1.4;
  flex-shrink: 0;
}

.add-panel-type-row {
  display: flex;
  flex-wrap: wrap;
  gap: 8rpx;
  box-sizing: border-box;
}

.add-panel-type-chip {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 64rpx;
  padding: 0 16rpx;
  background: #FDFBF7;
  border: 1.5px solid #E8E0D4;
  border-radius: 9999px;
  box-sizing: border-box;
  transition: background 0.15s ease-out, border-color 0.15s ease-out;
}

.add-panel-type-chip-hover {
  transform: scale(0.96);
}

.add-panel-type-chip-selected {
  background: rgba(45, 106, 94, 0.08);
  border-color: #2D6A5E;
}

.add-panel-type-chip-text {
  font-family: 'Noto Sans SC', sans-serif;
  font-size: 24rpx;
  color: #2C2C2C;
  line-height: 1.4;
}

.add-panel-type-chip-text-selected {
  color: #2D6A5E;
  font-weight: 500;
}

.add-panel-actions {
  display: flex;
  gap: 12rpx;
  margin-top: 4rpx;
  box-sizing: border-box;
}

.add-panel-btn {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 72rpx;
  /* 比 88rpx 略低(inline 弹窗场景) */
  border-radius: 9999px;
  box-sizing: border-box;
  transition: opacity 0.15s ease-out, transform 0.15s ease-out;
}

.add-panel-btn-hover {
  transform: scale(0.96);
}

.add-panel-btn-cancel {
  background: #FDFBF7;
  border: 1.5px solid #E8E0D4;
}

.add-panel-btn-cancel-text {
  font-family: 'Noto Sans SC', sans-serif;
  font-size: 28rpx;
  color: #2C2C2C;
  line-height: 1.4;
}

.add-panel-btn-confirm {
  background: linear-gradient(135deg, #2D6A5E 0%, #3D8B7D 100%);
}

.add-panel-btn-confirm-disabled {
  opacity: 0.5;
  pointer-events: none;
}

.add-panel-btn-confirm-text {
  font-family: 'Noto Sans SC', sans-serif;
  font-size: 28rpx;
  font-weight: 600;
  color: #FFFFFF;
  line-height: 1.4;
}
</style>
