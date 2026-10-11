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

// A pile of done notes, the way paper actually lands: each one a little off to the left or
// right and turned a few degrees, the older ones peeking out from under the newest.
export function stackPad(size: number) {
  return size * 0.12
}

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
  const step = Math.max(1.5, size * 0.03)
  const lift = Math.max(0, visible.length - 1) * step
  const pad = stackPad(size)
  const small = size < 50
  return (
    <div style={{ position: 'relative', width: size + pad * 2, height: size + lift + pad * 0.6, flex: 'none' }}>
      {visible.length === 0 && (
        <div
          style={{
            position: 'absolute',
            left: pad,
            bottom: 0,
            width: size,
            height: size,
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
          // Alternate sides so the pile zig-zags instead of leaning one way.
          const side = i % 2 === 0 ? 1 : -1
          const x = isTop ? tilt(it.id + 'x', size * 0.025) : side * (size * 0.05 + Math.abs(tilt(it.id + 'x', size * 0.05)))
          const rotate = isTop ? tilt(it.id, 2) : side * (1.5 + Math.abs(tilt(it.id, 3.5)))
          return (
            <motion.div
              key={it.id}
              initial={{ y: -size * 0.5, opacity: 0, scale: 1.06, rotate: rotate + 5, x }}
              animate={{ y: 0, opacity: 1, scale: 1, rotate, x }}
              exit={{ opacity: 0 }}
              transition={{ type: 'spring', stiffness: 320, damping: 26 }}
              style={{ position: 'absolute', left: pad, bottom: i * step, zIndex: i }}
            >
              <Sticky
                color={it.color}
                size={size}
                text={showText && isTop ? it.title : undefined}
                fontSize={Math.max(11, size / 8)}
                style={{
                  filter: depth ? `brightness(${1 - Math.min(depth, 6) * 0.015})` : undefined,
                  boxShadow: small ? '0 0.5px 1.5px rgba(0,0,0,.2)' : undefined,
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
