import { useEffect, useState } from 'react'
import { PRICE_HISTORY } from '../data/report'
import { assetUrl } from '../lib/format'

/* Каждая строка — один день, ключи кроме date — цена $ за 1M входных токенов
   по названию модели на тот момент. Пишется автоматически (data/price-history.json),
   без него показывается резервный снимок из сборки. */
export type PriceRow = { date: string } & Record<string, number | string>

let cache: PriceRow[] | null = null

function normalize(raw: unknown): PriceRow[] | null {
  if (!Array.isArray(raw) || raw.length === 0) return null
  const rows: PriceRow[] = []
  for (const r of raw) {
    if (!r || typeof r !== 'object') return null
    const o = r as Record<string, unknown>
    if (typeof o.date !== 'string') return null
    const row: PriceRow = { date: o.date }
    for (const [k, v] of Object.entries(o)) {
      if (k !== 'date' && typeof v === 'number') row[k] = v
    }
    rows.push(row)
  }
  return rows
}

export function usePriceHistory(): PriceRow[] {
  const [rows, setRows] = useState<PriceRow[]>(cache ?? PRICE_HISTORY)

  useEffect(() => {
    if (cache) return
    fetch(assetUrl('price-history.json'), { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : null))
      .then((raw) => {
        const items = normalize(raw)
        if (items) {
          cache = items
          setRows(items)
        }
      })
      .catch(() => {
        /* файла ещё нет — остаёмся на встроенном снимке */
      })
  }, [])

  return rows
}

/* Названия моделей (кроме date), встречающиеся хоть в одной строке — по ним
   строится по одной линии на графике, в порядке первого появления. */
export function priceHistoryKeys(rows: PriceRow[]): string[] {
  const keys: string[] = []
  for (const row of rows) {
    for (const k of Object.keys(row)) {
      if (k !== 'date' && !keys.includes(k)) keys.push(k)
    }
  }
  return keys
}
