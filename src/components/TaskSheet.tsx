import { CalendarDays, Check, RotateCcw, Trash2, X } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { addDays, fromKey, todayKey } from '../lib/dates'
import { db, patch, put, randomColor, remove, STICKY_COLORS, uid, type Task } from '../lib/db'
import { ColorDots, Sheet } from './Sheet'
import { Sticky } from './Sticky'

// One sheet for adding and editing: write on the sticky, pick a colour, pick a day.
export function TaskSheet({
  open,
  task,
  defaultDay,
  onClose,
}: {
  open: boolean
  task?: Task | null
  defaultDay: string
  onClose: () => void
}) {
  const today = todayKey()
  const [title, setTitle] = useState('')
  const [color, setColor] = useState(STICKY_COLORS[0])
  const [day, setDay] = useState(defaultDay)
  const dateRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!open) return
    setTitle(task?.title ?? '')
    setColor(task?.color ?? randomColor())
    setDay(task?.date ?? defaultDay)
  }, [open, task, defaultDay])

  const tomorrow = addDays(today, 1)
  const isCustom = day !== today && day !== tomorrow
  const customLabel = isCustom
    ? fromKey(day).toLocaleDateString(undefined, { day: 'numeric', month: 'short' })
    : 'pick a date'

  async function confirm() {
    const text = title.trim()
    if (!text) return
    if (task) {
      const moved = day !== task.date
      await patch('tasks', task.id, {
        title: text,
        color,
        date: day,
        ...(moved ? { order: Date.now(), letGo: 0 } : {}),
      })
    } else {
      const sameDay = await db.tasks.where('date').equals(day).toArray()
      const order = sameDay.length ? Math.max(...sameDay.map((t) => t.order)) + 1 : 0
      await put('tasks', { id: uid(), title: text, date: day, done: 0, order, color, deleted: 0 })
    }
    onClose()
  }

  return (
    <Sheet open={open} onClose={onClose}>
      <div className="sheet-head">
        <button className="icon-btn plain" aria-label="close" onClick={onClose}>
          <X size={20} />
        </button>
        <h2>{task ? 'edit task' : 'add a task'}</h2>
        <span />
      </div>

      <Sticky color={color} className="write-note">
        <textarea
          autoFocus={!task}
          placeholder="tap to write"
          value={title}
          maxLength={160}
          onChange={(e) => setTitle(e.target.value)}
        />
      </Sticky>

      <ColorDots colors={STICKY_COLORS} value={color} onChange={setColor} />

      <div className="panel" style={{ marginTop: 22 }}>
        <div className="section-label" style={{ marginTop: 0 }}>
          when
        </div>
        <div className="chips">
          <button className={`chip ${day === today ? 'on' : ''}`} onClick={() => setDay(today)}>
            today
          </button>
          <button className={`chip ${day === tomorrow ? 'on' : ''}`} onClick={() => setDay(tomorrow)}>
            tomorrow
          </button>
          <button
            className={`chip ${isCustom ? 'on' : ''}`}
            style={{ position: 'relative' }}
            onClick={() => {
              const el = dateRef.current
              if (!el) return
              if ('showPicker' in el) {
                try {
                  el.showPicker()
                  return
                } catch {
                  // fall through to focus
                }
              }
              el.focus()
            }}
          >
            <CalendarDays size={15} /> {customLabel}
            <input
              ref={dateRef}
              className="date-input"
              type="date"
              value={day}
              onChange={(e) => e.target.value && setDay(e.target.value)}
            />
          </button>
        </div>
      </div>

      {task && (
        <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
          <button
            className="btn"
            style={{ flex: 1 }}
            onClick={async () => {
              await patch('tasks', task.id, task.done ? { done: 0, doneAt: undefined } : { done: 1, doneAt: Date.now() })
              onClose()
            }}
          >
            {task.done ? <RotateCcw size={17} /> : <Check size={17} />}
            {task.done ? 'not done' : 'mark done'}
          </button>
          <button
            className="btn"
            style={{ flex: 1, color: 'var(--no)' }}
            onClick={async () => {
              await remove('tasks', task.id)
              onClose()
            }}
          >
            <Trash2 size={17} /> delete
          </button>
        </div>
      )}

      <button className="btn primary block" style={{ marginTop: 12 }} disabled={!title.trim()} onClick={confirm}>
        {task ? 'save' : 'add it'}
      </button>
    </Sheet>
  )
}
