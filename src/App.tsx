import { AnimatePresence, motion } from 'framer-motion'
import { Plus } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Sticky } from './components/Sticky'
import { TaskSheet } from './components/TaskSheet'
import { todayKey } from './lib/dates'
import type { SelfNote } from './lib/db'
import { noteOnOpen, onSelfNote } from './lib/selfNotes'
import { Calendar } from './screens/Calendar'
import { Review } from './screens/Review'
import { Today } from './screens/Today'

type Screen = 'wall' | 'swipe' | null

const slideIn = {
  initial: { x: '100%' },
  animate: { x: 0 },
  exit: { x: '100%' },
  transition: { type: 'spring', stiffness: 360, damping: 38 },
} as const

export function App() {
  const [day, setDay] = useState(todayKey())
  const [adding, setAdding] = useState(false)
  const [screen, setScreen] = useState<Screen>(null)
  const [note, setNote] = useState<SelfNote | null>(null)
  const [slot, setSlot] = useState<HTMLDivElement | null>(null)

  useEffect(() => {
    onSelfNote(setNote)
    const t = window.setTimeout(() => void noteOnOpen(), 900)
    const onVisible = () => {
      if (document.visibilityState !== 'visible') return
      void noteOnOpen()
      // Coming back the next morning lands on the new day.
      setDay(todayKey())
    }
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      clearTimeout(t)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [])

  return (
    <div className="app">
      <Today day={day} onWall={() => setScreen('wall')} dockSlot={slot} />

      <div className="dock" style={{ bottom: 'calc(var(--dock-bottom) + 70px)' }} ref={setSlot} />
      <div className="dock">
        <motion.button className="swipe-btn" whileTap={{ scale: 0.95 }} onClick={() => setScreen('swipe')}>
          <SwipeIcon />
          Swipe your list
        </motion.button>
        <motion.button className="fab" aria-label="add a task" whileTap={{ scale: 0.9 }} onClick={() => setAdding(true)}>
          <Plus size={26} />
        </motion.button>
      </div>

      <TaskSheet open={adding} onClose={() => setAdding(false)} />

      <AnimatePresence>
        {screen && (
          <motion.div key={screen} className="overlay" {...slideIn}>
            {screen === 'wall' ? <Calendar onBack={() => setScreen(null)} /> : <Review onBack={() => setScreen(null)} />}
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {note && (
          <>
            <motion.div
              className="scrim"
              style={{ zIndex: 49 }}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setNote(null)}
            />
            <motion.button
              className="note-from-you"
              style={{ x: '-50%', y: '-50%' }}
              initial={{ scale: 1.15, opacity: 0, rotate: 5 }}
              animate={{ scale: 1, opacity: 1, rotate: -1.5 }}
              exit={{ scale: 0.92, opacity: 0 }}
              transition={{ type: 'spring', stiffness: 300, damping: 24 }}
              onClick={() => setNote(null)}
            >
              <Sticky color={note.color} style={{ padding: 22 }}>
                <div className="from">A note from you</div>
                <div className="note-text" style={{ fontSize: 20 }}>
                  {note.text}
                </div>
              </Sticky>
              <div style={{ color: '#fff', fontSize: 13, fontWeight: 600, marginTop: 16, textAlign: 'center' }}>
                Tap to keep going
              </div>
            </motion.button>
          </>
        )}
      </AnimatePresence>
    </div>
  )
}

// A tiny fanned hand of stickies, like cards about to be swiped.
function SwipeIcon() {
  const note = (fill: string, rotate: number, x: number) => (
    <rect x={10 + x} y="9" width="14" height="14" rx="2" fill={fill} transform={`rotate(${rotate} ${17 + x} 24)`} />
  )
  return (
    <svg className="ico" width="34" height="34" viewBox="0 0 34 34" aria-hidden>
      <g style={{ filter: 'drop-shadow(0 1px 1px rgba(40,30,0,.22))' }}>
        {note('#b9d7ff', -26, -2)}
        {note('#ffc6c2', 24, 2)}
        {note('#ffe08a', -1, 0)}
      </g>
    </svg>
  )
}
