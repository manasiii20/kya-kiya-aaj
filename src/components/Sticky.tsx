import { motion, AnimatePresence } from 'framer-motion'
import type { CSSProperties, ReactNode } from 'react'

// Stable pseudo-random tilt per id so a note always sits the same way.
export function tilt(id: string, range = 6): number {
  let h = 0
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) | 0
  return ((Math.abs(h) % 1000) / 1000 - 0.5) * 2 * range
}

export function Sticky({
  color,
  text,
  size,
  fontSize,
  rotate = 0,
  style,
  children,
}: {
  color: string
  text?: string
  size?: number
  fontSize?: number
  rotate?: number
  style?: CSSProperties
  children?: ReactNode
}) {
  return (
    <div
      className="sticky"
      style={{
        background: color,
        width: size,
        height: size,
        aspectRatio: size ? undefined : '1',
        transform: `rotate(${rotate}deg)`,
        padding: size && size < 60 ? 0 : 12,
        ...style,
      }}
    >
      {text && (
        <div className="txt" style={{ fontSize: fontSize ?? 22 }}>
          {text}
        </div>
      )}
      {children}
    </div>
  )
}

export type StackItem = { id: string; color: string; title?: string }

// A pile of done things. Newest on top; older ones peek out underneath.
export function StickyStack({
  items,
  size,
  step = 5,
  max = 10,
  showText = false,
}: {
  items: StackItem[]
  size: number
  step?: number
  max?: number
  showText?: boolean
}) {
  const visible = items.slice(-max)
  const height = size + Math.max(0, visible.length - 1) * step
  return (
    <div style={{ position: 'relative', width: size * 1.15, height: Math.max(height, size) + size * 0.08, flex: 'none' }}>
      {visible.length === 0 && (
        <div
          style={{
            position: 'absolute',
            left: size * 0.075,
            bottom: 0,
            width: size,
            height: size,
            borderRadius: '6px 6px 18px 6px',
            border: '2px dashed var(--line)',
          }}
        />
      )}
      <AnimatePresence initial={false}>
        {visible.map((it, i) => {
          const isTop = i === visible.length - 1
          return (
            <motion.div
              key={it.id}
              initial={{ y: -size * 0.9, opacity: 0, scale: 1.2, rotate: tilt(it.id, 9) + 14 }}
              animate={{ y: 0, opacity: 1, scale: 1, rotate: isTop ? tilt(it.id, 4) : tilt(it.id, 9) }}
              exit={{ opacity: 0, scale: 0.8 }}
              transition={{ type: 'spring', stiffness: 420, damping: 18 }}
              style={{ position: 'absolute', left: size * 0.075 + (isTop ? 0 : tilt(it.id + 'x', size * 0.07)), bottom: i * step, zIndex: i }}
            >
              <Sticky
                color={it.color}
                size={size}
                text={showText && isTop ? it.title : undefined}
                fontSize={Math.max(14, size / 5.5)}
                style={{ boxShadow: size < 50 ? '0 1px 2px rgba(0,0,0,.12)' : undefined }}
              />
            </motion.div>
          )
        })}
      </AnimatePresence>
    </div>
  )
}
