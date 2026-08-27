import { useEffect, useState } from 'react'
import { assetUrl } from '../lib/format'

export type ArchiveEntry = { date: string; count: number }

function normalize(raw: unknown): ArchiveEntry[] | null {
  if (!Array.isArray(raw)) return null
  const out: ArchiveEntry[] = []
  for (const e of raw) {
    if (!e || typeof e !== 'object') continue
    const o = e as Record<string, unknown>
    if (typeof o.date === 'string' && typeof o.count === 'number') out.push({ date: o.date, count: o.count })
  }
  return out
}

/* Список дат, за которые есть архивные выпуски (data/archive/index.json —
   пишется тем же прогоном, что и сами архивные файлы). Без сервера — пусто:
   архивной истории до первого прогона просто ещё нет. */
export function useArchiveIndex(): ArchiveEntry[] {
  const [entries, setEntries] = useState<ArchiveEntry[]>([])

  useEffect(() => {
    fetch(assetUrl('archive/index.json'), { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : null))
      .then((raw) => {
        const items = normalize(raw)
        if (items) setEntries(items)
      })
      .catch(() => {})
  }, [])

  return entries
}
