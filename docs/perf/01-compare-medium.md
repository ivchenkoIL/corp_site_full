# Сравнение прогонов: chromium 151.0.7922.34 (00-base-mac-chromium.json) против chromium 151.0.7922.34 (01-textures-medium-chromium.json)

| | chromium 151.0.7922.34 (00-base-mac-chromium.json) | chromium 151.0.7922.34 (01-textures-medium-chromium.json) |
| --- | --- | --- |
| Снято | 2026-09-04T21:46:03.527Z | 2026-09-04T22:32:30.860Z |
| Рендерер | ANGLE (Apple, ANGLE Metal Renderer: Apple M4, Unspecified Version) | ANGLE (Apple, ANGLE Metal Renderer: Apple M4, Unspecified Version) |
| Окно | 1440×900 @ dpr 2 | 1440×900 @ dpr 2 |
| Профиль качества | — (до этапа 02) | medium |
| Ядер у хоста | 10 | 10 |

## Открытая улица

| Метрика | chromium 151.0.7922.34 (00-base-mac-chromium.json) | chromium 151.0.7922.34 (01-textures-medium-chromium.json) | Разница |
| --- | ---: | ---: | --- |
| FPS (по медиане кадра) | 78.1 | 71.9 |  |
| Время кадра p50, мс | 12.8 | 13.9 | chromium 151.0.7922.34 (00-base-mac-chromium.json) быстрее на 9 % |
| Время кадра p95, мс | 26.1 | 26.1 | поровну |
| Главный поток p50, мс | 0.60 | 0.60 | поровну |
| Draw call'ов p50 | 92 | 93 |  |
| Треугольников p50 | 167 356 | 170 320 |  |
| Время GPU p50, мс | 1.25 | 2.34 | chromium 151.0.7922.34 (00-base-mac-chromium.json) быстрее в 1,9 раза |
| Буфер отрисовки | — | 1800×1126 |  |
| Интервалов в выборке | 2 864 | 2 745 |  |
| Загрузка до конца заставки, мс | 379.3 | 556.9 | chromium 151.0.7922.34 (00-base-mac-chromium.json) быстрее на 47 % |
| — из них генерация текстур, мс | 179.4 | 371.3 | chromium 151.0.7922.34 (00-base-mac-chromium.json) быстрее в 2,1 раза |

| Проход | chromium 151.0.7922.34 (00-base-mac-chromium.json), мс | chromium 151.0.7922.34 (01-textures-medium-chromium.json), мс |
| --- | ---: | ---: |
| clear:очистка+служебное | 4.60 | 9 |
| main:статика района | 2.40 | 3.20 |
| sky:небо | 1.80 | 2.10 |
| main:персонажи и техника | 1.40 | 1.60 |
| glow:свечения и маркеры | 1.30 | 1.40 |
| glow:тени под объектами | 1.10 | 1.20 |

## Плотная застройка

| Метрика | chromium 151.0.7922.34 (00-base-mac-chromium.json) | chromium 151.0.7922.34 (01-textures-medium-chromium.json) | Разница |
| --- | ---: | ---: | --- |
| FPS (по медиане кадра) | 74.1 | 72.5 |  |
| Время кадра p50, мс | 13.5 | 13.8 | chromium 151.0.7922.34 (00-base-mac-chromium.json) быстрее на 2 % |
| Время кадра p95, мс | 26.1 | 26.2 | поровну |
| Главный поток p50, мс | 0.50 | 0.50 | поровну |
| Draw call'ов p50 | 109 | 109 |  |
| Треугольников p50 | 188 540 | 188 540 |  |
| Время GPU p50, мс | 1.52 | 2.42 | chromium 151.0.7922.34 (00-base-mac-chromium.json) быстрее в 1,6 раза |
| Буфер отрисовки | — | 1800×1126 |  |
| Интервалов в выборке | 2 806 | 2 737 |  |
| Загрузка до конца заставки, мс | 285.6 | 475.4 | chromium 151.0.7922.34 (00-base-mac-chromium.json) быстрее в 1,7 раза |
| — из них генерация текстур, мс | 157.8 | 348.3 | chromium 151.0.7922.34 (00-base-mac-chromium.json) быстрее в 2,2 раза |

| Проход | chromium 151.0.7922.34 (00-base-mac-chromium.json), мс | chromium 151.0.7922.34 (01-textures-medium-chromium.json), мс |
| --- | ---: | ---: |
| clear:очистка+служебное | 4.80 | 9.70 |
| main:статика района | 2.70 | 3.50 |
| sky:небо | 1.80 | 2.20 |
| main:персонажи и техника | 1.50 | 1.80 |
| glow:свечения и маркеры | 1.30 | 1.40 |
| glow:тени под объектами | 1.20 | 1.30 |

## Техника в движении

| Метрика | chromium 151.0.7922.34 (00-base-mac-chromium.json) | chromium 151.0.7922.34 (01-textures-medium-chromium.json) | Разница |
| --- | ---: | ---: | --- |
| FPS (по медиане кадра) | 78.1 | 69.9 |  |
| Время кадра p50, мс | 12.8 | 14.3 | chromium 151.0.7922.34 (00-base-mac-chromium.json) быстрее на 12 % |
| Время кадра p95, мс | 26.1 | 27.1 | chromium 151.0.7922.34 (00-base-mac-chromium.json) быстрее на 4 % |
| Главный поток p50, мс | 0.50 | 0.70 | chromium 151.0.7922.34 (00-base-mac-chromium.json) быстрее на 40 % |
| Draw call'ов p50 | 141 | 140 |  |
| Треугольников p50 | 240 044 | 234 540 |  |
| Время GPU p50, мс | 1.80 | 2.56 | chromium 151.0.7922.34 (00-base-mac-chromium.json) быстрее на 42 % |
| Буфер отрисовки | — | 1800×1126 |  |
| Интервалов в выборке | 2 867 | 2 686 |  |
| Загрузка до конца заставки, мс | 301 | 487.8 | chromium 151.0.7922.34 (00-base-mac-chromium.json) быстрее в 1,6 раза |
| — из них генерация текстур, мс | 163.1 | 346.2 | chromium 151.0.7922.34 (00-base-mac-chromium.json) быстрее в 2,1 раза |

| Проход | chromium 151.0.7922.34 (00-base-mac-chromium.json), мс | chromium 151.0.7922.34 (01-textures-medium-chromium.json), мс |
| --- | ---: | ---: |
| clear:очистка+служебное | 4.80 | 8.70 |
| main:статика района | 2.30 | 3.90 |
| sky:небо | 1.70 | 2.20 |
| main:персонажи и техника | 1.50 | 2.10 |
| glow:тени под объектами | 1.10 | 1.30 |
| glow:свечения и маркеры | 1.10 | 1.50 |

## Расширения WebGL2

| Расширение | chromium 151.0.7922.34 (00-base-mac-chromium.json) | chromium 151.0.7922.34 (01-textures-medium-chromium.json) |
| --- | :---: | :---: |
| `EXT_texture_filter_anisotropic` | есть | есть |
| `EXT_color_buffer_float` | есть | есть |
| `EXT_disjoint_timer_query_webgl2` | есть | есть |
| `OES_texture_float_linear` | есть | есть |
| `EXT_color_buffer_half_float` | есть | есть |
| `WEBGL_debug_renderer_info` | есть | есть |
| `OVR_multiview2` | **нет** | **нет** |
| `WEBGL_multi_draw` | есть | есть |
| `KHR_parallel_shader_compile` | есть | есть |

Всего расширений: chromium 151.0.7922.34 (00-base-mac-chromium.json) — 36, chromium 151.0.7922.34 (01-textures-medium-chromium.json) — 36.

## Память

| | chromium 151.0.7922.34 (00-base-mac-chromium.json) | chromium 151.0.7922.34 (01-textures-medium-chromium.json) |
| --- | ---: | ---: |
| Текстур (объектов GL) | 39 | 9 |
| Нулевой уровень, МиБ | 27.9 | 46.8 |
| Текстуры с мипами, МиБ | 37.2 | 62.4 |
| Буферы, МиБ | 17.0 | 17.0 |

