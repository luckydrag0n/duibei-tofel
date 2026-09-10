import { mergeRemote, saveState } from './storage'
import type { AppState } from './types'

const API = 'https://jsonblob.com/api/jsonBlob'

function blobUrl(id: string) {
  return `${API}/${encodeURIComponent(id)}`
}

async function readId(res: Response) {
  const header = res.headers.get('x-jsonblob') || res.headers.get('X-jsonblob')
  if (header) return header
  const loc = res.headers.get('Location') || res.headers.get('location') || res.url
  const parts = loc.split('/').filter(Boolean)
  return parts[parts.length - 1] || ''
}

export function formatCabin(id: string) {
  return id.replace(/[^a-zA-Z0-9]/g, '')
}

export async function createCabin(state: AppState): Promise<string> {
  const res = await fetch(API, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify(state),
  })
  if (!res.ok) throw new Error('小屋创建失败')
  const id = formatCabin(await readId(res))
  if (!id) throw new Error('没有拿到小屋码')
  return id
}

export async function pullCabin(id: string): Promise<AppState> {
  const res = await fetch(blobUrl(id), { headers: { Accept: 'application/json' } })
  if (res.status === 404) throw new Error('小屋码无效，或太久没打开已经过期')
  if (!res.ok) throw new Error('同步失败')
  return (await res.json()) as AppState
}

export async function pushCabin(id: string, state: AppState) {
  const res = await fetch(blobUrl(id), {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify(state),
  })
  if (!res.ok) throw new Error('同步失败')
}

export async function syncNow(state: AppState): Promise<AppState> {
  if (!state.cabin) return state
  try {
    const remote = await pullCabin(state.cabin)
    const merged = mergeRemote(state, remote)
    merged.cabin = state.cabin
    merged.who = state.who
    await pushCabin(state.cabin, { ...merged, who: null })
    saveState(merged)
    return merged
  } catch (err) {
    console.warn(err)
    return state
  }
}
