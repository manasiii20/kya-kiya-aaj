import { db, type SelfNote } from './db'

// Notes you wrote to yourself, surfaced now and then. Frequency is a per-device preference.

export type Frequency = 'often' | 'sometimes' | 'rarely' | 'never'

const FREQ = 'kka:noteFreq'
const LAST = 'kka:noteLast'

// Minimum gap between notes, and chance of one appearing after a tick.
const RULES: Record<Frequency, { gapMs: number; tickChance: number }> = {
  often: { gapMs: 60 * 60e3, tickChance: 0.5 },
  sometimes: { gapMs: 3 * 60 * 60e3, tickChance: 0.25 },
  rarely: { gapMs: 12 * 60 * 60e3, tickChance: 0.1 },
  never: { gapMs: Infinity, tickChance: 0 },
}

export function getFrequency(): Frequency {
  try {
    return (localStorage.getItem(FREQ) as Frequency) || 'sometimes'
  } catch {
    return 'sometimes'
  }
}

export function setFrequency(f: Frequency) {
  localStorage.setItem(FREQ, f)
}

let show: (n: SelfNote) => void = () => {}
export function onSelfNote(fn: (n: SelfNote) => void) {
  show = fn
}

async function pick(): Promise<SelfNote | undefined> {
  const notes = (await db.selfNotes.toArray()).filter((n) => !n.deleted && n.text.trim())
  return notes[Math.floor(Math.random() * notes.length)]
}

async function maybe(chance: number) {
  const { gapMs } = RULES[getFrequency()]
  const last = Number(localStorage.getItem(LAST) || 0)
  if (Date.now() - last < gapMs || Math.random() > chance) return
  const note = await pick()
  if (!note) return
  localStorage.setItem(LAST, String(Date.now()))
  show(note)
}

export const noteOnOpen = () => maybe(1)
export const noteAfterTick = () => maybe(RULES[getFrequency()].tickChance)

export async function noteNow() {
  const note = await pick()
  if (note) show(note)
}
