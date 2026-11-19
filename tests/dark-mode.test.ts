import { describe, expect, it } from 'vitest'
import { darkModeFallbackScript } from '../.vitepress/lib/dark-mode.ts'

describe('darkModeFallbackScript', () => {
  // Runs the <head> script against a fake page and returns the classes it added to <html>.
  const run = (storageBlocked: boolean, deviceDark: boolean) => {
    const added: string[] = []
    const window = {
      get localStorage() {
        if (storageBlocked) throw new Error('blocked')
        return { length: 0 }
      },
    }
    const document = { documentElement: { classList: { add: (c: string) => added.push(c) } } }
    const matchMedia = () => ({ matches: deviceDark })
    new Function('window', 'document', 'matchMedia', `with (window) {${darkModeFallbackScript()}}`)(
      window,
      document,
      matchMedia,
    )
    return added
  }

  it('applies the device setting when storage is blocked', () => {
    expect(run(true, true)).toEqual(['dark'])
    expect(run(true, false)).toEqual([])
  })

  it('leaves the theme to VitePress when storage works', () => {
    expect(run(false, true)).toEqual([])
  })
})
