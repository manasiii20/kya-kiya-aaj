import { createClient, type SupabaseClient, type User } from '@supabase/supabase-js'
import { useSyncExternalStore } from 'react'
import { db, KINDS, setLocalChangeListener, type Kind } from './db'

// The phone is the source of truth. When Supabase is configured, a silent anonymous
// account backs everything up and an email can be attached later to restore elsewhere.

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined
const key = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined

export const supabase: SupabaseClient | null = url && key ? createClient(url, key) : null

export type SyncState = {
  enabled: boolean
  status: 'off' | 'idle' | 'syncing' | 'offline' | 'error'
  lastSynced?: number
  email?: string
  error?: string
}

let state: SyncState = { enabled: !!supabase, status: supabase ? 'idle' : 'off' }
const listeners = new Set<() => void>()
function set(next: Partial<SyncState>) {
  state = { ...state, ...next }
  listeners.forEach((l) => l())
}

export function useSync(): SyncState {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l)
      return () => listeners.delete(l)
    },
    () => state,
  )
}

const CURSOR = 'kka:pullCursor'
const SYNCED_USER = 'kka:syncedUser'

async function ensureUser(): Promise<User | null> {
  if (!supabase) return null
  const { data } = await supabase.auth.getSession()
  if (data.session) return data.session.user
  const { data: anon, error } = await supabase.auth.signInAnonymously()
  if (error) throw error
  return anon.user
}

async function push() {
  for (const kind of KINDS) {
    const rows = await (db[kind] as any).where('dirty').equals(1).toArray()
    if (!rows.length) continue
    const payload = rows.map(({ dirty: _d, ...data }: any) => ({
      kind,
      id: data.id,
      data,
      updated_at: data.updatedAt,
      deleted: !!data.deleted,
    }))
    const { error } = await supabase!.from('records').upsert(payload, { onConflict: 'user_id,kind,id' })
    if (error) throw error
    // Only clear rows that weren't edited again while we were uploading.
    await db.transaction('rw', db[kind], async () => {
      for (const r of rows) {
        const cur = await (db[kind] as any).get(r.id)
        if (cur && cur.updatedAt === r.updatedAt) await (db[kind] as any).update(r.id, { dirty: 0 })
      }
    })
  }
}

async function pull() {
  let cursor = localStorage.getItem(CURSOR) ?? '1970-01-01T00:00:00Z'
  for (;;) {
    const { data, error } = await supabase!
      .from('records')
      .select('kind,id,data,updated_at,server_at')
      .gt('server_at', cursor)
      .order('server_at')
      .limit(500)
    if (error) throw error
    if (!data.length) break
    for (const r of data) {
      const table = db[r.kind as Kind] as any
      if (!table) continue
      const local = await table.get(r.id)
      if (!local || (!local.dirty && local.updatedAt <= r.updated_at) || local.updatedAt < r.updated_at) {
        await table.put({ ...r.data, dirty: 0 })
      }
      cursor = r.server_at
    }
    localStorage.setItem(CURSOR, cursor)
    if (data.length < 500) break
  }
}

let running: Promise<void> | null = null
let again = false

export function syncNow(): Promise<void> {
  if (!supabase) return Promise.resolve()
  if (running) {
    again = true
    return running
  }
  running = (async () => {
    if (!navigator.onLine) {
      set({ status: 'offline' })
      return
    }
    set({ status: 'syncing', error: undefined })
    try {
      const user = await ensureUser()
      if (!user) return
      // Switched accounts (e.g. restored via email): re-upload everything here, re-pull everything there.
      if (localStorage.getItem(SYNCED_USER) !== user.id) {
        localStorage.removeItem(CURSOR)
        for (const kind of KINDS) await (db[kind] as any).toCollection().modify({ dirty: 1 })
        localStorage.setItem(SYNCED_USER, user.id)
      }
      await push()
      await pull()
      set({ status: 'idle', lastSynced: Date.now(), email: user.is_anonymous ? undefined : user.email })
    } catch (e: any) {
      set({ status: 'error', error: e?.message ?? String(e) })
    }
  })().finally(() => {
    running = null
    if (again) {
      again = false
      void syncNow()
    }
  })
  return running
}

let timer: number | undefined
function scheduleSync() {
  window.clearTimeout(timer)
  timer = window.setTimeout(() => void syncNow(), 1500)
}

export function startSync() {
  if (!supabase) return
  setLocalChangeListener(scheduleSync)
  window.addEventListener('online', () => void syncNow())
  window.addEventListener('offline', () => set({ status: 'offline' }))
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') void syncNow()
  })
  supabase.auth.onAuthStateChange((event) => {
    if (event === 'SIGNED_IN' || event === 'USER_UPDATED') scheduleSync()
  })
  void syncNow()
}

// Attach an email to the current anonymous account so it can be restored later.
export async function saveAccount(email: string) {
  if (!supabase) throw new Error('cloud backup is not set up')
  const { error } = await supabase.auth.updateUser({ email }, { emailRedirectTo: location.origin })
  if (error) throw error
}

// On a new phone: magic link into the saved account; local entries merge into it.
export async function restoreAccount(email: string) {
  if (!supabase) throw new Error('cloud backup is not set up')
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: { shouldCreateUser: false, emailRedirectTo: location.origin },
  })
  if (error) throw error
}
