import { useMemo, useState } from 'react'
import { Link } from 'wouter'
import { ArrowRight, Quote, TrendingDown, TrendingUp } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card'
import { Badge } from '../components/ui/badge'
import { Button } from '../components/ui/button'
import { AI_TAGS, REPORT } from '../data/report'
import { useNews } from '../hooks/useNews'
import { useSummary } from '../hooks/useSummary'
import { fmtDate } from '../lib/format'

const QUICK_LINKS = [
  { href: '/models', title: 'Сравнение моделей', desc: 'DeepSeek V4 Flash, GPT-5.6, Qwen3.8-Max, Muse Spark, Grok 4.5' },
  { href: '/prices', title: 'История цен', desc: 'Динамика стоимости инференса, $ за 1M токенов' },
  { href: '/calculator', title: 'Калькулятор затрат', desc: 'Оценка месячного бюджета на токены по актуальным ценам' },
]

export default function AiDashboard() {
  const [activeCategory, setActiveCategory] = useState('Все')
  const allNews = useNews()
  const summary = useSummary()

  const items = useMemo(
    () => allNews.filter((n) => activeCategory === 'Все' || n.tag === activeCategory),
    [allNews, activeCategory],
  )

  return (
    <div className="flex flex-col gap-10">
      <section>
        <h1 className="text-3xl font-bold text-foreground">Дашборд мониторинга ИИ</h1>
        <p className="mt-1 text-muted-foreground">
          {REPORT.title.split(':')[1].trim()} · выпуск {fmtDate(summary.date)} · {REPORT.author}
        </p>
      </section>

      <section>
        <h2 className="mb-6 text-2xl font-bold">Основные показатели</h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {summary.metrics.map((m) => (
            <Card key={m.label}>
              <CardHeader className="pb-0">
                <CardTitle className="text-sm text-muted-foreground">{m.label}</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-3xl font-bold">{m.value}</p>
                <p
                  className={`mt-1 inline-flex items-center gap-1 text-sm font-medium ${
                    m.good ? 'text-secondary' : 'text-destructive'
                  }`}
                >
                  {m.dir === 'up' ? <TrendingUp size={15} /> : <TrendingDown size={15} />}
                  {m.note}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      <section>
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-2xl font-bold">Ключевые события недели</h2>
          <div className="flex flex-wrap gap-1.5" role="group" aria-label="Категория">
            {AI_TAGS.map((t) => (
              <button
                key={t}
                onClick={() => setActiveCategory(t)}
                aria-pressed={activeCategory === t}
                className={`rounded-full border px-3 py-1 text-sm font-medium transition-colors ${
                  activeCategory === t
                    ? 'border-secondary bg-secondary/15 text-foreground'
                    : 'border-border bg-card text-muted-foreground hover:text-foreground'
                }`}
              >
                {t}
              </button>
            ))}
          </div>
        </div>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {items.map((n) => (
            <Link key={n.id} href={`/news/${n.id}`}>
              <Card className="h-full cursor-pointer transition-colors hover:border-secondary">
                <CardHeader>
                  <div className="flex items-center justify-between gap-3">
                    <Badge variant="secondary">{n.tag}</Badge>
                    <span className="text-xs text-muted-foreground">{fmtDate(n.date)}</span>
                  </div>
                  <CardTitle className="pt-1">{n.title}</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground">{n.summary}</p>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
        <div className="mt-4 text-right">
          <Link href="/news">
            <Button variant="ghost">
              Все новости <ArrowRight size={15} />
            </Button>
          </Link>
        </div>
      </section>

      <Card className="border-l-4 border-l-accent">
        <CardContent className="flex gap-3 p-5">
          <Quote size={20} className="mt-0.5 shrink-0 text-accent" />
          <div>
            <p className="italic text-foreground/90">
              «Поскольку разница в производительности между моделями верхнего уровня продолжает
              сужаться, покупатели всё чаще выбирают системы на основе стоимости и эффективности,
              а не бренда».
            </p>
            <p className="mt-2 text-sm text-muted-foreground">— MarketingProfs AI Update</p>
          </div>
        </CardContent>
      </Card>

      <section className="grid grid-cols-1 gap-4 md:grid-cols-3">
        {QUICK_LINKS.map((q) => (
          <Link key={q.href} href={q.href}>
            <Card className="h-full cursor-pointer transition-colors hover:border-secondary">
              <CardHeader>
                <CardTitle className="inline-flex items-center gap-2 text-base">
                  {q.title} <ArrowRight size={15} className="text-secondary" />
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">{q.desc}</p>
              </CardContent>
            </Card>
          </Link>
        ))}
      </section>

      <section>
        <h2 className="mb-4 text-2xl font-bold">Рекомендации для стратегии</h2>
        <div className="flex flex-col gap-3">
          {summary.recommendations.map((r, i) => (
            <Card key={i}>
              <CardContent className="flex gap-4 p-4">
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-secondary/15 text-sm font-bold text-secondary">
                  {i + 1}
                </span>
                <p className="text-sm leading-relaxed">{r}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>
    </div>
  )
}
