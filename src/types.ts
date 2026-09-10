/// <reference types="vite/client" />

export type Sense = {
  p?: string
  cn: string
  en?: string
}

export type Phrase = {
  e: string
  c: string
}

export type Sentence = {
  e: string
  c: string
}

export type SynGroup = {
  p?: string
  ws: string[]
}

export type Word = {
  w: string
  us?: string
  uk?: string
  t: Sense[]
  p: Phrase[]
  s: Sentence[]
  y: SynGroup[]
  m?: string
}

export type Mark = 'k' | 'f'

export type LearnedEntry = {
  s: Mark
  t: number
}

export type ProfileId = 'a' | 'b'

export type ProfileState = {
  cursor: number
  learned: Record<string, LearnedEntry>
  today: string
  todayCount: number
  updatedAt: number
}

export type AppState = {
  who: ProfileId | null
  names: Record<ProfileId, string>
  namesAt: number
  cabin: string
  profiles: Record<ProfileId, ProfileState>
}

export type Tab = 'learn' | 'book' | 'us'
