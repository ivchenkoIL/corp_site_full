import { useEffect, useState } from 'react'
import { Link, useRoute } from 'wouter'
import { ArrowLeft, TrendingUp } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card'
import { Badge } from '../components/ui/badge'
import { Button } from '../components/ui/button'
import type { AiNews } from '../data/report'
import { assetUrl, fmtDate } from '../lib/format'

/* Архивный файл — тот же формат, что news.json, но одного конкретного дня и
   без подмешивания резервного снимка: если дня нет, значит его правда нет. */
function useArchiveDay(date: string | undefined) {
  const [items, setItems] = useState<AiNews[] | null>(null)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    if (!date) return
    setItems(null)
    setFailed(false)
    fetch(assetUrl(`archive/${date}.json`), { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((raw) => setItems(Array.isArray(raw) ? raw : []))
      .catch(() => setFailed(true))
  }, [date])

  return { items, failed }
}

export default function ArchiveDay() {
  const [, params] = useRoute('/archive/:date')
  const { items, failed } = useArchiveDay(params?.date)

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6">
      <Link href="/archive" className="self-start">
        <Button variant="ghost">
          <ArrowLeft size={16} /> Весь архив
        </Button>
      </Link>

      <h1 className="text-3xl font-bold">Выпуск за {params?.date ? fmtDate(params.date) : ''}</h1>

      {failed && <p className="py-12 text-center text-muted-foreground">Этот день не найден в архиве</p>}
      {!failed && items === null && <p className="py-12 text-center text-muted-foreground">Загрузка…</p>}

      {items && items.length > 0 && (
        <div className="flex flex-col gap-4">
          {items.map((n) => (
            <Card key={n.id}>
              <CardHeader>
                <div className="flex items-center gap-3">
                  <Badge variant="secondary">{n.tag}</Badge>
                </div>
                <CardTitle className="pt-1 text-lg">{n.title}</CardTitle>
              </CardHeader>
              <CardContent className="flex flex-col gap-3">
                <p className="text-sm text-muted-foreground">{n.summary}</p>

                {n.forecast && n.forecast.length > 0 && (
                  <details className="rounded-md border border-border bg-muted/30 p-3 text-sm">
                    <summary className="flex cursor-pointer items-center gap-1.5 font-medium text-secondary">
                      <TrendingUp size={14} /> Что тогда прогнозировали ({n.forecast.length})
                    </summary>
                    <ul className="mt-2.5 flex flex-col gap-2.5">
                      {n.forecast.map((f, i) => (
                        <li key={i} className="border-t border-border pt-2.5 first:border-0 first:pt-0">
                          <p className="leading-relaxed">{f.text}</p>
                          {f.horizon && (
                            <p className="mt-1 text-xs text-muted-foreground">Срок: {f.horizon}</p>
                          )}
                        </li>
                      ))}
                    </ul>
                  </details>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
