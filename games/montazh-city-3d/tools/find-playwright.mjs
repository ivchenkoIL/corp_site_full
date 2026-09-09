/* =====================================================================
   find-playwright.mjs — найти playwright, где бы он ни лежал.

   Обычная причина сбоя запуска не в коде, а в том, что playwright стоит не
   рядом со скриптом: глобально, в домашней папке, в другом проекте. Вместо
   «Cannot find module» и требования выставлять NODE_PATH руками — ищем сами
   по всем обычным местам и, если не нашли, объясняем, что делать.
   ===================================================================== */
import { createRequire } from 'node:module';
import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import fs from 'node:fs';
import os from 'node:os';

const HERE = path.dirname(fileURLToPath(import.meta.url));

function candidates() {
  const list = [];
  /* рядом со скриптом и вверх по дереву — обычный node_modules */
  let d = HERE;
  for (let i = 0; i < 8; i++) {
    list.push(path.join(d, 'node_modules'));
    const up = path.dirname(d);
    if (up === d) break;
    d = up;
  }
  /* глобальная папка npm */
  try { list.push(execSync('npm root -g', { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim()); } catch { }
  /* домашняя папка: сюда попадает `npm i playwright`, выполненный в ~ */
  list.push(path.join(os.homedir(), 'node_modules'));
  /* то, что явно попросили */
  for (const p of (process.env.NODE_PATH || '').split(path.delimiter)) if (p) list.push(p);
  /* привычные места установки */
  list.push('/usr/lib/node_modules', '/usr/local/lib/node_modules', '/opt/homebrew/lib/node_modules');
  return [...new Set(list.filter(Boolean))];
}

export function loadPlaywright() {
  const tried = [];
  for (const root of candidates()) {
    for (const pkg of ['playwright', 'playwright-core']) {
      const entry = path.join(root, pkg, 'package.json');
      tried.push(entry);
      if (!fs.existsSync(entry)) continue;
      try {
        const req = createRequire(path.join(root, pkg, 'index.js'));
        const pw = req(path.join(root, pkg));
        if (pw && pw.chromium) return { pw, from: path.join(root, pkg) };
      } catch { /* пробуем следующий */ }
    }
  }
  const err = [
    'Не нашёл playwright.',
    '',
    'Поставь его рядом с игрой:',
    '    cd ' + path.resolve(HERE, '..'),
    '    npm init -y && npm i -D playwright',
    '    npx playwright install chromium webkit',
    '',
    'Или укажи, где он лежит:',
    '    NODE_PATH=$(npm root -g) node tools/perf-probe.mjs …',
    '',
    'Искал в: ' + candidates().join(', ')
  ].join('\n');
  const e = new Error(err);
  e.tried = tried;
  throw e;
}
