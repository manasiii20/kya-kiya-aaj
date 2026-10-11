import { AnimatePresence, motion } from 'framer-motion'
import { CalendarDays, Layers, NotebookPen, Smile } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Sticky } from './components/Sticky'
import type { SelfNote } from './lib/db'
import { noteOnOpen, onSelfNote } from './lib/selfNotes'
import { Calendar } from './screens/Calendar'
import { Me } from './screens/Me'
import { Review } from './screens/Review'
import { Today } from './screens/Today'

type Tab = 'today' | 'review' | 'wall' | 'me'

const TABS: { id: Tab; label: string; icon: typeof Layers }[] = [
  { id: 'today', label: 'today', icon: NotebookPen },
  { id: 'review', label: 'review', icon: Layers },
  { id: 'wall', label: 'wall', icon: CalendarDays },
  { id: 'me', label: 'me', icon: Smile },
]

export function App() {
  const [tab, setTab] = useState<Tab>('today')
  const [reviewDay, setReviewDay] = useState<{ day: string; n: number } | undefined>()
  const [note, setNote] = useState<SelfNote | null>(null)

  useEffect(() => {
    onSelfNote(setNote)
    const t = window.setTimeout(() => void noteOnOpen(), 900)
    const onVisible = () => document.visibilityState === 'visible' && void noteOnOpen()
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
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.16 }}
        >
          {tab === 'today' && <Today />}
          {tab === 'review' && <Review key={reviewDay?.n} initialDay={reviewDay?.day} />}
          {tab === 'wall' && (
            <Calendar
              onReview={(day) => {
                setReviewDay({ day, n: Date.now() })
                setTab('review')
              }}
            />
          )}
          {tab === 'me' && <Me />}
        </motion.main>
      </AnimatePresence>

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
              initial={{ scale: 1.4, opacity: 0, rotate: 12 }}
              animate={{ scale: 1, opacity: 1, rotate: -3 }}
              exit={{ scale: 0.8, opacity: 0, rotate: -12 }}
              transition={{ type: 'spring', stiffness: 320, damping: 18 }}
              onClick={() => setNote(null)}
            >
              <Sticky color={note.color} style={{ padding: 20, textAlign: 'left' }}>
                <div className="from">a note from you ✿</div>
                <div className="txt" style={{ fontSize: 32 }}>
                  {note.text}
                </div>
              </Sticky>
              <div className="type" style={{ color: '#fff', fontSize: 12, marginTop: 14 }}>
                tap to keep going
              </div>
            </motion.button>
          </>
        )}
      </AnimatePresence>
    </div>
  )
}
