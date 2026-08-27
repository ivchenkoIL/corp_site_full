import type { ReactNode } from 'react'
import { Link, useLocation } from 'wouter'
import {
  ArrowLeft, BarChart3, Calculator, Cpu, LineChart, Newspaper,
} from 'lucide-react'
import { REPORT } from '../data/report'
import { useSummary } from '../hooks/useSummary'
import { fmtDate } from '../lib/format'

const MAIN_NAV = [
  { href: '/', label: 'Дашборд', icon: BarChart3 },
  { href: '/news', label: 'Новости', icon: Newspaper },
  { href: '/models', label: 'Модели', icon: Cpu },
  { href: '/prices', label: 'Цены', icon: LineChart },
  { href: '/calculator', label: 'Калькулятор', icon: Calculator },
]

export default function Layout({ children }: { children: ReactNode }) {
  const [location] = useLocation()
  // дата выпуска в подвале — из той же сводки, что и на дашборде
  const summary = useSummary()

  const isActive = (href: string) => {
    if (href === '/') return location === '/'
    return location.startsWith(href)
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-40 border-b border-border bg-card/95 backdrop-blur">
        <div className="container flex flex-wrap items-center justify-between gap-x-6 gap-y-2 py-3">
          <div className="flex items-center gap-3">
          <a
            href="/"
            className="inline-flex items-center gap-1.5 rounded-md border border-border px-2.5 py-1.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            <ArrowLeft size={15} aria-hidden /> Назад на портал
          </a>
          <Link href="/" className="text-lg font-bold tracking-tight text-foreground">
            Мониторинг<span className="text-secondary">·</span>ИИ
          </Link>
          </div>
          <nav aria-label="Основная навигация" className="flex flex-wrap gap-1">
            {MAIN_NAV.map(({ href, label, icon: Icon }) => (
              <Link
                key={href}
                href={href}
                className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                  isActive(href)
                    ? 'bg-primary text-primary-foreground'
                    : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                }`}
              >
                <Icon size={15} aria-hidden />
                {label}
              </Link>
            ))}
          </nav>
        </div>
      </header>

      <main className="container py-8">{children}</main>

      <footer className="border-t border-border py-6">
        <div className="container text-sm text-muted-foreground">
          {`${REPORT.author} · выпуск ${fmtDate(summary.date)} · vest-smr.ru`}
        </div>
      </footer>
    </div>
  )
}
