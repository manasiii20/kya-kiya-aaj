import Dexie, { type EntityTable } from 'dexie'

// Every record carries updatedAt + deleted + dirty so it can sync (last write wins).
interface Syncable {
  id: string
  updatedAt: number
  deleted: 0 | 1
  dirty: 0 | 1
}

export interface Task extends Syncable {
  title: string
  date: string // YYYY-MM-DD
  done: 0 | 1
  doneAt?: number
  order: number
  color: string
  letGo?: 0 | 1 // unfinished and consciously released, never nagged about again
  priority?: 0 | 1 | 2 | 3 // how big a deal, shown as flames; 0 or missing = no rush
}

export interface Question extends Syncable {
  text: string
  active: 0 | 1
  order: number
}

export interface Answer extends Syncable {
  // id = `${date}|${questionId}`
  date: string
  questionId: string
  yes: 0 | 1
}

export interface SelfNote extends Syncable {
  text: string
  color: string
}

export type Kind = 'tasks' | 'questions' | 'answers' | 'selfNotes'

export const db = new Dexie('kya-kiya-aaj') as Dexie & {
  tasks: EntityTable<Task, 'id'>
  questions: EntityTable<Question, 'id'>
  answers: EntityTable<Answer, 'id'>
  selfNotes: EntityTable<SelfNote, 'id'>
}

db.version(1).stores({
  tasks: 'id, date, dirty, [date+deleted]',
  questions: 'id, dirty',
  answers: 'id, date, dirty',
  selfNotes: 'id, dirty',
})

export const KINDS: Kind[] = ['tasks', 'questions', 'answers', 'selfNotes']

export const STICKY_COLORS = ['#ffe08a', '#ffc6c2', '#bfeec9', '#b9d7ff', '#d4c8ff', '#ffcdf0', '#ffd2a8']

export function randomColor(): string {
  return STICKY_COLORS[Math.floor(Math.random() * STICKY_COLORS.length)]
}

export function uid(): string {
  return crypto.randomUUID()
}

// Called after every local write so sync picks it up.
let onLocalChange: () => void = () => {}
export function setLocalChangeListener(fn: () => void) {
  onLocalChange = fn
}

export function stamp<T extends object>(patch: T): T & { updatedAt: number; dirty: 1 } {
  return { ...patch, updatedAt: Date.now(), dirty: 1 }
}

export async function put<K extends Kind>(kind: K, row: any) {
  await (db[kind] as any).put(stamp(row))
  onLocalChange()
}

export async function patch<K extends Kind>(kind: K, id: string, changes: object) {
  await (db[kind] as any).update(id, stamp(changes))
  onLocalChange()
}

export async function patchMany<K extends Kind>(kind: K, ids: string[], changes: object) {
  await db.transaction('rw', db[kind], async () => {
    for (const id of ids) await (db[kind] as any).update(id, stamp(changes))
  })
  onLocalChange()
}

export async function remove(kind: Kind, id: string) {
  await patch(kind, id, { deleted: 1 })
}
