# Сравнение прогонов: chromium 151.0.7922.34 (02-lighting-medium-chromium.json) против chromium 151.0.7922.34 (03-shadows-medium-chromium.json)

| | chromium 151.0.7922.34 (02-lighting-medium-chromium.json) | chromium 151.0.7922.34 (03-shadows-medium-chromium.json) |
| --- | --- | --- |
| Снято | 2026-09-05T00:43:47.273Z | 2026-09-05T03:27:27.549Z |
| Рендерер | ANGLE (Apple, ANGLE Metal Renderer: Apple M4, Unspecified Version) | ANGLE (Apple, ANGLE Metal Renderer: Apple M4, Unspecified Version) |
| Окно | 1440×900 @ dpr 2 | 1440×900 @ dpr 2 |
| Профиль качества | medium | medium |
| Ядер у хоста | 10 | 10 |

## Открытая улица

| Метрика | chromium 151.0.7922.34 (02-lighting-medium-chromium.json) | chromium 151.0.7922.34 (03-shadows-medium-chromium.json) | Разница |
| --- | ---: | ---: | --- |
| FPS (по медиане кадра) | 74.6 | 74.6 |  |
| Время кадра p50, мс | 13.4 | 13.4 | поровну |
| Время кадра p95, мс | 26.1 | 26.2 | поровну |
| Главный поток p50, мс | 0.60 | 0.70 | chromium 151.0.7922.34 (02-lighting-medium-chromium.json) быстрее на 17 % |
| Draw call'ов p50 | 92 | 131 |  |
| Треугольников p50 | 164 708 | 241 418 |  |
| Время GPU p50, мс | 3.34 | 4.68 | chromium 151.0.7922.34 (02-lighting-medium-chromium.json) быстрее на 40 % |
| Буфер отрисовки | 1800×1126 | 1800×1126 |  |
| Интервалов в выборке | 2 806 | 855 |  |
| Загрузка до конца заставки, мс | 734 | 548.4 | chromium 151.0.7922.34 (03-shadows-medium-chromium.json) быстрее на 34 % |
| — из них генерация текстур, мс | 476 | 379.5 | chromium 151.0.7922.34 (03-shadows-medium-chromium.json) быстрее на 25 % |

| Проход | chromium 151.0.7922.34 (02-lighting-medium-chromium.json), мс | chromium 151.0.7922.34 (03-shadows-medium-chromium.json), мс |
| --- | ---: | ---: |
| main#0:статика района | 1.86 | 2.04 |
| clear#0:очистка, камера и разгон конвейера | 0.55 | 0.01 |
| glow#1:свечения и маркеры | 0.42 | 0.91 |
| tone#0:тонмаппинг в холст | 0.29 | 0.14 |
| sky#0:небо | 0.13 | 0.25 |
| main#1:персонажи и техника | 0.10 | -0.04 |
| glow#0:тени под объектами | -0.05 | -0.25 |

## Плотная застройка

| Метрика | chromium 151.0.7922.34 (02-lighting-medium-chromium.json) | chromium 151.0.7922.34 (03-shadows-medium-chromium.json) | Разница |
| --- | ---: | ---: | --- |
| FPS (по медиане кадра) | 80.7 | 68.0 |  |
| Время кадра p50, мс | 12.4 | 14.7 | chromium 151.0.7922.34 (02-lighting-medium-chromium.json) быстрее на 19 % |
| Время кадра p95, мс | 26.1 | 26.2 | поровну |
| Главный поток p50, мс | 0.50 | 0.90 | chromium 151.0.7922.34 (02-lighting-medium-chromium.json) быстрее в 1,8 раза |
| Draw call'ов p50 | 108 | 158 |  |
| Треугольников p50 | 188 689 | 295 451 |  |
| Время GPU p50, мс | 3.37 | 5.19 | chromium 151.0.7922.34 (02-lighting-medium-chromium.json) быстрее в 1,5 раза |
| Буфер отрисовки | 1800×1126 | 1800×1126 |  |
| Интервалов в выборке | 2 880 | 799 |  |
| Загрузка до конца заставки, мс | 621 | 550.7 | chromium 151.0.7922.34 (03-shadows-medium-chromium.json) быстрее на 13 % |
| — из них генерация текстур, мс | 426 | 380.9 | chromium 151.0.7922.34 (03-shadows-medium-chromium.json) быстрее на 12 % |

| Проход | chromium 151.0.7922.34 (02-lighting-medium-chromium.json), мс | chromium 151.0.7922.34 (03-shadows-medium-chromium.json), мс |
| --- | ---: | ---: |
| main#0:статика района | 2.01 | 2.20 |
| clear#0:очистка, камера и разгон конвейера | 0.47 | 0.01 |
| glow#1:свечения и маркеры | 0.35 | 0.69 |
| tone#0:тонмаппинг в холст | 0.25 | 0.34 |
| main#1:персонажи и техника | 0.12 | 0.18 |
| sky#0:небо | 0.08 | -0.05 |
| glow#0:тени под объектами | -0.05 | 0.00 |

## Техника в движении

| Метрика | chromium 151.0.7922.34 (02-lighting-medium-chromium.json) | chromium 151.0.7922.34 (03-shadows-medium-chromium.json) | Разница |
| --- | ---: | ---: | --- |
| FPS (по медиане кадра) | 76.9 | 74.1 |  |
| Время кадра p50, мс | 13 | 13.5 | chromium 151.0.7922.34 (02-lighting-medium-chromium.json) быстрее на 4 % |
| Время кадра p95, мс | 26.2 | 27.1 | chromium 151.0.7922.34 (02-lighting-medium-chromium.json) быстрее на 3 % |
| Главный поток p50, мс | 0.50 | 0.90 | chromium 151.0.7922.34 (02-lighting-medium-chromium.json) быстрее в 1,8 раза |
| Draw call'ов p50 | 140 | 210 |  |
| Треугольников p50 | 234 582 | 409 026 |  |
| Время GPU p50, мс | 3.47 | 4.92 | chromium 151.0.7922.34 (02-lighting-medium-chromium.json) быстрее на 42 % |
| Буфер отрисовки | 1800×1126 | 1800×1126 |  |
| Интервалов в выборке | 2 863 | 852 |  |
| Загрузка до конца заставки, мс | 547.8 | 512.9 | chromium 151.0.7922.34 (03-shadows-medium-chromium.json) быстрее на 7 % |
| — из них генерация текстур, мс | 392.3 | 356.4 | chromium 151.0.7922.34 (03-shadows-medium-chromium.json) быстрее на 10 % |

| Проход | chromium 151.0.7922.34 (02-lighting-medium-chromium.json), мс | chromium 151.0.7922.34 (03-shadows-medium-chromium.json), мс |
| --- | ---: | ---: |
| main#0:статика района | 1.66 | 1.91 |
| glow#1:свечения и маркеры | 0.61 | 0.75 |
| clear#0:очистка, камера и разгон конвейера | 0.59 | 0.01 |
| tone#0:тонмаппинг в холст | 0.27 | 0.43 |
| main#1:персонажи и техника | 0.25 | 0.12 |
| sky#0:небо | 0.07 | 0.18 |
| glow#0:тени под объектами | 0.05 | 0.13 |

## Ночная улица

| Метрика | chromium 151.0.7922.34 (02-lighting-medium-chromium.json) | chromium 151.0.7922.34 (03-shadows-medium-chromium.json) | Разница |
| --- | ---: | ---: | --- |
| FPS (по медиане кадра) | 75.8 | 73.5 |  |
| Время кадра p50, мс | 13.2 | 13.6 | chromium 151.0.7922.34 (02-lighting-medium-chromium.json) быстрее на 3 % |
| Время кадра p95, мс | 26.2 | 27.2 | chromium 151.0.7922.34 (02-lighting-medium-chromium.json) быстрее на 4 % |
| Главный поток p50, мс | 0.50 | 0.60 | chromium 151.0.7922.34 (02-lighting-medium-chromium.json) быстрее на 20 % |
| Draw call'ов p50 | 114 | 89 |  |
| Треугольников p50 | 170 355 | 80 152 |  |
| Время GPU p50, мс | 3.84 | 4.09 | chromium 151.0.7922.34 (02-lighting-medium-chromium.json) быстрее на 6 % |
| Буфер отрисовки | 1800×1126 | 1800×1126 |  |
| Интервалов в выборке | 2 836 | 847 |  |
| Загрузка до конца заставки, мс | 634.6 | 537.6 | chromium 151.0.7922.34 (03-shadows-medium-chromium.json) быстрее на 18 % |
| — из них генерация текстур, мс | 436.9 | 371.9 | chromium 151.0.7922.34 (03-shadows-medium-chromium.json) быстрее на 17 % |

| Проход | chromium 151.0.7922.34 (02-lighting-medium-chromium.json), мс | chromium 151.0.7922.34 (03-shadows-medium-chromium.json), мс |
| --- | ---: | ---: |
| main#0:статика района | 2.24 | 2.37 |
| clear#0:очистка, камера и разгон конвейера | 0.69 | 0.74 |
| glow#1:свечения и маркеры | 0.51 | 0.41 |
| tone#0:тонмаппинг в холст | 0.21 | 0.37 |
| sky#0:небо | 0.19 | 0.34 |
| main#1:персонажи и техника | 0.17 | -0.11 |
| glow#0:тени под объектами | -0.12 | -0.12 |

## Ночные витрины

| Метрика | chromium 151.0.7922.34 (02-lighting-medium-chromium.json) | chromium 151.0.7922.34 (03-shadows-medium-chromium.json) | Разница |
| --- | ---: | ---: | --- |
| FPS (по медиане кадра) | 71.9 | 73.5 |  |
| Время кадра p50, мс | 13.9 | 13.6 | chromium 151.0.7922.34 (03-shadows-medium-chromium.json) быстрее на 2 % |
| Время кадра p95, мс | 26.1 | 27.2 | chromium 151.0.7922.34 (02-lighting-medium-chromium.json) быстрее на 4 % |
| Главный поток p50, мс | 0.60 | 0.70 | chromium 151.0.7922.34 (02-lighting-medium-chromium.json) быстрее на 17 % |
| Draw call'ов p50 | 152 | 129 |  |
| Треугольников p50 | 199 313 | 98 652 |  |
| Время GPU p50, мс | 4.42 | 4.44 | chromium 151.0.7922.34 (02-lighting-medium-chromium.json) быстрее на 1 % |
| Буфер отрисовки | 1800×1126 | 1800×1126 |  |
| Интервалов в выборке | 2 771 | 852 |  |
| Загрузка до конца заставки, мс | 535.1 | 561.4 | chromium 151.0.7922.34 (02-lighting-medium-chromium.json) быстрее на 5 % |
| — из них генерация текстур, мс | 384.9 | 360.7 | chromium 151.0.7922.34 (03-shadows-medium-chromium.json) быстрее на 7 % |

| Проход | chromium 151.0.7922.34 (02-lighting-medium-chromium.json), мс | chromium 151.0.7922.34 (03-shadows-medium-chromium.json), мс |
| --- | ---: | ---: |
| main#0:статика района | 2.75 | 2.49 |
| clear#0:очистка, камера и разгон конвейера | 0.67 | 1.03 |
| glow#1:свечения и маркеры | 0.46 | 0.60 |
| tone#0:тонмаппинг в холст | 0.24 | 0.35 |
| main#1:персонажи и техника | 0.17 | 0.07 |
| sky#0:небо | 0.06 | 0.08 |
| glow#0:тени под объектами | 0.05 | -0.16 |

## Расширения WebGL2

| Расширение | chromium 151.0.7922.34 (02-lighting-medium-chromium.json) | chromium 151.0.7922.34 (03-shadows-medium-chromium.json) |
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

Всего расширений: chromium 151.0.7922.34 (02-lighting-medium-chromium.json) — 36, chromium 151.0.7922.34 (03-shadows-medium-chromium.json) — 36.

## Память

| | chromium 151.0.7922.34 (02-lighting-medium-chromium.json) | chromium 151.0.7922.34 (03-shadows-medium-chromium.json) |
| --- | ---: | ---: |
| Текстур (объектов GL) | 12 | 15 |
| Нулевой уровень, МиБ | 70.2 | 63.5 |
| Текстуры с мипами, МиБ | 85.8 | 79.4 |
| Буферы, МиБ | 17.0 | 17.0 |

