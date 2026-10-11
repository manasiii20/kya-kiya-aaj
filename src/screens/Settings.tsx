import { useLiveQuery } from 'dexie-react-hooks'
import { motion } from 'framer-motion'
import { ChevronLeft, Download, Eye, EyeOff, Plus, Trash2, Upload, X } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { ColorDots, Sheet } from '../components/Sheet'
import { Sticky, tilt } from '../components/Sticky'
import { db, KINDS, patch, put, randomColor, remove, STICKY_COLORS, uid, type SelfNote } from '../lib/db'
import { getFrequency, noteNow, setFrequency, type Frequency } from '../lib/selfNotes'
import { restoreAccount, saveAccount, syncNow, useSync } from '../lib/sync'

export function Settings({ onBack }: { onBack: () => void }) {
  return (
    <div className="app">
      <header className="screen-head" style={{ justifyContent: 'flex-start' }}>
        <button className="icon-btn" aria-label="back" onClick={onBack}>
          <ChevronLeft size={20} />
        </button>
        <h1>settings</h1>
      </header>
      <Notes />
      <Questions />
      <Backup />
    </div>
  )
}

function Notes() {
  const notes = useLiveQuery(() => db.selfNotes.filter((n) => !n.deleted).toArray(), []) ?? []
  const [editing, setEditing] = useState<SelfNote | null>(null)
  const [freq, setFreq] = useState<Frequency>(getFrequency())

  return (
    <section>
      <div className="section-label" style={{ marginTop: 0 }}>
        notes to future you, they pop up now and then
      </div>
      <div className="notes-wall">
        {notes.map((n) => (
          <motion.button key={n.id} whileTap={{ scale: 0.96 }} onClick={() => setEditing(n)} style={{ textAlign: 'left' }}>
            <Sticky color={n.color} rotate={tilt(n.id, 0.8)} className="note-card" style={{ justifyContent: 'flex-start' }}>
              <div className="note-text">{n.text}</div>
            </Sticky>
          </motion.button>
        ))}
        <motion.button
          whileTap={{ scale: 0.95 }}
          onClick={async () => {
            const n = { id: uid(), text: '', color: randomColor(), deleted: 0 as const, updatedAt: 0, dirty: 0 as const }
            setEditing(n)
          }}
          style={{
            aspectRatio: '1',
            borderRadius: 5,
            border: '1.5px dashed var(--ink-faint)',
            color: 'var(--ink-soft)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 6,
            fontSize: 14,
          }}
        >
          <Plus size={22} /> write one
        </motion.button>
      </div>

      <div className="section-label">how often</div>
      <div className="chips">
        {(['often', 'sometimes', 'rarely', 'never'] as Frequency[]).map((f) => (
          <button
            key={f}
            className={`chip ${freq === f ? 'on' : ''}`}
            onClick={() => {
              setFrequency(f)
              setFreq(f)
            }}
          >
            {f}
          </button>
        ))}
        <button className="chip" onClick={() => void noteNow()}>
          show me one
        </button>
      </div>

      <NoteSheet note={editing} onClose={() => setEditing(null)} />
    </section>
  )
}

function NoteSheet({ note, onClose }: { note: SelfNote | null; onClose: () => void }) {
  const [text, setText] = useState('')
  const [color, setColor] = useState('')
  useEffect(() => {
    if (note) {
      setText(note.text)
      setColor(note.color)
    }
  }, [note])

  async function save() {
    if (note && text.trim() && (text !== note.text || color !== note.color)) {
      await put('selfNotes', { ...note, text: text.trim(), color })
    }
    onClose()
  }

  return (
    <Sheet open={!!note} onClose={onClose}>
      {note && (
        <>
          <div className="sheet-head">
            <button className="icon-btn plain" aria-label="close" onClick={onClose}>
              <X size={20} />
            </button>
            <h2>{note.updatedAt > 0 ? 'edit note' : 'a note to future you'}</h2>
            <span />
          </div>
          <Sticky color={color} className="write-note">
            <textarea
              autoFocus={!note.text}
              placeholder="something you'd want to hear on a bad day"
              value={text}
              maxLength={200}
              onChange={(e) => setText(e.target.value)}
            />
          </Sticky>
          <ColorDots colors={STICKY_COLORS} value={color} onChange={setColor} />
          <div style={{ display: 'flex', gap: 8, marginTop: 22 }}>
            {note.updatedAt > 0 && (
              <button
                className="btn"
                style={{ flex: 1, color: 'var(--no)' }}
                onClick={async () => {
                  await remove('selfNotes', note.id)
                  onClose()
                }}
              >
                <Trash2 size={17} /> delete
              </button>
            )}
            <button className="btn primary" style={{ flex: 1.4 }} disabled={!text.trim()} onClick={save}>
              save
            </button>
          </div>
        </>
      )}
    </Sheet>
  )
}

function Questions() {
  const qs = (useLiveQuery(() => db.questions.filter((q) => !q.deleted).toArray(), []) ?? []).sort((a, b) => a.order - b.order)
  const [draft, setDraft] = useState('')

  return (
    <section>
      <div className="section-label">silly yes or no questions for the review deck</div>
      <div className="card-list">
        {qs.map((q) => (
          <div key={q.id} className={`row ${q.active ? '' : 'off'}`}>
            <div className="grow">
              <input
                className="inline"
                key={q.updatedAt}
                defaultValue={q.text}
                onBlur={(e) => e.target.value.trim() && e.target.value !== q.text && patch('questions', q.id, { text: e.target.value.trim() })}
              />
            </div>
            <button className="icon-btn" style={{ boxShadow: 'none' }} aria-label={q.active ? 'hide from deck' : 'show in deck'} onClick={() => patch('questions', q.id, { active: q.active ? 0 : 1 })}>
              {q.active ? <Eye size={18} /> : <EyeOff size={18} />}
            </button>
            <button className="icon-btn" style={{ boxShadow: 'none', color: 'var(--ink-faint)' }} aria-label="delete question" onClick={() => remove('questions', q.id)}>
              <Trash2 size={16} />
            </button>
          </div>
        ))}
        <form
          className="row"
          onSubmit={async (e) => {
            e.preventDefault()
            const text = draft.trim()
            if (!text) return
            setDraft('')
            const order = qs.length ? Math.max(...qs.map((q) => q.order)) + 1 : 0
            await put('questions', { id: uid(), text, active: 1, order, deleted: 0 })
          }}
        >
          <Plus size={18} style={{ color: 'var(--ink-faint)', flex: 'none' }} />
          <div className="grow">
            <input className="inline" placeholder="add one, like: sang in the shower?" value={draft} onChange={(e) => setDraft(e.target.value)} />
          </div>
        </form>
      </div>
    </section>
  )
}

function Backup() {
  const sync = useSync()
  const [email, setEmail] = useState('')
  const [msg, setMsg] = useState('')
  const [mode, setMode] = useState<'save' | 'restore'>('save')
  const fileRef = useRef<HTMLInputElement>(null)

  async function exportFile() {
    const dump: Record<string, unknown[]> = {}
    for (const k of KINDS) dump[k] = await (db[k] as any).toArray()
    const blob = new Blob([JSON.stringify({ app: 'kya-kiya-aaj', version: 1, at: Date.now(), ...dump })], { type: 'application/json' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `kya-kiya-aaj-${new Date().toISOString().slice(0, 10)}.json`
    a.click()
    URL.revokeObjectURL(a.href)
  }

  async function importFile(file: File) {
    try {
      const data = JSON.parse(await file.text())
      if (data.app !== 'kya-kiya-aaj') throw new Error('not a kya kiya aaj backup')
      let n = 0
      for (const k of KINDS) {
        for (const row of data[k] ?? []) {
          const cur = await (db[k] as any).get(row.id)
          if (!cur || cur.updatedAt < row.updatedAt) {
            await (db[k] as any).put({ ...row, dirty: 1 })
            n++
          }
        }
      }
      setMsg(`restored ${n} item${n === 1 ? '' : 's'}.`)
      void syncNow()
    } catch (e: any) {
      setMsg(e.message)
    }
  }

  const statusText = !sync.enabled
    ? 'saved on this phone only'
    : sync.status === 'syncing'
      ? 'backing up…'
      : sync.status === 'offline'
        ? 'offline. will back up when you are back.'
        : sync.status === 'error'
          ? `backup hiccup: ${sync.error}`
          : sync.lastSynced
            ? `backed up ${new Date(sync.lastSynced).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}`
            : 'backup ready'

  return (
    <section>
      <div className="section-label">your data</div>
      <div className="panel">
        <div className="sync-line">
          <span className={`dot ${sync.status === 'idle' ? 'ok' : sync.status === 'error' ? 'err' : ''}`} />
          {statusText}
        </div>

        {sync.enabled && (
          <div style={{ marginTop: 14 }}>
            {sync.email ? (
              <p style={{ margin: 0, fontSize: 14 }}>
                account saved as <b>{sync.email}</b>. sign in with it on any phone to get everything back.
              </p>
            ) : (
              <>
                <p className="muted" style={{ margin: '0 0 10px', fontSize: 14 }}>
                  {mode === 'save'
                    ? 'add your email so you can get everything back on a new phone.'
                    : 'saved your account before? get a sign-in link.'}
                </p>
                <form
                  style={{ display: 'flex', gap: 8 }}
                  onSubmit={async (e) => {
                    e.preventDefault()
                    setMsg('')
                    try {
                      if (mode === 'save') await saveAccount(email.trim())
                      else await restoreAccount(email.trim())
                      setMsg('check your inbox for a link.')
                    } catch (err: any) {
                      setMsg(err.message)
                    }
                  }}
                >
                  <input className="field" type="email" required placeholder="you@email.com" value={email} onChange={(e) => setEmail(e.target.value)} />
                  <button className="btn primary" style={{ flex: 'none' }}>{mode === 'save' ? 'save' : 'send'}</button>
                </form>
                <button className="muted" style={{ fontSize: 13, marginTop: 10, textDecoration: 'underline' }} onClick={() => setMode(mode === 'save' ? 'restore' : 'save')}>
                  {mode === 'save' ? 'i already have an account' : 'no, save this one instead'}
                </button>
              </>
            )}
          </div>
        )}

        <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
          <button className="btn" style={{ flex: 1, fontSize: 14 }} onClick={exportFile}>
            <Download size={16} /> export
          </button>
          <button className="btn" style={{ flex: 1, fontSize: 14 }} onClick={() => fileRef.current?.click()}>
            <Upload size={16} /> import
          </button>
          <input
            ref={fileRef}
            type="file"
            accept="application/json,.json"
            hidden
            onChange={(e) => {
              const f = e.target.files?.[0]
              if (f) void importFile(f)
              e.target.value = ''
            }}
          />
        </div>
        {msg && <p style={{ fontSize: 13, margin: '10px 0 0' }}>{msg}</p>}
      </div>
      <p className="muted" style={{ fontSize: 12, textAlign: 'center', margin: '20px 0 0', lineHeight: 1.5 }}>
        tip: add this to your home screen. it works offline and feels like a real app.
      </p>
    </section>
  )
}
