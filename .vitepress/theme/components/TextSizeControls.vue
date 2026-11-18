<script setup lang="ts">
import { onMounted } from 'vue'
import { useTextSize } from '../text-size.ts'

defineProps<{ labelId: string }>()
const { percent, load, smallest, largest, isDefault, smaller, larger, reset } = useTextSize()
onMounted(load)
</script>

<template>
  <div class="controls">
    <p :id="labelId" class="label">Text size</p>
    <div class="steps">
      <button
        type="button"
        class="step"
        aria-label="Smaller text"
        :disabled="smallest"
        @click="smaller"
      >
        A−
      </button>
      <output class="value" :aria-labelledby="labelId" aria-live="polite">{{ percent }}</output>
      <button
        type="button"
        class="step large"
        aria-label="Larger text"
        :disabled="largest"
        @click="larger"
      >
        A+
      </button>
    </div>
    <button type="button" class="reset" :disabled="isDefault" @click="reset">Reset</button>
  </div>
</template>

<style scoped>
.label {
  margin: 0 0 8px;
  font-size: 13px;
  font-weight: 600;
  color: var(--vp-c-text-2);
}

.steps {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.step,
.reset {
  min-height: 44px;
  border-radius: 8px;
  background: var(--vp-c-default-soft);
  color: var(--vp-c-text-1);
  font-weight: 600;
}

.step {
  width: 52px;
  font-size: 14px;
}

.step.large {
  font-size: 18px;
}

.value {
  font-variant-numeric: tabular-nums;
  font-weight: 600;
}

.reset {
  width: 100%;
  margin-top: 8px;
  font-size: 14px;
}

.step:hover:not(:disabled),
.reset:hover:not(:disabled) {
  background: var(--vp-c-default-2);
}

.step:disabled,
.reset:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.step:focus-visible,
.reset:focus-visible {
  outline: 2px solid var(--vp-c-brand-1);
  outline-offset: 2px;
}
</style>
