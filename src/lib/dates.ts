// Days are stored as local "YYYY-MM-DD" strings so a task belongs to the day you saw it on.

export function toKey(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export function fromKey(key: string): Date {
  const [y, m, d] = key.split('-').map(Number)
  return new Date(y, m - 1, d)
}

export function todayKey(): string {
  return toKey(new Date())
}

export function addDays(key: string, n: number): string {
  const d = fromKey(key)
  d.setDate(d.getDate() + n)
  return toKey(d)
}

export function prettyDay(key: string): string {
  const t = todayKey()
  if (key === t) return 'today'
  if (key === addDays(t, -1)) return 'yesterday'
  if (key === addDays(t, 1)) return 'tomorrow'
  return fromKey(key).toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'short' })
}

export function stampDay(key: string): string {
  return fromKey(key)
    .toLocaleDateString(undefined, { weekday: 'long', day: '2-digit', month: '2-digit' })
    .toLowerCase()
}

export function cap(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1)
}

export function ordinal(n: number): string {
  const t = n % 100
  if (t >= 11 && t <= 13) return `${n}th`
  return `${n}${['th', 'st', 'nd', 'rd'][n % 10] ?? 'th'}`
}

// Nobody counts their checklists, so each day gets a random-looking number of its own.
// Seeded by the date, so it stays the same all day and changes tomorrow.
export function checklistNumber(key: string): number {
  let h = 2166136261
  for (let i = 0; i < key.length; i++) h = Math.imul(h ^ key.charCodeAt(i), 16777619)
  return 100 + (Math.abs(h) % 900)
}
