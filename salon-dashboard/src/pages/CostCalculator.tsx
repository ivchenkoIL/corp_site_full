import { useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card'
import { useModels } from '../hooks/useModels'

const usd = (v: number) =>
  v.toLocaleString('ru-RU', { maximumFractionDigits: v < 10 ? 2 : 0 })

export default function CostCalculator() {
  const calcModels = useModels().filter(
    (m): m is typeof m & { inPrice: number; outPrice: number } =>
      m.inPrice !== undefined && m.outPrice !== undefined,
  )
  const label = (m: (typeof calcModels)[number]) => `${m.company} ${m.model}`

  const [modelKey, setModelKey] = useState(calcModels[0] ? label(calcModels[0]) : '')
  const [inTokens, setInTokens] = useState(50) // млн токенов в месяц
  const [outTokens, setOutTokens] = useState(10)

  if (calcModels.length === 0) {
    return (
      <div className="py-16 text-center text-muted-foreground">
        Ни у одной модели пока нет точной цены за токен — калькулятор появится, как только
        цена будет названа в новостях
      </div>
    )
  }

  const model = calcModels.find((m) => label(m) === modelKey) ?? calcModels[0]
  const inCost = inTokens * model.inPrice
  const outCost = outTokens * model.outPrice
  const totalCost = inCost + outCost

  const cheapest = calcModels.reduce((a, b) =>
    inTokens * a.inPrice + outTokens * a.outPrice <= inTokens * b.inPrice + outTokens * b.outPrice ? a : b,
  )
  const cheapestCost = inTokens * cheapest.inPrice + outTokens * cheapest.outPrice

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6">
      <div>
        <h1 className="text-3xl font-bold">Калькулятор затрат</h1>
        <p className="mt-1 text-muted-foreground">
          Месячный бюджет на инференс по ценам из последних новостей, $ за 1 млн токенов
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Модель</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          {calcModels.map((m) => (
            <button
              key={label(m)}
              onClick={() => setModelKey(label(m))}
              aria-pressed={modelKey === label(m)}
              className={`rounded-md border px-4 py-2.5 text-left text-sm font-medium transition-colors ${
                modelKey === label(m)
                  ? 'border-secondary bg-secondary/15 text-foreground'
                  : 'border-border bg-card text-muted-foreground hover:text-foreground'
              }`}
            >
              {label(m)}
              <span className="ml-2 text-muted-foreground">
                ${m.inPrice} / ${m.outPrice}
              </span>
            </button>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Нагрузка в месяц</CardTitle>
          <CardDescription>миллионы токенов</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-5">
          <label className="flex items-center gap-4">
            <span className="w-40 shrink-0 text-sm text-muted-foreground">
              Входные: <b className="text-foreground">{inTokens} млн</b>
            </span>
            <input
              type="range"
              min={1}
              max={500}
              value={inTokens}
              onChange={(e) => setInTokens(Number(e.target.value))}
              className="w-full accent-[#10b981]"
              aria-label="Входные токены, млн в месяц"
            />
          </label>
          <label className="flex items-center gap-4">
            <span className="w-40 shrink-0 text-sm text-muted-foreground">
              Выходные: <b className="text-foreground">{outTokens} млн</b>
            </span>
            <input
              type="range"
              min={1}
              max={200}
              value={outTokens}
              onChange={(e) => setOutTokens(Number(e.target.value))}
              className="w-full accent-[#10b981]"
              aria-label="Выходные токены, млн в месяц"
            />
          </label>
        </CardContent>
      </Card>

      <Card className="border-secondary">
        <CardHeader>
          <CardTitle>Итого в месяц</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-4xl font-bold">${usd(totalCost)}</p>
          <p className="mt-2 text-sm text-muted-foreground">
            вход ${usd(inCost)} + выход ${usd(outCost)} · {label(model)}
          </p>
          {label(cheapest) !== label(model) && (
            <div className="mt-4 border-t border-border pt-4 text-sm">
              <span className="text-muted-foreground">
                Дешевле всего под эту нагрузку — <b className="text-foreground">{label(cheapest)}</b>:{' '}
                <b className="text-secondary">${usd(cheapestCost)}</b> (экономия $
                {usd(totalCost - cheapestCost)} в месяц)
              </span>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
