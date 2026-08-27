import { Link } from 'wouter'
import { ArrowRight, Lock, Unlock } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card'
import { Badge } from '../components/ui/badge'
import { Button } from '../components/ui/button'
import { useModels } from '../hooks/useModels'

export default function ModelsComparison() {
  const models = useModels()
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-3xl font-bold">Сравнение моделей</h1>
        <p className="mt-1 text-muted-foreground">
          Ключевые релизы недели: рынок движется к товарному характеру, конкуренция — в цене инференса
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {models.map((m) => (
          <Card key={`${m.company}-${m.model}`} className="flex h-full flex-col">
            <CardHeader>
              <div className="flex items-center justify-between gap-3">
                <CardDescription className="font-semibold uppercase tracking-wide">
                  {m.company}
                </CardDescription>
                <Badge variant={m.openWeight ? 'secondary' : 'outline'}>
                  {m.openWeight ? <Unlock size={12} /> : <Lock size={12} />}
                  {m.openWeight ? 'open-weight' : 'закрытая'}
                </Badge>
              </div>
              <CardTitle className="text-xl">{m.model}</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-1 flex-col gap-3">
              {m.pricing && (
                <p className="text-sm font-semibold text-secondary">{m.pricing}</p>
              )}
              <p className="text-sm leading-relaxed text-muted-foreground">{m.notes}</p>
            </CardContent>
          </Card>
        ))}
        <Card className="flex h-full flex-col justify-center border-dashed">
          <CardContent className="flex flex-col items-start gap-3 p-5">
            <p className="text-sm text-muted-foreground">
              Сравните стоимость инференса моделей под вашу нагрузку:
            </p>
            <Link href="/calculator">
              <Button>
                Калькулятор затрат <ArrowRight size={15} />
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
