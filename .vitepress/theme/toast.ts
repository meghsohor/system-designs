import { shallowRef } from 'vue'

export interface Toast {
  message: string
  action?: { label: string; run: () => void }
  /** Milliseconds before it hides on its own; hovering or focusing it pauses that. */
  duration: number
  /** Move keyboard focus to the action, e.g. when the button that caused it has disappeared. */
  focusAction?: boolean
  id: number
}

let next = 0
/** The one toast on screen. `ToastMessage.vue` shows it; anything can replace it. */
export const currentToast = shallowRef<Toast>()

export function showToast(toast: Omit<Toast, 'id' | 'duration'> & { duration?: number }) {
  currentToast.value = { duration: 5000, ...toast, id: ++next }
}

export function hideToast() {
  currentToast.value = undefined
}
