import type { ReactNode } from 'react'
import type { Word } from './types'

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function Highlighted({ text, word }: { text: string; word: string }) {
  const re = new RegExp(`\\b(${escapeRegExp(word)}[a-z]*)\\b`, 'gi')
  const nodes: ReactNode[] = []
  let last = 0
  let key = 0
  for (const match of text.matchAll(re)) {
    const index = match.index ?? 0
    if (index > last) nodes.push(text.slice(last, index))
    nodes.push(<mark key={key++}>{match[0]}</mark>)
    last = index + match[0].length
  }
  if (last < text.length) nodes.push(text.slice(last))
  return <>{nodes.length ? nodes : text}</>
}

function play(word: string) {
  const src = `https://dict.youdao.com/dictvoice?audio=${encodeURIComponent(word)}&type=2`
  const audio = new Audio(src)
  void audio.play()
}

export function WordCard({
  word,
  actions,
  floatActions,
}: {
  word: Word
  actions?: ReactNode
  floatActions?: boolean
}) {
  const meaning = word.t[0]?.cn || ''

  return (
    <article className={floatActions ? 'card has-float' : 'card'}>
      {word.s[0] ? (
        <section className="block quote">
          <p className="en">
            <Highlighted text={word.s[0].e} word={word.w} />
          </p>
          {word.s[0].c ? <p className="cn">{word.s[0].c}</p> : null}
        </section>
      ) : null}

      <header className="headword">
        <button type="button" className="word-btn" onClick={() => play(word.w)}>
          {word.w}
        </button>
        <p className="phon">
          {word.us ? <span>美 /{word.us}/</span> : null}
          {word.uk ? <span>英 /{word.uk}/</span> : null}
          <span className="tap-hint">点单词发音</span>
        </p>
        {meaning ? <p className="lead">{meaning}</p> : null}
      </header>

      {word.p.length ? (
        <section className="block">
          <h3>常用搭配</h3>
          <ul className="phrases">
            {word.p.map((item, i) => (
              <li key={`${item.e}-${i}`}>
                <strong>{item.e}</strong>
                <span>{item.c}</span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {word.y.length ? (
        <section className="block">
          <h3>近义词</h3>
          <div className="syns">
            {word.y.map((group) => (
              <p key={`${group.p}-${group.ws.join(',')}`}>
                {group.p ? <em>{group.p}</em> : null}{' '}
                {group.ws.join(' · ')}
              </p>
            ))}
          </div>
        </section>
      ) : null}

      {word.t.length ? (
        <section className="block">
          <h3>释义</h3>
          <ul className="senses">
            {word.t.map((sense, i) => (
              <li key={`${sense.p}-${i}`}>
                {sense.p ? <em>{sense.p}</em> : null} {sense.cn}
                {sense.en ? <small>{sense.en}</small> : null}
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {word.s.length > 1 ? (
        <section className="block">
          <h3>更多例句</h3>
          <ul className="senses">
            {word.s.slice(1).map((item, i) => (
              <li key={`${item.e}-${i}`}>
                <Highlighted text={item.e} word={word.w} />
                {item.c ? <small>{item.c}</small> : null}
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {word.m ? <p className="tip">{word.m}</p> : null}

      {actions ? <footer className={floatActions ? 'actions floating' : 'actions'}>{actions}</footer> : null}
    </article>
  )
}
