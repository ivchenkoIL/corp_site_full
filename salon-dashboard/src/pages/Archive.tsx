import { Link } from 'wouter'
import { Archive as ArchiveIcon } from 'lucide-react'
import { Card, CardContent } from '../components/ui/card'
import { useArchiveIndex } from '../hooks/useArchiveIndex'
import { fmtDate, monthLabel, pluralRu } from '../lib/format'

export default function Archive() {
  const entries = useArchiveIndex()

  const byMonth = new Map<string, typeof entries>()
  for (const e of entries) {
    const ym = e.date.slice(0, 7)
    byMonth.set(ym, [...(byMonth.get(ym) ?? []), e])
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-3xl font-bold">Архив выпусков</h1>
        <p className="mt-1 text-muted-foreground">
          Прошлые дайджесты — можно сравнить, что писали раньше, с тем, что происходит сейчас
        </p>
      </div>

      {entries.length === 0 ? (
        <p className="py-12 text-center text-muted-foreground">
          Архив пока пуст — появится после первых нескольких прогонов
        </p>
      ) : (
        [...byMonth.entries()].map(([ym, rows]) => (
          <section key={ym}>
            <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              {monthLabel(ym)}
            </h2>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {rows.map((e) => (
                <Link key={e.date} href={`/archive/${e.date}`}>
                  <Card className="cursor-pointer transition-colors hover:border-secondary">
                    <CardContent className="flex items-center justify-between gap-3 p-4">
                      <div className="flex items-center gap-2.5">
                        <ArchiveIcon size={16} className="text-muted-foreground" />
                        <span className="font-medium">{fmtDate(e.date)}</span>
                      </div>
                      <span className="text-xs text-muted-foreground">
                        {e.count} {pluralRu(e.count, 'новость', 'новости', 'новостей')}
                      </span>
                    </CardContent>
                  </Card>
                </Link>
              ))}
            </div>
          </section>
        ))
      )}
    </div>
  )
}
