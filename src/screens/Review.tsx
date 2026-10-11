import { useLiveQuery } from 'dexie-react-hooks'
import { animate, AnimatePresence, motion, useMotionValue, useTransform } from 'framer-motion'
import { Check, ChevronLeft, ChevronRight, RotateCcw, X } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { StickyStack } from '../components/Sticky'
import { pop, shower } from '../lib/celebrate'
import { addDays, prettyDay, stampDay, todayKey } from '../lib/dates'
import { db, patch, patchMany, put, type Question, type Task } from '../lib/db'

type Card = { kind: 'task'; task: Task } | { kind: 'question'; q: Question }
type Result = { card: Card; yes: boolean }

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

export function Review({ initialDay }: { initialDay?: string }) {
  const today = todayKey()
  const [day, setDay] = useState(initialDay ?? today)
  useEffect(() => {
    if (initialDay) setDay(initialDay)
  }, [initialDay])

  const [phase, setPhase] = useState<'start' | 'deck' | 'end'>('start')
  const [deck, setDeck] = useState<Card[]>([])
  const [index, setIndex] = useState(0)
  const [results, setResults] = useState<Result[]>([])

  const dayTasks = useLiveQuery(
    () => db.tasks.where('date').equals(day).filter((t) => !t.deleted).toArray(),
    [day],
  )
  const questions = useLiveQuery(() => db.questions.filter((q) => !q.deleted && !!q.active).toArray(), [])

  useEffect(() => {
    setPhase('start')
    setIndex(0)
    setResults([])
  }, [day])

  function start() {
    const tasks = [...(dayTasks ?? [])].sort((a, b) => a.order - b.order)
    setDeck(buildDeck(tasks, [...(questions ?? [])].sort((a, b) => a.order - b.order)))
    setIndex(0)
    setResults([])
    setPhase('deck')
  }

  async function answer(card: Card, yes: boolean) {
    if (card.kind === 'task') {
      const t = card.task
      if (yes && !t.done) await patch('tasks', t.id, { done: 1, doneAt: Date.now(), letGo: 0 })
      if (!yes && t.done) await patch('tasks', t.id, { done: 0, doneAt: undefined })
    } else {
      await put('answers', { id: `${day}|${card.q.id}`, date: day, questionId: card.q.id, yes: yes ? 1 : 0, deleted: 0 })
    }
    setResults((r) => [...r, { card, yes }])
    if (index + 1 >= deck.length) {
      setPhase('end')
      shower()
    } else setIndex(index + 1)
  }

  const taskCount = dayTasks?.length ?? 0
  const qCount = questions?.length ?? 0

  return (
    <>
      <header className="screen-head">
        <div>
          <div className="date">{stampDay(day)}</div>
          <h1>review your day</h1>
        </div>
      </header>

      <div className="cal-head" style={{ marginBottom: 8 }}>
        <button className="icon-btn" aria-label="previous day" onClick={() => setDay(addDays(day, -1))}>
          <ChevronLeft size={18} />
        </button>
        <span className="type" style={{ fontWeight: 700 }}>
          {prettyDay(day)}
        </span>
        <button className="icon-btn" aria-label="next day" disabled={day >= today} style={{ opacity: day >= today ? 0.3 : 1 }} onClick={() => setDay(addDays(day, 1))}>
          <ChevronRight size={18} />
        </button>
      </div>

      {phase === 'start' && (
        <div style={{ textAlign: 'center', padding: '48px 8px 0' }}>
          <StartStack />
          <p className="type" style={{ fontSize: 20, lineHeight: 1.4, margin: '28px 0 6px' }}>
            let's look at <span style={{ color: 'var(--accent)' }}>{prettyDay(day)}</span>.
          </p>
          <p className="type muted" style={{ fontSize: 14, margin: '0 0 28px' }}>
            {taskCount + qCount === 0
              ? 'nothing to review yet.'
              : `${taskCount} task${taskCount === 1 ? '' : 's'} · ${qCount} silly question${qCount === 1 ? '' : 's'}`}
            <br />
            swipe right if you did it, left if not.
          </p>
          <button className="btn primary block" disabled={taskCount + qCount === 0} onClick={start}>
            let's go
          </button>
        </div>
      )}

      {phase === 'deck' && deck[index] && (
        <>
          <div className="progress">
            {deck.map((_, i) => (
              <span key={i} className={i < index ? 'on' : ''} />
            ))}
          </div>
          <Deck key={index} card={deck[index]} next={deck[index + 1]} day={day} pos={`${index + 1}/${deck.length}`} onAnswer={answer} />
        </>
      )}

      {phase === 'end' && <EndOfReview day={day} results={results} onAgain={start} />}
    </>
  )
}

function StartStack() {
  return (
    <div style={{ display: 'flex', justifyContent: 'center' }}>
      <StickyStack
        size={120}
        step={7}
        items={[
          { id: 'a1', color: '#b9d7ff' },
          { id: 'b22', color: '#ffc6c2' },
          { id: 'c333', color: '#ffe08a', title: 'how was your day?' },
        ]}
        showText
      />
    </div>
  )
}

function Deck({
  card,
  next,
  day,
  pos,
  onAnswer,
}: {
  card: Card
  next?: Card
  day: string
  pos: string
  onAnswer: (c: Card, yes: boolean) => void
}) {
  const x = useMotionValue(0)
  const rotate = useTransform(x, [-220, 220], [-14, 14])
  const yesOpacity = useTransform(x, [20, 110], [0, 1])
  const noOpacity = useTransform(x, [-110, -20], [1, 0])
  const cardRef = useRef<HTMLDivElement>(null)
  const done = useRef(false)

  function fling(yes: boolean) {
    if (done.current) return
    done.current = true
    if (yes) pop(cardRef.current)
    void animate(x, yes ? 520 : -520, { duration: 0.28, ease: 'easeIn' }).then(() => onAnswer(card, yes))
  }

  return (
    <>
      <div className="deck">
        {next && (
          <div className="card" style={{ ...cardStyle(next), transform: 'scale(0.94) translateY(14px) rotate(-2deg)', boxShadow: 'none', opacity: 0.8 }} />
        )}
        <motion.div
          ref={cardRef}
          className="card"
          style={{ ...cardStyle(card), x, rotate }}
          initial={{ scale: 0.92, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: 'spring', stiffness: 400, damping: 30 }}
          drag="x"
          dragSnapToOrigin
          dragElastic={0.9}
          onDragEnd={(_, info) => {
            if (info.offset.x > 100 || info.velocity.x > 600) fling(true)
            else if (info.offset.x < -100 || info.velocity.x < -600) fling(false)
          }}
          whileTap={{ cursor: 'grabbing' }}
        >
          <div className="stamp-day">
            <span>{stampDay(day)}</span>
            <span>{pos}</span>
          </div>
          {card.kind === 'task' ? (
            <>
              <div className="q hand">{card.task.title}</div>
              <div className="hint">did you do it?</div>
            </>
          ) : (
            <>
              <div className="q type">
                <span>
                  <span style={{ fontSize: 44, display: 'block', marginBottom: 12 }}>{card.q.emoji}</span>
                  {card.q.text}
                </span>
              </div>
              <div className="hint">yes or no. be honest :)</div>
            </>
          )}
          <motion.div className="verdict yes" style={{ opacity: yesOpacity }}>
            {card.kind === 'task' ? 'DID IT!' : 'YES'}
          </motion.div>
          <motion.div className="verdict no" style={{ opacity: noOpacity }}>
            {card.kind === 'task' ? 'NOPE' : 'NO'}
          </motion.div>
        </motion.div>
      </div>
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

function cardStyle(card: Card) {
  return card.kind === 'task'
    ? { background: card.task.color }
    : { background: '#ffffff', backgroundImage: 'radial-gradient(#ebe9e3 1px, transparent 1px)', backgroundSize: '16px 16px' }
}

function EndOfReview({ day, results, onAgain }: { day: string; results: Result[]; onAgain: () => void }) {
  const today = todayKey()
  const target = day < today ? today : addDays(day, 1)
  const doneTasks = useLiveQuery(
    () => db.tasks.where('date').equals(day).filter((t) => !t.deleted && !!t.done).toArray(),
    [day],
  )
  const stack = useMemo(
    () => [...(doneTasks ?? [])].sort((a, b) => (a.doneAt ?? 0) - (b.doneAt ?? 0)),
    [doneTasks],
  )
  const missed = results.filter((r) => r.card.kind === 'task' && !r.yes).map((r) => (r.card as { task: Task }).task)
  const yesQs = results.filter((r) => r.card.kind === 'question' && r.yes).map((r) => (r.card as { q: Question }).q)
  const [handled, setHandled] = useState(false)

  return (
    <div style={{ paddingTop: 12 }}>
      <div style={{ display: 'flex', justifyContent: 'center', margin: '8px 0 20px' }}>
        <StickyStack items={stack} size={130} step={7} max={14} showText />
      </div>
      <p className="type" style={{ textAlign: 'center', fontSize: 20, margin: '0 0 6px' }}>
        {stack.length === 0 ? 'a quiet day. that is allowed.' : `${stack.length} thing${stack.length === 1 ? '' : 's'} done.`}
      </p>
      <p className="type muted" style={{ textAlign: 'center', fontSize: 14, margin: 0 }}>
        {stack.length === 0 ? 'tomorrow is a fresh pile.' : 'look at that pile. you made that.'}
      </p>

      {yesQs.length > 0 && (
        <div className="answers" style={{ justifyContent: 'center', marginTop: 16 }}>
          {yesQs.map((q) => (
            <span key={q.id}>
              {q.emoji} {q.text.replace(/\?$/, '')}
            </span>
          ))}
        </div>
      )}

      <AnimatePresence>
        {missed.length > 0 && !handled && (
          <motion.div
            exit={{ opacity: 0, height: 0 }}
            style={{ marginTop: 24, background: 'var(--surface)', borderRadius: 18, padding: 16 }}
          >
            <div className="type" style={{ fontWeight: 700, marginBottom: 4 }}>
              {missed.length} didn't happen
            </div>
            <div className="muted" style={{ fontSize: 14, marginBottom: 12 }}>
              bring them to {prettyDay(target)}, or let them go?
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                className="btn"
                style={{ flex: 1 }}
                onClick={async () => {
                  await patchMany('tasks', missed.map((t) => t.id), { letGo: 1 })
                  setHandled(true)
                }}
              >
                let go
              </button>
              <button
                className="btn primary"
                style={{ flex: 1.4 }}
                onClick={async () => {
                  const base = Date.now()
                  for (const [i, t] of missed.entries()) await patch('tasks', t.id, { date: target, order: base + i, letGo: 0 })
                  setHandled(true)
                }}
              >
                bring to {prettyDay(target)}
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <button className="btn block" style={{ marginTop: 20 }} onClick={onAgain}>
        <RotateCcw size={16} /> swipe again
      </button>
    </div>
  )
}
