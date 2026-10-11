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
