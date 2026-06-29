<!--
  SpecialNeedChipGroup.vue — 页面私有多选 chip 组(特殊需求 3 选 N,可空数组)

  Spec contract: specs/PersonalProfilePage.md §8.6(v0.2.0 新增)
  Source template: 同目录 GenderChipGroup.vue(单选形态,但本组件**多选**,
                  与 components/InterestGrid.vue 多选 grid 形态独立 — 本组件是行内 chips 多选)

  Props
    modelValue : 'less_walking' | 'less_queue' | 'accessible'[]   v-model,多选(3 选 N);[] = 全空
    options    : Array<{ value, label }>                          默认 3 项,PersonalProfileSpecialNeedOptions
    disabled   : boolean                                          是否禁用整组(本页面**不**用)
    min        : number                                           最少选择数(默认 0,允许空数组)
    max        : number                                           最多选择数(默认 3,与后端 special_needs 数组上限对齐)

  Emits
    update:modelValue : SpecialNeed[]                v-model
    change            : { value, selected }

  Slots
    chip-{value}      : { option, selected }                  自定义 chip 渲染

  视觉:
    - 与 GenderChipGroup 完全一致(沿 §3.1 单选 chip 配色,1.5px 描边,88rpx = 44pt 触达)
    - 未选:surfaceWarm 填充 + divider 描边 + ink 文字
    - 选中:primarySoft 填充 + primary 描边 + primary 文字(可多选叠加)
    - min-height: 88rpx = 44pt 触达(NFR)

  备注:
    - 本组件**仅** PersonalProfilePage 使用(无跨页复用场景)
    - MVP 阶段**不**抽公共 _ChipGroup.vue(per §3.6 R-1 + §8.8 bug 2 修复命名)
    - 与 InterestGrid.vue 形态独立:本组件是行内 chips 多选(沿 GenderChipGroup 模板),
      InterestGrid 是 grid 多选;两者视觉风格统一但 layout 不同
    - 「可选」语义通过允许空数组 + 段 5 不显 _RequiredMark 表达(per spec §5.1)
-->
<template>
  <view class="special-need-chip-group" :aria-disabled="disabled || undefined">
    <view
      v-for="option in options"
      :key="option.value"
      class="chip"
      :class="{ 'chip-selected': isSelected(option.value), 'chip-disabled': disabled }"
      :aria-pressed="isSelected(option.value)"
      :aria-label="option.label"
      :data-value="option.value"
      role="button"
      :hover-stay-time="50"
      hover-class="chip-hover"
      @click="onToggle(option)"
    >
      <slot
        :name="`chip-${option.value}`"
        :option="option"
        :selected="isSelected(option.value)"
      >
        <text
          class="chip-text"
          :class="{ 'chip-text-selected': isSelected(option.value) }"
        >{{ option.label }}</text>
      </slot>
    </view>
  </view>
</template>

<script setup>
import { PersonalProfileSpecialNeedOptions } from '../../../constants/strings.js'

const props = defineProps({
  /** @type {import('vue').PropType<Array<'less_walking' | 'less_queue' | 'accessible'>>} */
  modelValue: {
    type: Array,
    default: () => [],
    validator: (v) => Array.isArray(v)
      && v.every((x) => x === 'less_walking' || x === 'less_queue' || x === 'accessible'),
  },
  /** @type {import('vue').PropType<Array<{ value: string, label: string }>>} */
  options: {
    type: Array,
    default: () => PersonalProfileSpecialNeedOptions,
  },
  disabled: {
    type: Boolean,
    default: false,
  },
  min: {
    type: Number,
    default: 0,
  },
  max: {
    type: Number,
    default: 3,
  },
})

const emit = defineEmits(['update:modelValue', 'change'])

function isSelected(value) {
  return Array.isArray(props.modelValue) && props.modelValue.includes(value)
}

/**
 * 多选切换:点击已选项 → 移除(filter);点击未选项 → 追加(concat)
 * spec §5.1 + AC-16 显式允许空数组(可空语义,per 「可多选(可选)」)
 * @param {{ value: 'less_walking' | 'less_queue' | 'accessible', label: string }} option
 */
function onToggle(option) {
  if (props.disabled) return
  const currentlySelected = isSelected(option.value)
  let next

  if (currentlySelected) {
    // 已选中 → 移除;若已达 min,本次不响应(per min=0 默认值,允许降到 0)
    if (props.modelValue.length <= props.min) return
    next = props.modelValue.filter((v) => v !== option.value)
  } else {
    // 未选中 → 追加;若已达 max,本次不响应
    if (props.modelValue.length >= props.max) return
    next = [...props.modelValue, option.value]
  }

  emit('update:modelValue', next)
  emit('change', { value: option.value, selected: !currentlySelected })
}
</script>

<style scoped>
.special-need-chip-group {
  display: flex;
  flex-wrap: wrap;
  gap: 16rpx;
  /* space-md,chip 间 16rpx(spec §3.3 段 5) */
  box-sizing: border-box;
}

.chip {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 88rpx;
  /* ≥ 44pt tap area(spec §10 NFR) */
  padding: 0 24rpx;
  background: #F2EBE0;
  /* surfaceWarm(未选) */
  border: 1.5px solid #E8E0D4;
  /* divider(未选) */
  border-radius: 9999px;
  /* radius-full */
  box-sizing: border-box;
  transition: background 0.15s ease-out, border-color 0.15s ease-out, transform 0.15s ease-out;
}

.chip-hover {
  transform: scale(0.96);
}

.chip-selected {
  background: rgba(45, 106, 94, 0.08);
  /* primarySoft(选中) */
  border-color: #2D6A5E;
  /* primary(选中) */
}

.chip-disabled {
  opacity: 0.5;
  pointer-events: none;
}

.chip-text {
  font-family: 'Noto Sans SC', sans-serif;
  font-size: 28rpx;
  /* 14px */
  color: #2C2C2C;
  /* ink(未选) */
  line-height: 1.4;
  font-weight: 500;
}

.chip-text-selected {
  color: #2D6A5E;
  /* primary(选中) */
  font-weight: 600;
}
</style>