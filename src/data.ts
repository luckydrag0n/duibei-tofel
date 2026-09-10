import type { Word } from './types'

let cache: Word[] | null = null

function dataUrl(file: string) {
  const base = import.meta.env.BASE_URL
  return `${base.endsWith('/') ? base : `${base}/`}data/${file}`
}

export async function loadWords(): Promise<Word[]> {
  if (cache) return cache

  try {
    const gz = await fetch(dataUrl('toefl.json.gz'))
    if (gz.ok && typeof DecompressionStream !== 'undefined' && gz.body) {
      const stream = gz.body.pipeThrough(new DecompressionStream('gzip'))
      cache = (await new Response(stream).json()) as Word[]
      return cache
    }
  } catch {
    // fall through to plain json
  }

  const res = await fetch(dataUrl('toefl.json'))
  if (!res.ok) throw new Error('词库加载失败')
  cache = (await res.json()) as Word[]
  return cache
}
