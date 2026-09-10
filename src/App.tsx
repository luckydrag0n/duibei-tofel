import { useCallback, useEffect, useMemo, useState } from 'react'
import { WordCard } from './WordCard'
import { loadWords } from './data'
import {
  OTHER,
  learnedCount,
  loadState,
  markWord,
  adoptJoin,
  rollToday,
  saveState,
} from './storage'
import { createCabin, formatCabin, pullCabin, pushCabin, syncNow } from './sync'
import type { AppState, Mark, ProfileId, Tab, Word } from './types'

function nextUnseen(
  words: Word[],
  learned: Record<string, unknown>,
  from: number,
) {
  if (!words.length) return -1
  for (let i = 0; i < words.length; i += 1) {
    const idx = (from + i) % words.length
    if (!learned[words[idx].w]) return idx
  }
  return -1
}

function labelOf(state: AppState, id: ProfileId) {
  return state.names[id]?.trim() || '还没连上'
}

function cheer(state: AppState) {
  if (!state.who) return '今天随时开始就行'
  const mine = state.profiles[state.who]
  const theirs = state.profiles[OTHER[state.who]]
  const theirName = state.names[OTHER[state.who]]?.trim()
  if (!theirName) {
    return mine.todayCount ? `今天你背了 ${mine.todayCount} 个` : '今天随时开始就行'
  }
  if (mine.todayCount === 0 && theirs.todayCount === 0) return '今天随时开始就行'
  if (theirs.todayCount > mine.todayCount) {
    return `${theirName} 今天已经背了 ${theirs.todayCount} 个`
  }
  if (mine.todayCount > theirs.todayCount) {
    return `今天你多背了 ${mine.todayCount - theirs.todayCount} 个`
  }
  if (theirs.todayCount === 0) return `今天你背了 ${mine.todayCount} 个`
  return `${theirName} 今天也背了 ${theirs.todayCount} 个`
}

export default function App() {
  const [words, setWords] = useState<Word[] | null>(null)
  const [error, setError] = useState('')
  const [state, setState] = useState<AppState>(() => loadState())
  const [tab, setTab] = useState<Tab>('learn')
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState<'all' | Mark>('all')
  const [openWord, setOpenWord] = useState<string | null>(null)
  const [busy, setBusy] = useState('')
  const [cabinInput, setCabinInput] = useState('')
  const [copied, setCopied] = useState(false)
  const [nick, setNick] = useState('')

  const persist = useCallback((next: AppState) => {
    const rolled: AppState = {
      ...next,
      profiles: {
        a: rollToday(next.profiles.a),
        b: rollToday(next.profiles.b),
      },
    }
    saveState(rolled)
    setState(rolled)
    return rolled
  }, [])

  const flush = useCallback(
    (next: AppState) => {
      const saved = persist(next)
      if (saved.cabin) void syncNow(saved).then(setState)
    },
    [persist],
  )

  useEffect(() => {
    void loadWords()
      .then(setWords)
      .catch(() => setError('词库加载失败，刷新一下试试'))
  }, [])

  useEffect(() => {
    if (!state.cabin) return
    const run = () => {
      void syncNow(loadState()).then(setState)
    }
    run()
    const timer = window.setInterval(run, 40000)
    window.addEventListener('focus', run)
    return () => {
      window.clearInterval(timer)
      window.removeEventListener('focus', run)
    }
  }, [state.cabin])

  const byWord = useMemo(() => {
    const map = new Map<string, Word>()
    for (const item of words || []) map.set(item.w, item)
    return map
  }, [words])

  const me = state.who ? state.profiles[state.who] : null
  const total = words?.length || 1
  const currentIndex =
    words && me ? nextUnseen(words, me.learned, me.cursor) : -1
  const current =
    words && currentIndex >= 0 ? words[currentIndex] : null
  const opened = openWord ? byWord.get(openWord) : null

  const book = useMemo(() => {
    if (!me || !words) return []
    const q = query.trim().toLowerCase()
    return Object.entries(me.learned)
      .map(([w, entry]) => ({ word: byWord.get(w), entry }))
      .filter((row) => {
        if (!row.word) return false
        if (filter !== 'all' && row.entry.s !== filter) return false
        if (!q) return true
        const meaning = row.word.t.map((item) => item.cn).join(' ')
        return (
          row.word.w.toLowerCase().includes(q) ||
          meaning.toLowerCase().includes(q)
        )
      })
      .sort((a, b) => b.entry.t - a.entry.t)
  }, [byWord, filter, me, query, words])

  function onMark(mark: Mark) {
    if (!state.who || !current || !words) return
    const nextCursor = (currentIndex + 1) % words.length
    flush({
      ...state,
      profiles: {
        ...state.profiles,
        [state.who]: markWord(
          state.profiles[state.who],
          current.w,
          mark,
          nextCursor,
        ),
      },
    })
  }

  async function createRoom() {
    setBusy('正在开小屋…')
    setError('')
    try {
      const id = await createCabin({ ...state, who: null })
      persist({ ...state, cabin: id })
    } catch {
      setError('开小屋失败，检查一下网络')
    } finally {
      setBusy('')
    }
  }

  async function joinRoom() {
    const id = formatCabin(cabinInput)
    if (!id) return
    setBusy('正在加入…')
    setError('')
    try {
      const remote = await pullCabin(id)
      const merged = adoptJoin(state, remote, id)
      await pushCabin(id, { ...merged, who: null })
      persist(merged)
      setCabinInput('')
    } catch (err) {
      setError(err instanceof Error ? err.message : '加入失败')
    } finally {
      setBusy('')
    }
  }

  async function copyCabin() {
    try {
      await navigator.clipboard.writeText(state.cabin)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1600)
    } catch {
      setCopied(false)
    }
  }

  function setMyName(name: string) {
    if (!state.who) return
    persist({
      ...state,
      names: { ...state.names, [state.who]: name },
      namesAt: Date.now(),
    })
  }

  function startWithNick() {
    const name = nick.trim()
    if (!name) return
    persist({
      ...state,
      who: 'a',
      names: { a: name, b: '' },
      namesAt: Date.now(),
    })
  }

  if (!words) {
    return (
      <div className="boot">
        <p className="logo">对背</p>
        <p>{error || '正在打开托福词库…'}</p>
      </div>
    )
  }

  if (!state.who || !state.names[state.who]?.trim()) {
    return (
      <div className="boot">
        <p className="logo">对背</p>
        <h1>你叫什么</h1>
        <p className="sub">两个人各自起一个昵称，后面就能看见对方背了多少。</p>
        <form
          className="nick-form"
          onSubmit={(e) => {
            e.preventDefault()
            startWithNick()
          }}
        >
          <input
            autoFocus
            maxLength={12}
            value={nick}
            onChange={(e) => setNick(e.target.value)}
            placeholder="输入昵称"
          />
          <button type="submit" className="solid" disabled={!nick.trim()}>
            开始背
          </button>
        </form>
      </div>
    )
  }

  const mineCount = learnedCount(state.profiles[state.who])
  const otherId = OTHER[state.who]
  const otherCount = learnedCount(state.profiles[otherId])

  return (
    <div className={tab === 'learn' && current ? 'shell learn' : 'shell'}>
      <button type="button" className="couple" onClick={() => setTab('us')}>
        <span className="person left">
          <b>{labelOf(state, state.who)}</b>
          <span className="bar">
            <i className="fill a" style={{ width: `${(mineCount / total) * 100}%` }} />
          </span>
          <em>{mineCount}</em>
        </span>
        <span className="person right">
          <b>{labelOf(state, otherId)}</b>
          <span className="bar">
            <i className="fill b" style={{ width: `${(otherCount / total) * 100}%` }} />
          </span>
          <em>{otherCount}</em>
        </span>
        <p className="cheer">{cheer(state)}</p>
      </button>

      <main className="main">
        {error ? <p className="banner">{error}</p> : null}

        {tab === 'learn' && current ? (
          <WordCard
            word={current}
            floatActions
            actions={
              <>
                <button type="button" className="ghost" onClick={() => onMark('f')}>
                  不太熟
                </button>
                <button type="button" className="solid" onClick={() => onMark('k')}>
                  记住了
                </button>
              </>
            }
          />
        ) : null}

        {tab === 'learn' && !current ? (
          <div className="empty">
            <h2>这本托福词都进词本了</h2>
            <p>以后想起来，去词本里翻就行。</p>
            <button type="button" className="solid" onClick={() => setTab('book')}>
              去词本
            </button>
          </div>
        ) : null}

        {tab === 'book' ? (
          <div className="book">
            <header className="book-head">
              <h1>词本</h1>
              <p>背过的 {mineCount} 个，随时点开看。</p>
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="搜单词或中文"
                type="search"
              />
              <div className="chips">
                <button type="button" className={filter === 'all' ? 'on' : ''} onClick={() => setFilter('all')}>
                  全部
                </button>
                <button type="button" className={filter === 'f' ? 'on' : ''} onClick={() => setFilter('f')}>
                  不太熟
                </button>
                <button type="button" className={filter === 'k' ? 'on' : ''} onClick={() => setFilter('k')}>
                  记住了
                </button>
              </div>
            </header>
            {book.length === 0 ? (
              <div className="empty">
                <p>{mineCount === 0 ? '还没背过。去背一个吧。' : '没有符合筛选的词。'}</p>
              </div>
            ) : (
              <ul className="book-list">
                {book.map((row) => (
                  <li key={row.word!.w}>
                    <button type="button" onClick={() => setOpenWord(row.word!.w)}>
                      <strong>{row.word!.w}</strong>
                      <span>{row.word!.t[0]?.cn || ''}</span>
                      <em>{row.entry.s === 'f' ? '不太熟' : '记住了'}</em>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        ) : null}

        {tab === 'us' ? (
          <div className="us">
            <h1>我们俩</h1>
            <p className="lead-line">
              {labelOf(state, state.who)} {mineCount} 个 · {labelOf(state, otherId)} {otherCount} 个
            </p>
            <section className="panel">
              <h3>我的昵称</h3>
              <label>
                改名字
                <input
                  maxLength={12}
                  value={state.names[state.who]}
                  onChange={(e) => setMyName(e.target.value)}
                  onBlur={() => void flush(loadState())}
                />
              </label>
            </section>
            <section className="panel">
              <h3>连上对方</h3>
              <p>开一间小屋，把码发给对方。两个人就能看见彼此背了多少。</p>
              {state.cabin ? (
                <>
                  <p className="code">{state.cabin}</p>
                  <div className="row">
                    <button type="button" className="solid" onClick={() => void copyCabin()}>
                      {copied ? '已复制' : '复制小屋码'}
                    </button>
                  </div>
                  <p className="fine">小屋大概 75 天没人打开会过期，本地词本不会丢。</p>
                </>
              ) : (
                <>
                  <button type="button" className="solid" disabled={Boolean(busy)} onClick={() => void createRoom()}>
                    {busy || '创建小屋'}
                  </button>
                  <p className="or">已经有码了</p>
                  <input
                    value={cabinInput}
                    onChange={(e) => setCabinInput(e.target.value)}
                    placeholder="粘贴小屋码"
                  />
                  <button type="button" className="ghost" disabled={Boolean(busy)} onClick={() => void joinRoom()}>
                    加入
                  </button>
                </>
              )}
            </section>
            <p className="fine">托福词库已去掉高考和四级里的简单词，还剩 {words.length} 个。加到主屏幕以后，点一下就能背。</p>
          </div>
        ) : null}
      </main>

      {opened && me ? (
        <div className="sheet" role="dialog">
          <div className="sheet-inner">
            <button type="button" className="close" onClick={() => setOpenWord(null)}>
              关闭
            </button>
            <WordCard
              word={opened}
              actions={
                <>
                  <button
                    type="button"
                    className={me.learned[opened.w]?.s === 'f' ? 'solid' : 'ghost'}
                    onClick={() => {
                      void flush({
                        ...state,
                        profiles: {
                          ...state.profiles,
                          [state.who!]: markWord(
                            state.profiles[state.who!],
                            opened.w,
                            'f',
                            state.profiles[state.who!].cursor,
                          ),
                        },
                      })
                    }}
                  >
                    不太熟
                  </button>
                  <button
                    type="button"
                    className={me.learned[opened.w]?.s === 'k' ? 'solid' : 'ghost'}
                    onClick={() => {
                      void flush({
                        ...state,
                        profiles: {
                          ...state.profiles,
                          [state.who!]: markWord(
                            state.profiles[state.who!],
                            opened.w,
                            'k',
                            state.profiles[state.who!].cursor,
                          ),
                        },
                      })
                    }}
                  >
                    记住了
                  </button>
                </>
              }
            />
          </div>
        </div>
      ) : null}

      <nav className="dock">
        <button type="button" className={tab === 'learn' ? 'on' : ''} onClick={() => setTab('learn')}>
          背单词
        </button>
        <button type="button" className={tab === 'book' ? 'on' : ''} onClick={() => setTab('book')}>
          词本
        </button>
      </nav>
    </div>
  )
}
