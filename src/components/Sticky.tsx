import { AnimatePresence, motion } from 'framer-motion'
import { PenLine } from 'lucide-react'
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
      {visible.length === 0 && <EmptyPile size={size} pad={pad} />}
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

// Before anything is done: a blank cream note taped down, waiting for the first one.
function EmptyPile({ size, pad }: { size: number; pad: number }) {
  const big = size >= 120
  return (
    <div style={{ position: 'absolute', left: pad, bottom: 0, transform: 'rotate(-2deg)' }}>
      <Sticky color="#fbf8f1" size={size} style={{ padding: big ? 16 : 0, boxShadow: '0 0 0 1px rgba(0,0,0,.05), 0 6px 12px -8px rgba(40,30,0,.25)' }}>
        {big ? (
          <div className="note-text" style={{ fontSize: Math.max(12, size / 10), color: 'rgba(43,40,34,.45)', marginTop: size * 0.16 }}>
            Your pile starts here
          </div>
        ) : (
          <div style={{ display: 'grid', placeItems: 'center', height: '100%', color: 'rgba(43,40,34,.28)' }}>
            <PenLine size={size * 0.3} strokeWidth={1.6} />
          </div>
        )}
      </Sticky>
      <div
        aria-hidden
        style={{
          position: 'absolute',
          top: -size * 0.07,
          left: '50%',
          width: size * 0.42,
          height: size * 0.16,
          transform: 'translateX(-50%) rotate(4deg)',
          background: 'repeating-linear-gradient(90deg, rgba(185,215,255,.75) 0 6px, rgba(185,215,255,.55) 6px 12px)',
          boxShadow: '0 1px 2px rgba(0,0,0,.06)',
          borderRadius: 1,
        }}
      />
    </div>
  )
}

// A star sticker: yellow star, thick white die-cut border, soft shadow like it's stuck on.
export function StarSticker({ size = 16, rotate = 0, off = false }: { size?: number; rotate?: number; off?: boolean }) {
  const border = Math.max(1.6, size * 0.14)
  return (
    <svg
      width={size}
      height={size}
      viewBox="-2 -2 28 28"
      aria-hidden
      style={{
        transform: `rotate(${rotate}deg)`,
        filter: off ? 'grayscale(1) opacity(.35)' : 'drop-shadow(0 1px 1.2px rgba(60,40,0,.28))',
        overflow: 'visible',
        flex: 'none',
      }}
    >
      <path
        d="M12 1.8l3.1 6.6 7.2.9-5.3 5 1.4 7.1L12 17.9l-6.4 3.5 1.4-7.1-5.3-5 7.2-.9z"
        fill="#ffcf33"
        stroke="#fff"
        strokeWidth={border * (24 / size)}
        strokeLinejoin="round"
        paintOrder="stroke"
      />
    </svg>
  )
}

// Priority as a few stuck-on stars. 0 shows nothing.
export function Stars({ n, size = 19 }: { n?: number; size?: number }) {
  if (!n) return null
  return (
    <span className="stars" aria-label={`priority ${n} of 3`}>
      {Array.from({ length: n }, (_, i) => (
        <StarSticker key={i} size={size} rotate={[-12, 8, -4][i]} />
      ))}
    </span>
  )
}
