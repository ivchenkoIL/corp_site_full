# corp_site_full — дайджест новостей ИИ для vest-smr.ru

Репозиторий обслуживает раздел «Новости» портала vest-smr.ru: SPA-дашборд
+ генератор дайджеста через YandexGPT.

Отдельный подпроект: [`messenger/`](messenger/) — zero-knowledge релей для
закрытого E2EE-мессенджера (Rust). Исследование и спецификация:
[`docs/anonymous-vps-e2ee-messenger.md`](docs/anonymous-vps-e2ee-messenger.md).

## Структура

- `salon-dashboard/` — SPA (Vite + React), собирается в `dist/` и выкладывается
  в `/var/www/vest-smr` на ВМ портала.
- `scripts/update-news.mjs` — раз в сутки (дважды: 07:00 и 19:00 МСК) собирает
  свежие материалы об ИИ из RSS, просит YandexGPT сделать пересказ и прогнозы,
  пишет `data/news.json` + `data/summary.json`.
- `deploy/` — конфиг nginx, systemd-юниты (`vest-smr-news.timer`,
  `vest-smr-deploy.timer`) и скрипты первичной настройки ВМ.
- `.github/workflows/` — CI (сборка и линт SPA, ручная проверка сайта снаружи,
  резервный вариант генерации новостей и деплоя через GitHub Actions).
- `messenger/`, `docs/` — отдельный подпроект E2EE-мессенджера (см. выше),
  к новостям vest-smr.ru отношения не имеет.

Основной способ запуска — локальные systemd-таймеры прямо на ВМ портала
(см. `deploy/README.md`); GitHub Actions — запасной путь, требует секретов
`YC_API_KEY`/`YC_FOLDER_ID`/`DEPLOY_HOST` и без них ничего не делает.

## Локальный запуск генератора

```bash
YC_API_KEY=... YC_FOLDER_ID=... node scripts/update-news.mjs salon-dashboard/public/data/news.json
```
