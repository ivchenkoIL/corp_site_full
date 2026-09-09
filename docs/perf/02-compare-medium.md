# Сравнение прогонов: chromium 151.0.7922.34 (02-base-medium-chromium.json) против chromium 151.0.7922.34 (02-lighting-medium-chromium.json)

| | chromium 151.0.7922.34 (02-base-medium-chromium.json) | chromium 151.0.7922.34 (02-lighting-medium-chromium.json) |
| --- | --- | --- |
| Снято | 2026-09-04T23:26:17.082Z | 2026-09-05T00:43:47.273Z |
| Рендерер | ANGLE (Apple, ANGLE Metal Renderer: Apple M4, Unspecified Version) | ANGLE (Apple, ANGLE Metal Renderer: Apple M4, Unspecified Version) |
| Окно | 1440×900 @ dpr 2 | 1440×900 @ dpr 2 |
| Профиль качества | medium | medium |
| Ядер у хоста | 10 | 10 |

## Открытая улица

| Метрика | chromium 151.0.7922.34 (02-base-medium-chromium.json) | chromium 151.0.7922.34 (02-lighting-medium-chromium.json) | Разница |
| --- | ---: | ---: | --- |
| FPS (по медиане кадра) | 76.9 | 74.6 |  |
| Время кадра p50, мс | 13 | 13.4 | chromium 151.0.7922.34 (02-base-medium-chromium.json) быстрее на 3 % |
| Время кадра p95, мс | 26.2 | 26.1 | поровну |
| Главный поток p50, мс | 0.60 | 0.60 | поровну |
| Draw call'ов p50 | 92 | 92 |  |
| Треугольников p50 | 167 420 | 164 708 |  |
| Время GPU p50, мс | 2.87 | 3.34 | chromium 151.0.7922.34 (02-base-medium-chromium.json) быстрее на 16 % |
| Буфер отрисовки | 1800×1126 | 1800×1126 |  |
| Интервалов в выборке | 2 855 | 2 806 |  |
| Загрузка до конца заставки, мс | 485.9 | 734 | chromium 151.0.7922.34 (02-base-medium-chromium.json) быстрее в 1,5 раза |
| — из них генерация текстур, мс | 342.1 | 476 | chromium 151.0.7922.34 (02-base-medium-chromium.json) быстрее на 39 % |

| Проход | chromium 151.0.7922.34 (02-base-medium-chromium.json), мс | chromium 151.0.7922.34 (02-lighting-medium-chromium.json), мс |
| --- | ---: | ---: |
| clear#0:очистка, камера и разгон конвейера | 1.42 | 0.55 |
| main#0:статика района | 1.27 | 1.86 |
| main#1:персонажи и техника | 0.12 | 0.10 |
| sky#0:небо | 0.09 | 0.13 |
| glow#0:тени под объектами | -0.01 | -0.05 |
| glow#1:свечения и маркеры | -0.01 | 0.42 |

## Плотная застройка

| Метрика | chromium 151.0.7922.34 (02-base-medium-chromium.json) | chromium 151.0.7922.34 (02-lighting-medium-chromium.json) | Разница |
| --- | ---: | ---: | --- |
| FPS (по медиане кадра) | 74.1 | 80.7 |  |
| Время кадра p50, мс | 13.5 | 12.4 | chromium 151.0.7922.34 (02-lighting-medium-chromium.json) быстрее на 9 % |
| Время кадра p95, мс | 26.2 | 26.1 | поровну |
| Главный поток p50, мс | 0.50 | 0.50 | поровну |
| Draw call'ов p50 | 107 | 108 |  |
| Треугольников p50 | 185 728 | 188 689 |  |
| Время GPU p50, мс | 3.06 | 3.37 | chromium 151.0.7922.34 (02-base-medium-chromium.json) быстрее на 10 % |
| Буфер отрисовки | 1800×1126 | 1800×1126 |  |
| Интервалов в выборке | 2 799 | 2 880 |  |
| Загрузка до конца заставки, мс | 477.3 | 621 | chromium 151.0.7922.34 (02-base-medium-chromium.json) быстрее на 30 % |
| — из них генерация текстур, мс | 335.2 | 426 | chromium 151.0.7922.34 (02-base-medium-chromium.json) быстрее на 27 % |

| Проход | chromium 151.0.7922.34 (02-base-medium-chromium.json), мс | chromium 151.0.7922.34 (02-lighting-medium-chromium.json), мс |
| --- | ---: | ---: |
| main#0:статика района | 1.49 | 2.01 |
| clear#0:очистка, камера и разгон конвейера | 1.10 | 0.47 |
| sky#0:небо | 0.26 | 0.08 |
| main#1:персонажи и техника | 0.15 | 0.12 |
| glow#0:тени под объектами | -0.03 | -0.05 |
| glow#1:свечения и маркеры | -0.10 | 0.35 |

## Техника в движении

| Метрика | chromium 151.0.7922.34 (02-base-medium-chromium.json) | chromium 151.0.7922.34 (02-lighting-medium-chromium.json) | Разница |
| --- | ---: | ---: | --- |
| FPS (по медиане кадра) | 75.8 | 76.9 |  |
| Время кадра p50, мс | 13.2 | 13 | chromium 151.0.7922.34 (02-lighting-medium-chromium.json) быстрее на 2 % |
| Время кадра p95, мс | 26.1 | 26.2 | поровну |
| Главный поток p50, мс | 0.50 | 0.50 | поровну |
| Draw call'ов p50 | 140 | 140 |  |
| Треугольников p50 | 237 332 | 234 582 |  |
| Время GPU p50, мс | 3.20 | 3.47 | chromium 151.0.7922.34 (02-base-medium-chromium.json) быстрее на 8 % |
| Буфер отрисовки | 1800×1126 | 1800×1126 |  |
| Интервалов в выборке | 2 843 | 2 863 |  |
| Загрузка до конца заставки, мс | 459.9 | 547.8 | chromium 151.0.7922.34 (02-base-medium-chromium.json) быстрее на 19 % |
| — из них генерация текстур, мс | 330 | 392.3 | chromium 151.0.7922.34 (02-base-medium-chromium.json) быстрее на 19 % |

| Проход | chromium 151.0.7922.34 (02-base-medium-chromium.json), мс | chromium 151.0.7922.34 (02-lighting-medium-chromium.json), мс |
| --- | ---: | ---: |
| main#0:статика района | 1.73 | 1.66 |
| clear#0:очистка, камера и разгон конвейера | 1.05 | 0.59 |
| sky#0:небо | 0.38 | 0.07 |
| main#1:персонажи и техника | 0.16 | 0.25 |
| glow#1:свечения и маркеры | -0.01 | 0.61 |
| glow#0:тени под объектами | -0.03 | 0.05 |

## Ночная улица

| Метрика | chromium 151.0.7922.34 (02-base-medium-chromium.json) | chromium 151.0.7922.34 (02-lighting-medium-chromium.json) | Разница |
| --- | ---: | ---: | --- |
| FPS (по медиане кадра) | 75.2 | 75.8 |  |
| Время кадра p50, мс | 13.3 | 13.2 | chromium 151.0.7922.34 (02-lighting-medium-chromium.json) быстрее на 1 % |
| Время кадра p95, мс | 26.2 | 26.2 | поровну |
| Главный поток p50, мс | 0.50 | 0.50 | поровну |
| Draw call'ов p50 | 112 | 114 |  |
| Треугольников p50 | 167 396 | 170 355 |  |
| Время GPU p50, мс | 3.15 | 3.84 | chromium 151.0.7922.34 (02-base-medium-chromium.json) быстрее на 22 % |
| Буфер отрисовки | 1800×1126 | 1800×1126 |  |
| Интервалов в выборке | 2 850 | 2 836 |  |
| Загрузка до конца заставки, мс | 481.7 | 634.6 | chromium 151.0.7922.34 (02-base-medium-chromium.json) быстрее на 32 % |
| — из них генерация текстур, мс | 342 | 436.9 | chromium 151.0.7922.34 (02-base-medium-chromium.json) быстрее на 28 % |

| Проход | chromium 151.0.7922.34 (02-base-medium-chromium.json), мс | chromium 151.0.7922.34 (02-lighting-medium-chromium.json), мс |
| --- | ---: | ---: |
| main#0:статика района | 1.61 | 2.24 |
| clear#0:очистка, камера и разгон конвейера | 1.06 | 0.69 |
| sky#0:небо | 0.12 | 0.19 |
| main#1:персонажи и техника | 0.08 | 0.17 |
| glow#1:свечения и маркеры | 0.07 | 0.51 |
| glow#0:тени под объектами | 0.01 | -0.12 |

## Ночные витрины

| Метрика | chromium 151.0.7922.34 (02-base-medium-chromium.json) | chromium 151.0.7922.34 (02-lighting-medium-chromium.json) | Разница |
| --- | ---: | ---: | --- |
| FPS (по медиане кадра) | 73.5 | 71.9 |  |
| Время кадра p50, мс | 13.6 | 13.9 | chromium 151.0.7922.34 (02-base-medium-chromium.json) быстрее на 2 % |
| Время кадра p95, мс | 26.2 | 26.1 | поровну |
| Главный поток p50, мс | 0.60 | 0.60 | поровну |
| Draw call'ов p50 | 151 | 152 |  |
| Треугольников p50 | 199 376 | 199 313 |  |
| Время GPU p50, мс | 3.60 | 4.42 | chromium 151.0.7922.34 (02-base-medium-chromium.json) быстрее на 22 % |
| Буфер отрисовки | 1800×1126 | 1800×1126 |  |
| Интервалов в выборке | 2 797 | 2 771 |  |
| Загрузка до конца заставки, мс | 480.2 | 535.1 | chromium 151.0.7922.34 (02-base-medium-chromium.json) быстрее на 11 % |
| — из них генерация текстур, мс | 336.9 | 384.9 | chromium 151.0.7922.34 (02-base-medium-chromium.json) быстрее на 14 % |

| Проход | chromium 151.0.7922.34 (02-base-medium-chromium.json), мс | chromium 151.0.7922.34 (02-lighting-medium-chromium.json), мс |
| --- | ---: | ---: |
| main#0:статика района | 1.63 | 2.75 |
| clear#0:очистка, камера и разгон конвейера | 1.24 | 0.67 |
| main#1:персонажи и техника | 0.23 | 0.17 |
| sky#0:небо | 0.13 | 0.06 |
| glow#1:свечения и маркеры | 0.12 | 0.46 |
| glow#0:тени под объектами | -0.09 | 0.05 |

## Расширения WebGL2

| Расширение | chromium 151.0.7922.34 (02-base-medium-chromium.json) | chromium 151.0.7922.34 (02-lighting-medium-chromium.json) |
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

Всего расширений: chromium 151.0.7922.34 (02-base-medium-chromium.json) — 36, chromium 151.0.7922.34 (02-lighting-medium-chromium.json) — 36.

## Память

| | chromium 151.0.7922.34 (02-base-medium-chromium.json) | chromium 151.0.7922.34 (02-lighting-medium-chromium.json) |
| --- | ---: | ---: |
| Текстур (объектов GL) | 9 | 12 |
| Нулевой уровень, МиБ | 46.8 | 70.2 |
| Текстуры с мипами, МиБ | 62.4 | 85.8 |
| Буферы, МиБ | 17.0 | 17.0 |

