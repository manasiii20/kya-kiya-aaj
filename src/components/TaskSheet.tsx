import { Check, RotateCcw, Trash2, X } from 'lucide-react'
import { useEffect, useState } from 'react'
import { todayKey } from '../lib/dates'
import { db, patch, put, randomColor, remove, STICKY_COLORS, uid, type Task } from '../lib/db'
import { ColorDots, Sheet } from './Sheet'
import { Sticky } from './Sticky'

// One sheet for adding and editing. New tasks always go on today.
export function TaskSheet({ open, task, onClose }: { open: boolean; task?: Task | null; onClose: () => void }) {
  const [title, setTitle] = useState('')
  const [color, setColor] = useState(STICKY_COLORS[0])

  useEffect(() => {
    if (!open) return
    setTitle(task?.title ?? '')
    setColor(task?.color ?? randomColor())
  }, [open, task])

  async function confirm() {
    const text = title.trim()
    if (!text) return
    if (task) {
      await patch('tasks', task.id, { title: text, color })
    } else {
      const day = todayKey()
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
        <h2>{task ? 'edit task' : 'add for today'}</h2>
        <span />
      </div>

      <div className="write-panel">
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
