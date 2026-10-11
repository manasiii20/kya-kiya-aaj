import { AnimatePresence, motion } from 'framer-motion'
import type { CSSProperties, ReactNode } from 'react'

// Stable pseudo-random value in [-range, range] per id, so a note always sits the same way.
export function tilt(id: string, range = 2): number {
  let h = 0
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) | 0
  return ((Math.abs(h) % 1000) / 1000 - 0.5) * 2 * range
}

export function Sticky({
  color,
  text,
  size,
  fontSize = 15,
  rotate = 0,
  className = '',
  style,
  children,
}: {
  color: string
  text?: string
  size?: number
  fontSize?: number
  rotate?: number
  className?: string
  style?: CSSProperties
  children?: ReactNode
}) {
  return (
    <div
      className={`sticky ${className}`}
      style={{
        backgroundColor: color,
        width: size,
        height: size,
        aspectRatio: size ? undefined : '1',
        transform: rotate ? `rotate(${rotate}deg)` : undefined,
        padding: size && size < 60 ? 0 : 14,
        ...style,
      }}
    >
      {text && (
        <div className="note-text" style={{ fontSize }}>
          {text}
        </div>
      )}
      {children}
    </div>
  )
}

export type StackItem = { id: string; color: string; title?: string }

// A neat pile of done notes: same footprint, a hair of rotation each, the edges of the
// older ones showing underneath like a real pad. Newest on top.
export function StickyStack({
  items,
  size,
  max = 8,
  showText = false,
}: {
  items: StackItem[]
  size: number
  max?: number
  showText?: boolean
}) {
  const visible = items.slice(-max)
  const step = Math.max(1.5, size * 0.035)
  const lift = Math.max(0, visible.length - 1) * step
  const small = size < 50
  return (
    <div style={{ position: 'relative', width: size, height: size + lift, flex: 'none' }}>
      {visible.length === 0 && (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            borderRadius: 5,
            border: '1.5px dashed var(--ink-faint)',
            opacity: 0.6,
          }}
        />
      )}
      <AnimatePresence initial={false}>
        {visible.map((it, i) => {
          const depth = visible.length - 1 - i
          const isTop = depth === 0
          const rotate = isTop ? tilt(it.id, 1.2) : tilt(it.id, 2.6)
          return (
            <motion.div
              key={it.id}
              initial={{ y: -size * 0.5, opacity: 0, scale: 1.06, rotate: rotate + 4 }}
              animate={{ y: 0, opacity: 1, scale: 1, rotate }}
              exit={{ opacity: 0 }}
              transition={{ type: 'spring', stiffness: 320, damping: 26 }}
              style={{ position: 'absolute', left: 0, bottom: i * step, zIndex: i }}
            >
              <Sticky
                color={it.color}
                size={size}
                text={showText && isTop ? it.title : undefined}
                fontSize={Math.max(11, size / 8)}
                style={{
                  filter: depth ? `brightness(${1 - Math.min(depth, 6) * 0.018})` : undefined,
                  boxShadow: small ? '0 0.5px 1px rgba(0,0,0,.18)' : undefined,
                  overflow: 'hidden',
                }}
              />
            </motion.div>
          )
        })}
      </AnimatePresence>
    </div>
  )
}
