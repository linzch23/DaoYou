<!--
  AgeChipGroup.vue — 页面私有单选 chip 组(年龄段 5 选 1,下划线前缀 = private,见 Code Style §3.4)
  
  Spec contract: specs/PersonalProfilePage.md §8.4
  
  Props
    modelValue : 'under_18' | '18_24' | '25_34' | '35_44' | '45_plus' | null   v-model,单选(5 选 1);null = 未选
    options    : Array<{ value, label }>              默认 5 项,PersonalProfileAgeOptions
    disabled   : boolean                              是否禁用整组(本页面**不**用)
  
  Emits
    update:modelValue : ... | null   v-model
    change            : { value, selected }
  
  Slots
    chip-{value}      : { option, selected }   自定义 chip 渲染
  
  视觉:与 _GenderChipGroup 完全一致(沿用 §3.1 单选 chip 配色,1.5px 描边,88rpx = 44pt 触达)
  目的:arch 软观察 #5「年龄段 vs 性别 chip 视觉对齐」- 共用同一套 CSS 变量 / 形态
  
  备注:
    - 本组件**仅** PersonalProfilePage 使用(无跨页复用场景)
    - MVP 阶段**不**抽公共 _ChipGroup.vue(per §3.6 R-1 + arch 软观察 #5)
    - 必填标红 _RequiredMark 放在组件**外部**(在 _Section2_AgeRange 父级控制)
-->
<template>
  <view class="age-chip-group" :aria-disabled="disabled || undefined">
    <view
      v-for="option in options"
      :key="option.value"
      class="chip"
      :class="{ 'chip-selected': modelValue === option.value, 'chip-disabled': disabled }"
      :aria-pressed="modelValue === option.value"
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
        :selected="modelValue === option.value"
      >
        <text
          class="chip-text"
          :class="{ 'chip-text-selected': modelValue === option.value }"
        >{{ option.label }}</text>
      </slot>
    </view>
  </view>
</template>

<script setup>
import { PersonalProfileAgeOptions } from '../../../constants/strings.js'

const props = defineProps({
  /** @type {import('vue').PropType<'under_18' | '18_24' | '25_34' | '35_44' | '45_plus' | null>} */
  modelValue: {
    type: String,
    default: null,
    validator: (v) => v === null
      || v === 'under_18' || v === '18_24' || v === '25_34' || v === '35_44' || v === '45_plus',
  },
  /** @type {import('vue').PropType<Array<{ value: string, label: string }>>} */
  options: {
    type: Array,
    default: () => PersonalProfileAgeOptions,
  },
  disabled: {
    type: Boolean,
    default: false,
  },
})

const emit = defineEmits(['update:modelValue', 'change'])

/**
 * 单选切换:点击当前选中项 → 取消(modelValue=null);点击其它项 → 切到新值
 * @param {{ value: 'under_18' | '18_24' | '25_34' | '35_44' | '45_plus', label: string }} option
 */
function onToggle(option) {
  if (props.disabled) return
  const currentlySelected = props.modelValue === option.value
  const next = currentlySelected ? null : option.value
  emit('update:modelValue', next)
  emit('change', { value: option.value, selected: !currentlySelected })
}
</script>

<style scoped>
.age-chip-group {
  display: flex;
  flex-wrap: wrap;
  gap: 16rpx;
  /* space-md,chip 间 16rpx(spec §3.3 段 2) */
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
