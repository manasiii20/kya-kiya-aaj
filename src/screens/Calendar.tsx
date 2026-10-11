import { useLiveQuery } from 'dexie-react-hooks'
import { motion } from 'framer-motion'
import { ChevronLeft, ChevronRight, Layers } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Sheet } from '../components/Sheet'
import { Sticky, StickyStack, tilt } from '../components/Sticky'
import { fromKey, prettyDay, stampDay, toKey, todayKey } from '../lib/dates'
import { db, type Task } from '../lib/db'

const DOW = ['m', 't', 'w', 't', 'f', 's', 's']

export function Calendar({ onReview }: { onReview: (day: string) => void }) {
  const today = todayKey()
  const [cursor, setCursor] = useState(() => {
    const d = new Date()
    return new Date(d.getFullYear(), d.getMonth(), 1)
  })
  const [open, setOpen] = useState<string | null>(null)

  const first = toKey(cursor)
  const last = toKey(new Date(cursor.getFullYear(), cursor.getMonth() + 1, 0))
  const done =
    useLiveQuery(
      () => db.tasks.where('date').between(first, last, true, true).filter((t) => !t.deleted && !!t.done).toArray(),
      [first, last],
    ) ?? []

  const byDay = useMemo(() => {
    const m = new Map<string, Task[]>()
    for (const t of done) m.set(t.date, [...(m.get(t.date) ?? []), t])
    for (const list of m.values()) list.sort((a, b) => (a.doneAt ?? 0) - (b.doneAt ?? 0))
    return m
  }, [done])

  const lead = (cursor.getDay() + 6) % 7 // Monday-first
  const days = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 0).getDate()
  const cells: (string | null)[] = [
    ...Array(lead).fill(null),
    ...Array.from({ length: days }, (_, i) => toKey(new Date(cursor.getFullYear(), cursor.getMonth(), i + 1))),
  ]
  const isCurrentMonth = first.slice(0, 7) === today.slice(0, 7)

  return (
    <>
      <header className="screen-head">
        <div>
          <div className="date">the wall</div>
          <h1>all your piles</h1>
        </div>
      </header>

      <div className="cal-head">
        <button className="icon-btn" aria-label="previous month" onClick={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() - 1, 1))}>
          <ChevronLeft size={18} />
        </button>
        <span className="month">
          {cursor.toLocaleDateString(undefined, { month: 'long', year: 'numeric' }).toLowerCase()}
        </span>
        <button
          className="icon-btn"
          aria-label="next month"
          disabled={isCurrentMonth}
          style={{ opacity: isCurrentMonth ? 0.3 : 1 }}
          onClick={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1))}
        >
          <ChevronRight size={18} />
        </button>
      </div>

      <div className="cal-grid">
        {DOW.map((d, i) => (
          <div key={i} className="cal-dow">
            {d}
          </div>
        ))}
        {cells.map((key, i) => {
          if (!key) return <div key={`b${i}`} />
          const items = byDay.get(key) ?? []
          const future = key > today
          return (
            <motion.button
              key={key}
              whileTap={{ scale: 0.92 }}
              className={`cal-day ${key === today ? 'today' : ''} ${future ? 'future' : ''}`}
              disabled={future}
              onClick={() => setOpen(key)}
            >
              <span className="n">{fromKey(key).getDate()}</span>
              <div style={{ flex: 1, display: 'flex', alignItems: 'flex-end', paddingBottom: 6 }}>
                {items.length > 0 && <StickyStack items={items} size={24} step={3} max={6} />}
              </div>
              {items.length > 6 && <span className="count">{items.length}</span>}
            </motion.button>
          )
        })}
      </div>

      <div className="month-total">
        {done.length === 0 ? (
          'no piles this month yet. they start with one sticky.'
        ) : (
          <>
            <b>{done.length}</b> things done across <b>{byDay.size}</b> day{byDay.size === 1 ? '' : 's'} this month.
          </>
        )}
      </div>

      <DaySheet day={open} items={open ? byDay.get(open) ?? [] : []} onClose={() => setOpen(null)} onReview={onReview} />
    </>
  )
}

function DaySheet({
  day,
  items,
  onClose,
  onReview,
}: {
  day: string | null
  items: Task[]
  onClose: () => void
  onReview: (day: string) => void
}) {
  const answers = useLiveQuery(
    async () => {
      if (!day) return []
      const [ans, qs] = await Promise.all([db.answers.where('date').equals(day).toArray(), db.questions.toArray()])
      const byId = new Map(qs.map((q) => [q.id, q]))
      return ans.filter((a) => a.yes && !a.deleted && byId.get(a.questionId)).map((a) => byId.get(a.questionId)!)
    },
    [day],
  )

  return (
    <Sheet open={!!day} onClose={onClose}>
      {day && (
        <>
          <div className="type" style={{ color: 'var(--accent)', fontSize: 13 }}>
            {stampDay(day)}
          </div>
          <h2 style={{ marginTop: 4 }}>
            {prettyDay(day)} · {items.length} done
          </h2>
          {items.length === 0 ? (
            <p className="empty" style={{ paddingTop: 8 }}>
              nothing stacked this day. rest days count too.
            </p>
          ) : (
            <div className="fan">
              {items.map((t, i) => (
                <motion.div
                  key={t.id}
                  initial={{ opacity: 0, y: 30, rotate: 0 }}
                  animate={{ opacity: 1, y: 0, rotate: tilt(t.id, 4) }}
                  transition={{ delay: i * 0.04, type: 'spring', stiffness: 300, damping: 22 }}
                >
                  <Sticky color={t.color} text={t.title} fontSize={22} />
                </motion.div>
              ))}
            </div>
          )}
          {answers && answers.length > 0 && (
            <>
              <div className="section-label">also</div>
              <div className="answers">
                {answers.map((q) => (
                  <span key={q.id}>
                    {q.emoji} {q.text.replace(/\?$/, '')}
                  </span>
                ))}
              </div>
            </>
          )}
          <button
            className="btn block"
            style={{ marginTop: 20 }}
            onClick={() => {
              onClose()
              onReview(day)
            }}
          >
            <Layers size={16} /> review this day
          </button>
        </>
      )}
    </Sheet>
  )
}
