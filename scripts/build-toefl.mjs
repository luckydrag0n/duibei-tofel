import fs from 'node:fs'
import path from 'node:path'
import zlib from 'node:zlib'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const srcPath = path.join(root, 'scripts', 'raw', 'toefl.jsonl')
const outDir = path.join(root, 'public', 'data')
const outPath = path.join(outDir, 'toefl.json')

const MAX_PHRASES = 8
const MAX_SENTENCES = 4
const MAX_SYN_GROUPS = 4
const MAX_SYN_WORDS = 6

function tidy(value) {
  return String(value || '')
    .replace(/[’‘]/g, "'")
    .replace(/[“”]/g, '"')
    .trim()
}

function take(arr, n) {
  return Array.isArray(arr) ? arr.slice(0, n) : []
}

function score(entry) {
  return (
    (entry.s?.length || 0) * 3 +
    (entry.p?.length || 0) * 2 +
    (entry.y?.length || 0) +
    (entry.t?.length || 0)
  )
}

function convert(raw) {
  const content = raw?.content?.word?.content || {}
  const word = String(raw?.headWord || raw?.content?.word?.wordHead || '').trim()
  if (!word) return null

  const trans = take(content.trans, 6)
    .map((item) => ({
      p: item.pos || undefined,
      cn: tidy(item.tranCn),
      en: tidy(item.tranOther) || undefined,
    }))
    .filter((item) => item.cn || item.en)

  const phrases = take(content.phrase?.phrases, 16)
    .map((item) => ({
      e: tidy(item.pContent),
      c: tidy(item.pCn),
    }))
    .filter((item) => item.e && !/\[体育\]|【名】/.test(`${item.e}${item.c}`))
    .slice(0, MAX_PHRASES)

  const sentences = take(content.sentence?.sentences, MAX_SENTENCES)
    .map((item) => ({
      e: tidy(item.sContent),
      c: tidy(item.sCn),
    }))
    .filter((item) => item.e)

  const synonyms = take(content.syno?.synos, MAX_SYN_GROUPS)
    .map((item) => ({
      p: item.pos || undefined,
      ws: take(item.hwds, MAX_SYN_WORDS)
        .map((h) => String(h?.w || '').trim())
        .filter(Boolean),
    }))
    .filter((item) => item.ws.length)

  const tipRaw = content.remMethod
  const tip =
    typeof tipRaw === 'string'
      ? tipRaw.trim()
      : typeof tipRaw?.val === 'string'
        ? tipRaw.val.trim()
        : ''

  return {
    w: word,
    us: String(content.usphone || content.phone || '').trim() || undefined,
    uk: String(content.ukphone || '').trim() || undefined,
    t: trans,
    p: phrases,
    s: sentences,
    y: synonyms,
    ...(tip && tip.length < 80 ? { m: tip } : {}),
  }
}

function stemsOf(word) {
  const w = word.toLowerCase()
  const out = new Set([w])
  if (w.length <= 3) return out
  if (w.endsWith('ily') && w.length > 5) out.add(`${w.slice(0, -3)}y`)
  if (w.endsWith('ly') && w.length > 4) out.add(w.slice(0, -2))
  if (w.endsWith('ing') && w.length > 5) {
    out.add(w.slice(0, -3))
    out.add(`${w.slice(0, -3)}e`)
  }
  if (w.endsWith('est') && w.length > 5) out.add(w.slice(0, -3))
  if (w.endsWith('er') && w.length > 4) out.add(w.slice(0, -2))
  if (w.endsWith('ed') && w.length > 4) {
    out.add(w.slice(0, -2))
    out.add(w.slice(0, -1))
  }
  if (w.endsWith('ies') && w.length > 5) out.add(`${w.slice(0, -3)}y`)
  if (w.endsWith('es') && w.length > 4) out.add(w.slice(0, -2))
  if (w.endsWith('s') && !w.endsWith('ss') && w.length > 3) out.add(w.slice(0, -1))
  return out
}

function loadEasySet(file) {
  const set = new Set()
  const text = fs.readFileSync(file, 'utf8')
  for (const line of text.split(/\n/)) {
    const word = line.split(/\t/)[0].trim().toLowerCase()
    if (word) set.add(word)
  }
  return set
}

const easy = new Set([
  ...loadEasySet(path.join(root, 'scripts', 'raw', 'chuzhong.txt')),
  ...loadEasySet(path.join(root, 'scripts', 'raw', 'gaokao.txt')),
  ...loadEasySet(path.join(root, 'scripts', 'raw', 'cet4.txt')),
])

function isEasyWord(word) {
  const w = word.toLowerCase()
  if (w.length <= 3) return true
  if (['cannot', "can't", 'ok', 'okay'].includes(w)) return true
  for (const stem of stemsOf(w)) {
    if (easy.has(stem)) return true
  }
  return false
}

const raw = fs.readFileSync(srcPath, 'utf8')
const lines = raw.split(/\n/).filter(Boolean)
const byWord = new Map()
let skipped = 0
let easyDropped = 0

for (const line of lines) {
  let parsed
  try {
    parsed = JSON.parse(line)
  } catch {
    skipped += 1
    continue
  }
  const entry = convert(parsed)
  if (!entry) {
    skipped += 1
    continue
  }
  const key = entry.w.toLowerCase()
  if (isEasyWord(key)) {
    easyDropped += 1
    continue
  }
  const prev = byWord.get(key)
  if (!prev || score(entry) > score(prev)) byWord.set(key, entry)
}

const words = [...byWord.values()]
fs.mkdirSync(outDir, { recursive: true })
const json = JSON.stringify(words)
fs.writeFileSync(outPath, json)
fs.writeFileSync(`${outPath}.gz`, zlib.gzipSync(json, { level: 9 }))

const withSent = words.filter((w) => w.s.length).length
const withPhr = words.filter((w) => w.p.length).length
const withSyn = words.filter((w) => w.y.length).length
const bytes = fs.statSync(outPath).size

console.log(
  JSON.stringify(
    {
      sourceLines: lines.length,
      uniqueWords: words.length,
      easyDropped,
      easyListSize: easy.size,
      skipped,
      withSentences: withSent,
      withPhrases: withPhr,
      withSynonyms: withSyn,
      first: words[0]?.w,
      kb: Math.round(bytes / 1024),
      gzKb: Math.round(fs.statSync(`${outPath}.gz`).size / 1024),
      out: outPath,
    },
    null,
    2,
  ),
)
