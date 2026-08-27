import { useEffect, useState } from 'react'
import { AI_NEWS, type AiNews, type NewsForecast } from '../data/report'
import { assetUrl } from '../lib/format'

/* Новости грузятся с сервера (data/news.json — его ежедневно обновляет
   YandexGPT-скрипт), а до/вместо него показывается выпуск, зашитый в сборку. */

let cache: AiNews[] | null = null

function str(v: unknown, max: number): string {
  return typeof v === 'string' ? v.slice(0, max) : ''
}

/* Картинка, видео и прогноз появились позже новостей, поэтому все три поля
   необязательные: старый news.json (или выпуск, зашитый в сборку) должен
   открываться без них, а не падать целиком. */
function normalize(raw: unknown): AiNews[] | null {
  if (!Array.isArray(raw) || raw.length === 0) return null
  const items: AiNews[] = []
  for (const n of raw) {
    if (!n || typeof n !== 'object') return null
    const o = n as Record<string, unknown>
    if (typeof o.id !== 'string' || typeof o.title !== 'string') return null

    const img = o.image as Record<string, unknown> | null | undefined
    const vid = o.video as Record<string, unknown> | null | undefined
    const forecast: NewsForecast[] = (Array.isArray(o.forecast) ? o.forecast : [])
      .filter((f): f is Record<string, unknown> => !!f && typeof f === 'object')
      .filter((f) => typeof f.text === 'string' && f.text.trim().length > 0)
      .map((f) => ({
        text: str(f.text, 600),
        basis: str(f.basis, 200) || undefined,
        horizon: str(f.horizon, 40) || undefined,
        confidence: str(f.confidence, 20) || undefined,
        impact: str(f.impact, 400) || undefined,
        signal: str(f.signal, 300) || undefined,
        risk: str(f.risk, 300) || undefined,
      }))

    items.push({
      id: o.id,
      title: o.title,
      date: str(o.date, 10),
      tag: str(o.tag, 40) || 'Рынок',
      summary: str(o.summary, 500),
      body: Array.isArray(o.body) ? o.body.filter((p): p is string => typeof p === 'string') : [],
      sources: Array.isArray(o.sources)
        ? o.sources.filter(
            (s): s is { label: string; url: string } =>
              !!s && typeof (s as Record<string, unknown>).label === 'string' &&
              typeof (s as Record<string, unknown>).url === 'string',
          )
        : [],
      image: img && typeof img.src === 'string'
        ? { src: img.src, credit: typeof img.credit === 'string' ? img.credit : undefined }
        : null,
      video: vid && typeof vid.url === 'string' && /^https?:\/\//i.test(vid.url)
        ? { url: vid.url, label: typeof vid.label === 'string' ? vid.label : undefined }
        : null,
      forecast,
    })
  }
  return items
}

export function useNews(): AiNews[] {
  const [news, setNews] = useState<AiNews[]>(cache ?? AI_NEWS)

  useEffect(() => {
    if (cache) return
    fetch(assetUrl('news.json'), { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : null))
      .then((raw) => {
        const items = normalize(raw)
        if (items) {
          cache = items
          setNews(items)
        }
      })
      .catch(() => {
        /* файла ещё нет — остаёмся на встроенном выпуске */
      })
  }, [])

  return news
}
