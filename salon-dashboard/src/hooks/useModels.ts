import { useEffect, useState } from 'react'
import { AI_MODELS, type AiModel } from '../data/report'
import { assetUrl } from '../lib/format'

/* Таблица моделей грузится с сервера (data/models.json — его обновляет тот же
   скрипт, что и новости, когда в выпуске есть релизы), а до/вместо него
   показывается снимок, зашитый в сборку. */

let cache: AiModel[] | null = null

function normalize(raw: unknown): AiModel[] | null {
  if (!Array.isArray(raw) || raw.length === 0) return null
  const models: AiModel[] = []
  for (const m of raw) {
    if (!m || typeof m !== 'object') return null
    const o = m as Record<string, unknown>
    if (typeof o.company !== 'string' || typeof o.model !== 'string') return null
    models.push({
      company: o.company,
      model: o.model,
      openWeight: o.openWeight === true,
      pricing: typeof o.pricing === 'string' ? o.pricing : undefined,
      notes: typeof o.notes === 'string' ? o.notes : '',
      inPrice: typeof o.inPrice === 'number' ? o.inPrice : undefined,
      outPrice: typeof o.outPrice === 'number' ? o.outPrice : undefined,
    })
  }
  return models
}

export function useModels(): AiModel[] {
  const [models, setModels] = useState<AiModel[]>(cache ?? AI_MODELS)

  useEffect(() => {
    if (cache) return
    fetch(assetUrl('models.json'), { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : null))
      .then((raw) => {
        const items = normalize(raw)
        if (items) {
          cache = items
          setModels(items)
        }
      })
      .catch(() => {
        /* файла ещё нет — остаёмся на встроенном снимке */
      })
  }, [])

  return models
}
