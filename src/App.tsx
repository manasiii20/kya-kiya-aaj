import { AnimatePresence, motion } from 'framer-motion'
import { Layers, NotebookPen, Plus } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Sticky } from './components/Sticky'
import { TaskSheet } from './components/TaskSheet'
import { todayKey } from './lib/dates'
import type { SelfNote } from './lib/db'
import { noteOnOpen, onSelfNote } from './lib/selfNotes'
import { Calendar } from './screens/Calendar'
import { Review } from './screens/Review'
import { Today } from './screens/Today'

type Tab = 'today' | 'review'

const TABS: { id: Tab; label: string; icon: typeof Layers }[] = [
  { id: 'today', label: 'tasks', icon: NotebookPen },
  { id: 'review', label: 'review', icon: Layers },
]

export function App() {
  const [tab, setTab] = useState<Tab>('today')
  const [day, setDay] = useState(todayKey())
  const [reviewDay, setReviewDay] = useState<{ day: string; n: number } | undefined>()
  const [adding, setAdding] = useState(false)
  const [wall, setWall] = useState(false)
  const [note, setNote] = useState<SelfNote | null>(null)
  const [slot, setSlot] = useState<HTMLDivElement | null>(null)

  useEffect(() => {
    onSelfNote(setNote)
    const t = window.setTimeout(() => void noteOnOpen(), 900)
    const onVisible = () => {
      if (document.visibilityState !== 'visible') return
      void noteOnOpen()
      // Coming back the next morning should land on the new day.
      setDay((d) => (d < todayKey() ? todayKey() : d))
    }
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      clearTimeout(t)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [])

  return (
    <div className="app">
      <AnimatePresence mode="wait" initial={false}>
        <motion.main
          key={tab}
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -6 }}
          transition={{ duration: 0.15 }}
        >
          {tab === 'today' && <Today day={day} setDay={setDay} onWall={() => setWall(true)} dockSlot={slot} />}
          {tab === 'review' && <Review key={reviewDay?.n} initialDay={reviewDay?.day} />}
        </motion.main>
      </AnimatePresence>

      <div className="dock" style={{ bottom: 'calc(var(--dock-bottom) + 70px)' }} ref={setSlot} />
      <div className="dock">
        <nav className="tabbar">
          {TABS.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              className={tab === id ? 'on' : ''}
              aria-label={label}
              onClick={() => {
                if (id === 'review') setReviewDay(undefined)
                setTab(id)
              }}
            >
              <Icon size={20} />
              <span className="label">{label}</span>
            </button>
          ))}
        </nav>
        {tab === 'today' && day === todayKey() && (
          <motion.button className="fab" aria-label="add a task" whileTap={{ scale: 0.9 }} onClick={() => setAdding(true)}>
            <Plus size={26} />
          </motion.button>
        )}
      </div>

      <TaskSheet open={adding} onClose={() => setAdding(false)} />

      <AnimatePresence>
        {wall && (
          <motion.div
            className="overlay"
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', stiffness: 360, damping: 38 }}
          >
            <Calendar
              onBack={() => setWall(false)}
              onReview={(d) => {
                setWall(false)
                setReviewDay({ day: d, n: Date.now() })
                setTab('review')
              }}
            />
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
                <div className="from">a note from you</div>
                <div className="note-text" style={{ fontSize: 22 }}>
                  {note.text}
                </div>
              </Sticky>
              <div style={{ color: '#fff', fontSize: 13, fontWeight: 600, marginTop: 16, textAlign: 'center' }}>
                tap to keep going
              </div>
            </motion.button>
          </>
        )}
      </AnimatePresence>
    </div>
  )
}
