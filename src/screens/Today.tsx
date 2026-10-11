import { useLiveQuery } from 'dexie-react-hooks'
import { AnimatePresence, motion, Reorder, useDragControls } from 'framer-motion'
import { ArrowRight, Check, CheckCheck, CheckSquare, GripVertical, Plus, RotateCcw, Trash2, X } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { ColorDots, Sheet } from '../components/Sheet'
import { Sticky, StickyStack, tilt } from '../components/Sticky'
import { pop } from '../lib/celebrate'
import { addDays, prettyDay, stampDay, todayKey } from '../lib/dates'
import { db, patch, patchMany, put, randomColor, remove, STICKY_COLORS, uid, type Task } from '../lib/db'
import { noteAfterTick } from '../lib/selfNotes'

type Filter = 'all' | 'todo' | 'done'
type Flyer = { id: string; color: string; from: DOMRect; toLeft: number; toTop: number }

const STACK_SIZE = 96

export function Today() {
  const day = todayKey()
  const tasks = useLiveQuery(() => db.tasks.where('date').equals(day).toArray(), [day]) ?? []
  const leftovers =
    useLiveQuery(
      () =>
        db.tasks
          .where('date')
          .between(addDays(day, -14), day, true, false)
          .filter((t) => !t.deleted && !t.done && !t.letGo)
          .toArray(),
      [day],
    ) ?? []

  const live = useMemo(() => tasks.filter((t) => !t.deleted).sort((a, b) => a.order - b.order), [tasks])
  const [filter, setFilter] = useState<Filter>('all')
  const [list, setList] = useState<Task[]>([])
  const dragging = useRef(false)
  const listRef = useRef(list)
  listRef.current = list

  const filtered = useMemo(
    () => live.filter((t) => (filter === 'all' ? true : filter === 'done' ? t.done : !t.done)),
    [live, filter],
  )
  useEffect(() => {
    if (!dragging.current) setList(filtered)
  }, [filtered])

  // ---- the stack + flying sticky ----
  const stackRef = useRef<HTMLDivElement>(null)
  const [flyers, setFlyers] = useState<Flyer[]>([])
  const inFlight = new Set(flyers.map((f) => f.id))
  const stackItems = live
    .filter((t) => t.done && !inFlight.has(t.id))
    .sort((a, b) => (a.doneAt ?? 0) - (b.doneAt ?? 0))
  const doneCount = live.filter((t) => t.done).length

  async function toggle(t: Task, el: HTMLElement) {
    if (t.done) {
      await patch('tasks', t.id, { done: 0, doneAt: undefined })
      return
    }
    pop(el)
    const stack = stackRef.current
    if (stack) {
      // Landing spot is fixed at tick time so later ticks can't retarget a sticky mid-flight.
      const to = stack.getBoundingClientRect()
      const pile = Math.min(stackItems.length + flyers.length, 9)
      const flyer = {
        id: t.id,
        color: t.color,
        from: el.getBoundingClientRect(),
        toLeft: to.left + STACK_SIZE * 0.075,
        toTop: to.bottom - STACK_SIZE * 1.08 - pile * 9,
      }
      setFlyers((f) => [...f, flyer])
      window.setTimeout(() => setFlyers((f) => f.filter((x) => x !== flyer)), 1200)
    }
    await patch('tasks', t.id, { done: 1, doneAt: Date.now() })
    void noteAfterTick()
  }

  // ---- adding ----
  const [draft, setDraft] = useState('')
  async function add() {
    const title = draft.trim()
    if (!title) return
    setDraft('')
    const order = live.length ? Math.max(...live.map((t) => t.order)) + 1 : 0
    await put('tasks', { id: uid(), title, date: day, done: 0, order, color: randomColor(), deleted: 0 })
    if (filter === 'done') setFilter('all')
  }

  // ---- reordering ----
  async function commitOrder() {
    dragging.current = false
    const current = listRef.current
    const slots = current.map((t) => t.order).sort((a, b) => a - b)
    const changed = current.filter((t, i) => t.order !== slots[i])
    for (const t of changed) await patch('tasks', t.id, { order: slots[current.indexOf(t)] })
  }

  // ---- selection ----
  const [selecting, setSelecting] = useState(false)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  function toggleSelect(id: string) {
    setSelected((s) => {
      const n = new Set(s)
      if (n.has(id)) n.delete(id)
      else n.add(id)
      return n
    })
  }
  function endSelect() {
    setSelecting(false)
    setSelected(new Set())
  }
  async function bulk(action: 'done' | 'tomorrow' | 'delete') {
    const ids = [...selected]
    if (action === 'done') {
      await patchMany('tasks', ids.filter((id) => !live.find((t) => t.id === id)?.done), { done: 1, doneAt: Date.now() })
      pop(stackRef.current)
    }
    if (action === 'tomorrow') await patchMany('tasks', ids, { date: addDays(day, 1), done: 0, doneAt: undefined })
    if (action === 'delete') await patchMany('tasks', ids, { deleted: 1 })
    endSelect()
  }

  // ---- editing ----
  const [editing, setEditing] = useState<Task | null>(null)
  const [leftoverOpen, setLeftoverOpen] = useState(false)

  return (
    <>
      <header className="screen-head">
        <div>
          <div className="date">{stampDay(day)}</div>
          <h1>kya kiya aaj?</h1>
        </div>
        {live.length > 0 && (
          <button
            className={`icon-btn ${selecting ? 'dark' : ''}`}
            aria-label={selecting ? 'stop selecting' : 'select tasks'}
            onClick={() => (selecting ? endSelect() : setSelecting(true))}
          >
            {selecting ? <X size={18} /> : <CheckSquare size={18} />}
          </button>
        )}
      </header>

      <div className="stack-wrap">
        <div ref={stackRef}>
          <StickyStack items={stackItems} size={STACK_SIZE} step={9} max={10} showText />
        </div>
        <div className="stack-meta">
          <div className="big">{doneCount}</div>
          <div className="small">
            {doneCount === 0
              ? live.length
                ? 'nothing yet. start with the tiniest one.'
                : 'a blank day. add one small thing.'
              : doneCount === 1
                ? 'thing done today. that counts.'
                : doneCount >= live.length
                  ? 'things done. everything on the list!'
                  : 'things done today. look at that pile.'}
          </div>
        </div>
      </div>

      {leftovers.length > 0 && !selecting && (
        <button className="banner" onClick={() => setLeftoverOpen(true)}>
          <RotateCcw size={16} />
          <span style={{ flex: 1 }}>
            {leftovers.length} unfinished from before. bring any here?
          </span>
          <ArrowRight size={16} />
        </button>
      )}

      {live.length > 0 && (
        <div className="chips" style={{ marginBottom: 12 }}>
          {(['all', 'todo', 'done'] as Filter[]).map((f) => (
            <button key={f} className={`chip ${filter === f ? 'on' : ''}`} onClick={() => setFilter(f)}>
              {f === 'all' ? `all ${live.length}` : f === 'todo' ? `to do ${live.length - doneCount}` : `done ${doneCount}`}
            </button>
          ))}
        </div>
      )}

      {list.length === 0 ? (
        <div className="empty">
          {live.length === 0
            ? 'what would make today feel okay?\ntype it below ↓'
            : filter === 'done'
              ? 'nothing ticked yet. no rush.'
              : 'all done. go do something nice.'}
        </div>
      ) : (
        <Reorder.Group axis="y" values={list} onReorder={setList} className="task-list" as="ul" style={{ paddingBottom: 80 }}>
          {list.map((t) => (
            <TaskRow
              key={t.id}
              task={t}
              selecting={selecting}
              selected={selected.has(t.id)}
              onToggle={toggle}
              onOpen={() => (selecting ? toggleSelect(t.id) : setEditing(t))}
              onLongPress={() => {
                setSelecting(true)
                toggleSelect(t.id)
              }}
              onDragStart={() => (dragging.current = true)}
              onDragEnd={commitOrder}
            />
          ))}
        </Reorder.Group>
      )}

      {selecting ? (
        <div className="addbar">
          <button className="btn" style={{ flex: 1 }} disabled={!selected.size} onClick={() => bulk('done')}>
            <CheckCheck size={18} /> done
          </button>
          <button className="btn" style={{ flex: 1 }} disabled={!selected.size} onClick={() => bulk('tomorrow')}>
            <ArrowRight size={18} /> tmrw
          </button>
          <button className="btn" style={{ color: 'var(--no)' }} disabled={!selected.size} onClick={() => bulk('delete')}>
            <Trash2 size={18} />
          </button>
        </div>
      ) : (
        <form
          className="addbar"
          onSubmit={(e) => {
            e.preventDefault()
            void add()
          }}
        >
          <input
            className="field"
            placeholder="add something…"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            enterKeyHint="done"
          />
          <button className="icon-btn dark" style={{ width: 48, height: 48, borderRadius: 14 }} aria-label="add">
            <Plus size={22} />
          </button>
        </form>
      )}

      {flyers.map((f) => (
        <motion.div
          key={f.id}
          className="fly"
          initial={{ left: f.from.left, top: f.from.top, width: f.from.width, height: f.from.height, rotate: 0, opacity: 0.9 }}
          animate={{
            left: f.toLeft,
            top: f.toTop,
            width: STACK_SIZE,
            height: STACK_SIZE,
            rotate: [0, -18, tilt(f.id, 4)],
            opacity: 1,
          }}
          transition={{ duration: 0.55, ease: [0.3, 0.7, 0.4, 1] }}
          onAnimationComplete={() => setFlyers((all) => all.filter((x) => x.id !== f.id))}
        >
          <Sticky color={f.color} style={{ width: '100%', height: '100%' }} />
        </motion.div>
      ))}

      <EditSheet task={editing} day={day} onClose={() => setEditing(null)} />
      <LeftoverSheet open={leftoverOpen} tasks={leftovers} day={day} onClose={() => setLeftoverOpen(false)} />
    </>
  )
}

function TaskRow({
  task,
  selecting,
  selected,
  onToggle,
  onOpen,
  onLongPress,
  onDragStart,
  onDragEnd,
}: {
  task: Task
  selecting: boolean
  selected: boolean
  onToggle: (t: Task, el: HTMLElement) => void
  onOpen: () => void
  onLongPress: () => void
  onDragStart: () => void
  onDragEnd: () => void
}) {
  const controls = useDragControls()
  const press = useRef<{ t: number; x: number; y: number; fired: boolean } | null>(null)

  return (
    <Reorder.Item
      value={task}
      dragListener={false}
      dragControls={controls}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      className={`task ${task.done ? 'done' : ''} ${selected ? 'selected' : ''}`}
      whileDrag={{ scale: 1.03, boxShadow: '0 12px 30px rgba(0,0,0,.15)', zIndex: 5 }}
      layout="position"
    >
      <span className="swatch" style={{ background: task.color }} />
      <motion.button
        className={`check ${task.done ? 'on' : ''}`}
        aria-label={task.done ? 'mark not done' : 'mark done'}
        whileTap={{ scale: 0.8 }}
        onClick={(e) => (selecting ? onOpen() : onToggle(task, e.currentTarget))}
      >
        <AnimatePresence>
          {task.done ? (
            <motion.span initial={{ scale: 0 }} animate={{ scale: 1 }} exit={{ scale: 0 }} style={{ display: 'flex' }}>
              <Check size={18} strokeWidth={3} />
            </motion.span>
          ) : null}
        </AnimatePresence>
      </motion.button>
      <div
        className="title"
        onPointerDown={(e) => {
          const p = { t: 0, x: e.clientX, y: e.clientY, fired: false }
          p.t = window.setTimeout(() => {
            p.fired = true
            if (!selecting) onLongPress()
          }, 450)
          press.current = p
        }}
        onPointerMove={(e) => {
          const p = press.current
          if (p && Math.hypot(e.clientX - p.x, e.clientY - p.y) > 8) clearTimeout(p.t)
        }}
        onPointerUp={() => {
          const p = press.current
          if (!p) return
          clearTimeout(p.t)
          if (!p.fired) onOpen()
          press.current = null
        }}
        onPointerCancel={() => press.current && clearTimeout(press.current.t)}
        onContextMenu={(e) => e.preventDefault()}
      >
        {task.title}
      </div>
      {!selecting && (
        <span className="handle" onPointerDown={(e) => controls.start(e)} aria-label="drag to reorder">
          <GripVertical size={18} />
        </span>
      )}
    </Reorder.Item>
  )
}

function EditSheet({ task, day, onClose }: { task: Task | null; day: string; onClose: () => void }) {
  const [title, setTitle] = useState('')
  const [color, setColor] = useState('')
  useEffect(() => {
    if (task) {
      setTitle(task.title)
      setColor(task.color)
    }
  }, [task])

  async function close() {
    if (task && (title.trim() !== task.title || color !== task.color) && title.trim()) {
      await patch('tasks', task.id, { title: title.trim(), color })
    }
    onClose()
  }

  return (
    <Sheet open={!!task} onClose={close}>
      {task && (
        <>
          <Sticky color={color} style={{ padding: 16, marginBottom: 18, aspectRatio: 'auto', minHeight: 140 }}>
            <textarea
              className="txt"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              rows={3}
              style={{ width: '100%', border: 0, background: 'none', outline: 'none', fontSize: 28, resize: 'none' }}
            />
          </Sticky>
          <div className="section-label" style={{ marginTop: 0 }}>
            note colour
          </div>
          <ColorDots colors={STICKY_COLORS} value={color} onChange={setColor} />
          <div className="sheet-actions">
            {task.done ? (
              <button
                className="btn"
                onClick={async () => {
                  await patch('tasks', task.id, { done: 0, doneAt: undefined })
                  onClose()
                }}
              >
                <RotateCcw size={18} /> not done
              </button>
            ) : (
              <button
                className="btn"
                onClick={async () => {
                  await patch('tasks', task.id, { title: title.trim() || task.title, color, date: addDays(day, 1) })
                  onClose()
                }}
              >
                <ArrowRight size={18} /> tomorrow
              </button>
            )}
            <button
              className="btn danger"
              onClick={async () => {
                await remove('tasks', task.id)
                onClose()
              }}
            >
              <Trash2 size={18} /> delete
            </button>
            <button className="btn" onClick={close}>
              <Check size={18} /> save
            </button>
          </div>
        </>
      )}
    </Sheet>
  )
}

function LeftoverSheet({ open, tasks, day, onClose }: { open: boolean; tasks: Task[]; day: string; onClose: () => void }) {
  const [picked, setPicked] = useState<Set<string>>(new Set())
  useEffect(() => {
    if (open) setPicked(new Set(tasks.map((t) => t.id)))
    // only reset when opening
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  async function bring() {
    const base = Date.now()
    let i = 0
    for (const id of picked) await patch('tasks', id, { date: day, order: base + i++ })
    const rest = tasks.filter((t) => !picked.has(t.id)).map((t) => t.id)
    if (rest.length) await patchMany('tasks', rest, { letGo: 1 })
    onClose()
  }

  async function letGoAll() {
    await patchMany('tasks', tasks.map((t) => t.id), { letGo: 1 })
    onClose()
  }

  return (
    <Sheet open={open} onClose={onClose}>
      <h2>left over from before</h2>
      <p className="muted" style={{ marginTop: -6, fontSize: 14 }}>
        pick what still matters. the rest can go. no guilt.
      </p>
      <div className="card-list" style={{ boxShadow: 'inset 0 0 0 1px var(--line)', marginBottom: 16 }}>
        {tasks.map((t) => (
          <button
            key={t.id}
            className="row"
            style={{ textAlign: 'left', width: '100%' }}
            onClick={() =>
              setPicked((s) => {
                const n = new Set(s)
                if (n.has(t.id)) n.delete(t.id)
                else n.add(t.id)
                return n
              })
            }
          >
            <span className={`check ${picked.has(t.id) ? 'on' : ''}`}>{picked.has(t.id) && <Check size={18} strokeWidth={3} />}</span>
            <span className="grow">
              {t.title}
              <div className="muted" style={{ fontSize: 12 }}>
                {prettyDay(t.date)}
              </div>
            </span>
          </button>
        ))}
      </div>
      <div style={{ display: 'flex', gap: 8 }}>
        <button className="btn" style={{ flex: 1 }} onClick={letGoAll}>
          let all go
        </button>
        <button className="btn primary" style={{ flex: 1.4 }} onClick={bring} disabled={!picked.size}>
          bring {picked.size || ''} to today
        </button>
      </div>
    </Sheet>
  )
}
