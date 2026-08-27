import {
  CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card'
import { useModels } from '../hooks/useModels'
import { priceHistoryKeys, usePriceHistory } from '../hooks/usePriceHistory'

// цикличная палитра — моделей может стать больше, чем цветов, поэтому по кругу
const COLORS = ['#10b981', '#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4']

export default function PriceHistory() {
  const rows = usePriceHistory()
  const keys = priceHistoryKeys(rows)
  const models = useModels().filter((m) => m.inPrice !== undefined)

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-3xl font-bold">История цен</h1>
        <p className="mt-1 text-muted-foreground">
          Стоимость инференса, $ за 1 млн входных токенов — по одной точке за день, начиная с
          того дня, когда цена модели впервые попала в дайджест
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Динамика цен по моделям</CardTitle>
          <CardDescription>$ за 1M входных токенов</CardDescription>
        </CardHeader>
        <CardContent className="h-96">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={rows} margin={{ top: 8, right: 16, left: 8, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--chart-grid)" />
              <XAxis dataKey="date" stroke="var(--chart-axis)" tickLine={false} axisLine={false} />
              <YAxis
                stroke="var(--chart-axis)"
                tickLine={false}
                axisLine={false}
                tickFormatter={(v: number) => `$${v}`}
                width={56}
              />
              <Tooltip
                contentStyle={{
                  background: 'var(--card)',
                  border: '1px solid var(--border)',
                  borderRadius: 8,
                  color: 'var(--foreground)',
                }}
                formatter={(v, name) => [`$${Number(v)} / 1M токенов`, String(name)]}
              />
              <Legend formatter={(value) => <span style={{ color: 'var(--foreground)' }}>{String(value)}</span>} />
              {keys.map((k, i) => (
                <Line
                  key={k}
                  type="monotone"
                  dataKey={k}
                  connectNulls
                  stroke={COLORS[i % COLORS.length]}
                  strokeWidth={2}
                  dot={{ r: 4, strokeWidth: 2, fill: 'var(--card)' }}
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Актуальные цены</CardTitle>
          <CardDescription>$ за 1 млн токенов: вход / выход</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  <th className="py-2 pr-4">Модель</th>
                  <th className="py-2 pr-4 text-right">Вход</th>
                  <th className="py-2 pr-4 text-right">Выход</th>
                  <th className="py-2">Примечание</th>
                </tr>
              </thead>
              <tbody className="[font-variant-numeric:tabular-nums]">
                {models.map((m) => (
                  <tr key={`${m.company}-${m.model}`} className="border-b border-border last:border-0">
                    <td className="py-2.5 pr-4 font-medium">{m.model}</td>
                    <td className="py-2.5 pr-4 text-right">${m.inPrice}</td>
                    <td className="py-2.5 pr-4 text-right">{m.outPrice !== undefined ? `$${m.outPrice}` : '—'}</td>
                    <td className="py-2.5 text-muted-foreground">{m.pricing || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
