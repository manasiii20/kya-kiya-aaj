import { Check, RotateCcw, Trash2, X } from 'lucide-react'
import { useEffect, useState } from 'react'
import { todayKey } from '../lib/dates'
import { db, patch, put, randomColor, remove, STICKY_COLORS, uid, type Task } from '../lib/db'
import { ColorDots, Sheet } from './Sheet'
import { StarSticker, Sticky } from './Sticky'

const PRIORITY_LABELS = ['No rush', 'Low key', 'Kinda matters', 'Big deal'] as const

// One sheet for adding and editing. New tasks always go on today.
export function TaskSheet({ open, task, onClose }: { open: boolean; task?: Task | null; onClose: () => void }) {
  const [title, setTitle] = useState('')
  const [color, setColor] = useState(STICKY_COLORS[0])
  const [priority, setPriority] = useState<0 | 1 | 2 | 3>(0)
  const [description, setDescription] = useState('')

  useEffect(() => {
    if (!open) return
    setTitle(task?.title ?? '')
    setColor(task?.color ?? randomColor())
    setPriority(task?.priority ?? 0)
    setDescription(task?.description ?? '')
  }, [open, task])

  async function confirm() {
    const text = title.trim()
    if (!text) return
    const details = description.trim()
    if (task) {
      await patch('tasks', task.id, { title: text, color, priority, description: details || undefined })
    } else {
      const day = todayKey()
      const sameDay = await db.tasks.where('date').equals(day).toArray()
      const order = sameDay.length ? Math.max(...sameDay.map((t) => t.order)) + 1 : 0
      await put('tasks', { id: uid(), title: text, date: day, done: 0, order, color, priority, description: details || undefined, deleted: 0 })
    }
    onClose()
  }

  return (
    <Sheet open={open} onClose={onClose}>
      <div className="sheet-head">
        <button className="icon-btn plain" aria-label="close" onClick={onClose}>
          <X size={20} />
        </button>
        <h2>{task ? 'Edit task' : 'Add a task'}</h2>
        <span />
      </div>

      <div className="write-panel">
        <Sticky color={color} className="write-note">
          <textarea
            placeholder="tap to write"
            value={title}
            maxLength={160}
            onChange={(e) => setTitle(e.target.value)}
          />
        </Sticky>
        <ColorDots colors={STICKY_COLORS} value={color} onChange={setColor} />
        <div className="priority">
          <div className="label">
            How big a deal?
            <b>{PRIORITY_LABELS[priority]}</b>
          </div>
          <div className="star-picker">
            {([1, 2, 3] as const).map((n) => (
              <button
                key={n}
                aria-label={`priority ${n}`}
                className={priority >= n ? 'on' : ''}
                // Tapping the current level again clears it.
                onClick={() => setPriority(priority === n ? 0 : n)}
              >
                <StarSticker size={30} rotate={[-10, 6, -4][n - 1]} off={priority < n} />
              </button>
            ))}
          </div>
        </div>
      </div>

      <label className="describe">
        <span className="describe-label">
          Describe it, if you want to <em>optional</em>
        </span>
        <textarea
          rows={3}
          placeholder="Details, links, the first tiny step, a pep talk for later..."
          value={description}
          maxLength={1000}
          onChange={(e) => setDescription(e.target.value)}
        />
      </label>

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
            {task.done ? 'Not done' : 'Mark done'}
          </button>
          <button
            className="btn"
            style={{ flex: 1, color: 'var(--no)' }}
            onClick={async () => {
              await remove('tasks', task.id)
              onClose()
            }}
          >
            <Trash2 size={17} /> Delete
          </button>
        </div>
      )}

      <button className="btn primary block" style={{ marginTop: 12 }} disabled={!title.trim()} onClick={confirm}>
        {task ? 'Save' : 'Add it'}
      </button>
    </Sheet>
  )
}
