import { Link, useRoute } from 'wouter'
import { ArrowLeft, ExternalLink, PlayCircle, Star, TrendingUp } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card'
import { Badge } from '../components/ui/badge'
import { Button } from '../components/ui/button'
import { ShareMenu } from '../components/ShareMenu'
import { useFavorites } from '../hooks/useFavorites'
import { useNews } from '../hooks/useNews'
import { assetUrl, fmtDate } from '../lib/format'

export default function NewsDetail() {
  const [, params] = useRoute('/news/:id')
  const allNews = useNews()
  const item = allNews.find((n) => n.id === params?.id)
  const { toggle, isFavorite } = useFavorites()

  if (!item) {
    return (
      <div className="py-16 text-center">
        <p className="text-muted-foreground">Новость не найдена</p>
        <Link href="/news" className="mt-4 inline-block">
          <Button variant="outline">
            <ArrowLeft size={16} /> К новостям
          </Button>
        </Link>
      </div>
    )
  }

  const related = allNews.filter((n) => n.tag === item.tag && n.id !== item.id)

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-6">
      <Link href="/news" className="self-start">
        <Button variant="ghost">
          <ArrowLeft size={16} /> Все новости
        </Button>
      </Link>

      <article>
        <div className="flex items-center gap-3">
          <Badge variant="secondary">{item.tag}</Badge>
          <span className="text-sm text-muted-foreground">{fmtDate(item.date)}</span>
        </div>
        <h1 className="mt-3 text-3xl font-bold leading-tight">{item.title}</h1>

        {item.image && (
          <figure className="mt-5">
            <img
              src={assetUrl(item.image.src)}
              alt=""
              loading="lazy"
              decoding="async"
              className="w-full rounded-lg border border-border object-cover"
            />
            {item.image.credit && (
              <figcaption className="mt-1.5 text-xs text-muted-foreground">
                Иллюстрация: {item.image.credit}
              </figcaption>
            )}
          </figure>
        )}

        {item.video && (
          <a
            href={item.video.url}
            target="_blank"
            rel="noreferrer noopener"
            className="mt-4 inline-flex items-center gap-2 rounded-md border border-border px-3 py-2 text-sm font-medium text-secondary hover:bg-muted"
          >
            <PlayCircle size={17} /> {item.video.label ?? 'Видео у источника'}
          </a>
        )}
        <div className="mt-5 flex flex-col gap-4">
          {item.body.map((p, i) => (
            <p key={i} className="text-lg leading-relaxed text-foreground/90">
              {p}
            </p>
          ))}
        </div>
      </article>

      {item.forecast && item.forecast.length > 0 && (
        <section className="rounded-lg border border-l-4 border-border border-l-secondary bg-card p-5">
          <h2 className="flex items-center gap-2 text-lg font-bold">
            <TrendingUp size={18} className="text-secondary" /> Что из этого следует
          </h2>
          <p className="mt-1 text-xs text-muted-foreground">
            Прогноз построен по новостям выпуска и прошлым выпускам. Это оценка, а не факт.
          </p>
          <ul className="mt-4 flex flex-col gap-4">
            {item.forecast.map((f, i) => (
              <li key={i} className="flex gap-3">
                <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-secondary/15 text-xs font-bold text-secondary">
                  {i + 1}
                </span>
                <div className="min-w-0">
                  <p className="text-sm leading-relaxed">{f.text}</p>

                  {/* Срок и уверенность — подписи из фиксированных списков
                      (см. HORIZONS/CONFIDENCE в scripts/update-news.mjs).
                      Модель иногда возвращает не то значение — генератор в
                      таком случае оставляет поле пустым, и чипа просто нет. */}
                  {(f.horizon || f.confidence) && (
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {f.horizon && (
                        <span className="rounded-full border border-border px-2 py-0.5 text-xs text-muted-foreground">
                          Срок: {f.horizon}
                        </span>
                      )}
                      {f.confidence && (
                        <span className="rounded-full border border-border px-2 py-0.5 text-xs text-muted-foreground">
                          Уверенность: {f.confidence}
                        </span>
                      )}
                    </div>
                  )}

                  {(f.impact || f.signal || f.risk || f.basis) && (
                    <dl className="mt-2 flex flex-col gap-1 text-xs text-muted-foreground">
                      {f.impact && (
                        <div>
                          <dt className="inline font-medium text-foreground/80">Кого касается: </dt>
                          <dd className="inline">{f.impact}</dd>
                        </div>
                      )}
                      {f.signal && (
                        <div>
                          <dt className="inline font-medium text-foreground/80">Признак: </dt>
                          <dd className="inline">{f.signal}</dd>
                        </div>
                      )}
                      {f.risk && (
                        <div>
                          <dt className="inline font-medium text-foreground/80">Не сбудется, если: </dt>
                          <dd className="inline">{f.risk}</dd>
                        </div>
                      )}
                      {f.basis && (
                        <div>
                          <dt className="inline font-medium text-foreground/80">Основание: </dt>
                          <dd className="inline">{f.basis}</dd>
                        </div>
                      )}
                    </dl>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}

      <div className="flex flex-wrap gap-2">
        <ShareMenu title={item.title} path={`/news/${item.id}`} />
        <Button variant="outline" onClick={() => toggle(item.id)} aria-pressed={isFavorite(item.id)}>
          <Star size={16} className={isFavorite(item.id) ? 'fill-accent text-accent' : ''} />
          {isFavorite(item.id) ? 'В избранном' : 'В избранное'}
        </Button>
      </div>

      <section>
        <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          Источники
        </h2>
        <ul className="flex flex-col gap-1.5">
          {item.sources.map((s) => (
            <li key={s.url}>
              <a
                href={s.url}
                target="_blank"
                rel="noreferrer noopener"
                className="inline-flex items-center gap-1.5 text-sm text-secondary hover:underline"
              >
                <ExternalLink size={13} /> {s.label}
              </a>
            </li>
          ))}
        </ul>
      </section>

      {related.length > 0 && (
        <section>
          <h2 className="mb-3 text-lg font-bold">Ещё по теме «{item.tag}»</h2>
          <div className="flex flex-col gap-3">
            {related.map((n) => (
              <Link key={n.id} href={`/news/${n.id}`}>
                <Card className="cursor-pointer transition-colors hover:border-secondary">
                  <CardHeader>
                    <CardTitle className="text-base">{n.title}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <span className="text-xs text-muted-foreground">{fmtDate(n.date)}</span>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        </section>
      )}
    </div>
  )
}
