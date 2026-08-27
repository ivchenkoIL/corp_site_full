import { lazy, Suspense } from 'react'
import { Route, Router, Switch } from 'wouter'
import Layout from './components/Layout'

/* Страницы грузятся по требованию: recharts и выгрузка салона (388 КБ JSON)
   не попадают в стартовый бандл главной страницы. */
const AiDashboard = lazy(() => import('./pages/AiDashboard'))
const News = lazy(() => import('./pages/News'))
const NewsDetail = lazy(() => import('./pages/NewsDetail'))
const ModelsComparison = lazy(() => import('./pages/ModelsComparison'))
const PriceHistory = lazy(() => import('./pages/PriceHistory'))
const CostCalculator = lazy(() => import('./pages/CostCalculator'))

function PageFallback() {
  return (
    <div className="py-16 text-center text-sm text-muted-foreground" role="status">
      Загрузка…
    </div>
  )
}

export default function App() {
  /* Дашборд смонтирован под /news/ внутри портала vest-smr.ru:
     base задаёт префикс и для маршрутов, и для <Link>. */
  return (
    <Router base="/news">
    <Layout>
      <Suspense fallback={<PageFallback />}>
        <Switch>
          <Route path="/" component={AiDashboard} />
          <Route path="/news" component={News} />
          <Route path="/news/:id" component={NewsDetail} />
          <Route path="/models" component={ModelsComparison} />
          <Route path="/prices" component={PriceHistory} />
          <Route path="/calculator" component={CostCalculator} />
          <Route>
            <div className="container py-16 text-center text-muted-foreground">
              Страница не найдена
            </div>
          </Route>
        </Switch>
      </Suspense>
    </Layout>
    </Router>
  )
}
