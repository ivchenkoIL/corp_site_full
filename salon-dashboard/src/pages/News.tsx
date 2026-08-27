import { useMemo, useState } from 'react'
import { Link } from 'wouter'
import { Star } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card'
import { Badge } from '../components/ui/badge'
import { useFavorites } from '../hooks/useFavorites'
import { AI_TAGS, REPORT } from '../data/report'
import { useNews } from '../hooks/useNews'
import { assetUrl, fmtDate } from '../lib/format'
import { useSummary } from '../hooks/useSummary'

export default function News() {
  const summary = useSummary()
  const [tag, setTag] = useState('Все')
  const [onlyFavorites, setOnlyFavorites] = useState(false)
  const { toggle, isFavorite } = useFavorites()
  const allNews = useNews()

  const items = useMemo(
    () =>
      allNews.filter((n) => tag === 'Все' || n.tag === tag).filter(
        (n) => !onlyFavorites || isFavorite(n.id),
      ),
    [allNews, tag, onlyFavorites, isFavorite],
  )

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-3xl font-bold">Новости</h1>
        <p className="mt-1 text-muted-foreground">
          Новостной канал мониторинга ИИ · выпуск {fmtDate(summary.date)} · {REPORT.author}
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label="Фильтр по тегам">
        {[...new Set([...AI_TAGS, ...allNews.map((n) => n.tag)])].map((t) => (
          <button
            key={t}
            onClick={() => setTag(t)}
            aria-pressed={tag === t}
            className={`rounded-full border px-3 py-1 text-sm font-medium transition-colors ${
              tag === t
                ? 'border-secondary bg-secondary/15 text-foreground'
                : 'border-border bg-card text-muted-foreground hover:text-foreground'
            }`}
          >
            {t}
          </button>
        ))}
        <button
          onClick={() => setOnlyFavorites((v) => !v)}
          aria-pressed={onlyFavorites}
          className={`ml-2 inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-sm font-medium transition-colors ${
            onlyFavorites
              ? 'border-accent bg-accent/15 text-foreground'
              : 'border-border bg-card text-muted-foreground hover:text-foreground'
          }`}
        >
          <Star size={14} className={onlyFavorites ? 'fill-accent text-accent' : ''} />
          Избранное
        </button>
      </div>

      {items.length === 0 ? (
        <p className="py-12 text-center text-muted-foreground">
          {onlyFavorites ? 'В избранном пока пусто — отметьте новость звёздочкой' : 'Новостей нет'}
        </p>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {items.map((n) => (
            <Card key={n.id} className="flex h-full flex-col overflow-hidden transition-colors hover:border-secondary">
              {n.image && (
                <Link href={`/news/${n.id}`}>
                  <img
                    src={assetUrl(n.image.src)}
                    alt=""
                    loading="lazy"
                    decoding="async"
                    className="h-44 w-full cursor-pointer object-cover"
                  />
                </Link>
              )}
              <CardHeader>
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary">{n.tag}</Badge>
                    <span className="text-xs text-muted-foreground">{fmtDate(n.date)}</span>
                  </div>
                  <button
                    onClick={() => toggle(n.id)}
                    aria-pressed={isFavorite(n.id)}
                    aria-label={isFavorite(n.id) ? 'Убрать из избранного' : 'В избранное'}
                    className="rounded p-1 text-muted-foreground hover:text-accent"
                  >
                    <Star size={17} className={isFavorite(n.id) ? 'fill-accent text-accent' : ''} />
                  </button>
                </div>
                <Link href={`/news/${n.id}`}>
                  <CardTitle className="cursor-pointer pt-1 text-lg hover:text-secondary">
                    {n.title}
                  </CardTitle>
                </Link>
              </CardHeader>
              <CardContent className="flex-1">
                <p className="text-sm text-muted-foreground">{n.summary}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
