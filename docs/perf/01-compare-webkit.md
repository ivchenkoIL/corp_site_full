# Сравнение прогонов: webkit 26.5 (00-base-mac-webkit.json) против webkit 26.5 (01-textures-medium-webkit.json)

| | webkit 26.5 (00-base-mac-webkit.json) | webkit 26.5 (01-textures-medium-webkit.json) |
| --- | --- | --- |
| Снято | 2026-09-04T21:49:30.482Z | 2026-09-04T22:39:24.842Z |
| Рендерер | Apple GPU | Apple GPU |
| Окно | 1440×900 @ dpr 2 | 1440×900 @ dpr 2 |
| Профиль качества | — (до этапа 02) | medium |
| Ядер у хоста | 10 | 10 |

## Открытая улица

| Метрика | webkit 26.5 (00-base-mac-webkit.json) | webkit 26.5 (01-textures-medium-webkit.json) | Разница |
| --- | ---: | ---: | --- |
| FPS (по медиане кадра) | 58.8 | 58.8 |  |
| Время кадра p50, мс | 17 | 17 | поровну |
| Время кадра p95, мс | 18 | 18 | поровну |
| Главный поток p50, мс | 1 | 1 | поровну |
| Draw call'ов p50 | 92 | 92 |  |
| Треугольников p50 | 167 356 | 170 316 |  |
| Время GPU p50, мс | — | — | — |
| Буфер отрисовки | — | 1800×1126 |  |
| Интервалов в выборке | 2 409 | 2 410 |  |
| Загрузка до конца заставки, мс | 348 | 684 | webkit 26.5 (00-base-mac-webkit.json) быстрее в 2,0 раза |
| — из них генерация текстур, мс | 153 | 492 | webkit 26.5 (00-base-mac-webkit.json) быстрее в 3,2 раза |

| Проход | webkit 26.5 (00-base-mac-webkit.json), мс | webkit 26.5 (01-textures-medium-webkit.json), мс |
| --- | ---: | ---: |
| clear:очистка+служебное | 0 | 1 |
| sky:небо | 0 | 1 |
| main:статика района | 0 | 2 |
| glow:тени под объектами | 0 | 0 |
| main:персонажи и техника | 0 | 0 |
| glow:свечения и маркеры | 0 | 0 |

## Плотная застройка

| Метрика | webkit 26.5 (00-base-mac-webkit.json) | webkit 26.5 (01-textures-medium-webkit.json) | Разница |
| --- | ---: | ---: | --- |
| FPS (по медиане кадра) | 58.8 | 58.8 |  |
| Время кадра p50, мс | 17 | 17 | поровну |
| Время кадра p95, мс | 17 | 18 | webkit 26.5 (00-base-mac-webkit.json) быстрее на 6 % |
| Главный поток p50, мс | 1 | 1 | поровну |
| Draw call'ов p50 | 107 | 109 |  |
| Треугольников p50 | 185 792 | 188 540 |  |
| Время GPU p50, мс | — | — | — |
| Буфер отрисовки | — | 1800×1126 |  |
| Интервалов в выборке | 2 407 | 2 407 |  |
| Загрузка до конца заставки, мс | 255 | 569 | webkit 26.5 (00-base-mac-webkit.json) быстрее в 2,2 раза |
| — из них генерация текстур, мс | 130 | 452 | webkit 26.5 (00-base-mac-webkit.json) быстрее в 3,5 раза |

| Проход | webkit 26.5 (00-base-mac-webkit.json), мс | webkit 26.5 (01-textures-medium-webkit.json), мс |
| --- | ---: | ---: |
| main:статика района | 1 | 2 |
| clear:очистка+служебное | 0 | 0 |
| sky:небо | 0 | 0 |
| glow:тени под объектами | 0 | 0 |
| main:персонажи и техника | 0 | 0 |
| glow:свечения и маркеры | 0 | 0 |

## Техника в движении

| Метрика | webkit 26.5 (00-base-mac-webkit.json) | webkit 26.5 (01-textures-medium-webkit.json) | Разница |
| --- | ---: | ---: | --- |
| FPS (по медиане кадра) | 58.8 | 58.8 |  |
| Время кадра p50, мс | 17 | 17 | поровну |
| Время кадра p95, мс | 17 | 18 | webkit 26.5 (00-base-mac-webkit.json) быстрее на 6 % |
| Главный поток p50, мс | 1 | 1 | поровну |
| Draw call'ов p50 | 141 | 140 |  |
| Треугольников p50 | 237 242 | 237 232 |  |
| Время GPU p50, мс | — | — | — |
| Буфер отрисовки | — | 1800×1126 |  |
| Интервалов в выборке | 2 407 | 2 408 |  |
| Загрузка до конца заставки, мс | 257 | 561 | webkit 26.5 (00-base-mac-webkit.json) быстрее в 2,2 раза |
| — из них генерация текстур, мс | 131 | 427 | webkit 26.5 (00-base-mac-webkit.json) быстрее в 3,3 раза |

| Проход | webkit 26.5 (00-base-mac-webkit.json), мс | webkit 26.5 (01-textures-medium-webkit.json), мс |
| --- | ---: | ---: |
| clear:очистка+служебное | 0 | 0 |
| sky:небо | 0 | 0 |
| main:статика района | 0 | 1 |
| glow:тени под объектами | 0 | 0 |
| main:персонажи и техника | 0 | 0 |
| glow:свечения и маркеры | 0 | 0 |

## Расширения WebGL2

| Расширение | webkit 26.5 (00-base-mac-webkit.json) | webkit 26.5 (01-textures-medium-webkit.json) |
| --- | :---: | :---: |
| `EXT_texture_filter_anisotropic` | есть | есть |
| `EXT_color_buffer_float` | есть | есть |
| `EXT_disjoint_timer_query_webgl2` | **нет** | **нет** |
| `OES_texture_float_linear` | есть | есть |
| `EXT_color_buffer_half_float` | есть | есть |
| `WEBGL_debug_renderer_info` | есть | есть |
| `OVR_multiview2` | **нет** | **нет** |
| `WEBGL_multi_draw` | есть | есть |
| `KHR_parallel_shader_compile` | есть | есть |

Всего расширений: webkit 26.5 (00-base-mac-webkit.json) — 36, webkit 26.5 (01-textures-medium-webkit.json) — 36.

## Память

| | webkit 26.5 (00-base-mac-webkit.json) | webkit 26.5 (01-textures-medium-webkit.json) |
| --- | ---: | ---: |
| Текстур (объектов GL) | 39 | 9 |
| Нулевой уровень, МиБ | 27.9 | 46.8 |
| Текстуры с мипами, МиБ | 37.2 | 62.4 |
| Буферы, МиБ | 17.0 | 17.0 |

