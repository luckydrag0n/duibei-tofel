import type { AppState, Mark, ProfileId, ProfileState } from './types'

const KEY = 'duibei-v2'

export const OTHER: Record<ProfileId, ProfileId> = { a: 'b', b: 'a' }

export function todayStamp(d = new Date()) {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export function emptyProfile(): ProfileState {
  return {
    cursor: 0,
    learned: {},
    today: todayStamp(),
    todayCount: 0,
    updatedAt: Date.now(),
  }
}

export function defaultState(): AppState {
  return {
    who: null,
    names: { a: '', b: '' },
    namesAt: 0,
    cabin: '',
    profiles: { a: emptyProfile(), b: emptyProfile() },
  }
}

function revive(raw: Partial<AppState> | null): AppState {
  const base = defaultState()
  if (!raw) return base
  return {
    who: raw.who === 'a' || raw.who === 'b' ? raw.who : null,
    names: {
      a: raw.names?.a?.trim() || '',
      b: raw.names?.b?.trim() || '',
    },
    namesAt: raw.namesAt || 0,
    cabin: raw.cabin || '',
    profiles: {
      a: { ...emptyProfile(), ...raw.profiles?.a, learned: raw.profiles?.a?.learned || {} },
      b: { ...emptyProfile(), ...raw.profiles?.b, learned: raw.profiles?.b?.learned || {} },
    },
  }
}

export function loadState(): AppState {
  try {
    const raw = localStorage.getItem(KEY)
    return revive(raw ? (JSON.parse(raw) as Partial<AppState>) : null)
  } catch {
    return defaultState()
  }
}

export function saveState(state: AppState) {
  localStorage.setItem(KEY, JSON.stringify(state))
}

export function rollToday(profile: ProfileState): ProfileState {
  const today = todayStamp()
  if (profile.today === today) return profile
  return { ...profile, today, todayCount: 0, updatedAt: Date.now() }
}

export function learnedCount(profile: ProfileState) {
  return Object.keys(profile.learned).length
}

export function markWord(
  profile: ProfileState,
  word: string,
  mark: Mark,
  nextCursor: number,
): ProfileState {
  const current = rollToday(profile)
  const existed = Boolean(current.learned[word])
  return {
    ...current,
    cursor: nextCursor,
    todayCount: existed ? current.todayCount : current.todayCount + 1,
    learned: {
      ...current.learned,
      [word]: { s: mark, t: Date.now() },
    },
    updatedAt: Date.now(),
  }
}

function unionProfile(a: ProfileState, b: ProfileState): ProfileState {
  const learned = { ...a.learned }
  for (const [word, entry] of Object.entries(b.learned || {})) {
    const prev = learned[word]
    if (!prev || entry.t >= prev.t) learned[word] = entry
  }
  const newer = (a.updatedAt || 0) >= (b.updatedAt || 0) ? a : b
  const today = todayStamp()
  return {
    cursor: Math.max(a.cursor || 0, b.cursor || 0),
    learned,
    today: newer.today || today,
    todayCount: newer.today === today ? newer.todayCount : 0,
    updatedAt: Math.max(a.updatedAt || 0, b.updatedAt || 0),
  }
}

export function mergeRemote(local: AppState, remote: AppState): AppState {
  const localNamesNewer = (local.namesAt || 0) >= (remote.namesAt || 0)
  return {
    ...local,
    names: localNamesNewer ? local.names : remote.names || local.names,
    namesAt: Math.max(local.namesAt || 0, remote.namesAt || 0),
    profiles: {
      a: unionProfile(local.profiles.a, remote.profiles?.a || emptyProfile()),
      b: unionProfile(local.profiles.b, remote.profiles?.b || emptyProfile()),
    },
  }
}

export function adoptJoin(local: AppState, remote: AppState, cabin: string): AppState {
  const myId = local.who || 'a'
  const myName = local.names[myId]?.trim() || '我'
  return {
    who: 'b',
    names: {
      a: remote.names?.a?.trim() || '对方',
      b: myName,
    },
    namesAt: Date.now(),
    cabin,
    profiles: {
      a: unionProfile(emptyProfile(), remote.profiles?.a || emptyProfile()),
      b: unionProfile(local.profiles[myId], remote.profiles?.b || emptyProfile()),
    },
  }
}
