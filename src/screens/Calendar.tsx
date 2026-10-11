import { useLiveQuery } from 'dexie-react-hooks'
import { motion } from 'framer-motion'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Sheet } from '../components/Sheet'
import { Sticky, StickyStack, tilt } from '../components/Sticky'
import { cap, fromKey, prettyDay, toKey, todayKey } from '../lib/dates'
import { db, type Task } from '../lib/db'

const DOW = ['M', 'T', 'W', 'T', 'F', 'S', 'S']

export function Calendar({ onBack }: { onBack: () => void }) {
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
    <div className="app">
      <header className="screen-head" style={{ justifyContent: 'flex-start' }}>
        <button className="icon-btn" aria-label="back" onClick={onBack}>
          <ChevronLeft size={20} />
        </button>
        <h1>
          The wall <span className="soft">of piles</span>
        </h1>
      </header>

      <div className="day-nav">
        <button className="icon-btn" aria-label="previous month" onClick={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() - 1, 1))}>
          <ChevronLeft size={18} />
        </button>
        <span>{cursor.toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}</span>
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
              <div style={{ flex: 1, display: 'flex', alignItems: 'center' }}>
                {items.length > 0 && <StickyStack items={items} size={26} max={6} />}
              </div>
              {items.length > 6 && <span className="more">{items.length}</span>}
            </motion.button>
          )
        })}
      </div>

      <div className="month-total">
        {done.length === 0 ? (
          'No piles this month yet. They start with one sticky.'
        ) : (
          <>
            <b>{done.length}</b> things done across <b>{byDay.size}</b> day{byDay.size === 1 ? '' : 's'} this month.
          </>
        )}
      </div>

      <DaySheet day={open} items={open ? byDay.get(open) ?? [] : []} onClose={() => setOpen(null)} />
    </div>
  )
}

function DaySheet({
  day,
  items,
  onClose,
}: {
  day: string | null
  items: Task[]
  onClose: () => void
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
          <div className="sheet-head">
            <span />
            <h2>
              {cap(prettyDay(day))}, {items.length} done
            </h2>
            <span />
          </div>
          {items.length === 0 ? (
            <p className="empty" style={{ paddingTop: 8 }}>
              Nothing stacked this day. Rest days count too.
            </p>
          ) : (
            <div className="fan">
              {items.map((t, i) => (
                <motion.div
                  key={t.id}
                  initial={{ opacity: 0, y: 24 }}
                  animate={{ opacity: 1, y: 0, rotate: tilt(t.id, 0.8) }}
                  transition={{ delay: i * 0.04, type: 'spring', stiffness: 300, damping: 26 }}
                >
                  <Sticky color={t.color} text={t.title} fontSize={15} />
                </motion.div>
              ))}
            </div>
          )}
          {answers && answers.length > 0 && (
            <>
              <div className="section-label">Also</div>
              <div className="tags">
                {answers.map((q) => (
                  <span key={q.id}>{cap(q.text.replace(/\?$/, ''))}</span>
                ))}
              </div>
            </>
          )}
          <div style={{ height: 8 }} />
        </>
      )}
    </Sheet>
  )
}
