# Сравнение прогонов: chromium 151.0.7922.34 (02-lighting-high-chromium.json) против chromium 151.0.7922.34 (03-shadows-high-chromium.json)

| | chromium 151.0.7922.34 (02-lighting-high-chromium.json) | chromium 151.0.7922.34 (03-shadows-high-chromium.json) |
| --- | --- | --- |
| Снято | 2026-09-05T01:13:58.597Z | 2026-09-05T05:13:48.713Z |
| Рендерер | ANGLE (Apple, ANGLE Metal Renderer: Apple M4, Unspecified Version) | ANGLE (Apple, ANGLE Metal Renderer: Apple M4, Unspecified Version) |
| Окно | 1440×900 @ dpr 2 | 1440×900 @ dpr 2 |
| Профиль качества | high | high |
| Ядер у хоста | 10 | 10 |

## Открытая улица

| Метрика | chromium 151.0.7922.34 (02-lighting-high-chromium.json) | chromium 151.0.7922.34 (03-shadows-high-chromium.json) | Разница |
| --- | ---: | ---: | --- |
| FPS (по медиане кадра) | 77.5 | 78.1 |  |
| Время кадра p50, мс | 12.9 | 12.8 | chromium 151.0.7922.34 (03-shadows-high-chromium.json) быстрее на 1 % |
| Время кадра p95, мс | 26.1 | 26.2 | поровну |
| Главный поток p50, мс | 0.50 | 0.80 | chromium 151.0.7922.34 (02-lighting-high-chromium.json) быстрее в 1,6 раза |
| Draw call'ов p50 | 93 | 170 |  |
| Треугольников p50 | 169 071 | 322 036 |  |
| Время GPU p50, мс | 6.24 | 6.66 | chromium 151.0.7922.34 (02-lighting-high-chromium.json) быстрее на 7 % |
| Буфер отрисовки | 2880×1800 | 2880×1800 |  |
| Интервалов в выборке | 2 853 | 861 |  |
| Загрузка до конца заставки, мс | 702.3 | 642.3 | chromium 151.0.7922.34 (03-shadows-high-chromium.json) быстрее на 9 % |
| — из них генерация текстур, мс | 468 | 391.6 | chromium 151.0.7922.34 (03-shadows-high-chromium.json) быстрее на 20 % |

| Проход | chromium 151.0.7922.34 (02-lighting-high-chromium.json), мс | chromium 151.0.7922.34 (03-shadows-high-chromium.json), мс |
| --- | ---: | ---: |
| main#0:статика района | 2.89 | 2.10 |
| clear#0:очистка, камера и разгон конвейера | 1.55 | 0.01 |
| tone#0:тонмаппинг в холст | 0.77 | 1.11 |
| glow#1:свечения и маркеры | 0.77 | 0.02 |
| sky#0:небо | 0.22 | 0.19 |
| main#1:персонажи и техника | 0.03 | -0.09 |
| glow#0:тени под объектами | 0.01 | 0.13 |

## Плотная застройка

| Метрика | chromium 151.0.7922.34 (02-lighting-high-chromium.json) | chromium 151.0.7922.34 (03-shadows-high-chromium.json) | Разница |
| --- | ---: | ---: | --- |
| FPS (по медиане кадра) | 75.2 | 80 |  |
| Время кадра p50, мс | 13.3 | 12.5 | chromium 151.0.7922.34 (03-shadows-high-chromium.json) быстрее на 6 % |
| Время кадра p95, мс | 26.1 | 26.2 | поровну |
| Главный поток p50, мс | 0.60 | 0.90 | chromium 151.0.7922.34 (02-lighting-high-chromium.json) быстрее в 1,5 раза |
| Draw call'ов p50 | 108 | 216 |  |
| Треугольников p50 | 185 729 | 446 136 |  |
| Время GPU p50, мс | 7.57 | 6.56 | chromium 151.0.7922.34 (03-shadows-high-chromium.json) быстрее на 15 % |
| Буфер отрисовки | 2880×1800 | 2880×1800 |  |
| Интервалов в выборке | 2 808 | 866 |  |
| Загрузка до конца заставки, мс | 647.7 | 558.8 | chromium 151.0.7922.34 (03-shadows-high-chromium.json) быстрее на 16 % |
| — из них генерация текстур, мс | 424.6 | 401.7 | chromium 151.0.7922.34 (03-shadows-high-chromium.json) быстрее на 6 % |

| Проход | chromium 151.0.7922.34 (02-lighting-high-chromium.json), мс | chromium 151.0.7922.34 (03-shadows-high-chromium.json), мс |
| --- | ---: | ---: |
| main#0:статика района | 3.43 | 2.04 |
| clear#0:очистка, камера и разгон конвейера | 1.76 | 0.01 |
| glow#1:свечения и маркеры | 1.01 | -0.00 |
| tone#0:тонмаппинг в холст | 0.63 | 0.71 |
| sky#0:небо | 0.24 | 0.03 |
| main#1:персонажи и техника | 0.21 | 0.03 |
| glow#0:тени под объектами | 0.03 | -0.04 |

## Техника в движении

| Метрика | chromium 151.0.7922.34 (02-lighting-high-chromium.json) | chromium 151.0.7922.34 (03-shadows-high-chromium.json) | Разница |
| --- | ---: | ---: | --- |
| FPS (по медиане кадра) | 74.6 | 75.8 |  |
| Время кадра p50, мс | 13.4 | 13.2 | chromium 151.0.7922.34 (03-shadows-high-chromium.json) быстрее на 2 % |
| Время кадра p95, мс | 26.1 | 26.2 | поровну |
| Главный поток p50, мс | 0.70 | 1 | chromium 151.0.7922.34 (02-lighting-high-chromium.json) быстрее на 43 % |
| Draw call'ов p50 | 140 | 273 |  |
| Треугольников p50 | 231 955 | 547 500 |  |
| Время GPU p50, мс | 8.04 | 6.65 | chromium 151.0.7922.34 (03-shadows-high-chromium.json) быстрее на 21 % |
| Буфер отрисовки | 2880×1800 | 2880×1800 |  |
| Интервалов в выборке | 2 795 | 885 |  |
| Загрузка до конца заставки, мс | 567 | 506 | chromium 151.0.7922.34 (03-shadows-high-chromium.json) быстрее на 12 % |
| — из них генерация текстур, мс | 398.5 | 355.3 | chromium 151.0.7922.34 (03-shadows-high-chromium.json) быстрее на 12 % |

| Проход | chromium 151.0.7922.34 (02-lighting-high-chromium.json), мс | chromium 151.0.7922.34 (03-shadows-high-chromium.json), мс |
| --- | ---: | ---: |
| main#0:статика района | 3.56 | 2.38 |
| clear#0:очистка, камера и разгон конвейера | 1.78 | 0.01 |
| glow#1:свечения и маркеры | 1.02 | 0.01 |
| tone#0:тонмаппинг в холст | 0.80 | 1.04 |
| main#1:персонажи и техника | 0.34 | -0.05 |
| sky#0:небо | -0.04 | 0.13 |
| glow#0:тени под объектами | -0.07 | 0.04 |

## Ночная улица

| Метрика | chromium 151.0.7922.34 (02-lighting-high-chromium.json) | chromium 151.0.7922.34 (03-shadows-high-chromium.json) | Разница |
| --- | ---: | ---: | --- |
| FPS (по медиане кадра) | 69.9 | 86.2 |  |
| Время кадра p50, мс | 14.3 | 11.6 | chromium 151.0.7922.34 (03-shadows-high-chromium.json) быстрее на 23 % |
| Время кадра p95, мс | 26.1 | 26.2 | поровну |
| Главный поток p50, мс | 0.70 | 0.70 | поровну |
| Draw call'ов p50 | 113 | 126 |  |
| Треугольников p50 | 167 397 | 154 818 |  |
| Время GPU p50, мс | 7.20 | 6.07 | chromium 151.0.7922.34 (03-shadows-high-chromium.json) быстрее на 19 % |
| Буфер отрисовки | 2880×1800 | 2880×1800 |  |
| Интервалов в выборке | 2 716 | 906 |  |
| Загрузка до конца заставки, мс | 665.9 | 511.2 | chromium 151.0.7922.34 (03-shadows-high-chromium.json) быстрее на 30 % |
| — из них генерация текстур, мс | 438.2 | 352.2 | chromium 151.0.7922.34 (03-shadows-high-chromium.json) быстрее на 24 % |

| Проход | chromium 151.0.7922.34 (02-lighting-high-chromium.json), мс | chromium 151.0.7922.34 (03-shadows-high-chromium.json), мс |
| --- | ---: | ---: |
| main#0:статика района | 3.04 | 2.01 |
| clear#0:очистка, камера и разгон конвейера | 1.17 | 0.01 |
| glow#1:свечения и маркеры | 0.66 | 0.06 |
| tone#0:тонмаппинг в холст | 0.66 | 0.77 |
| sky#0:небо | 0.24 | 0.21 |
| main#1:персонажи и техника | 0.11 | 0.09 |
| glow#0:тени под объектами | 0.04 | -0.05 |

## Ночные витрины

| Метрика | chromium 151.0.7922.34 (02-lighting-high-chromium.json) | chromium 151.0.7922.34 (03-shadows-high-chromium.json) | Разница |
| --- | ---: | ---: | --- |
| FPS (по медиане кадра) | 74.6 | 90.1 |  |
| Время кадра p50, мс | 13.4 | 11.1 | chromium 151.0.7922.34 (03-shadows-high-chromium.json) быстрее на 21 % |
| Время кадра p95, мс | 26.1 | 26.2 | поровну |
| Главный поток p50, мс | 0.60 | 0.80 | chromium 151.0.7922.34 (02-lighting-high-chromium.json) быстрее на 33 % |
| Draw call'ов p50 | 152 | 179 |  |
| Треугольников p50 | 199 377 | 202 634 |  |
| Время GPU p50, мс | 6.93 | 6.49 | chromium 151.0.7922.34 (03-shadows-high-chromium.json) быстрее на 7 % |
| Буфер отрисовки | 2880×1800 | 2880×1800 |  |
| Интервалов в выборке | 2 830 | 923 |  |
| Загрузка до конца заставки, мс | 570.6 | 521 | chromium 151.0.7922.34 (03-shadows-high-chromium.json) быстрее на 10 % |
| — из них генерация текстур, мс | 382.4 | 351.4 | chromium 151.0.7922.34 (03-shadows-high-chromium.json) быстрее на 9 % |

| Проход | chromium 151.0.7922.34 (02-lighting-high-chromium.json), мс | chromium 151.0.7922.34 (03-shadows-high-chromium.json), мс |
| --- | ---: | ---: |
| main#0:статика района | 3.64 | 2.42 |
| clear#0:очистка, камера и разгон конвейера | 1.53 | 0.01 |
| glow#1:свечения и маркеры | 0.71 | 0.02 |
| tone#0:тонмаппинг в холст | 0.69 | 0.90 |
| sky#0:небо | 0.15 | 0.04 |
| glow#0:тени под объектами | 0.08 | -0.08 |
| main#1:персонажи и техника | 0.02 | 0.15 |

## Расширения WebGL2

| Расширение | chromium 151.0.7922.34 (02-lighting-high-chromium.json) | chromium 151.0.7922.34 (03-shadows-high-chromium.json) |
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

Всего расширений: chromium 151.0.7922.34 (02-lighting-high-chromium.json) — 36, chromium 151.0.7922.34 (03-shadows-high-chromium.json) — 36.

## Память

| | chromium 151.0.7922.34 (02-lighting-high-chromium.json) | chromium 151.0.7922.34 (03-shadows-high-chromium.json) |
| --- | ---: | ---: |
| Текстур (объектов GL) | 12 | 18 |
| Нулевой уровень, МиБ | 67.5 | 101.8 |
| Текстуры с мипами, МиБ | 83.4 | 117.7 |
| Буферы, МиБ | 17.0 | 17.0 |

