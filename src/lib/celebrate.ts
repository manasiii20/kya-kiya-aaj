import confetti from 'canvas-confetti'
import { STICKY_COLORS } from './db'

const COLORS = [...STICKY_COLORS, '#2b20e0']

function originOf(el?: Element | null) {
  if (!el) return { x: 0.5, y: 0.5 }
  const r = el.getBoundingClientRect()
  return { x: (r.left + r.width / 2) / innerWidth, y: (r.top + r.height / 2) / innerHeight }
}

export function buzz(pattern: number | number[] = 12) {
  // Android only; iOS browsers ignore vibration.
  if ('vibrate' in navigator) navigator.vibrate(pattern)
}

// Small pop from wherever the tick happened.
export function pop(el?: Element | null) {
  buzz()
  void confetti({
    particleCount: 28,
    spread: 70,
    startVelocity: 22,
    gravity: 0.9,
    ticks: 90,
    scalar: 0.75,
    shapes: ['square', 'circle'],
    colors: COLORS,
    origin: originOf(el),
    disableForReducedMotion: true,
  })
}

// Bigger moment, e.g. finishing a review.
export function shower() {
  buzz([10, 40, 10])
  const base = { spread: 80, startVelocity: 38, ticks: 160, scalar: 0.9, colors: COLORS, disableForReducedMotion: true }
  void confetti({ ...base, particleCount: 70, angle: 60, origin: { x: 0, y: 0.75 } })
  void confetti({ ...base, particleCount: 70, angle: 120, origin: { x: 1, y: 0.75 } })
}
