import { useEffect, useState } from 'react'
import { AI_METRICS, RECOMMENDATIONS, REPORT } from '../data/report'
import { assetUrl } from '../lib/format'

/* Показатели недели и рекомендации грузятся с сервера (/news/data/summary.json —
   его ежедневно пересобирает тот же YandexGPT-скрипт, что и новости), а до/вместо
   него показывается выпуск, зашитый в сборку. Если файла нет или он не прошёл
   проверку — остаёмся на встроенном, но никогда не показываем полупустой блок. */

export type AiMetric = {
  label: string
  value: string
  note: string
  dir: 'up' | 'down'
  good: boolean
}

export type Summary = {
  date: string
  metrics: AiMetric[]
  recommendations: string[]
}

const BUILTIN: Summary = {
  date: REPORT.date,
  metrics: AI_METRICS,
  recommendations: RECOMMENDATIONS,
}

let cache: Summary | null = null

function normalize(raw: unknown): Summary | null {
  if (!raw || typeof raw !== 'object') return null
  const o = raw as Record<string, unknown>
  if (!Array.isArray(o.metrics) || !Array.isArray(o.recommendations)) return null

  const metrics: AiMetric[] = []
  for (const m of o.metrics) {
    if (!m || typeof m !== 'object') return null
    const x = m as Record<string, unknown>
    if (typeof x.label !== 'string' || typeof x.value !== 'string') return null
    if (x.dir !== 'up' && x.dir !== 'down') return null
    metrics.push({
      label: x.label,
      value: x.value,
      note: typeof x.note === 'string' ? x.note : '',
      dir: x.dir,
      good: x.good !== false,
    })
  }
  const recommendations = o.recommendations.filter((r): r is string => typeof r === 'string')

  // неполный ответ модели лучше не показывать вовсе — берём встроенный выпуск
  if (metrics.length < 3 || recommendations.length < 2) return null

  return {
    date: typeof o.date === 'string' ? o.date : REPORT.date,
    metrics,
    recommendations,
  }
}

export function useSummary(): Summary {
  const [summary, setSummary] = useState<Summary>(cache ?? BUILTIN)

  useEffect(() => {
    if (cache) return
    fetch(assetUrl('summary.json'), { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : null))
      .then((raw) => {
        const s = normalize(raw)
        if (s) {
          cache = s
          setSummary(s)
        }
      })
      .catch(() => {
        /* файла ещё нет — остаёмся на встроенном выпуске */
      })
  }, [])

  return summary
}
