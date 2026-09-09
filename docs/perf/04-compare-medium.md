# Сравнение прогонов: chromium 151.0.7922.34 (03-shadows-medium-chromium.json) против chromium 151.0.7922.34 (04-bloom-medium-chromium.json)

| | chromium 151.0.7922.34 (03-shadows-medium-chromium.json) | chromium 151.0.7922.34 (04-bloom-medium-chromium.json) |
| --- | --- | --- |
| Снято | 2026-09-05T03:27:27.549Z | 2026-09-08T21:17:18.051Z |
| Рендерер | ANGLE (Apple, ANGLE Metal Renderer: Apple M4, Unspecified Version) | ANGLE (Apple, ANGLE Metal Renderer: Apple M4, Unspecified Version) |
| Окно | 1440×900 @ dpr 2 | 1440×900 @ dpr 2 |
| Профиль качества | medium | medium |
| Ядер у хоста | 10 | 10 |

## Открытая улица

| Метрика | chromium 151.0.7922.34 (03-shadows-medium-chromium.json) | chromium 151.0.7922.34 (04-bloom-medium-chromium.json) | Разница |
| --- | ---: | ---: | --- |
| FPS (по медиане кадра) | 74.6 | 75.2 |  |
| Время кадра p50, мс | 13.4 | 13.3 | chromium 151.0.7922.34 (04-bloom-medium-chromium.json) быстрее на 1 % |
| Время кадра p95, мс | 26.2 | 26.1 | поровну |
| Главный поток p50, мс | 0.70 | 0.70 | поровну |
| Draw call'ов p50 | 131 | 123 |  |
| Треугольников p50 | 241 418 | 215 958 |  |
| Время GPU p50, мс | 4.68 | 4.58 | chromium 151.0.7922.34 (04-bloom-medium-chromium.json) быстрее на 2 % |
| Буфер отрисовки | 1800×1126 | 1800×1126 |  |
| Интервалов в выборке | 855 | 2 829 |  |
| Загрузка до конца заставки, мс | 548.4 | 571.9 | chromium 151.0.7922.34 (03-shadows-medium-chromium.json) быстрее на 4 % |
| — из них генерация текстур, мс | 379.5 | 382.1 | chromium 151.0.7922.34 (03-shadows-medium-chromium.json) быстрее на 1 % |

| Проход | chromium 151.0.7922.34 (03-shadows-medium-chromium.json), мс | chromium 151.0.7922.34 (04-bloom-medium-chromium.json), мс |
| --- | ---: | ---: |
| main#0:статика района | 2.04 | 1.65 |
| shadow#0:тени: каскад 1 | 1.18 | 1.30 |
| glow#1:свечения и маркеры | 0.91 | 0.74 |
| sky#0:небо | 0.25 | 0.12 |
| tone#0:тонмаппинг в холст | 0.14 | 0.35 |
| clear#0:очистка, камера и разгон конвейера | 0.01 | 0.01 |
| main#1:персонажи и техника | -0.04 | 0.07 |
| glow#0:тени под объектами | -0.25 | 0.07 |

## Плотная застройка

| Метрика | chromium 151.0.7922.34 (03-shadows-medium-chromium.json) | chromium 151.0.7922.34 (04-bloom-medium-chromium.json) | Разница |
| --- | ---: | ---: | --- |
| FPS (по медиане кадра) | 68.0 | 74.6 |  |
| Время кадра p50, мс | 14.7 | 13.4 | chromium 151.0.7922.34 (04-bloom-medium-chromium.json) быстрее на 10 % |
| Время кадра p95, мс | 26.2 | 26.1 | поровну |
| Главный поток p50, мс | 0.90 | 0.70 | chromium 151.0.7922.34 (04-bloom-medium-chromium.json) быстрее на 29 % |
| Draw call'ов p50 | 158 | 144 |  |
| Треугольников p50 | 295 451 | 262 776 |  |
| Время GPU p50, мс | 5.19 | 4.75 | chromium 151.0.7922.34 (04-bloom-medium-chromium.json) быстрее на 9 % |
| Буфер отрисовки | 1800×1126 | 1800×1126 |  |
| Интервалов в выборке | 799 | 2 806 |  |
| Загрузка до конца заставки, мс | 550.7 | 544 | chromium 151.0.7922.34 (04-bloom-medium-chromium.json) быстрее на 1 % |
| — из них генерация текстур, мс | 380.9 | 367.1 | chromium 151.0.7922.34 (04-bloom-medium-chromium.json) быстрее на 4 % |

| Проход | chromium 151.0.7922.34 (03-shadows-medium-chromium.json), мс | chromium 151.0.7922.34 (04-bloom-medium-chromium.json), мс |
| --- | ---: | ---: |
| main#0:статика района | 2.20 | 1.92 |
| shadow#0:тени: каскад 1 | 1.88 | 1.50 |
| glow#1:свечения и маркеры | 0.69 | 0.32 |
| tone#0:тонмаппинг в холст | 0.34 | 0.28 |
| main#1:персонажи и техника | 0.18 | 0.16 |
| clear#0:очистка, камера и разгон конвейера | 0.01 | 0.01 |
| glow#0:тени под объектами | 0.00 | -0.00 |
| sky#0:небо | -0.05 | 0.10 |

## Техника в движении

| Метрика | chromium 151.0.7922.34 (03-shadows-medium-chromium.json) | chromium 151.0.7922.34 (04-bloom-medium-chromium.json) | Разница |
| --- | ---: | ---: | --- |
| FPS (по медиане кадра) | 74.1 | 75.2 |  |
| Время кадра p50, мс | 13.5 | 13.3 | chromium 151.0.7922.34 (04-bloom-medium-chromium.json) быстрее на 2 % |
| Время кадра p95, мс | 27.1 | 26.1 | chromium 151.0.7922.34 (04-bloom-medium-chromium.json) быстрее на 4 % |
| Главный поток p50, мс | 0.90 | 0.90 | поровну |
| Draw call'ов p50 | 210 | 216 |  |
| Треугольников p50 | 409 026 | 417 339 |  |
| Время GPU p50, мс | 4.92 | 5.08 | chromium 151.0.7922.34 (03-shadows-medium-chromium.json) быстрее на 3 % |
| Буфер отрисовки | 1800×1126 | 1800×1126 |  |
| Интервалов в выборке | 852 | 2 815 |  |
| Загрузка до конца заставки, мс | 512.9 | 554.1 | chromium 151.0.7922.34 (03-shadows-medium-chromium.json) быстрее на 8 % |
| — из них генерация текстур, мс | 356.4 | 381 | chromium 151.0.7922.34 (03-shadows-medium-chromium.json) быстрее на 7 % |

| Проход | chromium 151.0.7922.34 (03-shadows-medium-chromium.json), мс | chromium 151.0.7922.34 (04-bloom-medium-chromium.json), мс |
| --- | ---: | ---: |
| main#0:статика района | 1.91 | 1.93 |
| shadow#0:тени: каскад 1 | 1.44 | 1.68 |
| glow#1:свечения и маркеры | 0.75 | 0.76 |
| tone#0:тонмаппинг в холст | 0.43 | 0.05 |
| sky#0:небо | 0.18 | 0.21 |
| glow#0:тени под объектами | 0.13 | -0.09 |
| main#1:персонажи и техника | 0.12 | 0.10 |
| clear#0:очистка, камера и разгон конвейера | 0.01 | 0.01 |

## Ночная улица

| Метрика | chromium 151.0.7922.34 (03-shadows-medium-chromium.json) | chromium 151.0.7922.34 (04-bloom-medium-chromium.json) | Разница |
| --- | ---: | ---: | --- |
| FPS (по медиане кадра) | 73.5 | 75.8 |  |
| Время кадра p50, мс | 13.6 | 13.2 | chromium 151.0.7922.34 (04-bloom-medium-chromium.json) быстрее на 3 % |
| Время кадра p95, мс | 27.2 | 26.1 | chromium 151.0.7922.34 (04-bloom-medium-chromium.json) быстрее на 4 % |
| Главный поток p50, мс | 0.60 | 0.60 | поровну |
| Draw call'ов p50 | 89 | 84 |  |
| Треугольников p50 | 80 152 | 68 973 |  |
| Время GPU p50, мс | 4.09 | 4.27 | chromium 151.0.7922.34 (03-shadows-medium-chromium.json) быстрее на 5 % |
| Буфер отрисовки | 1800×1126 | 1800×1126 |  |
| Интервалов в выборке | 847 | 2 831 |  |
| Загрузка до конца заставки, мс | 537.6 | 544.7 | chromium 151.0.7922.34 (03-shadows-medium-chromium.json) быстрее на 1 % |
| — из них генерация текстур, мс | 371.9 | 357 | chromium 151.0.7922.34 (04-bloom-medium-chromium.json) быстрее на 4 % |

| Проход | chromium 151.0.7922.34 (03-shadows-medium-chromium.json), мс | chromium 151.0.7922.34 (04-bloom-medium-chromium.json), мс |
| --- | ---: | ---: |
| main#0:статика района | 2.37 | 2.25 |
| clear#0:очистка, камера и разгон конвейера | 0.74 | 0.74 |
| glow#1:свечения и маркеры | 0.41 | 0.61 |
| tone#0:тонмаппинг в холст | 0.37 | 0.26 |
| sky#0:небо | 0.34 | 0.21 |
| main#1:персонажи и техника | -0.11 | -0.21 |
| glow#0:тени под объектами | -0.12 | 0.12 |

## Ночные витрины

| Метрика | chromium 151.0.7922.34 (03-shadows-medium-chromium.json) | chromium 151.0.7922.34 (04-bloom-medium-chromium.json) | Разница |
| --- | ---: | ---: | --- |
| FPS (по медиане кадра) | 73.5 | 75.2 |  |
| Время кадра p50, мс | 13.6 | 13.3 | chromium 151.0.7922.34 (04-bloom-medium-chromium.json) быстрее на 2 % |
| Время кадра p95, мс | 27.2 | 26.1 | chromium 151.0.7922.34 (04-bloom-medium-chromium.json) быстрее на 4 % |
| Главный поток p50, мс | 0.70 | 0.70 | поровну |
| Draw call'ов p50 | 129 | 128 |  |
| Треугольников p50 | 98 652 | 101 389 |  |
| Время GPU p50, мс | 4.44 | 4.66 | chromium 151.0.7922.34 (03-shadows-medium-chromium.json) быстрее на 5 % |
| Буфер отрисовки | 1800×1126 | 1800×1126 |  |
| Интервалов в выборке | 852 | 2 811 |  |
| Загрузка до конца заставки, мс | 561.4 | 529.5 | chromium 151.0.7922.34 (04-bloom-medium-chromium.json) быстрее на 6 % |
| — из них генерация текстур, мс | 360.7 | 357.4 | chromium 151.0.7922.34 (04-bloom-medium-chromium.json) быстрее на 1 % |

| Проход | chromium 151.0.7922.34 (03-shadows-medium-chromium.json), мс | chromium 151.0.7922.34 (04-bloom-medium-chromium.json), мс |
| --- | ---: | ---: |
| main#0:статика района | 2.49 | 2.54 |
| clear#0:очистка, камера и разгон конвейера | 1.03 | 0.70 |
| glow#1:свечения и маркеры | 0.60 | 0.53 |
| tone#0:тонмаппинг в холст | 0.35 | 0.23 |
| sky#0:небо | 0.08 | 0.07 |
| main#1:персонажи и техника | 0.07 | 0.14 |
| glow#0:тени под объектами | -0.16 | 0.18 |

## Расширения WebGL2

| Расширение | chromium 151.0.7922.34 (03-shadows-medium-chromium.json) | chromium 151.0.7922.34 (04-bloom-medium-chromium.json) |
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

Всего расширений: chromium 151.0.7922.34 (03-shadows-medium-chromium.json) — 36, chromium 151.0.7922.34 (04-bloom-medium-chromium.json) — 36.

## Память

| | chromium 151.0.7922.34 (03-shadows-medium-chromium.json) | chromium 151.0.7922.34 (04-bloom-medium-chromium.json) |
| --- | ---: | ---: |
| Текстур (объектов GL) | 15 | 18 |
| Нулевой уровень, МиБ | 63.5 | 64.0 |
| Текстуры с мипами, МиБ | 79.4 | 80.0 |
| Буферы, МиБ | 17.0 | 17.0 |

