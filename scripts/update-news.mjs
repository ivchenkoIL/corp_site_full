#!/usr/bin/env node
/* Ежедневное обновление дашборда через YandexGPT.
   1. Забирает свежие материалы из RSS-лент об ИИ: заголовок, аннотацию,
      картинку, ссылку на видео.
   2. Просит YandexGPT собрать из них русскоязычный дайджест (news.json).
   3. Скачивает картинки к себе — портал отдаёт их со своего домена.
   4. Вторым запросом строит прогноз по каждой новости, опираясь на
      сегодняшний выпуск и архив прошлых (data/archive/).
   5. Считает показатели выпуска и просит рекомендации (summary.json).

   Использование:
     YC_API_KEY=... YC_FOLDER_ID=... node scripts/update-news.mjs [путь-к-news.json]
     YC_OAUTH_TOKEN=... YC_FOLDER_ID=... node scripts/update-news.mjs [путь-к-news.json]

   YC_API_KEY     — API-ключ сервисного аккаунта с ролью ai.languageModels.user
   YC_OAUTH_TOKEN — либо OAuth-токен Яндекс ID (y0_...); меняется на IAM-токен
   YC_FOLDER_ID   — идентификатор каталога Яндекс Клауда
   NEWS_FEEDS     — (необязательно) свои RSS-ленты через запятую */

import { mkdir, readdir, readFile, rename, rm, writeFile } from 'node:fs/promises'
import { dirname, join, resolve } from 'node:path'

/* vc.ru отдаёт только общую ленту (https://vc.ru/rss/all): отдельного фида у
   раздела про ИИ нет — /ai/rss, /rss/ai и фиды тегов отвечают 404. Поэтому в
   отборе (askSelection) прямо сказано брать только материалы про ИИ: из vc.ru
   в выпуск проходят лишь они, остальное — вино, маркетплейсы — отсеивается. */
const DEFAULT_FEEDS = [
  'https://techcrunch.com/category/artificial-intelligence/feed/',
  'https://venturebeat.com/category/ai/feed/',
  'https://www.artificialintelligence-news.com/feed/',
  'https://vc.ru/rss/all',
]
const FEEDS = (process.env.NEWS_FEEDS ?? '')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean)
FEEDS.length || FEEDS.push(...DEFAULT_FEEDS)

const MAX_ITEMS_PER_FEED = 12
const TAGS = ['Релизы', 'Рынок', 'Безопасность', 'Регулирование']
const WANT_NEWS = 8            // сколько новостей просим у модели
/* Прогонов теперь два в сутки (таймер: 07:00 и 19:00 МСК). Второй прогон не
   переписывает выпуск, а дополняет его: уже вышедшие сюжеты исключаются из
   отбора, новые дописываются в конец. Поэтому у вечернего прогона планка на
   число тем ниже — за полдня может набраться и одна новая. */
const MIN_TOPICS_FIRST_RUN = 3 // меньше — считаем прогон неудачным
const MIN_TOPICS_TOP_UP = 1    // сколько хватает, когда выпуск уже начат
const HORIZONS = ['недели', '1–3 месяца', '3–6 месяцев', 'год и дальше']
const CONFIDENCE = ['высокая', 'средняя', 'низкая']
const ARTICLE_CHARS = 2500     // сколько текста статьи отдаём модели
const IMAGE_MIN_BYTES = 12_000 // мельче — это трекинг-пиксель или заглушка
const ARCHIVE_DAYS = 14        // сколько прошлых выпусков подмешиваем в прогноз
const ARCHIVE_KEEP_DAYS = 120  // сколько выпусков храним
const IMAGE_KEEP_DAYS = 45     // сколько дней держим скачанные картинки
const IMAGE_MAX_BYTES = 1_500_000

// эндпоинты можно переопределить в тестах, чтобы прогнать пайплайн без облака
const IAM_ENDPOINT = process.env.YC_IAM_ENDPOINT ?? 'https://iam.api.cloud.yandex.net/iam/v1/tokens'
const LLM_ENDPOINT =
  process.env.YC_LLM_ENDPOINT ?? 'https://llm.api.cloud.yandex.net/foundationModels/v1/completion'

const apiKey = process.env.YC_API_KEY
const oauthToken = process.env.YC_OAUTH_TOKEN
const folderId = process.env.YC_FOLDER_ID
if ((!apiKey && !oauthToken) || !folderId) {
  console.error(
    'Нужны YC_FOLDER_ID и одна из переменных: YC_API_KEY (Api-Key сервисного аккаунта) или YC_OAUTH_TOKEN (OAuth-токен Яндекс ID)',
  )
  process.exit(1)
}

/* Api-Key подставляется как есть; OAuth-токен Яндекс ID сначала меняется
   на короткоживущий IAM-токен (стандартный обмен, живёт до 12 часов).
   Токен берём один раз на прогон: запросов к модели теперь три. */
let authHeader = null
async function getAuthHeader() {
  if (authHeader) return authHeader
  if (apiKey) return (authHeader = `Api-Key ${apiKey}`)
  const res = await fetch(IAM_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ yandexPassportOauthToken: oauthToken }),
    signal: AbortSignal.timeout(30000),
  })
  if (!res.ok) {
    throw new Error(`Обмен OAuth→IAM не удался: HTTP ${res.status} ${(await res.text()).slice(0, 300)}`)
  }
  const { iamToken } = await res.json()
  if (!iamToken) throw new Error('В ответе IAM нет iamToken')
  return (authHeader = `Bearer ${iamToken}`)
}

const outPath = resolve(process.argv[2] ?? 'salon-dashboard/public/data/news.json')
const dataDir = dirname(outPath)
const imgDir = join(dataDir, 'img')
const archiveDir = join(dataDir, 'archive')
const today = new Date().toISOString().slice(0, 10)

function decodeEntities(s) {
  return s
    .replace(/<!\[CDATA\[(.*?)\]\]>/gs, '$1')
    .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"').replace(/&#0?39;/g, "'").replace(/&nbsp;/g, ' ')
    .trim()
}

function stripTags(s) {
  return decodeEntities(s.replace(/<[^>]*>/g, ' ')).replace(/\s+/g, ' ').trim()
}

/* Картинка материала: сначала явные поля RSS (media:*, enclosure),
   потом первый <img> из описания. Берём только http(s) — то, что не скачается,
   на страницу всё равно не попадёт. */
function pickImage(block) {
  const candidates = [
    block.match(/<media:content[^>]+url=["']([^"']+)["'][^>]*>/i)?.[1],
    block.match(/<media:thumbnail[^>]+url=["']([^"']+)["'][^>]*>/i)?.[1],
    block.match(/<enclosure[^>]+type=["']image\/[^"']*["'][^>]*url=["']([^"']+)["']/i)?.[1],
    block.match(/<enclosure[^>]+url=["']([^"']+)["'][^>]*type=["']image\//i)?.[1],
    block.match(/<img[^>]+src=["']([^"']+)["']/i)?.[1],
  ]
  for (const c of candidates) {
    const url = c ? decodeEntities(c) : ''
    if (/^https?:\/\//i.test(url) && !JUNK_IMAGE.test(url)) return url
  }
  return ''
}

/* Видео: ссылка на YouTube/Vimeo в теле материала или enclosure с видео.
   Встраивать не будем — только ссылка, iframe потребовал бы ослабить CSP. */
function pickVideo(block) {
  const m =
    block.match(/https?:\/\/(?:www\.)?youtube\.com\/watch\?v=[\w-]+/i) ||
    block.match(/https?:\/\/youtu\.be\/[\w-]+/i) ||
    block.match(/https?:\/\/(?:www\.)?vimeo\.com\/\d+/i) ||
    block.match(/<enclosure[^>]+type=["']video\/[^"']*["'][^>]*url=["']([^"']+)["']/i)
  if (!m) return ''
  return decodeEntities(m[1] ?? m[0])
}

/* Счётчики и заглушки — это не иллюстрация ни при каких условиях. */
const TRACKER_IMAGE = /pixel|tracking|1x1|spacer|blank\.|gravatar|avatar/i
/* А вот в теле письма мусором бывает ещё и логотип с иконкой. К og:image это
   правило не применяем: TechCrunch кладёт туда файлы вроде OpenAI-logo-green.jpg,
   и это настоящая иллюстрация материала. */
const JUNK_IMAGE = new RegExp(`${TRACKER_IMAGE.source}|logo|badge|icon`, 'i')

/* Со страницы статьи берём og:image и сам текст. Без этого модель видит только
   заголовок и куцую аннотацию — пересказ выходил в две строки воды, а прогнозы
   сводились к «основание: Новость 1». */
async function fetchArticle(url) {
  const out = { text: '', image: '' }
  try {
    const res = await fetch(url, {
      headers: { 'user-agent': 'vest-smr-news-bot/1.0' },
      signal: AbortSignal.timeout(25000),
    })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const html = (await res.text()).slice(0, 900_000)

    const og =
      html.match(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i)?.[1] ||
      html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["']/i)?.[1] ||
      html.match(/<meta[^>]+name=["']twitter:image["'][^>]+content=["']([^"']+)["']/i)?.[1] || ''
    if (/^https?:\/\//i.test(og) && !TRACKER_IMAGE.test(og)) out.image = decodeEntities(og)

    const body = html
      .replace(/<script[\s\S]*?<\/script>/gi, ' ')
      .replace(/<style[\s\S]*?<\/style>/gi, ' ')
      .replace(/<noscript[\s\S]*?<\/noscript>/gi, ' ')
    /* Берём именно абзацы <p>, а не всю страницу подряд: у TechCrunch нет тега
       <article>, и «первые 2500 знаков документа» — это шапка с меню на весь
       экран, из которой пересказывать нечего. Абзацы дают чистую прозу. */
    const region = body.match(/<article[\s>][\s\S]*?<\/article>/i)?.[0] ?? body
    const paragraphs = [...region.matchAll(/<p[^>]*>([\s\S]*?)<\/p>/gi)]
      .map((m) => stripTags(m[1]))
      .filter((t) => t.length > 60)
    out.text = (paragraphs.length >= 2 ? paragraphs.join('\n') : stripTags(region)).slice(0, ARTICLE_CHARS)
  } catch (e) {
    console.error(`  · статью ${url} не прочитал: ${e.message}`)
  }
  return out
}

async function fetchFeed(url) {
  try {
    const res = await fetch(url, {
      headers: { 'user-agent': 'vest-smr-news-bot/1.0' },
      signal: AbortSignal.timeout(20000),
    })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const xml = await res.text()
    const items = []
    for (const m of xml.matchAll(/<item[\s>][\s\S]*?<\/item>/g)) {
      const block = m[0]
      const title = block.match(/<title[^>]*>([\s\S]*?)<\/title>/)?.[1]
      const link = block.match(/<link[^>]*>([\s\S]*?)<\/link>/)?.[1]
      const date = block.match(/<pubDate[^>]*>([\s\S]*?)<\/pubDate>/)?.[1]
      const descRaw =
        block.match(/<description[^>]*>([\s\S]*?)<\/description>/)?.[1] ??
        block.match(/<content:encoded[^>]*>([\s\S]*?)<\/content:encoded>/)?.[1] ??
        ''
      const url2 = link ? decodeEntities(link) : ''
      // только http(s)-ссылки: allowedUrls попадает в клик href на сайте
      if (title && /^https?:\/\//i.test(url2)) {
        // кривой pubDate не должен ронять всю ленту
        const parsed = date ? new Date(decodeEntities(date)) : null
        items.push({
          title: decodeEntities(title),
          link: url2,
          date: parsed && !Number.isNaN(parsed.getTime()) ? parsed.toISOString().slice(0, 10) : '',
          // аннотация даёт модели фактуру: по одному заголовку пересказ выходит
          // из двух строк воды, а выдумывать детали ей запрещено
          desc: stripTags(descRaw).slice(0, 700),
          image: pickImage(block),
          video: pickVideo(block),
        })
      }
      if (items.length >= MAX_ITEMS_PER_FEED) break
    }
    console.error(`✓ ${url}: ${items.length} материалов`)
    return items
  } catch (e) {
    console.error(`✗ ${url}: ${e.message}`)
    return []
  }
}

async function ask(prompt, maxTokens) {
  const res = await fetch(LLM_ENDPOINT, {
    method: 'POST',
    headers: { 'Authorization': await getAuthHeader(), 'Content-Type': 'application/json' },
    body: JSON.stringify({
      modelUri: `gpt://${folderId}/yandexgpt/latest`,
      completionOptions: { stream: false, temperature: 0.3, maxTokens },
      messages: [{ role: 'user', text: prompt }],
    }),
    signal: AbortSignal.timeout(180000),
  })
  if (!res.ok) throw new Error(`YandexGPT HTTP ${res.status}: ${(await res.text()).slice(0, 300)}`)
  const text = (await res.json())?.result?.alternatives?.[0]?.message?.text
  if (!text) throw new Error('Пустой ответ YandexGPT')
  return text
}

function cutJson(text, open, close) {
  const t = text.replace(/^```(?:json)?/m, '').replace(/```\s*$/m, '').trim()
  const start = t.indexOf(open)
  const end = t.lastIndexOf(close)
  if (start === -1 || end === -1) throw new Error(`В ответе нет JSON (${open}${close})`)
  return JSON.parse(t.slice(start, end + 1))
}

// ─────────────────────────────────────────────────────────── дайджест

/* Сначала модель выбирает темы по заголовкам — это дёшево. Скачивать статьи
   имеет смысл только для отобранных: 8 запросов вместо 30. */
async function askSelection(headlines, { minTopics, already = [] }) {
  /* В ленты добавлен vc.ru — она общая, там вперемешку маркетплейсы, банки и
     ИИ. Тему «не про ИИ» модель должна пропускать, даже если материал важный:
     дашборд — про индустрию ИИ, и посторонняя новость в нём выглядит сбоем. */
  const covered = already.length
    ? `\n\nЭти сюжеты уже вышли в сегодняшнем выпуске — повторы и их продолжения не бери:\n${already.map((t, i) => `${i + 1}. ${t}`).join('\n')}`
    : ''
  const text = await ask(
    `Ты — редактор новостного канала о технологиях ИИ. Ниже — свежие материалы СМИ (зарубежных и российских). Отбери до ${WANT_NEWS} самых важных и разных по теме: дублирующие друг друга сюжеты не бери.

Ответь СТРОГО JSON-массивом без пояснений:
[{"n": номер материала, "tag": один из ${TAGS.map((t) => `"${t}"`).join(', ')}}]

Правила отбора:
- бери ТОЛЬКО материалы про искусственный интеллект: модели и их релизы, ИИ-продукты и внедрения, сделки и деньги в ИИ, безопасность ИИ, регулирование ИИ, чипы и инфраструктура для ИИ;
- всё остальное пропускай, даже если материал заметный: новости про ритейл, банки, логистику, происшествия и прочее в этот дашборд не идут;
- лучше отобрать меньше тем, чем добрать посторонними;
- если подходящих материалов нет вовсе — верни пустой массив [].${covered}

Материалы:
${headlines.map((h, i) => `${i + 1}. [${h.date}] ${h.title}`).join('\n')}`,
    1500,
  )
  const picked = []
  const seen = new Set()
  for (const row of cutJson(text, '[', ']') || []) {
    const i = Number(row?.n) - 1
    if (!Number.isInteger(i) || i < 0 || i >= headlines.length || seen.has(i)) continue
    seen.add(i)
    picked.push({ ...headlines[i], tag: TAGS.includes(row.tag) ? row.tag : 'Рынок' })
    if (picked.length >= WANT_NEWS) break
  }
  if (picked.length < minTopics) throw new Error(`отобрано ${picked.length} тем, нужно ${minTopics}`)
  return picked
}

/* Дубли между прогонами ловим ПОСЛЕ пересказа, а не в отборе: отбор сравнивает
   английские заголовки лент с русскими заголовками выпуска, и той же новости
   на другом языке модель не узнаёт (проверено: вечерний прогон пересобрал все
   утренние сюжеты заново). Здесь же оба списка русские. При кривом ответе
   оставляем кандидатов как есть — лишняя новость дешевле потерянной. */
async function dropDuplicates(existing, added) {
  const text = await ask(
    `Ты — выпускающий редактор. Ниже два списка новостей: уже вышедшие сегодня и кандидаты на добавление. Найди кандидатов, которые рассказывают о том же событии, что и любая уже вышедшая новость — пусть другими словами или с другими подробностями.

Ответь СТРОГО JSON-массивом номеров кандидатов-дубликатов без пояснений: [2, 5]. Если дубликатов нет — [].

Уже вышли:
${existing.map((n, i) => `${i + 1}. ${n.title} — ${n.summary}`).join('\n')}

Кандидаты:
${added.map((n, i) => `${i + 1}. ${n.title} — ${n.summary}`).join('\n')}`,
    500,
  )
  const dupes = new Set(
    (cutJson(text, '[', ']') || [])
      .map(Number)
      .filter((x) => Number.isInteger(x) && x >= 1 && x <= added.length),
  )
  if (dupes.size) console.error(`· Отброшено дублей: ${dupes.size} из ${added.length}`)
  return added.filter((_, i) => !dupes.has(i + 1))
}

async function askDigest(headlines) {
  return ask(
    `Ты — редактор новостного канала о технологиях ИИ. Ниже — отобранные материалы: заголовок, рубрика, текст статьи и ссылка. Перескажи каждый на русском языке — по одной новости на материал, порядок сохрани.

Ответь СТРОГО JSON-массивом без пояснений и без markdown. Каждый элемент:
{
  "date": "${today}",
  "tag": рубрика материала из списка ниже,
  "title": "заголовок на русском",
  "summary": "1–2 предложения сути",
  "body": ["абзац 1", "абзац 2", "абзац 3", "абзац 4"] — развёрнутый пересказ на 3–4 абзаца, В КАЖДОМ 3–5 ПРЕДЛОЖЕНИЙ: что именно произошло; подробности, цифры, имена и цитаты из текста статьи; предыстория; кого это касается и что меняет. Однострочные абзацы недопустимы, на новость должно выйти не меньше 900 знаков,
  "sources": [{"label": "название издания и заголовок", "url": "ссылка из списка"}]
}

Правила: бери факты только из текста статьи; не выдумывай цифры, компании, даты и цитаты; чего в тексте нет — того не пиши; url бери только из списка ниже; каждая новость — минимум один источник.

Материалы:
${headlines.map((h, i) => `${i + 1}. [${h.tag}] [${h.date}] ${h.title}\n   ТЕКСТ: ${h.article || h.desc}\n   ССЫЛКА: ${h.link}`).join('\n\n')}`,
    8000,
  )
}

function parseDigest(text, byUrl, idOffset = 0) {
  const raw = cutJson(text, '[', ']')
  if (!Array.isArray(raw) || raw.length === 0) throw new Error('Пустой дайджест')
  const stamp = today.replaceAll('-', '')
  return raw
    .filter((n) => n && typeof n.title === 'string')
    .map((n, i) => ({
      // id назначаем сами: модель может выдать дубликаты, а id — это ключ
      // React-списков и часть URL /news/:id. Нумерация продолжает утренний
      // выпуск (idOffset), иначе вечерний прогон переиспользовал бы d…-1 и
      // затёр бы картинку утренней новости — имя файла берётся из id.
      id: `d${stamp}-${idOffset + i + 1}`,
      date: typeof n.date === 'string' ? n.date : today,
      tag: TAGS.includes(n.tag) ? n.tag : 'Рынок',
      title: String(n.title).slice(0, 200),
      summary: String(n.summary ?? '').slice(0, 500),
      body: (Array.isArray(n.body) ? n.body : [])
        .filter((p) => typeof p === 'string')
        .map((p) => p.slice(0, 2000)),
      // защита от галлюцинаций: оставляем только ссылки из реальных лент
      sources: (Array.isArray(n.sources) ? n.sources : []).filter(
        (s) => s && typeof s.url === 'string' && byUrl.has(s.url) && typeof s.label === 'string',
      ),
      image: null,
      video: null,
      forecast: [],
    }))
    .filter((n) => n.sources.length > 0)
}

// ─────────────────────────────────────────────────────── картинки и видео

async function downloadImage(url, id) {
  const res = await fetch(url, {
    headers: { 'user-agent': 'vest-smr-news-bot/1.0' },
    signal: AbortSignal.timeout(30000),
  })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  const type = (res.headers.get('content-type') ?? '').split(';')[0].trim()
  if (!type.startsWith('image/')) throw new Error(`не картинка: ${type || 'без типа'}`)
  const buf = Buffer.from(await res.arrayBuffer())
  if (buf.length > IMAGE_MAX_BYTES) throw new Error(`${Math.round(buf.length / 1024)} КБ — слишком много`)
  if (buf.length < IMAGE_MIN_BYTES) throw new Error(`${Math.round(buf.length / 1024)} КБ — это не иллюстрация`)
  const ext = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'image/gif': 'gif' }[type]
  if (!ext) throw new Error(`формат ${type} не берём`)
  await mkdir(imgDir, { recursive: true })
  const name = `${id}.${ext}`
  await writeFile(join(imgDir, name), buf)
  return { name, bytes: buf.length }
}

/* Картинки кладём к себе, а не ссылаемся на СМИ: CSP портала пускает
   изображения только со своего домена, да и чужой файл может исчезнуть. */
async function attachMedia(news, byUrl) {
  let ok = 0
  for (const n of news) {
    const src = n.sources.map((s) => byUrl.get(s.url)).find(Boolean)
    if (!src) continue
    if (src.video) n.video = { url: src.video, label: 'Видео у источника' }
    // og:image со страницы статьи — первым: в ленте часто лежит превьюшка
    const tries = [src.ogImage, src.image].filter(Boolean)
    for (const url of tries) {
      try {
        const { name } = await downloadImage(url, n.id)
        n.image = { src: `img/${name}`, credit: new URL(n.sources[0].url).hostname.replace(/^www\./, '') }
        ok++
        break
      } catch (e) {
        console.error(`  · картинка для ${n.id} (${url.slice(0, 60)}): ${e.message}`)
      }
    }
  }
  console.error(`✓ Картинок скачано: ${ok} из ${news.length}`)
}

// ─────────────────────────────────────────────────────────────── архив

async function readArchive() {
  try {
    const files = (await readdir(archiveDir)).filter((f) => /^\d{4}-\d{2}-\d{2}\.json$/.test(f)).sort()
    const recent = files.filter((f) => f.slice(0, 10) !== today).slice(-ARCHIVE_DAYS)
    const out = []
    for (const f of recent) {
      try {
        const items = JSON.parse(await readFile(join(archiveDir, f), 'utf-8'))
        if (Array.isArray(items)) {
          out.push({ date: f.slice(0, 10), items: items.map((n) => ({ tag: n.tag, title: n.title })) })
        }
      } catch { /* битый файл архива не должен ронять прогон */ }
    }
    return out
  } catch {
    return []
  }
}

async function writeArchive(news) {
  await mkdir(archiveDir, { recursive: true })
  await writeFile(join(archiveDir, `${today}.json`), JSON.stringify(news, null, 2) + '\n')
}

/* Чистка по дате в имени: архив — по имени файла, картинки — по дате в id
   (d20260811-3.jpg). Раз в сутки, дешевле отдельного таймера. */
async function cleanup(keep = []) {
  const limit = (days) => {
    const d = new Date()
    d.setUTCDate(d.getUTCDate() - days)
    return d.toISOString().slice(0, 10)
  }
  try {
    const edge = limit(ARCHIVE_KEEP_DAYS)
    for (const f of await readdir(archiveDir)) {
      if (/^\d{4}-\d{2}-\d{2}\.json$/.test(f) && f.slice(0, 10) < edge) {
        await rm(join(archiveDir, f), { force: true })
      }
    }
  } catch { /* архива ещё нет */ }
  try {
    const edge = limit(IMAGE_KEEP_DAYS).replaceAll('-', '')
    // заодно подчищаем осиротевшие файлы: неудачная попытка могла оставить
    // картинку, на которую сегодняшний выпуск уже не ссылается
    const used = new Set(keep.map((n) => n.image?.src?.replace(/^img\//, '')).filter(Boolean))
    for (const f of await readdir(imgDir)) {
      const stamp = f.match(/^d(\d{8})-/)?.[1]
      if (stamp && stamp < edge) { await rm(join(imgDir, f), { force: true }); continue }
      if (stamp === today.replaceAll('-', '') && !used.has(f)) await rm(join(imgDir, f), { force: true })
    }
  } catch { /* картинок ещё нет */ }
}

// ───────────────────────────────────────────────────────────── прогнозы

/* onlyIdx — 0-based номера новостей, для которых нужны прогнозы. Просить
   разбор всех 16 новостей одним запросом нельзя: детальный JSON на три
   прогноза каждой не влезает в ответ, модель молча останавливается на
   восьмой — вечерние новости оставались без разбора. */
async function askForecasts(news, archive, onlyIdx) {
  const history = archive.length
    ? archive
        .map((d) => `${d.date}: ${d.items.map((i) => `[${i.tag}] ${i.title}`).join('; ')}`)
        .join('\n')
    : '(архив пуст — это первый выпуск)'

  return ask(
    `Ты — аналитик, который ведёт дашборд мониторинга индустрии ИИ. Ниже — сегодняшний выпуск и заголовки прошлых выпусков. Дай разбор последствий — что из новости следует, для кого и в какие сроки — ТОЛЬКО для новостей с номерами: ${onlyIdx.map((i) => i + 1).join(', ')}. Остальные приведены для связи сюжетов, их не разбирай.

Ответь СТРОГО JSON-массивом без пояснений и без markdown:
[{"news": номер новости из списка, "forecasts": [{
  "text": "что произойдёт дальше и почему — 2–3 предложения",
  "horizon": один из ${HORIZONS.map((h) => `"${h}"`).join(', ')},
  "confidence": один из ${CONFIDENCE.map((c) => `"${c}"`).join(', ')},
  "impact": "кого это касается и что у них меняется — 1–2 предложения",
  "signal": "по какому наблюдаемому событию станет понятно, что прогноз сбывается",
  "risk": "что может пойти иначе и при каком условии прогноз не сбудется",
  "basis": "на чём основано"
}]}]

Правила:
- 3 прогноза на новость: ближний (недели), средний (месяцы) и один неочевидный — второго порядка, про смежный рынок или про тех, кого новость задевает косвенно;
- прогноз не пересказывает новость, а говорит, что произойдёт дальше и почему;
- в "text" и "impact" работай конкретикой из ФАКТУРЫ: если в новости есть суммы, проценты, названия продуктов и компаний — прогноз строится вокруг них, а не вокруг общих слов «улучшит» и «повысит»;
- "impact" — конкретно: кто именно (разработчики, закупщики ИИ, облачные провайдеры, регуляторы, конечные пользователи) и что у них меняется в работе, деньгах или сроках;
- "signal" — проверяемое событие, которое можно увидеть со стороны: публикация цен, релиз, иск, отчёт, заявление регулятора. Не «рынок отреагирует», а что именно будет видно;
- "risk" — честное условие, при котором прогноз не сбудется; если сценарий почти безальтернативный, так и напиши;
- "confidence" ставь честно: «высокая» — только когда вывод следует из уже объявленного; догадки помечай «низкая»;
- связывай новости между собой: хотя бы один прогноз на новость должен опираться на другую сегодняшнюю новость или на повторяющийся сюжет из архива;
- в "basis" перечисли, из чего сделан вывод: номера новостей («новости 2 и 5») и, если есть, дату прошлого выпуска («выпуск 09.08: та же тема»). Писать в basis только номер самой новости ЗАПРЕЩЕНО: если смежных сюжетов нет, напиши «смежных сюжетов нет» и укажи, какой факт из ФАКТУРЫ несёт вывод;
- не выдумывай цифры, сроки, названия компаний и продуктов, которых нет в списках;
- если по новости нечего сказать сверх очевидного — дай меньше прогнозов, но честных;
- пиши как аналитик для руководителя: без штампов и восклицаний.

Сегодняшний выпуск:
${news
  .map((n, i) => {
    const line = `${i + 1}. [${n.tag}] ${n.title} — ${n.summary}`
    if (!onlyIdx.includes(i)) return line
    // фактура — только разбираемым: с одними заголовками прогнозы выходили
    // водянистыми («улучшит», «повысит») без единой цифры и имени
    const facts = (Array.isArray(n.body) ? n.body : []).join(' ').slice(0, 700)
    return facts ? `${line}\n   ФАКТУРА: ${facts}` : line
  })
  .join('\n')}

Прошлые выпуски:
${history}`,
    12000,
  )
}

function applyForecasts(news, text) {
  const raw = cutJson(text, '[', ']')
  let total = 0
  for (const row of Array.isArray(raw) ? raw : []) {
    const idx = Number(row?.news) - 1
    if (!Number.isInteger(idx) || idx < 0 || idx >= news.length) continue
    /* Обязателен только сам прогноз. Срок и уверенность приводим к своему
       списку: модель периодически пишет «в ближайшее время» вместо значения
       из перечня, и такую подпись лучше не показывать вовсе, чем показывать
       рядом с настоящими. Остальные поля — необязательные строки. */
    const pick = (v, allowed) => {
      const s = typeof v === 'string' ? v.trim().toLowerCase() : ''
      return allowed.find((a) => a.toLowerCase() === s) ?? ''
    }
    const str = (v, max) => (typeof v === 'string' ? v.trim().slice(0, max) : '')
    const list = (Array.isArray(row.forecasts) ? row.forecasts : [])
      .filter((f) => f && typeof f.text === 'string' && f.text.trim().length >= 30)
      .slice(0, 3)
      .map((f) => ({
        text: f.text.trim().slice(0, 600),
        horizon: pick(f.horizon, HORIZONS),
        confidence: pick(f.confidence, CONFIDENCE),
        impact: str(f.impact, 400),
        signal: str(f.signal, 300),
        risk: str(f.risk, 300),
        // «Основание: Новость 1» основанием не является — поле опциональное,
        // без него строка на странице просто не выводится
        basis: (() => {
          const b = str(f.basis, 200)
          return /^новост\w*\s*№?\s*\d+\s*\.?$/i.test(b) ? '' : b
        })(),
      }))
    news[idx].forecast = list
    total += list.length
  }
  const covered = news.filter((n) => n.forecast?.length).length
  if (!covered) throw new Error('ни одной новости не покрыто')
  return { total, covered }
}

const FORECAST_BATCH = 8 // больше в один детальный ответ модели не влезает

/* Прогнозы просим только там, где их нет: у утренних новостей они уже есть,
   и повторный запрос по всему выпуску лишь тратил бы токены и обрезал ответ. */
async function fillForecasts(list, archive) {
  const need = list.map((n, i) => (n.forecast?.length ? -1 : i)).filter((i) => i >= 0)
  for (let at = 0; at < need.length; at += FORECAST_BATCH) {
    const chunk = need.slice(at, at + FORECAST_BATCH)
    applyForecasts(list, await askForecasts(list, archive, chunk))
  }
  return {
    needed: need.length,
    covered: need.filter((i) => list[i].forecast?.length).length,
  }
}

/* Ветка «новостей не прибавилось»: дозаполнить пропущенные прогнозы прошлого
   прогона всё равно стоит — иначе неудача одного запроса оставалась бы на
   странице до конца дня. */
async function backfillOnlyAndExit(list) {
  try {
    const { needed, covered } = await fillForecasts(list, await readArchive())
    if (needed && covered) {
      await writeAtomic(outPath, list)
      console.error(`✓ Дозаполнены прогнозы: ${covered} из ${needed} новостей, файл обновлён`)
    } else if (needed) {
      console.error(`✗ Прогнозы дозаполнить не вышло (${needed} новостей без разбора)`)
    }
  } catch (e) {
    console.error(`✗ Прогнозы дозаполнить не удалось: ${e.message}`)
  }
  process.exit(0)
}

// ──────────────────────────────────────────────────────────── показатели

/* Показатели выпуска считаются по самому дайджесту, а не спрашиваются у модели:
   счётчик по рубрике всегда сходится с тем, что видно в ленте, и выдумать его
   нельзя. Ранняя версия просила цифры у YandexGPT — выходили подписи вроде
   «Вступили в с», обрезанные по лимиту, и величины, которых нет в новостях. */
const METRIC_SPEC = [
  { tag: 'Релизы', label: 'Релизы моделей', good: true },
  { tag: 'Рынок', label: 'Рынок и сделки', good: true },
  { tag: 'Безопасность', label: 'Инциденты безопасности', good: false },
  { tag: 'Регулирование', label: 'Регулирование', good: true },
]

function buildMetrics(news) {
  return METRIC_SPEC.map(({ tag, label, good }) => {
    const n = news.filter((x) => x.tag === tag).length
    return {
      label,
      value: String(n),
      note: n ? `из ${news.length} новостей выпуска` : 'сегодня ничего',
      dir: n ? 'up' : 'down',
      good: n ? good : true,
    }
  })
}

async function askRecommendations(news) {
  const text = await ask(
    `Ты — аналитик, который ведёт дашборд мониторинга индустрии ИИ. Ниже — сегодняшний дайджест новостей. Сформулируй три рекомендации для компании, которая закупает и внедряет ИИ.

Ответь СТРОГО JSON-массивом из трёх строк, без пояснений и без markdown:
["рекомендация 1", "рекомендация 2", "рекомендация 3"]

Правила: каждая рекомендация — одно-два предложения по-русски, начинается с сути и двоеточия («Оптимизация затрат: …»); опирайся только на новости ниже; не выдумывай цифры, компании и цитаты.

Дайджест:
${news.map((n, i) => `${i + 1}. [${n.tag}] ${n.title} — ${n.summary}`).join('\n')}`,
    1500,
  )
  const recs = (cutJson(text, '[', ']') || [])
    .filter((r) => typeof r === 'string' && r.trim().length >= 30 && r.trim().length <= 400)
    .map((r) => r.trim())
  // рваную сводку не пишем: лучше вчерашняя целая
  if (recs.length < 2) throw new Error(`рекомендаций ${recs.length}, нужно минимум 2`)
  return recs.slice(0, 3)
}

// ─────────────────────────────────────────────────────────────── прогон

async function writeAtomic(path, data) {
  const tmp = `${path}.tmp`
  await writeFile(tmp, JSON.stringify(data, null, 2) + '\n')
  await rename(tmp, path)
}

/* Сегодняшний выпуск, если он уже начат утренним прогоном. Файл хранит один
   выпуск целиком, поэтому вчерашний считаем отсутствующим и начинаем заново.
   Сегодняшность определяем по штампу даты в id (d20260816-3): id назначает
   сам генератор, а вот поле date модель заполняет датой публикации статьи —
   первая же проверка показала, что фильтр по date оставляет от утреннего
   выпуска 1 новость из 8. */
async function readTodayIssue() {
  const stamp = `d${today.replaceAll('-', '')}-`
  try {
    const raw = JSON.parse(await readFile(outPath, 'utf-8'))
    if (!Array.isArray(raw)) return []
    return raw.filter((n) => n && typeof n.id === 'string' && n.id.startsWith(stamp))
  } catch {
    return [] // файла ещё нет или он битый — начинаем выпуск с нуля
  }
}

const existing = await readTodayIssue()
const topUp = existing.length > 0
console.error(
  topUp
    ? `▸ Выпуск за ${today} уже начат: ${existing.length} новостей, дополняю`
    : `▸ Выпуск за ${today} собирается с нуля`,
)

const headlines = (await Promise.all(FEEDS.map(fetchFeed))).flat()
if (headlines.length < 5) {
  console.error(`Слишком мало материалов из лент (${headlines.length}) — файл не обновляю`)
  process.exit(1)
}
const byUrl = new Map(headlines.map((h) => [h.link, h]))

/* Ссылки, уже разобранные сегодня, из отбора убираем совсем: так вечерний
   прогон физически не может выдать ту же новость вторым номером. Заголовки
   утреннего выпуска дополнительно уходят в промпт — от пересказа того же
   сюжета по другой ссылке регулярка не спасает. */
const usedLinks = new Set(existing.flatMap((n) => (n.sources ?? []).map((s) => s.url)))
const fresh = headlines.filter((h) => !usedLinks.has(h.link))
if (topUp && fresh.length === 0) {
  console.error('Новых материалов в лентах нет — новости не трогаю')
  await backfillOnlyAndExit(existing)
}

let selected
try {
  selected = await askSelection(fresh, {
    minTopics: topUp ? MIN_TOPICS_TOP_UP : MIN_TOPICS_FIRST_RUN,
    already: existing.map((n) => n.title),
  })
} catch (e) {
  // утренний выпуск на месте — вечерний прогон впустую не должен его портить
  if (topUp) {
    console.error(`Добрать нечего (${e.message}) — новости не трогаю`)
    await backfillOnlyAndExit(existing)
  }
  throw e
}
console.error(`✓ Отобрано тем: ${selected.length}`)

// статьи читаем параллельно: восемь запросов укладываются в несколько секунд
await Promise.all(
  selected.map(async (h) => {
    const a = await fetchArticle(h.link)
    h.article = a.text
    h.ogImage = a.image
  }),
)
const readOk = selected.filter((h) => h.article.length > 400).length
console.error(`✓ Прочитано статей: ${readOk} из ${selected.length}`)

/* selected — копии элементов ленты (в них дописаны текст статьи и og:image),
   поэтому карту по ссылке надо переоткрыть на них. Иначе attachMedia достаёт
   исходный элемент без og:image — картинки молча не находились. */
for (const h of selected) byUrl.set(h.link, h)

/* Нумерация id продолжает утренний выпуск: d20260816-1..8 утром, -9 и дальше
   вечером. Берём максимум, а не длину: если утром какая-то новость отсеялась
   валидацией, длина меньше последнего номера — и id бы столкнулись. */
const lastIndex = existing.reduce((max, n) => {
  const i = Number(String(n.id).match(/-(\d+)$/)?.[1] ?? 0)
  return Number.isInteger(i) && i > max ? i : max
}, 0)

let added = parseDigest(await askDigest(selected), byUrl, lastIndex)
if (topUp && added.length) {
  try {
    added = await dropDuplicates(existing, added)
  } catch (e) {
    console.error(`✗ Проверка на дубли не удалась (${e.message}) — беру всех кандидатов`)
  }
}
const news = [...existing, ...added]
if (added.length === 0 || news.length < 3) {
  console.error(
    `После валидации и дублей: новых ${added.length}, в выпуске ${news.length} — файл не обновляю`,
  )
  process.exit(topUp ? 0 : 1)
}

// картинки качаем только новым: у утренних они уже лежат в img/
await attachMedia(added, byUrl)

/* Прогноз — отдельная попытка: если модель ответит криво, выпуск всё равно
   выйдет, просто без блока «что из этого следует». Контекстом уходит весь
   выпуск (связка «новость 3 + новость 9» — то, ради чего в промпте требуется
   опора на соседние сюжеты), но разбор просим только для новостей без
   прогноза: утренние свой уже получили. */
const archive = await readArchive()
try {
  const { needed, covered } = await fillForecasts(news, archive)
  console.error(`✓ Прогнозы: покрыто ${covered} из ${needed} новых, в выпуске ${news.length} (архив: ${archive.length} выпусков)`)
} catch (e) {
  console.error(`✗ Прогнозы не построены: ${e.message}`)
}

await mkdir(dataDir, { recursive: true })
// атомарно: портал отдаёт этот файл прямо с диска, упавшая на середине
// запись не должна оставить пустой/битый файл вместо вчерашнего дайджеста
await writeAtomic(outPath, news)
console.error(`✓ Записано ${news.length} новостей в ${outPath} (добавлено в этот прогон: ${added.length})`)

await writeArchive(news)
await cleanup(news)

/* Сводка — отдельным файлом и отдельной попыткой: новости к этому моменту уже
   на диске, и если модель ответит криво, на странице останется вчерашняя. */
const summaryPath = join(dataDir, 'summary.json')
try {
  const summary = {
    date: today,
    metrics: buildMetrics(news),
    recommendations: await askRecommendations(news),
  }
  await writeAtomic(summaryPath, summary)
  console.error(`✓ Записана сводка: ${summary.metrics.map((m) => `${m.label} ${m.value}`).join(', ')}`)
} catch (e) {
  console.error(`✗ Сводка не обновлена (остаётся прежняя): ${e.message}`)
}
