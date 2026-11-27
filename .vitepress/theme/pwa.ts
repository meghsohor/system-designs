import { ref, watch } from 'vue'
import { currentToast, showToast } from './toast.ts'

/** True once a service worker is in charge, so every page also opens offline. */
export const availableOffline = ref(false)

const HOUR = 60 * 60 * 1000
let started = false

export async function initPwa() {
  if (started) return
  started = true
  let container: ServiceWorkerContainer | undefined
  try {
    // Firefox throws here when cookies are blocked.
    container = navigator.serviceWorker
  } catch {
    return
  }
  if (!container) return
  const sw = container
  const sync = () => (availableOffline.value ||= Boolean(sw.controller))
  sync()
  sw.addEventListener('controllerchange', sync)

  const { registerSW } = await import('virtual:pwa-register')
  let pending = false
  let updateToast: number | undefined
  const queue: (() => void)[] = []

  // An Undo or resume message on screen goes first; ours show once it has gone.
  function whenFree(show: () => void) {
    if (currentToast.value) queue.push(show)
    else show()
  }

  watch(currentToast, (toast, previous) => {
    // The update offer was pushed aside by another message: offer it again after that one.
    if (toast && pending && previous?.id === updateToast) queue.push(offerUpdate)
    else if (!toast) queue.shift()?.()
  })

  function offerUpdate() {
    whenFree(() => {
      showToast({
        message: 'New version available',
        action: { label: 'Reload', run: () => void reload() },
        duration: Infinity,
      })
      updateToast = currentToast.value?.id
    })
  }

  // The library reloads only tabs that had a service worker when they opened, so reload here.
  async function reload() {
    pending = false
    const registration = await sw.getRegistration()
    if (!registration?.waiting) return location.reload()
    sw.addEventListener('controllerchange', () => location.reload(), { once: true })
    await updateSW()
  }

  const updateSW = registerSW({
    immediate: true,
    onOfflineReady() {
      whenFree(() =>
        showToast({ message: 'Ready to work offline. Every page is saved on this device.' }),
      )
    },
    onNeedRefresh() {
      pending = true
      offerUpdate()
    },
    onRegisteredSW(_url, registration) {
      if (!registration) return
      // After a hard reload the page isn't controlled, but the next one opens offline.
      if (registration.active) availableOffline.value = true
      // Moving between pages never reloads the document, so updates are looked for here.
      const check = () => {
        if (pending) {
          if (!currentToast.value) offerUpdate()
          return
        }
        if (navigator.onLine) registration.update().catch(() => {})
      }
      setInterval(check, HOUR)
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') check()
      })
    },
  })
}
