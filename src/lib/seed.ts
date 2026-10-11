import { db, STICKY_COLORS } from './db'

const QUESTIONS = [
  'did you dance today?',
  'drank enough water?',
  'stepped outside for a bit?',
  'laughed at something dumb?',
  'ate a proper meal?',
  'doomscrolled less than usual?',
]

const NOTES = [
  'you are doing more than you think.',
  'rest is part of the work.',
  'one small thing is still a thing.',
  "be as kind to yourself as you'd be to a friend.",
  'bad days are allowed. they pass.',
]

// First launch only: give the app something to say.
export async function seedIfEmpty() {
  if (localStorage.getItem('kka:seeded')) return
  localStorage.setItem('kka:seeded', '1')
  if ((await db.questions.count()) > 0) return
  // Fixed ids and the oldest possible timestamp: every device seeds the same rows, they stay
  // local until edited, and any synced edit or deletion of them always wins.
  const base = { updatedAt: 1, deleted: 0 as const, dirty: 0 as const }
  await db.questions.bulkPut(
    QUESTIONS.map((text, i) => ({ ...base, id: `seed-q-${i}`, text, active: 1 as const, order: i })),
  )
  await db.selfNotes.bulkPut(
    NOTES.map((text, i) => ({ ...base, id: `seed-n-${i}`, text, color: STICKY_COLORS[i % STICKY_COLORS.length] })),
  )
}
