<!--
  InterestGrid.vue — 可复用多选网格
  
  Spec contract: specs/OnboardingPage.md §8.1
  
  Props
    modelValue : Interest[]   v-model,多选
    options    : Array<{ value, label, emoji? }>   默认 5 项,与后端 Interest 枚举 1:1
    min        : number       最少选择数(默认 1)
    max        : number       最多选择数(默认 5,与后端 interests 数组上限对齐)
  
  Emits
    update:modelValue : Interest[]                v-model
    change            : { value, selected }
  
  Slots
    cell-{value}      : { option, selected }     自定义某一项的渲染
-->
<template>
  <view class="interest-grid">
    <view
      v-for="option in options"
      :key="option.value"
      class="cell"
      :class="{ 'cell-selected': isSelected(option.value) }"
      :aria-pressed="isSelected(option.value)"
      :data-value="option.value"
      role="button"
      hover-class="cell-hover"
      :hover-stay-time="50"
      @click="onToggle(option)"
    >
      <slot
        :name="`cell-${option.value}`"
        :option="option"
        :selected="isSelected(option.value)"
      >
        <view class="cell-content">
          <text v-if="option.emoji" class="cell-emoji">{{ option.emoji }}</text>
          <text class="cell-label">{{ option.label }}</text>
        </view>
      </slot>
    </view>
  </view>
</template>

<script setup>
import { OnboardingInterestOptions } from '../constants/strings.js'

const props = defineProps({
  /** @type {import('vue').PropType<Array<import('../api/types').Interest>>} */
  modelValue: {
    type: Array,
    required: true,
  },
  /** @type {import('vue').PropType<Array<{ value: string, label: string, emoji?: string }>>} */
  options: {
    type: Array,
    default: () => OnboardingInterestOptions,
  },
  min: {
    type: Number,
    default: 1,
  },
  max: {
    type: Number,
    default: 5,
  },
})

const emit = defineEmits(['update:modelValue', 'change'])

function isSelected(value) {
  return Array.isArray(props.modelValue) && props.modelValue.includes(value)
}

function onToggle(option) {
  const currentlySelected = isSelected(option.value)
  let next

  if (currentlySelected) {
    // 已经选中 → 取消;但若已达 min,本次不响应(AC-04 同源:不允许 0 选)
    if (props.modelValue.length <= props.min) return
    next = props.modelValue.filter((v) => v !== option.value)
  } else {
    // 未选中 → 选中;若已达 max,本次不响应
    if (props.modelValue.length >= props.max) return
    next = [...props.modelValue, option.value]
  }

  emit('update:modelValue', next)
  emit('change', { value: option.value, selected: !currentlySelected })
}
</script>

<style scoped>
.interest-grid {
  display: grid;
  grid-template-columns: repeat(6, 1fr);
  /* 6 列,行 1 三项各 span 2,行 2 两项各 span 3 → 末行 2 项自然居中 */
  gap: 24rpx;
  /* space-lg */
}

.cell {
  grid-column: span 2;
  /* 行 1:每项占 2/6 = 1/3 宽度;行 2 (4/5) 通过 :nth-child 改为 span 3 */
  background: #F2EBE0;
  /* Surface Warm */
  border: 1.5rpx solid rgba(45, 106, 94, 0.06);
  /* borderSubtle */
  border-radius: 16px;
  /* radius-lg */
  padding: 32rpx 16rpx;
  /* 满足 ≥ 44pt tap area(88rpx) */
  min-height: 88rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  box-sizing: border-box;
  transition: background 0.2s ease-out, border-color 0.2s ease-out, transform 0.15s ease-out;
}

.cell-hover {
  transform: scale(0.96);
  /* UI 风格定义 §七:按钮按下 scale 0.96 */
}

.cell:nth-child(4),
.cell:nth-child(5) {
  /* 5 项布局的末行 2 项各 span 3 列(占第 1-3 / 4-6 列),自然居中 */
  grid-column: span 3;
}

.cell-selected {
  background: rgba(45, 106, 94, 0.12);
  /* Primary Soft Strong */
  border-color: #2D6A5E;
  /* Primary */
  border-width: 1.5rpx;
  border-style: solid;
}

.cell-content {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 12rpx;
}

.cell-emoji {
  font-size: 48rpx;
  line-height: 1;
  /* 24px */
}

.cell-label {
  font-family: 'Noto Sans SC', sans-serif;
  font-size: 26rpx;
  /* 13px */
  color: #2C2C2C;
  /* ink */
  font-weight: 500;
  line-height: 1.3;
  text-align: center;
}

.cell-selected .cell-label {
  color: #1D4A3E;
  /* Primary Dark */
  font-weight: 600;
}
</style>
