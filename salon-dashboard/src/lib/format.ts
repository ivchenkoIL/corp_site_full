/* Форматирование и локаль. Без импорта данных — модуль попадает в основной чанк,
   поэтому здесь не должно появиться зависимостей от salon.json или report.ts. */

export const MONTH_FULL = [
  'Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь',
  'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь',
]
export const MONTH_SHORT = [
  'янв', 'фев', 'мар', 'апр', 'май', 'июн',
  'июл', 'авг', 'сен', 'окт', 'ноя', 'дек',
]

const nf = new Intl.NumberFormat('ru-RU')
export const rub = (v: number) => `${nf.format(Math.round(v))} ₽`
export const num = (v: number) => nf.format(v)

export function pluralRu(n: number, one: string, few: string, many: string): string {
  const m10 = n % 10
  const m100 = n % 100
  if (m10 === 1 && m100 !== 11) return one
  if (m10 >= 2 && m10 <= 4 && (m100 < 10 || m100 >= 20)) return few
  return many
}

/* Файлы дайджеста (картинки, news.json) лежат рядом со сборкой, в data/.
   BASE_URL подставляет Vite — тот же префикс, под которым смонтирован SPA. */
export function assetUrl(rel: string): string {
  return `${import.meta.env.BASE_URL}data/${rel.replace(/^\/+/, '')}`
}

export function fmtDate(iso: string): string {
  const d = new Date(iso.length === 10 ? iso + 'T12:00:00' : iso)
  // news.json приходит извне: битая или пустая дата не должна давать «NaN undefined NaN»
  if (Number.isNaN(d.getTime())) return iso
  return `${d.getDate()} ${MONTH_SHORT[d.getMonth()]} ${d.getFullYear()}`
}

export function monthLabel(ym: string): string {
  const [y, m] = ym.split('-')
  return `${MONTH_FULL[Number(m) - 1]} ${y}`
}
