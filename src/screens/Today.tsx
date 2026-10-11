import { useLiveQuery } from 'dexie-react-hooks'
import { AnimatePresence, motion, Reorder, useDragControls } from 'framer-motion'
import { ArrowRight, CalendarDays, Check, CheckCheck, ChevronDown, GripVertical, LayoutGrid, List, RotateCcw, Settings, Trash2, X } from 'lucide-react'
import { useEffect, useMemo, useRef, useState, type PointerEvent as RPointerEvent } from 'react'
import { createPortal } from 'react-dom'
import { Sheet } from '../components/Sheet'
import { stackPad, Sticky, StickyStack, tilt } from '../components/Sticky'
import { TaskSheet } from '../components/TaskSheet'
import { pop } from '../lib/celebrate'
import { addDays, prettyDay, todayKey } from '../lib/dates'
import { db, patch, patchMany, type Task } from '../lib/db'
import { noteAfterTick } from '../lib/selfNotes'

type Filter = 'all' | 'todo' | 'done'
type View = 'notes' | 'list'
type Flyer = { id: string; color: string; from: DOMRect; toLeft: number; toTop: number }

const PILE = 76

function loadView(): View {
  try {
    return localStorage.getItem('kka:view') === 'list' ? 'list' : 'notes'
  } catch {
    return 'notes'
  }
}

// Tap opens, hold selects. Movement cancels the hold so scrolling stays smooth.
function useLongPress(onTap: () => void, onHold: () => void) {
  const p = useRef<{ t: number; x: number; y: number; fired: boolean; moved: boolean } | null>(null)
  return {
    onPointerDown: (e: RPointerEvent) => {
      const s = { t: 0, x: e.clientX, y: e.clientY, fired: false, moved: false }
      s.t = window.setTimeout(() => {
        s.fired = true
        onHold()
      }, 450)
      p.current = s
    },
    onPointerMove: (e: RPointerEvent) => {
      const s = p.current
      if (s && Math.hypot(e.clientX - s.x, e.clientY - s.y) > 8) {
        s.moved = true
        clearTimeout(s.t)
      }
    },
    onPointerUp: () => {
      const s = p.current
      if (!s) return
      clearTimeout(s.t)
      if (!s.fired && !s.moved) onTap()
      p.current = null
    },
    onPointerCancel: () => {
      if (p.current) clearTimeout(p.current.t)
      p.current = null
    },
    onContextMenu: (e: { preventDefault: () => void }) => e.preventDefault(),
  }
}

export function Today({
  day,
  setDay,
  onSettings,
  dockSlot,
}: {
  day: string
  setDay: (d: string) => void
  onSettings: () => void
  dockSlot: HTMLElement | null
}) {
  const today = todayKey()
  const tasks = useLiveQuery(() => db.tasks.where('date').equals(day).toArray(), [day]) ?? []
  const leftovers =
    useLiveQuery(
      () =>
        db.tasks
          .where('date')
          .between(addDays(today, -14), today, true, false)
          .filter((t) => !t.deleted && !t.done && !t.letGo)
          .toArray(),
      [today],
    ) ?? []

  const live = useMemo(() => tasks.filter((t) => !t.deleted), [tasks])
  const open = useMemo(() => live.filter((t) => !t.done).sort((a, b) => a.order - b.order), [live])
  const finished = useMemo(() => live.filter((t) => t.done).sort((a, b) => (a.doneAt ?? 0) - (b.doneAt ?? 0)), [live])

  const [view, setView] = useState<View>(loadView)
  const [filter, setFilter] = useState<Filter>('all')
  function changeView(v: View) {
    setView(v)
    try {
      localStorage.setItem('kka:view', v)
    } catch {
      // per-device preference only
    }
  }

  // ---- the pile + flying note ----
  const pileRef = useRef<HTMLDivElement>(null)
  const [flyers, setFlyers] = useState<Flyer[]>([])
  const inFlight = new Set(flyers.map((f) => f.id))
  const pileItems = finished.filter((t) => !inFlight.has(t.id))

  async function toggle(t: Task, from: HTMLElement) {
    if (t.done) {
      await patch('tasks', t.id, { done: 0, doneAt: undefined })
      return
    }
    pop(from)
    const pile = pileRef.current
    if (pile) {
      // Landing spot is fixed at tick time so later ticks can't retarget a note mid-flight.
      const to = pile.getBoundingClientRect()
      const layers = Math.min(pileItems.length + flyers.length, 7)
      const flyer: Flyer = {
        id: t.id,
        color: t.color,
        from: from.getBoundingClientRect(),
        toLeft: to.left + stackPad(PILE),
        toTop: to.bottom - PILE - layers * Math.max(1.5, PILE * 0.03),
      }
      setFlyers((f) => [...f, flyer])
      window.setTimeout(() => setFlyers((f) => f.filter((x) => x !== flyer)), 1100)
    }
    await patch('tasks', t.id, { done: 1, doneAt: Date.now() })
    void noteAfterTick()
  }

  // ---- list reordering (open tasks only) ----
  const [ordered, setOrdered] = useState<Task[]>([])
  const dragging = useRef(false)
  const orderedRef = useRef(ordered)
  orderedRef.current = ordered
  useEffect(() => {
    if (!dragging.current) setOrdered(open)
  }, [open])
  async function commitOrder() {
    dragging.current = false
    const current = orderedRef.current
    const slots = current.map((t) => t.order).sort((a, b) => a - b)
    for (const [i, t] of current.entries()) if (t.order !== slots[i]) await patch('tasks', t.id, { order: slots[i] })
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
      pop(pileRef.current)
    }
    if (action === 'tomorrow') await patchMany('tasks', ids, { date: addDays(day, 1), done: 0, doneAt: undefined, order: Date.now() })
    if (action === 'delete') await patchMany('tasks', ids, { deleted: 1 })
    endSelect()
  }

  const [editing, setEditing] = useState<Task | null>(null)
  const [leftoverOpen, setLeftoverOpen] = useState(false)
  const [dayPicker, setDayPicker] = useState(false)

  function tap(t: Task) {
    if (selecting) toggleSelect(t.id)
    else setEditing(t)
  }
  function hold(t: Task) {
    if (!selecting) setSelecting(true)
    toggleSelect(t.id)
  }

  const shownOpen = filter === 'done' ? [] : view === 'list' ? ordered : open
  const shownDone = filter === 'todo' ? [] : finished
  const total = live.length
  const doneCount = finished.length

  return (
    <>
      <header className="screen-head">
        <h1>
          notes{' '}
          <button
            className="soft"
            onClick={() => setDayPicker(true)}
            style={{ font: 'inherit', display: 'inline-flex', alignItems: 'center', gap: 2 }}
          >
            {prettyDay(day)}
            <ChevronDown size={20} strokeWidth={2.5} />
          </button>
        </h1>
        <div className="head-actions">
          {selecting ? (
            <button className="icon-btn" aria-label="stop selecting" onClick={endSelect}>
              <X size={19} />
            </button>
          ) : (
            <button className="icon-btn" aria-label="settings" onClick={onSettings}>
              <Settings size={19} />
            </button>
          )}
        </div>
      </header>

      <div className="pile">
        <div ref={pileRef}>
          <StickyStack items={pileItems} size={PILE} />
        </div>
        <div>
          <div className="count">
            {doneCount}
            {total > 0 && <span className="of"> of {total}</span>}
          </div>
          <div className="line">
            {doneCount === 0
              ? total
                ? 'nothing yet. start with the tiniest one.'
                : 'a blank page. add one small thing.'
              : doneCount >= total
                ? 'all done. look at that pile.'
                : doneCount === 1
                  ? 'one done. that counts.'
                  : 'done so far. keep stacking.'}
          </div>
        </div>
      </div>

      {day === today && leftovers.length > 0 && !selecting && (
        <button className="banner" onClick={() => setLeftoverOpen(true)}>
          <RotateCcw size={16} />
          <span style={{ flex: 1 }}>{leftovers.length} unfinished from before. bring any here?</span>
          <ArrowRight size={16} />
        </button>
      )}

      {total > 0 && (
        <div className="toolbar">
          <div className="segmented" aria-label="filter">
            {(['all', 'todo', 'done'] as Filter[]).map((f) => (
              <button key={f} className={filter === f ? 'on' : ''} onClick={() => setFilter(f)}>
                {f === 'todo' ? 'to do' : f}
              </button>
            ))}
          </div>
          <div className="segmented" aria-label="view">
            <button className={view === 'notes' ? 'on' : ''} aria-label="notes view" onClick={() => changeView('notes')}>
              <LayoutGrid size={16} />
            </button>
            <button className={view === 'list' ? 'on' : ''} aria-label="list view" onClick={() => changeView('list')}>
              <List size={17} />
            </button>
          </div>
        </div>
      )}

      {shownOpen.length + shownDone.length === 0 ? (
        <div className="empty">
          {total === 0
            ? `what would make ${day === today ? 'today' : 'this day'} feel okay?\ntap + to add it.`
            : filter === 'done'
              ? 'nothing ticked yet. no rush.'
              : 'all done. go do something nice.'}
        </div>
      ) : view === 'notes' ? (
        <ul className="note-grid">
          <AnimatePresence initial={false}>
            {[...shownOpen, ...shownDone].map((t) => (
              <NoteCard
                key={t.id}
                task={t}
                selected={selected.has(t.id)}
                onToggle={(el) => (selecting ? toggleSelect(t.id) : toggle(t, el))}
                press={{ tap: () => tap(t), hold: () => hold(t) }}
              />
            ))}
          </AnimatePresence>
        </ul>
      ) : (
        <>
          {shownOpen.length > 0 && (
            <Reorder.Group axis="y" values={ordered} onReorder={setOrdered} className="task-list" as="ul">
              {shownOpen.map((t) => (
                <ListRow
                  key={t.id}
                  task={t}
                  selecting={selecting}
                  selected={selected.has(t.id)}
                  onToggle={(el) => (selecting ? toggleSelect(t.id) : toggle(t, el))}
                  press={{ tap: () => tap(t), hold: () => hold(t) }}
                  onDragStart={() => (dragging.current = true)}
                  onDragEnd={commitOrder}
                />
              ))}
            </Reorder.Group>
          )}
          {shownDone.length > 0 && (
            <ul className="task-list" style={{ marginTop: shownOpen.length ? 8 : 0 }}>
              {shownDone.map((t) => (
                <ListRow
                  key={t.id}
                  task={t}
                  selecting={selecting}
                  selected={selected.has(t.id)}
                  onToggle={(el) => (selecting ? toggleSelect(t.id) : toggle(t, el))}
                  press={{ tap: () => tap(t), hold: () => hold(t) }}
                />
              ))}
            </ul>
          )}
        </>
      )}

      {dockSlot &&
        selecting &&
        createPortal(
          <div className="bulkbar">
            <button className="btn" disabled={!selected.size} onClick={() => bulk('done')}>
              <CheckCheck size={18} /> done
            </button>
            <button className="btn" disabled={!selected.size} onClick={() => bulk('tomorrow')}>
              <ArrowRight size={18} /> tomorrow
            </button>
            <button
              className="btn"
              style={{ flex: 'none', width: 56, color: 'var(--no)' }}
              aria-label="delete"
              disabled={!selected.size}
              onClick={() => bulk('delete')}
            >
              <Trash2 size={18} />
            </button>
          </div>,
          dockSlot,
        )}

      {flyers.map((f) => (
        <motion.div
          key={f.id}
          className="fly"
          initial={{ left: f.from.left, top: f.from.top, width: f.from.width, height: f.from.height, rotate: 0 }}
          animate={{ left: f.toLeft, top: f.toTop, width: PILE, height: PILE, rotate: tilt(f.id, 2) }}
          transition={{ duration: 0.5, ease: [0.32, 0.72, 0.3, 1] }}
          onAnimationComplete={() => setFlyers((all) => all.filter((x) => x.id !== f.id))}
        >
          <Sticky color={f.color} style={{ width: '100%', height: '100%', aspectRatio: 'auto', padding: 0 }} />
        </motion.div>
      ))}

      <TaskSheet open={!!editing} task={editing} defaultDay={day} onClose={() => setEditing(null)} />
      <LeftoverSheet open={leftoverOpen} tasks={leftovers} day={today} onClose={() => setLeftoverOpen(false)} />
      <DayPicker
        open={dayPicker}
        day={day}
        onPick={(d) => {
          setDay(d)
          setDayPicker(false)
        }}
        onClose={() => setDayPicker(false)}
      />
    </>
  )
}

function Check16({ on }: { on: boolean }) {
  return (
    <motion.span className={`check ${on ? 'on' : ''}`} whileTap={{ scale: 0.82 }}>
      {on ? <Check size={16} strokeWidth={3} /> : null}
    </motion.span>
  )
}

function NoteCard({
  task,
  selected,
  onToggle,
  press,
}: {
  task: Task
  selected: boolean
  onToggle: (el: HTMLElement) => void
  press: { tap: () => void; hold: () => void }
}) {
  const handlers = useLongPress(press.tap, press.hold)
  const ref = useRef<HTMLLIElement>(null)
  return (
    <motion.li
      ref={ref}
      layout
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.9 }}
      transition={{ type: 'spring', stiffness: 380, damping: 32 }}
      style={{ listStyle: 'none' }}
    >
      <Sticky
        color={task.color}
        rotate={tilt(task.id, 0.8)}
        className={`note-card ${task.done ? 'done' : ''} ${selected ? 'selected' : ''}`}
      >
        <div {...handlers} style={{ position: 'absolute', inset: 0 }} />
        <button
          className="check-hit"
          style={{ position: 'relative', zIndex: 1 }}
          role="checkbox"
          aria-checked={!!task.done}
          aria-label={task.title}
          onClick={() => ref.current && onToggle(ref.current)}
        >
          <Check16 on={!!task.done} />
        </button>
        <div className="note-text" style={{ position: 'relative', pointerEvents: 'none' }}>
          {task.title}
        </div>
      </Sticky>
    </motion.li>
  )
}

function ListRow({
  task,
  selecting,
  selected,
  onToggle,
  press,
  onDragStart,
  onDragEnd,
}: {
  task: Task
  selecting: boolean
  selected: boolean
  onToggle: (el: HTMLElement) => void
  press: { tap: () => void; hold: () => void }
  onDragStart?: () => void
  onDragEnd?: () => void
}) {
  const controls = useDragControls()
  const handlers = useLongPress(press.tap, press.hold)
  const draggable = !!onDragEnd && !selecting
  const inner = (
    <>
      <button
        className="check-hit"
        role="checkbox"
        aria-checked={!!task.done}
        aria-label={task.title}
        onClick={(e) => onToggle(e.currentTarget)}
      >
        <Check16 on={!!task.done} />
      </button>
      <div className="title" {...handlers}>
        {task.title}
      </div>
      <span className="swatch" style={{ background: task.color }} />
      {draggable ? (
        <span className="handle" onPointerDown={(e) => controls.start(e)} aria-label="drag to reorder">
          <GripVertical size={18} />
        </span>
      ) : (
        <span style={{ width: 8 }} />
      )}
    </>
  )
  const cls = `task ${task.done ? 'done' : ''} ${selected ? 'selected' : ''}`
  if (!onDragEnd) return <li className={cls}>{inner}</li>
  return (
    <Reorder.Item
      value={task}
      dragListener={false}
      dragControls={controls}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      className={cls}
      whileDrag={{ scale: 1.02, boxShadow: '0 12px 30px rgba(0,0,0,.14)', zIndex: 5 }}
      layout="position"
    >
      {inner}
    </Reorder.Item>
  )
}

function DayPicker({ open, day, onPick, onClose }: { open: boolean; day: string; onPick: (d: string) => void; onClose: () => void }) {
  const today = todayKey()
  const ref = useRef<HTMLInputElement>(null)
  const options = [addDays(today, -1), today, addDays(today, 1)]
  return (
    <Sheet open={open} onClose={onClose}>
      <div className="sheet-head">
        <button className="icon-btn plain" aria-label="close" onClick={onClose}>
          <X size={20} />
        </button>
        <h2>which day?</h2>
        <span />
      </div>
      <div className="chips" style={{ justifyContent: 'center', marginBottom: 8 }}>
        {options.map((d) => (
          <button key={d} className={`chip ${d === day ? 'on' : ''}`} onClick={() => onPick(d)}>
            {prettyDay(d)}
          </button>
        ))}
        <button
          className={`chip ${!options.includes(day) ? 'on' : ''}`}
          style={{ position: 'relative' }}
          onClick={() => {
            const el = ref.current
            try {
              el?.showPicker()
            } catch {
              el?.focus()
            }
          }}
        >
          <CalendarDays size={15} /> {options.includes(day) ? 'pick a date' : prettyDay(day)}
          <input ref={ref} className="date-input" type="date" value={day} onChange={(e) => e.target.value && onPick(e.target.value)} />
        </button>
      </div>
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

  return (
    <Sheet open={open} onClose={onClose}>
      <div className="sheet-head">
        <button className="icon-btn plain" aria-label="close" onClick={onClose}>
          <X size={20} />
        </button>
        <h2>left over from before</h2>
        <span />
      </div>
      <p className="muted" style={{ margin: '-6px 0 14px', fontSize: 14, textAlign: 'center' }}>
        pick what still matters. the rest can go. no guilt.
      </p>
      <div className="card-list" style={{ marginBottom: 14 }}>
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
            <span className={`check ${picked.has(t.id) ? 'on' : ''}`}>{picked.has(t.id) && <Check size={16} strokeWidth={3} />}</span>
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
        <button
          className="btn"
          style={{ flex: 1 }}
          onClick={async () => {
            await patchMany('tasks', tasks.map((t) => t.id), { letGo: 1 })
            onClose()
          }}
        >
          let all go
        </button>
        <button className="btn primary" style={{ flex: 1.4 }} onClick={bring} disabled={!picked.size}>
          bring {picked.size || ''} to today
        </button>
      </div>
    </Sheet>
  )
}
