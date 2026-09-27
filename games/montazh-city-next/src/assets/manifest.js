/* =====================================================================
   manifest.js — манифест ассетов: что игре нужно, где лежит, какого
   качества и откуда взялось. Движок берёт отсюда пути; всё, чего ещё нет,
   описано тут же со спецификацией и запасным вариантом — чтобы было видно,
   что осталось сделать, и чтобы игра не падала, пока ассета нет.

   Пути — относительно public/assets/ (в сборке — assets/).
   Требования к персонажам (все одинаковые, их собирает
   tools/assets/rig-character.mjs из любой статичной модели в A-позе):
     • 20–45 тыс. треугольников, одна текстура 2048 (цвет) + 1024 (MR);
     • рост в метрах, ступни на нуле, лицом на +Z;
     • скелет в именах Mixamo (mixamorig:Hips … Toe_End), 27 костей,
       в покое повороты единичные — клипы Mixamo переносятся без ручной
       настройки;
     • клипы: idle, walk, run (+ idle2/walk2/run2 для разнообразия),
       talkYes, talkNo. Действия старой игры (отвёртка, лестница, замах,
       испуг, посадка на велосипед) — процедурно, поверх клипов.
   ===================================================================== */
export const MANIFEST = {
  env: {
    id: 'kloofendal_38d_partly_cloudy_puresky',
    source: 'Poly Haven, CC0', note: 'небо 17:00, солнце 38°; видимая часть — JPG, освещение — HDR без солнца'
  },
  characters: {
    oleg:   { file: 'characters/oleg.glb',   meta: 'characters/oleg.json',   role: 'Олег, главный герой',        source: 'Krea 2 → Hunyuan3D-2.1 → свой риг' },
    vanya:  { file: 'characters/vanya.glb',  meta: 'characters/vanya.json',  role: 'Ваня, бригадир',             source: 'Krea 2 → Hunyuan3D-2.1 → свой риг' },
    kostya: { file: 'characters/kostya.glb', meta: 'characters/kostya.json', role: 'Костя, монтажник',           source: 'Krea 2 → Hunyuan3D-2.1 → свой риг' },
    sanya:  { file: 'characters/sanya.glb',  meta: 'characters/sanya.json',  role: 'Саня, на телефоне',          source: 'Krea 2 → Hunyuan3D-2.1 → свой риг' },
    ped_man: { file: 'characters/ped_man.glb', meta: 'characters/ped_man.json', role: 'прохожий',                 source: 'Krea 2 → Hunyuan3D-2.1 → свой риг' },
    gran:    { file: 'characters/gran.glb',    meta: 'characters/gran.json',    role: 'бабушка у подъезда',       source: 'Krea 2 → Hunyuan3D-2.1 → свой риг' },
    hool:    { file: 'characters/hool.glb',    meta: 'characters/hool.json',    role: 'дворовый хулиган',         source: 'Krea 2 → Hunyuan3D-2.1 → свой риг' }
  },
  vehicles: {
    sedan: { file: 'vehicles/lada.glb', meta: 'vehicles/lada.json', paint: 'vehicles/lada_paint.webp', role: '«семёрка», все легковые района', source: 'Krea 2 → Hunyuan3D-2.1 → tools/assets/build-car.mjs' }
  },
  props: { catalog: 'props/catalog.json', source: 'Poly Haven, CC0 (список — assets-src/sources.json)' },
  textures: { dir: 'textures/', source: 'Poly Haven, CC0' }
};

/* Чего пока нет — и чем это временно заменено. Статус виден в журнале
   (docs/ASSETS.md) и в меню «Ассеты» просмотрщика. */
export const PLANNED = {
  ped_woman: { role: 'прохожая', fallback: ['ped_man'], spec: 'женщина 25–60, пальто, сумка; 3 варианта' },
  guard:     { role: 'охранник', fallback: ['ped_man'], spec: 'чёрная форма, кепи, рация' },
  client:    { role: 'клиент заявки', fallback: ['ped_man'], spec: 'деловой, пиджак; жесты разговора' },
  dog:       { role: 'дворовая собака', fallback: null, spec: 'четвероногий риг, клипы бег/лай/лёжа — нужен отдельный риггер' },
  van:       { role: 'фургон («буханка», «газель»)', fallback: ['sedan'], spec: 'как «семёрка»: колёса отдельно, маска краски' },
  pickup:    { role: 'пикап', fallback: ['sedan'], spec: 'как «семёрка»' }
};

const KIND = { oleg: 'oleg', vanya: 'vanya', kostya: 'kostya', sanya: 'sanya', boris: 'vanya', egorov: 'client', tamara: 'ped_woman', client: 'client', ped: 'ped_man', hool: 'hool', gran: 'gran', guard: 'guard' };

/* модель для вида сущности: готовая, а если её ещё нет — запасная; у
   массовки запасная выбирается по сущности, чтобы толпа не была на одно лицо */
export function modelFor(kind, e) {
  const want = KIND[kind] || 'ped_man';
  if (MANIFEST.characters[want]) return want;
  const fb = PLANNED[want]?.fallback || ['sanya'];
  const i = e ? Math.abs(Math.floor((e.hx ?? e.x) * 7 + (e.hz ?? e.z) * 3)) % fb.length : 0;
  return fb[i];
}
