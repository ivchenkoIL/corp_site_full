# Сравнение прогонов: chromium 151.0.7922.34 (00-base-mac-chromium.json) против chromium 151.0.7922.34 (01-textures-high-chromium.json)

| | chromium 151.0.7922.34 (00-base-mac-chromium.json) | chromium 151.0.7922.34 (01-textures-high-chromium.json) |
| --- | --- | --- |
| Снято | 2026-09-04T21:46:03.527Z | 2026-09-04T22:35:57.438Z |
| Рендерер | ANGLE (Apple, ANGLE Metal Renderer: Apple M4, Unspecified Version) | ANGLE (Apple, ANGLE Metal Renderer: Apple M4, Unspecified Version) |
| Окно | 1440×900 @ dpr 2 | 1440×900 @ dpr 2 |
| Профиль качества | — (до этапа 02) | high |
| Ядер у хоста | 10 | 10 |

## Открытая улица

| Метрика | chromium 151.0.7922.34 (00-base-mac-chromium.json) | chromium 151.0.7922.34 (01-textures-high-chromium.json) | Разница |
| --- | ---: | ---: | --- |
| FPS (по медиане кадра) | 78.1 | 72.5 |  |
| Время кадра p50, мс | 12.8 | 13.8 | chromium 151.0.7922.34 (00-base-mac-chromium.json) быстрее на 8 % |
| Время кадра p95, мс | 26.1 | 27.1 | chromium 151.0.7922.34 (00-base-mac-chromium.json) быстрее на 4 % |
| Главный поток p50, мс | 0.60 | 0.60 | поровну |
| Draw call'ов p50 | 92 | 93 |  |
| Треугольников p50 | 167 356 | 170 318 |  |
| Время GPU p50, мс | 1.25 | 3.69 | chromium 151.0.7922.34 (00-base-mac-chromium.json) быстрее в 3,0 раза |
| Буфер отрисовки | — | 2880×1800 |  |
| Интервалов в выборке | 2 864 | 2 773 |  |
| Загрузка до конца заставки, мс | 379.3 | 502.5 | chromium 151.0.7922.34 (00-base-mac-chromium.json) быстрее на 32 % |
| — из них генерация текстур, мс | 179.4 | 342 | chromium 151.0.7922.34 (00-base-mac-chromium.json) быстрее в 1,9 раза |

| Проход | chromium 151.0.7922.34 (00-base-mac-chromium.json), мс | chromium 151.0.7922.34 (01-textures-high-chromium.json), мс |
| --- | ---: | ---: |
| clear:очистка+служебное | 4.60 | 8.80 |
| main:статика района | 2.40 | 10.3 |
| sky:небо | 1.80 | 4 |
| main:персонажи и техника | 1.40 | 2.50 |
| glow:свечения и маркеры | 1.30 | 2.30 |
| glow:тени под объектами | 1.10 | 2.10 |

## Плотная застройка

| Метрика | chromium 151.0.7922.34 (00-base-mac-chromium.json) | chromium 151.0.7922.34 (01-textures-high-chromium.json) | Разница |
| --- | ---: | ---: | --- |
| FPS (по медиане кадра) | 74.1 | 73.0 |  |
| Время кадра p50, мс | 13.5 | 13.7 | chromium 151.0.7922.34 (00-base-mac-chromium.json) быстрее на 1 % |
| Время кадра p95, мс | 26.1 | 27.1 | chromium 151.0.7922.34 (00-base-mac-chromium.json) быстрее на 4 % |
| Главный поток p50, мс | 0.50 | 0.50 | поровну |
| Draw call'ов p50 | 109 | 110 |  |
| Треугольников p50 | 188 540 | 191 502 |  |
| Время GPU p50, мс | 1.52 | 4.09 | chromium 151.0.7922.34 (00-base-mac-chromium.json) быстрее в 2,7 раза |
| Буфер отрисовки | — | 2880×1800 |  |
| Интервалов в выборке | 2 806 | 2 756 |  |
| Загрузка до конца заставки, мс | 285.6 | 481 | chromium 151.0.7922.34 (00-base-mac-chromium.json) быстрее в 1,7 раза |
| — из них генерация текстур, мс | 157.8 | 344 | chromium 151.0.7922.34 (00-base-mac-chromium.json) быстрее в 2,2 раза |

| Проход | chromium 151.0.7922.34 (00-base-mac-chromium.json), мс | chromium 151.0.7922.34 (01-textures-high-chromium.json), мс |
| --- | ---: | ---: |
| clear:очистка+служебное | 4.80 | 7.10 |
| main:статика района | 2.70 | 10.3 |
| sky:небо | 1.80 | 3.80 |
| main:персонажи и техника | 1.50 | 2.60 |
| glow:свечения и маркеры | 1.30 | 2.30 |
| glow:тени под объектами | 1.20 | 2 |

## Техника в движении

| Метрика | chromium 151.0.7922.34 (00-base-mac-chromium.json) | chromium 151.0.7922.34 (01-textures-high-chromium.json) | Разница |
| --- | ---: | ---: | --- |
| FPS (по медиане кадра) | 78.1 | 73.0 |  |
| Время кадра p50, мс | 12.8 | 13.7 | chromium 151.0.7922.34 (00-base-mac-chromium.json) быстрее на 7 % |
| Время кадра p95, мс | 26.1 | 26.1 | поровну |
| Главный поток p50, мс | 0.50 | 0.70 | chromium 151.0.7922.34 (00-base-mac-chromium.json) быстрее на 40 % |
| Draw call'ов p50 | 141 | 139 |  |
| Треугольников p50 | 240 044 | 234 484 |  |
| Время GPU p50, мс | 1.80 | 4.81 | chromium 151.0.7922.34 (00-base-mac-chromium.json) быстрее в 2,7 раза |
| Буфер отрисовки | — | 2880×1800 |  |
| Интервалов в выборке | 2 867 | 2 761 |  |
| Загрузка до конца заставки, мс | 301 | 494.8 | chromium 151.0.7922.34 (00-base-mac-chromium.json) быстрее в 1,6 раза |
| — из них генерация текстур, мс | 163.1 | 346.7 | chromium 151.0.7922.34 (00-base-mac-chromium.json) быстрее в 2,1 раза |

| Проход | chromium 151.0.7922.34 (00-base-mac-chromium.json), мс | chromium 151.0.7922.34 (01-textures-high-chromium.json), мс |
| --- | ---: | ---: |
| clear:очистка+служебное | 4.80 | 7.50 |
| main:статика района | 2.30 | 10.7 |
| sky:небо | 1.70 | 4 |
| main:персонажи и техника | 1.50 | 2.80 |
| glow:тени под объектами | 1.10 | 2.10 |
| glow:свечения и маркеры | 1.10 | 2.30 |

## Расширения WebGL2

| Расширение | chromium 151.0.7922.34 (00-base-mac-chromium.json) | chromium 151.0.7922.34 (01-textures-high-chromium.json) |
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

Всего расширений: chromium 151.0.7922.34 (00-base-mac-chromium.json) — 36, chromium 151.0.7922.34 (01-textures-high-chromium.json) — 36.

## Память

| | chromium 151.0.7922.34 (00-base-mac-chromium.json) | chromium 151.0.7922.34 (01-textures-high-chromium.json) |
| --- | ---: | ---: |
| Текстур (объектов GL) | 39 | 9 |
| Нулевой уровень, МиБ | 27.9 | 46.8 |
| Текстуры с мипами, МиБ | 37.2 | 62.4 |
| Буферы, МиБ | 17.0 | 17.0 |

