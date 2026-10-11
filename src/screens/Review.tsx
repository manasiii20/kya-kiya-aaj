import { useLiveQuery } from 'dexie-react-hooks'
import { animate, AnimatePresence, motion, useMotionValue, useTransform } from 'framer-motion'
import { ArrowLeft, ArrowRight, Check, ChevronLeft, RotateCcw, X } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { Sticky, StickyStack } from '../components/Sticky'
import { shower, swipeBurst } from '../lib/celebrate'
import { cap, todayKey } from '../lib/dates'
import { db, patch, put, type Question, type Task } from '../lib/db'

type Card = { kind: 'task'; task: Task } | { kind: 'question'; q: Question }

const HELP_SEEN = 'kka:swipeHelpSeen'

// Spread the fun questions between the tasks so the deck keeps surprising you.
function buildDeck(tasks: Task[], questions: Question[]): Card[] {
  const deck: Card[] = tasks.map((task) => ({ kind: 'task', task }))
  const qs = [...questions].sort(() => Math.random() - 0.5)
  qs.forEach((q, i) => {
    const at = Math.round(((i + 1) * deck.length) / (qs.length + 1)) + i
    deck.splice(Math.min(at, deck.length), 0, { kind: 'question', q })
  })
  return deck
}

function helpSeen() {
  try {
    return localStorage.getItem(HELP_SEEN) === '1'
  } catch {
    return true
  }
}

export function Review({ onBack }: { onBack: () => void }) {
  const day = todayKey()
  const tasks = useLiveQuery(() => db.tasks.where('date').equals(day).filter((t) => !t.deleted).toArray(), [day])
  const questions = useLiveQuery(() => db.questions.filter((q) => !q.deleted && !!q.active).toArray(), [])

  const [deck, setDeck] = useState<Card[] | null>(null)
  const [index, setIndex] = useState(0)
  const [help, setHelp] = useState(!helpSeen())

  function deal() {
    if (!tasks || !questions) return
    const t = [...tasks].sort((a, b) => a.order - b.order)
    setDeck(buildDeck(t, [...questions].sort((a, b) => a.order - b.order)))
    setIndex(0)
  }

  // Deal once both lists have loaded.
  useEffect(() => {
    if (!deck && tasks && questions) deal()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tasks, questions])

  async function answer(card: Card, yes: boolean) {
    if (card.kind === 'task') {
      const t = card.task
      if (yes && !t.done) await patch('tasks', t.id, { done: 1, doneAt: Date.now(), letGo: 0 })
      if (!yes && t.done) await patch('tasks', t.id, { done: 0, doneAt: undefined })
    } else {
      await put('answers', { id: `${day}|${card.q.id}`, date: day, questionId: card.q.id, yes: yes ? 1 : 0, deleted: 0 })
    }
    if (deck && index + 1 >= deck.length) shower()
    setIndex((i) => i + 1)
  }

  const finished = deck && index >= deck.length
  const empty = deck && deck.length === 0

  return (
    <div className="app">
      <header className="screen-head" style={{ justifyContent: 'flex-start' }}>
        <button className="icon-btn" aria-label="back" onClick={onBack}>
          <ChevronLeft size={20} />
        </button>
        <h1>Swipe your list</h1>
      </header>

      {deck && !finished && !empty && (
        <>
          <div className="progress" style={{ marginBottom: 14 }}>
            {deck.map((_, i) => (
              <span key={i} className={i < index ? 'on' : ''} />
            ))}
          </div>
          <Deck key={index} card={deck[index]} next={deck[index + 1]} pos={`${index + 1} of ${deck.length}`} onAnswer={answer} />
        </>
      )}

      {empty && (
        <div className="swipe-panel" style={{ textAlign: 'center' }}>
          <p className="muted" style={{ margin: 0, lineHeight: 1.5 }}>
            Nothing to swipe yet.
            <br />
            Add a few things to today first.
          </p>
        </div>
      )}

      {finished && !empty && <Done day={day} onAgain={deal} onBack={onBack} />}

      <AnimatePresence>
        {help && (
          <>
            <motion.div className="scrim" style={{ zIndex: 49 }} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} />
            <motion.div
              className="help-pop"
              style={{ x: '-50%', y: '-50%' }}
              initial={{ opacity: 0, scale: 0.94 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.96 }}
              transition={{ type: 'spring', stiffness: 360, damping: 30 }}
            >
              <h2>How it works</h2>
              <div className="help-row">
                <span className="help-icon yes">
                  <ArrowRight size={18} />
                </span>
                Swipe right if you did it.
              </div>
              <div className="help-row">
                <span className="help-icon no">
                  <ArrowLeft size={18} />
                </span>
                Swipe left if you didn't.
              </div>
              <p className="muted" style={{ fontSize: 14, margin: '4px 0 20px', lineHeight: 1.45 }}>
                A few silly questions sneak in too. Same rules.
              </p>
              <button
                className="btn primary block"
                onClick={() => {
                  try {
                    localStorage.setItem(HELP_SEEN, '1')
                  } catch {
                    // shows again next time, that's fine
                  }
                  setHelp(false)
                }}
              >
                Let's swipe
              </button>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  )
}

function Deck({ card, next, pos, onAnswer }: { card: Card; next?: Card; pos: string; onAnswer: (c: Card, yes: boolean) => void }) {
  const x = useMotionValue(0)
  const rotate = useTransform(x, [-240, 240], [-12, 12])
  const yesOpacity = useTransform(x, [20, 100], [0, 1])
  const noOpacity = useTransform(x, [-100, -20], [1, 0])
  const cardRef = useRef<HTMLDivElement>(null)
  const done = useRef(false)

  function fling(yes: boolean) {
    if (done.current) return
    done.current = true
    if (yes) swipeBurst(cardRef.current)
    void animate(x, yes ? 520 : -520, { duration: 0.3, ease: 'easeIn' }).then(() => onAnswer(card, yes))
  }

  return (
    <>
      <div className="swipe-panel">
        {next && (
          <div className="swipe-slot" style={{ transform: 'rotate(-3deg) scale(0.96)' }}>
            <CardFace card={next} pos="" muted />
          </div>
        )}
        <motion.div
          ref={cardRef}
          className="swipe-slot"
          style={{ x, rotate, touchAction: 'none', cursor: 'grab', zIndex: 1 }}
          initial={{ scale: 0.94, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: 'spring', stiffness: 400, damping: 30 }}
          drag="x"
          dragSnapToOrigin
          dragElastic={0.9}
          onDragEnd={(_, info) => {
            if (info.offset.x > 90 || info.velocity.x > 600) fling(true)
            else if (info.offset.x < -90 || info.velocity.x < -600) fling(false)
          }}
        >
          <CardFace card={card} pos={pos} />
          <motion.div className="verdict yes" style={{ opacity: yesOpacity }}>
            {card.kind === 'task' ? 'Did it' : 'Yes'}
          </motion.div>
          <motion.div className="verdict no" style={{ opacity: noOpacity }}>
            {card.kind === 'task' ? 'Nope' : 'No'}
          </motion.div>
        </motion.div>
      </div>
      <p className="muted" style={{ textAlign: 'center', fontSize: 14, margin: '14px 0 16px' }}>
        {card.kind === 'task' ? 'Did you do it?' : 'Yes or no. Be honest.'}
      </p>
      <div className="deck-buttons">
        <motion.button whileTap={{ scale: 0.85 }} className="no" aria-label="no" onClick={() => fling(false)}>
          <X size={28} strokeWidth={2.5} />
        </motion.button>
        <motion.button whileTap={{ scale: 0.85 }} className="yes" aria-label="yes" onClick={() => fling(true)}>
          <Check size={28} strokeWidth={2.5} />
        </motion.button>
      </div>
    </>
  )
}

function CardFace({ card, pos, muted }: { card: Card; pos: string; muted?: boolean }) {
  if (card.kind === 'task') {
    return (
      <Sticky color={card.task.color} className="swipe-card" style={{ opacity: muted ? 0.9 : 1 }}>
        <span className="swipe-pos">{pos}</span>
        <div className="note-text swipe-text">{card.task.title}</div>
      </Sticky>
    )
  }
  return (
    <Sticky color="#ffffff" className="swipe-card question" style={{ opacity: muted ? 0.9 : 1 }}>
      <span className="swipe-pos">{pos}</span>
      <div className="swipe-ask">{cap(card.q.text)}</div>
    </Sticky>
  )
}

function Done({ day, onAgain, onBack }: { day: string; onAgain: () => void; onBack: () => void }) {
  const doneTasks = useLiveQuery(() => db.tasks.where('date').equals(day).filter((t) => !t.deleted && !!t.done).toArray(), [day])
  const yes = useLiveQuery(async () => {
    const [ans, qs] = await Promise.all([db.answers.where('date').equals(day).toArray(), db.questions.toArray()])
    const byId = new Map(qs.map((q) => [q.id, q]))
    return ans.filter((a) => a.yes && !a.deleted && byId.get(a.questionId)).map((a) => byId.get(a.questionId)!)
  }, [day])
  const stack = useMemo(() => [...(doneTasks ?? [])].sort((a, b) => (a.doneAt ?? 0) - (b.doneAt ?? 0)), [doneTasks])

  return (
    <div style={{ textAlign: 'center' }}>
      <div className="swipe-panel">
        <StickyStack items={stack} size={170} max={10} showText />
      </div>
      <p style={{ fontSize: 20, fontWeight: 650, letterSpacing: '-0.01em', margin: '20px 0 6px' }}>
        {stack.length === 0 ? 'A quiet day. That is allowed.' : `${stack.length} thing${stack.length === 1 ? '' : 's'} done today.`}
      </p>
      <p className="muted" style={{ fontSize: 15, margin: 0 }}>
        {stack.length === 0 ? 'Tomorrow is a fresh pile.' : 'Look at that pile. You made that.'}
      </p>
      {yes && yes.length > 0 && (
        <div className="tags" style={{ justifyContent: 'center', marginTop: 16 }}>
          {yes.map((q) => (
            <span key={q.id}>{cap(q.text.replace(/\?$/, ''))}</span>
          ))}
        </div>
      )}
      <div style={{ display: 'flex', gap: 8, marginTop: 22 }}>
        <button className="btn" style={{ flex: 1 }} onClick={onAgain}>
          <RotateCcw size={16} /> Swipe again
        </button>
        <button className="btn primary" style={{ flex: 1 }} onClick={onBack}>
          Back to my list
        </button>
      </div>
    </div>
  )
}
