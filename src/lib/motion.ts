import type { ObjectDirective } from 'vue'

// Timings/easing shared with CubicLauncher's ModalBase and animateHeight/Width.
export const RESIZE_EASING = 'cubic-bezier(0.25, 0.8, 0.25, 1)'
export const motionDuration = (normal: number) =>
  window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : normal

function sizeDirective(axis: 'height' | 'width'): ObjectDirective<HTMLElement, number> {
  const controllers = new WeakMap<
    HTMLElement,
    { update(duration: number): void; destroy(): void }
  >()
  return {
    mounted(node, binding) {
      const content = node.firstElementChild
      if (!(content instanceof HTMLElement)) return
      const media = window.matchMedia('(prefers-reduced-motion: reduce)')
      const original = node.style[axis]
      let duration = binding.value ?? 300,
        frame = 0,
        animation: Animation | undefined
      let previous = node.getBoundingClientRect()[axis]
      const reset = () => {
        cancelAnimationFrame(frame)
        frame = 0
        animation?.cancel()
        animation = undefined
        node.style[axis] = original
        previous = node.getBoundingClientRect()[axis]
        if (duration && !media.matches && previous > 0) node.style[axis] = `${previous}px`
      }
      const measure = () => {
        frame = 0
        if (!duration || media.matches || !node.isConnected) return
        const rect = content.getBoundingClientRect()
        if (!rect[axis]) return
        const style = getComputedStyle(node)
        const edges =
          axis === 'height'
            ? (['paddingTop', 'paddingBottom', 'borderTopWidth', 'borderBottomWidth'] as const)
            : (['paddingLeft', 'paddingRight', 'borderLeftWidth', 'borderRightWidth'] as const)
        const extra = edges.reduce((sum, key) => sum + (parseFloat(style[key]) || 0), 0)
        const max = parseFloat(axis === 'height' ? style.maxHeight : style.maxWidth)
        const min = parseFloat(axis === 'height' ? style.minHeight : style.minWidth) || 0
        const next = Math.max(
          min,
          Math.min(rect[axis] + extra, Number.isFinite(max) ? max : Infinity),
        )
        if (Math.abs(next - previous) < 0.5) return
        const from = node.getBoundingClientRect()[axis]
        animation?.cancel()
        previous = next
        node.style[axis] = `${next}px`
        if (from > 0 && Math.abs(from - next) >= 0.5) {
          animation = node.animate(
            { [axis]: [`${from}px`, `${next}px`] },
            { duration, easing: RESIZE_EASING },
          )
          animation.onfinish = () => {
            animation = undefined
          }
        }
      }
      const schedule = () => {
        if (!frame) frame = requestAnimationFrame(measure)
      }
      reset()
      const observer = new ResizeObserver(schedule)
      observer.observe(content)
      window.addEventListener('resize', schedule)
      media.addEventListener('change', reset)
      controllers.set(node, {
        update(value) {
          if (duration !== value) {
            duration = value
            reset()
            schedule()
          }
        },
        destroy() {
          observer.disconnect()
          window.removeEventListener('resize', schedule)
          media.removeEventListener('change', reset)
          animation?.cancel()
          cancelAnimationFrame(frame)
          node.style[axis] = original
        },
      })
    },
    updated(node, binding) {
      controllers.get(node)?.update(binding.value ?? 300)
    },
    beforeUnmount(node) {
      controllers.get(node)?.destroy()
      controllers.delete(node)
    },
  }
}

export const vAnimateHeight = sizeDirective('height')
export const vAnimateWidth = sizeDirective('width')
const fades = new WeakMap<HTMLElement, Animation>()
export const vFadeChange: ObjectDirective<HTMLElement, unknown> = {
  updated(node, binding) {
    if (binding.value === binding.oldValue) return
    fades.get(node)?.cancel()
    const duration = motionDuration(180)
    if (duration)
      fades.set(node, node.animate({ opacity: [0, 1] }, { duration, easing: 'ease-out' }))
  },
  beforeUnmount(node) {
    fades.get(node)?.cancel()
    fades.delete(node)
  },
}
